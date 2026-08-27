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

/** The role a row stands for, on the rows standing for a role rather than for one of its rules. */
export interface RoleRef {
  kind: string;
  name: string;
  /**
   * The namespace of the binding, which is also the namespace of the role when the role is
   * a Role. A ClusterRole bound through a namespaced binding carries one too, so the kind
   * is what tells a namespaced role from a cluster-wide one.
   */
  namespace?: string;
}

/**
 * A row of the roles table of a user.
 *
 * The table nests the rules of a role under it, so a row stands either for a role or for
 * one of its rules, and the four columns hold either set of values.
 */
export interface RoleRowUI {
  selected?: boolean;
  name: string;
  col2: string;
  col3: string;
  col4: string;
  children?: RoleRowUI[];
  /** Only set on the rows standing for a role, together with {@link onAddRule}. */
  role?: RoleRef;
  onAddRule?: () => void;
}
