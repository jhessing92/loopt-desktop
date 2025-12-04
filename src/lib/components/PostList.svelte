<script lang="ts">
  import { filteredPosts, appState, contentStore } from '$lib/stores/contentStore';
  import type { ContentPost, ContentStatus, Platform } from '$lib/types';
  import { format } from 'date-fns';

  let posts = $derived($filteredPosts);
  let state = $derived($appState);

  const statusOptions: { value: ContentStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  const platformOptions: { value: Platform | 'all'; label: string }[] = [
    { value: 'all', label: 'All Platforms' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'Twitter' },
  ];

  function getPlatformIcon(platform: Platform): string {
    switch (platform) {
      case 'linkedin': return '🔗';
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'twitter': return '🐦';
      default: return '📝';
    }
  }

  function getPlatformClass(platform: Platform): string {
    switch (platform) {
      case 'linkedin': return 'bg-sky-500/20 text-sky-400';
      case 'facebook': return 'bg-blue-500/20 text-blue-400';
      case 'instagram': return 'bg-pink-500/20 text-pink-400';
      case 'twitter': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  }

  function getStatusClass(status: ContentStatus): string {
    switch (status) {
      case 'draft': return 'status-draft';
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      default: return 'status-draft';
    }
  }

  function handleSubmit(e: MouseEvent, postId: string) {
    e.stopPropagation();
    contentStore.submitForReview(postId);
  }
</script>

<div class="h-full flex flex-col">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-loopt-border">
    <div class="flex items-center gap-4">
      <h2 class="text-2xl font-bold text-loopt-text">All Posts</h2>
      <span class="text-sm text-loopt-text-muted">({posts.length} posts)</span>
    </div>
    
    <div class="flex items-center gap-3">
      <!-- Status Filter -->
      <select 
        class="select w-40"
        value={state.filterStatus}
        onchange={(e) => contentStore.setFilterStatus(e.currentTarget.value as ContentStatus | 'all')}
      >
        {#each statusOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <!-- Platform Filter -->
      <select 
        class="select w-40"
        value={state.filterPlatform}
        onchange={(e) => contentStore.setFilterPlatform(e.currentTarget.value as Platform | 'all')}
      >
        {#each platformOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <button 
        class="btn-primary"
        onclick={() => contentStore.openEditor()}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New Post
      </button>
    </div>
  </div>

  <!-- Posts List -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if posts.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-24 h-24 rounded-full bg-loopt-surface flex items-center justify-center mb-4">
          <svg class="w-12 h-12 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-loopt-text mb-2">No posts found</h3>
        <p class="text-loopt-text-muted mb-4">Create your first post to get started</p>
        <button 
          class="btn-primary"
          onclick={() => contentStore.openEditor()}
        >
          Create Post
        </button>
      </div>
    {:else}
      <div class="space-y-3">
        {#each posts as post}
          <div 
            class="card hover:bg-loopt-surface-hover transition-colors cursor-pointer flex gap-4"
            onclick={() => contentStore.openEditor(post)}
            onkeydown={(e) => e.key === 'Enter' && contentStore.openEditor(post)}
            role="button"
            tabindex="0"
          >
            <!-- Thumbnail -->
            {#if post.media_files && post.media_files.length > 0}
              <div class="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                <img 
                  src={post.media_files[0].url} 
                  alt="Thumbnail"
                  class="w-full h-full object-cover"
                />
              </div>
            {:else}
              <div class="w-24 h-24 rounded-lg bg-loopt-bg flex items-center justify-center flex-shrink-0">
                <span class="text-3xl">{getPlatformIcon(post.platform)}</span>
              </div>
            {/if}

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 class="font-medium text-loopt-text truncate">
                    {post.idea || post.caption?.substring(0, 50) || 'Untitled Post'}
                  </h3>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs px-2 py-0.5 rounded-full {getPlatformClass(post.platform)}">
                      {post.platform}
                    </span>
                    <span class="text-xs text-loopt-text-muted">
                      {post.content_type}
                    </span>
                  </div>
                </div>
                <span class="status-badge {getStatusClass(post.status)} flex-shrink-0">
                  {post.status}
                </span>
              </div>
              
              <p class="text-sm text-loopt-text-muted line-clamp-2 mb-2">
                {post.caption || 'No caption'}
              </p>
              
              <div class="flex items-center gap-4 text-xs text-loopt-text-muted">
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  {post.scheduled_date ? format(new Date(post.scheduled_date), 'MMM d, yyyy') : 'Not scheduled'}
                </span>
                {#if post.media_files && post.media_files.length > 0}
                  <span class="flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    {post.media_files.length} media
                  </span>
                {/if}
              </div>
            </div>

            <!-- Quick Actions -->
            <div class="flex flex-col gap-2 flex-shrink-0">
              {#if post.status === 'draft' || post.status === 'rejected'}
                <button 
                  class="btn-success text-xs py-1.5"
                  onclick={(e) => handleSubmit(e, post.id)}
                >
                  Submit
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
