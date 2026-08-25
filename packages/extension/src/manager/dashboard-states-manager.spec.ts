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

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
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
import type { RolesData, RoleBindingsData, ClusterRolesData, ClusterRoleBindingsData } from '@kubernetes-iam/channels';

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
});

describe('dashboard extension is installed', () => {
  let manager: DashboardStatesManager;
  const onDidChangeDisposable: () => void = vi.fn();
  const subscriber: () => KubernetesDashboardSubscriber = vi.fn();
  const disposeSubscriber: () => void = vi.fn();

  beforeEach(() => {
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
    } as unknown as KubernetesDashboardSubscriber);
    vi.mocked(dashboardApiManagerMock.getApi).mockReturnValue({
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

  test('onDidChangeDisposable is called', () => {
    manager = container.get(DashboardStatesManager);
    manager.init();
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
});
