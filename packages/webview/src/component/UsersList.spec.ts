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
import { render, screen } from '@testing-library/svelte';
import type { UsersData } from '@kubernetes-iam/channels';
import UsersList from './UsersList.svelte';
import { StatesMocks } from '/@/tests/state-mocks';
import { FakeStateObject } from '/@/state/util/fake-state-object.svelte';
import * as uiSvelte from '@podman-desktop/ui-svelte';
import type { SvelteComponent } from 'svelte';

const statesMocks = new StatesMocks();
let usersStateMock: FakeStateObject<UsersData, void>;

beforeEach(() => {
  vi.resetAllMocks();
  statesMocks.reset();
  usersStateMock = new FakeStateObject();
  statesMocks.mock<UsersData, void>('stateUsersData', usersStateMock);
  vi.spyOn(uiSvelte, 'Table').mockImplementation(vi.fn());
  vi.spyOn(uiSvelte, 'FilteredEmptyScreen').mockImplementation(vi.fn());
});

describe('UsersList', () => {
  test('shows empty message when no data', () => {
    render(UsersList);
    expect(screen.getByText('No users found.')).toBeDefined();
  });

  test('shows empty message when users array is empty', () => {
    usersStateMock.setData({ users: [] });
    render(UsersList);
    expect(screen.getByText('No users found.')).toBeDefined();
  });

  test('passes user data to Table component', () => {
    usersStateMock.setData({
      users: [
        { kind: 'User', name: 'alice' },
        { kind: 'Group', name: 'developers' },
      ],
    });
    render(UsersList);

    expect(uiSvelte.Table).toHaveBeenCalled();
    const props = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls[0][1];
    expect(props.data).toHaveLength(2);
    expect(props.data[0]).toMatchObject({ name: 'alice', kind: 'User' });
    expect(props.data[1]).toMatchObject({ name: 'developers', kind: 'Group' });
  });

  test('passes namespace in user data', () => {
    usersStateMock.setData({
      users: [{ kind: 'ServiceAccount', name: 'default', namespace: 'kube-system' }],
    });
    render(UsersList);

    expect(uiSvelte.Table).toHaveBeenCalled();
    const props = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls[0][1];
    expect(props.data).toHaveLength(1);
    expect(props.data[0]).toMatchObject({ name: 'default', kind: 'ServiceAccount', namespace: 'kube-system' });
  });

  test('table has Namespace, Name, Type and Scope columns', () => {
    usersStateMock.setData({ users: [{ kind: 'User', name: 'alice' }] });
    render(UsersList);

    expect(uiSvelte.Table).toHaveBeenCalled();
    const props = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls[0][1];
    const columnTitles = (props.columns as { title: string }[]).map(c => c.title);
    expect(columnTitles).toEqual(['Namespace', 'Name', 'Type', 'Scope']);
  });

  test('table kind is set to user', () => {
    usersStateMock.setData({ users: [{ kind: 'User', name: 'alice' }] });
    render(UsersList);

    expect(uiSvelte.Table).toHaveBeenCalled();
    const props = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls[0][1];
    expect(props.kind).toBe('user');
  });

  test('displays page title', () => {
    render(UsersList);
    expect(screen.getByRole('region', { name: 'Users' })).toBeDefined();
  });
});
