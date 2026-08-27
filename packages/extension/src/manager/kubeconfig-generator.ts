/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { inject, injectable } from 'inversify';
import { process as pdProcess, kubernetes } from '@podman-desktop/api';
import type { KubernetesDashboardExtensionApi } from '@podman-desktop/kubernetes-dashboard-extension-api';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';
import { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import { writeFile, mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse, stringify } from 'yaml';

interface KubeconfigFile {
  'current-context'?: string;
  contexts?: Array<{ name: string; context?: { cluster?: string; user?: string } }>;
  clusters?: Array<{ name: string; cluster?: { server?: string; 'certificate-authority-data'?: string } }>;
  users?: Array<{ name: string; user?: { 'client-certificate-data'?: string; 'client-key-data'?: string } }>;
  [key: string]: unknown;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._@-]*$/;
const DEFAULT_EXPIRATION_SECONDS = 86400;
const CERTIFICATE_WAIT_TIMEOUT_MS = 30_000;

@injectable()
export class KubeconfigGenerator {
  @inject(DashboardApiManager)
  private dashboardApiManager: DashboardApiManager;

  @inject(DashboardStatesManager)
  private dashboardStatesManager: DashboardStatesManager;

  async generate(username: string, expirationSeconds?: number): Promise<void> {
    if (!USERNAME_PATTERN.exec(username)) {
      throw new Error(`Invalid username: ${username}`);
    }

    const expiration = expirationSeconds ?? DEFAULT_EXPIRATION_SECONDS;
    const api = this.getApi();
    let tempDir: string | undefined;

    try {
      await this.checkPrerequisites();
      await api.contexts.connect('', { resources: ['certificatesigningrequests'] });

      tempDir = await mkdtemp(join(tmpdir(), 'k8s-iam-'));
      const keyPath = join(tempDir, 'key.pem');

      const privateKey = await this.generatePrivateKey();
      await writeFile(keyPath, privateKey, { mode: 0o600 });

      const csrPem = await this.generateCsr(keyPath, username);
      const csrName = `iam-${username}-${Date.now()}`;

      const certificatePromise = this.waitForSignedCertificate(csrName);

      await this.createK8sCsr(api, csrName, csrPem, expiration);

      try {
        await this.approveK8sCsr(api, csrName);
        const certificate = await certificatePromise;
        await this.addToKubeconfig(username, privateKey, certificate);
      } finally {
        await this.deleteK8sCsr(api, csrName);
      }
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  private async checkPrerequisites(): Promise<void> {
    await pdProcess.exec('openssl', ['version']);
  }

  private async generatePrivateKey(): Promise<string> {
    const result = await pdProcess.exec('openssl', ['genrsa', '2048']);
    return result.stdout;
  }

  private async generateCsr(keyFilePath: string, username: string): Promise<string> {
    const result = await pdProcess.exec('openssl', ['req', '-new', '-key', keyFilePath, '-subj', `/CN=${username}`]);
    return result.stdout;
  }

  private async createK8sCsr(
    api: KubernetesDashboardExtensionApi,
    csrName: string,
    csrPem: string,
    expirationSeconds: number,
  ): Promise<void> {
    const csrBase64 = Buffer.from(csrPem).toString('base64');
    const manifest = `apiVersion: certificates.k8s.io/v1
kind: CertificateSigningRequest
metadata:
  name: ${csrName}
spec:
  request: ${csrBase64}
  signerName: kubernetes.io/kube-apiserver-client
  expirationSeconds: ${expirationSeconds}
  usages:
    - client auth`;

    await api.patchResources(manifest, { strategy: 'server-side-apply', fieldManager: 'kubernetes-iam' });
  }

  private async approveK8sCsr(api: KubernetesDashboardExtensionApi, csrName: string): Promise<void> {
    await api.patchSubresource('certificates.k8s.io/v1', 'certificatesigningrequests', csrName, 'approval', {
      status: {
        conditions: [
          {
            type: 'Approved',
            status: 'True',
            reason: 'KubernetesIAM',
            message: 'Approved by Kubernetes IAM extension',
          },
        ],
      },
    });
  }

  private async waitForSignedCertificate(csrName: string): Promise<string> {
    const subscriber = this.dashboardStatesManager.getSubscriber();
    if (!subscriber) {
      throw new Error('Dashboard subscriber not available');
    }

    return new Promise<string>((resolve, reject) => {
      const subscription = subscriber.onResourceUpdate({ resourceName: 'certificatesigningrequests' }, event => {
        for (const resource of event.resources) {
          if (resource.resourceName !== 'certificatesigningrequests') continue;
          for (const item of resource.items) {
            const metadata = (item.metadata ?? {}) as Record<string, unknown>;
            if (metadata['name'] !== csrName) continue;
            const status = (item as Record<string, unknown>)['status'] as Record<string, unknown> | undefined;
            const certificate = status?.['certificate'] as string | undefined;
            if (certificate) {
              clearTimeout(timeout);
              subscription.dispose();
              resolve(certificate);
              return;
            }
          }
        }
      });

      const timeout = setTimeout(() => {
        subscription.dispose();
        reject(new Error(`Timed out waiting for certificate for CSR ${csrName}`));
      }, CERTIFICATE_WAIT_TIMEOUT_MS);
    });
  }

  private async addToKubeconfig(username: string, privateKey: string, certificateBase64: string): Promise<void> {
    const kubeconfigPath = kubernetes.getKubeconfig().fsPath;
    const content = await readFile(kubeconfigPath, 'utf8');
    const config = parse(content) as KubeconfigFile;

    const currentContext = config['current-context'];
    if (!currentContext) {
      throw new Error('No current context set in kubeconfig');
    }

    const ctx = config.contexts?.find(c => c.name === currentContext);
    if (!ctx?.context?.cluster) {
      throw new Error(`Context ${currentContext} not found in kubeconfig`);
    }

    const clusterName = ctx.context.cluster;
    const contextName = this.uniqueContextName(config, `${currentContext}-${username}`);
    const userName = `${contextName}-user`;
    const keyBase64 = Buffer.from(privateKey).toString('base64');

    config.users ??= [];
    config.users.push({
      name: userName,
      user: {
        'client-certificate-data': certificateBase64,
        'client-key-data': keyBase64,
      },
    });

    config.contexts ??= [];
    config.contexts.push({
      name: contextName,
      context: { cluster: clusterName, user: userName },
    });

    await writeFile(kubeconfigPath, stringify(config));
  }

  private uniqueContextName(config: KubeconfigFile, base: string): string {
    const existing = new Set((config.contexts ?? []).map(c => c.name));
    if (!existing.has(base)) return base;
    let i = 2;
    while (existing.has(`${base}-${i}`)) i++;
    return `${base}-${i}`;
  }

  private async deleteK8sCsr(api: KubernetesDashboardExtensionApi, csrName: string): Promise<void> {
    try {
      await api.deleteResource('CertificateSigningRequest', csrName);
    } catch {
      // non-fatal: best-effort cleanup
    }
  }

  private getApi(): KubernetesDashboardExtensionApi {
    const api = this.dashboardApiManager.getApi();
    if (!api) {
      throw new Error('Dashboard extension API not available');
    }
    return api;
  }
}
