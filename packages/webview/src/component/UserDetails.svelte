<style>
.table-container :global(div[role='table']) {
  width: auto;
}
</style>

<script lang="ts">
import { Table, TableColumn, TableRow, TableSimpleColumn, DetailsPage, Button } from '@podman-desktop/ui-svelte';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import { getContext, onDestroy, onMount } from 'svelte';
import type { Unsubscriber } from 'svelte/store';
import { router } from 'tinro';
import type { UserDetailsData, IamApi } from '@kubernetes-iam/channels';
import { API_IAM } from '@kubernetes-iam/channels';
import { Remote } from '/@/remote/remote';
import { States } from '/@/state/states';
import CreateRoleForUserDialog from './users/CreateRoleForUserDialog.svelte';
import AddRuleDialog from './users/AddRuleDialog.svelte';
import RoleActions from './users/RoleActions.svelte';
import type { BindingRef, RoleRef, RoleRowUI } from './users/RoleRowUI';

interface Props {
  name: string;
}

const { name }: Props = $props();
const remote = getContext<Remote>(Remote);
const states = getContext<States>(States);

let details: UserDetailsData | undefined = $state(undefined);
let loading = $state(true);
let error: string | undefined = $state(undefined);
let roleDialogKind: 'Role' | 'ClusterRole' | undefined = $state(undefined);
let ruleDialogRole: RoleRef | undefined = $state(undefined);

let subscribers: Unsubscriber[] = [];

onMount(() => {
  subscribers.push(states.stateRolesData.subscribe());
  subscribers.push(states.stateClusterRolesData.subscribe());
  subscribers.push(states.stateRoleBindingsData.subscribe());
  subscribers.push(states.stateClusterRoleBindingsData.subscribe());
});

onDestroy(() => {
  for (const subscriber of subscribers) {
    subscriber();
  }
  subscribers = [];
});

const rbacData = $derived({
  roles: states.stateRolesData.data,
  clusterRoles: states.stateClusterRolesData.data,
  roleBindings: states.stateRoleBindingsData.data,
  clusterRoleBindings: states.stateClusterRoleBindingsData.data,
});

$effect(() => {
  // The extension computes the details from these four resources, so any change to them
  // is a reason to read the details again: this is what makes a role added from this page
  // appear once the cluster reports it.
  if (rbacData) {
    loadDetails().catch(console.error);
  }
});

/** Discriminates the response of the latest read from those of the reads it superseded. */
let latestRead = 0;

async function loadDetails(): Promise<void> {
  const read = ++latestRead;
  try {
    const loaded = await remote.getProxy<IamApi>(API_IAM).getUserDetails({ userName: name });
    if (read !== latestRead) return;
    details = loaded;
    error = undefined;
  } catch (e: unknown) {
    if (read !== latestRead) return;
    error = e instanceof Error ? e.message : String(e);
  } finally {
    if (read === latestRead) {
      loading = false;
    }
  }
}

/**
 * Revokes from the user the role a binding grants it. The extension asks the operator to
 * confirm first, and reports a failure through the dashboard, so there is nothing to
 * display here.
 */
async function revoke(binding: BindingRef): Promise<void> {
  await remote.getProxy<IamApi>(API_IAM).revokeRoleFromUser({
    username: name,
    bindingKind: binding.kind,
    bindingName: binding.name,
    namespace: binding.namespace,
  });
}

function toUI(d: UserDetailsData | undefined): RoleRowUI[] {
  if (!d) return [];
  return d.roles.map(r => {
    // A rule is added to the role itself, which a namespace tells apart from a cluster role.
    const role: RoleRef = { kind: r.roleKind, name: r.roleName, namespace: r.namespace };
    const binding: BindingRef = { kind: r.bindingKind, name: r.bindingName, namespace: r.namespace };
    return {
      name: r.roleName,
      col2: r.roleKind,
      col3: r.bindingName,
      col4: r.namespace ?? 'Cluster-wide',
      role,
      onAddRule: (): RoleRef => (ruleDialogRole = role),
      onRevoke: (): void => {
        revoke(binding).catch(console.error);
      },
      children: r.rules.map(rule => ({
        name: rule.apiGroups.map(g => (g === '' ? 'core' : g)).join(', ') || '*',
        col2: rule.resources.join(', ') || '*',
        col3: rule.verbs.join(', '),
        col4: rule.resourceNames?.join(', ') ?? '',
      })),
    };
  });
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

const actionsColumn = new TableColumn<RoleRowUI, RoleRowUI>('Actions', {
  align: 'right',
  renderMapping: (r): RoleRowUI => r,
  renderer: RoleActions,
  overflow: true,
});

const columns = [roleColumn, kindColumn, bindingColumn, scopeColumn, actionsColumn];
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
  {#snippet actionsSnippet()}
    <div class="flex flex-row gap-2">
      <Button icon={faPlusCircle} onclick={(): 'Role' => (roleDialogKind = 'Role')}>Add role</Button>
      <Button icon={faPlusCircle} onclick={(): 'ClusterRole' => (roleDialogKind = 'ClusterRole')}>
        Add cluster role
      </Button>
    </div>
  {/snippet}
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

{#if roleDialogKind}
  <CreateRoleForUserDialog
    username={name}
    clusterScoped={roleDialogKind === 'ClusterRole'}
    onclose={(): undefined => (roleDialogKind = undefined)} />
{/if}

{#if ruleDialogRole}
  <AddRuleDialog role={ruleDialogRole} onclose={(): undefined => (ruleDialogRole = undefined)} />
{/if}
