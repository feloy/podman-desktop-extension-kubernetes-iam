<script lang="ts">
import type { PolicyRuleInfo } from '@kubernetes-iam/channels';
import { formatRules } from './rule-builder';

interface Props {
  rules: PolicyRuleInfo[];
}

const { rules }: Props = $props();

let expanded = $state(true);

const countLabel = $derived(rules.length === 1 ? '1 rule' : `${rules.length} rules`);
</script>

{#if rules.length > 0}
  <div class="flex flex-col gap-2">
    <button
      type="button"
      class="flex w-full flex-row items-center justify-between gap-2 text-sm font-medium text-(--pd-modal-text)"
      aria-expanded={expanded}
      onclick={(): void => {
        expanded = !expanded;
      }}>
      <span>YAML preview</span>
      <span>{countLabel}</span>
    </button>
    {#if expanded}
      <pre class="overflow-x-auto rounded bg-(--pd-input-field-bg) p-3 text-xs text-(--pd-modal-text)">{formatRules(
          rules,
        )}</pre>
    {/if}
  </div>
{/if}
