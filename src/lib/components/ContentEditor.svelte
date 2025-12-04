<script lang="ts">
  import { appState, contentStore, selectedPlatform } from '$lib/stores/contentStore';
  import type { ContentPost, ContentType, Platform } from '$lib/types';
  import { format } from 'date-fns';
  import MediaUploader from './MediaUploader.svelte';

  let state = $derived($appState);
  let platform = $derived($selectedPlatform);
  
  let post = $state<Partial<ContentPost>>({
    platform: 'linkedin',
    content_type: 'post',
    scheduled_date: new Date(),
    idea: '',
    caption: '',
    notes: '',
    media_files: [],
    tags: [],
    status: 'draft',
  });

  let characterCount = $derived(post.caption?.length || 0);
  let isSaving = $state(false);

  // Platform character limits
  const platformLimits: Record<Platform, number> = {
    linkedin: 3000,
    twitter: 280,
    instagram: 2200,
    facebook: 63206,
  };

  let currentLimit = $derived(platformLimits[post.platform as Platform] || 3000);
  let isOverLimit = $derived(characterCount > currentLimit);

  const platforms: { value: Platform; label: string }[] = [
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'Twitter' },
  ];

  const contentTypes: { value: ContentType; label: string }[] = [
    { value: 'post', label: 'Post' },
    { value: 'carousel', label: 'Carousel' },
    { value: 'video', label: 'Video' },
    { value: 'story', label: 'Story' },
    { value: 'reel', label: 'Reel' },
  ];

  // Load existing post data if editing
  $effect(() => {
    if (state.selectedPost) {
      post = { ...state.selectedPost };
    } else {
      post = {
        platform: 'linkedin',
        content_type: 'post',
        scheduled_date: state.selectedDate,
        idea: '',
        caption: '',
        notes: '',
        media_files: [],
        tags: [],
        status: 'draft',
      };
    }
  });

  async function handleSave() {
    if (!post.caption && !post.idea) {
      return;
    }

    isSaving = true;
    try {
      if (state.isCreating) {
        await contentStore.createPost(post);
      } else if (state.selectedPost) {
        await contentStore.updatePost(state.selectedPost.id, post);
      }
      contentStore.closeEditor();
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      isSaving = false;
    }
  }

  async function handleSubmitForReview() {
    if (!state.selectedPost) return;
    
    isSaving = true;
    try {
      await contentStore.submitForReview(state.selectedPost.id);
      contentStore.closeEditor();
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      isSaving = false;
    }
  }

  function handleMediaChange(files: any[]) {
    post.media_files = files;
  }

  function closeModal() {
    contentStore.closeEditor();
  }

  function getStatusClass(status: string): string {
    switch (status) {
      case 'draft': return 'status-draft';
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'rejected': return 'status-rejected';
      default: return 'status-draft';
    }
  }
</script>

{#if state.isEditorOpen}
  <div 
    class="modal-backdrop" 
    onclick={closeModal}
    onkeydown={(e) => e.key === 'Escape' && closeModal()}
    role="dialog"
    aria-modal="true"
    aria-label="Content Editor"
    tabindex="-1"
  >
    <div 
      class="bg-loopt-surface w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-slide-in"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-loopt-border">
        <h2 class="text-xl font-bold text-loopt-text">
          {state.isCreating ? 'Create New Post' : 'Edit Post'}
        </h2>
        <div class="flex items-center gap-3">
          {#if state.selectedPost?.status}
            <span class="status-badge {getStatusClass(state.selectedPost.status)}">
              {state.selectedPost.status}
            </span>
          {/if}
          <button 
            class="p-2 hover:bg-loopt-surface-hover rounded-lg transition-colors"
            onclick={closeModal}
            aria-label="Close editor"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div class="grid grid-cols-2 gap-6">
          <!-- Left Column -->
          <div class="space-y-6">
            <!-- Platform & Type -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="platform-select" class="label">Platform</label>
                <select id="platform-select" class="select" bind:value={post.platform}>
                  {#each platforms as p}
                    <option value={p.value}>{p.label}</option>
                  {/each}
                </select>
              </div>
              <div>
                <label for="content-type-select" class="label">Content Type</label>
                <select id="content-type-select" class="select" bind:value={post.content_type}>
                  {#each contentTypes as type}
                    <option value={type.value}>{type.label}</option>
                  {/each}
                </select>
              </div>
            </div>

            <!-- Scheduled Date -->
            <div>
              <label for="scheduled-date" class="label">Scheduled Date</label>
              <input 
                id="scheduled-date"
                type="date" 
                class="input"
                value={post.scheduled_date ? format(new Date(post.scheduled_date), 'yyyy-MM-dd') : ''}
                onchange={(e) => post.scheduled_date = new Date(e.currentTarget.value)}
              />
            </div>

            <!-- Idea/Brief -->
            <div>
              <label for="idea-input" class="label">Idea / Brief</label>
              <input 
                id="idea-input"
                type="text" 
                class="input"
                placeholder="Quick description of the post concept..."
                bind:value={post.idea}
              />
            </div>

            <!-- Caption -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="caption-textarea" class="label mb-0">Caption</label>
                <span class="text-xs {isOverLimit ? 'text-loopt-error' : 'text-loopt-text-muted'}">
                  {characterCount} / {currentLimit}
                </span>
              </div>
              <textarea 
                id="caption-textarea"
                class="textarea h-48 font-mono text-sm"
                placeholder="Write your post caption here..."
                bind:value={post.caption}
              ></textarea>
            </div>

            <!-- Notes -->
            <div>
              <label for="notes-textarea" class="label">Notes / Feedback</label>
              <textarea 
                id="notes-textarea"
                class="textarea h-24"
                placeholder="Internal notes, feedback history..."
                bind:value={post.notes}
              ></textarea>
            </div>
          </div>

          <!-- Right Column - Media -->
          <div class="space-y-6">
            <div>
              <span class="label">Media</span>
              <MediaUploader 
                files={post.media_files || []}
                onchange={handleMediaChange}
              />
            </div>

            <!-- Preview -->
            {#if post.caption || post.idea}
              <div>
                <span class="label">Preview</span>
                <div class="card">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-loopt-accent/20 flex items-center justify-center">
                      <span class="text-loopt-accent font-bold">L</span>
                    </div>
                    <div>
                      <div class="font-medium text-sm">Loopt Content</div>
                      <div class="text-xs text-loopt-text-muted">
                        {post.scheduled_date ? format(new Date(post.scheduled_date), 'MMM d, yyyy') : 'Not scheduled'}
                      </div>
                    </div>
                  </div>
                  
                  {#if post.media_files && post.media_files.length > 0}
                    <div class="mb-3 rounded-lg overflow-hidden">
                      <img 
                        src={post.media_files[0].url} 
                        alt="Preview" 
                        class="w-full h-48 object-cover"
                      />
                    </div>
                  {/if}
                  
                  <p class="text-sm whitespace-pre-wrap">
                    {post.caption || post.idea || 'No content yet...'}
                  </p>
                </div>
              </div>
            {/if}

            <!-- Rejection Reason (if rejected) -->
            {#if state.selectedPost?.status === 'rejected' && state.selectedPost?.rejection_reason}
              <div class="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                <div class="flex items-center gap-2 mb-2">
                  <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span class="font-medium text-red-400">Rejection Reason</span>
                </div>
                <p class="text-sm text-red-400/80">{state.selectedPost.rejection_reason}</p>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-6 border-t border-loopt-border bg-loopt-bg/50">
        <button 
          class="btn-secondary"
          onclick={closeModal}
        >
          Cancel
        </button>
        
        <div class="flex items-center gap-3">
          <button 
            class="btn-secondary"
            onclick={handleSave}
            disabled={isSaving}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
            </svg>
            Save Draft
          </button>
          
          {#if state.selectedPost?.status === 'draft' || state.selectedPost?.status === 'rejected'}
            <button 
              class="btn-primary"
              onclick={handleSubmitForReview}
              disabled={isSaving || isOverLimit}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              Submit for Review
            </button>
          {:else if state.isCreating}
            <button 
              class="btn-primary"
              onclick={handleSave}
              disabled={isSaving || isOverLimit || (!post.caption && !post.idea)}
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              Create Post
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
