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

import type { ExtensionContext } from '@podman-desktop/api';
import { beforeEach, expect, test, vi } from 'vitest';
import { activate, deactivate } from '/@/main';
import { IamExtension } from './iam-extension';

let extensionContextMock: ExtensionContext;

vi.mock(import('./iam-extension'));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();

  extensionContextMock = {} as ExtensionContext;
});

test('should initialize and activate the IAM Extension when activate is called', async () => {
  expect.assertions(1);

  await activate(extensionContextMock);

  expect(IamExtension.prototype.activate).toHaveBeenCalledWith();
});

test('should call deactivate when deactivate is called', async () => {
  expect.assertions(1);

  await activate(extensionContextMock);

  await deactivate();

  expect(IamExtension.prototype.deactivate).toHaveBeenCalledWith();
});

test('should not throw when deactivate is called without activate', async () => {
  await expect(deactivate()).resolves.toBeUndefined();
});
