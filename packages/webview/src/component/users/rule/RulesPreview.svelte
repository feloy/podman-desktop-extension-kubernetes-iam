<script lang="ts">
import { Expandable } from '@podman-desktop/ui-svelte';
import type { PolicyRuleInfo } from '@kubernetes-iam/channels';
import { formatRules } from './rule-builder';

interface Props {
  rules: PolicyRuleInfo[];
}

const { rules }: Props = $props();

const countLabel = $derived(rules.length === 1 ? '1 rule' : `${rules.length} rules`);
</script>

{#if rules.length > 0}
  <div class="flex flex-col gap-2">
    <Expandable expanded={true}>
      {#snippet title()}
        <span
          class="flex w-full flex-row items-center justify-between gap-2 text-sm font-medium text-(--pd-modal-text)">
          <span>YAML preview</span>
          <span>{countLabel}</span>
        </span>
      {/snippet}

      <pre class="overflow-x-auto rounded bg-(--pd-input-field-bg) p-3 text-xs text-(--pd-modal-text)">{formatRules(
          rules,
        )}</pre>
    </Expandable>
  </div>
{/if}
