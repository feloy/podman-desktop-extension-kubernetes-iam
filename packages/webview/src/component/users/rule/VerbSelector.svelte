<script lang="ts">
import { Checkbox } from '@podman-desktop/ui-svelte';
import type { VerbOption } from './rule-builder';

const VIEW_VERBS = ['get', 'list', 'watch'];
const EDIT_VERBS = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete', 'deletecollection'];

interface Props {
  available: VerbOption[];
  selected: string[];
  onToggle: (verb: string) => void;
  onReplace: (verbs: string[]) => void;
}

const { available, selected, onToggle, onReplace }: Props = $props();

function sameSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every(value => right.includes(value));
}

function presetOf(verbs: string[]): 'view' | 'edit' | 'custom' {
  if (sameSet(verbs, VIEW_VERBS)) {
    return 'view';
  }
  if (sameSet(verbs, EDIT_VERBS)) {
    return 'edit';
  }
  return 'custom';
}

const preset = $derived(presetOf(selected));
</script>

<fieldset class="flex flex-col gap-2 border-0 p-0">
  <legend class="text-sm font-medium text-(--pd-modal-text)">Verbs</legend>
  <div class="flex flex-row flex-wrap gap-4 text-sm text-(--pd-modal-text)">
    <label class="flex flex-row items-center gap-1">
      <input
        type="radio"
        name="verb-preset"
        value="view"
        checked={preset === 'view'}
        onchange={(): void => onReplace(VIEW_VERBS)} />
      View
    </label>
    <label class="flex flex-row items-center gap-1">
      <input
        type="radio"
        name="verb-preset"
        value="edit"
        checked={preset === 'edit'}
        onchange={(): void => onReplace(EDIT_VERBS)} />
      Edit
    </label>
    <label class="flex flex-row items-center gap-1">
      <input type="radio" name="verb-preset" value="custom" checked={preset === 'custom'} />
      Custom
    </label>
  </div>
  <div class="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
    {#each available as option (option.verb)}
      <Checkbox
        title={option.verb}
        checked={selected.includes(option.verb)}
        onclick={(): void => onToggle(option.verb)}>
        <span
          class="text-sm text-(--pd-modal-text)"
          class:opacity-60={!option.supportedByAll}
          title={option.supportedByAll ? undefined : 'Not supported by all selected resources'}>
          {option.verb}
        </span>
      </Checkbox>
    {/each}
  </div>
</fieldset>
