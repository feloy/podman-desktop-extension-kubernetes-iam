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
import { toRuleChildRow } from './role-rows';

describe('toRuleChildRow', () => {
  test('renders a resource rule with the core API group as core', () => {
    expect(
      toRuleChildRow({
        apiGroups: [''],
        resources: ['pods'],
        verbs: ['get', 'list'],
        resourceNames: ['my-pod'],
      }),
    ).toEqual({
      name: 'core',
      col2: 'pods',
      col3: 'get, list',
      col4: 'my-pod',
    });
  });

  test('renders a wildcard resource rule as * in groups and resources', () => {
    expect(
      toRuleChildRow({
        apiGroups: ['*'],
        resources: ['*'],
        verbs: ['*'],
      }),
    ).toEqual({
      name: '*',
      col2: '*',
      col3: '*',
      col4: '',
    });
  });

  test('renders a non-resource rule by its URLs instead of falling back to *', () => {
    expect(
      toRuleChildRow({
        apiGroups: [],
        resources: [],
        verbs: ['*'],
        nonResourceURLs: ['*'],
      }),
    ).toEqual({
      name: 'non-resource',
      col2: '*',
      col3: '*',
      col4: '',
    });
  });

  test('joins several non-resource URLs', () => {
    expect(
      toRuleChildRow({
        apiGroups: [],
        resources: [],
        verbs: ['get'],
        nonResourceURLs: ['/healthz', '/metrics'],
      }),
    ).toEqual({
      name: 'non-resource',
      col2: '/healthz, /metrics',
      col3: 'get',
      col4: '',
    });
  });

  test('treats an empty nonResourceURLs list as a resource rule', () => {
    expect(
      toRuleChildRow({
        apiGroups: ['apps'],
        resources: ['deployments'],
        verbs: ['get'],
        nonResourceURLs: [],
      }),
    ).toEqual({
      name: 'apps',
      col2: 'deployments',
      col3: 'get',
      col4: '',
    });
  });
});
