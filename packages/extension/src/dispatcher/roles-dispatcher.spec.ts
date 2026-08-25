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
import { RolesDispatcher } from '/@/dispatcher/roles-dispatcher';
import type { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import type { RolesData } from '@kubernetes-iam/channels';

let rpcExtension: RpcExtension;
let dashboardStatesManager: DashboardStatesManager;

beforeEach(() => {
  rpcExtension = {
    fire: vi.fn(),
  } as unknown as RpcExtension;
  dashboardStatesManager = {
    getRoles: vi.fn(),
  } as unknown as DashboardStatesManager;
});

test('getData should return the roles data', () => {
  const rolesData: RolesData = {
    roles: [
      {
        contextName: 'context1',
        namespace: 'default',
        name: 'my-role',
        rules: [
          {
            apiGroups: [''],
            resources: ['pods'],
            verbs: ['get', 'list'],
          },
        ],
      },
    ],
  };
  vi.mocked(dashboardStatesManager.getRoles).mockReturnValue(rolesData);
  const dispatcher = new RolesDispatcher(rpcExtension, dashboardStatesManager);
  const data = dispatcher.getData();
  expect(data).toBeDefined();
  expect(data).toEqual(rolesData);
});
