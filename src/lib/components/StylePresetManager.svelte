<script lang="ts">
  import { 
    getStylePresets, 
    createStylePreset, 
    updateStylePreset,
    deleteStylePreset,
    getTrainingImages,
    DEFAULT_PRESET,
    type StylePreset,
    type TrainingImage,
    type OutputStyle,
    type AspectRatio
  } from '$lib/services/gemini';

  // Props
  let { 
    isOpen = $bindable(false),
    onClose = () => {},
    onPresetSelect = (preset: StylePreset) => {}
  }: {
    isOpen: boolean;
    onClose: () => void;
    onPresetSelect: (preset: StylePreset) => void;
  } = $props();

  // State
  let presets: StylePreset[] = $state([]);
  let personalImages: TrainingImage[] = $state([]);
  let brandImages: TrainingImage[] = $state([]);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state('');
  
  // Editing state
  let editingPreset: Partial<StylePreset> | null = $state(null);
  let isCreating = $state(false);

  // Load data when opened
  $effect(() => {
    if (isOpen) {
      loadData();
    }
  });

  async function loadData() {
    isLoading = true;
    try {
      const [presetsData, personal, brand] = await Promise.all([
        getStylePresets(),
        getTrainingImages('personal'),
        getTrainingImages('brand_graphic')
      ]);
      presets = presetsData;
      personalImages = personal;
      brandImages = brand;
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }

  function startCreating() {
    isCreating = true;
    editingPreset = {
      name: '',
      description: '',
      personal_images: personalImages.slice(0, 6).map(i => i.id),
      brand_images: brandImages.slice(0, 3).map(i => i.id),
      settings: { ...DEFAULT_PRESET.settings }
    };
  }

  function startEditing(preset: StylePreset) {
    isCreating = false;
    editingPreset = { ...preset, settings: { ...preset.settings } };
  }

  function cancelEditing() {
    editingPreset = null;
    isCreating = false;
  }

  async function savePreset() {
    if (!editingPreset?.name) {
      error = 'Preset name is required';
      return;
    }

    isSaving = true;
    error = '';

    try {
      if (isCreating) {
        const newPreset = await createStylePreset(editingPreset as any);
        presets = [newPreset, ...presets];
      } else if (editingPreset.id) {
        await updateStylePreset(editingPreset.id, editingPreset);
        presets = presets.map(p => p.id === editingPreset!.id ? { ...p, ...editingPreset } as StylePreset : p);
      }
      editingPreset = null;
      isCreating = false;
    } catch (err: any) {
      error = err.message;
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete(preset: StylePreset) {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;
    
    try {
      await deleteStylePreset(preset.id);
      presets = presets.filter(p => p.id !== preset.id);
    } catch (err: any) {
      error = err.message;
    }
  }

  function selectPreset(preset: StylePreset) {
    onPresetSelect(preset);
    closeManager();
  }

  function toggleImageSelection(imageId: string, type: 'personal' | 'brand') {
    if (!editingPreset) return;
    
    const key = type === 'personal' ? 'personal_images' : 'brand_images';
    const current = editingPreset[key] || [];
    
    if (current.includes(imageId)) {
      editingPreset[key] = current.filter(id => id !== imageId);
    } else {
      editingPreset[key] = [...current, imageId];
    }
  }

  function closeManager() {
    editingPreset = null;
    isCreating = false;
    isOpen = false;
    onClose();
  }

  // Aspect ratio options
  const aspectRatios: { value: AspectRatio; label: string; icon: string }[] = [
    { value: '1:1', label: 'Square', icon: '⬜' },
    { value: '4:5', label: 'Portrait', icon: '📱' },
    { value: '16:9', label: 'Wide', icon: '🖥️' },
    { value: '9:16', label: 'Story', icon: '📲' }
  ];

  const outputStyles: { value: OutputStyle; label: string; description: string }[] = [
    { value: 'photorealistic', label: 'Photorealistic', description: 'Looks like a real photograph' },
    { value: 'stylized', label: 'Stylized', description: 'Artistic, graphic design aesthetic' }
  ];
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
    <div class="bg-loopt-surface w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-loopt-border">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
            </svg>
          </div>
          <div>
            <h2 class="text-xl font-bold text-loopt-text">
              {editingPreset ? (isCreating ? 'Create Preset' : 'Edit Preset') : 'Style Presets'}
            </h2>
            <p class="text-sm text-loopt-text-muted">
              {editingPreset ? 'Configure your generation settings' : 'Manage your saved generation styles'}
            </p>
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

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if error}
          <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p class="text-red-400 text-sm">{error}</p>
          </div>
        {/if}

        {#if editingPreset}
          <!-- Edit/Create Form -->
          <div class="space-y-6">
            <!-- Basic Info -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Preset Name</label>
                <input 
                  type="text" 
                  class="input"
                  placeholder="e.g., Professional Speaker"
                  bind:value={editingPreset.name}
                />
              </div>
              <div>
                <label class="label">Description</label>
                <input 
                  type="text" 
                  class="input"
                  placeholder="Brief description..."
                  bind:value={editingPreset.description}
                />
              </div>
            </div>

            <!-- Output Style -->
            <div>
              <label class="label">Output Style</label>
              <div class="grid grid-cols-2 gap-3">
                {#each outputStyles as style}
                  <button
                    class="p-4 rounded-xl border-2 text-left transition-all {editingPreset.settings?.output_style === style.value ? 'border-loopt-accent bg-loopt-accent/10' : 'border-loopt-border'}"
                    onclick={() => editingPreset!.settings!.output_style = style.value}
                  >
                    <div class="font-medium text-loopt-text">{style.label}</div>
                    <div class="text-sm text-loopt-text-muted">{style.description}</div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Aspect Ratio -->
            <div>
              <label class="label">Aspect Ratio</label>
              <div class="flex gap-2">
                {#each aspectRatios as ratio}
                  <button
                    class="flex-1 py-3 rounded-lg border-2 font-medium text-sm transition-all {editingPreset.settings?.aspect_ratio === ratio.value ? 'border-loopt-accent bg-loopt-accent/10 text-loopt-accent' : 'border-loopt-border text-loopt-text-muted'}"
                    onclick={() => editingPreset!.settings!.aspect_ratio = ratio.value}
                  >
                    <span class="mr-1">{ratio.icon}</span>
                    {ratio.label}
                  </button>
                {/each}
              </div>
            </div>

            <!-- Reference Image Count -->
            <div>
              <label class="label">Reference Images to Use ({editingPreset.settings?.num_reference_images || 6})</label>
              <input 
                type="range" 
                min="3" 
                max="10" 
                class="w-full"
                bind:value={editingPreset.settings!.num_reference_images}
              />
              <div class="flex justify-between text-xs text-loopt-text-muted mt-1">
                <span>Faster (3)</span>
                <span>More accurate (10)</span>
              </div>
            </div>

            <!-- Personal Photos Selection -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="label mb-0">Personal Photos ({editingPreset.personal_images?.length || 0} selected)</label>
              </div>
              {#if personalImages.length === 0}
                <p class="text-loopt-text-muted text-sm">No personal photos uploaded yet</p>
              {:else}
                <div class="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
                  {#each personalImages as image}
                    <button
                      class="aspect-square rounded overflow-hidden ring-2 transition-all"
                      class:ring-loopt-accent={editingPreset.personal_images?.includes(image.id)}
                      class:ring-transparent={!editingPreset.personal_images?.includes(image.id)}
                      onclick={() => toggleImageSelection(image.id, 'personal')}
                    >
                      <img src={image.url} alt={image.name} class="w-full h-full object-cover" />
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Brand Assets Selection -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="label mb-0">Brand Assets ({editingPreset.brand_images?.length || 0} selected)</label>
              </div>
              {#if brandImages.length === 0}
                <p class="text-loopt-text-muted text-sm">No brand assets uploaded yet</p>
              {:else}
                <div class="grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
                  {#each brandImages as image}
                    <button
                      class="aspect-square rounded overflow-hidden ring-2 transition-all"
                      class:ring-loopt-accent={editingPreset.brand_images?.includes(image.id)}
                      class:ring-transparent={!editingPreset.brand_images?.includes(image.id)}
                      onclick={() => toggleImageSelection(image.id, 'brand')}
                    >
                      <img src={image.url} alt={image.name} class="w-full h-full object-cover" />
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Prompt Modifiers -->
            <div>
              <label class="label">Prompt Modifiers</label>
              <textarea 
                class="textarea h-20"
                placeholder="Additional instructions for image generation (e.g., 'professional lighting, clean background')"
                bind:value={editingPreset.settings!.prompt_modifiers}
              ></textarea>
            </div>

            <!-- Brand Colors -->
            <div>
              <label class="flex items-center gap-2 mb-2">
                <input 
                  type="checkbox" 
                  class="rounded border-loopt-border"
                  bind:checked={editingPreset.settings!.enforce_brand_colors}
                />
                <span class="text-sm text-loopt-text">Enforce Brand Colors</span>
              </label>
              {#if editingPreset.settings?.enforce_brand_colors}
                <input 
                  type="text" 
                  class="input"
                  placeholder="#1a1a2e, #e94560, #0f3460"
                  value={editingPreset.settings?.brand_colors?.join(', ') || ''}
                  oninput={(e) => editingPreset!.settings!.brand_colors = e.currentTarget.value.split(',').map(c => c.trim()).filter(c => c)}
                />
              {/if}
            </div>
          </div>
        {:else if isLoading}
          <div class="flex justify-center py-12">
            <div class="w-8 h-8 border-4 border-loopt-accent border-t-transparent rounded-full animate-spin"></div>
          </div>
        {:else}
          <!-- Presets List -->
          <div class="space-y-3">
            {#each presets as preset}
              <div class="bg-loopt-bg rounded-xl p-4 flex items-center justify-between group">
                <div class="flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-medium text-loopt-text">{preset.name}</h3>
                    {#if preset.is_default}
                      <span class="px-2 py-0.5 bg-loopt-accent/20 text-loopt-accent text-xs rounded-full">Default</span>
                    {/if}
                  </div>
                  <p class="text-sm text-loopt-text-muted">{preset.description || 'No description'}</p>
                  <div class="flex gap-4 mt-2 text-xs text-loopt-text-muted">
                    <span>{preset.settings.output_style}</span>
                    <span>{preset.settings.aspect_ratio}</span>
                    <span>{preset.personal_images?.length || 0} photos</span>
                    <span>{preset.brand_images?.length || 0} brand assets</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    class="p-2 hover:bg-loopt-surface rounded-lg transition-colors"
                    onclick={() => startEditing(preset)}
                    title="Edit"
                  >
                    <svg class="w-4 h-4 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button
                    class="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    onclick={() => handleDelete(preset)}
                    title="Delete"
                  >
                    <svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                  <button
                    class="px-4 py-2 bg-loopt-accent text-white rounded-lg text-sm font-medium hover:bg-loopt-accent/90 transition-colors"
                    onclick={() => selectPreset(preset)}
                  >
                    Use
                  </button>
                </div>
              </div>
            {/each}

            {#if presets.length === 0}
              <div class="text-center py-12">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-loopt-bg flex items-center justify-center">
                  <svg class="w-8 h-8 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
                  </svg>
                </div>
                <h3 class="text-lg font-medium text-loopt-text mb-2">No presets yet</h3>
                <p class="text-loopt-text-muted mb-4">Create your first style preset to get started</p>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-loopt-border flex items-center justify-between">
        {#if editingPreset}
          <button 
            class="btn-secondary"
            onclick={cancelEditing}
          >
            Cancel
          </button>
          <button 
            class="btn-primary"
            onclick={savePreset}
            disabled={isSaving}
          >
            {#if isSaving}
              <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
            {/if}
            {isCreating ? 'Create Preset' : 'Save Changes'}
          </button>
        {:else}
          <div class="text-sm text-loopt-text-muted">
            {presets.length} preset{presets.length !== 1 ? 's' : ''}
          </div>
          <button 
            class="btn-primary"
            onclick={startCreating}
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
            </svg>
            New Preset
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

