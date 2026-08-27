<script lang="ts">
import { Button, ErrorMessage, Input, Modal } from '@podman-desktop/ui-svelte';
import { getContext } from 'svelte';
import { Remote } from '/@/remote/remote';
import { API_IAM } from '@kubernetes-iam/channels';
import type { IamApi, PolicyRuleInfo } from '@kubernetes-iam/channels';
import type { RoleRef } from './RoleRowUI';

interface Props {
  role: RoleRef;
  onclose: () => void;
}

const { role, onclose }: Props = $props();
const remote = getContext<Remote>(Remote);

let apiGroups = $state('');
let resources = $state('');
let verbs = $state('');
let resourceNames = $state('');
let adding = $state(false);
let error: string | undefined = $state(undefined);

/** Splits a comma or space separated list, dropping the blanks left by the separators. */
function toList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

const parsedResources = $derived(toList(resources));
const parsedVerbs = $derived(toList(verbs));
const canAdd = $derived(parsedResources.length > 0 && parsedVerbs.length > 0 && !adding);

/** The core API group is named by the empty string, which the table displays as `core`. */
function toApiGroups(value: string): string[] {
  const groups = toList(value).map(group => (group === 'core' ? '' : group));
  return groups.length > 0 ? groups : [''];
}

async function onAdd(): Promise<void> {
  if (!canAdd) return;
  adding = true;
  error = undefined;
  const rule: PolicyRuleInfo = {
    apiGroups: toApiGroups(apiGroups),
    resources: parsedResources,
    verbs: parsedVerbs,
    resourceNames: toList(resourceNames),
  };
  try {
    const iamApi = remote.getProxy<IamApi>(API_IAM);
    // A cluster role bound through a namespaced binding carries the namespace of that
    // binding, so the kind is what tells the two apart.
    if (role.kind === 'ClusterRole') {
      await iamApi.addRuleToClusterRole({ name: role.name, rule });
    } else {
      await iamApi.addRuleToRole({ namespace: role.namespace ?? '', name: role.name, rule });
    }
    onclose();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    adding = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    onAdd().catch(console.error);
  }
}
</script>

<Modal name="Add rule" onclose={onclose}>
  <div class="flex flex-col gap-4 p-6">
    <h1 class="text-lg font-semibold text-(--pd-modal-text)">Add rule to {role.name}</h1>

    <p class="text-sm text-(--pd-modal-text)">
      Values are separated by commas. Use <code>*</code> to cover them all.
    </p>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="rule-api-groups">
      API groups
      <Input
        id="rule-api-groups"
        name="rule-api-groups"
        bind:value={apiGroups}
        placeholder="e.g. apps (empty for the core group)"
        aria-label="API groups"
        onkeypress={onKeydown} />
    </label>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="rule-resources">
      Resources
      <Input
        id="rule-resources"
        name="rule-resources"
        bind:value={resources}
        placeholder="e.g. pods, pods/log"
        aria-label="Resources"
        onkeypress={onKeydown} />
    </label>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="rule-verbs">
      Verbs
      <span class="text-xs text-(--pd-input-field-placeholder-text)">
        get, list, watch, create, update, patch, delete, deletecollection
      </span>
      <Input
        id="rule-verbs"
        name="rule-verbs"
        bind:value={verbs}
        placeholder="e.g. get, list, watch"
        aria-label="Verbs"
        onkeypress={onKeydown} />
    </label>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="rule-resource-names">
      Resource names (optional)
      <Input
        id="rule-resource-names"
        name="rule-resource-names"
        bind:value={resourceNames}
        placeholder="e.g. my-pod"
        aria-label="Resource names"
        onkeypress={onKeydown} />
    </label>

    {#if error}
      <ErrorMessage error={error} />
    {/if}

    <div class="flex justify-end gap-2">
      <Button type="secondary" onclick={onclose}>Cancel</Button>
      <Button inProgress={adding} disabled={!canAdd} onclick={onAdd}>Add</Button>
    </div>
  </div>
</Modal>
