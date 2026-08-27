<script lang="ts">
import {
  Table,
  TableColumn,
  TableRow,
  TableSimpleColumn,
  NavPage,
  FilteredEmptyScreen,
  Button,
} from '@podman-desktop/ui-svelte';
import { faUsers, faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { getContext, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { States } from '/@/state/states';
import type { UserUI } from './users/UserUI';
import UserNameLink from './users/UserNameLink.svelte';
import DownloadKubeconfigAction from './users/DownloadKubeconfigAction.svelte';
import CreateUserDialog from './users/CreateUserDialog.svelte';

const states = getContext<States>(States);
const usersState = $derived(states.stateUsersData.data);

let searchTerm = $state<string>('');
let createDialogOpened = $state(false);

const existingNames: string[] = $derived((usersState?.users ?? []).map(user => user.name));

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

const users: UserUI[] = $derived(
  (usersState?.users ?? [])
    .filter(user => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return user.name.toLowerCase().includes(term) || user.kind.toLowerCase().includes(term);
    })
    .map(user => ({
      name: user.name,
      kind: user.kind,
    })),
);

const nameColumn = new TableColumn<UserUI, UserUI>('Name', {
  renderMapping: (user): UserUI => user,
  renderer: UserNameLink,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const typeColumn = new TableColumn<UserUI, string>('Type', {
  renderMapping: (user): string => user.kind,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.kind.localeCompare(b.kind),
});

const actionsColumn = new TableColumn<UserUI, UserUI>('Actions', {
  align: 'right',
  renderMapping: (user): UserUI => user,
  renderer: DownloadKubeconfigAction,
  overflow: true,
});

const columns = [nameColumn, typeColumn, actionsColumn];
const row = new TableRow<UserUI>({ selectable: (): boolean => false });
</script>

<NavPage bind:searchTerm={searchTerm} title="Users">
  {#snippet additionalActions()}
    <Button icon={faPlusCircle} onclick={(): boolean => (createDialogOpened = true)}>Create user</Button>
  {/snippet}

  {#snippet content()}
    <div class="flex min-w-full h-full">
      <Table kind="user" data={users} columns={columns} row={row} defaultSortColumn="Name"></Table>

      {#if users.length === 0}
        {#if searchTerm}
          <FilteredEmptyScreen
            icon={faUsers}
            kind="users"
            searchTerm={searchTerm}
            on:resetFilter={(): string => (searchTerm = '')} />
        {:else}
          <p class="text-sm text-(--pd-content-text)">No users found.</p>
        {/if}
      {/if}
    </div>
  {/snippet}
</NavPage>

{#if createDialogOpened}
  <CreateUserDialog existingNames={existingNames} onclose={(): boolean => (createDialogOpened = false)} />
{/if}
