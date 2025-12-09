// Desktop App Gemini AI Service
// Handles image generation with likeness extraction, brand style, and scene generation

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { supabase, supabaseAdmin } from './supabase';

// Get the storage client (admin bypasses RLS)
const getStorageClient = () => supabaseAdmin || supabase;

// Get the database client (admin bypasses RLS)
const getDbClient = () => supabaseAdmin || supabase;

// Initialize Gemini client
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!API_KEY) {
    throw new Error('Missing VITE_GEMINI_API_KEY environment variable. Get your API key from https://aistudio.google.com/apikey');
  }
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
}

// ==================== TYPES ====================

export type TrainingImageType = 'personal' | 'brand_graphic' | 'style_reference';
export type OutputStyle = 'photorealistic' | 'stylized';
export type AspectRatio = '1:1' | '4:5' | '16:9' | '9:16';
export type InterpretationType = 'literal' | 'creative';

export interface TrainingImage {
  id: string;
  url: string;
  name: string;
  type: TrainingImageType;
  tags: string[];
  file_path: string;
  extracted_style?: ExtractedStyle;
  created_at: string;
}

export interface ExtractedStyle {
  dominant_colors: string[];
  color_palette: string[];
  composition_type: string;
  mood: string;
  typography_style?: string;
  visual_elements: string[];
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  personal_images: string[]; // IDs of personal photos for likeness
  brand_images: string[]; // IDs of brand graphics for style
  settings: PresetSettings;
  created_at: string;
  updated_at: string;
}

export interface PresetSettings {
  output_style: OutputStyle;
  aspect_ratio: AspectRatio;
  prompt_modifiers: string;
  enforce_brand_colors: boolean;
  brand_colors?: string[];
  num_reference_images: number; // 5-8 recommended
}

export interface ExtractedScene {
  id: string;
  description: string;
  setting: string;
  mood: string;
  visual_elements: string[];
  confidence: number;
}

export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  prompt_used?: string;
  error?: string;
}

export interface DualGenerationResult {
  literal: GenerationResult;
  creative: GenerationResult;
  scenes_extracted: ExtractedScene[];
}

export interface GenerationOptions {
  caption: string;
  preset: StylePreset;
  scene?: ExtractedScene;
  interpretationType: InterpretationType;
  customPromptAdditions?: string;
}

// ==================== HELPER FUNCTIONS ====================

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const mimeType = blob.type || 'image/jpeg';
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ data: base64, mimeType });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error converting URL to base64:', error);
    throw new Error('Failed to load image');
  }
}

export async function fileToBase64(file: File): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({ data: base64, mimeType: file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==================== TRAINING IMAGES ====================

export async function uploadTrainingImage(
  file: File, 
  type: TrainingImageType,
  tags: string[] = []
): Promise<TrainingImage> {
  const storageClient = getStorageClient();
  if (!storageClient) throw new Error('Storage client not configured');

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const folder = type === 'personal' ? 'personal-photos' : 'brand-assets';
  const filePath = `training-images/${folder}/${fileName}`;
  
  const { error: uploadError } = await storageClient.storage
    .from('media')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  // Get public URL
  const { data: urlData } = storageClient.storage
    .from('media')
    .getPublicUrl(filePath);

  // Save to training_images table (using admin client to bypass RLS)
  const dbClient = getDbClient();
  if (!dbClient) throw new Error('Database client not configured');
  
  const { data: imageData, error: dbError } = await dbClient
    .from('training_images')
    .insert({
      url: urlData.publicUrl,
      name: file.name,
      type,
      tags,
      file_path: filePath
    })
    .select()
    .single();

  if (dbError) {
    await storageClient.storage.from('media').remove([filePath]);
    throw new Error(`Failed to save image reference: ${dbError.message}`);
  }

  return imageData;
}

export async function getTrainingImages(type?: TrainingImageType): Promise<TrainingImage[]> {
  const dbClient = getDbClient();
  if (!dbClient) return [];

  // Fetch from training_images table
  let query = dbClient
    .from('training_images')
    .select('*')
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching training images:', error);
  }

  let results: TrainingImage[] = data || [];

  // For brand_graphic type, also fetch from brand_assets table
  if (type === 'brand_graphic' || !type) {
    const { data: brandAssets, error: brandError } = await dbClient
      .from('brand_assets')
      .select('*')
      .order('created_at', { ascending: false });

    if (brandError) {
      console.error('Error fetching brand assets:', brandError);
    } else if (brandAssets && brandAssets.length > 0) {
      // Transform brand_assets to TrainingImage format
      const transformedAssets: TrainingImage[] = brandAssets.map((asset: any) => ({
        id: asset.id,
        url: asset.url,
        name: asset.name,
        type: 'brand_graphic' as TrainingImageType,
        tags: asset.tags || [],
        file_path: asset.file_path,
        created_at: asset.created_at,
      }));
      
      // Merge with training images, brand assets first
      results = [...transformedAssets, ...results];
    }
  }

  return results;
}

export async function deleteTrainingImage(id: string): Promise<void> {
  const dbClient = getDbClient();
  if (!dbClient) throw new Error('Database client not configured');

  const { data: image } = await dbClient
    .from('training_images')
    .select('file_path')
    .eq('id', id)
    .single();

  if (image?.file_path) {
    const storageClient = getStorageClient();
    if (storageClient) {
      await storageClient.storage.from('media').remove([image.file_path]);
    }
  }

  const { error } = await dbClient
    .from('training_images')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

export async function updateTrainingImageTags(id: string, tags: string[]): Promise<void> {
  const dbClient = getDbClient();
  if (!dbClient) throw new Error('Database client not configured');

  const { error } = await dbClient
    .from('training_images')
    .update({ tags })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update tags: ${error.message}`);
  }
}

// ==================== STYLE EXTRACTION ====================

export async function extractStyleFromImages(imageUrls: string[]): Promise<ExtractedStyle> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const imageParts = await Promise.all(
    imageUrls.slice(0, 5).map(async (url) => {
      const { data, mimeType } = await urlToBase64(url);
      return { inlineData: { data, mimeType } };
    })
  );

  const prompt = `Analyze these brand graphics/images and extract the visual style. Return a JSON object with:
{
  "dominant_colors": ["#hex1", "#hex2", "#hex3"], // Top 3-5 colors as hex codes
  "color_palette": ["#hex1", ...], // Full palette up to 8 colors
  "composition_type": "string", // e.g., "centered", "asymmetric", "grid", "minimal"
  "mood": "string", // e.g., "professional", "energetic", "calm", "bold"
  "typography_style": "string", // e.g., "modern sans-serif", "elegant serif", "bold display"
  "visual_elements": ["element1", "element2"] // Common elements like "gradients", "icons", "photos", "geometric shapes"
}

Only return the JSON object, no other text.`;

  const result = await model.generateContent([...imageParts, { text: prompt }]);
  const response = await result.response;
  const text = response.text();

  try {
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse style extraction:', e);
  }

  // Return default if parsing fails
  return {
    dominant_colors: ['#1a1a2e', '#16213e', '#0f3460'],
    color_palette: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
    composition_type: 'modern',
    mood: 'professional',
    visual_elements: ['clean lines', 'minimal']
  };
}

// ==================== STYLE PRESETS ====================

export async function createStylePreset(preset: Omit<StylePreset, 'id' | 'created_at' | 'updated_at'>): Promise<StylePreset> {
  const dbClient = getDbClient();
  if (!dbClient) throw new Error('Database client not configured');

  const { data, error } = await dbClient
    .from('style_presets')
    .insert(preset)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create preset: ${error.message}`);
  }

  return data;
}

export async function getStylePresets(): Promise<StylePreset[]> {
  const dbClient = getDbClient();
  if (!dbClient) return [];

  const { data, error } = await dbClient
    .from('style_presets')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching presets:', error);
    return [];
  }

  return data || [];
}

export async function updateStylePreset(id: string, updates: Partial<StylePreset>): Promise<void> {
  const dbClient = getDbClient();
  if (!dbClient) throw new Error('Database client not configured');

  const { error } = await dbClient
    .from('style_presets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update preset: ${error.message}`);
  }
}

export async function deleteStylePreset(id: string): Promise<void> {
  const dbClient = getDbClient();
  if (!dbClient) throw new Error('Database client not configured');

  const { error } = await dbClient
    .from('style_presets')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete preset: ${error.message}`);
  }
}

// ==================== SCENE EXTRACTION ====================

export async function extractScenesFromCaption(caption: string): Promise<ExtractedScene[]> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

  const prompt = `Analyze this LinkedIn post caption and suggest 3 scene ideas for an accompanying image featuring the author.

Caption: "${caption}"

For each scene, provide both a LITERAL interpretation (directly related to the text) and think about what would make a compelling visual.

Return a JSON array with exactly 3 scenes:
[
  {
    "id": "scene_1",
    "description": "Brief description of the scene",
    "setting": "Where the scene takes place",
    "mood": "The emotional tone",
    "visual_elements": ["element1", "element2", "element3"],
    "confidence": 0.95
  }
]

Scene 1 should be the most LITERAL interpretation.
Scene 2 should be a CREATIVE/METAPHORICAL interpretation.
Scene 3 should be an ALTERNATIVE creative take.

Only return the JSON array, no other text.`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse scene extraction:', e);
  }

  // Return default scenes if parsing fails
  return [
    {
      id: 'scene_1',
      description: 'Professional setting related to the post topic',
      setting: 'Modern office or conference',
      mood: 'Professional and confident',
      visual_elements: ['clean background', 'professional attire', 'subtle tech elements'],
      confidence: 0.8
    },
    {
      id: 'scene_2',
      description: 'Creative visualization of the concept',
      setting: 'Abstract or conceptual environment',
      mood: 'Innovative and forward-thinking',
      visual_elements: ['abstract elements', 'dynamic composition', 'brand colors'],
      confidence: 0.7
    },
    {
      id: 'scene_3',
      description: 'Alternative creative interpretation',
      setting: 'Unique perspective on the topic',
      mood: 'Engaging and memorable',
      visual_elements: ['unexpected setting', 'storytelling elements', 'visual metaphor'],
      confidence: 0.6
    }
  ];
}

// ==================== IMAGE GENERATION ====================

export async function generateImage(options: GenerationOptions): Promise<GenerationResult> {
  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      ],
    });

    // Get training images
    const allTrainingImages = await getTrainingImages();
    
    // Select personal photos for likeness (up to preset's num_reference_images)
    const personalImages = allTrainingImages
      .filter(img => img.type === 'personal' && options.preset.personal_images.includes(img.id))
      .slice(0, options.preset.settings.num_reference_images);

    // Select brand images for style
    const brandImages = allTrainingImages
      .filter(img => img.type === 'brand_graphic' && options.preset.brand_images.includes(img.id))
      .slice(0, 3);

    if (personalImages.length === 0) {
      return {
        success: false,
        error: 'No personal reference photos selected. Please upload photos of yourself.'
      };
    }

    // Convert images to base64 for API
    const personalImageParts = await Promise.all(
      personalImages.map(async (img) => {
        const { data, mimeType } = await urlToBase64(img.url);
        return { inlineData: { data, mimeType } };
      })
    );

    const brandImageParts = await Promise.all(
      brandImages.map(async (img) => {
        const { data, mimeType } = await urlToBase64(img.url);
        return { inlineData: { data, mimeType } };
      })
    );

    // Build the generation prompt
    const styleDirective = options.preset.settings.output_style === 'photorealistic'
      ? 'Create a photorealistic image that looks like an actual photograph'
      : 'Create a stylized, artistic image with a polished graphic design aesthetic';

    const aspectDirective = `The image should be in ${options.preset.settings.aspect_ratio} aspect ratio, optimized for LinkedIn.`;

    const colorDirective = options.preset.settings.enforce_brand_colors && options.preset.settings.brand_colors
      ? `Use these brand colors prominently: ${options.preset.settings.brand_colors.join(', ')}`
      : '';

    const sceneDescription = options.scene 
      ? `Scene: ${options.scene.description}. Setting: ${options.scene.setting}. Mood: ${options.scene.mood}. Include these elements: ${options.scene.visual_elements.join(', ')}.`
      : '';

    const interpretationStyle = options.interpretationType === 'literal'
      ? 'Create a straightforward, literal visual representation of the content.'
      : 'Create a creative, metaphorical, or conceptual visual interpretation that captures the essence and emotion of the content.';

    const fullPrompt = `
${styleDirective}

REFERENCE PHOTOS: The first set of images are photos of the person who should appear in the generated image. 
Maintain their exact facial features, likeness, and appearance. They should be recognizable as the same person.

BRAND STYLE: The second set of images show the visual style to emulate - use similar colors, composition, and aesthetic.

CAPTION CONTEXT: "${options.caption}"

${sceneDescription}

${interpretationStyle}

${aspectDirective}
${colorDirective}

${options.preset.settings.prompt_modifiers}

${options.customPromptAdditions || ''}

Important guidelines:
- The person's face must be clearly recognizable and consistent with reference photos
- Professional quality suitable for LinkedIn
- Engaging composition that draws attention
- Well-lit with appropriate mood lighting
`;

    // Combine all image parts
    const allImageParts = [...personalImageParts, ...brandImageParts];

    const result = await model.generateContent([
      ...allImageParts,
      { text: fullPrompt }
    ]);

    const response = await result.response;

    // Check for image in response
    const generatedImagePart = response.candidates?.[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith('image/')
    );

    if (generatedImagePart && 'inlineData' in generatedImagePart) {
      const imageData = (generatedImagePart as any).inlineData;
      const base64Url = `data:${imageData.mimeType};base64,${imageData.data}`;
      
      return {
        success: true,
        imageUrl: base64Url,
        imageBase64: imageData.data,
        prompt_used: fullPrompt
      };
    }

    // If no image generated, return text response as guidance
    const textResponse = response.text();
    return {
      success: false,
      error: `Image generation not available with current API access. AI suggestion: ${textResponse.substring(0, 200)}...`
    };

  } catch (error: any) {
    console.error('Error generating image:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate image'
    };
  }
}

export async function generateDualImages(
  caption: string, 
  preset: StylePreset,
  customScene?: ExtractedScene
): Promise<DualGenerationResult> {
  // First, extract scenes from caption
  const scenes = customScene ? [customScene] : await extractScenesFromCaption(caption);
  
  // Generate literal interpretation (using first/most literal scene)
  const literalScene = scenes[0];
  const literalResult = await generateImage({
    caption,
    preset,
    scene: literalScene,
    interpretationType: 'literal'
  });

  // Generate creative interpretation (using second/creative scene)
  const creativeScene = scenes[1] || scenes[0];
  const creativeResult = await generateImage({
    caption,
    preset,
    scene: creativeScene,
    interpretationType: 'creative'
  });

  return {
    literal: literalResult,
    creative: creativeResult,
    scenes_extracted: scenes
  };
}

// ==================== SAVE GENERATED IMAGE ====================

export async function saveGeneratedImage(base64DataUrl: string, postId?: string): Promise<string> {
  const storageClient = getStorageClient();
  if (!storageClient) throw new Error('Storage client not configured');

  const response = await fetch(base64DataUrl);
  const blob = await response.blob();
  
  const fileName = `generated-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
  const filePath = `generated-images/${fileName}`;

  const { error: uploadError } = await storageClient.storage
    .from('media')
    .upload(filePath, blob, {
      cacheControl: '3600',
      contentType: 'image/png'
    });

  if (uploadError) {
    throw new Error(`Failed to save generated image: ${uploadError.message}`);
  }

  const { data: urlData } = storageClient.storage
    .from('media')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// ==================== UTILITIES ====================

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}

export function getApiStatus(): { configured: boolean; message: string } {
  if (!API_KEY) {
    return {
      configured: false,
      message: 'Gemini API key not configured. Add VITE_GEMINI_API_KEY to your .env file.'
    };
  }
  return {
    configured: true,
    message: 'Gemini API is configured and ready.'
  };
}

// Default preset for quick start
export const DEFAULT_PRESET: Omit<StylePreset, 'id' | 'created_at' | 'updated_at'> = {
  name: 'Professional LinkedIn',
  description: 'Clean, professional style optimized for LinkedIn engagement',
  personal_images: [],
  brand_images: [],
  settings: {
    output_style: 'photorealistic',
    aspect_ratio: '1:1',
    prompt_modifiers: 'Professional lighting, clean background, confident pose, suitable for LinkedIn business context',
    enforce_brand_colors: false,
    num_reference_images: 6
  }
};

