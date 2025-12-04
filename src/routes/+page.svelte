<script lang="ts">
  import { appState, isLoading } from '$lib/stores/contentStore';
  import Calendar from '$lib/components/Calendar.svelte';
  import PostList from '$lib/components/PostList.svelte';
  import MediaLibrary from '$lib/components/MediaLibrary.svelte';
  import ContentEditor from '$lib/components/ContentEditor.svelte';
  import ToastContainer from '$lib/components/ToastContainer.svelte';

  let state = $derived($appState);
  let loading = $derived($isLoading);
</script>

<div class="h-full flex flex-col bg-loopt-bg">
  {#if loading}
    <!-- Loading State -->
    <div class="flex-1 flex items-center justify-center">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-4 border-loopt-accent border-t-transparent rounded-full animate-spin"></div>
        <p class="text-loopt-text-muted">Loading content...</p>
      </div>
    </div>
  {:else}
    <!-- Main Content Area -->
    {#if state.view === 'calendar'}
      <Calendar />
    {:else if state.view === 'list'}
      <PostList />
    {:else if state.view === 'media'}
      <MediaLibrary />
    {/if}
  {/if}
</div>

<!-- Content Editor Modal -->
<ContentEditor />

<!-- Toast Notifications -->
<ToastContainer />
