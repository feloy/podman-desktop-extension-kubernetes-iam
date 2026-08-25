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

const statesMocks = new StatesMocks();
let usersStateMock: FakeStateObject<UsersData, void>;

beforeEach(() => {
  vi.resetAllMocks();
  statesMocks.reset();
  usersStateMock = new FakeStateObject();
  statesMocks.mock<UsersData, void>('stateUsersData', usersStateMock);
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

  test('displays user names', () => {
    usersStateMock.setData({
      users: [
        { kind: 'User', name: 'alice' },
        { kind: 'Group', name: 'developers' },
      ],
    });
    render(UsersList);
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('developers')).toBeDefined();
  });

  test('displays user kind', () => {
    usersStateMock.setData({
      users: [{ kind: 'ServiceAccount', name: 'default' }],
    });
    render(UsersList);
    expect(screen.getByText('(ServiceAccount)')).toBeDefined();
  });

  test('displays namespace when present', () => {
    usersStateMock.setData({
      users: [{ kind: 'ServiceAccount', name: 'default', namespace: 'kube-system' }],
    });
    render(UsersList);
    expect(screen.getByText('in kube-system')).toBeDefined();
  });

  test('does not display namespace text when absent', () => {
    usersStateMock.setData({
      users: [{ kind: 'User', name: 'alice' }],
    });
    render(UsersList);
    expect(screen.queryByText(/^in /)).toBeNull();
  });

  test('displays multiple users', () => {
    usersStateMock.setData({
      users: [
        { kind: 'User', name: 'alice' },
        { kind: 'User', name: 'bob' },
        { kind: 'Group', name: 'admins', apiGroup: 'rbac.authorization.k8s.io' },
      ],
    });
    render(UsersList);
    expect(screen.getByText('alice')).toBeDefined();
    expect(screen.getByText('bob')).toBeDefined();
    expect(screen.getByText('admins')).toBeDefined();
    expect(screen.queryByText('No users found.')).toBeNull();
  });
});
