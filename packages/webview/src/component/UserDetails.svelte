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

interface RoleRowUI {
  selected?: boolean;
  name: string;
  col2: string;
  col3: string;
  col4: string;
  children?: RoleRowUI[];
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

function toUI(d: UserDetailsData | undefined): RoleRowUI[] {
  if (!d) return [];
  return d.roles.map(r => ({
    name: r.roleName,
    col2: r.roleKind,
    col3: r.bindingName,
    col4: r.namespace ?? 'Cluster-wide',
    children: r.rules.map((rule, i) => ({
      name: rule.apiGroups.map(g => (g === '' ? 'core' : g)).join(', ') || '*',
      col2: rule.resources.join(', ') || '*',
      col3: rule.verbs.join(', '),
      col4: rule.resourceNames?.join(', ') ?? '',
    })),
  }));
}

const roles: RoleRowUI[] = $derived(toUI(details));

const roleColumn = new TableColumn<RoleRowUI, string>('Role / API Groups', {
  renderMapping: (r): string => r.name,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.name.localeCompare(b.name),
});

const kindColumn = new TableColumn<RoleRowUI, string>('Kind / Resources', {
  renderMapping: (r): string => r.col2,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.col2.localeCompare(b.col2),
});

const bindingColumn = new TableColumn<RoleRowUI, string>('Binding / Verbs', {
  renderMapping: (r): string => r.col3,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.col3.localeCompare(b.col3),
});

const scopeColumn = new TableColumn<RoleRowUI, string>('Scope / Res. Names', {
  renderMapping: (r): string => r.col4,
  renderer: TableSimpleColumn,
  comparator: (a, b): number => a.col4.localeCompare(b.col4),
});

const columns = [roleColumn, kindColumn, bindingColumn, scopeColumn];
const row = new TableRow<RoleRowUI>({
  selectable: (): boolean => false,
  children: (r): RoleRowUI[] => r.children ?? [],
});

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
