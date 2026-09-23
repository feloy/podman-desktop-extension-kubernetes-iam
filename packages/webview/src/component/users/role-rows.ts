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

import type { UserRolePolicyRule } from '@kubernetes-iam/channels';
import type { RoleRowUI } from './RoleRowUI';

/**
 * A Kubernetes PolicyRule is either a resource rule or a non-resource URL rule, never both.
 * Empty apiGroups/resources must not be shown as `*` on a non-resource rule: that is how
 * cluster-admin's second rule would look like another `*.*` grant.
 */
export function toRuleChildRow(rule: UserRolePolicyRule, onRemoveRule?: () => void): RoleRowUI {
  const actions = onRemoveRule === undefined ? {} : { onRemoveRule };
  if (rule.nonResourceURLs && rule.nonResourceURLs.length > 0) {
    return {
      name: 'non-resource',
      col2: rule.nonResourceURLs.join(', '),
      col3: rule.verbs.join(', '),
      col4: '',
      ...actions,
    };
  }
  return {
    name: rule.apiGroups.map(g => (g === '' ? 'core' : g)).join(', ') || '*',
    col2: rule.resources.join(', ') || '*',
    col3: rule.verbs.join(', '),
    col4: rule.resourceNames?.join(', ') ?? '',
    ...actions,
  };
}
