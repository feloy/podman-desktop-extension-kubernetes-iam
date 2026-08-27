<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
  children: Snippet;
}

const { children }: Props = $props();
</script>

<div class="flex flex-col w-full h-full">
  {@render children()}
</div>
