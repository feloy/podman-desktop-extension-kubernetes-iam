<script lang="ts">
import { Button, ErrorMessage, Input, Modal } from '@podman-desktop/ui-svelte';
import { getContext } from 'svelte';
import { Remote } from '/@/remote/remote';
import { API_IAM } from '@kubernetes-iam/channels';
import type { IamApi } from '@kubernetes-iam/channels';

interface Props {
  existingNames: string[];
  onclose: () => void;
}

const { existingNames, onclose }: Props = $props();
const remote = getContext<Remote>(Remote);

let username = $state('');
let creating = $state(false);
let error: string | undefined = $state(undefined);

const trimmed = $derived(username.trim());
const duplicate = $derived(trimmed.length > 0 && existingNames.includes(trimmed));
const canCreate = $derived(trimmed.length > 0 && !duplicate && !creating);

async function onCreate(): Promise<void> {
  if (!canCreate) return;
  creating = true;
  error = undefined;
  try {
    const iamApi = remote.getProxy<IamApi>(API_IAM);
    await iamApi.createUser({ username: trimmed });
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

<Modal name="Create user" onclose={onclose}>
  <div class="flex flex-col gap-4 p-6">
    <h1 class="text-lg font-semibold text-(--pd-modal-text)">Create user</h1>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="username">
      User name
      <Input
        id="username"
        name="username"
        bind:value={username}
        placeholder="e.g. alice"
        aria-label="User name"
        onkeypress={onKeydown} />
    </label>

    {#if duplicate}
      <ErrorMessage error="A user named {trimmed} already exists." />
    {:else if error}
      <ErrorMessage error={error} />
    {/if}

    <div class="flex justify-end gap-2">
      <Button type="secondary" onclick={onclose}>Cancel</Button>
      <Button inProgress={creating} disabled={!canCreate} onclick={onCreate}>Create</Button>
    </div>
  </div>
</Modal>
