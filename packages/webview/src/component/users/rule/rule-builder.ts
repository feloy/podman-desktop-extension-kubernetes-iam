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

import type { ApiResourceInfo, ApiResourcesData, PolicyRuleInfo } from '@kubernetes-iam/channels';

/** A (group, resource) pair the user can select. `key` is `${group}/${resource}`. */
export interface SelectableResource {
  key: string;
  /** Empty string for the core group. */
  group: string;
  /** `core` when `group` is empty. */
  groupLabel: string;
  resource: string;
  namespaced: boolean;
  verbs: string[];
  isSubresource: boolean;
}

export interface VerbOption {
  verb: string;
  /** False when at least one selected resource does not support it. */
  supportedByAll: boolean;
}

export interface FilterResourcesOptions {
  search: string;
  group?: string;
  includeSubresources: boolean;
  namespacedOnly: boolean;
}

const CANONICAL_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', 'deletecollection'];
const CANONICAL_VERB_RANK = new Map(CANONICAL_VERBS.map((verb, index) => [verb, index]));

function groupLabel(group: string): string {
  return group === '' ? 'core' : group;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function sortVerbs(verbs: string[]): string[] {
  return [...verbs].sort((left, right) => {
    const leftRank = CANONICAL_VERB_RANK.get(left);
    const rightRank = CANONICAL_VERB_RANK.get(right);
    if (leftRank !== undefined && rightRank !== undefined) {
      return leftRank - rightRank;
    }
    if (leftRank !== undefined) {
      return -1;
    }
    if (rightRank !== undefined) {
      return 1;
    }
    return compareStrings(left, right);
  });
}

function toSelectable(resource: ApiResourceInfo): SelectableResource {
  return {
    key: `${resource.group}/${resource.resource}`,
    group: resource.group,
    groupLabel: groupLabel(resource.group),
    resource: resource.resource,
    namespaced: resource.namespaced,
    verbs: [...resource.verbs],
    isSubresource: resource.resource.includes('/'),
  };
}

export function toSelectableResources(data: ApiResourcesData): SelectableResource[] {
  return data.resources.map(toSelectable);
}

export function filterResources(all: SelectableResource[], opts: FilterResourcesOptions): SelectableResource[] {
  const search = opts.search.trim().toLowerCase();
  return all.filter(resource => {
    if (opts.namespacedOnly && !resource.namespaced) {
      return false;
    }
    if (!opts.includeSubresources && resource.isSubresource) {
      return false;
    }
    if (opts.group !== undefined && resource.group !== opts.group) {
      return false;
    }
    if (search.length === 0) {
      return true;
    }
    return resource.resource.toLowerCase().includes(search) || resource.groupLabel.toLowerCase().includes(search);
  });
}

export function verbOptions(selected: SelectableResource[]): VerbOption[] {
  const verbs = new Set<string>();
  for (const resource of selected) {
    for (const verb of resource.verbs) {
      verbs.add(verb);
    }
  }
  return sortVerbs([...verbs]).map(verb => ({
    verb,
    supportedByAll: selected.every(resource => resource.verbs.includes(verb)),
  }));
}

interface RuleBucket {
  group: string;
  verbs: string[];
  resourceNames: string[];
  resources: string[];
}

export function toPolicyRules(
  selected: SelectableResource[],
  verbs: string[],
  resourceNames: string[],
): PolicyRuleInfo[] {
  const names = [...resourceNames].sort(compareStrings);
  const buckets = new Map<string, RuleBucket>();
  for (const resource of selected) {
    const ruleVerbs = sortVerbs(verbs.filter(verb => resource.verbs.includes(verb)));
    if (ruleVerbs.length === 0) {
      continue;
    }
    // resourceNames is part of the key so a named grant is never merged with an unnamed one.
    const key = `${resource.group}|${ruleVerbs.join(',')}|${names.join(',')}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.resources.push(resource.resource);
    } else {
      buckets.set(key, {
        group: resource.group,
        verbs: ruleVerbs,
        resourceNames: names,
        resources: [resource.resource],
      });
    }
  }

  const rules: PolicyRuleInfo[] = [...buckets.values()].map(bucket => {
    const rule: PolicyRuleInfo = {
      apiGroups: [bucket.group],
      resources: [...new Set(bucket.resources)].sort(compareStrings),
      verbs: bucket.verbs,
    };
    if (bucket.resourceNames.length > 0) {
      rule.resourceNames = bucket.resourceNames;
    }
    return rule;
  });

  return [...rules].sort((left, right) => {
    return (
      compareStrings(left.apiGroups[0] ?? '', right.apiGroups[0] ?? '') ||
      compareStrings(left.verbs.join(','), right.verbs.join(',')) ||
      compareStrings(left.resources.join(','), right.resources.join(','))
    );
  });
}

function formatYamlList(values: string[]): string {
  return `[${values.map(value => JSON.stringify(value)).join(', ')}]`;
}

export function formatRules(rules: PolicyRuleInfo[]): string {
  return rules
    .map(rule => {
      const lines = [
        `- apiGroups: ${formatYamlList(rule.apiGroups)}`,
        `  resources: ${formatYamlList(rule.resources)}`,
        `  verbs: ${formatYamlList(rule.verbs)}`,
      ];
      if (rule.resourceNames && rule.resourceNames.length > 0) {
        lines.push(`  resourceNames: ${formatYamlList(rule.resourceNames)}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}
