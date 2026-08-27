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
import { isValidUsername, toBindingName } from './user-names';

const RFC_1123 = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/;

describe('isValidUsername', () => {
  test.each(['alice', 'alice@example.com', 'alice.bob', 'user_1', 'a-b', 'A1'])('accepts %s', username => {
    expect(isValidUsername(username)).toBe(true);
  });

  test.each(['', '.hidden', '-leading', '../bad-user', 'has space', 'system:admin', 'héloïse'])(
    'rejects %s',
    username => {
      expect(isValidUsername(username)).toBe(false);
    },
  );
});

describe('toBindingName', () => {
  test('produces an RFC 1123 name for a simple user name', () => {
    const name = toBindingName('alice', 'basic-user');
    expect(name).toMatch(RFC_1123);
    expect(name.startsWith('iam-alice-')).toBe(true);
    expect(name.endsWith('-basic-user')).toBe(true);
  });

  test('replaces characters that are invalid in a resource name', () => {
    const name = toBindingName('Alice@Example.com', 'basic-user');
    expect(name).toMatch(RFC_1123);
    expect(name).toContain('alice-example-com');
  });

  test('keeps user names that sanitize identically on distinct bindings', () => {
    expect(toBindingName('a@b', 'basic-user')).not.toBe(toBindingName('a-b', 'basic-user'));
  });

  test('is stable for the same user name', () => {
    expect(toBindingName('alice', 'basic-user')).toBe(toBindingName('alice', 'basic-user'));
  });

  test('stays within the 253 character limit for a long user name', () => {
    const name = toBindingName('a'.repeat(400), 'basic-user');
    expect(name.length).toBeLessThanOrEqual(253);
    expect(name).toMatch(RFC_1123);
  });

  test('still produces a valid name when nothing survives sanitizing', () => {
    const name = toBindingName('@@@', 'basic-user');
    expect(name).toMatch(RFC_1123);
    expect(name.startsWith('iam-')).toBe(true);
  });
});
