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

import { describe, expect, test } from 'vitest';
import type { ApiResourceInfo, ApiResourcesData } from '@kubernetes-iam/channels';
import {
  filterResources,
  formatRules,
  toPolicyRules,
  toSelectableResources,
  verbOptions,
  type SelectableResource,
} from './rule-builder';

function info(group: string, resource: string, extra?: Partial<ApiResourceInfo>): ApiResourceInfo {
  return {
    group,
    resource,
    kind: extra?.kind ?? resource,
    namespaced: extra?.namespaced ?? true,
    verbs: extra?.verbs ?? ['get', 'list', 'watch'],
  };
}

function data(...resources: ApiResourceInfo[]): ApiResourcesData {
  return { status: 'loaded', resources };
}

function selectable(
  group: string,
  resource: string,
  extra?: Partial<Pick<SelectableResource, 'namespaced' | 'verbs'>>,
): SelectableResource {
  return {
    key: `${group}/${resource}`,
    group,
    groupLabel: group === '' ? 'core' : group,
    resource,
    namespaced: extra?.namespaced ?? true,
    verbs: extra?.verbs ?? ['get', 'list', 'watch'],
    isSubresource: resource.includes('/'),
  };
}

const PODS = selectable('', 'pods');
const NODES = selectable('', 'nodes', { namespaced: false });
const DEPLOYMENTS = selectable('apps', 'deployments');
const PODS_LOG = selectable('', 'pods/log');

describe('toSelectableResources', () => {
  test('maps core as an empty group with label core', () => {
    expect(toSelectableResources(data(info('', 'pods', { kind: 'Pod' })))).toEqual([
      {
        key: '/pods',
        group: '',
        groupLabel: 'core',
        resource: 'pods',
        namespaced: true,
        verbs: ['get', 'list', 'watch'],
        isSubresource: false,
      },
    ]);
  });

  test('marks a name with a slash as a subresource', () => {
    expect(toSelectableResources(data(info('', 'pods/log')))[0]?.isSubresource).toBe(true);
  });
});

describe('filterResources', () => {
  const all = [PODS, PODS_LOG, NODES, DEPLOYMENTS];

  test('narrows by search on the resource name', () => {
    expect(
      filterResources(all, {
        search: 'deploy',
        group: undefined,
        includeSubresources: false,
        namespacedOnly: false,
      }).map(resource => resource.resource),
    ).toEqual(['deployments']);
  });

  test('narrows by API group, including the core group', () => {
    expect(
      filterResources(all, { search: '', group: '', includeSubresources: true, namespacedOnly: false }).map(
        resource => resource.resource,
      ),
    ).toEqual(['pods', 'pods/log', 'nodes']);
  });

  test('hides subresources unless they are asked for', () => {
    expect(
      filterResources(all, { search: '', includeSubresources: false, namespacedOnly: false }).map(
        resource => resource.resource,
      ),
    ).toEqual(['pods', 'nodes', 'deployments']);
  });

  test('hides cluster-scoped resources when namespacedOnly is set', () => {
    expect(
      filterResources(all, { search: '', includeSubresources: true, namespacedOnly: true }).map(
        resource => resource.resource,
      ),
    ).toEqual(['pods', 'pods/log', 'deployments']);
  });
});

describe('verbOptions', () => {
  test('unions verbs and flags those not served by every selected resource', () => {
    const options = verbOptions([
      selectable('', 'pods', { verbs: ['get', 'list', 'watch'] }),
      selectable('apps', 'deployments', { verbs: ['get', 'patch'] }),
    ]);
    expect(options).toEqual([
      { verb: 'get', supportedByAll: true },
      { verb: 'list', supportedByAll: false },
      { verb: 'watch', supportedByAll: false },
      { verb: 'patch', supportedByAll: false },
    ]);
  });

  test('orders non-canonical verbs after the Kubernetes set', () => {
    expect(
      verbOptions([selectable('', 'pods', { verbs: ['proxy', 'get', 'delete'] })]).map(option => option.verb),
    ).toEqual(['get', 'delete', 'proxy']);
  });
});

describe('toPolicyRules', () => {
  test('emits one rule per API group and never merges across groups', () => {
    expect(toPolicyRules([PODS, DEPLOYMENTS], ['get', 'list'], [])).toEqual([
      { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] },
      { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list'] },
    ]);
  });

  test('keeps the same resource name in two groups as two rules', () => {
    const k8sApp = selectable('app.k8s.io', 'applications');
    const argoApp = selectable('argoproj.io', 'applications');
    expect(toPolicyRules([k8sApp, argoApp], ['get'], [])).toEqual([
      { apiGroups: ['app.k8s.io'], resources: ['applications'], verbs: ['get'] },
      { apiGroups: ['argoproj.io'], resources: ['applications'], verbs: ['get'] },
    ]);
  });

  test('splits a group when verb intersections differ', () => {
    const pods = selectable('', 'pods', { verbs: ['get', 'list'] });
    const events = selectable('', 'events', { verbs: ['get'] });
    expect(toPolicyRules([pods, events], ['get', 'list'], [])).toEqual([
      { apiGroups: [''], resources: ['events'], verbs: ['get'] },
      { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] },
    ]);
  });

  test('skips a resource that serves none of the chosen verbs', () => {
    const secrets = selectable('', 'secrets', { verbs: ['get'] });
    expect(toPolicyRules([PODS, secrets], ['list'], [])).toEqual([
      { apiGroups: [''], resources: ['pods'], verbs: ['list'] },
    ]);
  });

  test('puts resourceNames on every emitted rule so a named grant is its own bucket', () => {
    expect(toPolicyRules([PODS, DEPLOYMENTS], ['get'], ['my-pod'])).toEqual([
      { apiGroups: [''], resources: ['pods'], verbs: ['get'], resourceNames: ['my-pod'] },
      { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get'], resourceNames: ['my-pod'] },
    ]);
  });

  test('merges resources of the same group that share a verb intersection', () => {
    const services = selectable('', 'services');
    expect(toPolicyRules([PODS, services], ['get'], [])).toEqual([
      { apiGroups: [''], resources: ['pods', 'services'], verbs: ['get'] },
    ]);
  });
});

describe('formatRules', () => {
  test('renders YAML the preview and the applied manifest can agree on', () => {
    expect(
      formatRules([
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] },
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch'] },
      ]),
    ).toBe(`- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments"]
  verbs: ["get", "list", "watch"]`);
  });
});
