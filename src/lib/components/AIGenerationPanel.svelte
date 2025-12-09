<script lang="ts">
  import { 
    extractScenesFromCaption,
    generateDualImages,
    generateImage,
    saveGeneratedImage,
    getStylePresets,
    getTrainingImages,
    isGeminiConfigured,
    type StylePreset,
    type ExtractedScene,
    type GenerationResult,
    type TrainingImage
  } from '$lib/services/gemini';
  import TrainingImagesManager from './TrainingImagesManager.svelte';
  import StylePresetManager from './StylePresetManager.svelte';

  // Props
  let { 
    caption = '',
    onImageSelect = (imageUrl: string) => {}
  }: {
    caption: string;
    onImageSelect: (imageUrl: string) => void;
  } = $props();

  // State
  let presets: StylePreset[] = $state([]);
  let selectedPreset: StylePreset | null = $state(null);
  let personalImagesCount = $state(0);
  let brandImagesCount = $state(0);
  
  let extractedScenes: ExtractedScene[] = $state([]);
  let selectedScene: ExtractedScene | null = $state(null);
  
  let literalResult: GenerationResult | null = $state(null);
  let creativeResult: GenerationResult | null = $state(null);
  
  let isExtractingScenes = $state(false);
  let isGenerating = $state(false);
  let generationError = $state('');
  
  let showTrainingManager = $state(false);
  let showPresetManager = $state(false);
  
  let selectedResultType: 'literal' | 'creative' | null = $state(null);

  // Check API configuration
  let apiConfigured = $derived(isGeminiConfigured());

  // Load initial data
  $effect(() => {
    loadInitialData();
  });

  async function loadInitialData() {
    try {
      const [presetsData, personalImages, brandImages] = await Promise.all([
        getStylePresets(),
        getTrainingImages('personal'),
        getTrainingImages('brand_graphic')
      ]);
      presets = presetsData;
      personalImagesCount = personalImages.length;
      brandImagesCount = brandImages.length;
      
      // Select default preset
      if (presets.length > 0) {
        selectedPreset = presets.find(p => p.is_default) || presets[0];
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  async function handleExtractScenes() {
    if (!caption.trim()) {
      generationError = 'Please write a caption first';
      return;
    }

    isExtractingScenes = true;
    generationError = '';
    extractedScenes = [];
    selectedScene = null;

    try {
      extractedScenes = await extractScenesFromCaption(caption);
      if (extractedScenes.length > 0) {
        selectedScene = extractedScenes[0]; // Auto-select first (most literal)
      }
    } catch (error: any) {
      generationError = error.message;
    } finally {
      isExtractingScenes = false;
    }
  }

  async function handleGenerate() {
    if (!selectedPreset) {
      generationError = 'Please select a style preset';
      return;
    }
    if (!caption.trim()) {
      generationError = 'Please write a caption first';
      return;
    }
    if (personalImagesCount === 0) {
      generationError = 'Please upload photos of yourself first';
      return;
    }

    isGenerating = true;
    generationError = '';
    literalResult = null;
    creativeResult = null;
    selectedResultType = null;

    try {
      const result = await generateDualImages(caption, selectedPreset, selectedScene || undefined);
      literalResult = result.literal;
      creativeResult = result.creative;
      
      if (!result.literal.success && !result.creative.success) {
        generationError = result.literal.error || result.creative.error || 'Generation failed';
      }
    } catch (error: any) {
      generationError = error.message;
    } finally {
      isGenerating = false;
    }
  }

  async function handleRegenerateSingle(type: 'literal' | 'creative') {
    if (!selectedPreset || !caption.trim()) return;

    isGenerating = true;
    generationError = '';

    try {
      const result = await generateImage({
        caption,
        preset: selectedPreset,
        scene: selectedScene || undefined,
        interpretationType: type
      });

      if (type === 'literal') {
        literalResult = result;
      } else {
        creativeResult = result;
      }
    } catch (error: any) {
      generationError = error.message;
    } finally {
      isGenerating = false;
    }
  }

  async function handleSelectImage(type: 'literal' | 'creative') {
    const result = type === 'literal' ? literalResult : creativeResult;
    if (!result?.imageUrl) return;

    selectedResultType = type;
    
    try {
      // Save to storage and get permanent URL
      const savedUrl = await saveGeneratedImage(result.imageUrl);
      onImageSelect(savedUrl);
    } catch (error: any) {
      generationError = error.message;
    }
  }

  function handlePresetSelect(preset: StylePreset) {
    selectedPreset = preset;
    showPresetManager = false;
  }
</script>

<div class="h-full flex flex-col bg-loopt-bg rounded-xl overflow-hidden">
  <!-- Header -->
  <div class="px-4 py-3 border-b border-loopt-border bg-gradient-to-r from-purple-500/10 to-blue-500/10">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-loopt-text">AI Image Generation</h3>
          <p class="text-xs text-loopt-text-muted">Powered by Gemini</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="p-1.5 hover:bg-loopt-surface rounded-lg transition-colors"
          onclick={() => showTrainingManager = true}
          title="Manage training images"
        >
          <svg class="w-4 h-4 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </button>
        <button
          class="p-1.5 hover:bg-loopt-surface rounded-lg transition-colors"
          onclick={() => showPresetManager = true}
          title="Style presets"
        >
          <svg class="w-4 h-4 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
          </svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto p-4 space-y-4">
    {#if !apiConfigured}
      <!-- API Not Configured -->
      <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <div>
            <h4 class="font-medium text-yellow-400 text-sm">API Key Required</h4>
            <p class="text-xs text-yellow-300/80 mt-1">
              Add <code class="bg-yellow-500/20 px-1 rounded">VITE_GEMINI_API_KEY</code> to your .env file
            </p>
            <a 
              href="https://aistudio.google.com/apikey" 
              target="_blank"
              class="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 mt-2"
            >
              Get API key →
            </a>
          </div>
        </div>
      </div>
    {:else}
      <!-- Training Images Status -->
      {#if personalImagesCount === 0}
        <button
          class="w-full p-4 border-2 border-dashed border-purple-500/30 rounded-lg hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left"
          onclick={() => showTrainingManager = true}
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-purple-300">Upload photos of yourself</p>
              <p class="text-xs text-purple-300/60">Required for AI to generate images with your likeness</p>
            </div>
          </div>
        </button>
      {:else}
        <div class="flex items-center justify-between p-3 bg-loopt-surface rounded-lg">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center">
              <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div>
              <p class="text-xs text-loopt-text">{personalImagesCount} photos • {brandImagesCount} brand assets</p>
            </div>
          </div>
          <button
            class="text-xs text-loopt-accent hover:underline"
            onclick={() => showTrainingManager = true}
          >
            Manage
          </button>
        </div>
      {/if}

      <!-- Preset Selection -->
      <div>
        <label class="text-xs font-medium text-loopt-text-muted mb-1.5 block">Style Preset</label>
        <button
          class="w-full p-3 bg-loopt-surface border border-loopt-border rounded-lg text-left hover:border-loopt-accent/50 transition-colors"
          onclick={() => showPresetManager = true}
        >
          {#if selectedPreset}
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-loopt-text">{selectedPreset.name}</p>
                <p class="text-xs text-loopt-text-muted">
                  {selectedPreset.settings.output_style} • {selectedPreset.settings.aspect_ratio}
                </p>
              </div>
              <svg class="w-4 h-4 text-loopt-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </div>
          {:else}
            <p class="text-sm text-loopt-text-muted">Select a style preset...</p>
          {/if}
        </button>
      </div>

      <!-- Scene Extraction -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-medium text-loopt-text-muted">Scene Ideas</label>
          <button
            class="text-xs text-loopt-accent hover:underline disabled:opacity-50 disabled:no-underline"
            onclick={handleExtractScenes}
            disabled={isExtractingScenes || !caption.trim()}
          >
            {isExtractingScenes ? 'Analyzing...' : 'Extract from caption'}
          </button>
        </div>
        
        {#if extractedScenes.length > 0}
          <div class="space-y-2">
            {#each extractedScenes as scene, index}
              <button
                class="w-full p-3 rounded-lg border-2 text-left transition-all {selectedScene?.id === scene.id ? 'border-loopt-accent bg-loopt-accent/10' : 'border-loopt-border'}"
                onclick={() => selectedScene = scene}
              >
                <div class="flex items-start gap-2">
                  <span class="w-5 h-5 rounded-full bg-loopt-surface flex items-center justify-center text-xs font-medium text-loopt-text-muted flex-shrink-0">
                    {index + 1}
                  </span>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm text-loopt-text">{scene.description}</p>
                    <p class="text-xs text-loopt-text-muted mt-0.5">
                      {scene.setting} • {scene.mood}
                    </p>
                  </div>
                  <span class="text-xs px-1.5 py-0.5 rounded {index === 0 ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}">
                    {index === 0 ? 'Literal' : 'Creative'}
                  </span>
                </div>
              </button>
            {/each}
          </div>
        {:else}
          <div class="p-4 bg-loopt-surface rounded-lg text-center">
            <p class="text-xs text-loopt-text-muted">
              Write a caption and click "Extract from caption" to get scene suggestions
            </p>
          </div>
        {/if}
      </div>

      <!-- Generate Button -->
      <button
        class="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        onclick={handleGenerate}
        disabled={isGenerating || !selectedPreset || !caption.trim() || personalImagesCount === 0}
      >
        {#if isGenerating}
          <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          Generating both versions...
        {:else}
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          Generate Literal + Creative
        {/if}
      </button>

      <!-- Error Display -->
      {#if generationError}
        <div class="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p class="text-red-400 text-sm">{generationError}</p>
        </div>
      {/if}

      <!-- Results -->
      {#if literalResult || creativeResult}
        <div class="space-y-3">
          <p class="text-xs font-medium text-loopt-text-muted">Generated Images - Click to use</p>
          
          <div class="grid grid-cols-2 gap-3">
            <!-- Literal Result -->
            <div class="space-y-2">
              <div class="text-xs text-center">
                <span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full">Literal</span>
              </div>
              {#if literalResult?.success && literalResult.imageUrl}
                <button
                  class="w-full aspect-square rounded-lg overflow-hidden ring-2 transition-all hover:ring-loopt-accent"
                  class:ring-green-500={selectedResultType === 'literal'}
                  class:ring-transparent={selectedResultType !== 'literal'}
                  onclick={() => handleSelectImage('literal')}
                >
                  <img 
                    src={literalResult.imageUrl} 
                    alt="Literal interpretation" 
                    class="w-full h-full object-cover"
                  />
                </button>
                <button
                  class="w-full py-1.5 text-xs text-loopt-text-muted hover:text-loopt-text transition-colors"
                  onclick={() => handleRegenerateSingle('literal')}
                  disabled={isGenerating}
                >
                  ↻ Regenerate
                </button>
              {:else}
                <div class="aspect-square rounded-lg bg-loopt-surface flex items-center justify-center">
                  <p class="text-xs text-loopt-text-muted text-center px-4">
                    {literalResult?.error || 'Generation pending'}
                  </p>
                </div>
              {/if}
            </div>

            <!-- Creative Result -->
            <div class="space-y-2">
              <div class="text-xs text-center">
                <span class="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full">Creative</span>
              </div>
              {#if creativeResult?.success && creativeResult.imageUrl}
                <button
                  class="w-full aspect-square rounded-lg overflow-hidden ring-2 transition-all hover:ring-loopt-accent"
                  class:ring-green-500={selectedResultType === 'creative'}
                  class:ring-transparent={selectedResultType !== 'creative'}
                  onclick={() => handleSelectImage('creative')}
                >
                  <img 
                    src={creativeResult.imageUrl} 
                    alt="Creative interpretation" 
                    class="w-full h-full object-cover"
                  />
                </button>
                <button
                  class="w-full py-1.5 text-xs text-loopt-text-muted hover:text-loopt-text transition-colors"
                  onclick={() => handleRegenerateSingle('creative')}
                  disabled={isGenerating}
                >
                  ↻ Regenerate
                </button>
              {:else}
                <div class="aspect-square rounded-lg bg-loopt-surface flex items-center justify-center">
                  <p class="text-xs text-loopt-text-muted text-center px-4">
                    {creativeResult?.error || 'Generation pending'}
                  </p>
                </div>
              {/if}
            </div>
          </div>

          {#if selectedResultType}
            <div class="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p class="text-sm text-green-400 text-center">
                ✓ {selectedResultType === 'literal' ? 'Literal' : 'Creative'} image selected and saved
              </p>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Modals -->
<TrainingImagesManager 
  bind:isOpen={showTrainingManager}
  onClose={() => { showTrainingManager = false; loadInitialData(); }}
/>

<StylePresetManager 
  bind:isOpen={showPresetManager}
  onClose={() => showPresetManager = false}
  onPresetSelect={handlePresetSelect}
/>

