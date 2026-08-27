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
import type { Container } from 'inversify';
import { InversifyBinding } from '/@/inject/inversify-binding';
import type { KubernetesDashboardExtensionApi, contexts } from '@podman-desktop/kubernetes-dashboard-extension-api';
import { parse } from 'yaml';

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
