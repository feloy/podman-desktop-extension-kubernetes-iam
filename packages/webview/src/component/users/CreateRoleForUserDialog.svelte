<script lang="ts">
import { Button, ErrorMessage, Input, Modal } from '@podman-desktop/ui-svelte';
import { getContext } from 'svelte';
import { Remote } from '/@/remote/remote';
import { API_IAM } from '@kubernetes-iam/channels';
import type { IamApi } from '@kubernetes-iam/channels';

interface Props {
  username: string;
  /** Creates a ClusterRole and a ClusterRoleBinding instead of their namespaced counterparts. */
  clusterScoped: boolean;
  onclose: () => void;
}

const { username, clusterScoped, onclose }: Props = $props();
const remote = getContext<Remote>(Remote);

let name = $state('');
let namespace = $state('default');
let creating = $state(false);
let error: string | undefined = $state(undefined);

const title = $derived(clusterScoped ? 'Create cluster role' : 'Create role');
const trimmedName = $derived(name.trim());
const trimmedNamespace = $derived(namespace.trim());
const canCreate = $derived(trimmedName.length > 0 && (clusterScoped || trimmedNamespace.length > 0) && !creating);

async function onCreate(): Promise<void> {
  if (!canCreate) return;
  creating = true;
  error = undefined;
  try {
    const iamApi = remote.getProxy<IamApi>(API_IAM);
    if (clusterScoped) {
      await iamApi.createClusterRoleForUser({ username, name: trimmedName });
    } else {
      await iamApi.createRoleForUser({ username, name: trimmedName, namespace: trimmedNamespace });
    }
    onclose();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    creating = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') {
    onCreate().catch(console.error);
  }
}
</script>

<Modal name={title} onclose={onclose}>
  <div class="flex flex-col gap-4 p-6">
    <h1 class="text-lg font-semibold text-(--pd-modal-text)">{title}</h1>

    <p class="text-sm text-(--pd-modal-text)">
      The role is created without any rule and bound to {username}; rules can be added to it afterwards.
    </p>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="role-name">
      Name
      <Input
        id="role-name"
        name="role-name"
        bind:value={name}
        placeholder="e.g. pod-reader"
        aria-label="Role name"
        onkeypress={onKeydown} />
    </label>

    {#if !clusterScoped}
      <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="role-namespace">
        Namespace
        <Input
          id="role-namespace"
          name="role-namespace"
          bind:value={namespace}
          placeholder="e.g. default"
          aria-label="Namespace"
          onkeypress={onKeydown} />
      </label>
    {/if}

    {#if error}
      <ErrorMessage error={error} />
    {/if}

    <div class="flex justify-end gap-2">
      <Button type="secondary" onclick={onclose}>Cancel</Button>
      <Button inProgress={creating} disabled={!canCreate} onclick={onCreate}>Create</Button>
    </div>
  </div>
</Modal>
