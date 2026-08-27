<script lang="ts">
import { router } from 'tinro';
import type { UserUI } from './UserUI';

const { object }: { object: UserUI } = $props();

function onClick(): void {
  router.goto(`/users/${encodeURIComponent(object.name)}`);
}
</script>

<button
  class="text-(--pd-content-link) hover:underline cursor-pointer bg-transparent border-none p-0 text-left"
  onclick={onClick}
  title="View details for {object.name}">
  {object.name}
</button>
