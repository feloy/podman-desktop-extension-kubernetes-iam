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

import type { KubernetesObject } from '@podman-desktop/kubernetes-dashboard-extension-api';
import type {
  RoleInfo,
  PolicyRuleInfo,
  ClusterRoleInfo,
  RoleBindingInfo,
  RoleRefInfo,
  SubjectInfo,
  ClusterRoleBindingInfo,
  UserInfo,
  RoleBindingsData,
  ClusterRoleBindingsData,
} from '@kubernetes-iam/channels';

function toRules(item: KubernetesObject): PolicyRuleInfo[] {
  const rules = item['rules'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(rules)) return [];
  return rules.map(rule => ({
    apiGroups: (rule['apiGroups'] as string[]) ?? [],
    resources: (rule['resources'] as string[]) ?? [],
    verbs: (rule['verbs'] as string[]) ?? [],
    resourceNames: rule['resourceNames'] as string[] | undefined,
    nonResourceURLs: rule['nonResourceURLs'] as string[] | undefined,
  }));
}

function toRoleRef(item: KubernetesObject): RoleRefInfo {
  const ref = (item['roleRef'] as Record<string, unknown>) ?? {};
  return {
    apiGroup: (ref['apiGroup'] as string) ?? '',
    kind: (ref['kind'] as string) ?? '',
    name: (ref['name'] as string) ?? '',
  };
}

function toSubjects(item: KubernetesObject): SubjectInfo[] {
  const subjects = item['subjects'] as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(subjects)) return [];
  return subjects.map(s => ({
    kind: (s['kind'] as string) ?? '',
    name: (s['name'] as string) ?? '',
    namespace: s['namespace'] as string | undefined,
    apiGroup: s['apiGroup'] as string | undefined,
  }));
}

export function toRoleInfo(item: KubernetesObject): RoleInfo {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    namespace: (metadata['namespace'] as string) ?? '',
    name: (metadata['name'] as string) ?? '',
    creationTimestamp: metadata['creationTimestamp'] as string | undefined,
    rules: toRules(item),
  };
}

export function toClusterRoleInfo(item: KubernetesObject): ClusterRoleInfo {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const aggregationRule = item['aggregationRule'] as Record<string, unknown> | undefined;
  let aggregationLabels: Record<string, string> | undefined;
  if (aggregationRule) {
    const selectors = aggregationRule['clusterRoleSelectors'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(selectors)) {
      aggregationLabels = {};
      for (const selector of selectors) {
        const matchLabels = selector['matchLabels'] as Record<string, string> | undefined;
        if (matchLabels) {
          Object.assign(aggregationLabels, matchLabels);
        }
      }
    }
  }
  return {
    name: (metadata['name'] as string) ?? '',
    creationTimestamp: metadata['creationTimestamp'] as string | undefined,
    rules: toRules(item),
    aggregationLabels,
  };
}

export function toRoleBindingInfo(item: KubernetesObject): RoleBindingInfo {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    namespace: (metadata['namespace'] as string) ?? '',
    name: (metadata['name'] as string) ?? '',
    creationTimestamp: metadata['creationTimestamp'] as string | undefined,
    roleRef: toRoleRef(item),
    subjects: toSubjects(item),
  };
}

export function toClusterRoleBindingInfo(item: KubernetesObject): ClusterRoleBindingInfo {
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  return {
    name: (metadata['name'] as string) ?? '',
    creationTimestamp: metadata['creationTimestamp'] as string | undefined,
    roleRef: toRoleRef(item),
    subjects: toSubjects(item),
  };
}

export function extractUniqueUsers(
  roleBindings: RoleBindingsData,
  clusterRoleBindings: ClusterRoleBindingsData,
): UserInfo[] {
  const seen = new Set<string>();
  const users: UserInfo[] = [];

  const addSubjects = (subjects: SubjectInfo[]): void => {
    for (const s of subjects) {
      if (s.kind !== 'User') continue;
      const key = [s.kind, s.name, s.apiGroup ?? ''].join('\0');
      if (!seen.has(key)) {
        seen.add(key);
        users.push({
          kind: s.kind,
          name: s.name,
          apiGroup: s.apiGroup,
        });
      }
    }
  };

  for (const rb of roleBindings.roleBindings) {
    addSubjects(rb.subjects);
  }
  for (const crb of clusterRoleBindings.clusterRoleBindings) {
    addSubjects(crb.subjects);
  }

  return users;
}
