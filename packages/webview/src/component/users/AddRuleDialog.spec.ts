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
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { ApiResourceInfo, ApiResourcesData, IamApi } from '@kubernetes-iam/channels';
import { API_IAM } from '@kubernetes-iam/channels';
import AddRuleDialog from './AddRuleDialog.svelte';
import type { RoleRef } from './RoleRowUI';
import { StatesMocks } from '/@/tests/state-mocks';
import { RemoteMocks } from '/@/tests/remote-mocks';
import { FakeStateObject } from '/@/state/util/fake-state-object.svelte';

const statesMocks = new StatesMocks();
const remoteMocks = new RemoteMocks();
let apiResourcesStateMock: FakeStateObject<ApiResourcesData, void>;

function resource(group: string, name: string, extra?: Partial<ApiResourceInfo>): ApiResourceInfo {
  return {
    group,
    resource: name,
    kind: extra?.kind ?? name,
    namespaced: extra?.namespaced ?? true,
    verbs: extra?.verbs ?? ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', 'deletecollection'],
  };
}

const PODS = resource('', 'pods', { kind: 'Pod' });
const DEPLOYMENTS = resource('apps', 'deployments', { kind: 'Deployment' });
const NODES = resource('', 'nodes', { kind: 'Node', namespaced: false });

const ROLE = { kind: 'Role', name: 'pod-reader', namespace: 'default' };
const CLUSTER_ROLE = { kind: 'ClusterRole', name: 'node-reader' };

function renderDialog(role: RoleRef = ROLE): void {
  render(AddRuleDialog, { role, onclose: vi.fn() });
}

beforeEach(() => {
  vi.resetAllMocks();
  remoteMocks.reset();
  remoteMocks.mock(API_IAM, {
    addRulesToRole: vi.fn().mockResolvedValue(undefined),
    addRulesToClusterRole: vi.fn().mockResolvedValue(undefined),
    refreshApiResources: vi.fn().mockResolvedValue(undefined),
  } as unknown as IamApi);
  statesMocks.reset();
  apiResourcesStateMock = new FakeStateObject();
  statesMocks.mock<ApiResourcesData, void>('stateApiResourcesData', apiResourcesStateMock);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AddRuleDialog', () => {
  test('fetches API resources and shows a spinner when discovery has not run yet', () => {
    renderDialog();

    expect(remoteMocks.get(API_IAM).refreshApiResources).toHaveBeenCalled();
    expect(screen.getByRole('status', { name: 'Loading API resources' })).toBeDefined();
    expect((screen.getByRole('button', { name: 'Add rules' }) as HTMLButtonElement).disabled).toBe(true);
  });

  test('does not fetch again when discovery is already loaded', () => {
    apiResourcesStateMock.setData({ status: 'loaded', resources: [PODS] });
    renderDialog();

    expect(remoteMocks.get(API_IAM).refreshApiResources).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'pods' })).toBeDefined();
  });

  test('hides cluster-scoped resources when the target is a namespaced Role', () => {
    apiResourcesStateMock.setData({ status: 'loaded', resources: [PODS, NODES, DEPLOYMENTS] });
    renderDialog(ROLE);

    expect(screen.getByRole('checkbox', { name: 'pods' })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: 'nodes' })).toBeNull();
  });

  test('keeps cluster-scoped resources when the target is a ClusterRole', () => {
    apiResourcesStateMock.setData({ status: 'loaded', resources: [PODS, NODES] });
    renderDialog(CLUSTER_ROLE);

    expect(screen.getByRole('checkbox', { name: 'nodes' })).toBeDefined();
  });

  test('submits one rule per API group', async () => {
    apiResourcesStateMock.setData({ status: 'loaded', resources: [PODS, DEPLOYMENTS] });
    renderDialog(ROLE);

    await fireEvent.click(screen.getByRole('checkbox', { name: 'pods' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'deployments' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'View' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Add rules' }));

    expect(remoteMocks.get(API_IAM).addRulesToRole).toHaveBeenCalledWith({
      namespace: 'default',
      name: 'pod-reader',
      rules: [
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] },
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch'] },
      ],
    });
  });

  test('offers Retry when discovery failed', async () => {
    apiResourcesStateMock.setData({ status: 'error', resources: [], error: 'Dashboard extension API not available' });
    renderDialog();

    expect(screen.getByText('Dashboard extension API not available')).toBeDefined();
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(remoteMocks.get(API_IAM).refreshApiResources).toHaveBeenCalled();
  });

  test('treats a hung discovery as an error after 15 seconds', async () => {
    vi.useFakeTimers();
    renderDialog();

    expect(screen.getByRole('status', { name: 'Loading API resources' })).toBeDefined();

    await vi.advanceTimersByTimeAsync(15_000);

    expect(screen.getByText('Timed out waiting for API resources.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDefined();
  });
});
