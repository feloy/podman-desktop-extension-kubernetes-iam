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

import type { Page } from '@playwright/test';
import type { NavigationBar, Runner } from '@podman-desktop/tests-playwright';
import { expect as playExpect } from '@podman-desktop/tests-playwright';

export async function handleWebview(runner: Runner, page: Page, navigationBar: NavigationBar): Promise<[Page, Page]> {
  const NAVBAR_EXTENSION_LABEL: string = 'Kubernetes IAM';
  const PAGE_BODY_LABEL: string = `Webview ${NAVBAR_EXTENSION_LABEL}`;

  const navButton = navigationBar.navigationLocator.getByRole('link', {
    name: NAVBAR_EXTENSION_LABEL,
    exact: true,
  });
  await playExpect(navButton).toBeEnabled();
  await navButton.click();
  await page.waitForTimeout(2_000);

  const webView = page.getByRole('document', { name: PAGE_BODY_LABEL });
  await playExpect(webView).toBeVisible();
  await new Promise(resolve => setTimeout(resolve, 1_000));

  const windows = runner.getWindows();
  const mainPage = windows[0];
  if (!mainPage) {
    throw new Error('Podman Desktop main window was not found');
  }

  await mainPage.evaluate(label => {
    const container = document.querySelector(`[aria-label="${label}"]`);
    const element = container?.querySelector('webview') ?? document.querySelector('webview');
    if (element) {
      (element as HTMLElement).focus();
    } else {
      console.log(`element is null`);
    }
  }, PAGE_BODY_LABEL);

  // Dashboard also creates a webview, so pick the window that hosts the IAM Users page.
  let webViewPage = windows.at(-1);
  for (const candidate of windows.slice(1)) {
    if ((await candidate.getByRole('heading', { name: 'Users' }).count()) > 0) {
      webViewPage = candidate;
      break;
    }
  }
  if (!webViewPage) {
    throw new Error('Kubernetes IAM webview window was not found');
  }

  return [mainPage, webViewPage];
}
