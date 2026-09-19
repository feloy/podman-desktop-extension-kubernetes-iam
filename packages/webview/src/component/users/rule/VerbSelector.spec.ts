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

import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import VerbSelector from './VerbSelector.svelte';
import type { VerbOption } from './rule-builder';

const AVAILABLE: VerbOption[] = [
  { verb: 'get', supportedByAll: true },
  { verb: 'list', supportedByAll: true },
  { verb: 'watch', supportedByAll: false },
  { verb: 'create', supportedByAll: true },
];

describe('VerbSelector', () => {
  test('applies the view preset as get, list and watch', async () => {
    const onReplace = vi.fn();
    render(VerbSelector, {
      available: AVAILABLE,
      selected: [],
      onToggle: vi.fn(),
      onReplace,
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'View' }));

    expect(onReplace).toHaveBeenCalledWith(['get', 'list', 'watch']);
  });

  test('applies the edit preset as the full mutating set', async () => {
    const onReplace = vi.fn();
    render(VerbSelector, {
      available: AVAILABLE,
      selected: ['get'],
      onToggle: vi.fn(),
      onReplace,
    });

    await fireEvent.click(screen.getByRole('radio', { name: 'Edit' }));

    expect(onReplace).toHaveBeenCalledWith([
      'get',
      'list',
      'watch',
      'create',
      'update',
      'patch',
      'delete',
      'deletecollection',
    ]);
  });

  test('toggles an individual verb', async () => {
    const onToggle = vi.fn();
    render(VerbSelector, {
      available: AVAILABLE,
      selected: ['get'],
      onToggle,
      onReplace: vi.fn(),
    });

    await fireEvent.click(screen.getByRole('checkbox', { name: 'list' }));

    expect(onToggle).toHaveBeenCalledWith('list');
  });

  test('marks the custom preset when the selection matches neither view nor edit', () => {
    render(VerbSelector, {
      available: AVAILABLE,
      selected: ['get'],
      onToggle: vi.fn(),
      onReplace: vi.fn(),
    });

    expect(screen.getByRole('radio', { name: 'Custom' })).toHaveProperty('checked', true);
  });
});
