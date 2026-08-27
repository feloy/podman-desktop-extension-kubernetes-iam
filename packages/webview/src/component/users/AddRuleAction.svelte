<script lang="ts">
import { Button } from '@podman-desktop/ui-svelte';
import { faPlusCircle } from '@fortawesome/free-solid-svg-icons';
import type { RoleRowUI } from './RoleRowUI';

const { object }: { object: RoleRowUI } = $props();
</script>

{#if object.role && object.onAddRule}
  <Button title="Add rule to {object.role.name}" icon={faPlusCircle} type="link" onclick={object.onAddRule} />
{/if}
