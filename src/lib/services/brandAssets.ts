// Brand Assets Service
// Manages brand assets library - upload, retrieve, delete, organize

import { supabase, supabaseAdmin } from '$lib/services/supabase';

// Use admin client to bypass RLS
const dbClient = supabaseAdmin || supabase;

export interface BrandAsset {
  id: string;
  name: string;
  url: string;
  file_path: string;
  type: 'image' | 'video' | 'logo' | 'graphic' | 'other';
  tags: string[];
  folder: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  updated_at: string;
}

export interface UploadOptions {
  name?: string;
  type?: BrandAsset['type'];
  tags?: string[];
  folder?: string;
}

// Get image dimensions from file
async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null;
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

// Get video dimensions from file
async function getVideoDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('video/')) return null;
  
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(video.src);
    };
    video.onerror = () => resolve(null);
    video.src = URL.createObjectURL(file);
  });
}

// Determine asset type from MIME type
function getAssetType(mimeType: string): BrandAsset['type'] {
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('svg') || mimeType.includes('logo')) return 'logo';
  if (mimeType.startsWith('image/')) return 'image';
  return 'other';
}

// Upload a brand asset
export async function uploadBrandAsset(
  file: File, 
  options: UploadOptions = {}
): Promise<BrandAsset> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const folder = options.folder || 'General';
  const filePath = `brand-assets/${folder.toLowerCase().replace(/\s+/g, '-')}/${fileName}`;

  // Upload to Supabase storage using admin client (bypasses RLS)
  const storageClient = supabaseAdmin || supabase;
  if (!storageClient) {
    throw new Error('Supabase client not initialized');
  }
  
  const { error: uploadError } = await storageClient.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload asset: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = storageClient.storage
    .from('media')
    .getPublicUrl(filePath);

  // Get dimensions
  let dimensions: { width: number; height: number } | null = null;
  if (file.type.startsWith('image/')) {
    dimensions = await getImageDimensions(file);
  } else if (file.type.startsWith('video/')) {
    dimensions = await getVideoDimensions(file);
  }

  // Determine asset type
  const assetType = options.type || getAssetType(file.type);

  // Save to database using admin client
  const { data: assetData, error: dbError } = await dbClient
    .from('brand_assets')
    .insert({
      name: options.name || file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      url: urlData.publicUrl,
      file_path: filePath,
      type: assetType,
      tags: options.tags || [],
      folder: folder,
      file_size: file.size,
      mime_type: file.type,
      width: dimensions?.width || null,
      height: dimensions?.height || null
    })
    .select()
    .single();

  if (dbError) {
    // Clean up uploaded file if db insert fails
    await storageClient.storage.from('media').remove([filePath]);
    throw new Error(`Failed to save asset: ${dbError.message}`);
  }

  return assetData as BrandAsset;
}

// Get all brand assets
export async function getBrandAssets(options?: {
  folder?: string;
  type?: BrandAsset['type'];
  tags?: string[];
  search?: string;
}): Promise<BrandAsset[]> {
  let query = dbClient
    .from('brand_assets')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.folder && options.folder !== 'All') {
    query = query.eq('folder', options.folder);
  }

  if (options?.type) {
    query = query.eq('type', options.type);
  }

  if (options?.tags && options.tags.length > 0) {
    query = query.contains('tags', options.tags);
  }

  if (options?.search) {
    query = query.ilike('name', `%${options.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching brand assets:', error);
    return [];
  }

  return data as BrandAsset[];
}

// Get unique folders
export async function getFolders(): Promise<string[]> {
  const { data, error } = await dbClient
    .from('brand_assets')
    .select('folder')
    .order('folder');

  if (error) {
    console.error('Error fetching folders:', error);
    return ['General'];
  }

  const folders = [...new Set(data?.map(d => d.folder) || [])];
  return folders.length > 0 ? folders : ['General'];
}

// Get unique tags
export async function getTags(): Promise<string[]> {
  const { data, error } = await dbClient
    .from('brand_assets')
    .select('tags');

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }

  const allTags = data?.flatMap(d => d.tags || []) || [];
  return [...new Set(allTags)].sort();
}

// Update a brand asset
export async function updateBrandAsset(
  id: string, 
  updates: Partial<Pick<BrandAsset, 'name' | 'tags' | 'folder' | 'type'>>
): Promise<BrandAsset> {
  const { data, error } = await dbClient
    .from('brand_assets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update asset: ${error.message}`);
  }

  return data as BrandAsset;
}

// Delete a brand asset
export async function deleteBrandAsset(id: string): Promise<void> {
  // Get the asset first to get file path
  const { data: asset } = await dbClient
    .from('brand_assets')
    .select('file_path')
    .eq('id', id)
    .single();

  if (asset?.file_path) {
    // Delete from storage using admin client
    const storageClient = supabaseAdmin || supabase;
    if (storageClient) {
      await storageClient.storage.from('media').remove([asset.file_path]);
    }
  }

  // Delete from database
  const { error } = await dbClient
    .from('brand_assets')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete asset: ${error.message}`);
  }
}

// Delete multiple brand assets
export async function deleteBrandAssets(ids: string[]): Promise<void> {
  // Get all assets first
  const { data: assets } = await dbClient
    .from('brand_assets')
    .select('file_path')
    .in('id', ids);

  if (assets && assets.length > 0) {
    // Delete from storage using admin client
    const storageClient = supabaseAdmin || supabase;
    const paths = assets.map(a => a.file_path).filter(Boolean);
    if (paths.length > 0 && storageClient) {
      await storageClient.storage.from('media').remove(paths);
    }
  }

  // Delete from database
  const { error } = await dbClient
    .from('brand_assets')
    .delete()
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to delete assets: ${error.message}`);
  }
}

// Create a new folder (just returns the name, folders are implicit)
export function createFolder(name: string): string {
  return name.trim();
}

// Format file size for display
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

