<style>
.table-container :global(div[role='table']) {
  width: auto;
}
</style>

<script lang="ts">
import { Table, TableColumn, TableRow, TableSimpleColumn, DetailsPage } from '@podman-desktop/ui-svelte';
import { getContext, onMount } from 'svelte';
import { router } from 'tinro';
import type { UserDetailsData, IamApi } from '@kubernetes-iam/channels';
import { API_IAM } from '@kubernetes-iam/channels';
import { Remote } from '/@/remote/remote';

interface UserRoleUI {
  selected?: boolean;
  name: string;
  roleKind: string;
  bindingName: string;
  bindingKind: string;
  namespace?: string;
}

interface Props {
  contextName: string;
  name: string;
}

const { contextName, name }: Props = $props();
const remote = getContext<Remote>(Remote);

let details: UserDetailsData | undefined = $state(undefined);
let loading = $state(true);
let error: string | undefined = $state(undefined);

onMount(async () => {
  try {
    const iamApi = remote.getProxy<IamApi>(API_IAM);
    details = await iamApi.getUserDetails({
      contextName,
      userName: name,
    });
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    loading = false;
  }
});

function toUI(d: UserDetailsData | undefined): UserRoleUI[] {
  if (!d) return [];
  return d.roles.map(r => ({
    name: r.roleName,
    roleKind: r.roleKind,
    bindingName: r.bindingName,
    bindingKind: r.bindingKind,
    namespace: r.namespace,
  }));
}

const roles: UserRoleUI[] = $derived(toUI(details));

const roleNameColumn = new TableColumn<UserRoleUI, string>('Role', {
  renderMapping: (r): string => r.name,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const roleKindColumn = new TableColumn<UserRoleUI, string>('Role Kind', {
  renderMapping: (r): string => r.roleKind,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.roleKind.localeCompare(b.roleKind),
});

const bindingNameColumn = new TableColumn<UserRoleUI, string>('Binding', {
  renderMapping: (r): string => r.bindingName,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.bindingName.localeCompare(b.bindingName),
});

const scopeColumn = new TableColumn<UserRoleUI, string>('Scope', {
  renderMapping: (r): string => r.namespace ?? 'Cluster-wide',
  renderer: TableSimpleColumn,
  comparator: (a, b): number => (a.namespace ?? '').localeCompare(b.namespace ?? ''),
});

const columns = [roleNameColumn, roleKindColumn, bindingNameColumn, scopeColumn];
const row = new TableRow<UserRoleUI>({ selectable: (): boolean => false });

function goBack(): void {
  router.goto('/');
}
</script>

<DetailsPage
  title={name}
  breadcrumbLeftPart="Users"
  breadcrumbRightPart={name}
  onclose={goBack}
  onbreadcrumbClick={goBack}>
  {#snippet contentSnippet()}
    <div class="flex flex-col h-full gap-4 py-4 bg-(--pd-content-bg)">
      <div class="text-sm text-(--pd-content-text) px-5">
        <span class="font-semibold">Type:</span>
        {details?.kind ?? ''}
      </div>

      {#if loading}
        <p class="text-sm text-(--pd-content-text) px-5">Loading roles...</p>
      {:else if error}
        <p class="text-sm text-red-500 px-5">Error: {error}</p>
      {:else if roles.length === 0}
        <p class="text-sm text-(--pd-content-text) px-5">No roles assigned to this user.</p>
      {:else}
        <div class="table-container">
          <Table kind="role" data={roles} columns={columns} row={row} defaultSortColumn="Role"></Table>
        </div>
      {/if}
    </div>
  {/snippet}
</DetailsPage>
