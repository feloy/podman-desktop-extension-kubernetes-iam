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

import type { PolicyRuleInfo } from '/@/model/role-info';
import type { RoleRefInfo, SubjectInfo } from '/@/model/role-binding-info';
import type { GetUserDetailsRequest, UserDetailsData } from '/@/model/user-details-info';

export interface CreateRoleRequest {
  contextName: string;
  namespace: string;
  name: string;
  rules: PolicyRuleInfo[];
}

export interface CreateRoleBindingRequest {
  contextName: string;
  namespace: string;
  name: string;
  roleRef: RoleRefInfo;
  subjects: SubjectInfo[];
}

export interface CreateClusterRoleRequest {
  contextName: string;
  name: string;
  rules: PolicyRuleInfo[];
  aggregationLabels?: Record<string, string>;
}

export interface CreateClusterRoleBindingRequest {
  contextName: string;
  name: string;
  roleRef: RoleRefInfo;
  subjects: SubjectInfo[];
}

export interface GenerateKubeconfigRequest {
  username: string;
  expirationSeconds?: number;
}

export const IamApi = Symbol.for('IamApi');

export interface IamApi {
  createRole(request: CreateRoleRequest): Promise<void>;
  updateRole(request: CreateRoleRequest): Promise<void>;
  deleteRole(contextName: string, namespace: string, name: string): Promise<void>;

  createRoleBinding(request: CreateRoleBindingRequest): Promise<void>;
  updateRoleBinding(request: CreateRoleBindingRequest): Promise<void>;
  deleteRoleBinding(contextName: string, namespace: string, name: string): Promise<void>;

  createClusterRole(request: CreateClusterRoleRequest): Promise<void>;
  updateClusterRole(request: CreateClusterRoleRequest): Promise<void>;
  deleteClusterRole(contextName: string, name: string): Promise<void>;

  createClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void>;
  updateClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void>;
  deleteClusterRoleBinding(contextName: string, name: string): Promise<void>;

  refreshRbacData(contextName: string): Promise<void>;

  generateKubeconfig(request: GenerateKubeconfigRequest): Promise<void>;

  getUserDetails(request: GetUserDetailsRequest): Promise<UserDetailsData>;
}
