<script lang="ts">
import type { SelectableResource } from './rule-builder';

interface Props {
  resources: SelectableResource[];
  onRemove: (key: string) => void;
}

const { resources, onRemove }: Props = $props();
</script>

{#if resources.length > 0}
  <div class="flex flex-col gap-2">
    <p class="text-sm font-medium text-(--pd-modal-text)">Selected · {resources.length}</p>
    <div class="flex flex-row flex-wrap gap-2">
      {#each resources as resource (resource.key)}
        <span
          class="flex flex-row items-center gap-1 rounded-full border border-(--pd-input-field-stroke) px-2 py-1 text-xs text-(--pd-modal-text)">
          {resource.resource} · {resource.groupLabel}
          <button
            type="button"
            class="cursor-pointer px-0.5"
            aria-label="Remove {resource.resource} ({resource.groupLabel})"
            onclick={(): void => onRemove(resource.key)}>
            ✕
          </button>
        </span>
      {/each}
    </div>
  </div>
{:else}
  <p class="text-sm text-(--pd-input-field-placeholder-text)">No resource selected.</p>
{/if}
