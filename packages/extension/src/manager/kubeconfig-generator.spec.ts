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

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { ExtensionContext, TelemetryLogger, Uri } from '@podman-desktop/api';
import { process as pdProcess, kubernetes } from '@podman-desktop/api';
import type { RpcExtension } from '@kubernetes-iam/rpc';
import type { Container } from 'inversify';
import { InversifyBinding } from '/@/inject/inversify-binding';
import { KubeconfigGenerator } from './kubeconfig-generator';
import { DashboardApiManager } from './dashboard-api-manager';
import { DashboardStatesManager } from './dashboard-states-manager';
import type {
  KubernetesDashboardExtensionApi,
  KubernetesDashboardSubscriber,
  contexts,
} from '@podman-desktop/kubernetes-dashboard-extension-api';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';

vi.mock(import('node:fs/promises'));

let container: Container;
let generator: KubeconfigGenerator;

const mockApi: KubernetesDashboardExtensionApi = {
  patchResources: vi.fn(),
  patchSubresource: vi.fn(),
  deleteResource: vi.fn(),
  getSubscriber: vi.fn(),
  contexts: { connect: vi.fn() } as unknown as typeof contexts,
};

const mockSubscriber: KubernetesDashboardSubscriber = {
  onContextsHealth: vi.fn(),
  onContextsPermissions: vi.fn(),
  onResourcesCount: vi.fn(),
  onResourceUpdate: vi.fn(),
  dispose: vi.fn(),
};

const telemetryLoggerMock: TelemetryLogger = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

beforeEach(async () => {
  vi.resetAllMocks();

  vi.mocked(mkdtemp).mockResolvedValue('/test-tmpdir/k8s-iam-test');
  vi.mocked(writeFile).mockResolvedValue();
  vi.mocked(rm).mockResolvedValue();

  const inversifyBinding = new InversifyBinding({} as RpcExtension, {} as ExtensionContext, telemetryLoggerMock);
  container = await inversifyBinding.initBindings();
  generator = container.get(KubeconfigGenerator);

  const dashboardApiManager = container.get(DashboardApiManager);
  vi.spyOn(dashboardApiManager, 'getApi').mockReturnValue(mockApi);

  const dashboardStatesManager = container.get(DashboardStatesManager);
  vi.spyOn(dashboardStatesManager, 'getSubscriber').mockReturnValue(mockSubscriber);
});

describe('KubeconfigGenerator', () => {
  test('rejects invalid username', async () => {
    await expect(generator.generate('../bad-user')).rejects.toThrow('Invalid username');
  });

  test('rejects empty username starting with dot', async () => {
    await expect(generator.generate('.hidden')).rejects.toThrow('Invalid username');
  });

  test('throws when openssl is not available', async () => {
    vi.mocked(pdProcess.exec).mockRejectedValueOnce(new Error('command not found'));

    await expect(generator.generate('alice')).rejects.toThrow('command not found');
  });

  test('happy path: generates kubeconfig and logs it', async () => {
    vi.mocked(pdProcess.exec)
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'OpenSSL 3.0', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'PRIVATE KEY PEM', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'CSR PEM', stderr: '' });

    vi.mocked(kubernetes.getKubeconfig).mockReturnValue({ fsPath: '/test-tmpdir/kubeconfig' } as unknown as Uri);

    vi.mocked(readFile).mockResolvedValue(`
apiVersion: v1
kind: Config
current-context: ctx1
contexts:
  - name: ctx1
    context:
      cluster: my-cluster
clusters:
  - name: my-cluster
    cluster:
      server: https://127.0.0.1:6443
      certificate-authority-data: Y2EtZGF0YQ==
`);

    vi.mocked(mockSubscriber.onResourceUpdate).mockImplementation((_options, listener) => {
      setTimeout(() => {
        // Get the CSR name from the patchResources call
        const call = vi.mocked(mockApi.patchResources).mock.calls[0];
        const yaml = call?.[0] ?? '';
        const nameMatch = /name: (iam-alice-\d+)/.exec(yaml);
        const csrName = nameMatch?.[1] ?? 'iam-alice-0';

        listener({
          resources: [
            {
              contextName: 'ctx1',
              resourceName: 'certificatesigningrequests',
              items: [
                {
                  metadata: { name: csrName },
                  status: { certificate: 'c2lnbmVkLWNlcnQ=' },
                },
              ],
            },
          ],
        });
      }, 10);
      return { dispose: vi.fn() };
    });

    await generator.generate('alice');

    expect(pdProcess.exec).toHaveBeenCalledWith('openssl', ['version']);
    expect(pdProcess.exec).toHaveBeenCalledWith('openssl', ['genrsa', '2048']);
    expect(pdProcess.exec).toHaveBeenCalledWith('openssl', [
      'req',
      '-new',
      '-key',
      expect.any(String),
      '-subj',
      '/CN=alice',
    ]);

    expect(mockApi.patchResources).toHaveBeenCalledWith(expect.any(String), {
      strategy: 'server-side-apply',
      fieldManager: 'kubernetes-iam',
    });
    expect(mockApi.patchSubresource).toHaveBeenCalledWith(
      'certificates.k8s.io/v1',
      'certificatesigningrequests',
      expect.stringContaining('iam-alice-'),
      'approval',
      expect.objectContaining({
        status: expect.objectContaining({
          conditions: expect.arrayContaining([expect.objectContaining({ type: 'Approved', status: 'True' })]),
        }),
      }),
    );

    expect(mockApi.deleteResource).toHaveBeenCalledWith(
      'CertificateSigningRequest',
      expect.stringContaining('iam-alice-'),
    );

    expect(writeFile).toHaveBeenCalledWith('/test-tmpdir/kubeconfig', expect.stringContaining('ctx1-alice'));
    const writtenContent = vi.mocked(writeFile).mock.calls.find(c => c[0] === '/test-tmpdir/kubeconfig')?.[1] as string;
    expect(writtenContent).toContain('ctx1-alice');
    expect(writtenContent).toContain('ctx1-alice-user');
  });

  test('cleans up CSR on approval failure', async () => {
    vi.mocked(pdProcess.exec)
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'OpenSSL 3.0', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'PRIVATE KEY PEM', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'CSR PEM', stderr: '' });

    vi.mocked(mockApi.patchSubresource).mockRejectedValueOnce(new Error('approval denied'));

    await expect(generator.generate('bob')).rejects.toThrow('approval denied');

    expect(mockApi.deleteResource).toHaveBeenCalledWith(
      'CertificateSigningRequest',
      expect.stringContaining('iam-bob-'),
    );
  });

  test('adds numeric suffix when context name already exists', async () => {
    vi.mocked(pdProcess.exec)
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'OpenSSL 3.0', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'PRIVATE KEY PEM', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'CSR PEM', stderr: '' });

    vi.mocked(kubernetes.getKubeconfig).mockReturnValue({ fsPath: '/test-tmpdir/kubeconfig' } as unknown as Uri);

    vi.mocked(readFile).mockResolvedValue(`
apiVersion: v1
kind: Config
current-context: ctx1
contexts:
  - name: ctx1
    context:
      cluster: my-cluster
  - name: ctx1-alice
    context:
      cluster: my-cluster
      user: old-alice
clusters:
  - name: my-cluster
    cluster:
      server: https://127.0.0.1:6443
      certificate-authority-data: Y2EtZGF0YQ==
users:
  - name: old-alice
    user: {}
`);

    vi.mocked(mockSubscriber.onResourceUpdate).mockImplementation((_options, listener) => {
      setTimeout(() => {
        const call = vi.mocked(mockApi.patchResources).mock.calls[0];
        const yaml = call?.[0] ?? '';
        const nameMatch = /name: (iam-alice-\d+)/.exec(yaml);
        const csrName = nameMatch?.[1] ?? 'iam-alice-0';

        listener({
          resources: [
            {
              contextName: 'ctx1',
              resourceName: 'certificatesigningrequests',
              items: [
                {
                  metadata: { name: csrName },
                  status: { certificate: 'c2lnbmVkLWNlcnQ=' },
                },
              ],
            },
          ],
        });
      }, 10);
      return { dispose: vi.fn() };
    });

    await generator.generate('alice');

    const writtenContent = vi.mocked(writeFile).mock.calls.find(c => c[0] === '/test-tmpdir/kubeconfig')?.[1] as string;
    expect(writtenContent).toContain('ctx1-alice-2');
  });

  test('throws when dashboard subscriber is not available', async () => {
    vi.mocked(pdProcess.exec)
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'OpenSSL 3.0', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'PRIVATE KEY PEM', stderr: '' })
      .mockResolvedValueOnce({ command: 'openssl', stdout: 'CSR PEM', stderr: '' });

    const dashboardStatesManager = container.get(DashboardStatesManager);
    vi.spyOn(dashboardStatesManager, 'getSubscriber').mockReturnValue(undefined);

    await expect(generator.generate('alice')).rejects.toThrow('Dashboard subscriber not available');

    expect(mockApi.deleteResource).toHaveBeenCalled();
  });
});
