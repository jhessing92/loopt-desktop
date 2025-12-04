<script lang="ts">
  import { toasts } from '$lib/stores/contentStore';

  let toastList = $derived($toasts);

  function getToastStyles(type: string): string {
    switch (type) {
      case 'success': return 'bg-emerald-500/20 border-emerald-500 text-emerald-400';
      case 'error': return 'bg-red-500/20 border-red-500 text-red-400';
      case 'warning': return 'bg-amber-500/20 border-amber-500 text-amber-400';
      default: return 'bg-blue-500/20 border-blue-500 text-blue-400';
    }
  }

  function getToastIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  }
</script>

<div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
  {#each toastList as toast (toast.id)}
    <div 
      class="flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in {getToastStyles(toast.type)}"
    >
      <span class="font-bold">{getToastIcon(toast.type)}</span>
      <span class="text-sm font-medium">{toast.message}</span>
      <button 
        class="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        onclick={() => toasts.dismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  {/each}
</div>
