<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    getBrandAssets, 
    uploadBrandAsset, 
    deleteBrandAsset,
    deleteBrandAssets,
    getFolders,
    getTags,
    updateBrandAsset,
    formatFileSize,
    type BrandAsset 
  } from '$lib/services/brandAssets';
  import { toasts } from '$lib/stores/contentStore';

  // Props for when used as a picker
  interface Props {
    pickerMode?: boolean;
    onSelect?: ((asset: BrandAsset) => void) | null;
    onClose?: (() => void) | null;
    allowMultiple?: boolean;
  }

  let { 
    pickerMode = false, 
    onSelect = null, 
    onClose = null, 
    allowMultiple = false 
  }: Props = $props();

  let assets: BrandAsset[] = $state([]);
  let folders: string[] = $state(['General']);
  let allTags: string[] = $state([]);
  let isLoading = $state(true);
  let isUploading = $state(false);
  let uploadProgress = $state(0);
  
  // Filters
  let selectedFolder = $state('All');
  let selectedType = $state<BrandAsset['type'] | 'all'>('all');
  let searchQuery = $state('');
  let selectedTags = $state<string[]>([]);
  
  // Selection
  let selectedAssets = $state<Set<string>>(new Set());
  let isSelecting = $state(false);
  
  // Modal states
  let showUploadModal = $state(false);
  let showPreviewModal = $state(false);
  let previewAsset = $state<BrandAsset | null>(null);
  let showNewFolderInput = $state(false);
  let newFolderName = $state('');
  
  // Upload form
  let uploadFiles: FileList | null = $state(null);
  let uploadFolder = $state('General');
  let uploadTags = $state('');
  let fileInput: HTMLInputElement;
  let dragOver = $state(false);

  let initialized = $state(false);

  onMount(async () => {
    await loadData();
    initialized = true;
  });

  async function loadData() {
    isLoading = true;
    try {
      const [assetsData, foldersData, tagsData] = await Promise.all([
        getBrandAssets({
          folder: selectedFolder !== 'All' ? selectedFolder : undefined,
          type: selectedType !== 'all' ? selectedType : undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          search: searchQuery || undefined
        }),
        getFolders(),
        getTags()
      ]);
      assets = assetsData;
      folders = ['All', ...foldersData];
      allTags = tagsData;
    } catch (error) {
      console.error('Error loading brand assets:', error);
      toasts.show('Failed to load assets', 'error');
    } finally {
      isLoading = false;
    }
  }

  // Track filter values for reactivity
  let prevFilters = $state({ folder: 'All', type: 'all' as const, search: '', tags: [] as string[] });

  // Reload when filters change (only after initial load)
  $effect(() => {
    const currentFilters = {
      folder: selectedFolder,
      type: selectedType,
      search: searchQuery,
      tags: [...selectedTags]
    };
    
    if (initialized && (
      currentFilters.folder !== prevFilters.folder ||
      currentFilters.type !== prevFilters.type ||
      currentFilters.search !== prevFilters.search ||
      JSON.stringify(currentFilters.tags) !== JSON.stringify(prevFilters.tags)
    )) {
      prevFilters = currentFilters;
      loadData();
    }
  });

  async function handleUpload() {
    if (!uploadFiles || uploadFiles.length === 0) return;
    
    isUploading = true;
    uploadProgress = 0;
    const total = uploadFiles.length;
    let completed = 0;
    
    try {
      const tagsArray = uploadTags.split(',').map(t => t.trim()).filter(Boolean);
      
      for (const file of Array.from(uploadFiles)) {
        await uploadBrandAsset(file, {
          folder: uploadFolder,
          tags: tagsArray
        });
        completed++;
        uploadProgress = Math.round((completed / total) * 100);
      }
      
      toasts.show(`Uploaded ${total} asset${total > 1 ? 's' : ''} successfully!`);
      showUploadModal = false;
      uploadFiles = null;
      uploadTags = '';
      await loadData();
    } catch (error: any) {
      toasts.show(error.message || 'Failed to upload assets', 'error');
    } finally {
      isUploading = false;
      uploadProgress = 0;
    }
  }

  async function handleDelete(asset: BrandAsset) {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    
    try {
      await deleteBrandAsset(asset.id);
      toasts.show('Asset deleted');
      await loadData();
    } catch (error: any) {
      toasts.show(error.message || 'Failed to delete asset', 'error');
    }
  }

  async function handleBulkDelete() {
    if (selectedAssets.size === 0) return;
    if (!confirm(`Delete ${selectedAssets.size} selected assets? This cannot be undone.`)) return;
    
    try {
      await deleteBrandAssets(Array.from(selectedAssets));
      toasts.show(`Deleted ${selectedAssets.size} assets`);
      selectedAssets = new Set();
      isSelecting = false;
      await loadData();
    } catch (error: any) {
      toasts.show(error.message || 'Failed to delete assets', 'error');
    }
  }

  function toggleSelection(id: string) {
    const newSet = new Set(selectedAssets);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    selectedAssets = newSet;
  }

  function selectAll() {
    selectedAssets = new Set(assets.map(a => a.id));
  }

  function clearSelection() {
    selectedAssets = new Set();
  }

  function handleAssetClick(asset: BrandAsset) {
    if (isSelecting) {
      toggleSelection(asset.id);
    } else if (pickerMode && onSelect) {
      onSelect(asset);
    } else {
      previewAsset = asset;
      showPreviewModal = true;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files) {
      uploadFiles = e.dataTransfer.files;
      showUploadModal = true;
    }
  }

  function createNewFolder() {
    if (newFolderName.trim()) {
      uploadFolder = newFolderName.trim();
      if (!folders.includes(uploadFolder)) {
        folders = [...folders, uploadFolder];
      }
      showNewFolderInput = false;
      newFolderName = '';
    }
  }

  function getTypeIcon(type: BrandAsset['type']) {
    switch (type) {
      case 'video': return '🎬';
      case 'logo': return '✨';
      case 'graphic': return '🎨';
      default: return '📷';
    }
  }
</script>

<div 
  class="h-full flex flex-col {pickerMode ? '' : ''}"
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => dragOver = false}
  ondrop={handleDrop}
  role="region"
  aria-label="Brand Assets Library"
>
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-loopt-border">
    <div class="flex items-center gap-4">
      {#if pickerMode && onClose}
        <button onclick={onClose} class="p-2 hover:bg-loopt-hover rounded-lg transition-colors" aria-label="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      {/if}
      <div>
        <h2 class="text-2xl font-bold text-loopt-text">
          {pickerMode ? 'Select Asset' : 'Brand Assets'}
        </h2>
        <p class="text-sm text-loopt-text-muted">{assets.length} assets</p>
      </div>
    </div>
    
    <div class="flex items-center gap-3">
      {#if isSelecting}
        <span class="text-sm text-loopt-text-muted">{selectedAssets.size} selected</span>
        <button onclick={selectAll} class="px-3 py-1.5 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg text-sm font-medium transition-colors border border-loopt-border">Select All</button>
        <button onclick={clearSelection} class="px-3 py-1.5 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg text-sm font-medium transition-colors border border-loopt-border">Clear</button>
        <button onclick={handleBulkDelete} class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={selectedAssets.size === 0}>
          Delete Selected
        </button>
        <button onclick={() => { isSelecting = false; clearSelection(); }} class="px-3 py-1.5 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg text-sm font-medium transition-colors border border-loopt-border">
          Cancel
        </button>
      {:else}
        <button onclick={() => isSelecting = true} class="px-3 py-1.5 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg text-sm font-medium transition-colors border border-loopt-border">
          Select
        </button>
        <button onclick={() => showUploadModal = true} class="px-4 py-2 bg-loopt-accent hover:opacity-90 text-white rounded-lg font-medium transition-colors flex items-center justify-center">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Upload Assets
        </button>
      {/if}
    </div>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-3 p-4 border-b border-loopt-border bg-loopt-bg/50">
    <!-- Search -->
    <div class="relative flex-1 min-w-[200px] max-w-md">
      <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input 
        type="text" 
        placeholder="Search assets..."
        bind:value={searchQuery}
        class="w-full pl-10 pr-4 py-2 bg-loopt-surface border border-loopt-border rounded-lg text-loopt-text placeholder-loopt-text-muted focus:outline-none focus:border-loopt-accent"
      />
    </div>

    <!-- Folder Filter -->
    <select 
      bind:value={selectedFolder}
      class="px-3 py-2 bg-loopt-surface border border-loopt-border rounded-lg text-loopt-text focus:outline-none focus:border-loopt-accent"
    >
      {#each folders as folder}
        <option value={folder}>{folder}</option>
      {/each}
    </select>

    <!-- Type Filter -->
    <select 
      bind:value={selectedType}
      class="px-3 py-2 bg-loopt-surface border border-loopt-border rounded-lg text-loopt-text focus:outline-none focus:border-loopt-accent"
    >
      <option value="all">All Types</option>
      <option value="image">Images</option>
      <option value="video">Videos</option>
      <option value="logo">Logos</option>
      <option value="graphic">Graphics</option>
    </select>

    <!-- Tags -->
    {#if allTags.length > 0}
      <div class="flex items-center gap-2">
        {#each allTags.slice(0, 5) as tag}
          <button
            onclick={() => {
              if (selectedTags.includes(tag)) {
                selectedTags = selectedTags.filter(t => t !== tag);
              } else {
                selectedTags = [...selectedTags, tag];
              }
            }}
            class="px-2 py-1 text-xs rounded-full transition-colors {selectedTags.includes(tag) ? 'bg-loopt-accent text-white' : 'bg-loopt-surface text-loopt-text-muted hover:bg-loopt-hover'}"
          >
            #{tag}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Assets Grid -->
  <div class="flex-1 overflow-y-auto p-4 {dragOver ? 'bg-loopt-accent/10' : ''}">
    {#if isLoading}
      <div class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-4 border-loopt-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if assets.length === 0}
      <div class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-24 h-24 rounded-full bg-loopt-surface flex items-center justify-center mb-4">
          <svg class="w-12 h-12 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <h3 class="text-xl font-semibold text-loopt-text mb-2">No brand assets yet</h3>
        <p class="text-loopt-text-muted mb-4">Upload your logos, product photos, and brand images</p>
        <button onclick={() => showUploadModal = true} class="px-4 py-2 bg-loopt-accent hover:opacity-90 text-white rounded-lg font-medium transition-colors flex items-center justify-center">
          Upload Your First Asset
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
        {#each assets as asset (asset.id)}
          <button
            class="group relative rounded-xl overflow-hidden bg-loopt-surface aspect-square cursor-pointer hover:ring-2 hover:ring-loopt-accent transition-all {selectedAssets.has(asset.id) ? 'ring-2 ring-loopt-accent' : ''}"
            onclick={() => handleAssetClick(asset)}
          >
            {#if asset.type === 'video'}
              <video 
                src={asset.url}
                class="w-full h-full object-cover"
                muted
              >
                <track kind="captions" />
              </video>
            {:else}
              <img 
                src={asset.url} 
                alt={asset.name}
                class="w-full h-full object-cover"
              />
            {/if}
            
            <!-- Type badge -->
            <div class="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
              {getTypeIcon(asset.type)} {asset.type}
            </div>

            <!-- Selection checkbox -->
            {#if isSelecting}
              <div class="absolute top-2 right-2 w-6 h-6 rounded-full {selectedAssets.has(asset.id) ? 'bg-loopt-accent' : 'bg-black/60'} flex items-center justify-center">
                {#if selectedAssets.has(asset.id)}
                  <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                  </svg>
                {/if}
              </div>
            {/if}

            <!-- Hover overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              <p class="text-white text-sm font-medium truncate">{asset.name}</p>
              <p class="text-white/60 text-xs">{asset.folder} • {formatFileSize(asset.file_size)}</p>
              {#if asset.tags.length > 0}
                <div class="flex flex-wrap gap-1 mt-1">
                  {#each asset.tags.slice(0, 3) as tag}
                    <span class="px-1.5 py-0.5 bg-white/20 rounded text-xs text-white">#{tag}</span>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Quick actions (non-picker mode) -->
            {#if !pickerMode && !isSelecting}
              <button
                onclick={(e) => { e.stopPropagation(); handleDelete(asset); }}
                class="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500"
                aria-label="Delete asset"
              >
                <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- Drop zone overlay -->
    {#if dragOver}
      <div class="absolute inset-0 bg-loopt-accent/20 border-2 border-dashed border-loopt-accent rounded-xl flex items-center justify-center pointer-events-none">
        <div class="text-center">
          <svg class="w-12 h-12 mx-auto text-loopt-accent mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <p class="text-loopt-accent font-medium">Drop files to upload</p>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Upload Modal -->
{#if showUploadModal}
  <div 
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    onclick={() => showUploadModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showUploadModal = false)}
    role="dialog"
    aria-modal="true"
    aria-label="Upload Assets"
    tabindex="-1"
  >
    <div 
      class="bg-loopt-surface rounded-2xl overflow-hidden max-w-lg w-full mx-4"
      onclick={(e) => e.stopPropagation()}
      role="document"
    >
      <div class="p-6 border-b border-loopt-border">
        <h3 class="text-xl font-bold text-loopt-text">Upload Brand Assets</h3>
        <p class="text-sm text-loopt-text-muted mt-1">Add images, videos, logos to your library</p>
      </div>

      <div class="p-6 space-y-4">
        <!-- File picker -->
        <div 
          class="border-2 border-dashed border-loopt-border rounded-xl p-8 text-center cursor-pointer hover:border-loopt-accent transition-colors"
          onclick={() => fileInput?.click()}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
        >
          <input 
            type="file" 
            accept="image/*,video/*" 
            multiple 
            class="hidden" 
            bind:this={fileInput}
            onchange={(e) => uploadFiles = (e.target as HTMLInputElement).files}
          />
          
          {#if uploadFiles && uploadFiles.length > 0}
            <div class="space-y-2">
              <svg class="w-10 h-10 mx-auto text-loopt-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              <p class="text-loopt-text font-medium">{uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} selected</p>
              <p class="text-sm text-loopt-text-muted">Click to change selection</p>
            </div>
          {:else}
            <svg class="w-10 h-10 mx-auto text-loopt-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            <p class="text-loopt-text font-medium">Click to select files</p>
            <p class="text-sm text-loopt-text-muted">or drag and drop</p>
          {/if}
        </div>

        <!-- Folder selection -->
        <div>
          <label class="block text-sm font-medium text-loopt-text mb-2">Folder</label>
          <div class="flex gap-2">
            <select 
              bind:value={uploadFolder}
              class="flex-1 px-3 py-2 bg-loopt-bg border border-loopt-border rounded-lg text-loopt-text"
            >
              {#each folders.filter(f => f !== 'All') as folder}
                <option value={folder}>{folder}</option>
              {/each}
            </select>
            <button 
              onclick={() => showNewFolderInput = !showNewFolderInput}
              class="px-3 py-2 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg font-medium transition-colors border border-loopt-border"
              aria-label="New folder"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          </div>
          
          {#if showNewFolderInput}
            <div class="flex gap-2 mt-2">
              <input 
                type="text"
                placeholder="New folder name"
                bind:value={newFolderName}
                class="flex-1 px-3 py-2 bg-loopt-bg border border-loopt-border rounded-lg text-loopt-text"
              />
              <button onclick={createNewFolder} class="px-3 py-1.5 bg-loopt-accent hover:opacity-90 text-white rounded-lg text-sm font-medium transition-colors">Add</button>
            </div>
          {/if}
        </div>

        <!-- Tags -->
        <div>
          <label class="block text-sm font-medium text-loopt-text mb-2">Tags (comma separated)</label>
          <input 
            type="text"
            placeholder="e.g. product, lifestyle, summer"
            bind:value={uploadTags}
            class="w-full px-3 py-2 bg-loopt-bg border border-loopt-border rounded-lg text-loopt-text placeholder-loopt-text-muted"
          />
        </div>

        <!-- Progress -->
        {#if isUploading}
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-loopt-text">Uploading...</span>
              <span class="text-loopt-accent">{uploadProgress}%</span>
            </div>
            <div class="h-2 bg-loopt-bg rounded-full overflow-hidden">
              <div 
                class="h-full bg-loopt-accent transition-all duration-300"
                style="width: {uploadProgress}%"
              ></div>
            </div>
          </div>
        {/if}
      </div>

      <div class="p-6 border-t border-loopt-border flex justify-end gap-3">
        <button onclick={() => showUploadModal = false} class="px-4 py-2 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg font-medium transition-colors border border-loopt-border">
          Cancel
        </button>
        <button 
          onclick={handleUpload}
          class="px-4 py-2 bg-loopt-accent hover:opacity-90 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!uploadFiles || uploadFiles.length === 0 || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Preview Modal -->
{#if showPreviewModal && previewAsset}
  <div 
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
    onclick={() => showPreviewModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showPreviewModal = false)}
    role="dialog"
    aria-modal="true"
    aria-label="Asset Preview"
    tabindex="-1"
  >
    <div 
      class="bg-loopt-surface rounded-2xl overflow-hidden max-w-4xl max-h-[90vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="document"
    >
      <!-- Preview -->
      <div class="flex-1 bg-black flex items-center justify-center min-h-[400px]">
        {#if previewAsset.type === 'video'}
          <video 
            src={previewAsset.url}
            class="max-w-full max-h-[70vh] object-contain"
            controls
            autoplay
          >
            <track kind="captions" />
          </video>
        {:else}
          <img 
            src={previewAsset.url} 
            alt={previewAsset.name}
            class="max-w-full max-h-[70vh] object-contain"
          />
        {/if}
      </div>
      
      <!-- Info -->
      <div class="p-4 border-t border-loopt-border">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <h3 class="font-medium text-loopt-text text-lg">{previewAsset.name}</h3>
            <div class="flex flex-wrap items-center gap-3 mt-2 text-sm text-loopt-text-muted">
              <span>{previewAsset.folder}</span>
              <span>•</span>
              <span>{previewAsset.type}</span>
              <span>•</span>
              <span>{formatFileSize(previewAsset.file_size)}</span>
              {#if previewAsset.width && previewAsset.height}
                <span>•</span>
                <span>{previewAsset.width} × {previewAsset.height}</span>
              {/if}
            </div>
            {#if previewAsset.tags.length > 0}
              <div class="flex flex-wrap gap-2 mt-3">
                {#each previewAsset.tags as tag}
                  <span class="px-2 py-1 bg-loopt-bg rounded text-xs text-loopt-text-muted">#{tag}</span>
                {/each}
              </div>
            {/if}
          </div>
          <div class="flex gap-2">
            <a 
              href={previewAsset.url} 
              download={previewAsset.name}
              class="px-4 py-2 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg font-medium transition-colors border border-loopt-border"
            >
              Download
            </a>
            <button onclick={() => { handleDelete(previewAsset!); showPreviewModal = false; }} class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors">
              Delete
            </button>
            <button onclick={() => showPreviewModal = false} class="px-4 py-2 bg-loopt-surface hover:bg-loopt-bg text-loopt-text rounded-lg font-medium transition-colors border border-loopt-border">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}


