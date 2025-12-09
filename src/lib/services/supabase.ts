import { createClient } from '@supabase/supabase-js';

// Use the same Supabase credentials as the mobile app
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not set. Using fallback mode.');
}

// Regular client for general operations
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Admin client for storage operations (bypasses RLS)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase; // Fallback to regular client if no service key

export type ContentItem = {
  id: string;
  platform: string;
  content_type: string;
  media_url: string | null;
  caption: string | null;
  idea: string | null;
  notes: string | null;
  scheduled_for: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  gid: string | null;
  sheet_row: number | null;
};

