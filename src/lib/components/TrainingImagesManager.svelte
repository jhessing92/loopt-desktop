<script lang="ts">
  import { 
    getTrainingImages, 
    uploadTrainingImage, 
    deleteTrainingImage,
    updateTrainingImageTags,
    extractStyleFromImages,
    type TrainingImage,
    type TrainingImageType
  } from '$lib/services/gemini';

  // Props
  let { 
    isOpen = $bindable(false),
    onClose = () => {}
  }: {
    isOpen: boolean;
    onClose: () => void;
  } = $props();

  // State
  let activeTab: 'personal' | 'brand' = $state('personal');
  let personalImages: TrainingImage[] = $state([]);
  let brandImages: TrainingImage[] = $state([]);
  let isLoading = $state(true);
  let isUploading = $state(false);
  let uploadError = $state('');
  let dragOver = $state(false);
  let selectedImage: TrainingImage | null = $state(null);
  let newTag = $state('');
  let extractingStyle = $state(false);
  let extractedStylePreview: any = $state(null);

  // File input refs
  let fileInputPersonal: HTMLInputElement;
  let fileInputBrand: HTMLInputElement;

  // Load images on mount
  $effect(() => {
    if (isOpen) {
      loadImages();
    }
  });

  async function loadImages() {
    isLoading = true;
    try {
      const [personal, brand] = await Promise.all([
        getTrainingImages('personal'),
        getTrainingImages('brand_graphic')
      ]);
      personalImages = personal;
      brandImages = brand;
    } catch (error: any) {
      console.error('Error loading images:', error);
    } finally {
      isLoading = false;
    }
  }

  async function handleFileSelect(event: Event, type: TrainingImageType) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      await uploadFiles(Array.from(input.files), type);
    }
    input.value = ''; // Reset input
  }

  async function handleDrop(event: DragEvent, type: TrainingImageType) {
    event.preventDefault();
    dragOver = false;
    
    if (event.dataTransfer?.files) {
      await uploadFiles(Array.from(event.dataTransfer.files), type);
    }
  }

  async function uploadFiles(files: File[], type: TrainingImageType) {
    isUploading = true;
    uploadError = '';

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        uploadError = 'Only image files are allowed';
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        uploadError = 'Images must be smaller than 10MB';
        continue;
      }

      try {
        const newImage = await uploadTrainingImage(file, type, []);
        if (type === 'personal') {
          personalImages = [newImage, ...personalImages];
        } else {
          brandImages = [newImage, ...brandImages];
        }
      } catch (error: any) {
        uploadError = error.message;
      }
    }

    isUploading = false;
  }

  async function handleDelete(image: TrainingImage) {
    if (!confirm('Delete this training image?')) return;
    
    try {
      await deleteTrainingImage(image.id);
      if (image.type === 'personal') {
        personalImages = personalImages.filter(i => i.id !== image.id);
      } else {
        brandImages = brandImages.filter(i => i.id !== image.id);
      }
      if (selectedImage?.id === image.id) {
        selectedImage = null;
      }
    } catch (error: any) {
      uploadError = error.message;
    }
  }

  async function addTag() {
    if (!selectedImage || !newTag.trim()) return;
    
    const updatedTags = [...(selectedImage.tags || []), newTag.trim()];
    try {
      await updateTrainingImageTags(selectedImage.id, updatedTags);
      selectedImage.tags = updatedTags;
      
      // Update in list
      if (selectedImage.type === 'personal') {
        personalImages = personalImages.map(i => i.id === selectedImage!.id ? { ...i, tags: updatedTags } : i);
      } else {
        brandImages = brandImages.map(i => i.id === selectedImage!.id ? { ...i, tags: updatedTags } : i);
      }
      
      newTag = '';
    } catch (error: any) {
      uploadError = error.message;
    }
  }

  async function removeTag(tag: string) {
    if (!selectedImage) return;
    
    const updatedTags = selectedImage.tags.filter(t => t !== tag);
    try {
      await updateTrainingImageTags(selectedImage.id, updatedTags);
      selectedImage.tags = updatedTags;
      
      if (selectedImage.type === 'personal') {
        personalImages = personalImages.map(i => i.id === selectedImage!.id ? { ...i, tags: updatedTags } : i);
      } else {
        brandImages = brandImages.map(i => i.id === selectedImage!.id ? { ...i, tags: updatedTags } : i);
      }
    } catch (error: any) {
      uploadError = error.message;
    }
  }

  async function extractBrandStyle() {
    if (brandImages.length < 2) {
      uploadError = 'Upload at least 2 brand graphics to extract style';
      return;
    }

    extractingStyle = true;
    try {
      const urls = brandImages.slice(0, 5).map(img => img.url);
      extractedStylePreview = await extractStyleFromImages(urls);
    } catch (error: any) {
      uploadError = error.message;
    } finally {
      extractingStyle = false;
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function closeManager() {
    isOpen = false;
    onClose();
  }

  // Derived
  let currentImages = $derived(activeTab === 'personal' ? personalImages : brandImages);
  let currentType: TrainingImageType = $derived(activeTab === 'personal' ? 'personal' : 'brand_graphic');
</script>

{#if isOpen}
  <div 
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    onclick={(e) => e.target === e.currentTarget && closeManager()}
    onkeydown={(e) => e.key === 'Escape' && closeManager()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <div class="bg-loopt-surface w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-loopt-border bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-loopt-text">Training Images</h2>
            <p class="text-sm text-loopt-text-muted">Upload photos and brand assets for AI generation</p>
          </div>
        </div>
        <button 
          class="p-2 hover:bg-loopt-surface-hover rounded-lg transition-colors"
          onclick={closeManager}
        >
          <svg class="w-5 h-5 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="flex border-b border-loopt-border">
        <button 
          class="flex-1 py-3 px-4 text-sm font-medium transition-colors relative"
          class:text-loopt-accent={activeTab === 'personal'}
          class:text-loopt-text-muted={activeTab !== 'personal'}
          onclick={() => { activeTab = 'personal'; selectedImage = null; }}
        >
          <div class="flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            My Photos ({personalImages.length})
          </div>
          {#if activeTab === 'personal'}
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-loopt-accent"></div>
          {/if}
        </button>
        <button 
          class="flex-1 py-3 px-4 text-sm font-medium transition-colors relative"
          class:text-loopt-accent={activeTab === 'brand'}
          class:text-loopt-text-muted={activeTab !== 'brand'}
          onclick={() => { activeTab = 'brand'; selectedImage = null; }}
        >
          <div class="flex items-center justify-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
            </svg>
            Brand Assets ({brandImages.length})
          </div>
          {#if activeTab === 'brand'}
            <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-loopt-accent"></div>
          {/if}
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden flex">
        <!-- Left: Image Grid -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Upload Area -->
          <div 
            class="border-2 border-dashed rounded-xl p-6 text-center mb-4 transition-all cursor-pointer {dragOver ? 'border-loopt-accent bg-loopt-accent/10' : 'border-loopt-border bg-loopt-surface-hover'}"
            onclick={() => activeTab === 'personal' ? fileInputPersonal.click() : fileInputBrand.click()}
            ondrop={(e) => handleDrop(e, currentType)}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && (activeTab === 'personal' ? fileInputPersonal.click() : fileInputBrand.click())}
          >
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              class="hidden" 
              bind:this={fileInputPersonal}
              onchange={(e) => handleFileSelect(e, 'personal')}
            />
            <input 
              type="file" 
              accept="image/*" 
              multiple 
              class="hidden" 
              bind:this={fileInputBrand}
              onchange={(e) => handleFileSelect(e, 'brand_graphic')}
            />
            
            {#if isUploading}
              <div class="flex flex-col items-center">
                <div class="w-8 h-8 border-4 border-loopt-accent border-t-transparent rounded-full animate-spin mb-2"></div>
                <p class="text-loopt-text-muted text-sm">Uploading...</p>
              </div>
            {:else}
              <div class="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                <svg class="w-6 h-6 text-loopt-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
              </div>
              <p class="text-loopt-text font-medium text-sm mb-1">
                {activeTab === 'personal' ? 'Upload photos of yourself' : 'Upload brand graphics'}
              </p>
              <p class="text-loopt-text-muted text-xs">
                {activeTab === 'personal' 
                  ? 'Include various angles, expressions, and lighting'
                  : 'Past content, templates, brand assets'}
              </p>
            {/if}
          </div>

          {#if uploadError}
            <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <p class="text-red-400 text-sm">{uploadError}</p>
            </div>
          {/if}

          <!-- Tips -->
          {#if activeTab === 'personal' && personalImages.length < 10}
            <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 mb-4">
              <p class="text-purple-300 text-sm font-medium mb-1">💡 Tips for best likeness results:</p>
              <ul class="text-purple-300/80 text-xs space-y-0.5">
                <li>• Upload 10-15 photos for best results</li>
                <li>• Include front, 3/4 angle, and profile shots</li>
                <li>• Mix expressions: smiling, neutral, speaking</li>
                <li>• Use different outfits and lighting</li>
              </ul>
            </div>
          {/if}

          {#if activeTab === 'brand' && brandImages.length >= 2}
            <button
              class="w-full mb-4 py-2 px-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg text-sm text-purple-300 hover:from-purple-500/30 hover:to-blue-500/30 transition-all flex items-center justify-center gap-2"
              onclick={extractBrandStyle}
              disabled={extractingStyle}
            >
              {#if extractingStyle}
                <div class="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin"></div>
                Analyzing style...
              {:else}
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                Extract Brand Style
              {/if}
            </button>
          {/if}

          <!-- Extracted Style Preview -->
          {#if extractedStylePreview}
            <div class="bg-loopt-bg rounded-lg p-3 mb-4">
              <p class="text-sm font-medium text-loopt-text mb-2">Extracted Brand Style</p>
              <div class="flex gap-2 mb-2">
                {#each extractedStylePreview.dominant_colors || [] as color}
                  <div 
                    class="w-6 h-6 rounded border border-loopt-border" 
                    style="background-color: {color}"
                    title={color}
                  ></div>
                {/each}
              </div>
              <p class="text-xs text-loopt-text-muted">
                <strong>Mood:</strong> {extractedStylePreview.mood} | 
                <strong>Composition:</strong> {extractedStylePreview.composition_type}
              </p>
            </div>
          {/if}

          <!-- Images Grid -->
          {#if isLoading}
            <div class="flex justify-center py-8">
              <div class="w-8 h-8 border-4 border-loopt-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          {:else if currentImages.length === 0}
            <div class="text-center py-8">
              <p class="text-loopt-text-muted">No images uploaded yet</p>
            </div>
          {:else}
            <div class="grid grid-cols-4 gap-3">
              {#each currentImages as image (image.id)}
                <button 
                  class="relative aspect-square rounded-lg overflow-hidden group cursor-pointer ring-2 transition-all"
                  class:ring-loopt-accent={selectedImage?.id === image.id}
                  class:ring-transparent={selectedImage?.id !== image.id}
                  class:hover:ring-loopt-border={selectedImage?.id !== image.id}
                  onclick={() => selectedImage = selectedImage?.id === image.id ? null : image}
                >
                  <img 
                    src={image.url} 
                    alt={image.name}
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                  </div>
                  {#if image.tags && image.tags.length > 0}
                    <div class="absolute bottom-1 left-1 right-1 flex gap-1 flex-wrap">
                      {#each image.tags.slice(0, 2) as tag}
                        <span class="px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white">{tag}</span>
                      {/each}
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Right: Selected Image Details -->
        {#if selectedImage}
          <div class="w-80 border-l border-loopt-border p-4 overflow-y-auto">
            <div class="aspect-square rounded-lg overflow-hidden mb-4">
              <img 
                src={selectedImage.url} 
                alt={selectedImage.name}
                class="w-full h-full object-cover"
              />
            </div>
            
            <h3 class="font-medium text-loopt-text text-sm mb-1 truncate">{selectedImage.name}</h3>
            <p class="text-xs text-loopt-text-muted mb-4">
              {new Date(selectedImage.created_at).toLocaleDateString()}
            </p>

            <!-- Tags -->
            <div class="mb-4">
              <label class="text-xs font-medium text-loopt-text-muted mb-2 block">Tags</label>
              <div class="flex flex-wrap gap-1 mb-2">
                {#each selectedImage.tags || [] as tag}
                  <span class="inline-flex items-center gap-1 px-2 py-1 bg-loopt-bg rounded-full text-xs text-loopt-text">
                    {tag}
                    <button 
                      class="hover:text-red-400 transition-colors"
                      onclick={() => removeTag(tag)}
                    >×</button>
                  </span>
                {/each}
              </div>
              <div class="flex gap-2">
                <input 
                  type="text" 
                  class="flex-1 bg-loopt-bg border border-loopt-border rounded px-2 py-1 text-xs text-loopt-text"
                  placeholder="Add tag..."
                  bind:value={newTag}
                  onkeydown={(e) => e.key === 'Enter' && addTag()}
                />
                <button 
                  class="px-2 py-1 bg-loopt-accent text-white rounded text-xs"
                  onclick={addTag}
                >Add</button>
              </div>
            </div>

            <!-- Delete Button -->
            <button
              class="w-full py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
              onclick={() => handleDelete(selectedImage!)}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Delete Image
            </button>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-loopt-border flex items-center justify-between">
        <div class="text-sm text-loopt-text-muted">
          {personalImages.length} personal photos • {brandImages.length} brand assets
        </div>
        <button 
          class="btn-primary"
          onclick={closeManager}
        >
          Done
        </button>
      </div>
    </div>
  </div>
{/if}

