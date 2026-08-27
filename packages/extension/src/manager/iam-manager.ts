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
  GenerateKubeconfigRequest,
  GetUserDetailsRequest,
  UserDetailsData,
} from '@kubernetes-iam/channels';
import { TelemetryLoggerSymbol } from '/@/inject/symbol';
import type { TelemetryLogger } from '@podman-desktop/api';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';
import { DashboardStatesManager } from '/@/manager/dashboard-states-manager';
import { KubeconfigGenerator } from '/@/manager/kubeconfig-generator';

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
    console.log('createClusterRoleBinding', request.name);
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

  async generateKubeconfig(request: GenerateKubeconfigRequest): Promise<void> {
    this.telemetryLogger.logUsage('generateKubeconfig');
    await this.kubeconfigGenerator.generate(request.username, request.expirationSeconds);
  }

  async getUserDetails(request: GetUserDetailsRequest): Promise<UserDetailsData> {
    this.telemetryLogger.logUsage('getUserDetails');
    // Users are derived from the bindings of the current context, so the stored entry
    // is the authoritative source for the context the user belongs to.
    const users = this.dashboardStatesManager.getUsers();
    const user = users.users.find(u => u.name === request.userName);
    const contextName = user?.contextName ?? '';
    const roles = this.dashboardStatesManager.getUserRoles(contextName, request.userName);
    return {
      contextName,
      name: request.userName,
      kind: user?.kind ?? 'User',
      apiGroup: user?.apiGroup,
      roles,
    };
  }
}
