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

import type { IamApi } from '/@/interface/iam-api';
import type { SubscribeApi } from '/@/interface/subscribe-api';
import { createRpcChannel } from '@kubernetes-iam/rpc';
import type { RolesData } from '/@/model/role-info';
import type { RoleBindingsData } from '/@/model/role-binding-info';
import type { ClusterRolesData } from '/@/model/cluster-role-info';
import type { ClusterRoleBindingsData } from '/@/model/cluster-role-binding-info';

// RPC channels (used by the webview to send requests to the extension)
export const API_IAM = createRpcChannel<IamApi>('IamApi');
export const API_SUBSCRIBE = createRpcChannel<SubscribeApi>('SubscribeApi');

// Broadcast events (sent by extension and received by the webview)
export const ROLES = createRpcChannel<RolesData>('Roles');
export const ROLE_BINDINGS = createRpcChannel<RoleBindingsData>('RoleBindings');
export const CLUSTER_ROLES = createRpcChannel<ClusterRolesData>('ClusterRoles');
export const CLUSTER_ROLE_BINDINGS = createRpcChannel<ClusterRoleBindingsData>('ClusterRoleBindings');
