import { writable, derived, get } from 'svelte/store';
import type { ContentPost, PlatformConfig, AppState, ContentStatus, Platform, Toast } from '$lib/types';
import { api } from '$lib/services/api';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Posts store
function createPostsStore() {
  const { subscribe, set, update } = writable<ContentPost[]>([]);
  
  return {
    subscribe,
    set,
    update,
    addPost: (post: ContentPost) => update(posts => [...posts, post]),
    updatePost: (id: string, updates: Partial<ContentPost>) => 
      update(posts => posts.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date() } : p)),
    removePost: (id: string) => update(posts => posts.filter(p => p.id !== id)),
    getById: (id: string) => {
      const posts = get({ subscribe });
      return posts.find(p => p.id === id);
    },
  };
}

export const posts = createPostsStore();

// Platforms store
export const platforms = writable<PlatformConfig[]>([]);
export const selectedPlatform = writable<PlatformConfig | null>(null);

// App state store
export const appState = writable<AppState>({
  selectedDate: new Date(),
  selectedPost: null,
  isEditorOpen: false,
  isCreating: false,
  view: 'calendar',
  filterStatus: 'all',
  filterPlatform: 'all',
});

// Loading states
export const isLoading = writable(false);
export const isSyncing = writable(false);

// Real-time subscription
let realtimeSubscription: RealtimeChannel | null = null;

// Toast notifications
function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);
  
  return {
    subscribe,
    show: (message: string, type: Toast['type'] = 'info', duration = 3000) => {
      const id = crypto.randomUUID();
      update(toasts => [...toasts, { id, message, type, duration }]);
      
      if (duration > 0) {
        setTimeout(() => {
          update(toasts => toasts.filter(t => t.id !== id));
        }, duration);
      }
      
      return id;
    },
    dismiss: (id: string) => update(toasts => toasts.filter(t => t.id !== id)),
    clear: () => update(() => []),
  };
}

export const toasts = createToastStore();

// Derived stores
export const filteredPosts = derived(
  [posts, appState],
  ([$posts, $appState]) => {
    return $posts.filter(post => {
      if ($appState.filterStatus !== 'all' && post.status !== $appState.filterStatus) return false;
      if ($appState.filterPlatform !== 'all' && post.platform !== $appState.filterPlatform) return false;
      return true;
    });
  }
);

export const postsByDate = derived(filteredPosts, ($filteredPosts) => {
  const map = new Map<string, ContentPost[]>();
  
  $filteredPosts.forEach(post => {
    const dateKey = post.scheduled_date.toISOString().split('T')[0];
    const existing = map.get(dateKey) || [];
    map.set(dateKey, [...existing, post]);
  });
  
  return map;
});

export const stats = derived(posts, ($posts) => ({
  total: $posts.length,
  draft: $posts.filter(p => p.status === 'draft').length,
  pending: $posts.filter(p => p.status === 'pending').length,
  approved: $posts.filter(p => p.status === 'approved').length,
  rejected: $posts.filter(p => p.status === 'rejected').length,
}));

// Content store with actions
export const contentStore = {
  async initialize() {
    isLoading.set(true);
    try {
      const platformList = await api.getPlatforms();
      platforms.set(platformList);
      
      if (platformList.length > 0) {
        selectedPlatform.set(platformList[0]);
        await this.loadPosts(platformList[0].gid);
      }

      // Set up real-time subscription
      this.setupRealtimeSubscription();
    } catch (error) {
      toasts.show('Failed to initialize app', 'error');
      console.error('Initialize error:', error);
    } finally {
      isLoading.set(false);
    }
  },

  setupRealtimeSubscription() {
    // Clean up existing subscription
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
    }

    realtimeSubscription = api.subscribeToChanges((payload) => {
      console.log('Real-time update received:', payload);
      
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      switch (eventType) {
        case 'INSERT':
          // New post created (maybe from mobile app)
          if (newRecord) {
            toasts.show('New content received', 'info');
            this.syncWithServer();
          }
          break;
          
        case 'UPDATE':
          // Post updated (status change from mobile app)
          if (newRecord) {
            const updatedPost = posts.getById(newRecord.id);
            if (updatedPost) {
              const statusChanged = updatedPost.status !== newRecord.status;
              
              posts.updatePost(newRecord.id, {
                status: newRecord.status,
                rejection_reason: newRecord.rejection_reason,
                approved_at: newRecord.approved_at ? new Date(newRecord.approved_at) : undefined,
                caption: newRecord.caption,
              });

              if (statusChanged) {
                if (newRecord.status === 'approved') {
                  toasts.show('Content approved! ✓', 'success');
                } else if (newRecord.status === 'rejected') {
                  toasts.show('Content rejected - see feedback', 'error');
                }
              }
            }
          }
          break;
          
        case 'DELETE':
          // Post deleted
          if (oldRecord) {
            posts.removePost(oldRecord.id);
            toasts.show('Content removed', 'info');
          }
          break;
      }
    });

    if (realtimeSubscription) {
      console.log('Real-time subscription established');
    }
  },

  async loadPosts(gid: string) {
    isLoading.set(true);
    try {
      const postList = await api.getPosts(gid);
      posts.set(postList);
    } catch (error) {
      toasts.show('Failed to load posts', 'error');
      console.error('Load posts error:', error);
    } finally {
      isLoading.set(false);
    }
  },

  async createPost(post: Partial<ContentPost>) {
    const platform = get(selectedPlatform);
    if (!platform) {
      toasts.show('No platform selected', 'error');
      return;
    }

    try {
      const newPost = await api.createPost(post, platform.gid);
      posts.addPost(newPost);
      toasts.show('Post created and saved', 'success');
      return newPost;
    } catch (error) {
      toasts.show('Failed to create post', 'error');
      throw error;
    }
  },

  async updatePost(id: string, updates: Partial<ContentPost>) {
    const post = posts.getById(id);
    if (!post) return;

    try {
      posts.updatePost(id, updates);
      await api.updatePost({ ...post, ...updates });
      toasts.show('Changes saved', 'success');
    } catch (error) {
      toasts.show('Failed to save changes', 'error');
      throw error;
    }
  },

  async submitForReview(id: string) {
    const post = posts.getById(id);
    if (!post) return;

    try {
      posts.updatePost(id, { status: 'pending' });
      await api.submitForReview(post);
      toasts.show('Submitted for review - check mobile app', 'success');
    } catch (error) {
      posts.updatePost(id, { status: 'draft' });
      toasts.show('Failed to submit for review', 'error');
      throw error;
    }
  },

  async deletePost(id: string) {
    const post = posts.getById(id);
    if (!post) return;

    try {
      await api.deletePost(id);
      posts.removePost(id);
      toasts.show('Post deleted', 'success');
    } catch (error) {
      toasts.show('Failed to delete post', 'error');
      throw error;
    }
  },

  async syncWithServer() {
    const platform = get(selectedPlatform);
    if (!platform) return;

    isSyncing.set(true);
    try {
      await this.loadPosts(platform.gid);
      toasts.show('Synced with server', 'success');
    } catch (error) {
      toasts.show('Sync failed', 'error');
    } finally {
      isSyncing.set(false);
    }
  },

  // UI Actions
  openEditor(post?: ContentPost) {
    appState.update(state => ({
      ...state,
      selectedPost: post || null,
      isEditorOpen: true,
      isCreating: !post,
    }));
  },

  closeEditor() {
    appState.update(state => ({
      ...state,
      selectedPost: null,
      isEditorOpen: false,
      isCreating: false,
    }));
  },

  selectDate(date: Date) {
    appState.update(state => ({ ...state, selectedDate: date }));
  },

  setView(view: AppState['view']) {
    appState.update(state => ({ ...state, view }));
  },

  setFilterStatus(status: ContentStatus | 'all') {
    appState.update(state => ({ ...state, filterStatus: status }));
  },

  setFilterPlatform(platform: Platform | 'all') {
    appState.update(state => ({ ...state, filterPlatform: platform }));
  },

  // Cleanup on destroy
  destroy() {
    if (realtimeSubscription) {
      realtimeSubscription.unsubscribe();
      realtimeSubscription = null;
    }
  },
};
