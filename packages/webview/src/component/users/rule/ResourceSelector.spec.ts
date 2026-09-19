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
import ResourceSelector from './ResourceSelector.svelte';
import type { SelectableResource } from './rule-builder';

function selectable(
  group: string,
  resource: string,
  extra?: Partial<Pick<SelectableResource, 'namespaced' | 'verbs'>>,
): SelectableResource {
  return {
    key: `${group}/${resource}`,
    group,
    groupLabel: group === '' ? 'core' : group,
    resource,
    namespaced: extra?.namespaced ?? true,
    verbs: extra?.verbs ?? ['get', 'list', 'watch'],
    isSubresource: resource.includes('/'),
  };
}

const PODS = selectable('', 'pods');
const PODS_LOG = selectable('', 'pods/log');
const NODES = selectable('', 'nodes', { namespaced: false });
const DEPLOYMENTS = selectable('apps', 'deployments');

describe('ResourceSelector', () => {
  test('lists each resource as a checkbox named by the resource', () => {
    const onToggle = vi.fn();
    render(ResourceSelector, { resources: [PODS, DEPLOYMENTS], selected: [], onToggle });

    expect(screen.getByRole('checkbox', { name: 'pods' })).toBeDefined();
    expect(screen.getByRole('checkbox', { name: 'deployments' })).toBeDefined();
  });

  test('notifies when a resource is toggled', async () => {
    const onToggle = vi.fn();
    render(ResourceSelector, { resources: [PODS], selected: [], onToggle });

    await fireEvent.click(screen.getByRole('checkbox', { name: 'pods' }));

    expect(onToggle).toHaveBeenCalledWith('/pods');
  });

  test('narrows the list by the search box', async () => {
    render(ResourceSelector, { resources: [PODS, DEPLOYMENTS], selected: [], onToggle: vi.fn() });

    await fireEvent.input(screen.getByRole('textbox', { name: 'search resources' }), {
      target: { value: 'deploy' },
    });

    expect(screen.getByRole('checkbox', { name: 'deployments' })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: 'pods' })).toBeNull();
  });

  test('hides subresources until they are asked for', async () => {
    render(ResourceSelector, { resources: [PODS, PODS_LOG], selected: [], onToggle: vi.fn() });

    expect(screen.queryByRole('checkbox', { name: 'pods/log' })).toBeNull();

    await fireEvent.click(screen.getByRole('checkbox', { name: 'show subresources' }));

    expect(screen.getByRole('checkbox', { name: 'pods/log' })).toBeDefined();
  });

  test('narrows by API group through the dropdown', async () => {
    render(ResourceSelector, {
      resources: [PODS, NODES, DEPLOYMENTS],
      selected: [],
      onToggle: vi.fn(),
    });

    await fireEvent.click(screen.getByLabelText('API group').querySelector('button') as HTMLElement);
    await fireEvent.click(screen.getByRole('button', { name: 'apps' }));

    expect(screen.getByRole('checkbox', { name: 'deployments' })).toBeDefined();
    expect(screen.queryByRole('checkbox', { name: 'pods' })).toBeNull();
  });
});
