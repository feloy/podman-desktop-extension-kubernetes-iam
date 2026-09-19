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
import ResourceNamesInput from './ResourceNamesInput.svelte';

describe('ResourceNamesInput', () => {
  test('adds a name when Enter is pressed', async () => {
    const onChange = vi.fn();
    render(ResourceNamesInput, { names: [], verbs: ['get'], onChange });

    await fireEvent.click(screen.getByRole('button', { name: 'Restrict to named resources' }));
    await fireEvent.input(screen.getByRole('textbox', { name: 'Resource names' }), { target: { value: 'my-pod' } });
    await fireEvent.keyPress(screen.getByRole('textbox', { name: 'Resource names' }), { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['my-pod']);
  });

  test('warns when collection verbs are combined with resource names', async () => {
    render(ResourceNamesInput, { names: ['my-pod'], verbs: ['get', 'list'], onChange: vi.fn() });

    await fireEvent.click(screen.getByRole('button', { name: 'Restrict to named resources' }));

    expect(
      screen.getByText(
        'Kubernetes ignores resourceNames for list, watch, create and deletecollection, granting them namespace-wide instead.',
      ),
    ).toBeDefined();
  });
});
