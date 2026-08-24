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
import { StateRolesData } from './roles.svelte';
import { StateRoleBindingsData } from '/@/state/role-bindings.svelte';
import { StateClusterRolesData } from '/@/state/cluster-roles.svelte';
import { StateClusterRoleBindingsData } from '/@/state/cluster-role-bindings.svelte';

@injectable()
export class States {
  @inject(StateRolesData)
  private _stateRolesData: StateRolesData;

  get stateRolesData(): StateRolesData {
    return this._stateRolesData;
  }

  @inject(StateRoleBindingsData)
  private _stateRoleBindingsData: StateRoleBindingsData;

  get stateRoleBindingsData(): StateRoleBindingsData {
    return this._stateRoleBindingsData;
  }

  @inject(StateClusterRolesData)
  private _stateClusterRolesData: StateClusterRolesData;

  get stateClusterRolesData(): StateClusterRolesData {
    return this._stateClusterRolesData;
  }

  @inject(StateClusterRoleBindingsData)
  private _stateClusterRoleBindingsData: StateClusterRoleBindingsData;

  get stateClusterRoleBindingsData(): StateClusterRoleBindingsData {
    return this._stateClusterRoleBindingsData;
  }
}
