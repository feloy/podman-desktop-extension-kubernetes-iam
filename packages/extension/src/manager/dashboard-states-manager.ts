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

import { Disposable, extensions } from '@podman-desktop/api';
import type { KubernetesDashboardSubscriber } from '@podman-desktop/kubernetes-dashboard-extension-api';
import { inject, injectable } from 'inversify';
import { Emitter, Event } from '/@/types/emitter';
import { DashboardApiManager } from '/@/manager/dashboard-api-manager';
import type {
  RolesData,
  RoleBindingsData,
  ClusterRolesData,
  ClusterRoleBindingsData,
  UsersData,
} from '@kubernetes-iam/channels';
import {
  toRoleInfo,
  toClusterRoleInfo,
  toRoleBindingInfo,
  toClusterRoleBindingInfo,
  extractUniqueUsers,
} from '/@/manager/resource-transformers';

@injectable()
export class DashboardStatesManager implements Disposable {
  #onRolesChange = new Emitter<void>();
  onRolesChange: Event<void> = this.#onRolesChange.event;

  #onRoleBindingsChange = new Emitter<void>();
  onRoleBindingsChange: Event<void> = this.#onRoleBindingsChange.event;

  #onClusterRolesChange = new Emitter<void>();
  onClusterRolesChange: Event<void> = this.#onClusterRolesChange.event;

  #onClusterRoleBindingsChange = new Emitter<void>();
  onClusterRoleBindingsChange: Event<void> = this.#onClusterRoleBindingsChange.event;

  #onUsersChange = new Emitter<void>();
  onUsersChange: Event<void> = this.#onUsersChange.event;

  #subscriptions: Disposable[] = [];
  #subscriber: KubernetesDashboardSubscriber | undefined;

  #roles: RolesData = { roles: [] };
  #roleBindings: RoleBindingsData = { roleBindings: [] };
  #clusterRoles: ClusterRolesData = { clusterRoles: [] };
  #clusterRoleBindings: ClusterRoleBindingsData = { clusterRoleBindings: [] };
  #users: UsersData = { users: [] };

  @inject(DashboardApiManager)
  protected dashboardApiManager: DashboardApiManager;

  init(): void {
    const didChangeSubscription = extensions.onDidChange(() => {
      const api = this.dashboardApiManager.getApi();
      if (api) {
        this.#subscriber = api.getSubscriber();
        this.#subscriptions.push(this.#subscriber);
        didChangeSubscription.dispose();

        this.#subscriptions.push(
          this.#subscriber.onResourceUpdate({ resourceName: 'roles' }, event => {
            this.setRoles({
              roles: event.resources.flatMap(r => r.items.map(item => toRoleInfo(item, r.contextName ?? ''))),
            });
          }),
        );
        this.#subscriptions.push(
          this.#subscriber.onResourceUpdate({ resourceName: 'clusterroles' }, event => {
            this.setClusterRoles({
              clusterRoles: event.resources.flatMap(r =>
                r.items.map(item => toClusterRoleInfo(item, r.contextName ?? '')),
              ),
            });
          }),
        );
        this.#subscriptions.push(
          this.#subscriber.onResourceUpdate({ resourceName: 'rolebindings' }, event => {
            this.setRoleBindings({
              roleBindings: event.resources.flatMap(r =>
                r.items.map(item => toRoleBindingInfo(item, r.contextName ?? '')),
              ),
            });
          }),
        );
        this.#subscriptions.push(
          this.#subscriber.onResourceUpdate({ resourceName: 'clusterrolebindings' }, event => {
            this.setClusterRoleBindings({
              clusterRoleBindings: event.resources.flatMap(r =>
                r.items.map(item => toClusterRoleBindingInfo(item, r.contextName ?? '')),
              ),
            });
          }),
        );

        this.onRoleBindingsChange(() => this.#recomputeUsers());
        this.onClusterRoleBindingsChange(() => this.#recomputeUsers());
      }
    });
    this.#subscriptions.push(didChangeSubscription);
  }

  dispose(): void {
    for (const subscription of this.#subscriptions) {
      subscription.dispose();
    }
    this.#subscriptions = [];
  }

  getSubscriber(): KubernetesDashboardSubscriber | undefined {
    return this.#subscriber;
  }

  getRoles(): RolesData {
    return this.#roles;
  }

  setRoles(roles: RolesData): void {
    this.#roles = roles;
    this.#onRolesChange.fire();
  }

  getRoleBindings(): RoleBindingsData {
    return this.#roleBindings;
  }

  setRoleBindings(roleBindings: RoleBindingsData): void {
    this.#roleBindings = roleBindings;
    this.#onRoleBindingsChange.fire();
  }

  getClusterRoles(): ClusterRolesData {
    return this.#clusterRoles;
  }

  setClusterRoles(clusterRoles: ClusterRolesData): void {
    this.#clusterRoles = clusterRoles;
    this.#onClusterRolesChange.fire();
  }

  getClusterRoleBindings(): ClusterRoleBindingsData {
    return this.#clusterRoleBindings;
  }

  setClusterRoleBindings(clusterRoleBindings: ClusterRoleBindingsData): void {
    this.#clusterRoleBindings = clusterRoleBindings;
    this.#onClusterRoleBindingsChange.fire();
  }

  getUsers(): UsersData {
    return this.#users;
  }

  setUsers(users: UsersData): void {
    this.#users = users;
    this.#onUsersChange.fire();
  }

  #recomputeUsers(): void {
    this.setUsers({ users: extractUniqueUsers(this.#roleBindings, this.#clusterRoleBindings) });
  }
}
