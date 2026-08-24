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

import { inject, injectable } from 'inversify';
import type { DispatcherObject } from './util/dispatcher-object';
import { AbsDispatcherObjectImpl } from './util/dispatcher-object';
import { RpcExtension } from '@kubernetes-iam/rpc';
import { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import type { ClusterRoleBindingsData } from '@kubernetes-iam/channels';
import { CLUSTER_ROLE_BINDINGS } from '@kubernetes-iam/channels';

@injectable()
export class ClusterRoleBindingsDispatcher
  extends AbsDispatcherObjectImpl<void, ClusterRoleBindingsData>
  implements DispatcherObject<void>
{
  constructor(
    @inject(RpcExtension) rpcExtension: RpcExtension,
    @inject(DashboardStatesManager) private dashboardStatesManager: DashboardStatesManager,
  ) {
    super(rpcExtension, CLUSTER_ROLE_BINDINGS);
  }

  getData(): ClusterRoleBindingsData {
    return this.dashboardStatesManager.getClusterRoleBindings();
  }
}
