<script lang="ts">
import { Expandable, Input } from '@podman-desktop/ui-svelte';

/** Kubernetes ignores resourceNames for these and grants them namespace-wide instead. */
const COLLECTION_VERBS = ['list', 'watch', 'create', 'deletecollection'];

interface Props {
  names: string[];
  onChange: (names: string[]) => void;
  verbs: string[];
}

const { names, onChange, verbs }: Props = $props();

let draft = $state('');
const showCaveat = $derived(names.length > 0 && verbs.some(verb => COLLECTION_VERBS.includes(verb)));

function addName(): void {
  const name = draft.trim();
  draft = '';
  if (name.length === 0 || names.includes(name)) {
    return;
  }
  onChange([...names, name]);
}

function onKeypress(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addName();
  }
}
</script>

<div class="flex flex-col gap-2">
  <Expandable expanded={false}>
    {#snippet title()}
      <span class="text-sm font-medium text-(--pd-modal-text)">Restrict to named resources</span>
    {/snippet}

    <div class="flex flex-col gap-2">
      <Input aria-label="Resource names" placeholder="e.g. pod-a, pod-b" bind:value={draft} onkeypress={onKeypress} />
      <p class="text-xs text-(--pd-input-field-placeholder-text)">Press Enter or comma to add each name below.</p>
      {#if names.length > 0}
        <div class="flex flex-row flex-wrap gap-2">
          {#each names as name (name)}
            <span
              class="flex flex-row items-center gap-1 rounded-full border border-(--pd-input-field-stroke) px-2 py-1 text-xs text-(--pd-modal-text)">
              {name}
              <button
                type="button"
                class="cursor-pointer px-0.5"
                aria-label="Remove name {name}"
                onclick={(): void => onChange(names.filter(entry => entry !== name))}>
                ✕
              </button>
            </span>
          {/each}
        </div>
      {/if}
      {#if showCaveat}
        <p class="text-xs text-(--pd-input-field-placeholder-text)">
          Kubernetes ignores resourceNames for list, watch, create and deletecollection, granting them namespace-wide
          instead.
        </p>
      {/if}
    </div>
  </Expandable>
</div>
