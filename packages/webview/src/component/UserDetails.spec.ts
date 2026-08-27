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
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type {
  ClusterRoleBindingsData,
  ClusterRolesData,
  IamApi,
  RoleBindingsData,
  RolesData,
} from '@kubernetes-iam/channels';
import { API_IAM } from '@kubernetes-iam/channels';
import UserDetails from './UserDetails.svelte';
import type { RoleRowUI } from './users/RoleRowUI';
import { StatesMocks } from '/@/tests/state-mocks';
import { RemoteMocks } from '/@/tests/remote-mocks';
import { FakeStateObject } from '/@/state/util/fake-state-object.svelte';
import * as uiSvelte from '@podman-desktop/ui-svelte';
import type { SvelteComponent } from 'svelte';

const statesMocks = new StatesMocks();
const remoteMocks = new RemoteMocks();

let rolesStateMock: FakeStateObject<RolesData, void>;
let clusterRolesStateMock: FakeStateObject<ClusterRolesData, void>;
let roleBindingsStateMock: FakeStateObject<RoleBindingsData, void>;
let clusterRoleBindingsStateMock: FakeStateObject<ClusterRoleBindingsData, void>;

beforeEach(() => {
  vi.resetAllMocks();
  remoteMocks.reset();
  remoteMocks.mock(API_IAM, {
    getUserDetails: vi.fn().mockResolvedValue({ name: 'alice', kind: 'User', roles: [] }),
    createRoleForUser: vi.fn().mockResolvedValue(undefined),
    createClusterRoleForUser: vi.fn().mockResolvedValue(undefined),
    addRuleToRole: vi.fn().mockResolvedValue(undefined),
    addRuleToClusterRole: vi.fn().mockResolvedValue(undefined),
  } as unknown as IamApi);
  statesMocks.reset();
  rolesStateMock = new FakeStateObject();
  clusterRolesStateMock = new FakeStateObject();
  roleBindingsStateMock = new FakeStateObject();
  clusterRoleBindingsStateMock = new FakeStateObject();
  statesMocks.mock<RolesData, void>('stateRolesData', rolesStateMock);
  statesMocks.mock<ClusterRolesData, void>('stateClusterRolesData', clusterRolesStateMock);
  statesMocks.mock<RoleBindingsData, void>('stateRoleBindingsData', roleBindingsStateMock);
  statesMocks.mock<ClusterRoleBindingsData, void>('stateClusterRoleBindingsData', clusterRoleBindingsStateMock);
  vi.spyOn(uiSvelte, 'Table').mockImplementation(vi.fn());
});

async function renderDetails(): Promise<void> {
  render(UserDetails, { name: 'alice' });
  await waitFor(() => expect(remoteMocks.get(API_IAM).getUserDetails).toHaveBeenCalledWith({ userName: 'alice' }));
}

/**
 * Renders the page on a user holding the given role and opens the rule dialog through the
 * callback its row carries: the table is mocked, so the cell rendering the action is never
 * mounted.
 */
async function openRuleDialog(role: { kind: string; name: string; namespace?: string }): Promise<void> {
  vi.mocked(remoteMocks.get(API_IAM).getUserDetails).mockResolvedValue({
    name: 'alice',
    kind: 'User',
    roles: [
      {
        bindingName: 'binding',
        bindingKind: role.namespace === undefined ? 'ClusterRoleBinding' : 'RoleBinding',
        roleName: role.name,
        roleKind: role.kind,
        namespace: role.namespace,
        rules: [],
      },
    ],
  });
  await renderDetails();

  await waitFor(() => expect(uiSvelte.Table).toHaveBeenCalled());
  const calls = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls;
  const rows = calls[calls.length - 1][1].data as RoleRowUI[];
  const row = rows.find(r => r.role?.name === role.name);
  expect(row?.onAddRule).toBeDefined();
  row?.onAddRule?.();

  await waitFor(() => expect(screen.getByRole('dialog', { name: 'Add rule' })).toBeDefined());
}

describe('UserDetails', () => {
  test('displays the roles of the user', async () => {
    vi.mocked(remoteMocks.get(API_IAM).getUserDetails).mockResolvedValue({
      name: 'alice',
      kind: 'User',
      roles: [
        {
          bindingName: 'rb1',
          bindingKind: 'RoleBinding',
          roleName: 'pod-reader',
          roleKind: 'Role',
          namespace: 'default',
          rules: [],
        },
      ],
    });
    await renderDetails();

    await waitFor(() => expect(uiSvelte.Table).toHaveBeenCalled());
    const calls = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls;
    const props = calls[calls.length - 1][1];
    expect(props.data).toMatchObject([{ name: 'pod-reader', col2: 'Role', col3: 'rb1', col4: 'default' }]);
  });

  test('reads the details again when the RBAC data changes', async () => {
    await renderDetails();

    roleBindingsStateMock.setData({ roleBindings: [] });

    await waitFor(() => expect(remoteMocks.get(API_IAM).getUserDetails).toHaveBeenCalledTimes(2));
  });

  test('creates a namespaced role bound to the user', async () => {
    await renderDetails();
    await fireEvent.click(screen.getByRole('button', { name: 'Add role' }));

    await fireEvent.input(screen.getByRole('textbox', { name: 'Role name' }), { target: { value: 'pod-reader' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Namespace' }), { target: { value: 'ns1' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(remoteMocks.get(API_IAM).createRoleForUser).toHaveBeenCalledWith({
      username: 'alice',
      name: 'pod-reader',
      namespace: 'ns1',
    });
  });

  test('creates a cluster role bound to the user, without asking for a namespace', async () => {
    await renderDetails();
    await fireEvent.click(screen.getByRole('button', { name: 'Add cluster role' }));

    expect(screen.queryByRole('textbox', { name: 'Namespace' })).toBeNull();

    await fireEvent.input(screen.getByRole('textbox', { name: 'Role name' }), { target: { value: 'node-reader' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(remoteMocks.get(API_IAM).createClusterRoleForUser).toHaveBeenCalledWith({
      username: 'alice',
      name: 'node-reader',
    });
  });

  test('keeps the dialog open and displays the error when the creation fails', async () => {
    vi.mocked(remoteMocks.get(API_IAM).createRoleForUser).mockRejectedValue(
      new Error('A role or role binding named pod-reader already exists in namespace default'),
    );
    await renderDetails();
    await fireEvent.click(screen.getByRole('button', { name: 'Add role' }));

    await fireEvent.input(screen.getByRole('textbox', { name: 'Role name' }), { target: { value: 'pod-reader' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(
        screen.getByText('A role or role binding named pod-reader already exists in namespace default'),
      ).toBeDefined(),
    );
    expect(screen.getByRole('dialog', { name: 'Create role' })).toBeDefined();
  });

  test('closes the dialog once the role is created', async () => {
    await renderDetails();
    await fireEvent.click(screen.getByRole('button', { name: 'Add role' }));

    await fireEvent.input(screen.getByRole('textbox', { name: 'Role name' }), { target: { value: 'pod-reader' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create role' })).toBeNull());
  });

  test('offers a rule action on the role rows only', async () => {
    vi.mocked(remoteMocks.get(API_IAM).getUserDetails).mockResolvedValue({
      name: 'alice',
      kind: 'User',
      roles: [
        {
          bindingName: 'rb1',
          bindingKind: 'RoleBinding',
          roleName: 'pod-reader',
          roleKind: 'Role',
          namespace: 'default',
          rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get'] }],
        },
      ],
    });
    await renderDetails();

    await waitFor(() => expect(uiSvelte.Table).toHaveBeenCalled());
    const calls = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls;
    const props = calls[calls.length - 1][1];
    expect((props.columns as { title: string }[]).map(c => c.title)).toContain('Actions');
    expect(props.data[0].role).toEqual({ kind: 'Role', name: 'pod-reader', namespace: 'default' });
    expect(props.data[0].children[0].role).toBeUndefined();
  });

  test('adds a rule to the role of the row', async () => {
    await openRuleDialog({ kind: 'Role', name: 'pod-reader', namespace: 'default' });

    await fireEvent.input(screen.getByRole('textbox', { name: 'API groups' }), { target: { value: 'apps' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Resources' }), { target: { value: 'deployments' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Verbs' }), { target: { value: 'get, list' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(remoteMocks.get(API_IAM).addRuleToRole).toHaveBeenCalledWith({
      namespace: 'default',
      name: 'pod-reader',
      rule: { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list'], resourceNames: [] },
    });
  });

  test('adds a rule to a cluster role, on the core API group by default', async () => {
    await openRuleDialog({ kind: 'ClusterRole', name: 'node-reader' });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Resources' }), { target: { value: 'nodes' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Verbs' }), { target: { value: 'get' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(remoteMocks.get(API_IAM).addRuleToClusterRole).toHaveBeenCalledWith({
      name: 'node-reader',
      rule: { apiGroups: [''], resources: ['nodes'], verbs: ['get'], resourceNames: [] },
    });
  });

  test('adds a rule to a cluster role bound through a namespaced binding', async () => {
    await openRuleDialog({ kind: 'ClusterRole', name: 'view', namespace: 'default' });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Resources' }), { target: { value: 'pods' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Verbs' }), { target: { value: 'get' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(remoteMocks.get(API_IAM).addRuleToClusterRole).toHaveBeenCalledWith({
      name: 'view',
      rule: { apiGroups: [''], resources: ['pods'], verbs: ['get'], resourceNames: [] },
    });
    expect(remoteMocks.get(API_IAM).addRuleToRole).not.toHaveBeenCalled();
  });

  test('sends the core API group under the name Kubernetes gives it', async () => {
    await openRuleDialog({ kind: 'ClusterRole', name: 'node-reader' });

    await fireEvent.input(screen.getByRole('textbox', { name: 'API groups' }), { target: { value: 'core, apps' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Resources' }), { target: { value: 'nodes' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Verbs' }), { target: { value: 'get' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(remoteMocks.get(API_IAM).addRuleToClusterRole).toHaveBeenCalledWith({
      name: 'node-reader',
      rule: { apiGroups: ['', 'apps'], resources: ['nodes'], verbs: ['get'], resourceNames: [] },
    });
  });

  test('refuses a rule without any resource or verb', async () => {
    await openRuleDialog({ kind: 'Role', name: 'pod-reader', namespace: 'default' });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Resources' }), { target: { value: 'pods' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(remoteMocks.get(API_IAM).addRuleToRole).not.toHaveBeenCalled();
  });

  test('displays the error when the rule is refused', async () => {
    vi.mocked(remoteMocks.get(API_IAM).addRuleToRole).mockRejectedValue(new Error('No role named pod-reader'));
    await openRuleDialog({ kind: 'Role', name: 'pod-reader', namespace: 'default' });

    await fireEvent.input(screen.getByRole('textbox', { name: 'Resources' }), { target: { value: 'pods' } });
    await fireEvent.input(screen.getByRole('textbox', { name: 'Verbs' }), { target: { value: 'get' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(screen.getByText('No role named pod-reader')).toBeDefined());
  });
});
