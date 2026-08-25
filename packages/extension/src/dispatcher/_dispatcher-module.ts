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

import { ContainerModule } from 'inversify';
import { DispatcherObject } from './util/dispatcher-object';
import { RolesDispatcher } from './roles-dispatcher';
import { RoleBindingsDispatcher } from '/@/dispatcher/role-bindings-dispatcher';
import { ClusterRolesDispatcher } from '/@/dispatcher/cluster-roles-dispatcher';
import { ClusterRoleBindingsDispatcher } from '/@/dispatcher/cluster-role-bindings-dispatcher';
import { UsersDispatcher } from '/@/dispatcher/users-dispatcher';

const dispatchersModule = new ContainerModule(options => {
  options.bind<RolesDispatcher>(RolesDispatcher).toSelf().inSingletonScope();
  options.bind(DispatcherObject).toService(RolesDispatcher);

  options.bind<RoleBindingsDispatcher>(RoleBindingsDispatcher).toSelf().inSingletonScope();
  options.bind(DispatcherObject).toService(RoleBindingsDispatcher);

  options.bind<ClusterRolesDispatcher>(ClusterRolesDispatcher).toSelf().inSingletonScope();
  options.bind(DispatcherObject).toService(ClusterRolesDispatcher);

  options.bind<ClusterRoleBindingsDispatcher>(ClusterRoleBindingsDispatcher).toSelf().inSingletonScope();
  options.bind(DispatcherObject).toService(ClusterRoleBindingsDispatcher);

  options.bind<UsersDispatcher>(UsersDispatcher).toSelf().inSingletonScope();
  options.bind(DispatcherObject).toService(UsersDispatcher);
});

export { dispatchersModule };
