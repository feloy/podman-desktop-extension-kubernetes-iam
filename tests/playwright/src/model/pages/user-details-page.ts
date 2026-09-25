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

import { DetailsPage } from '@podman-desktop/tests-playwright';

export class UserDetailsPage extends DetailsPage {
  readonly addRoleButton: Locator;
  readonly addClusterRoleButton: Locator;
  readonly assignExistingRoleButton: Locator;

  constructor(page: Page, userName: string) {
    super(page, userName);
    this.addRoleButton = this.controlActions.getByRole('button', { name: 'Add role', exact: true });
    this.addClusterRoleButton = this.controlActions.getByRole('button', { name: 'Add cluster role' });
    this.assignExistingRoleButton = this.controlActions.getByRole('button', {
      name: 'Assign existing role',
      exact: true,
    });
  }

  getRoleRow(roleName: string): Locator {
    return this.page.getByRole('row', { name: roleName, exact: true });
  }

  getRuleRow(ruleName: string): Locator {
    return this.page.getByRole('row', { name: ruleName, exact: true });
  }

  getRuleRowForRole(roleName: string, ruleName: string): Locator {
    return this.getRoleRow(roleName).locator('..').getByRole('row', { name: ruleName, exact: true });
  }

  getRevokeRoleButton(roleName: string): Locator {
    return this.page.getByTitle(`Revoke ${roleName}`);
  }

  getAddRuleButton(roleName: string): Locator {
    return this.page.getByTitle(`Add rule to ${roleName}`);
  }

  getRemoveRuleButton(roleName: string, resource: string): Locator {
    return this.page.getByTitle(`Remove ${resource} rule from ${roleName}`);
  }
}
