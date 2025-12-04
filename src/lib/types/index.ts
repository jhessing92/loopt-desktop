export type ContentStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type Platform = 'linkedin' | 'facebook' | 'instagram' | 'twitter';
export type ContentType = 'post' | 'carousel' | 'video' | 'story' | 'reel';

export interface ContentPost {
  id: string;
  created_at: Date;
  updated_at: Date;
  
  // Scheduling
  scheduled_date: Date;
  scheduled_time?: string;
  
  // Content
  platform: Platform;
  content_type: ContentType;
  idea: string;
  caption: string;
  
  // Media (local paths or URLs)
  media_files: MediaFile[];
  
  // Metadata
  notes: string;
  tags: string[];
  
  // Workflow
  status: ContentStatus;
  rejection_reason?: string;
  approved_at?: Date;
  approved_by?: string;
  
  // Sync
  gid?: string;
  row?: number;
  synced_at?: Date;
}

export interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  url: string;
  localPath?: string;
  size?: number;
  thumbnail?: string;
}

export interface PlatformConfig {
  platform: string;
  gid: string;
  name?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  posts: ContentPost[];
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export interface AppState {
  selectedDate: Date;
  selectedPost: ContentPost | null;
  isEditorOpen: boolean;
  isCreating: boolean;
  view: 'calendar' | 'list' | 'media';
  filterStatus: ContentStatus | 'all';
  filterPlatform: Platform | 'all';
}

