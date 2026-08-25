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
} from '@kubernetes-iam/channels';
import { TelemetryLoggerSymbol } from '/@/inject/symbol';
import type { TelemetryLogger } from '@podman-desktop/api';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';

@injectable()
export class IamManager implements IamApi {
  @inject(DashboardApiManager)
  private dashboardApiManager: DashboardApiManager;

  @inject(TelemetryLoggerSymbol)
  private telemetryLogger: TelemetryLogger;

  async createRole(request: CreateRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('createRole');
    console.log('createRole', request.contextName, request.namespace, request.name);
    // TODO: delegate to Dashboard API once RBAC capabilities are available
  }

  async updateRole(request: CreateRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateRole');
    console.log('updateRole', request.contextName, request.namespace, request.name);
  }

  async deleteRole(contextName: string, namespace: string, name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteRole');
    console.log('deleteRole', contextName, namespace, name);
  }

  async createRoleBinding(request: CreateRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('createRoleBinding');
    console.log('createRoleBinding', request.contextName, request.namespace, request.name);
  }

  async updateRoleBinding(request: CreateRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateRoleBinding');
    console.log('updateRoleBinding', request.contextName, request.namespace, request.name);
  }

  async deleteRoleBinding(contextName: string, namespace: string, name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteRoleBinding');
    console.log('deleteRoleBinding', contextName, namespace, name);
  }

  async createClusterRole(request: CreateClusterRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('createClusterRole');
    console.log('createClusterRole', request.contextName, request.name);
  }

  async updateClusterRole(request: CreateClusterRoleRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateClusterRole');
    console.log('updateClusterRole', request.contextName, request.name);
  }

  async deleteClusterRole(contextName: string, name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteClusterRole');
    console.log('deleteClusterRole', contextName, name);
  }

  async createClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('createClusterRoleBinding');
    console.log('createClusterRoleBinding', request.contextName, request.name);
  }

  async updateClusterRoleBinding(request: CreateClusterRoleBindingRequest): Promise<void> {
    this.telemetryLogger.logUsage('updateClusterRoleBinding');
    console.log('updateClusterRoleBinding', request.contextName, request.name);
  }

  async deleteClusterRoleBinding(contextName: string, name: string): Promise<void> {
    this.telemetryLogger.logUsage('deleteClusterRoleBinding');
    console.log('deleteClusterRoleBinding', contextName, name);
  }

  async refreshRbacData(_contextName: string): Promise<void> {
    this.telemetryLogger.logUsage('refreshRbacData');
    // TODO: delegate to Dashboard API once RBAC capabilities are available
  }
}
