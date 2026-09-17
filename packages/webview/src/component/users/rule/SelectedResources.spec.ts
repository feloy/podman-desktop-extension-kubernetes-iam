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
import SelectedResources from './SelectedResources.svelte';
import type { SelectableResource } from './rule-builder';

function selectable(group: string, resource: string): SelectableResource {
  return {
    key: `${group}/${resource}`,
    group,
    groupLabel: group === '' ? 'core' : group,
    resource,
    namespaced: true,
    verbs: ['get'],
    isSubresource: false,
  };
}

describe('SelectedResources', () => {
  test('renders nothing when no resource is selected', () => {
    render(SelectedResources, { resources: [], onRemove: vi.fn() });

    expect(screen.queryByText(/Selected/)).toBeNull();
  });

  test('shows a chip for each selected resource and removes it on click', async () => {
    const onRemove = vi.fn();
    render(SelectedResources, {
      resources: [selectable('', 'pods'), selectable('apps', 'deployments')],
      onRemove,
    });

    expect(screen.getByText(/Selected · 2/)).toBeDefined();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove pods (core)' }));

    expect(onRemove).toHaveBeenCalledWith('/pods');
  });
});
