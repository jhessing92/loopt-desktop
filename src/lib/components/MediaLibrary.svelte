<script lang="ts">
  import { posts } from '$lib/stores/contentStore';
  import type { MediaFile } from '$lib/types';

  // Collect all media from posts
  let allMedia = $derived(() => {
    const mediaMap = new Map<string, MediaFile & { postId: string; postTitle: string }>();
    
    $posts.forEach(post => {
      post.media_files?.forEach(media => {
        if (!mediaMap.has(media.url)) {
          mediaMap.set(media.url, {
            ...media,
            postId: post.id,
            postTitle: post.idea || post.caption?.substring(0, 30) || 'Untitled',
          });
        }
      });
    });
    
    return Array.from(mediaMap.values());
  });

  let selectedMedia: (MediaFile & { postId: string; postTitle: string }) | null = $state(null);
  let filterType: 'all' | 'image' | 'video' = $state('all');

  let filteredMedia = $derived(
    filterType === 'all' 
      ? allMedia() 
      : allMedia().filter(m => m.type === filterType)
  );

  function closeModal() {
    selectedMedia = null;
  }
</script>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-loopt-border">
    <div class="flex items-center gap-4">
      <h2 class="text-2xl font-bold text-loopt-text">Media Library</h2>
      <span class="text-sm text-loopt-text-muted">({allMedia().length} files)</span>
    </div>
    
    <div class="flex items-center gap-3">
      <!-- Type Filter -->
      <div class="flex rounded-lg bg-loopt-bg p-1">
        <button 
          class="px-3 py-1.5 rounded-md text-sm transition-colors {filterType === 'all' ? 'bg-loopt-surface text-loopt-text' : 'text-loopt-text-muted'}"
          onclick={() => filterType = 'all'}
        >
          All
        </button>
        <button 
          class="px-3 py-1.5 rounded-md text-sm transition-colors {filterType === 'image' ? 'bg-loopt-surface text-loopt-text' : 'text-loopt-text-muted'}"
          onclick={() => filterType = 'image'}
        >
          Images
        </button>
        <button 
          class="px-3 py-1.5 rounded-md text-sm transition-colors {filterType === 'video' ? 'bg-loopt-surface text-loopt-text' : 'text-loopt-text-muted'}"
          onclick={() => filterType = 'video'}
        >
          Videos
        </button>
      </div>
    </div>
  </div>

  <!-- Media Grid -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if filteredMedia.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-24 h-24 rounded-full bg-loopt-surface flex items-center justify-center mb-4">
          <svg class="w-12 h-12 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-loopt-text mb-2">No media files</h3>
        <p class="text-loopt-text-muted">Upload media through the content editor</p>
      </div>
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {#each filteredMedia as media}
          <button 
            class="group relative rounded-xl overflow-hidden bg-loopt-surface aspect-square cursor-pointer hover:ring-2 hover:ring-loopt-accent transition-all"
            onclick={() => selectedMedia = media}
          >
            {#if media.type === 'video'}
              <video 
                src={media.url}
                class="w-full h-full object-cover"
                muted
              >
                <track kind="captions" />
              </video>
              <div class="absolute top-2 left-2 bg-black/60 rounded px-2 py-1 text-xs text-white flex items-center gap-1">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Video
              </div>
            {:else}
              <img 
                src={media.url} 
                alt={media.name}
                class="w-full h-full object-cover"
              />
            {/if}
            
            <!-- Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              <p class="text-white text-sm truncate">{media.name}</p>
              <p class="text-white/60 text-xs truncate">{media.postTitle}</p>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Media Preview Modal -->
{#if selectedMedia}
  <div 
    class="modal-backdrop"
    onclick={closeModal}
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
    role="dialog"
    aria-modal="true"
    aria-label="Media Preview"
    tabindex="-1"
  >
    <div 
      class="bg-loopt-surface rounded-2xl overflow-hidden max-w-4xl max-h-[90vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <!-- Media -->
      <div class="flex-1 bg-black flex items-center justify-center min-h-[400px]">
        {#if selectedMedia.type === 'video'}
          <video 
            src={selectedMedia.url}
            class="max-w-full max-h-[70vh] object-contain"
            controls
            autoplay
          >
            <track kind="captions" />
          </video>
        {:else}
          <img 
            src={selectedMedia.url} 
            alt={selectedMedia.name}
            class="max-w-full max-h-[70vh] object-contain"
          />
        {/if}
      </div>
      
      <!-- Info -->
      <div class="p-4 border-t border-loopt-border">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-medium text-loopt-text">{selectedMedia.name}</h3>
            <p class="text-sm text-loopt-text-muted">Used in: {selectedMedia.postTitle}</p>
          </div>
          <button 
            class="btn-secondary"
            onclick={closeModal}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
