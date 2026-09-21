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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ApiResourcesManager } from './api-resources-manager';
import { DashboardApiManager } from './dashboard-api-manager';
import { DashboardStatesManager } from './dashboard-states-manager';
import type { ExtensionContext, TelemetryLogger } from '@podman-desktop/api';
import type { RpcExtension } from '@kubernetes-iam/rpc';
import type { Container } from 'inversify';
import { InversifyBinding } from '/@/inject/inversify-binding';
import type {
  ApiGroupList,
  ApiResource,
  ApiResourceError,
  ApiResourceList,
  ContextsHealthsInfo,
  KubernetesDashboardExtensionApi,
  contexts,
} from '@podman-desktop/kubernetes-dashboard-extension-api';
import { Emitter } from '/@/types/emitter';

let container: Container;
let manager: ApiResourcesManager;

const dashboardApiManagerMock: DashboardApiManager = {
  getApi: vi.fn(),
} as unknown as DashboardApiManager;

const onHealthChange = new Emitter<ContextsHealthsInfo>();
const dashboardStatesManagerMock: DashboardStatesManager = {
  onContextsHealthChange: onHealthChange.event,
} as unknown as DashboardStatesManager;

const mockApi: KubernetesDashboardExtensionApi = {
  patchResources: vi.fn(),
  patchSubresource: vi.fn(),
  deleteResource: vi.fn(),
  getSubscriber: vi.fn(),
  getApiVersions: vi.fn(),
  getApiResources: vi.fn(),
  contexts: { connect: vi.fn() } as unknown as typeof contexts,
};

function apiResource(name: string, kind: string, namespaced = true): ApiResource {
  return { name, singularName: name, namespaced, kind, verbs: ['get', 'list'] };
}

function resourceList(groupVersion: string, resources: ApiResource[]): ApiResourceList {
  return { groupVersion, resources };
}

function apiResourceError(statusCode: number, retryAfter?: string): ApiResourceError {
  const error = new Error(`status ${statusCode}`) as ApiResourceError;
  error.name = 'ApiResourceError';
  Object.assign(error, { statusCode, retryAfter });
  return error;
}

function healths(...reachable: string[]): ContextsHealthsInfo {
  return {
    healths: reachable.map(contextName => ({
      contextName,
      checking: false,
      reachable: true,
      offline: false,
    })),
  };
}

beforeEach(async () => {
  vi.resetAllMocks();
  vi.mocked(dashboardApiManagerMock.getApi).mockReturnValue(mockApi);
  vi.mocked(mockApi.getApiVersions).mockResolvedValue({ groups: [] });
  vi.mocked(mockApi.getApiResources).mockResolvedValue(resourceList('v1', []));

  const inversifyBinding = new InversifyBinding({} as RpcExtension, {} as ExtensionContext, {} as TelemetryLogger);
  container = await inversifyBinding.initBindings();
  (await container.rebindAsync(DashboardApiManager)).toConstantValue(dashboardApiManagerMock);
  (await container.rebindAsync(DashboardStatesManager)).toConstantValue(dashboardStatesManagerMock);
  manager = container.get(ApiResourcesManager);
});

afterEach(() => {
  manager.dispose();
  vi.useRealTimers();
});

test('starts unknown and fetches nothing until refresh', () => {
  expect(manager.getApiResources()).toEqual({ status: 'unknown', resources: [] });
  expect(mockApi.getApiVersions).not.toHaveBeenCalled();
  expect(mockApi.getApiResources).not.toHaveBeenCalled();
});

test('init does not fetch', () => {
  manager.init();
  expect(mockApi.getApiVersions).not.toHaveBeenCalled();
  expect(mockApi.getApiResources).not.toHaveBeenCalled();
});

test('refresh fetches the core group via v1', async () => {
  vi.mocked(mockApi.getApiResources).mockImplementation(async (groupVersion: string) => {
    if (groupVersion === 'v1') {
      return resourceList('v1', [apiResource('pods', 'Pod')]);
    }
    return resourceList(groupVersion, []);
  });

  await manager.refresh();

  expect(mockApi.getApiResources).toHaveBeenCalledWith('v1');
  expect(manager.getApiResources()).toEqual({
    status: 'loaded',
    resources: [{ group: '', resource: 'pods', kind: 'Pod', namespaced: true, verbs: ['get', 'list'] }],
  });
});

test('refresh fetches each group at its preferred version', async () => {
  const groups: ApiGroupList = {
    groups: [
      {
        name: 'apps',
        versions: [
          { groupVersion: 'apps/v1beta1', version: 'v1beta1' },
          { groupVersion: 'apps/v1', version: 'v1' },
        ],
        preferredVersion: { groupVersion: 'apps/v1', version: 'v1' },
      },
    ],
  };
  vi.mocked(mockApi.getApiVersions).mockResolvedValue(groups);
  vi.mocked(mockApi.getApiResources).mockImplementation(async (groupVersion: string) => {
    if (groupVersion === 'apps/v1') {
      return resourceList('apps/v1', [apiResource('deployments', 'Deployment')]);
    }
    if (groupVersion === 'v1') {
      return resourceList('v1', [apiResource('pods', 'Pod')]);
    }
    throw new Error(`unexpected ${groupVersion}`);
  });

  await manager.refresh();

  expect(mockApi.getApiResources).toHaveBeenCalledWith('apps/v1');
  expect(mockApi.getApiResources).not.toHaveBeenCalledWith('apps/v1beta1');
  expect(manager.getApiResources().resources.map(resource => resource.resource)).toEqual(['pods', 'deployments']);
});

test('refresh skips a group whose getApiResources rejects', async () => {
  vi.mocked(mockApi.getApiVersions).mockResolvedValue({
    groups: [{ name: 'apps', versions: [{ groupVersion: 'apps/v1', version: 'v1' }] }],
  });
  vi.mocked(mockApi.getApiResources).mockImplementation(async (groupVersion: string) => {
    if (groupVersion === 'apps/v1') {
      throw apiResourceError(403);
    }
    return resourceList('v1', [apiResource('pods', 'Pod')]);
  });

  await manager.refresh();

  const data = manager.getApiResources();
  expect(data.status).toBe('loaded');
  expect(data.resources).toEqual([
    { group: '', resource: 'pods', kind: 'Pod', namespaced: true, verbs: ['get', 'list'] },
  ]);
  expect(data.failedGroupVersions).toEqual(['apps/v1: not permitted to read this group']);
});

test('refresh publishes an error when getApiVersions is missing', async () => {
  vi.mocked(dashboardApiManagerMock.getApi).mockReturnValue({
    getApiResources: vi.fn(),
  } as unknown as KubernetesDashboardExtensionApi);

  await manager.refresh();

  expect(manager.getApiResources()).toEqual({
    status: 'error',
    resources: [],
    error: 'The Kubernetes Dashboard extension needs updating to list API resources',
  });
});

test('refresh publishes an error when the dashboard API is missing', async () => {
  vi.mocked(dashboardApiManagerMock.getApi).mockReturnValue(undefined);

  await manager.refresh();

  expect(manager.getApiResources()).toEqual({
    status: 'error',
    resources: [],
    error: 'Dashboard extension API not available',
  });
});

test('refresh publishes an error when getApiVersions rejects', async () => {
  vi.mocked(mockApi.getApiVersions).mockRejectedValue(new Error('cluster unreachable'));

  await manager.refresh();

  expect(manager.getApiResources()).toEqual({
    status: 'error',
    resources: [],
    error: 'cluster unreachable',
  });
});

test('refresh sorts resources by group then name', async () => {
  vi.mocked(mockApi.getApiVersions).mockResolvedValue({
    groups: [{ name: 'apps', versions: [{ groupVersion: 'apps/v1', version: 'v1' }] }],
  });
  vi.mocked(mockApi.getApiResources).mockImplementation(async (groupVersion: string) => {
    if (groupVersion === 'apps/v1') {
      return resourceList('apps/v1', [
        apiResource('deployments', 'Deployment'),
        apiResource('daemonsets', 'DaemonSet'),
      ]);
    }
    return resourceList('v1', [apiResource('services', 'Service'), apiResource('pods', 'Pod')]);
  });

  await manager.refresh();

  expect(manager.getApiResources().resources.map(resource => `${resource.group}/${resource.resource}`)).toEqual([
    '/pods',
    '/services',
    'apps/daemonsets',
    'apps/deployments',
  ]);
});

test('refresh is a no-op while another pass is in flight', async () => {
  let release!: (value: ApiGroupList) => void;
  vi.mocked(mockApi.getApiVersions).mockReturnValue(
    new Promise(resolve => {
      release = resolve;
    }),
  );

  const first = manager.refresh();
  expect(manager.getApiResources().status).toBe('loading');
  await manager.refresh();
  expect(mockApi.getApiVersions).toHaveBeenCalledOnce();

  release({ groups: [] });
  await first;
  expect(manager.getApiResources().status).toBe('loaded');
});

test('refresh retries a 429 and then succeeds', async () => {
  vi.useFakeTimers();
  const random = vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.mocked(mockApi.getApiResources)
    .mockRejectedValueOnce(apiResourceError(429, '1'))
    .mockResolvedValueOnce(resourceList('v1', [apiResource('pods', 'Pod')]));

  const done = manager.refresh();
  await vi.advanceTimersByTimeAsync(500);
  await done;
  random.mockRestore();

  expect(manager.getApiResources().status).toBe('loaded');
  expect(manager.getApiResources().resources).toHaveLength(1);
});

test('a health event with a new reachable set invalidates without fetching', async () => {
  vi.useFakeTimers();
  manager.init();
  onHealthChange.fire(healths('ctx-a'));
  await vi.advanceTimersByTimeAsync(500);

  vi.mocked(mockApi.getApiResources).mockResolvedValue(resourceList('v1', [apiResource('pods', 'Pod')]));
  await manager.refresh();
  expect(manager.getApiResources().status).toBe('loaded');
  vi.mocked(mockApi.getApiVersions).mockClear();
  vi.mocked(mockApi.getApiResources).mockClear();

  onHealthChange.fire(healths('ctx-b'));
  await vi.advanceTimersByTimeAsync(500);

  expect(manager.getApiResources()).toEqual({ status: 'unknown', resources: [] });
  expect(mockApi.getApiVersions).not.toHaveBeenCalled();
  expect(mockApi.getApiResources).not.toHaveBeenCalled();
});

test('a health event with the same reachable set does not invalidate', async () => {
  vi.useFakeTimers();
  manager.init();
  vi.mocked(mockApi.getApiResources).mockResolvedValue(resourceList('v1', [apiResource('pods', 'Pod')]));
  await manager.refresh();

  onHealthChange.fire(healths('ctx-a'));
  await vi.advanceTimersByTimeAsync(500);
  expect(manager.getApiResources().status).toBe('loaded');

  onHealthChange.fire({
    healths: [
      { contextName: 'ctx-a', checking: true, reachable: true, offline: false },
      { contextName: 'ctx-b', checking: false, reachable: false, offline: false },
    ],
  });
  await vi.advanceTimersByTimeAsync(500);

  expect(manager.getApiResources().status).toBe('loaded');
});

test('health bursts are debounced to the last fingerprint', async () => {
  vi.useFakeTimers();
  manager.init();
  onHealthChange.fire(healths('ctx-a'));
  await vi.advanceTimersByTimeAsync(500);

  vi.mocked(mockApi.getApiResources).mockResolvedValue(resourceList('v1', [apiResource('pods', 'Pod')]));
  await manager.refresh();

  onHealthChange.fire(healths('ctx-b'));
  onHealthChange.fire(healths('ctx-a', 'ctx-b'));
  await vi.advanceTimersByTimeAsync(499);
  expect(manager.getApiResources().status).toBe('loaded');
  await vi.advanceTimersByTimeAsync(1);
  expect(manager.getApiResources().status).toBe('unknown');
});

test('an in-flight refresh does not publish after the cache is invalidated', async () => {
  vi.useFakeTimers();
  manager.init();
  onHealthChange.fire(healths('ctx-a'));
  await vi.advanceTimersByTimeAsync(500);

  let release!: (value: ApiGroupList) => void;
  vi.mocked(mockApi.getApiVersions).mockReturnValue(
    new Promise(resolve => {
      release = resolve;
    }),
  );

  const done = manager.refresh();
  expect(manager.getApiResources().status).toBe('loading');

  onHealthChange.fire(healths('ctx-b'));
  await vi.advanceTimersByTimeAsync(500);
  expect(manager.getApiResources().status).toBe('unknown');

  release({ groups: [] });
  await done;
  expect(manager.getApiResources().status).toBe('unknown');
});
