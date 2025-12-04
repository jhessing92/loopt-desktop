<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { contentStore } from '$lib/stores/contentStore';
  
  let { children } = $props();
  
  onMount(() => {
    // Initialize the content store
    contentStore.initialize();
  });
</script>

<div class="flex h-screen overflow-hidden">
  <Sidebar />
  <main class="flex-1 overflow-hidden">
    {@render children()}
  </main>
</div>

