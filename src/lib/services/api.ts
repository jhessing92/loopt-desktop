import axios from 'axios';
import { supabase, supabaseAdmin, type ContentItem } from './supabase';
import type { ContentPost, PlatformConfig, ContentStatus } from '$lib/types';

// Use admin client for write operations (bypasses RLS)
const writeClient = supabaseAdmin || supabase;

// Use environment variable or default to localhost
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:7328';

const createAxiosInstance = () => {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
};

// Transform Supabase ContentItem to app ContentPost format
function supabaseToContentPost(item: ContentItem): ContentPost {
  return {
    id: item.id,
    created_at: new Date(item.created_at),
    updated_at: new Date(item.updated_at),
    scheduled_date: new Date(item.scheduled_for),
    platform: item.platform as ContentPost['platform'],
    content_type: item.content_type as ContentPost['content_type'],
    idea: item.idea || '',
    caption: item.caption || '',
    media_files: item.media_url ? [{
      id: `media-${item.id}`,
      name: 'Media',
      type: item.media_url.includes('.mp4') || item.media_url.includes('.mov') ? 'video' : 'image',
      url: item.media_url,
    }] : [],
    notes: item.notes || '',
    tags: [],
    status: item.status,
    rejection_reason: item.rejection_reason || undefined,
    approved_at: item.approved_at ? new Date(item.approved_at) : undefined,
    approved_by: item.approved_by || undefined,
    gid: item.gid || undefined,
    row: item.sheet_row || undefined,
    synced_at: new Date(item.updated_at),
  };
}

// Transform app ContentPost to Supabase insert format
function contentPostToSupabase(post: Partial<ContentPost>): Partial<ContentItem> {
  return {
    platform: post.platform,
    content_type: post.content_type,
    media_url: post.media_files?.[0]?.url || null,
    caption: post.caption || null,
    idea: post.idea || null,
    notes: post.notes || null,
    scheduled_for: post.scheduled_date?.toISOString() || new Date().toISOString(),
    status: post.status || 'draft',
    gid: post.gid || null,
    sheet_row: post.row || null,
  };
}

export interface PostData {
  data: Array<{
    row: number;
    row_data: string[];
  }>;
  gid?: string;
  sheetName?: string;
}

// Transform API data to ContentPost format (for Google Sheets fallback)
function transformToContentPost(item: { row: number; row_data: string[] }, gid?: string): ContentPost {
  const row_data = item.row_data;
  
  let status: ContentStatus = 'draft';
  if (row_data[4] === 'TRUE') status = 'approved';
  else if (row_data[5] === 'TRUE') status = 'rejected';
  else if (row_data[2] || row_data[7]) status = 'pending';
  
  return {
    id: `sheet-${gid}-${item.row}`,
    created_at: new Date(),
    updated_at: new Date(),
    scheduled_date: row_data[3] ? new Date(row_data[3]) : new Date(),
    platform: (row_data[0]?.toLowerCase() || 'linkedin') as ContentPost['platform'],
    content_type: (row_data[6]?.toLowerCase() || 'post') as ContentPost['content_type'],
    idea: row_data[7] || '',
    caption: row_data[2] || '',
    media_files: row_data[1] ? [{
      id: `media-${item.row}`,
      name: 'Media',
      type: row_data[1].includes('.mp4') || row_data[1].includes('.mov') ? 'video' : 'image',
      url: row_data[1],
    }] : [],
    notes: row_data[8] || '',
    tags: [],
    status,
    gid,
    row: item.row,
  };
}

export const api = {
  // Subscribe to real-time changes (using admin client for RLS bypass)
  subscribeToChanges(callback: (payload: any) => void) {
    const client = writeClient || supabase;
    if (!client) {
      console.warn('Supabase not configured, real-time disabled');
      return null;
    }

    return client
      .channel('content_items_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content_items' },
        callback
      )
      .subscribe();
  },

  async getPlatforms(): Promise<PlatformConfig[]> {
    try {
      const client = createAxiosInstance();
      const response = await client.get('/platforms');
      return response.data;
    } catch (error) {
      console.error('Error fetching platforms:', error);
      return [{ platform: 'Content Calendar', gid: '574718900' }];
    }
  },

  async getPosts(gid: string): Promise<ContentPost[]> {
    // First try Supabase for posts (using admin client to bypass RLS)
    if (writeClient) {
      try {
        const { data, error } = await writeClient
          .from('content_items')
          .select('*')
          .order('scheduled_for', { ascending: true });

        if (error) {
          console.error('Supabase getPosts error:', error);
          throw error;
        }
        
        console.log('Loaded posts from Supabase:', data?.length || 0);
        return (data || []).map(supabaseToContentPost);
      } catch (e) {
        console.error('Supabase error, falling back to API:', e);
      }
    }

    // Fallback to Google Sheets API
    try {
      const client = createAxiosInstance();
      const response = await client.get<PostData>(`/posts?gid=${gid}`);
      
      if (!response.data.data) return [];
      
      return response.data.data.map(item => 
        transformToContentPost(item, response.data.gid)
      );
    } catch (error) {
      console.error('Error fetching posts:', error);
      throw error;
    }
  },

  async createPost(post: Partial<ContentPost>, gid: string): Promise<ContentPost> {
    // Save to Supabase for persistence (using admin client to bypass RLS)
    if (writeClient) {
      try {
        const { data, error } = await writeClient
          .from('content_items')
          .insert([{
            ...contentPostToSupabase(post),
            gid,
          }])
          .select()
          .single();

        if (error) throw error;
        
        console.log('Created post in Supabase:', data.id);
        return supabaseToContentPost(data);
      } catch (e) {
        console.error('Supabase create error:', e);
      }
    }

    // Fallback to API
    try {
      const client = createAxiosInstance();
      const response = await client.post('/post/create', {
        gid,
        platform: post.platform,
        caption: post.caption,
        idea: post.idea,
        scheduled_date: post.scheduled_date?.toISOString(),
        content_type: post.content_type,
        notes: post.notes,
        media_url: post.media_files?.[0]?.url,
      });
      
      return {
        ...post,
        id: response.data.id || `new-${Date.now()}`,
        created_at: new Date(),
        updated_at: new Date(),
        status: 'draft',
      } as ContentPost;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  },

  async updatePost(post: ContentPost): Promise<void> {
    // Update in Supabase (using admin client to bypass RLS)
    if (writeClient && !post.id.startsWith('sheet-')) {
      try {
        const { error } = await writeClient
          .from('content_items')
          .update({
            ...contentPostToSupabase(post),
            rejection_reason: post.rejection_reason,
          })
          .eq('id', post.id);

        if (error) throw error;
        console.log('Updated post in Supabase:', post.id);
        return;
      } catch (e) {
        console.error('Supabase update error:', e);
      }
    }

    // Fallback to API for sheet-based posts
    try {
      const client = createAxiosInstance();
      await client.post(`/post/update?gid=${post.gid}&row=${post.row}`, {
        status: post.status,
        caption: post.caption,
        reason: post.rejection_reason,
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  },

  async submitForReview(post: ContentPost): Promise<void> {
    // Update status to pending
    if (supabase && !post.id.startsWith('sheet-')) {
      try {
        const { error } = await supabase
          .from('content_items')
          .update({ status: 'pending' })
          .eq('id', post.id);

        if (error) throw error;
        console.log('Submitted for review in Supabase:', post.id);
        return;
      } catch (e) {
        console.error('Supabase submit error:', e);
      }
    }

    // Fallback to API
    try {
      const client = createAxiosInstance();
      await client.post(`/post/update?gid=${post.gid}&row=${post.row}`, {
        status: 'pending',
      });
    } catch (error) {
      console.error('Error submitting for review:', error);
      throw error;
    }
  },

  async updateCaption(gid: string, row: string, caption: string): Promise<void> {
    try {
      const client = createAxiosInstance();
      await client.post('/post/caption/update', { caption }, { params: { gid, row } });
    } catch (error) {
      console.error('Error updating caption:', error);
      throw error;
    }
  },

  async uploadMedia(file: File, gid: string): Promise<string> {
    // Try Supabase storage first
    if (supabase) {
      try {
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('media')
          .upload(fileName, file);

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from('media')
            .getPublicUrl(data.path);
          
          console.log('Uploaded to Supabase storage:', publicUrl);
          return publicUrl;
        }
      } catch (e) {
        console.error('Supabase storage error, using API:', e);
      }
    }

    // Fallback to API
    try {
      const client = createAxiosInstance();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gid', gid);
      
      const response = await client.post('/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      return response.data.path || response.data.url;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  },

  // Get all posts including drafts from Supabase
  async getAllPosts(): Promise<ContentPost[]> {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('content_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(supabaseToContentPost);
    } catch (e) {
      console.error('Error fetching all posts:', e);
      return [];
    }
  },

  // Delete a draft post
  async deletePost(id: string): Promise<void> {
    if (!supabase) {
      console.warn('Cannot delete: Supabase not configured');
      return;
    }

    try {
      const { error } = await supabase
        .from('content_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('Deleted post:', id);
    } catch (e) {
      console.error('Error deleting post:', e);
      throw e;
    }
  },
};
