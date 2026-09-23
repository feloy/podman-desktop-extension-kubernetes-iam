<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { faLinkSlash, faPlusCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { RoleRowUI } from './RoleRowUI';

const { object }: { object: RoleRowUI } = $props();
</script>

{#if object.onRemoveRule}
  <Button title="Remove rule" icon={faTrash} type="link" onclick={object.onRemoveRule} />
{/if}

{#if object.role}
  {#if object.onAddRule}
    <Button title="Add rule to {object.role.name}" icon={faPlusCircle} type="link" onclick={object.onAddRule} />
  {/if}
  {#if object.onRevoke}
    <!-- The binding is unlinked, not the role deleted, so the icon is a broken link. -->
    <Button title="Revoke {object.role.name}" icon={faLinkSlash} type="link" onclick={object.onRevoke} />
  {/if}
{/if}
