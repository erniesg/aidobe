import { z } from 'zod'

// Base asset metadata schema
export const AssetMetadataSchema = z.object({
  // File properties
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  duration: z.number().positive().optional(), // for videos, in seconds
  fileSize: z.number().int().positive().optional(), // in bytes
  format: z.string().optional(), // jpg, png, mp4, etc.
  aspectRatio: z.string().optional(), // "16:9", "9:16", "1:1"
  
  // Content properties
  colorDominant: z.string().optional(), // hex color
  colorPalette: z.array(z.string()).default([]), // array of hex colors
  brightness: z.number().min(0).max(1).optional(),
  contrast: z.number().min(0).max(1).optional(),
  
  // Provider-specific metadata
  provider: z.enum(['pexels', 'pixabay', 'envato', 'replicate', 'openai', 'stability', 'manual']),
  providerId: z.string().optional(), // ID from the provider
  license: z.string().optional(),
  attribution: z.string().optional(),
  tags: z.array(z.string()).default([]),
  
  // Processing metadata
  downloadedAt: z.string().datetime().optional(),
  processedAt: z.string().datetime().optional(),
  thumbnailUrl: z.string().url().optional(),
  
  // Additional properties
  searchKeywords: z.array(z.string()).default([]),
  contentDescription: z.string().optional()
})

export type AssetMetadata = z.infer<typeof AssetMetadataSchema>

// Asset search result schema
export const AssetSearchResultSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['image', 'video']),
  url: z.string().url(),
  previewUrl: z.string().url().optional(), // smaller preview for UI
  thumbnailUrl: z.string().url().optional(),
  
  // Search relevance
  searchQuery: z.string(),
  relevanceScore: z.number().min(0).max(1),
  matchedKeywords: z.array(z.string()).default([]),
  
  // Content quality indicators
  qualityScore: z.number().min(0).max(1).optional(),
  aestheticScore: z.number().min(0).max(1).optional(),
  tiktokSuitability: z.number().min(0).max(1).optional(),
  
  // Provider information
  provider: AssetMetadataSchema.shape.provider,
  providerId: z.string().optional(),
  
  // Asset metadata
  metadata: AssetMetadataSchema,
  
  // Search context
  searchedAt: z.string().datetime(),
  searchContext: z.object({
    sceneId: z.string().uuid().optional(),
    visualKeywords: z.array(z.string()).default([]),
    mood: z.string().optional(),
    style: z.string().optional()
  }).optional()
})

export type AssetSearchResult = z.infer<typeof AssetSearchResultSchema>

// Generated asset schema (from AI providers)
export const GeneratedAssetSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['image', 'video']),
  
  // Generation details
  prompt: z.string().min(1).max(4000),
  enhancedPrompt: z.string().optional(), // AI-enhanced version
  negativePrompt: z.string().optional(),
  
  // Provider and model
  provider: z.enum(['replicate', 'openai', 'stability', 'midjourney']),
  model: z.string(),
  
  // Generation parameters
  parameters: z.object({
    seed: z.number().int().optional(),
    steps: z.number().int().positive().optional(),
    guidance: z.number().positive().optional(),
    style: z.string().optional(),
    aspectRatio: z.string().optional(),
    quality: z.enum(['draft', 'standard', 'high']).optional()
  }).default({}),
  
  // Results
  outputs: z.array(z.object({
    url: z.string().url(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fileSize: z.number().int().positive().optional(),
    confidence: z.number().min(0).max(1).optional()
  })).min(1),
  
  selectedOutput: z.number().int().min(0).optional(), // index of selected output
  
  // Generation metadata
  generationTime: z.number().positive(), // milliseconds
  cost: z.number().positive().optional(), // USD
  retryCount: z.number().int().min(0).default(0),
  
  // Quality assessment
  qualityChecks: z.array(z.object({
    check: z.string(),
    passed: z.boolean(),
    score: z.number().min(0).max(1).optional(),
    details: z.string().optional()
  })).default([]),
  
  // Context
  sceneId: z.string().uuid().optional(),
  visualKeywords: z.array(z.string()).default([]),
  
  // Timestamps
  generatedAt: z.string().datetime(),
  metadata: AssetMetadataSchema.optional()
})

export type GeneratedAsset = z.infer<typeof GeneratedAssetSchema>

// Asset evaluation schema (AI-scored assets)
export const EvaluatedAssetSchema = z.object({
  assetId: z.string().uuid(),
  assetType: z.enum(['search_result', 'generated', 'manual_upload']),
  
  // Evaluation criteria and scores
  relevance: z.object({
    score: z.number().min(0).max(1),
    reasoning: z.string(),
    keywordMatches: z.array(z.string()).default([]),
    conceptAlignment: z.number().min(0).max(1)
  }),
  
  visualQuality: z.object({
    score: z.number().min(0).max(1),
    sharpness: z.number().min(0).max(1).optional(),
    composition: z.number().min(0).max(1).optional(),
    lighting: z.number().min(0).max(1).optional(),
    colorHarmony: z.number().min(0).max(1).optional()
  }),
  
  tiktokSuitability: z.object({
    score: z.number().min(0).max(1),
    aspectRatioMatch: z.boolean(),
    mobileFriendly: z.boolean(),
    attentionGrabbing: z.number().min(0).max(1),
    trendAlignment: z.number().min(0).max(1).optional()
  }),
  
  contextFit: z.object({
    score: z.number().min(0).max(1),
    moodAlignment: z.number().min(0).max(1),
    styleConsistency: z.number().min(0).max(1),
    sceneTransition: z.number().min(0).max(1).optional()
  }),
  
  // Overall scoring
  overallScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  recommendation: z.enum(['highly_recommended', 'recommended', 'acceptable', 'not_recommended']),
  
  // Evaluation metadata
  evaluatedBy: z.enum(['claude_vision', 'gpt_vision', 'gemini_vision', 'custom_model']),
  evaluatedAt: z.string().datetime(),
  evaluationTime: z.number().positive(), // milliseconds
  
  // Context
  sceneContext: z.object({
    sceneId: z.string().uuid(),
    textContent: z.string(),
    visualKeywords: z.array(z.string()),
    mood: z.string().optional(),
    timing: z.object({
      duration: z.number().positive(),
      position: z.enum(['intro', 'middle', 'conclusion'])
    }).optional()
  }),
  
  // Improvement suggestions
  suggestions: z.array(z.string()).default([]),
  alternativePrompts: z.array(z.string()).default([]) // for regeneration
})

export type EvaluatedAsset = z.infer<typeof EvaluatedAssetSchema>

// Asset selection schema (final chosen asset for a scene)
export const SelectedAssetSchema = z.object({
  id: z.string().uuid(),
  sceneId: z.string().uuid(),
  jobId: z.string().uuid(),
  
  // Asset reference
  assetId: z.string().uuid(),
  assetType: z.enum(['search_result', 'generated', 'manual_upload']),
  assetUrl: z.string().url(),
  
  // Selection reasoning
  selectionMethod: z.enum(['automatic', 'manual_override', 'fallback']),
  selectedBy: z.string().optional(), // user ID or 'system'
  selectionReason: z.string(),
  alternativesConsidered: z.array(z.string().uuid()).default([]),
  
  // Usage configuration
  usage: z.object({
    startTime: z.number().min(0), // relative to scene
    duration: z.number().positive(),
    position: z.object({
      x: z.number().default(0),
      y: z.number().default(0),
      scale: z.number().min(0.1).max(3).default(1),
      rotation: z.number().min(-180).max(180).default(0)
    }).default({})
  }),
  
  // Processing requirements
  processing: z.object({
    needsDownload: z.boolean().default(true),
    needsResize: z.boolean().default(false),
    needsCompression: z.boolean().default(false),
    targetResolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }).optional(),
    effects: z.array(z.string()).default([])
  }).default({}),
  
  // Status tracking
  status: z.enum(['selected', 'downloading', 'processing', 'ready', 'failed']).default('selected'),
  localPath: z.string().optional(),
  processedPath: z.string().optional(),
  
  selectedAt: z.string().datetime(),
  processedAt: z.string().datetime().optional()
})

export type SelectedAsset = z.infer<typeof SelectedAssetSchema>

// Asset search request schema
export const AssetSearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  type: z.enum(['image', 'video', 'both']).default('image'),
  
  // Search parameters
  providers: z.array(z.enum(['pexels', 'pixabay', 'envato'])).default(['pexels', 'pixabay']),
  maxResults: z.number().int().min(1).max(50).default(20),
  orientation: z.enum(['all', 'horizontal', 'vertical', 'square']).default('vertical'),
  minResolution: z.object({
    width: z.number().int().positive().default(720),
    height: z.number().int().positive().default(1280)
  }).default({}),
  
  // Quality filters
  minQuality: z.number().min(0).max(1).default(0.6),
  excludeAI: z.boolean().default(false),
  license: z.enum(['all', 'free', 'premium']).default('all'),
  
  // Context for relevance scoring
  context: z.object({
    sceneId: z.string().uuid().optional(),
    visualKeywords: z.array(z.string()).default([]),
    mood: z.string().optional(),
    style: z.string().optional(),
    previousAssets: z.array(z.string().uuid()).default([]) // for diversity
  }).optional()
})

export type AssetSearchRequest = z.infer<typeof AssetSearchRequestSchema>

// Asset generation request schema
export const AssetGenerationRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  type: z.enum(['image', 'video']).default('image'),
  
  // Provider preferences
  provider: z.enum(['replicate', 'openai', 'stability']).optional(),
  model: z.string().optional(),
  
  // Generation parameters
  parameters: z.object({
    aspectRatio: z.enum(['1:1', '16:9', '9:16', '4:3', '3:4']).default('9:16'),
    quality: z.enum(['draft', 'standard', 'high']).default('standard'),
    style: z.string().optional(),
    negativePrompt: z.string().optional(),
    seed: z.number().int().optional(),
    steps: z.number().int().min(1).max(100).optional(),
    guidance: z.number().min(1).max(20).optional()
  }).default({}),
  
  // Context
  sceneId: z.string().uuid().optional(),
  visualKeywords: z.array(z.string()).default([]),
  enhancePrompt: z.boolean().default(true), // use AI to enhance the prompt
  
  // Generation options
  numberOfVariations: z.number().int().min(1).max(4).default(1),
  fallbackToSearch: z.boolean().default(true) // fallback to search if generation fails
})

export type AssetGenerationRequest = z.infer<typeof AssetGenerationRequestSchema>

// Asset evaluation request schema
export const AssetEvaluationRequestSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(10),
  sceneContext: z.object({
    sceneId: z.string().uuid(),
    textContent: z.string(),
    visualKeywords: z.array(z.string()),
    mood: z.string().optional(),
    duration: z.number().positive(),
    sceneType: z.enum(['intro', 'main', 'transition', 'conclusion'])
  }),
  
  // Evaluation preferences
  criteria: z.array(z.enum([
    'relevance',
    'visual_quality',
    'tiktok_suitability',
    'context_fit',
    'brand_safety'
  ])).default(['relevance', 'visual_quality', 'tiktok_suitability']),
  
  evaluationModel: z.enum(['claude_vision', 'gpt_vision', 'gemini_vision']).default('claude_vision'),
  includeAlternatives: z.boolean().default(true)
})

export type AssetEvaluationRequest = z.infer<typeof AssetEvaluationRequestSchema>

// Validation functions
export function validateAssetDimensions(
  width: number, 
  height: number, 
  aspectRatio: string
): boolean {
  const aspectRatios = {
    '1:1': 1.0,
    '16:9': 16/9,
    '9:16': 9/16,
    '4:3': 4/3,
    '3:4': 3/4
  }
  
  const expectedRatio = aspectRatios[aspectRatio as keyof typeof aspectRatios]
  if (!expectedRatio) return false
  
  const actualRatio = width / height
  const tolerance = 0.05 // 5% tolerance
  
  return Math.abs(actualRatio - expectedRatio) <= tolerance
}

export function calculateRelevanceScore(
  searchQuery: string,
  assetTags: string[],
  assetDescription: string
): number {
  const queryWords = searchQuery.toLowerCase().split(/\s+/)
  const assetText = [...assetTags, assetDescription].join(' ').toLowerCase()
  
  let matches = 0
  let totalWords = queryWords.length
  
  for (const word of queryWords) {
    if (assetText.includes(word)) {
      matches++
    }
  }
  
  return matches / totalWords
}

export function assessTikTokSuitability(asset: AssetMetadata): number {
  let score = 0
  let factors = 0
  
  // Aspect ratio (30% weight)
  if (asset.aspectRatio === '9:16') {
    score += 0.3
  } else if (asset.aspectRatio === '1:1') {
    score += 0.2
  } else if (asset.aspectRatio === '16:9') {
    score += 0.1
  }
  factors += 0.3
  
  // Resolution (20% weight)
  if (asset.width && asset.height) {
    const minDimension = Math.min(asset.width, asset.height)
    if (minDimension >= 1080) {
      score += 0.2
    } else if (minDimension >= 720) {
      score += 0.15
    } else if (minDimension >= 480) {
      score += 0.1
    }
  }
  factors += 0.2
  
  // Brightness (15% weight) - TikTok favors bright, vibrant content
  if (asset.brightness !== undefined) {
    if (asset.brightness >= 0.6) {
      score += 0.15
    } else if (asset.brightness >= 0.4) {
      score += 0.1
    }
  }
  factors += 0.15
  
  // Contrast (15% weight)
  if (asset.contrast !== undefined) {
    if (asset.contrast >= 0.5) {
      score += 0.15
    } else if (asset.contrast >= 0.3) {
      score += 0.1
    }
  }
  factors += 0.15
  
  // Color vibrancy (20% weight)
  if (asset.colorPalette && asset.colorPalette.length > 0) {
    // Simple heuristic: more colors = more vibrant
    const colorCount = asset.colorPalette.length
    if (colorCount >= 5) {
      score += 0.2
    } else if (colorCount >= 3) {
      score += 0.15
    } else if (colorCount >= 1) {
      score += 0.1
    }
  }
  factors += 0.2
  
  return factors > 0 ? score / factors : 0.5 // default score if no factors available
}

export function rankAssetsByQuality(assets: AssetSearchResult[]): AssetSearchResult[] {
  return assets.sort((a, b) => {
    // Primary: relevance score
    const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0)
    if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff
    
    // Secondary: quality score
    const qualityDiff = (b.qualityScore || 0) - (a.qualityScore || 0)
    if (Math.abs(qualityDiff) > 0.1) return qualityDiff
    
    // Tertiary: TikTok suitability
    const tiktokDiff = (b.tiktokSuitability || 0) - (a.tiktokSuitability || 0)
    return tiktokDiff
  })
}

export function generatePromptEnhancements(
  originalPrompt: string,
  visualKeywords: string[],
  mood: string
): string {
  let enhanced = originalPrompt
  
  // Add visual keywords if not already present
  const missingKeywords = visualKeywords.filter(
    keyword => !enhanced.toLowerCase().includes(keyword.toLowerCase())
  )
  
  if (missingKeywords.length > 0) {
    enhanced += `, ${missingKeywords.join(', ')}`
  }
  
  // Add mood-specific modifiers
  const moodModifiers = {
    'energetic': 'dynamic, vibrant, high-energy',
    'calm': 'peaceful, serene, tranquil',
    'dramatic': 'intense, striking, powerful',
    'professional': 'clean, modern, business-like',
    'humorous': 'playful, fun, lighthearted',
    'inspiring': 'uplifting, motivational, hopeful'
  }
  
  const modifier = moodModifiers[mood as keyof typeof moodModifiers]
  if (modifier && !enhanced.toLowerCase().includes(modifier.split(',')[0])) {
    enhanced += `, ${modifier}`
  }
  
  // Add TikTok-specific style modifiers
  enhanced += ', optimized for mobile viewing, eye-catching, social media ready'
  
  return enhanced
}