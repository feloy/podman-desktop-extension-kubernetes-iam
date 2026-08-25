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
import {
  toRoleInfo,
  toClusterRoleInfo,
  toRoleBindingInfo,
  toClusterRoleBindingInfo,
  extractUniqueUsers,
} from './resource-transformers';
import type { KubernetesObject } from '@podman-desktop/kubernetes-dashboard-extension-api';

describe('toRoleInfo', () => {
  test('transforms a full role object', () => {
    const item: KubernetesObject = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'Role',
      metadata: {
        name: 'pod-reader',
        namespace: 'default',
        creationTimestamp: '2026-01-01T00:00:00Z',
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['pods'],
          verbs: ['get', 'list'],
        },
      ],
    };
    const result = toRoleInfo(item, 'ctx1');
    expect(result).toEqual({
      contextName: 'ctx1',
      namespace: 'default',
      name: 'pod-reader',
      creationTimestamp: '2026-01-01T00:00:00Z',
      rules: [
        {
          apiGroups: [''],
          resources: ['pods'],
          verbs: ['get', 'list'],
          resourceNames: undefined,
          nonResourceURLs: undefined,
        },
      ],
    });
  });

  test('handles missing metadata and rules', () => {
    const item: KubernetesObject = {};
    const result = toRoleInfo(item, 'ctx1');
    expect(result).toEqual({
      contextName: 'ctx1',
      namespace: '',
      name: '',
      creationTimestamp: undefined,
      rules: [],
    });
  });
});

describe('toClusterRoleInfo', () => {
  test('transforms a cluster role with aggregation rule', () => {
    const item: KubernetesObject = {
      metadata: { name: 'admin' },
      rules: [{ apiGroups: ['*'], resources: ['*'], verbs: ['*'] }],
      aggregationRule: {
        clusterRoleSelectors: [{ matchLabels: { 'rbac.example.com/aggregate-to-admin': 'true' } }],
      },
    };
    const result = toClusterRoleInfo(item, 'ctx1');
    expect(result.name).toBe('admin');
    expect(result.aggregationLabels).toEqual({ 'rbac.example.com/aggregate-to-admin': 'true' });
  });

  test('returns undefined aggregationLabels when no aggregation rule', () => {
    const item: KubernetesObject = {
      metadata: { name: 'view' },
      rules: [],
    };
    const result = toClusterRoleInfo(item, 'ctx1');
    expect(result.aggregationLabels).toBeUndefined();
  });
});

describe('toRoleBindingInfo', () => {
  test('transforms a role binding with subjects', () => {
    const item: KubernetesObject = {
      metadata: { name: 'read-pods', namespace: 'default' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
      subjects: [
        { kind: 'User', name: 'jane', apiGroup: 'rbac.authorization.k8s.io' },
        { kind: 'ServiceAccount', name: 'default', namespace: 'kube-system' },
      ],
    };
    const result = toRoleBindingInfo(item, 'ctx1');
    expect(result).toEqual({
      contextName: 'ctx1',
      namespace: 'default',
      name: 'read-pods',
      creationTimestamp: undefined,
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'Role', name: 'pod-reader' },
      subjects: [
        { kind: 'User', name: 'jane', apiGroup: 'rbac.authorization.k8s.io', namespace: undefined },
        { kind: 'ServiceAccount', name: 'default', namespace: 'kube-system', apiGroup: undefined },
      ],
    });
  });

  test('handles missing subjects', () => {
    const item: KubernetesObject = {
      metadata: { name: 'empty-binding', namespace: 'ns1' },
      roleRef: { apiGroup: '', kind: 'Role', name: 'role1' },
    };
    const result = toRoleBindingInfo(item, 'ctx1');
    expect(result.subjects).toEqual([]);
  });
});

describe('toClusterRoleBindingInfo', () => {
  test('transforms a cluster role binding', () => {
    const item: KubernetesObject = {
      metadata: { name: 'cluster-admin-binding', creationTimestamp: '2026-06-01T00:00:00Z' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' },
      subjects: [{ kind: 'Group', name: 'admins', apiGroup: 'rbac.authorization.k8s.io' }],
    };
    const result = toClusterRoleBindingInfo(item, 'ctx1');
    expect(result).toEqual({
      contextName: 'ctx1',
      name: 'cluster-admin-binding',
      creationTimestamp: '2026-06-01T00:00:00Z',
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'cluster-admin' },
      subjects: [{ kind: 'Group', name: 'admins', apiGroup: 'rbac.authorization.k8s.io', namespace: undefined }],
    });
  });
});

describe('extractUniqueUsers', () => {
  test('collects unique subjects from both binding types', () => {
    const roleBindings = {
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'default',
          name: 'rb1',
          roleRef: { apiGroup: '', kind: 'Role', name: 'role1' },
          subjects: [
            { kind: 'User', name: 'alice' },
            { kind: 'ServiceAccount', name: 'sa1', namespace: 'kube-system' },
          ],
        },
      ],
    };
    const clusterRoleBindings = {
      clusterRoleBindings: [
        {
          contextName: 'ctx1',
          name: 'crb1',
          roleRef: { apiGroup: '', kind: 'ClusterRole', name: 'cr1' },
          subjects: [
            { kind: 'User', name: 'alice' },
            { kind: 'Group', name: 'devs', apiGroup: 'rbac.authorization.k8s.io' },
          ],
        },
      ],
    };
    const users = extractUniqueUsers(roleBindings, clusterRoleBindings);
    expect(users).toHaveLength(3);
    expect(users).toEqual([
      { kind: 'User', name: 'alice', namespace: undefined, apiGroup: undefined },
      { kind: 'ServiceAccount', name: 'sa1', namespace: 'kube-system', apiGroup: undefined },
      { kind: 'Group', name: 'devs', namespace: undefined, apiGroup: 'rbac.authorization.k8s.io' },
    ]);
  });

  test('returns empty array when no bindings', () => {
    const users = extractUniqueUsers({ roleBindings: [] }, { clusterRoleBindings: [] });
    expect(users).toEqual([]);
  });

  test('treats same name with different namespace as different users', () => {
    const roleBindings = {
      roleBindings: [
        {
          contextName: 'ctx1',
          namespace: 'ns1',
          name: 'rb1',
          roleRef: { apiGroup: '', kind: 'Role', name: 'role1' },
          subjects: [
            { kind: 'ServiceAccount', name: 'sa1', namespace: 'ns1' },
            { kind: 'ServiceAccount', name: 'sa1', namespace: 'ns2' },
          ],
        },
      ],
    };
    const users = extractUniqueUsers(roleBindings, { clusterRoleBindings: [] });
    expect(users).toHaveLength(2);
  });
});
