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
  RoleRefInfo,
  SubjectInfo,
  RevokeRoleFromUserRequest,
  RoleBindingInfo,
  ClusterRoleBindingInfo,
} from '@kubernetes-iam/channels';
import type { KubernetesDashboardExtensionApi } from '@podman-desktop/kubernetes-dashboard-extension-api';
import { TelemetryLoggerSymbol } from '/@/inject/symbol';
import type { TelemetryLogger } from '@podman-desktop/api';
import { window } from '@podman-desktop/api';
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

/** What the operator answered to the confirmation of a revocation. */
type RevocationChoice = 'cancel' | 'revoke' | 'delete-role';

/** What a revocation is about to change, as the confirmation message describes it. */
interface RevocationInfo {
  username: string;
  bindingKind: string;
  bindingName: string;
  roleRef: RoleRefInfo;
  /** The subjects the binding keeps, empty when the revocation deletes it. */
  remainingSubjects: SubjectInfo[];
  /** The namespace of the binding, unset for a cluster-wide one. */
  namespace: string | undefined;
  /** Whether the revocation leaves the role granted by no binding at all. */
  orphansRole: boolean;
}

/**
 * Names the subjects a binding still grants its role to, qualifying every kind but `User`
 * so that a group or a service account is not read as a user.
 */
function joinSubjects(subjects: SubjectInfo[]): string {
  const names = subjects.map(subject => {
    if (subject.kind === 'Group') {
      return `the group ${subject.name}`;
    }
    if (subject.kind === 'ServiceAccount') {
      // A service account is namespaced, so its namespace is part of its identity.
      const prefix = subject.namespace ? `${subject.namespace}/` : '';
      return `the service account ${prefix}${subject.name}`;
    }
    return subject.name;
  });
  if (names.length === 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Names the rules a role holds, or says they are unknown when the role could not be read. */
function describeRuleCount(ruleCount: number | undefined): string {
  if (ruleCount === undefined) {
    return 'rule count unknown';
  }
  return ruleCount === 1 ? '1 rule' : `${ruleCount} rules`;
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

  async revokeRoleFromUser(request: RevokeRoleFromUserRequest): Promise<void> {
    this.telemetryLogger.logUsage('revokeRoleFromUser');
    const username = this.checkedUsername(request.username);
    const name = request.bindingName.trim();
    if (!isValidResourceName(name)) {
      throw new Error(`Invalid binding name: ${request.bindingName}`);
    }
    const clusterScoped = request.bindingKind === 'ClusterRoleBinding';
    // A ClusterRoleBinding is cluster-wide, so only a RoleBinding is looked up by namespace.
    const namespace = clusterScoped ? undefined : (request.namespace ?? '').trim();
    if (namespace !== undefined && !isValidNamespaceName(namespace)) {
      throw new Error(`Invalid namespace: ${request.namespace}`);
    }
    const binding = this.findBinding(request.bindingKind, name, namespace);
    if (!binding) {
      const where = namespace ? ` in namespace ${namespace}` : '';
      throw new Error(`No ${request.bindingKind} named ${name}${where}`);
    }

    const remaining = binding.subjects.filter(subject => !(subject.kind === 'User' && subject.name === username));
    if (remaining.length === binding.subjects.length) {
      throw new Error(`The binding ${name} does not grant its role to ${username}`);
    }
    // Dropping the last subject would leave a binding granting the role to nobody, which
    // Kubernetes accepts but nothing needs, so the binding goes with it — and the role it
    // referenced may then be left with nothing granting it at all.
    const deletesBinding = remaining.length === 0;
    const orphansRole = deletesBinding && this.isRoleLeftUnused(binding.roleRef, request.bindingKind, name, namespace);

    const choice = await this.confirmRevocation({
      username,
      bindingKind: request.bindingKind,
      bindingName: name,
      roleRef: binding.roleRef,
      remainingSubjects: remaining,
      namespace,
      orphansRole,
    });
    if (choice === 'cancel') {
      return;
    }

    await this.keepSubjects(request.bindingKind, name, namespace, remaining);

    if (choice === 'delete-role') {
      await this.deleteRoleOfRef(binding.roleRef, namespace);
    }
  }

  /**
   * Reduces a binding to the given subjects, deleting it altogether when none is left: a
   * binding granting its role to nobody is one Kubernetes accepts but nothing needs.
   */
  private async keepSubjects(
    bindingKind: string,
    name: string,
    namespace: string | undefined,
    subjects: SubjectInfo[],
  ): Promise<void> {
    if (subjects.length === 0) {
      await this.getApi().deleteResource(bindingKind, name, namespace);
      return;
    }
    // The subjects are patched as a whole, the remaining ones replacing the list, which is
    // what drops the subject of the user. A server-side apply would instead claim the whole
    // list for this extension's field manager, and the API server refuses that while another
    // manager holds it, as it does for any binding written with kubectl. `roleRef` is left
    // out: the patch does not change it, and it is immutable.
    await this.patchManifest({
      apiVersion: `${RBAC_API_GROUP}/v1`,
      kind: bindingKind,
      metadata: namespace === undefined ? { name } : { name, namespace },
      subjects,
    });
  }

  /** Deletes the role a binding referenced, in the namespace it was reachable from. */
  private async deleteRoleOfRef(roleRef: RoleRefInfo, namespace: string | undefined): Promise<void> {
    // A Role lives in the namespace of the binding that referenced it, a ClusterRole in none.
    const roleNamespace = roleRef.kind === 'ClusterRole' ? undefined : namespace;
    await this.getApi().deleteResource(roleRef.kind, roleRef.name, roleNamespace);
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

  /**
   * Asks the operator to confirm a revocation.
   *
   * The question names the role, the user it is revoked from, and how many rules the role
   * holds, since those rules are the extent of what the grant gives. The rest of the message
   * says what the revocation touches: the binding, which is either narrowed to its other
   * subjects or deleted, and the role, which is only ever removed on an explicit Delete.
   * Dismissing the dialog answers `undefined`, which is a refusal like any other.
   */
  private async confirmRevocation(revocation: RevocationInfo): Promise<RevocationChoice> {
    const { username, bindingKind, bindingName, roleRef, remainingSubjects, namespace, orphansRole } = revocation;
    const rules = describeRuleCount(this.getRuleCount(roleRef, namespace));
    const binding = `${bindingKind} ${bindingName}`;
    let message = `Revoke ${roleRef.kind} ${roleRef.name} (${rules}) from ${username}?`;
    if (remainingSubjects.length > 0) {
      // The binding survives, so the operator is told the revocation stops at this user.
      message += ` ${binding} still grants it to ${joinSubjects(remainingSubjects)}.`;
      message += ` The ${roleRef.kind} itself is not modified.`;
    } else if (orphansRole) {
      message += ` ${binding} is deleted, as ${username} is its only subject, and nothing else grants the ${roleRef.kind}.`;
      message += ` Revoke leaves it in place but unused; Delete removes it as well.`;
    } else {
      message += ` ${binding} is deleted, as ${username} is its only subject.`;
      message += ` The ${roleRef.kind} itself is not modified, and other bindings still grant it.`;
    }

    const buttons = orphansRole ? ['Cancel', 'Revoke', 'Delete'] : ['Cancel', 'Revoke'];
    const answer = await window.showWarningMessage(message, ...buttons);
    if (answer === 'Delete') {
      return 'delete-role';
    }
    return answer === 'Revoke' ? 'revoke' : 'cancel';
  }

  /** The binding of that kind and name, or `undefined` when the cluster does not report it. */
  private findBinding(
    bindingKind: string,
    name: string,
    namespace: string | undefined,
  ): RoleBindingInfo | ClusterRoleBindingInfo | undefined {
    if (bindingKind === 'ClusterRoleBinding') {
      return this.dashboardStatesManager.getClusterRoleBindings().clusterRoleBindings.find(crb => crb.name === name);
    }
    return this.dashboardStatesManager
      .getRoleBindings()
      .roleBindings.find(rb => rb.namespace === namespace && rb.name === name);
  }

  /**
   * Whether deleting the given binding would leave its role granted by no binding at all.
   *
   * A Role is only reachable from a RoleBinding of its own namespace, while a ClusterRole is
   * reachable from any ClusterRoleBinding and from a RoleBinding of any namespace.
   */
  private isRoleLeftUnused(
    roleRef: RoleRefInfo,
    bindingKind: string,
    bindingName: string,
    namespace: string | undefined,
  ): boolean {
    // A built-in role is part of the cluster rather than of the user's setup, and Kubernetes
    // keeps granting it through bindings of its own, so it is never offered for deletion.
    if (roleRef.name.startsWith('system:')) {
      return false;
    }
    const grantedByRoleBinding = this.dashboardStatesManager.getRoleBindings().roleBindings.some(rb => {
      if (rb.roleRef.kind !== roleRef.kind || rb.roleRef.name !== roleRef.name) return false;
      // A Role is namespaced, so only the bindings of its own namespace reach it.
      if (roleRef.kind === 'Role' && rb.namespace !== namespace) return false;
      return !(bindingKind === 'RoleBinding' && rb.namespace === namespace && rb.name === bindingName);
    });
    if (grantedByRoleBinding) {
      return false;
    }
    if (roleRef.kind === 'Role') {
      // No ClusterRoleBinding can reference a Role, so nothing else is left to look at.
      return true;
    }
    return !this.dashboardStatesManager
      .getClusterRoleBindings()
      .clusterRoleBindings.some(
        crb => crb.roleRef.name === roleRef.name && !(bindingKind === 'ClusterRoleBinding' && crb.name === bindingName),
      );
  }

  /**
   * The number of rules of the role a binding references, or `undefined` when the cluster
   * does not report that role: a binding is allowed to reference a role that does not exist.
   */
  private getRuleCount(roleRef: RoleRefInfo, namespace?: string): number | undefined {
    if (roleRef.kind === 'ClusterRole') {
      return this.dashboardStatesManager.getClusterRoles().clusterRoles.find(r => r.name === roleRef.name)?.rules
        .length;
    }
    return this.dashboardStatesManager.getRoles().roles.find(r => r.namespace === namespace && r.name === roleRef.name)
      ?.rules.length;
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
  /**
   * Patches an existing resource with the fields the manifest carries, leaving the fields it
   * omits as they are. Unlike an apply, this claims no ownership of the fields it sets, so it
   * goes through whoever wrote the resource.
   */
  private async patchManifest(manifest: object): Promise<void> {
    await this.getApi().patchResources(stringify(manifest), {
      strategy: 'merge-patch',
      fieldManager: 'kubernetes-iam',
    });
  }

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
