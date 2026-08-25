<script lang="ts">
import { getContext, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { States } from '/@/state/states';

const states = getContext<States>(States);
const usersState = $derived(states.stateUsersData.data);

let subscribers: Unsubscriber[] = [];

onMount(() => {
  subscribers.push(states.stateUsersData.subscribe());
});

onDestroy(() => {
  for (const subscriber of subscribers) {
    subscriber();
  }
  subscribers = [];
});
</script>

<div class="flex flex-col p-4">
  <h2 class="text-lg font-semibold mb-2">Users</h2>
  {#if usersState?.users.length}
    <ul class="list-disc pl-5 space-y-1">
      {#each usersState.users as user (user.kind + '/' + user.name + '/' + (user.namespace ?? ''))}
        <li>
          <span class="font-medium">{user.name}</span>
          <span class="text-sm text-gray-400">({user.kind})</span>
          {#if user.namespace}
            <span class="text-sm text-gray-500">in {user.namespace}</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-sm text-gray-500">No users found.</p>
  {/if}
</div>
