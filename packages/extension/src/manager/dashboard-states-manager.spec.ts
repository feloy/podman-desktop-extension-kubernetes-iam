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

import { afterEach, assert, beforeEach, describe, expect, test, vi } from 'vitest';
import { DashboardStatesManager } from './dashboard-states-manager';
import type { Disposable, ExtensionContext, TelemetryLogger } from '@podman-desktop/api';
import { extensions } from '@podman-desktop/api';
import type {
  KubernetesDashboardExtensionApi,
  KubernetesDashboardSubscriber,
} from '@podman-desktop/kubernetes-dashboard-extension-api';
import { InversifyBinding } from '/@/inject/inversify-binding';
import type { RpcExtension } from '@kubernetes-iam/rpc';
import type { Container } from 'inversify';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';
import type {
  RolesData,
  RoleBindingsData,
  ClusterRolesData,
  ClusterRoleBindingsData,
  UsersData,
} from '@kubernetes-iam/channels';

let container: Container;

const dashboardApiManagerMock: DashboardApiManager = {
  getApi: vi.fn(),
} as unknown as DashboardApiManager;

beforeEach(async () => {
  vi.resetAllMocks();

  const inversifyBinding = new InversifyBinding({} as RpcExtension, {} as ExtensionContext, {} as TelemetryLogger);
  container = await inversifyBinding.initBindings();
  (await container.rebindAsync(DashboardApiManager)).toConstantValue(dashboardApiManagerMock);
});

describe('dashboard extension is not installed', () => {
  let manager: DashboardStatesManager;
  const onDidChangeDisposable: () => void = vi.fn();

  beforeEach(() => {
    vi.mocked(extensions.onDidChange).mockReturnValue({
      dispose: onDidChangeDisposable,
    } as unknown as Disposable);
    vi.mocked(dashboardApiManagerMock.getApi).mockReturnValue(undefined);
  });

  afterEach(() => {
    manager?.dispose();
  });

  test('subscriber is undefined', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    expect(manager.getSubscriber()).toBeUndefined();
  });

  test('onDidChangeDisposable is called', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    manager.dispose();
    expect(onDidChangeDisposable).toHaveBeenCalled();
  });

  test('registers onDidChange listener when API not available', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    expect(extensions.onDidChange).toHaveBeenCalled();
  });
});

describe('dashboard extension is installed after init (onDidChange)', () => {
  let manager: DashboardStatesManager;
  const onDidChangeDisposable: () => void = vi.fn();
  const subscriber: () => KubernetesDashboardSubscriber = vi.fn();
  const disposeSubscriber: () => void = vi.fn();
  let onResourceUpdateMock: ReturnType<typeof vi.fn>;
  let onContextsHealthMock: ReturnType<typeof vi.fn>;
  let fireContextsHealth: () => void;

  beforeEach(() => {
    onResourceUpdateMock = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onContextsHealthMock = vi.fn().mockImplementation((listener: () => void) => {
      fireContextsHealth = listener;
      return { dispose: vi.fn() };
    });
    vi.mocked(extensions.onDidChange).mockImplementation(f => {
      setTimeout(() => {
        f();
      }, 0);
      return {
        dispose: onDidChangeDisposable,
      } as unknown as Disposable;
    });
    vi.mocked(subscriber).mockReturnValue({
      dispose: disposeSubscriber,
      onResourceUpdate: onResourceUpdateMock,
      onContextsHealth: onContextsHealthMock,
    } as unknown as KubernetesDashboardSubscriber);
    vi.mocked(dashboardApiManagerMock.getApi)
      .mockReturnValueOnce(undefined)
      .mockReturnValue({
        getSubscriber: subscriber,
      } as unknown as KubernetesDashboardExtensionApi);
  });

  afterEach(() => {
    manager?.dispose();
  });

  test('subscriber is eventually defined', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
  });

  test('onDidChangeDisposable is called on dispose', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    manager.dispose();
    expect(onDidChangeDisposable).toHaveBeenCalled();
  });

  test('subscriber is disposed on dispose', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    manager.dispose();
    expect(disposeSubscriber).toHaveBeenCalled();
  });

  test('does not subscribe to onResourceUpdate before onContextsHealth fires', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    expect(onContextsHealthMock).toHaveBeenCalled();
    expect(onResourceUpdateMock).not.toHaveBeenCalled();
  });

  test('subscribes to four resource types after onContextsHealth fires', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    fireContextsHealth();
    expect(onResourceUpdateMock).toHaveBeenCalledTimes(4);
    const resourceNames = onResourceUpdateMock.mock.calls.map(
      (call: unknown[]) => (call[0] as { resourceName: string }).resourceName,
    );
    expect(resourceNames).toContain('roles');
    expect(resourceNames).toContain('clusterroles');
    expect(resourceNames).toContain('rolebindings');
    expect(resourceNames).toContain('clusterrolebindings');
  });

  test('subscribes to onResourceUpdate only once even if onContextsHealth fires multiple times', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    fireContextsHealth();
    fireContextsHealth();
    fireContextsHealth();
    expect(onResourceUpdateMock).toHaveBeenCalledTimes(4);
  });

  test('onResourceUpdate for rolebindings transforms and triggers recomputeUsers', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    fireContextsHealth();

    const rolebindingsCall = onResourceUpdateMock.mock.calls.find(
      (call: unknown[]) => (call[0] as { resourceName: string }).resourceName === 'rolebindings',
    );
    assert(rolebindingsCall);
    const listener = rolebindingsCall[1] as (event: {
      resources: { contextName?: string; resourceName: string; items: readonly Record<string, unknown>[] }[];
    }) => void;

    listener({
      resources: [
        {
          contextName: 'ctx1',
          resourceName: 'rolebindings',
          items: [
            {
              kind: 'RoleBinding',
              metadata: { name: 'rb1', namespace: 'default' },
              roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'role1' },
              subjects: [{ kind: 'User', name: 'alice', apiGroup: 'rbac.authorization.k8s.io' }],
            },
          ],
        },
      ],
    });

    expect(manager.getRoleBindings().roleBindings).toHaveLength(1);
    expect(manager.getRoleBindings().roleBindings[0]?.name).toBe('rb1');
    expect(manager.getUsers().users).toHaveLength(1);
    expect(manager.getUsers().users[0]?.name).toBe('alice');
  });

  test('onResourceUpdate for roles transforms items correctly', async () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    await vi.waitFor(() => {
      expect(manager.getSubscriber()).toBeDefined();
    });
    fireContextsHealth();

    const rolesCall = onResourceUpdateMock.mock.calls.find(
      (call: unknown[]) => (call[0] as { resourceName: string }).resourceName === 'roles',
    );
    assert(rolesCall);
    const listener = rolesCall[1] as (event: {
      resources: { contextName?: string; resourceName: string; items: readonly Record<string, unknown>[] }[];
    }) => void;

    listener({
      resources: [
        {
          contextName: 'ctx1',
          resourceName: 'roles',
          items: [
            {
              metadata: { name: 'pod-reader', namespace: 'default' },
              rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
            },
          ],
        },
      ],
    });

    expect(manager.getRoles().roles).toHaveLength(1);
    expect(manager.getRoles().roles[0]?.name).toBe('pod-reader');
  });
});

describe('dashboard extension is already installed at init time', () => {
  let manager: DashboardStatesManager;
  const onDidChangeDisposable: () => void = vi.fn();
  const subscriber: () => KubernetesDashboardSubscriber = vi.fn();
  const disposeSubscriber: () => void = vi.fn();
  let onResourceUpdateMock: ReturnType<typeof vi.fn>;
  let onContextsHealthMock: ReturnType<typeof vi.fn>;
  let fireContextsHealth: () => void;

  beforeEach(() => {
    onResourceUpdateMock = vi.fn().mockReturnValue({ dispose: vi.fn() });
    onContextsHealthMock = vi.fn().mockImplementation((listener: () => void) => {
      fireContextsHealth = listener;
      return { dispose: vi.fn() };
    });
    vi.mocked(extensions.onDidChange).mockReturnValue({
      dispose: onDidChangeDisposable,
    } as unknown as Disposable);
    vi.mocked(subscriber).mockReturnValue({
      dispose: disposeSubscriber,
      onResourceUpdate: onResourceUpdateMock,
      onContextsHealth: onContextsHealthMock,
    } as unknown as KubernetesDashboardSubscriber);
    vi.mocked(dashboardApiManagerMock.getApi).mockReturnValue({
      getSubscriber: subscriber,
    } as unknown as KubernetesDashboardExtensionApi);
  });

  afterEach(() => {
    manager?.dispose();
  });

  test('subscriber is defined immediately', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    expect(manager.getSubscriber()).toBeDefined();
  });

  test('disposes onDidChange listener immediately since API is already available', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    expect(extensions.onDidChange).toHaveBeenCalled();
    expect(onDidChangeDisposable).toHaveBeenCalled();
  });

  test('subscribes to four resource types after onContextsHealth fires', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    expect(onResourceUpdateMock).not.toHaveBeenCalled();
    fireContextsHealth();
    expect(onResourceUpdateMock).toHaveBeenCalledTimes(4);
    const resourceNames = onResourceUpdateMock.mock.calls.map(
      (call: unknown[]) => (call[0] as { resourceName: string }).resourceName,
    );
    expect(resourceNames).toContain('roles');
    expect(resourceNames).toContain('clusterroles');
    expect(resourceNames).toContain('rolebindings');
    expect(resourceNames).toContain('clusterrolebindings');
  });

  test('subscriber is disposed on dispose', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
    manager.dispose();
    expect(disposeSubscriber).toHaveBeenCalled();
  });
});

describe('getUserRoles', () => {
  let manager: DashboardStatesManager;

  beforeEach(() => {
    vi.mocked(extensions.onDidChange).mockReturnValue({
      dispose: vi.fn(),
    } as unknown as Disposable);
    manager = container.get(DashboardStatesManager);
  });

  afterEach(() => {
    manager?.dispose();
  });

  test('returns roles from role bindings where user is a subject', () => {
    manager.setRoleBindings({
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'default',
          name: 'rb1',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
          subjects: [{ kind: 'User', name: 'alice' }],
        },
      ],
    });
    const roles = manager.getUserRoles('ctx1', 'alice');
    expect(roles).toHaveLength(1);
    expect(roles[0]).toEqual({
      bindingName: 'rb1',
      bindingKind: 'RoleBinding',
      roleName: 'pod-reader',
      roleKind: 'Role',
      namespace: 'default',
    });
  });

  test('returns roles from cluster role bindings where user is a subject', () => {
    manager.setClusterRoleBindings({
      clusterRoleBindings: [
        {
          contextName: 'ctx1',
          name: 'crb1',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' },
          subjects: [{ kind: 'User', name: 'alice' }],
        },
      ],
    });
    const roles = manager.getUserRoles('ctx1', 'alice');
    expect(roles).toHaveLength(1);
    expect(roles[0]).toEqual({
      bindingName: 'crb1',
      bindingKind: 'ClusterRoleBinding',
      roleName: 'cluster-admin',
      roleKind: 'ClusterRole',
    });
  });

  test('excludes bindings where user is not a subject', () => {
    manager.setRoleBindings({
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'default',
          name: 'rb1',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
          subjects: [{ kind: 'User', name: 'bob' }],
        },
      ],
    });
    const roles = manager.getUserRoles('ctx1', 'alice');
    expect(roles).toHaveLength(0);
  });

  test('filters by context name', () => {
    manager.setRoleBindings({
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'default',
          name: 'rb1',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
          subjects: [{ kind: 'User', name: 'alice' }],
        },
        {
          contextName: 'ctx2',
          namespace: 'default',
          name: 'rb2',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'admin' },
          subjects: [{ kind: 'User', name: 'alice' }],
        },
      ],
    });
    const roles = manager.getUserRoles('ctx1', 'alice');
    expect(roles).toHaveLength(1);
    expect(roles[0]?.roleName).toBe('pod-reader');
  });

  test('returns empty array when no bindings match', () => {
    const roles = manager.getUserRoles('ctx1', 'alice');
    expect(roles).toHaveLength(0);
  });

  test('returns roles from both role bindings and cluster role bindings', () => {
    manager.setRoleBindings({
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'default',
          name: 'rb1',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
          subjects: [{ kind: 'User', name: 'alice' }],
        },
      ],
    });
    manager.setClusterRoleBindings({
      clusterRoleBindings: [
        {
          contextName: 'ctx1',
          name: 'crb1',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' },
          subjects: [{ kind: 'User', name: 'alice' }],
        },
      ],
    });
    const roles = manager.getUserRoles('ctx1', 'alice');
    expect(roles).toHaveLength(2);
  });
});

describe('RBAC data setters and getters', () => {
  let manager: DashboardStatesManager;

  beforeEach(() => {
    vi.mocked(extensions.onDidChange).mockReturnValue({
      dispose: vi.fn(),
    } as unknown as Disposable);
    manager = container.get(DashboardStatesManager);
  });

  afterEach(() => {
    manager?.dispose();
  });

  test('getRoles returns default empty data', () => {
    expect(manager.getRoles()).toEqual({ roles: [] });
  });

  test('setRoles updates data and fires onRolesChange', () => {
    const callback = vi.fn();
    manager.onRolesChange(callback);
    const newRoles: RolesData = {
      roles: [{ contextName: 'ctx1', namespace: 'default', name: 'my-role', rules: [] }],
    };
    manager.setRoles(newRoles);
    expect(manager.getRoles()).toEqual(newRoles);
    expect(callback).toHaveBeenCalled();
  });

  test('getRoleBindings returns default empty data', () => {
    expect(manager.getRoleBindings()).toEqual({ roleBindings: [] });
  });

  test('setRoleBindings updates data and fires onRoleBindingsChange', () => {
    const callback = vi.fn();
    manager.onRoleBindingsChange(callback);
    const newRoleBindings: RoleBindingsData = {
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'default',
          name: 'my-binding',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'my-role' },
          subjects: [],
        },
      ],
    };
    manager.setRoleBindings(newRoleBindings);
    expect(manager.getRoleBindings()).toEqual(newRoleBindings);
    expect(callback).toHaveBeenCalled();
  });

  test('getClusterRoles returns default empty data', () => {
    expect(manager.getClusterRoles()).toEqual({ clusterRoles: [] });
  });

  test('setClusterRoles updates data and fires onClusterRolesChange', () => {
    const callback = vi.fn();
    manager.onClusterRolesChange(callback);
    const newClusterRoles: ClusterRolesData = {
      clusterRoles: [{ contextName: 'ctx1', name: 'my-cluster-role', rules: [] }],
    };
    manager.setClusterRoles(newClusterRoles);
    expect(manager.getClusterRoles()).toEqual(newClusterRoles);
    expect(callback).toHaveBeenCalled();
  });

  test('getClusterRoleBindings returns default empty data', () => {
    expect(manager.getClusterRoleBindings()).toEqual({ clusterRoleBindings: [] });
  });

  test('setClusterRoleBindings updates data and fires onClusterRoleBindingsChange', () => {
    const callback = vi.fn();
    manager.onClusterRoleBindingsChange(callback);
    const newClusterRoleBindings: ClusterRoleBindingsData = {
      clusterRoleBindings: [
        {
          contextName: 'ctx1',
          name: 'my-cluster-binding',
          roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'my-cluster-role' },
          subjects: [],
        },
      ],
    };
    manager.setClusterRoleBindings(newClusterRoleBindings);
    expect(manager.getClusterRoleBindings()).toEqual(newClusterRoleBindings);
    expect(callback).toHaveBeenCalled();
  });

  test('getUsers returns default empty data', () => {
    expect(manager.getUsers()).toEqual({ users: [] });
  });

  test('setUsers updates data and fires onUsersChange', () => {
    const callback = vi.fn();
    manager.onUsersChange(callback);
    const newUsers: UsersData = {
      users: [{ contextName: 'ctx1', kind: 'User', name: 'alice' }],
    };
    manager.setUsers(newUsers);
    expect(manager.getUsers()).toEqual(newUsers);
    expect(callback).toHaveBeenCalled();
  });
});
