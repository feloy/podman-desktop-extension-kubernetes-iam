<script lang="ts">
import './app.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import { onDestroy, onMount } from 'svelte';

import { Main, type MainContext } from '/@/main';
import MainContextAware from '/@/MainContextAware.svelte';

let main: Main | undefined;
let mainContext: MainContext | undefined = $state();

onMount(async () => {
  main = new Main();
  mainContext = await main.init();
});

onDestroy(() => {
  main?.dispose();
});
</script>

{#if mainContext}
  <MainContextAware context={mainContext} />
{/if}
