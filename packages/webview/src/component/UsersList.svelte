<script lang="ts">
import {
  Table,
  TableColumn,
  TableRow,
  TableSimpleColumn,
  NavPage,
  FilteredEmptyScreen,
} from '@podman-desktop/ui-svelte';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { getContext, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { States } from '/@/state/states';
import type { UserUI } from './users/UserUI';

const states = getContext<States>(States);
const usersState = $derived(states.stateUsersData.data);

let searchTerm = $state<string>('');

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
      return (
        user.name.toLowerCase().includes(term) ||
        user.kind.toLowerCase().includes(term) ||
        (user.namespace?.toLowerCase().includes(term) ?? false)
      );
    })
    .map(user => ({
      name: user.name,
      kind: user.kind,
      namespace: user.namespace,
    })),
);

const namespaceColumn = new TableColumn<UserUI, string>('Namespace', {
  renderMapping: (user): string => user.namespace ?? '',
  renderer: TableSimpleColumn,
  comparator: (a, b): number => (a.namespace ?? '').localeCompare(b.namespace ?? ''),
});

const nameColumn = new TableColumn<UserUI, string>('Name', {
  renderMapping: (user): string => user.name,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const typeColumn = new TableColumn<UserUI, string>('Type', {
  renderMapping: (user): string => user.kind,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.kind.localeCompare(b.kind),
});

const scopeColumn = new TableColumn<UserUI, string>('Scope', {
  renderMapping: (user): string => (user.namespace ? 'Namespaced' : 'Cluster-wide'),
  renderer: TableSimpleColumn,
  comparator: (a, b): number =>
    (a.namespace ? 'Namespaced' : 'Cluster-wide').localeCompare(b.namespace ? 'Namespaced' : 'Cluster-wide'),
});

const columns = [namespaceColumn, nameColumn, typeColumn, scopeColumn];
const row = new TableRow<UserUI>({ selectable: (): boolean => false });
</script>

<NavPage bind:searchTerm={searchTerm} title="Users">
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
