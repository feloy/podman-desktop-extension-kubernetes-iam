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
import { isValidNamespaceName, isValidResourceName } from './resource-names';

describe('isValidResourceName', () => {
  test.each(['pod-reader', 'a', 'a.b.c', 'role1', '1role'])('accepts %s', name => {
    expect(isValidResourceName(name)).toBe(true);
  });

  test.each(['', 'Pod-Reader', '-leading', 'trailing-', 'has space', 'system:admin', '../escape'])(
    'rejects %s',
    name => {
      expect(isValidResourceName(name)).toBe(false);
    },
  );

  test('rejects a name longer than 253 characters', () => {
    expect(isValidResourceName('a'.repeat(253))).toBe(true);
    expect(isValidResourceName('a'.repeat(254))).toBe(false);
  });
});

describe('isValidNamespaceName', () => {
  test.each(['default', 'kube-system', 'ns1'])('accepts %s', namespace => {
    expect(isValidNamespaceName(namespace)).toBe(true);
  });

  test.each(['', 'with.dot', 'Default', '-leading', 'has space'])('rejects %s', namespace => {
    expect(isValidNamespaceName(namespace)).toBe(false);
  });

  test('rejects a namespace longer than 63 characters', () => {
    expect(isValidNamespaceName('a'.repeat(63))).toBe(true);
    expect(isValidNamespaceName('a'.repeat(64))).toBe(false);
  });
});
