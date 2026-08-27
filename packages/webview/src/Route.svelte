<script>
import { createRouteObject } from 'tinro/dist/tinro_lib';
import { onMount } from 'svelte';

export let path = '/*';
export let fallback = false;
export let redirect = false;
export let firstmatch = false;

let showContent = false;

/** @type {Record<string, string>} */
let params = {};

/** @type {{ params: Record<string, string> }} */
let meta = { params: {} };

const route = createRouteObject({
  fallback,
  onShow() {
    showContent = true;
  },
  onHide() {
    showContent = false;
  },
  onMeta(/** @type {any} */ newMeta) {
    meta = newMeta;
    params = meta.params;
  },
});

$: route.update({ path, redirect, firstmatch });

onMount(() => route.destroy);
</script>

{#if showContent}
  <slot params={params} meta={meta} />
{/if}
