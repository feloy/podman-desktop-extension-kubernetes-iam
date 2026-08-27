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
import { fireEvent, render, screen } from '@testing-library/svelte';
import type { IamApi, UsersData } from '@kubernetes-iam/channels';
import { API_IAM } from '@kubernetes-iam/channels';
import UsersList from './UsersList.svelte';
import { StatesMocks } from '/@/tests/state-mocks';
import { RemoteMocks } from '/@/tests/remote-mocks';
import { FakeStateObject } from '/@/state/util/fake-state-object.svelte';
import * as uiSvelte from '@podman-desktop/ui-svelte';
import type { SvelteComponent } from 'svelte';

const statesMocks = new StatesMocks();
const remoteMocks = new RemoteMocks();
let usersStateMock: FakeStateObject<UsersData, void>;

beforeEach(() => {
  vi.resetAllMocks();
  remoteMocks.reset();
  remoteMocks.mock(API_IAM, {
    createUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as IamApi);
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

  test('table has Name, Type and Actions columns', () => {
    usersStateMock.setData({ users: [{ kind: 'User', name: 'alice' }] });
    render(UsersList);

    expect(uiSvelte.Table).toHaveBeenCalled();
    const props = vi.mocked(uiSvelte.Table as unknown as SvelteComponent).mock.calls[0][1];
    const columnTitles = (props.columns as { title: string }[]).map(c => c.title);
    expect(columnTitles).toEqual(['Name', 'Type', 'Actions']);
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

  test('offers a Create user action', () => {
    render(UsersList);
    expect(screen.getByRole('button', { name: 'Create user' })).toBeDefined();
  });

  test('opens the create dialog when the action is clicked', async () => {
    render(UsersList);
    expect(screen.queryByRole('dialog', { name: 'Create user' })).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    expect(screen.getByRole('dialog', { name: 'Create user' })).toBeDefined();
  });

  test('creates the user entered in the dialog', async () => {
    render(UsersList);
    await fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    await fireEvent.input(screen.getByRole('textbox', { name: 'User name' }), { target: { value: 'alice' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(remoteMocks.get(API_IAM).createUser).toHaveBeenCalledWith({ username: 'alice' });
  });

  test('refuses a user name already in the list', async () => {
    usersStateMock.setData({ users: [{ kind: 'User', name: 'alice' }] });
    render(UsersList);
    await fireEvent.click(screen.getByRole('button', { name: 'Create user' }));

    await fireEvent.input(screen.getByRole('textbox', { name: 'User name' }), { target: { value: 'alice' } });

    expect(screen.getByText('A user named alice already exists.')).toBeDefined();
    expect(remoteMocks.get(API_IAM).createUser).not.toHaveBeenCalled();
  });
});
