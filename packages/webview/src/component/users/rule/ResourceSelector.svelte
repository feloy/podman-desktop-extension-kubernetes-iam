<script lang="ts">
import { Checkbox, Dropdown, SearchInput } from '@podman-desktop/ui-svelte';
import { filterResources, type SelectableResource } from './rule-builder';

/** Sentinel for the group dropdown: not a Kubernetes API group, so it cannot collide. */
const ALL_GROUPS = '__all__';

interface Props {
  resources: SelectableResource[];
  selected: string[];
  onToggle: (key: string) => void;
}

const { resources, selected, onToggle }: Props = $props();

let search = $state('');
let includeSubresources = $state(false);
let groupValue = $state(ALL_GROUPS);

const groupOptions = $derived.by(() => {
  const labels: { value: string; label: string }[] = [];
  for (const resource of resources) {
    if (labels.some(entry => entry.value === resource.group)) {
      continue;
    }
    labels.push({ value: resource.group, label: resource.groupLabel });
  }
  const sorted = [...labels].sort((left, right) => left.value.localeCompare(right.value));
  return [{ value: ALL_GROUPS, label: 'All groups' }, ...sorted];
});

const visible = $derived(
  filterResources(resources, {
    search,
    group: groupValue === ALL_GROUPS ? undefined : groupValue,
    includeSubresources,
    namespacedOnly: false,
  }),
);
</script>

<div class="flex flex-col gap-2">
  <p class="text-sm font-medium text-(--pd-modal-text)">Resources</p>
  <SearchInput title="resources" bind:searchTerm={search} />
  <div class="flex flex-row items-center gap-4">
    <Dropdown class="grow" ariaLabel="API group" options={groupOptions} bind:value={groupValue} />
    <Checkbox bind:checked={includeSubresources}>show subresources</Checkbox>
  </div>
  <div class="max-h-48 overflow-y-auto rounded border border-(--pd-input-field-stroke)">
    {#if visible.length === 0}
      <p class="px-3 py-2 text-sm text-(--pd-input-field-placeholder-text)">No resources match the filter.</p>
    {:else}
      {#each visible as resource (resource.key)}
        <Checkbox
          class="w-full px-1"
          title={resource.resource}
          checked={selected.includes(resource.key)}
          onclick={(): void => onToggle(resource.key)}>
          <span class="flex w-full flex-row items-center justify-between gap-4 py-0.5 text-sm text-(--pd-modal-text)">
            <span>{resource.resource}</span>
            <span class="text-(--pd-input-field-placeholder-text)">{resource.groupLabel}</span>
          </span>
        </Checkbox>
      {/each}
    {/if}
  </div>
</div>
