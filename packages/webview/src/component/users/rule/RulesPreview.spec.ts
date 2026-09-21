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
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import RulesPreview from './RulesPreview.svelte';

describe('RulesPreview', () => {
  test('renders nothing when there are no rules', () => {
    render(RulesPreview, { rules: [] });

    expect(screen.queryByText('YAML preview')).toBeNull();
  });

  test('shows how many rules will be applied and the YAML they will become', () => {
    render(RulesPreview, {
      rules: [
        { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] },
        { apiGroups: ['apps'], resources: ['deployments'], verbs: ['get', 'list', 'watch'] },
      ],
    });

    expect(screen.getByText('2 rules')).toBeDefined();
    expect(screen.getByText(/apiGroups: \[""]/)).toBeDefined();
    expect(screen.getByText(/resources: \["deployments"]/)).toBeDefined();
  });
});
