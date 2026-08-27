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

import { beforeEach, expect, test, vi } from 'vitest';
import { IamManager } from './iam-manager';
import { DashboardStatesManager } from './dashboard-states-manager';
import { DashboardApiManager } from './dashboard-api-manager';
import type { ExtensionContext, TelemetryLogger } from '@podman-desktop/api';
import type { RpcExtension } from '@kubernetes-iam/rpc';
import type { SubjectInfo } from '@kubernetes-iam/channels';
import type { Container } from 'inversify';
import { InversifyBinding } from '/@/inject/inversify-binding';
import type { KubernetesDashboardExtensionApi, contexts } from '@podman-desktop/kubernetes-dashboard-extension-api';
import { window } from '@podman-desktop/api';
import { parse, parseAllDocuments } from 'yaml';

let container: Container;
let manager: IamManager;

const telemetryLoggerMock: TelemetryLogger = {
  logUsage: vi.fn(),
  logError: vi.fn(),
} as unknown as TelemetryLogger;

const mockApi: KubernetesDashboardExtensionApi = {
  patchResources: vi.fn(),
  patchSubresource: vi.fn(),
  deleteResource: vi.fn(),
  getSubscriber: vi.fn(),
  contexts: { connect: vi.fn() } as unknown as typeof contexts,
};

/** The manifest handed to patchResources on the single call made so far. */
function appliedManifest(): Record<string, unknown> {
  expect(mockApi.patchResources).toHaveBeenCalledOnce();
  const [yaml] = vi.mocked(mockApi.patchResources).mock.calls[0];
  return parse(yaml) as Record<string, unknown>;
}

/** The manifests of the single, possibly multi-document, call made so far. */
function appliedManifests(): Record<string, unknown>[] {
  expect(mockApi.patchResources).toHaveBeenCalledOnce();
  const [yaml] = vi.mocked(mockApi.patchResources).mock.calls[0];
  return parseAllDocuments(yaml).map(document => document.toJS() as Record<string, unknown>);
}

const ALICE: SubjectInfo = { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' };

/** A RoleBinding granting a role holding one rule, in namespace `default`. */
function seedRoleBinding(subjects: SubjectInfo[] = [ALICE]): void {
  const statesManager = container.get(DashboardStatesManager);
  statesManager.setRoles({
    roles: [
      { namespace: 'default', name: 'pod-reader', rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }] },
    ],
  });
  statesManager.setRoleBindings({
    roleBindings: [
      {
        namespace: 'default',
        name: 'binding1',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
        subjects,
      },
    ],
  });
}

/** A ClusterRoleBinding granting a cluster role holding two rules. */
function seedClusterRoleBinding(subjects: SubjectInfo[] = [ALICE]): void {
  const statesManager = container.get(DashboardStatesManager);
  statesManager.setClusterRoles({
    clusterRoles: [
      {
        name: 'node-reader',
        rules: [
          { apiGroups: [''], resources: ['nodes'], verbs: ['get'] },
          { apiGroups: [''], resources: ['nodes'], verbs: ['list'] },
        ],
      },
    ],
  });
  statesManager.setClusterRoleBindings({
    clusterRoleBindings: [
      {
        name: 'cluster-binding1',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'node-reader' },
        subjects,
      },
    ],
  });
}

beforeEach(async () => {
  vi.resetAllMocks();

  const inversifyBinding = new InversifyBinding({} as RpcExtension, {} as ExtensionContext, telemetryLoggerMock);
  container = await inversifyBinding.initBindings();
  manager = container.get(IamManager);

  vi.spyOn(container.get(DashboardApiManager), 'getApi').mockReturnValue(mockApi);
});

test('createRole logs telemetry', async () => {
  await manager.createRole({ namespace: 'default', name: 'role1', rules: [] });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createRole');
});

test('updateRole logs telemetry', async () => {
  await manager.updateRole({ namespace: 'default', name: 'role1', rules: [] });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('updateRole');
});

test('deleteRole logs telemetry', async () => {
  await manager.deleteRole('default', 'role1');
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('deleteRole');
});

test('createRoleBinding logs telemetry', async () => {
  await manager.createRoleBinding({
    namespace: 'default',
    name: 'binding1',
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'role1' },
    subjects: [],
  });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createRoleBinding');
});

test('updateRoleBinding logs telemetry', async () => {
  await manager.updateRoleBinding({
    namespace: 'default',
    name: 'binding1',
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'role1' },
    subjects: [],
  });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('updateRoleBinding');
});

test('deleteRoleBinding logs telemetry', async () => {
  await manager.deleteRoleBinding('default', 'binding1');
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('deleteRoleBinding');
});

test('createClusterRole logs telemetry', async () => {
  await manager.createClusterRole({ name: 'cluster-role1', rules: [] });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createClusterRole');
});

test('updateClusterRole logs telemetry', async () => {
  await manager.updateClusterRole({ name: 'cluster-role1', rules: [] });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('updateClusterRole');
});

test('deleteClusterRole logs telemetry', async () => {
  await manager.deleteClusterRole('cluster-role1');
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('deleteClusterRole');
});

test('createClusterRoleBinding logs telemetry', async () => {
  await manager.createClusterRoleBinding({
    name: 'cluster-binding1',
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-role1' },
    subjects: [],
  });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createClusterRoleBinding');
});

test('updateClusterRoleBinding logs telemetry', async () => {
  await manager.updateClusterRoleBinding({
    name: 'cluster-binding1',
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-role1' },
    subjects: [],
  });
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('updateClusterRoleBinding');
});

test('deleteClusterRoleBinding logs telemetry', async () => {
  await manager.deleteClusterRoleBinding('cluster-binding1');
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('deleteClusterRoleBinding');
});

test('refreshRbacData logs telemetry', async () => {
  await manager.refreshRbacData();
  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('refreshRbacData');
});

test('createClusterRoleBinding applies the binding with server-side apply', async () => {
  await manager.createClusterRoleBinding({
    name: 'my-binding',
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'view' },
    subjects: [{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }],
  });

  expect(mockApi.patchResources).toHaveBeenCalledWith(expect.any(String), {
    strategy: 'server-side-apply',
    fieldManager: 'kubernetes-iam',
  });
  expect(appliedManifest()).toEqual({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: { name: 'my-binding' },
    roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'view' },
    subjects: [{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }],
  });
});

test('createUser binds the user to system:basic-user', async () => {
  await manager.createUser({ username: 'alice' });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createUser');
  const manifest = appliedManifest();
  expect(manifest.kind).toBe('ClusterRoleBinding');
  expect(manifest.roleRef).toEqual({
    apiGroup: 'rbac.authorization.k8s.io',
    kind: 'ClusterRole',
    name: 'system:basic-user',
  });
  expect(manifest.subjects).toEqual([{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }]);
});

test('createUser derives a valid binding name from an email-like user name', async () => {
  await manager.createUser({ username: 'alice@example.com' });

  const metadata = appliedManifest().metadata as { name: string };
  expect(metadata.name).toMatch(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/);
  expect(metadata.name).toContain('alice-example-com');
});

test('createUser trims the user name before binding it', async () => {
  await manager.createUser({ username: '  alice  ' });

  expect(appliedManifest().subjects).toEqual([{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }]);
});

test('createUser rejects an invalid user name without writing', async () => {
  await expect(manager.createUser({ username: '../bad-user' })).rejects.toThrow('Invalid user name');
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('createUser fails when the dashboard API is unavailable', async () => {
  vi.spyOn(container.get(DashboardApiManager), 'getApi').mockReturnValue(undefined);

  await expect(manager.createUser({ username: 'alice' })).rejects.toThrow('Dashboard extension API not available');
});

test('generateKubeconfig logs telemetry and delegates to KubeconfigGenerator', async () => {
  const { KubeconfigGenerator } = await import('./kubeconfig-generator');
  const kubeconfigGenerator = container.get(KubeconfigGenerator);
  const generateSpy = vi.spyOn(kubeconfigGenerator, 'generate').mockResolvedValue();

  await manager.generateKubeconfig({ username: 'alice' });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('generateKubeconfig');
  expect(generateSpy).toHaveBeenCalledWith('alice', undefined);
});

test('getUserDetails logs telemetry and returns user details with roles', async () => {
  const statesManager = container.get(DashboardStatesManager);
  statesManager.setRoleBindings({
    roleBindings: [
      {
        namespace: 'default',
        name: 'rb1',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
        subjects: [{ kind: 'User', name: 'alice' }],
      },
    ],
  });

  statesManager.setUsers({ users: [{ kind: 'User', name: 'alice' }] });

  const result = await manager.getUserDetails({ userName: 'alice' });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('getUserDetails');
  expect(result.name).toBe('alice');
  expect(result.kind).toBe('User');
  expect(result.roles).toHaveLength(1);
  expect(result.roles[0]).toEqual({
    bindingName: 'rb1',
    bindingKind: 'RoleBinding',
    roleName: 'pod-reader',
    roleKind: 'Role',
    namespace: 'default',
    rules: [],
  });
});

test('createRoleForUser applies an empty role bound to the user', async () => {
  await manager.createRoleForUser({ username: 'alice', namespace: 'default', name: 'pod-reader' });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createRoleForUser');
  expect(mockApi.patchResources).toHaveBeenCalledWith(expect.any(String), {
    strategy: 'server-side-apply',
    fieldManager: 'kubernetes-iam',
  });
  expect(appliedManifests()).toEqual([
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: { name: 'pod-reader', namespace: 'default' },
      rules: [],
    },
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'RoleBinding',
      metadata: { name: 'pod-reader', namespace: 'default' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
      subjects: [{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }],
    },
  ]);
});

test('createRoleForUser rejects a name already taken by a role in the namespace', async () => {
  container.get(DashboardStatesManager).setRoles({
    roles: [{ namespace: 'default', name: 'pod-reader', rules: [] }],
  });

  await expect(
    manager.createRoleForUser({ username: 'alice', namespace: 'default', name: 'pod-reader' }),
  ).rejects.toThrow('A role or role binding named pod-reader already exists in namespace default');
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('createRoleForUser rejects a name already taken by a role binding in the namespace', async () => {
  container.get(DashboardStatesManager).setRoleBindings({
    roleBindings: [
      {
        namespace: 'default',
        name: 'pod-reader',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'other' },
        subjects: [],
      },
    ],
  });

  await expect(
    manager.createRoleForUser({ username: 'alice', namespace: 'default', name: 'pod-reader' }),
  ).rejects.toThrow('already exists in namespace default');
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('createRoleForUser accepts a name taken in another namespace', async () => {
  container.get(DashboardStatesManager).setRoles({
    roles: [{ namespace: 'other', name: 'pod-reader', rules: [] }],
  });

  await manager.createRoleForUser({ username: 'alice', namespace: 'default', name: 'pod-reader' });

  expect(mockApi.patchResources).toHaveBeenCalledOnce();
});

test.each([
  {
    field: 'name',
    request: { username: 'alice', namespace: 'default', name: 'Pod Reader' },
    error: 'Invalid role name',
  },
  {
    field: 'namespace',
    request: { username: 'alice', namespace: 'Not A NS', name: 'pod-reader' },
    error: 'Invalid namespace',
  },
  {
    field: 'user name',
    request: { username: '../bad', namespace: 'default', name: 'pod-reader' },
    error: 'Invalid user name',
  },
])('createRoleForUser rejects an invalid $field without writing', async ({ request, error }) => {
  await expect(manager.createRoleForUser(request)).rejects.toThrow(error);
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('createClusterRoleForUser applies an empty cluster role bound to the user', async () => {
  await manager.createClusterRoleForUser({ username: 'alice', name: 'node-reader' });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('createClusterRoleForUser');
  expect(appliedManifests()).toEqual([
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: { name: 'node-reader' },
      rules: [],
    },
    {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: { name: 'node-reader' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'node-reader' },
      subjects: [{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }],
    },
  ]);
});

test('createClusterRoleForUser rejects a name already taken by a cluster role', async () => {
  container.get(DashboardStatesManager).setClusterRoles({
    clusterRoles: [{ name: 'node-reader', rules: [] }],
  });

  await expect(manager.createClusterRoleForUser({ username: 'alice', name: 'node-reader' })).rejects.toThrow(
    'A cluster role or cluster role binding named node-reader already exists',
  );
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('createClusterRoleForUser rejects a name already taken by a cluster role binding', async () => {
  container.get(DashboardStatesManager).setClusterRoleBindings({
    clusterRoleBindings: [
      {
        name: 'node-reader',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'other' },
        subjects: [],
      },
    ],
  });

  await expect(manager.createClusterRoleForUser({ username: 'alice', name: 'node-reader' })).rejects.toThrow(
    'already exists',
  );
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('createClusterRoleForUser trims the names before applying them', async () => {
  await manager.createClusterRoleForUser({ username: '  alice  ', name: '  node-reader  ' });

  const [clusterRole, binding] = appliedManifests();
  expect(clusterRole.metadata).toEqual({ name: 'node-reader' });
  expect(binding.subjects).toEqual([{ apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'alice' }]);
});

test('addRuleToRole appends the rule to the rules the role already holds', async () => {
  container.get(DashboardStatesManager).setRoles({
    roles: [
      {
        namespace: 'default',
        name: 'pod-reader',
        rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
      },
    ],
  });

  await manager.addRuleToRole({
    namespace: 'default',
    name: 'pod-reader',
    rule: { apiGroups: ['apps'], resources: ['deployments'], verbs: ['list', 'watch'] },
  });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('addRuleToRole');
  expect(appliedManifest()).toEqual({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: { name: 'pod-reader', namespace: 'default' },
    rules: [
      { apiGroups: [''], resources: ['pods'], verbs: ['get'] },
      { apiGroups: ['apps'], resources: ['deployments'], verbs: ['list', 'watch'] },
    ],
  });
});

test('addRuleToRole keeps the resource names of the rule', async () => {
  container.get(DashboardStatesManager).setRoles({ roles: [{ namespace: 'default', name: 'pod-reader', rules: [] }] });

  await manager.addRuleToRole({
    namespace: 'default',
    name: 'pod-reader',
    rule: { apiGroups: [''], resources: ['pods'], verbs: ['get'], resourceNames: ['my-pod'] },
  });

  expect(appliedManifest().rules).toEqual([
    { apiGroups: [''], resources: ['pods'], verbs: ['get'], resourceNames: ['my-pod'] },
  ]);
});

test('addRuleToRole drops the blanks of the rule, but keeps the core API group', async () => {
  container.get(DashboardStatesManager).setRoles({ roles: [{ namespace: 'default', name: 'pod-reader', rules: [] }] });

  await manager.addRuleToRole({
    namespace: 'default',
    name: 'pod-reader',
    rule: { apiGroups: [''], resources: [' pods ', ''], verbs: ['get', '  '], resourceNames: [''] },
  });

  expect(appliedManifest().rules).toEqual([{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }]);
});

test('addRuleToRole defaults an empty list of API groups to the core group', async () => {
  container.get(DashboardStatesManager).setRoles({ roles: [{ namespace: 'default', name: 'pod-reader', rules: [] }] });

  await manager.addRuleToRole({
    namespace: 'default',
    name: 'pod-reader',
    rule: { apiGroups: [], resources: ['pods'], verbs: ['get'] },
  });

  expect(appliedManifest().rules).toEqual([{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }]);
});

test.each([
  { field: 'resource', rule: { apiGroups: [''], resources: [], verbs: ['get'] }, error: 'at least one resource' },
  { field: 'verb', rule: { apiGroups: [''], resources: ['pods'], verbs: [] }, error: 'at least one verb' },
])('addRuleToRole rejects a rule without any $field', async ({ rule, error }) => {
  container.get(DashboardStatesManager).setRoles({ roles: [{ namespace: 'default', name: 'pod-reader', rules: [] }] });

  await expect(manager.addRuleToRole({ namespace: 'default', name: 'pod-reader', rule })).rejects.toThrow(error);
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('addRuleToRole rejects a role it does not know about', async () => {
  await expect(
    manager.addRuleToRole({
      namespace: 'default',
      name: 'pod-reader',
      rule: { apiGroups: [''], resources: ['pods'], verbs: ['get'] },
    }),
  ).rejects.toThrow('No role named pod-reader in namespace default');
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('addRuleToRole ignores a role of the same name in another namespace', async () => {
  container.get(DashboardStatesManager).setRoles({ roles: [{ namespace: 'other', name: 'pod-reader', rules: [] }] });

  await expect(
    manager.addRuleToRole({
      namespace: 'default',
      name: 'pod-reader',
      rule: { apiGroups: [''], resources: ['pods'], verbs: ['get'] },
    }),
  ).rejects.toThrow('No role named pod-reader in namespace default');
});

test('addRuleToClusterRole appends the rule to the rules the cluster role already holds', async () => {
  container.get(DashboardStatesManager).setClusterRoles({
    clusterRoles: [{ name: 'node-reader', rules: [{ apiGroups: [''], resources: ['nodes'], verbs: ['get'] }] }],
  });

  await manager.addRuleToClusterRole({
    name: 'node-reader',
    rule: { apiGroups: [''], resources: ['nodes'], verbs: ['list'] },
  });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('addRuleToClusterRole');
  expect(appliedManifest()).toEqual({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: { name: 'node-reader' },
    rules: [
      { apiGroups: [''], resources: ['nodes'], verbs: ['get'] },
      { apiGroups: [''], resources: ['nodes'], verbs: ['list'] },
    ],
  });
});

test('addRuleToClusterRole rejects a cluster role it does not know about', async () => {
  await expect(
    manager.addRuleToClusterRole({
      name: 'node-reader',
      rule: { apiGroups: [''], resources: ['nodes'], verbs: ['get'] },
    }),
  ).rejects.toThrow('No cluster role named node-reader');
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});
const BOB: SubjectInfo = { apiGroup: 'rbac.authorization.k8s.io', kind: 'User', name: 'bob' };
const DEVS: SubjectInfo = { apiGroup: 'rbac.authorization.k8s.io', kind: 'Group', name: 'devs' };
const CI: SubjectInfo = { kind: 'ServiceAccount', name: 'ci', namespace: 'build' };

/** The single confirmation message shown so far. */
function confirmationMessage(): string {
  expect(window.showWarningMessage).toHaveBeenCalledOnce();
  return vi.mocked(window.showWarningMessage).mock.calls[0][0];
}

test('revokeRoleFromUser deletes the binding when the user is its only subject', async () => {
  seedRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(telemetryLoggerMock.logUsage).toHaveBeenCalledWith('revokeRoleFromUser');
  expect(mockApi.deleteResource).toHaveBeenCalledExactlyOnceWith('RoleBinding', 'binding1', 'default');
  expect(mockApi.patchResources).not.toHaveBeenCalled();
});

test('revokeRoleFromUser deletes a cluster role binding whose only subject is the user', async () => {
  seedClusterRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'ClusterRoleBinding',
    bindingName: 'cluster-binding1',
  });

  expect(mockApi.deleteResource).toHaveBeenCalledExactlyOnceWith('ClusterRoleBinding', 'cluster-binding1', undefined);
});

test('revokeRoleFromUser only drops the subject of the user when the binding has others', async () => {
  seedRoleBinding([ALICE, BOB, DEVS]);
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(mockApi.deleteResource).not.toHaveBeenCalled();
  expect(appliedManifest()).toEqual({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: { name: 'binding1', namespace: 'default' },
    subjects: [BOB, DEVS],
  });
});

test('revokeRoleFromUser keeps a cluster role binding carrying other subjects', async () => {
  seedClusterRoleBinding([ALICE, BOB]);
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'ClusterRoleBinding',
    bindingName: 'cluster-binding1',
  });

  expect(mockApi.deleteResource).not.toHaveBeenCalled();
  expect(appliedManifest()).toEqual({
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: { name: 'cluster-binding1' },
    subjects: [BOB],
  });
});

test('revokeRoleFromUser names the role and its number of rules in the confirmation', async () => {
  seedRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).toContain('Revoke Role pod-reader');
  expect(confirmationMessage()).toContain('1 rule');
});

test('revokeRoleFromUser names the cluster role and its number of rules in the confirmation', async () => {
  seedClusterRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'ClusterRoleBinding',
    bindingName: 'cluster-binding1',
  });

  expect(confirmationMessage()).toContain('Revoke ClusterRole node-reader');
  expect(confirmationMessage()).toContain('2 rules');
});

test('revokeRoleFromUser tells which subjects keep the role, qualifying groups and service accounts', async () => {
  seedRoleBinding([ALICE, BOB, DEVS, CI]);
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).toContain(
    'RoleBinding binding1 still grants it to bob, the group devs and the service account build/ci.',
  );
});

test('revokeRoleFromUser says nothing about other subjects when the binding only holds the user', async () => {
  seedRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).not.toContain('still grants it to');
});

test.each([{ answer: 'Cancel' }, { answer: undefined }])(
  'revokeRoleFromUser changes nothing when the confirmation answers $answer',
  async ({ answer }) => {
    seedRoleBinding([ALICE, BOB]);
    vi.mocked(window.showWarningMessage).mockResolvedValue(answer);

    await manager.revokeRoleFromUser({
      username: 'alice',
      bindingKind: 'RoleBinding',
      bindingName: 'binding1',
      namespace: 'default',
    });

    expect(mockApi.deleteResource).not.toHaveBeenCalled();
    expect(mockApi.patchResources).not.toHaveBeenCalled();
  },
);

test('revokeRoleFromUser confirms even when the role the binding grants is unknown to the cluster', async () => {
  container.get(DashboardStatesManager).setRoleBindings({
    roleBindings: [
      {
        namespace: 'default',
        name: 'binding1',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'gone' },
        subjects: [ALICE],
      },
    ],
  });
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).toContain('(rule count unknown)');
  expect(mockApi.deleteResource).toHaveBeenCalledExactlyOnceWith('RoleBinding', 'binding1', 'default');
});

test('revokeRoleFromUser rejects a binding it does not know about', async () => {
  await expect(
    manager.revokeRoleFromUser({
      username: 'alice',
      bindingKind: 'RoleBinding',
      bindingName: 'binding1',
      namespace: 'default',
    }),
  ).rejects.toThrow('No RoleBinding named binding1 in namespace default');
  expect(window.showWarningMessage).not.toHaveBeenCalled();
});

test('revokeRoleFromUser rejects a binding that does not grant its role to the user', async () => {
  seedRoleBinding([BOB]);

  await expect(
    manager.revokeRoleFromUser({
      username: 'alice',
      bindingKind: 'RoleBinding',
      bindingName: 'binding1',
      namespace: 'default',
    }),
  ).rejects.toThrow('The binding binding1 does not grant its role to alice');
  expect(window.showWarningMessage).not.toHaveBeenCalled();
  expect(mockApi.deleteResource).not.toHaveBeenCalled();
});

test('revokeRoleFromUser keeps a group of the same name as the user', async () => {
  seedRoleBinding([ALICE, { apiGroup: 'rbac.authorization.k8s.io', kind: 'Group', name: 'alice' }]);
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(appliedManifest().subjects).toEqual([{ apiGroup: 'rbac.authorization.k8s.io', kind: 'Group', name: 'alice' }]);
});

test('revokeRoleFromUser patches the subjects instead of applying them', async () => {
  // A server-side apply would claim the whole subjects list, which the API server refuses
  // while another field manager holds it, as it does for a binding written with kubectl.
  seedRoleBinding([ALICE, BOB]);
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(mockApi.patchResources).toHaveBeenCalledOnce();
  expect(vi.mocked(mockApi.patchResources).mock.calls[0][1]).toEqual({
    strategy: 'merge-patch',
    fieldManager: 'kubernetes-iam',
  });
});

test('revokeRoleFromUser offers to delete the role no other binding grants', async () => {
  seedRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).toContain('nothing else grants the Role');
  expect(vi.mocked(window.showWarningMessage).mock.calls[0].slice(1)).toEqual(['Cancel', 'Revoke', 'Delete']);
});

test('revokeRoleFromUser deletes the role along with the binding on Delete', async () => {
  seedRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Delete');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(mockApi.deleteResource).toHaveBeenNthCalledWith(1, 'RoleBinding', 'binding1', 'default');
  expect(mockApi.deleteResource).toHaveBeenNthCalledWith(2, 'Role', 'pod-reader', 'default');
});

test('revokeRoleFromUser deletes a cluster role without a namespace on Delete', async () => {
  seedClusterRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Delete');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'ClusterRoleBinding',
    bindingName: 'cluster-binding1',
  });

  expect(mockApi.deleteResource).toHaveBeenNthCalledWith(1, 'ClusterRoleBinding', 'cluster-binding1', undefined);
  expect(mockApi.deleteResource).toHaveBeenNthCalledWith(2, 'ClusterRole', 'node-reader', undefined);
});

test('revokeRoleFromUser leaves the role in place on Revoke', async () => {
  seedRoleBinding();
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(mockApi.deleteResource).toHaveBeenCalledExactlyOnceWith('RoleBinding', 'binding1', 'default');
});

test('revokeRoleFromUser does not offer to delete a role another binding still grants', async () => {
  seedRoleBinding();
  const statesManager = container.get(DashboardStatesManager);
  statesManager.setRoleBindings({
    roleBindings: [
      ...statesManager.getRoleBindings().roleBindings,
      {
        namespace: 'default',
        name: 'binding2',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
        subjects: [BOB],
      },
    ],
  });
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).toContain('The Role itself is not modified, and other bindings still grant it.');
  expect(vi.mocked(window.showWarningMessage).mock.calls[0].slice(1)).toEqual(['Cancel', 'Revoke']);
});

test('revokeRoleFromUser ignores a binding of another namespace when looking for other grants', async () => {
  seedRoleBinding();
  const statesManager = container.get(DashboardStatesManager);
  statesManager.setRoleBindings({
    roleBindings: [
      ...statesManager.getRoleBindings().roleBindings,
      {
        namespace: 'other',
        name: 'binding2',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
        subjects: [BOB],
      },
    ],
  });
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(confirmationMessage()).toContain('nothing else grants the Role');
});

test('revokeRoleFromUser counts a namespaced binding as a grant of a cluster role', async () => {
  seedClusterRoleBinding();
  container.get(DashboardStatesManager).setRoleBindings({
    roleBindings: [
      {
        namespace: 'default',
        name: 'binding2',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'node-reader' },
        subjects: [BOB],
      },
    ],
  });
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'ClusterRoleBinding',
    bindingName: 'cluster-binding1',
  });

  expect(vi.mocked(window.showWarningMessage).mock.calls[0].slice(1)).toEqual(['Cancel', 'Revoke']);
});

test('revokeRoleFromUser never offers to delete a built-in role', async () => {
  container.get(DashboardStatesManager).setClusterRoleBindings({
    clusterRoleBindings: [
      {
        name: 'alice-basic-user',
        roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'system:basic-user' },
        subjects: [ALICE],
      },
    ],
  });
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'ClusterRoleBinding',
    bindingName: 'alice-basic-user',
  });

  expect(vi.mocked(window.showWarningMessage).mock.calls[0].slice(1)).toEqual(['Cancel', 'Revoke']);
});

test('revokeRoleFromUser does not offer to delete a role the binding keeps granting', async () => {
  seedRoleBinding([ALICE, BOB]);
  vi.mocked(window.showWarningMessage).mockResolvedValue('Revoke');

  await manager.revokeRoleFromUser({
    username: 'alice',
    bindingKind: 'RoleBinding',
    bindingName: 'binding1',
    namespace: 'default',
  });

  expect(vi.mocked(window.showWarningMessage).mock.calls[0].slice(1)).toEqual(['Cancel', 'Revoke']);
  expect(mockApi.deleteResource).not.toHaveBeenCalled();
});
