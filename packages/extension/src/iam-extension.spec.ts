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

import type { WebviewPanel, ExtensionContext } from '@podman-desktop/api';
import { Uri, window } from '@podman-desktop/api';
import { beforeEach, expect, test, vi } from 'vitest';
import { IamExtension } from '/@/iam-extension';
import { readFile } from 'node:fs/promises';

import { Dispatcher } from '/@/manager/dispatcher';

let extensionContextMock: ExtensionContext;
let iamExtension: IamExtension;

vi.mock(import('node:fs/promises'));
vi.mock(import('./manager/dispatcher'), () => {
  const DispatcherMock = vi.fn(
    class {
      constructor() {}
    } as unknown as typeof Dispatcher,
  );
  return { Dispatcher: DispatcherMock };
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();

  vi.mocked(window.createWebviewPanel).mockReturnValue({
    webview: {
      html: '',
      onDidReceiveMessage: vi.fn(),
      asWebviewUri: vi.fn(),
    },
    onDidChangeViewState: vi.fn(),
  } as unknown as WebviewPanel);
  vi.mocked(Uri.joinPath).mockReturnValue({ fsPath: '/path/to/extension/index.html' } as unknown as Uri);

  extensionContextMock = {
    subscriptions: [],
    extensionUri: {} as Uri,
  } as unknown as ExtensionContext;

  vi.mocked(readFile).mockResolvedValue('<html></html>');

  Dispatcher.prototype.init = vi.fn();

  iamExtension = new IamExtension(extensionContextMock);
});

test('should activate correctly and init dispatcher', async () => {
  await iamExtension.activate();
  expect(Dispatcher.prototype.init).toHaveBeenCalledOnce();
});

test('should deactivate correctly', async () => {
  await iamExtension.activate();
  const p = await iamExtension.deactivate();
  expect(p).toBeUndefined();
});
