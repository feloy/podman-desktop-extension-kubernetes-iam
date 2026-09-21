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
import type { UserDetailsPage } from './model/pages/user-details-page';
import { UsersPage } from './model/pages/users-page';
import { enableSlowTyping } from './utils/slow-typing';
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
const E2E_USER_NAME: string = 'e2e-user';
const E2E_USER_CONTEXT_NAME: string = `envtest-${E2E_USER_NAME}`;
const E2E_ROLE_NAME: string = 'e2e-pod-reader';
const E2E_CLUSTER_ROLE_NAME: string = 'e2e-node-reader';
const E2E_ROLE_NAMESPACE: string = 'default';
const E2E_SECOND_ROLE_NAMESPACE: string = 'kube-system';
const USER1_CLUSTER_ROLE_BINDING_NAME: string = 'user1-cluster-admin';
const USER1_SECOND_CLUSTER_ROLE_BINDING_NAME: string = 'user1-cluster-admin-second';
const CAPTION_PACE_MS = Number(process.env.CAPTION_PACE_MS) || 0;
const CAPTION_TYPING_DURATION_MS = Number(process.env.CAPTION_TYPING_DURATION_MS) || 0;
const CAPTION_TIMEOUT_BUFFER_MS = 120_000;
const ACTION_STEP_PREFIX = '[video-caption] ';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENVTEST_KUBECONFIG = path.resolve(__dirname, '..', '..', 'resources', 'envtest-kubeconfig');
const PODMAN_DESKTOP_KUBECONFIG = path.resolve(__dirname, '..', 'tests', 'playwright', 'resources', 'kube-config');
const USER1_CLUSTER_ROLE_BINDING = path.resolve(__dirname, '..', '..', 'resources', 'user1-clusterrolebinding.yaml');
const E2E_TEST_CERTIFICATE = path.resolve(__dirname, '..', '..', 'resources', 'e2e-test-certificate.pem');

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

function getKubernetesResource(kubeconfigPath: string, resource: string, name: string, namespace?: string): object {
  const args = ['get', resource, name, '--output=json'];
  if (namespace) {
    args.push('--namespace', namespace);
  }
  return JSON.parse(
    execFileSync(kubectlBinary(), args, {
      env: { ...process.env, KUBECONFIG: kubeconfigPath },
      encoding: 'utf8',
      stdio: 'pipe',
    }),
  ) as object;
}

function resourceRules(resource: object): unknown[] {
  const rules = (resource as { rules?: unknown }).rules;
  return Array.isArray(rules) ? rules : [];
}

function resourceSubjectNames(resource: object): string[] {
  const subjects = (resource as { subjects?: { name?: string }[] }).subjects ?? [];
  return subjects.flatMap(subject => (subject.name ? [subject.name] : []));
}

function kubernetesResourceExists(kubeconfigPath: string, resource: string, name: string, namespace?: string): boolean {
  try {
    getKubernetesResource(kubeconfigPath, resource, name, namespace);
    return true;
  } catch {
    return false;
  }
}

function certificateSigningRequestNames(kubeconfigPath: string): string[] {
  const result = JSON.parse(
    execFileSync(kubectlBinary(), ['get', 'certificatesigningrequests', '--output=json'], {
      env: { ...process.env, KUBECONFIG: kubeconfigPath },
      encoding: 'utf8',
      stdio: 'pipe',
    }),
  ) as object;
  const items = (result as { items?: Array<{ metadata?: { name?: string } }> }).items ?? [];
  return items.flatMap(item => (item.metadata?.name ? [item.metadata.name] : []));
}

function signCertificateSigningRequest(kubeconfigPath: string, name: string): void {
  execFileSync(
    kubectlBinary(),
    [
      'patch',
      'certificatesigningrequest',
      name,
      '--subresource=status',
      '--type=merge',
      '--patch',
      JSON.stringify({ status: { certificate: fs.readFileSync(E2E_TEST_CERTIFICATE).toString('base64') } }),
    ],
    {
      env: { ...process.env, KUBECONFIG: kubeconfigPath },
      stdio: 'pipe',
    },
  );
}

function certificateSigningRequestIsApproved(kubeconfigPath: string, name: string): boolean {
  const csr = getKubernetesResource(kubeconfigPath, 'certificatesigningrequest', name) as {
    status?: { conditions?: Array<{ type?: string; status?: string }> };
  };
  return (
    csr.status?.conditions?.some(condition => condition.type === 'Approved' && condition.status === 'True') ?? false
  );
}

function setClusterRoleBindingUsers(kubeconfigPath: string, name: string, usernames: string[]): void {
  execFileSync(
    kubectlBinary(),
    [
      'patch',
      'clusterrolebinding',
      name,
      '--type=merge',
      '--patch',
      JSON.stringify({
        subjects: usernames.map(username => ({ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: username })),
      }),
    ],
    {
      env: { ...process.env, KUBECONFIG: kubeconfigPath },
      stdio: 'pipe',
    },
  );
}

function createClusterRoleBindingForUser(
  kubeconfigPath: string,
  name: string,
  roleName: string,
  username: string,
): void {
  execFileSync(
    kubectlBinary(),
    ['create', 'clusterrolebinding', name, `--clusterrole=${roleName}`, `--user=${username}`],
    {
      env: { ...process.env, KUBECONFIG: kubeconfigPath },
      stdio: 'pipe',
    },
  );
}

async function recordedStep<T>(caption: string, action: () => Promise<T>): Promise<T> {
  const result = await test.step(`${ACTION_STEP_PREFIX}${caption}`, action);
  await pauseForCaption();
  return result;
}

async function pauseForCaption(): Promise<void> {
  if (CAPTION_PACE_MS > 0) {
    await new Promise(resolve => setTimeout(resolve, CAPTION_PACE_MS));
  }
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

// Captions deliberately pause after annotated, confirmed UI outcomes.
// Reserve that presentation time only for the subtitled recording mode.
test.beforeEach(async ({ page }, testInfo) => {
  enableSlowTyping(page, CAPTION_TYPING_DURATION_MS);
  if (CAPTION_PACE_MS > 0) {
    testInfo.setTimeout(testInfo.timeout + CAPTION_TIMEOUT_BUFFER_MS);
  }
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
    fs.mkdirSync(path.dirname(PODMAN_DESKTOP_KUBECONFIG), { recursive: true });
    fs.copyFileSync(kubeConfigPathSrc, PODMAN_DESKTOP_KUBECONFIG);
    // envtest --users only issues a client cert; IAM lists User subjects from bindings.
    applyUser1ClusterRoleBinding(kubeConfigPathSrc);

    await recordedStep('Load the envtest kubeconfig file', async () => {
      const settingsBar = await navigationBar.openSettings();
      await settingsBar.expandPreferencesTab();
      const preferencesPage = await settingsBar.openTabPage(PreferencesPage);
      await playExpect(preferencesPage.heading).toBeVisible();
      await preferencesPage.selectKubeFile(PODMAN_DESKTOP_KUBECONFIG);
      await new StatusBar(page).validateKubernetesContext('envtest');
    });
  });
});

test.describe.serial(`Extension usage`, { tag: '@integration' }, () => {
  let mainPage: Page;
  let webview: Page;

  test('Open IAM webview and display the Users page', async ({ runner, page, navigationBar }) => {
    await recordedStep('Display the IAM Users page', async () => {
      [mainPage, webview] = await handleWebview(runner, page, navigationBar);
      const usersPage = new UsersPage(webview);
      await playExpect(usersPage.heading).toBeVisible({ timeout: 30_000 });
      await playExpect(usersPage.createUserButton).toBeVisible();
      await playExpect(usersPage.getUserButton('user1')).toBeVisible({ timeout: 60_000 });
    });
  });

  test('Open user1 details and display the bound cluster-admin role', async () => {
    const usersPage = new UsersPage(webview);
    let details!: UserDetailsPage;
    await recordedStep('Inspect user1 cluster-admin permissions', async () => {
      details = await usersPage.openUser('user1');
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
      await details.getRevokeRoleButton('cluster-admin').click();
      const confirmation = mainPage.getByRole('dialog');
      await playExpect(confirmation).toBeVisible();
      await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
      await playExpect(roleRow).toBeVisible();
    });
    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrolebinding', USER1_CLUSTER_ROLE_BINDING_NAME),
    ).toBeTruthy();

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Create a user and display it in the Users page', async () => {
    const usersPage = new UsersPage(webview);
    const dialog = webview.getByRole('dialog', { name: 'Create user' });
    await recordedStep('Create e2e-user', async () => {
      await usersPage.createUserButton.click();
      await playExpect(dialog).toBeVisible();
      await dialog.getByRole('textbox', { name: 'User name' }).fill(E2E_USER_NAME);
      await dialog.getByRole('button', { name: 'Create', exact: true }).click();
      await playExpect(dialog).not.toBeVisible();
      await playExpect(usersPage.getUserButton(E2E_USER_NAME)).toBeVisible({ timeout: 30_000 });
    });
    await recordedStep('Reject duplicate e2e-user creation', async () => {
      await usersPage.createUserButton.click();
      await playExpect(dialog).toBeVisible();
      await dialog.getByRole('textbox', { name: 'User name' }).fill(E2E_USER_NAME);
      await playExpect(dialog.getByText(`A user named ${E2E_USER_NAME} already exists.`)).toBeVisible();
      await playExpect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
    });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    const binding = getKubernetesResource(ENVTEST_KUBECONFIG, 'clusterrolebinding', 'iam-e2e-user-f7802586-basic-user');
    playExpect(binding).toMatchObject({
      roleRef: { kind: 'ClusterRole', name: 'system:basic-user' },
      subjects: [{ kind: 'User', name: E2E_USER_NAME }],
    });
  });

  test('Generate kubeconfig and add its context to the selected file', async () => {
    test.setTimeout(80_000);

    const usersPage = new UsersPage(webview);
    const downloadButton = usersPage.getDownloadKubeconfigButton(E2E_USER_NAME);
    const csrNamesBefore = new Set(certificateSigningRequestNames(ENVTEST_KUBECONFIG));
    const kubeconfigBefore = fs.readFileSync(PODMAN_DESKTOP_KUBECONFIG, 'utf8');
    playExpect(kubeconfigBefore).not.toContain(E2E_USER_CONTEXT_NAME);

    await recordedStep('Start kubeconfig generation for e2e-user', async () => {
      await playExpect(downloadButton).toBeVisible();
      await downloadButton.click();
      await playExpect(downloadButton).toHaveAttribute('aria-busy', 'true');
    });

    // envtest provides only an API server, so this test supplies the signer response.
    let csrName: string | undefined;
    await playExpect
      .poll(
        () => {
          csrName = certificateSigningRequestNames(ENVTEST_KUBECONFIG).find(name => !csrNamesBefore.has(name));
          return csrName;
        },
        { timeout: 30_000 },
      )
      .toBeTruthy();
    if (!csrName) {
      throw new Error('Generated CSR was not found');
    }
    const generatedCsrName = csrName;
    await playExpect.poll(() => certificateSigningRequestIsApproved(ENVTEST_KUBECONFIG, generatedCsrName)).toBeTruthy();
    signCertificateSigningRequest(ENVTEST_KUBECONFIG, generatedCsrName);

    await playExpect
      .poll(() => fs.readFileSync(PODMAN_DESKTOP_KUBECONFIG, 'utf8'), { timeout: 60_000 })
      .toContain(E2E_USER_CONTEXT_NAME);
  });

  test('Bind user1 cluster-admin role to e2e-user and revoke user1', async () => {
    // The UI creates a new ClusterRole and binding; it cannot attach the existing seeded
    // cluster-admin role to e2e-user, so prepare the shared binding directly in the cluster.
    setClusterRoleBindingUsers(ENVTEST_KUBECONFIG, USER1_CLUSTER_ROLE_BINDING_NAME, ['user1', E2E_USER_NAME]);

    const usersPage = new UsersPage(webview);
    const e2eUserDetails = await usersPage.openUser(E2E_USER_NAME);
    await recordedStep('Verify cluster-admin is granted to e2e-user', () =>
      playExpect(e2eUserDetails.getRoleRow('cluster-admin')).toBeVisible({ timeout: 30_000 }),
    );
    await e2eUserDetails.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();

    const user1Details = await usersPage.openUser('user1');
    await recordedStep('Revoke cluster-admin from user1', async () => {
      await user1Details.getRevokeRoleButton('cluster-admin').click();
      const confirmation = mainPage.getByRole('dialog');
      await playExpect(confirmation).toBeVisible();
      await playExpect(confirmation).toContainText(/Revoke ClusterRole cluster-admin \([^)]*\) from user1/);
      await playExpect(confirmation.getByRole('button', { name: 'Delete', exact: true })).not.toBeVisible();
      await confirmation.getByRole('button', { name: 'Revoke', exact: true }).click();
      await playExpect(user1Details.getRoleRow('cluster-admin')).not.toBeVisible({ timeout: 30_000 });
    });
    const binding = getKubernetesResource(ENVTEST_KUBECONFIG, 'clusterrolebinding', USER1_CLUSTER_ROLE_BINDING_NAME);
    playExpect(binding).toMatchObject({ subjects: [{ kind: 'User', name: E2E_USER_NAME }] });
    playExpect(resourceSubjectNames(binding)).toEqual([E2E_USER_NAME]);
    playExpect(kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrole', 'cluster-admin')).toBeTruthy();

    await user1Details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Revoke user1 cluster-admin binding while another binding still grants the role', async () => {
    // user1 was removed from the original binding above, which still grants cluster-admin to e2e-user.
    createClusterRoleBindingForUser(
      ENVTEST_KUBECONFIG,
      USER1_SECOND_CLUSTER_ROLE_BINDING_NAME,
      'cluster-admin',
      'user1',
    );

    const usersPage = new UsersPage(webview);
    const user1Details = await usersPage.openUser('user1');
    await recordedStep('Revoke user1’s remaining cluster-admin binding', async () => {
      await playExpect(user1Details.getRoleRow('cluster-admin')).toBeVisible({ timeout: 30_000 });
      await user1Details.getRevokeRoleButton('cluster-admin').click();
      const confirmation = mainPage.getByRole('dialog');
      await playExpect(confirmation).toBeVisible();
      await playExpect(confirmation).toContainText(`ClusterRoleBinding ${USER1_SECOND_CLUSTER_ROLE_BINDING_NAME}`);
      await playExpect(confirmation.getByRole('button', { name: 'Delete', exact: true })).not.toBeVisible();
      await confirmation.getByRole('button', { name: 'Revoke', exact: true }).click();
      await playExpect(user1Details.getRoleRow('cluster-admin')).not.toBeVisible({ timeout: 30_000 });
    });
    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrolebinding', USER1_SECOND_CLUSTER_ROLE_BINDING_NAME),
    ).toBeFalsy();
    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrolebinding', USER1_CLUSTER_ROLE_BINDING_NAME),
    ).toBeTruthy();
    playExpect(kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrole', 'cluster-admin')).toBeTruthy();

    await user1Details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Create namespaced and cluster-scoped roles for the user', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });

    const roleDialog = webview.getByRole('dialog', { name: 'Create role' });
    const clusterRoleDialog = webview.getByRole('dialog', { name: 'Create cluster role' });
    await recordedStep('Create namespaced role for e2e-user', async () => {
      await details.addRoleButton.click();
      await playExpect(roleDialog).toBeVisible();
      await roleDialog.getByRole('textbox', { name: 'Role name' }).fill(E2E_ROLE_NAME);
      await roleDialog.getByRole('textbox', { name: 'Namespace' }).fill(E2E_ROLE_NAMESPACE);
      await roleDialog.getByRole('button', { name: 'Create', exact: true }).click();
      await playExpect(roleDialog).not.toBeVisible();
      await playExpect(details.getRoleRow(E2E_ROLE_NAME)).toBeVisible({ timeout: 30_000 });
    });
    await recordedStep('Create cluster-scoped role for e2e-user', async () => {
      await details.addClusterRoleButton.click();
      await playExpect(clusterRoleDialog).toBeVisible();
      await clusterRoleDialog.getByRole('textbox', { name: 'Role name' }).fill(E2E_CLUSTER_ROLE_NAME);
      await clusterRoleDialog.getByRole('button', { name: 'Create', exact: true }).click();
      await playExpect(clusterRoleDialog).not.toBeVisible();
      await playExpect(details.getRoleRow(E2E_CLUSTER_ROLE_NAME)).toBeVisible({ timeout: 30_000 });
    });

    playExpect(
      resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)),
    ).toEqual([]);
    playExpect(
      getKubernetesResource(ENVTEST_KUBECONFIG, 'rolebinding', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE),
    ).toMatchObject({
      roleRef: { kind: 'Role', name: E2E_ROLE_NAME },
      subjects: [{ kind: 'User', name: E2E_USER_NAME }],
    });
    playExpect(resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'clusterrole', E2E_CLUSTER_ROLE_NAME))).toEqual(
      [],
    );
    playExpect(getKubernetesResource(ENVTEST_KUBECONFIG, 'clusterrolebinding', E2E_CLUSTER_ROLE_NAME)).toMatchObject({
      roleRef: { kind: 'ClusterRole', name: E2E_CLUSTER_ROLE_NAME },
      subjects: [{ kind: 'User', name: E2E_USER_NAME }],
    });

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Reject creating a role whose name already exists in the namespace', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });
    const dialog = webview.getByRole('dialog', { name: 'Create role' });
    await recordedStep('Reject duplicate role creation', async () => {
      await details.addRoleButton.click();
      await playExpect(dialog).toBeVisible();
      await dialog.getByRole('textbox', { name: 'Role name' }).fill(E2E_ROLE_NAME);
      await dialog.getByRole('textbox', { name: 'Namespace' }).fill(E2E_ROLE_NAMESPACE);
      await dialog.getByRole('button', { name: 'Create', exact: true }).click();
      await playExpect(
        dialog.getByText(
          `A role or role binding named ${E2E_ROLE_NAME} already exists in namespace ${E2E_ROLE_NAMESPACE}`,
        ),
      ).toBeVisible();
    });
    playExpect(kubernetesResourceExists(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)).toBeTruthy();
    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'rolebinding', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE),
    ).toBeTruthy();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Add one rule per API group to a namespaced role', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });

    const roleDialog = webview.getByRole('dialog', { name: 'Add rule' });
    await recordedStep('Add API-group rules to the namespaced role', async () => {
      await details.getAddRuleButton(E2E_ROLE_NAME).click();
      await playExpect(roleDialog).toBeVisible();
      await playExpect(roleDialog.getByRole('checkbox', { name: 'pods', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await roleDialog.getByRole('checkbox', { name: 'pods', exact: true }).check();
      await roleDialog.getByRole('checkbox', { name: 'configmaps', exact: true }).check();
      await roleDialog.getByRole('checkbox', { name: 'deployments', exact: true }).check();
      await roleDialog.getByRole('radio', { name: 'View', exact: true }).check();
      await roleDialog.getByRole('button', { name: 'Add rules', exact: true }).click();
      await playExpect(roleDialog).not.toBeVisible();
    });

    playExpect(
      resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)),
    ).toEqual([
      { apiGroups: [''], resources: ['configmaps', 'pods'], verbs: ['get', 'list', 'watch'] },
      { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch'] },
    ]);

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Add a rule restricted to named resources', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });

    const roleDialog = webview.getByRole('dialog', { name: 'Add rule' });
    await recordedStep('Add a named-pod rule', async () => {
      await details.getAddRuleButton(E2E_ROLE_NAME).click();
      await playExpect(roleDialog).toBeVisible();
      await playExpect(roleDialog.getByRole('checkbox', { name: 'pods', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await roleDialog.getByRole('checkbox', { name: 'pods', exact: true }).check();
      await roleDialog.getByRole('checkbox', { name: 'get', exact: true }).check();
      await roleDialog.getByRole('button', { name: 'Restrict to named resources', exact: true }).click();
      const resourceNames = roleDialog.getByRole('textbox', { name: 'Resource names', exact: true });
      await resourceNames.fill('pod-z');
      await resourceNames.press('Enter');
      await resourceNames.fill('pod-a');
      await resourceNames.press('Enter');
      await roleDialog.getByRole('button', { name: 'Add rules', exact: true }).click();
      await playExpect(roleDialog).not.toBeVisible();
    });

    playExpect(
      resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)),
    ).toContainEqual({ apiGroups: [''], resources: ['pods'], verbs: ['get'], resourceNames: ['pod-a', 'pod-z'] });

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Add a rule for a subresource', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });

    const roleDialog = webview.getByRole('dialog', { name: 'Add rule' });
    await recordedStep('Add a pods/log subresource rule', async () => {
      await details.getAddRuleButton(E2E_ROLE_NAME).click();
      await playExpect(roleDialog).toBeVisible();
      await roleDialog.getByRole('checkbox', { name: 'show subresources', exact: true }).check();
      await playExpect(roleDialog.getByRole('checkbox', { name: 'pods/log', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await roleDialog.getByRole('checkbox', { name: 'pods/log', exact: true }).check();
      await roleDialog.getByRole('checkbox', { name: 'get', exact: true }).check();
      await roleDialog.getByRole('button', { name: 'Add rules', exact: true }).click();
      await playExpect(roleDialog).not.toBeVisible();
    });

    playExpect(
      resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)),
    ).toContainEqual({ apiGroups: [''], resources: ['pods/log'], verbs: ['get'] });

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Add a rule for a custom resource', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });

    const roleDialog = webview.getByRole('dialog', { name: 'Add rule' });
    await recordedStep('Add a custom-resource rule', async () => {
      await details.getAddRuleButton(E2E_ROLE_NAME).click();
      await playExpect(roleDialog).toBeVisible();
      await playExpect(roleDialog.getByRole('checkbox', { name: 'widgets', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await roleDialog.getByRole('checkbox', { name: 'widgets', exact: true }).check();
      await roleDialog.getByRole('checkbox', { name: 'get', exact: true }).check();
      await roleDialog.getByRole('button', { name: 'Add rules', exact: true }).click();
      await playExpect(roleDialog).not.toBeVisible();
    });

    playExpect(
      resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)),
    ).toContainEqual({ apiGroups: ['testing.kubernetes-iam.io'], resources: ['widgets'], verbs: ['get'] });

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Add a rule to a cluster-scoped role', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });

    const clusterRoleDialog = webview.getByRole('dialog', { name: 'Add rule' });
    await recordedStep('Add a node rule to the cluster-scoped role', async () => {
      await details.getAddRuleButton(E2E_CLUSTER_ROLE_NAME).click();
      await playExpect(clusterRoleDialog).toBeVisible();
      await playExpect(clusterRoleDialog.getByRole('checkbox', { name: 'nodes', exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await clusterRoleDialog.getByRole('checkbox', { name: 'nodes', exact: true }).check();
      await clusterRoleDialog.getByRole('radio', { name: 'View', exact: true }).check();
      await clusterRoleDialog.getByRole('button', { name: 'Add rules', exact: true }).click();
      await playExpect(clusterRoleDialog).not.toBeVisible();
    });

    playExpect(resourceRules(getKubernetesResource(ENVTEST_KUBECONFIG, 'clusterrole', E2E_CLUSTER_ROLE_NAME))).toEqual([
      { apiGroups: [''], resources: ['nodes'], verbs: ['get', 'list', 'watch'] },
    ]);

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Revoke the namespaced role and keep it', async () => {
    const usersPage = new UsersPage(webview);
    const userDetails = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(userDetails.getRoleRow(E2E_ROLE_NAME)).toBeVisible({ timeout: 30_000 });

    await recordedStep('Revoke the namespaced role from e2e-user', async () => {
      await userDetails.getRevokeRoleButton(E2E_ROLE_NAME).click();
      const confirmation = mainPage.getByRole('dialog');
      await playExpect(confirmation).toBeVisible();
      await playExpect(confirmation).toContainText(`Revoke Role ${E2E_ROLE_NAME}`);
      await confirmation.getByRole('button', { name: 'Revoke', exact: true }).click();
      await playExpect(userDetails.getRoleRow(E2E_ROLE_NAME)).not.toBeVisible({ timeout: 30_000 });
    });
    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'rolebinding', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE),
    ).toBeFalsy();
    playExpect(kubernetesResourceExists(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_ROLE_NAMESPACE)).toBeTruthy();

    await userDetails.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Create a role with the same name in another namespace', async () => {
    const usersPage = new UsersPage(webview);
    const details = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(details.heading).toBeVisible({ timeout: 30_000 });
    const dialog = webview.getByRole('dialog', { name: 'Create role' });
    await recordedStep('Create the same role name in kube-system', async () => {
      await details.addRoleButton.click();
      await playExpect(dialog).toBeVisible();
      await dialog.getByRole('textbox', { name: 'Role name' }).fill(E2E_ROLE_NAME);
      await dialog.getByRole('textbox', { name: 'Namespace' }).fill(E2E_SECOND_ROLE_NAMESPACE);
      await dialog.getByRole('button', { name: 'Create', exact: true }).click();
      await playExpect(dialog).not.toBeVisible();
    });

    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'role', E2E_ROLE_NAME, E2E_SECOND_ROLE_NAMESPACE),
    ).toBeTruthy();
    playExpect(
      kubernetesResourceExists(ENVTEST_KUBECONFIG, 'rolebinding', E2E_ROLE_NAME, E2E_SECOND_ROLE_NAMESPACE),
    ).toBeTruthy();

    await details.closeButton.click();
    await playExpect(usersPage.heading).toBeVisible();
  });

  test('Revoke the cluster-scoped role and delete it', async () => {
    const usersPage = new UsersPage(webview);
    const userDetails = await usersPage.openUser(E2E_USER_NAME);
    await playExpect(userDetails.getRoleRow(E2E_CLUSTER_ROLE_NAME)).toBeVisible({ timeout: 30_000 });

    await recordedStep('Delete the cluster-scoped role', async () => {
      await userDetails.getRevokeRoleButton(E2E_CLUSTER_ROLE_NAME).click();
      const confirmation = mainPage.getByRole('dialog');
      await playExpect(confirmation).toBeVisible();
      await playExpect(confirmation).toContainText(`Revoke ClusterRole ${E2E_CLUSTER_ROLE_NAME}`);
      await confirmation.getByRole('button', { name: 'Delete', exact: true }).click();
      await playExpect(userDetails.getRoleRow(E2E_CLUSTER_ROLE_NAME)).not.toBeVisible({ timeout: 30_000 });
    });
    playExpect(kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrolebinding', E2E_CLUSTER_ROLE_NAME)).toBeFalsy();
    playExpect(kubernetesResourceExists(ENVTEST_KUBECONFIG, 'clusterrole', E2E_CLUSTER_ROLE_NAME)).toBeFalsy();
  });
});
