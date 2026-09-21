<style>
.scroll-shadow {
  height: 0.3125rem;
}

.scroll-shadow-top {
  background: linear-gradient(to bottom, rgb(0 0 0 / 0.22), transparent);
}

.scroll-shadow-bottom {
  background: linear-gradient(to top, rgb(0 0 0 / 0.22), transparent);
}
</style>

<script lang="ts">
import { Button, ErrorMessage, Modal, Spinner } from '@podman-desktop/ui-svelte';
import { getContext, onDestroy, tick, untrack } from 'svelte';
import { Remote } from '/@/remote/remote';
import { API_IAM } from '@kubernetes-iam/channels';
import type { ApiResourcesData, ApiResourcesStatus, IamApi } from '@kubernetes-iam/channels';
import { States } from '/@/state/states';
import type { RoleRef } from './RoleRowUI';
import ResourceNamesInput from './rule/ResourceNamesInput.svelte';
import ResourceSelector from './rule/ResourceSelector.svelte';
import RulesPreview from './rule/RulesPreview.svelte';
import SelectedResources from './rule/SelectedResources.svelte';
import VerbSelector from './rule/VerbSelector.svelte';
import { toPolicyRules, toSelectableResources, verbOptions } from './rule/rule-builder';

interface Props {
  role: RoleRef;
  onclose: () => void;
}

const DISCOVERY_DEADLINE_MS = 15_000;

const { role, onclose }: Props = $props();
const remote = getContext<Remote>(Remote);
const states = getContext<States>(States);

let selectedKeys = $state<string[]>([]);
let selectedVerbs = $state<string[]>([]);
let resourceNames = $state<string[]>([]);
let adding = $state(false);
let error: string | undefined = $state(undefined);
let timedOut = $state(false);
let deadline: ReturnType<typeof setTimeout> | undefined;
let scrollArea: HTMLDivElement | undefined;
let showTopScrollShadow = $state(false);
let showBottomScrollShadow = $state(false);

const data = $derived(states.stateApiResourcesData.data);
const remoteStatus = $derived(data?.status ?? 'unknown');
const status = $derived(
  timedOut && (remoteStatus === 'unknown' || remoteStatus === 'loading') ? 'error' : remoteStatus,
);

const catalog = $derived(toSelectableResources(data ?? emptyDiscovery()));
/** A namespaced Role cannot grant cluster-scoped resources. */
const available = $derived(role.kind === 'Role' ? catalog.filter(resource => resource.namespaced) : catalog);
const selectedResources = $derived(available.filter(resource => selectedKeys.includes(resource.key)));
const availableVerbs = $derived(verbOptions(selectedResources));
const rules = $derived(toPolicyRules(selectedResources, selectedVerbs, resourceNames));
const canAdd = $derived(rules.length > 0 && !adding && status === 'loaded');
const discoveryError = $derived(errorMessage(status, timedOut, data));

$effect(() => {
  const current = remoteStatus;
  if (current === 'loaded' || current === 'error') {
    untrack(() => {
      timedOut = false;
      clearDeadline();
    });
    return;
  }
  if (current === 'unknown') {
    untrack(() => {
      requestDiscovery();
    });
    return;
  }
  untrack(() => {
    armDeadline();
  });
});

onDestroy(() => {
  clearDeadline();
});

$effect(() => {
  status;
  selectedResources.length;
  selectedVerbs.length;
  resourceNames.length;
  void tick().then(updateScrollShadows, console.error);
});

function updateScrollShadows(): void {
  if (!scrollArea) return;
  showTopScrollShadow = scrollArea.scrollTop > 1;
  showBottomScrollShadow = scrollArea.scrollHeight - scrollArea.clientHeight - scrollArea.scrollTop > 1;
}

function emptyDiscovery(): ApiResourcesData {
  return { status: 'unknown', resources: [] };
}

function errorMessage(
  current: ApiResourcesStatus,
  deadlineReached: boolean,
  discovery: ApiResourcesData | undefined,
): string | undefined {
  if (current !== 'error') {
    return undefined;
  }
  if (deadlineReached && !discovery?.error) {
    return 'Timed out waiting for API resources.';
  }
  return discovery?.error ?? 'API resources could not be loaded.';
}

function clearDeadline(): void {
  if (deadline !== undefined) {
    clearTimeout(deadline);
    deadline = undefined;
  }
}

function armDeadline(): void {
  clearDeadline();
  timedOut = false;
  deadline = setTimeout(() => {
    timedOut = true;
  }, DISCOVERY_DEADLINE_MS);
}

function requestDiscovery(): void {
  armDeadline();
  remote.getProxy<IamApi>(API_IAM).refreshApiResources().catch(console.error);
}

function onRetry(): void {
  timedOut = false;
  requestDiscovery();
}

function toggleResource(key: string): void {
  selectedKeys = selectedKeys.includes(key) ? selectedKeys.filter(entry => entry !== key) : [...selectedKeys, key];
}

function toggleVerb(verb: string): void {
  selectedVerbs = selectedVerbs.includes(verb)
    ? selectedVerbs.filter(entry => entry !== verb)
    : [...selectedVerbs, verb];
}

function replaceVerbs(verbs: string[]): void {
  selectedVerbs = verbs;
}

async function onAdd(): Promise<void> {
  if (!canAdd) return;
  adding = true;
  error = undefined;
  try {
    const iamApi = remote.getProxy<IamApi>(API_IAM);
    // A cluster role bound through a namespaced binding carries the namespace of that
    // binding, so the kind is what tells the two apart.
    if (role.kind === 'ClusterRole') {
      await iamApi.addRulesToClusterRole({ name: role.name, rules });
    } else {
      await iamApi.addRulesToRole({ namespace: role.namespace ?? '', name: role.name, rules });
    }
    onclose();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    adding = false;
  }
}
</script>

<svelte:window onresize={updateScrollShadows} />

<Modal name="Add rule" onclose={onclose}>
  <div class="flex h-[min(32rem,calc(100vh-8rem))] flex-col">
    <header class="shrink-0 px-6 pt-6 pb-4">
      <h1 class="text-lg font-semibold text-(--pd-modal-text)">Add rule to {role.name}</h1>
    </header>

    <div class="relative min-h-0 flex-1">
      <div bind:this={scrollArea} onscroll={updateScrollShadows} class="h-full overflow-y-auto px-6">
        <div class="flex flex-col gap-4">
          {#if status === 'unknown' || status === 'loading'}
            <div class="flex flex-row items-center gap-2 text-sm text-(--pd-modal-text)">
              <Spinner size="1.5em" label="Loading API resources" />
              <span>Loading API resources…</span>
            </div>
          {:else if status === 'error'}
            {#if discoveryError}
              <ErrorMessage error={discoveryError} />
            {/if}
            <Button type="secondary" onclick={onRetry}>Retry</Button>
          {:else}
            {#if data?.failedGroupVersions && data.failedGroupVersions.length > 0}
              <p class="text-sm text-(--pd-input-field-placeholder-text)">
                Some API groups could not be listed: {data.failedGroupVersions.join(', ')}
              </p>
            {/if}
            <ResourceSelector resources={available} selected={selectedKeys} onToggle={toggleResource} />
            <SelectedResources resources={selectedResources} onRemove={toggleResource} />
            {#if selectedResources.length > 0}
              <VerbSelector
                available={availableVerbs}
                selected={selectedVerbs}
                onToggle={toggleVerb}
                onReplace={replaceVerbs} />
              <ResourceNamesInput
                names={resourceNames}
                verbs={selectedVerbs}
                onChange={(names): void => {
                  resourceNames = names;
                }} />
              <RulesPreview rules={rules} />
            {/if}
          {/if}
        </div>
      </div>
      {#if showTopScrollShadow}
        <div class="scroll-shadow scroll-shadow-top pointer-events-none absolute top-0 right-0 left-0 z-10"></div>
      {/if}
      {#if showBottomScrollShadow}
        <div class="scroll-shadow scroll-shadow-bottom pointer-events-none absolute right-0 bottom-0 left-0 z-10"></div>
      {/if}
    </div>

    <footer class="shrink-0 px-6 pt-4 pb-6">
      {#if error}
        <div class="mb-4">
          <ErrorMessage error={error} />
        </div>
      {/if}

      <div class="flex justify-end gap-2">
        <Button type="secondary" onclick={onclose}>Cancel</Button>
        <Button inProgress={adding} disabled={!canAdd} onclick={onAdd}>Add rules</Button>
      </div>
    </footer>
  </div>
</Modal>
