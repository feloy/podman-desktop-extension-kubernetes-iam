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

import type { Locator, Page } from '@playwright/test';

import { MainPage } from '@podman-desktop/tests-playwright';

import { UserDetailsPage } from './user-details-page';

export class UsersPage extends MainPage {
  readonly createUserButton: Locator;

  constructor(page: Page) {
    super(page, 'Users');
    this.createUserButton = this.additionalActions.getByRole('button', {
      name: 'Create user',
    });
  }

  getUserButton(userName: string): Locator {
    return this.page.getByRole('button', { name: userName, exact: true });
  }

  async openUser(userName: string): Promise<UserDetailsPage> {
    await this.getUserButton(userName).click();
    return new UserDetailsPage(this.page, userName);
  }
}
