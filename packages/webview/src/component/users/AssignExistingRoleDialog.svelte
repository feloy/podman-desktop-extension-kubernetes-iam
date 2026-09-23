<script lang="ts">
import { Button, Dropdown, ErrorMessage, Input, Modal } from '@podman-desktop/ui-svelte';
import { getContext } from 'svelte';
import { API_IAM, type ClusterRoleInfo, type IamApi, type RoleInfo, type UserRoleInfo } from '@kubernetes-iam/channels';
import { Remote } from '/@/remote/remote';

interface Props {
  username: string;
  roles: RoleInfo[];
  clusterRoles: ClusterRoleInfo[];
  assignedRoles: UserRoleInfo[];
  onclose: () => void;
}

const { username, roles, clusterRoles, assignedRoles, onclose }: Props = $props();
const remote = getContext<Remote>(Remote);

let roleKind = $state<'Role' | 'ClusterRole'>('Role');
let namespace = $state('');
let roleName = $state('');
let scope = $state<'namespace' | 'cluster'>('cluster');
let bindingName = $state('');
let bindingNameTouched = $state(false);
let assigning = $state(false);
let error = $state<string | undefined>(undefined);

function uniqueSorted(values: string[]): string[] {
  return values
    .filter((value, index) => values.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

const namespaces = $derived(uniqueSorted(roles.map(role => role.namespace)));
const availableRoles = $derived(
  roleKind === 'Role'
    ? uniqueSorted(roles.filter(role => role.namespace === namespace).map(role => role.name))
    : uniqueSorted(clusterRoles.map(role => role.name)),
);
const namespaceOptions = $derived([
  { value: '', label: 'Select a namespace' },
  ...namespaces.map(value => ({ value, label: value })),
]);
const roleOptions = $derived([
  { value: '', label: `Select a ${roleKind}` },
  ...availableRoles.map(value => ({ value, label: value })),
]);
const grantNamespace = $derived(roleKind === 'Role' || scope === 'namespace' ? namespace.trim() : undefined);
const duplicate = $derived(
  !!roleName &&
    assignedRoles.some(
      grant =>
        grant.roleKind === roleKind &&
        grant.roleName === roleName &&
        (grantNamespace === undefined ? grant.namespace === undefined : grant.namespace === grantNamespace),
    ),
);
function suggestedName(username: string, roleName: string): string {
  return `iam-${username}-${roleName || 'role'}-grant`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .slice(0, 253)
    .replace(/-$/, '');
}
const suggestedBindingName = $derived(suggestedName(username, roleName));
const canAssign = $derived(
  !!roleName &&
    !!bindingName.trim() &&
    (grantNamespace !== undefined || (roleKind === 'ClusterRole' && scope === 'cluster')) &&
    !duplicate &&
    !assigning,
);

function chooseRoleKind(): void {
  roleName = '';
  namespace = '';
  if (!bindingNameTouched) bindingName = suggestedBindingName;
}

function chooseRole(selectedRole = roleName): void {
  if (!bindingNameTouched) bindingName = suggestedName(username, selectedRole);
}

async function assign(): Promise<void> {
  if (!canAssign) return;
  assigning = true;
  error = undefined;
  try {
    await remote.getProxy<IamApi>(API_IAM).assignExistingRoleToUser({
      username,
      roleKind,
      roleName,
      bindingName: bindingName.trim(),
      scope: roleKind === 'Role' ? 'namespace' : scope,
      ...(grantNamespace === undefined ? {} : { namespace: grantNamespace }),
    });
    onclose();
  } catch (e: unknown) {
    error = e instanceof Error ? e.message : String(e);
  } finally {
    assigning = false;
  }
}
</script>

<Modal name="Assign existing role" onclose={onclose}>
  <div class="flex flex-col gap-4 p-6">
    <h1 class="text-lg font-semibold text-(--pd-modal-text)">Assign existing role</h1>
    <p class="text-sm text-(--pd-modal-text)">
      Creates a new binding for {username}; existing roles and bindings are not modified.
    </p>

    <fieldset class="flex flex-col gap-2 text-sm text-(--pd-modal-text)">
      <legend>Role kind</legend>
      <div class="flex flex-row gap-4">
        <label class="flex items-center gap-1">
          <input type="radio" bind:group={roleKind} value="Role" onchange={chooseRoleKind} /> Role
        </label>
        <label class="flex items-center gap-1">
          <input type="radio" bind:group={roleKind} value="ClusterRole" onchange={chooseRoleKind} /> ClusterRole
        </label>
      </div>
    </fieldset>

    {#if roleKind === 'Role'}
      <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="grant-namespace">
        Namespace
        <Dropdown
          id="grant-namespace"
          ariaLabel="Namespace"
          bind:value={namespace}
          onChange={chooseRole}
          options={namespaceOptions} />
      </label>
    {/if}

    {#if roleKind === 'ClusterRole'}
      <fieldset class="flex flex-col gap-2 text-sm text-(--pd-modal-text)">
        <legend>Grant scope</legend>
        <div class="flex flex-row gap-4">
          <label class="flex items-center gap-1"
            ><input type="radio" bind:group={scope} value="cluster" /> Cluster-wide</label>
          <label class="flex items-center gap-1"
            ><input type="radio" bind:group={scope} value="namespace" /> One namespace</label>
        </div>
      </fieldset>
      {#if scope === 'namespace'}
        <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="grant-namespace">
          Namespace
          <Input
            id="grant-namespace"
            name="grant-namespace"
            bind:value={namespace}
            placeholder="e.g. default"
            aria-label="Namespace" />
        </label>
      {/if}
    {/if}

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="existing-role">
      {roleKind}
      <Dropdown
        id="existing-role"
        ariaLabel={roleKind}
        bind:value={roleName}
        onChange={chooseRole}
        disabled={roleKind === 'Role' && !namespace}
        options={roleOptions} />
    </label>

    <label class="flex flex-col gap-2 text-sm text-(--pd-modal-text)" for="binding-name">
      Binding name
      <Input
        id="binding-name"
        name="binding-name"
        bind:value={bindingName}
        oninput={(): void => {
          bindingNameTouched = true;
        }}
        placeholder={suggestedBindingName}
        aria-label="Binding name" />
    </label>

    {#if duplicate}
      <p class="text-sm text-red-500">This user already has this {roleKind} at the selected scope.</p>
    {/if}
    {#if roleName}
      <p class="text-sm text-(--pd-modal-text)">
        Creates {scope === 'cluster' && roleKind === 'ClusterRole' ? 'ClusterRoleBinding' : 'RoleBinding'}
        {bindingName || suggestedBindingName}{grantNamespace ? ` in namespace ${grantNamespace}` : ''}, granting {roleKind}
        {roleName} to {username}.
      </p>
    {/if}
    {#if error}<ErrorMessage error={error} />{/if}
    <div class="flex justify-end gap-2">
      <Button type="secondary" onclick={onclose}>Cancel</Button>
      <Button inProgress={assigning} disabled={!canAssign} onclick={assign}>Assign role</Button>
    </div>
  </div>
</Modal>
