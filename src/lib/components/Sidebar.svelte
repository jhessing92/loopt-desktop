<script lang="ts">
  import { appState, platforms, selectedPlatform, stats, isSyncing, contentStore } from '$lib/stores/contentStore';
  import type { PlatformConfig } from '$lib/types';

  let currentView = $derived($appState.view);
  let currentStats = $derived($stats);
  let platformList = $derived($platforms);
  let currentPlatform = $derived($selectedPlatform);
  let syncing = $derived($isSyncing);

  async function handlePlatformChange(platform: PlatformConfig) {
    selectedPlatform.set(platform);
    await contentStore.loadPosts(platform.gid);
  }

  function setView(view: 'calendar' | 'list' | 'media' | 'assets') {
    contentStore.setView(view);
  }
</script>

<aside class="w-64 bg-loopt-surface border-r border-loopt-border flex flex-col h-full">
  <!-- Logo -->
  <div class="p-6 border-b border-loopt-border">
    <h1 class="text-xl font-bold text-loopt-text flex items-center gap-2">
      <svg class="w-8 h-8 text-loopt-accent" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      Loopt Desktop
    </h1>
    <p class="text-sm text-loopt-text-muted mt-1">Content Manager</p>
  </div>

  <!-- Platform Selector -->
  <div class="p-4 border-b border-loopt-border">
    <span class="label" id="platform-label">Platform</span>
    <select 
      class="select"
      aria-labelledby="platform-label"
      value={currentPlatform?.gid || ''}
      onchange={(e) => {
        const platform = platformList.find(p => p.gid === e.currentTarget.value);
        if (platform) handlePlatformChange(platform);
      }}
    >
      {#each platformList as platform}
        <option value={platform.gid}>{platform.platform}</option>
      {/each}
    </select>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 p-4 space-y-2">
    <button 
      class="sidebar-item w-full" 
      class:active={currentView === 'calendar'}
      onclick={() => setView('calendar')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      Calendar
    </button>

    <button 
      class="sidebar-item w-full" 
      class:active={currentView === 'list'}
      onclick={() => setView('list')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
      </svg>
      All Posts
    </button>

    <button 
      class="sidebar-item w-full" 
      class:active={currentView === 'media'}
      onclick={() => setView('media')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>
      Media Library
    </button>

    <button 
      class="sidebar-item w-full" 
      class:active={currentView === 'assets'}
      onclick={() => setView('assets')}
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
      </svg>
      Brand Assets
    </button>
  </nav>

  <!-- Stats -->
  <div class="p-4 border-t border-loopt-border">
    <h3 class="text-xs font-semibold text-loopt-text-muted uppercase tracking-wide mb-3">Stats</h3>
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-loopt-bg rounded-lg p-3">
        <div class="text-2xl font-bold text-loopt-text">{currentStats.total}</div>
        <div class="text-xs text-loopt-text-muted">Total</div>
      </div>
      <div class="bg-violet-500/10 rounded-lg p-3">
        <div class="text-2xl font-bold text-violet-400">{currentStats.pending}</div>
        <div class="text-xs text-violet-400/70">Pending</div>
      </div>
      <div class="bg-emerald-500/10 rounded-lg p-3">
        <div class="text-2xl font-bold text-emerald-400">{currentStats.approved}</div>
        <div class="text-xs text-emerald-400/70">Approved</div>
      </div>
      <div class="bg-red-500/10 rounded-lg p-3">
        <div class="text-2xl font-bold text-red-400">{currentStats.rejected}</div>
        <div class="text-xs text-red-400/70">Rejected</div>
      </div>
    </div>
  </div>

  <!-- Sync Button -->
  <div class="p-4 border-t border-loopt-border space-y-2">
    <button 
      class="btn-secondary w-full justify-center"
      onclick={() => contentStore.syncWithServer()}
      disabled={syncing}
    >
      <svg 
        class="w-5 h-5 {syncing ? 'animate-spin' : ''}" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      {syncing ? 'Syncing...' : 'Sync Now'}
    </button>

    <!-- Mobile App Preview Button -->
    <a 
      href="https://loopt.shooflyai.com"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg shadow-purple-500/20"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/>
      </svg>
      Open Mobile App
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
      </svg>
    </a>
  </div>
</aside>
