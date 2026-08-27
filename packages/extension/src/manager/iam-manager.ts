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
import type {
  IamApi,
  CreateRoleRequest,
  CreateRoleBindingRequest,
  CreateClusterRoleRequest,
  CreateClusterRoleBindingRequest,
  CreateUserRequest,
  CreateRoleForUserRequest,
  CreateClusterRoleForUserRequest,
  AddRoleRuleRequest,
  AddClusterRoleRuleRequest,
  PolicyRuleInfo,
  GenerateKubeconfigRequest,
  GetUserDetailsRequest,
  UserDetailsData,
} from '@kubernetes-iam/channels';
import type { KubernetesDashboardExtensionApi } from '@podman-desktop/kubernetes-dashboard-extension-api';
import { TelemetryLoggerSymbol } from '/@/inject/symbol';
import type { TelemetryLogger } from '@podman-desktop/api';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';
import { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import { KubeconfigGenerator } from '/@/manager/kubeconfig-generator';
import { isValidUsername, toBindingName } from '/@/manager/user-names';
import { isValidNamespaceName, isValidResourceName } from '/@/manager/resource-names';
import { stringify } from 'yaml';

const RBAC_API_GROUP = 'rbac.authorization.k8s.io';

/**
 * The ClusterRole a newly created user is bound to.
 *
 * Kubernetes binds this ClusterRole to the `system:authenticated` group out of the box, so
 * every authenticated user already holds it: binding a single user to it adds no privilege
 * and only makes the user appear in the cluster's RBAC records. It also means the binding
 * can never fail RBAC escalation prevention, since the operator necessarily holds it too.
 */
const DEFAULT_CLUSTER_ROLE = 'system:basic-user';
const DEFAULT_BINDING_SUFFIX = 'basic-user';

function nonEmptyEntries(values: string[]): string[] {
  return values.map(value => value.trim()).filter(value => value.length > 0);
}

/**
 * Normalizes a rule and rejects the ones Kubernetes would not accept.
 *
 * The core API group is named by the empty string, so a blank is meaningful in `apiGroups`
 * and is kept there, while it is only noise in the other lists.
 */
function checkedRule(rule: PolicyRuleInfo): PolicyRuleInfo {
  const apiGroups = rule.apiGroups.map(apiGroup => apiGroup.trim());
  const resources = nonEmptyEntries(rule.resources);
  const verbs = nonEmptyEntries(rule.verbs);
  const resourceNames = nonEmptyEntries(rule.resourceNames ?? []);
  if (resources.length === 0) {
    throw new Error('A rule needs at least one resource');
  }
  if (verbs.length === 0) {
    throw new Error('A rule needs at least one verb');
  }

  const checked: PolicyRuleInfo = {
    apiGroups: apiGroups.length > 0 ? apiGroups : [''],
    resources,
    verbs,
  };
  if (resourceNames.length > 0) {
    checked.resourceNames = resourceNames;
  }
  return checked;
}

@injectable()
export class IamManager implements IamApi {
  @inject(DashboardApiManager)
  private dashboardApiManager: DashboardApiManager;

  @inject(DashboardStatesManager)
  private dashboardStatesManager: DashboardStatesManager;

  @inject(KubeconfigGenerator)
  private kubeconfigGenerator: KubeconfigGenerator;

  @inject(TelemetryLoggerSymbol)
  private telemetryLogger: TelemetryLogger;

  async createRole(request: CreateRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('createRole');
    console.log('createRole', request.namespace, request.name);
    // TODO: delegate to Dashboard API once RBAC capabilities are available
  }

  async updateRole(request: CreateRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateRole');
    console.log('updateRole', request.namespace, request.name);
  }

  async deleteRole(namespace: string, name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteRole');
    console.log('deleteRole', namespace, name);
  }

  async createRoleBinding(request: CreateRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('createRoleBinding');
    console.log('createRoleBinding', request.namespace, request.name);
  }

  async updateRoleBinding(request: CreateRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateRoleBinding');
    console.log('updateRoleBinding', request.namespace, request.name);
  }

  async deleteRoleBinding(namespace: string, name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteRoleBinding');
    console.log('deleteRoleBinding', namespace, name);
  }

  async createClusterRole(request: CreateClusterRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('createClusterRole');
    console.log('createClusterRole', request.name);
  }

  async updateClusterRole(request: CreateClusterRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateClusterRole');
    console.log('updateClusterRole', request.name);
  }

  async deleteClusterRole(name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteClusterRole');
    console.log('deleteClusterRole', name);
  }

  async createClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('createClusterRoleBinding');
    await this.applyClusterRoleBinding(request);
  }

  async updateClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateClusterRoleBinding');
    console.log('updateClusterRoleBinding', request.name);
  }

  async deleteClusterRoleBinding(name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteClusterRoleBinding');
    console.log('deleteClusterRoleBinding', name);
  }

  async refreshRbacData(): Promise<void> {
    this.telemetryLogger.logUsage('refreshRbacData');
    // TODO: delegate to Dashboard API once RBAC capabilities are available
  }

  async createUser(request: CreateUserRequest): Promise<void> {
    this.telemetryLogger.logUsage('createUser');
    const username = this.checkedUsername(request.username);
    await this.applyClusterRoleBinding({
      name: toBindingName(username, DEFAULT_BINDING_SUFFIX),
      roleRef: { apiGroup: RBAC_API_GROUP, kind: 'ClusterRole', name: DEFAULT_CLUSTER_ROLE },
      subjects: [{ apiGroup: RBAC_API_GROUP, kind: 'User', name: username }],
    });
  }

  async createRoleForUser(request: CreateRoleForUserRequest): Promise<void> {
    this.telemetryLogger.logUsage('createRoleForUser');
    const username = this.checkedUsername(request.username);
    const name = request.name.trim();
    const namespace = request.namespace.trim();
    if (!isValidResourceName(name)) {
      throw new Error(`Invalid role name: ${request.name}`);
    }
    if (!isValidNamespaceName(namespace)) {
      throw new Error(`Invalid namespace: ${request.namespace}`);
    }
    // The role and its binding share the name, so both have to be free: applying over an
    // existing role would drop the rules it holds.
    const taken =
      this.dashboardStatesManager.getRoles().roles.some(r => r.namespace === namespace && r.name === name) ||
      this.dashboardStatesManager
        .getRoleBindings()
        .roleBindings.some(rb => rb.namespace === namespace && rb.name === name);
    if (taken) {
      throw new Error(`A role or role binding named ${name} already exists in namespace ${namespace}`);
    }

    await this.applyManifests([
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'Role',
        metadata: { name, namespace },
        rules: [],
      },
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'RoleBinding',
        metadata: { name, namespace },
        roleRef: { apiGroup: RBAC_API_GROUP, kind: 'Role', name },
        subjects: [{ apiGroup: RBAC_API_GROUP, kind: 'User', name: username }],
      },
    ]);
  }

  async createClusterRoleForUser(request: CreateClusterRoleForUserRequest): Promise<void> {
    this.telemetryLogger.logUsage('createClusterRoleForUser');
    const username = this.checkedUsername(request.username);
    const name = request.name.trim();
    if (!isValidResourceName(name)) {
      throw new Error(`Invalid cluster role name: ${request.name}`);
    }
    const taken =
      this.dashboardStatesManager.getClusterRoles().clusterRoles.some(r => r.name === name) ||
      this.dashboardStatesManager.getClusterRoleBindings().clusterRoleBindings.some(crb => crb.name === name);
    if (taken) {
      throw new Error(`A cluster role or cluster role binding named ${name} already exists`);
    }

    await this.applyManifests([
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'ClusterRole',
        metadata: { name },
        rules: [],
      },
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'ClusterRoleBinding',
        metadata: { name },
        roleRef: { apiGroup: RBAC_API_GROUP, kind: 'ClusterRole', name },
        subjects: [{ apiGroup: RBAC_API_GROUP, kind: 'User', name: username }],
      },
    ]);
  }

  async addRuleToRole(request: AddRoleRuleRequest): Promise<void> {
    this.telemetryLogger.logUsage('addRuleToRole');
    const name = request.name.trim();
    const namespace = request.namespace.trim();
    if (!isValidResourceName(name)) {
      throw new Error(`Invalid role name: ${request.name}`);
    }
    if (!isValidNamespaceName(namespace)) {
      throw new Error(`Invalid namespace: ${request.namespace}`);
    }
    const rule = checkedRule(request.rule);
    const role = this.dashboardStatesManager.getRoles().roles.find(r => r.namespace === namespace && r.name === name);
    if (!role) {
      throw new Error(`No role named ${name} in namespace ${namespace}`);
    }

    // The rules are applied as a whole: an apply carrying the new rule alone would drop
    // the rules the role already holds.
    await this.applyManifests([
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'Role',
        metadata: { name, namespace },
        rules: [...role.rules, rule],
      },
    ]);
  }

  async addRuleToClusterRole(request: AddClusterRoleRuleRequest): Promise<void> {
    this.telemetryLogger.logUsage('addRuleToClusterRole');
    const name = request.name.trim();
    if (!isValidResourceName(name)) {
      throw new Error(`Invalid cluster role name: ${request.name}`);
    }
    const rule = checkedRule(request.rule);
    const clusterRole = this.dashboardStatesManager.getClusterRoles().clusterRoles.find(r => r.name === name);
    if (!clusterRole) {
      throw new Error(`No cluster role named ${name}`);
    }

    await this.applyManifests([
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'ClusterRole',
        metadata: { name },
        rules: [...clusterRole.rules, rule],
      },
    ]);
  }

  private checkedUsername(username: string): string {
    const trimmed = username.trim();
    if (!isValidUsername(trimmed)) {
      throw new Error(`Invalid user name: ${username}`);
    }
    return trimmed;
  }

  private async applyClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void> {
    await this.applyManifests([
      {
        apiVersion: `${RBAC_API_GROUP}/v1`,
        kind: 'ClusterRoleBinding',
        metadata: { name: request.name },
        roleRef: request.roleRef,
        subjects: request.subjects,
      },
    ]);
  }

  /**
   * Applies the manifests as a single server-side apply request.
   *
   * They are built through the YAML serializer rather than a template so that user names
   * needing quoting or escaping cannot alter the shape of the documents.
   */
  private async applyManifests(manifests: object[]): Promise<void> {
    const documents = manifests.map(manifest => stringify(manifest)).join('---\n');
    await this.getApi().patchResources(documents, {
      strategy: 'server-side-apply',
      fieldManager: 'kubernetes-iam',
    });
  }

  private getApi(): KubernetesDashboardExtensionApi {
    const api = this.dashboardApiManager.getApi();
    if (!api) {
      throw new Error('Dashboard extension API not available');
    }
    return api;
  }

  async generateKubeconfig(request: GenerateKubeconfigRequest): Promise<void> {
    this.telemetryLogger.logUsage('generateKubeconfig');
    await this.kubeconfigGenerator.generate(request.username, request.expirationSeconds);
  }

  async getUserDetails(request: GetUserDetailsRequest): Promise<UserDetailsData> {
    this.telemetryLogger.logUsage('getUserDetails');
    const roles = this.dashboardStatesManager.getUserRoles(request.userName);
    const users = this.dashboardStatesManager.getUsers();
    const user = users.users.find(u => u.name === request.userName);
    return {
      name: request.userName,
      kind: user?.kind ?? 'User',
      apiGroup: user?.apiGroup,
      roles,
    };
  }
}
