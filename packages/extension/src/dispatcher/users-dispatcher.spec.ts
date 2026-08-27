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

import type { RpcExtension } from '@kubernetes-iam/rpc';
import { beforeEach, expect, test, vi } from 'vitest';
import { UsersDispatcher } from '/@/dispatcher/users-dispatcher';
import type { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import type { UsersData } from '@kubernetes-iam/channels';

let rpcExtension: RpcExtension;
let dashboardStatesManager: DashboardStatesManager;

beforeEach(() => {
  rpcExtension = {
    fire: vi.fn(),
  } as unknown as RpcExtension;
  dashboardStatesManager = {
    getUsers: vi.fn(),
  } as unknown as DashboardStatesManager;
});

test('getData should return the users data', () => {
  const usersData: UsersData = {
    users: [
      {
        contextName: 'ctx1',
        kind: 'User',
        name: 'alice',
      },
      {
        contextName: 'ctx1',
        kind: 'Group',
        name: 'devs',
        apiGroup: 'rbac.authorization.k8s.io',
      },
    ],
  };
  vi.mocked(dashboardStatesManager.getUsers).mockReturnValue(usersData);
  const dispatcher = new UsersDispatcher(rpcExtension, dashboardStatesManager);
  const data = dispatcher.getData();
  expect(data).toBeDefined();
  expect(data).toEqual(usersData);
});
