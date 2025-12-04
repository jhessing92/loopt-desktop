<script lang="ts">
  import type { MediaFile } from '$lib/types';
  
  interface Props {
    files: MediaFile[];
    onchange: (files: MediaFile[]) => void;
  }

  let { files = [], onchange }: Props = $props();
  
  let isDragging = $state(false);
  let fileInput: HTMLInputElement;

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles) {
      processFiles(droppedFiles);
    }
  }

  function handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) {
      processFiles(input.files);
    }
  }

  function processFiles(fileList: FileList) {
    const newFiles: MediaFile[] = [];
    
    for (const file of fileList) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      
      if (!isVideo && !isImage) continue;
      
      const mediaFile: MediaFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type: isVideo ? 'video' : 'image',
        url: URL.createObjectURL(file),
        size: file.size,
      };
      
      newFiles.push(mediaFile);
    }
    
    onchange([...files, ...newFiles]);
  }

  function removeFile(id: string) {
    const file = files.find(f => f.id === id);
    if (file?.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
    }
    onchange(files.filter(f => f.id !== id));
  }

  function formatFileSize(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  }
</script>

<div class="space-y-4">
  <!-- Drop Zone -->
  <div 
    class="drop-zone {isDragging ? 'active' : ''}"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    onclick={() => fileInput.click()}
    onkeydown={handleKeyDown}
    role="button"
    tabindex="0"
    aria-label="Upload files by clicking or dropping"
  >
    <input 
      type="file" 
      class="hidden" 
      accept="image/*,video/*"
      multiple
      bind:this={fileInput}
      onchange={handleFileSelect}
    />
    
    <div class="flex flex-col items-center gap-3">
      <div class="w-16 h-16 rounded-full bg-loopt-accent/10 flex items-center justify-center">
        <svg class="w-8 h-8 text-loopt-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
        </svg>
      </div>
      <div class="text-center">
        <p class="text-loopt-text font-medium">Drop files here or click to upload</p>
        <p class="text-sm text-loopt-text-muted mt-1">Supports: JPG, PNG, GIF, MP4, MOV</p>
      </div>
    </div>
  </div>

  <!-- File Preview Grid -->
  {#if files.length > 0}
    <div class="grid grid-cols-2 gap-3">
      {#each files as file}
        <div class="relative group rounded-lg overflow-hidden bg-loopt-bg border border-loopt-border">
          {#if file.type === 'video'}
            <video 
              src={file.url} 
              class="w-full h-32 object-cover"
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
              src={file.url} 
              alt={file.name}
              class="w-full h-32 object-cover"
            />
          {/if}
          
          <!-- Overlay with info and actions -->
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
            <p class="text-white text-sm truncate">{file.name}</p>
            {#if file.size}
              <p class="text-white/60 text-xs">{formatFileSize(file.size)}</p>
            {/if}
          </div>
          
          <!-- Remove Button -->
          <button 
            class="absolute top-2 right-2 w-7 h-7 bg-loopt-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-loopt-error/80"
            onclick={() => removeFile(file.id)}
            aria-label="Remove file"
          >
            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
