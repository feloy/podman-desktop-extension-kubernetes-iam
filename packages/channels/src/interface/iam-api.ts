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
  namespace: string;
  name: string;
  rules: PolicyRuleInfo[];
}

export interface CreateRoleBindingRequest {
  namespace: string;
  name: string;
  roleRef: RoleRefInfo;
  subjects: SubjectInfo[];
}

export interface CreateClusterRoleRequest {
  name: string;
  rules: PolicyRuleInfo[];
  aggregationLabels?: Record<string, string>;
}

export interface CreateClusterRoleBindingRequest {
  name: string;
  roleRef: RoleRefInfo;
  subjects: SubjectInfo[];
}

export interface CreateUserRequest {
  username: string;
}

export interface CreateRoleForUserRequest {
  username: string;
  namespace: string;
  name: string;
}

export interface CreateClusterRoleForUserRequest {
  username: string;
  name: string;
}

export interface AddRoleRulesRequest {
  namespace: string;
  name: string;
  rules: PolicyRuleInfo[];
}

export interface AddClusterRoleRulesRequest {
  name: string;
  rules: PolicyRuleInfo[];
}

export interface RemoveRoleRuleRequest {
  namespace: string;
  name: string;
  rule: PolicyRuleInfo;
}

export interface RemoveClusterRoleRuleRequest {
  name: string;
  rule: PolicyRuleInfo;
}

export interface RevokeRoleFromUserRequest {
  username: string;
  /** `RoleBinding` or `ClusterRoleBinding`. */
  bindingKind: string;
  bindingName: string;
  /** The namespace of the binding, set when the binding is a RoleBinding. */
  namespace?: string;
}

export interface GenerateKubeconfigRequest {
  username: string;
  expirationSeconds?: number;
}

export const IamApi = Symbol.for('IamApi');

/**
 * The extension operates exclusively on the current Kubernetes context: the Dashboard
 * write APIs (`patchResources`, `deleteResource`, `patchSubresource`) target it implicitly,
 * so none of these operations accept a context name.
 */
export interface IamApi {
  createRole(request: CreateRoleRequest): Promise<void>;
  updateRole(request: CreateRoleRequest): Promise<void>;
  deleteRole(namespace: string, name: string): Promise<void>;

  createRoleBinding(request: CreateRoleBindingRequest): Promise<void>;
  updateRoleBinding(request: CreateRoleBindingRequest): Promise<void>;
  deleteRoleBinding(namespace: string, name: string): Promise<void>;

  createClusterRole(request: CreateClusterRoleRequest): Promise<void>;
  updateClusterRole(request: CreateClusterRoleRequest): Promise<void>;
  deleteClusterRole(name: string): Promise<void>;

  createClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void>;
  updateClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void>;
  deleteClusterRoleBinding(name: string): Promise<void>;

  refreshRbacData(): Promise<void>;

  /**
   * Makes a user appear in the cluster's RBAC records by binding it to a ClusterRole that
   * every authenticated user already holds, so the user can be listed without being
   * granted any privilege it would not otherwise have.
   */
  createUser(request: CreateUserRequest): Promise<void>;

  /**
   * Creates an empty Role in `namespace` and a RoleBinding granting it to the user. The
   * role holds no rule, so the user gains nothing until rules are added to it.
   */
  createRoleForUser(request: CreateRoleForUserRequest): Promise<void>;

  /**
   * Cluster-wide counterpart of {@link createRoleForUser}: creates an empty ClusterRole
   * and a ClusterRoleBinding granting it to the user.
   */
  createClusterRoleForUser(request: CreateClusterRoleForUserRequest): Promise<void>;

  /**
   * Revokes from the user the role a binding grants it, asking the operator to confirm first.
   *
   * The binding is deleted when the user is its only subject, and only that subject is
   * removed from it otherwise, so the role stays granted to the subjects that share the
   * binding. The role itself is left in place either way.
   */
  revokeRoleFromUser(request: RevokeRoleFromUserRequest): Promise<void>;

  /**
   * Appends rules to an existing Role in a single apply.
   */
  addRulesToRole(request: AddRoleRulesRequest): Promise<void>;

  /**
   * Appends rules to an existing ClusterRole in a single apply.
   */
  addRulesToClusterRole(request: AddClusterRoleRulesRequest): Promise<void>;

  /** Removes one selected rule from an existing Role after confirmation. */
  removeRuleFromRole(request: RemoveRoleRuleRequest): Promise<void>;

  /** Removes one selected rule from an existing ClusterRole after confirmation. */
  removeRuleFromClusterRole(request: RemoveClusterRoleRuleRequest): Promise<void>;

  /**
   * Starts a discovery pass of the API resources of the current context.
   *
   * Returns immediately: the pass can take longer than the RPC timeout, and its result is
   * pushed on the `API_RESOURCES` channel rather than returned here.
   */
  refreshApiResources(): Promise<void>;

  generateKubeconfig(request: GenerateKubeconfigRequest): Promise<void>;

  getUserDetails(request: GetUserDetailsRequest): Promise<UserDetailsData>;
}
