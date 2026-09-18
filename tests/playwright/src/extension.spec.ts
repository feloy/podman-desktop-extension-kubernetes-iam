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

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Page } from '@playwright/test';
import type { ExtensionsPage } from '@podman-desktop/tests-playwright';
import {
  expect as playExpect,
  PreferencesPage,
  RunnerOptions,
  StatusBar,
  test,
} from '@podman-desktop/tests-playwright';

import { KubernetesIamDetailsPage } from './model/pages/iam-details-page';
import { UsersPage } from './model/pages/users-page';
import { handleWebview } from './utils/webviewHandler';

const DASHBOARD_OCI_IMAGE =
  process.env.DASHBOARD_OCI_IMAGE ??
  'ghcr.io/podman-desktop/podman-desktop-extension-kubernetes-dashboard/pr:c353a4c5ae4e4a94f2a4197e4689eb7f3c0c6008';
const IAM_OCI_IMAGE = process.env.EXTENSION_OCI_IMAGE ?? 'ghcr.io/feloy/podman-desktop-extension-kubernetes-iam:latest';
const EXTENSION_PREINSTALLED: boolean = process.env.EXTENSION_PREINSTALLED === 'true';
const DASHBOARD_EXTENSION_LABEL: string = 'podman-desktop.kubernetes-dashboard';
const DASHBOARD_EXTENSION_NAME: string = 'Kubernetes Dashboard';
const IAM_EXTENSION_LABEL: string = 'podman-desktop.kubernetes-iam';
const IAM_EXTENSION_NAME: string = 'Kubernetes IAM';
const CATALOG_STATUS_ACTIVE: string = 'ACTIVE';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENVTEST_KUBECONFIG = path.resolve(__dirname, '..', '..', 'resources', 'envtest-kubeconfig');
const USER1_CLUSTER_ROLE_BINDING = path.resolve(__dirname, '..', '..', 'resources', 'user1-clusterrolebinding.yaml');

function kubectlBinary(): string {
  const assets = process.env.KUBEBUILDER_ASSETS;
  if (assets) {
    return path.join(assets, process.platform === 'win32' ? 'kubectl.exe' : 'kubectl');
  }
  return 'kubectl';
}

function applyUser1ClusterRoleBinding(kubeconfigPath: string): void {
  execFileSync(kubectlBinary(), ['apply', '-f', USER1_CLUSTER_ROLE_BINDING], {
    env: { ...process.env, KUBECONFIG: kubeconfigPath },
    stdio: 'pipe',
  });
}

test.use({
  runnerOptions: new RunnerOptions({
    customFolder: 'kubernetes-iam-tests',
    /**
     * For performance reasons, disable extensions which are not necessary for the e2e
     */
    customSettings: {
      'extensions.disabled': [
        'podman-desktop.compose',
        'podman-desktop.docker',
        'podman-desktop.kind',
        'podman-desktop.kubectl-cli',
        'podman-desktop.lima',
        'podman-desktop.minikube',
        'podman-desktop.registries',
      ],
    },
  }),
});

test.beforeAll(async ({ runner, welcomePage }) => {
  test.setTimeout(80_000);

  runner.setVideoAndTraceName('kubernetes-iam-e2e');
  await welcomePage.handleWelcomePage(true);
});

test.afterAll(async ({ runner }) => {
  test.setTimeout(200_000);
  await runner.close();
});

test.describe(`Extension installation and verification`, { tag: '@integration' }, () => {
  test.skip(EXTENSION_PREINSTALLED, 'Extension is preinstalled');
  test.describe.serial(`Extension installation`, () => {
    let extensionsPage: ExtensionsPage;

    test(`Open Settings -> Extensions page`, async ({ navigationBar }) => {
      const dashboardPage = await navigationBar.openDashboard();
      await playExpect(dashboardPage.mainPage).toBeVisible();
      extensionsPage = await navigationBar.openExtensions();
      await playExpect(extensionsPage.header).toBeVisible();
    });

    test(`Install Kubernetes Dashboard extension`, async () => {
      await extensionsPage.installExtensionFromOCIImage(DASHBOARD_OCI_IMAGE);
    });

    test(`Install Kubernetes IAM extension`, async () => {
      await extensionsPage.installExtensionFromOCIImage(IAM_OCI_IMAGE);
    });

    test('Dashboard and IAM extensions are installed, present and active', async ({ navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      await playExpect
        .poll(async () => await extensions.extensionIsInstalled(DASHBOARD_EXTENSION_LABEL), {
          timeout: 30000,
        })
        .toBeTruthy();
      await playExpect
        .poll(async () => await extensions.extensionIsInstalled(IAM_EXTENSION_LABEL), {
          timeout: 30000,
        })
        .toBeTruthy();
      const dashboardCard = await extensions.getInstalledExtension(DASHBOARD_EXTENSION_NAME, DASHBOARD_EXTENSION_LABEL);
      await playExpect(dashboardCard.status).toHaveText(CATALOG_STATUS_ACTIVE);
      const iamCard = await extensions.getInstalledExtension(IAM_EXTENSION_NAME, IAM_EXTENSION_LABEL);
      await playExpect(iamCard.status).toHaveText(CATALOG_STATUS_ACTIVE);
    });

    test(`IAM extension details show correct status, no error`, async ({ page, navigationBar }) => {
      const extensions = await navigationBar.openExtensions();
      const extensionCard = await extensions.getInstalledExtension('kubernetes-iam', IAM_EXTENSION_LABEL);
      await extensionCard.openExtensionDetails(IAM_EXTENSION_NAME);
      const details = new KubernetesIamDetailsPage(page);
      await playExpect(details.heading).toBeVisible();
      await playExpect(details.status).toHaveText(CATALOG_STATUS_ACTIVE);
      const errorTab = details.tabs.getByRole('button', { name: 'Error' });
      // we would like to propagate the error's stack trace into test failure message
      let stackTrace = '';
      if ((await errorTab.count()) > 0) {
        await details.activateTab('Error');
        stackTrace = await details.errorStackTrace.innerText();
      }
      await playExpect(errorTab, `Error Tab was present with stackTrace: ${stackTrace}`).not.toBeVisible();
    });
  });
});

test.describe(`Configure kubeconfig file`, { tag: '@integration' }, () => {
  test('Load kubeconfig file in Preferences', async ({ page, navigationBar }) => {
    // copy testing kubeconfig file to the expected location
    const kubeConfigPathSrc = ENVTEST_KUBECONFIG;
    const kubeConfigPathDst = path.resolve(__dirname, '..', 'tests', 'playwright', 'resources', 'kube-config');
    fs.mkdirSync(path.dirname(kubeConfigPathDst), { recursive: true });
    fs.copyFileSync(kubeConfigPathSrc, kubeConfigPathDst);
    // envtest --users only issues a client cert; IAM lists User subjects from bindings.
    applyUser1ClusterRoleBinding(kubeConfigPathSrc);

    // open preferences page
    const settingsBar = await navigationBar.openSettings();
    await settingsBar.expandPreferencesTab();
    const preferencesPage = await settingsBar.openTabPage(PreferencesPage);
    await playExpect(preferencesPage.heading).toBeVisible();

    await preferencesPage.selectKubeFile(kubeConfigPathDst);

    const statusbar = new StatusBar(page);
    await statusbar.validateKubernetesContext('envtest');
  });
});

test.describe.serial(`Extension usage`, { tag: '@integration' }, () => {
  let webview: Page;

  test('Open IAM webview and display the Users page', async ({ runner, page, navigationBar }) => {
    [, webview] = await handleWebview(runner, page, navigationBar);
    const usersPage = new UsersPage(webview);
    await playExpect(usersPage.heading).toBeVisible({ timeout: 30_000 });
    await playExpect(usersPage.createUserButton).toBeVisible();
    await playExpect(usersPage.getUserButton('user1')).toBeVisible({ timeout: 60_000 });
  });

  test('Open user1 details and display the bound cluster-admin role', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser('user1');
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });
    await playExpect(details.addClusterRoleButton).toBeVisible();
    const roleRow = details.getRoleRow('cluster-admin');
    await playExpect(roleRow).toBeVisible({ timeout: 30_000 });
    await playExpect(roleRow.getByRole('cell', { name: 'ClusterRole', exact: true })).toBeVisible();
    await playExpect(roleRow.getByRole('cell', { name: 'user1-cluster-admin', exact: true })).toBeVisible();

    const resourceRuleRow = details.getRuleRow('*');
    await playExpect(resourceRuleRow).toBeVisible({ timeout: 30_000 });
    await playExpect(resourceRuleRow.getByRole('cell', { name: '*', exact: true })).toHaveCount(3);

    const nonResourceRuleRow = details.getRuleRow('non-resource');
    await playExpect(nonResourceRuleRow).toBeVisible({ timeout: 30_000 });
    await playExpect(nonResourceRuleRow.getByRole('cell', { name: 'non-resource', exact: true })).toBeVisible();
    await playExpect(nonResourceRuleRow.getByRole('cell', { name: '*', exact: true })).toHaveCount(2);
  });
});
