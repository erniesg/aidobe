import { z } from 'zod'

// Wanx-compatible script structure schema
export const WanxScriptSegmentSchema = z.object({
  order_id: z.number().int().positive(),
  voiceover: z.string().min(5).max(500),
  visual_direction: z.string().min(10).max(300),
  b_roll_keywords: z.array(z.string()).min(1).max(8)
})

export const WanxScriptSchema = z.object({
  video_structure: z.object({
    title: z.string().min(5).max(100),
    duration: z.string().or(z.number()),
    throughline: z.string().min(10).max(200),
    target_audience: z.string().optional()
  }),
  script_segments: z.object({
    hook: WanxScriptSegmentSchema,
    conflict: WanxScriptSegmentSchema,
    body: WanxScriptSegmentSchema,
    conclusion: WanxScriptSegmentSchema
  }),
  production_notes: z.object({
    music_vibe: z.string().optional(),
    overall_tone: z.string().optional()
  }).optional()
})

export type WanxScript = z.infer<typeof WanxScriptSchema>

// Transcription data schema
export const TranscriptionDataSchema = z.object({
  wordTimings: z.array(z.object({
    word: z.string(),
    start: z.number().min(0),
    end: z.number().min(0),
    confidence: z.number().min(0).max(1).optional()
  })),
  fullText: z.string(),
  totalDuration: z.number().min(0)
})

export type TranscriptionData = z.infer<typeof TranscriptionDataSchema>

// Scene planning preferences schema
export const ScenePlanningPreferencesSchema = z.object({
  averageSceneDuration: z.number().min(2).max(10).default(5),
  preferredAssetTypes: z.array(z.enum(['AVATAR', 'STOCK_VIDEO', 'STOCK_IMAGE'])).default(['STOCK_VIDEO', 'STOCK_IMAGE']),
  includeTransitions: z.boolean().default(true),
  targetSceneCount: z.number().int().min(1).max(20).optional(),
  extractionStrategy: z.enum(['automatic', 'sentence_based', 'paragraph_based', 'semantic_breaks']).default('automatic')
})

export type ScenePlanningPreferences = z.infer<typeof ScenePlanningPreferencesSchema>

// Scene planning request schema
export const ScenePlanningRequestSchema = z.object({
  script: WanxScriptSchema,
  transcription: TranscriptionDataSchema.optional(),
  preferences: ScenePlanningPreferencesSchema.optional()
})

export type ScenePlanningRequest = z.infer<typeof ScenePlanningRequestSchema>

// Scene planning response schema
export const ScenePlanningResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    scenePlan: z.any(), // Will be validated against ScenePlanSchema from scene.ts
    summary: z.object({
      totalScenes: z.number().int().min(0),
      totalDuration: z.number().min(0),
      averageSceneDuration: z.number().min(0),
      processingTime: z.number().min(0)
    })
  }).optional(),
  error: z.string().optional(),
  details: z.array(z.object({
    field: z.string(),
    message: z.string()
  })).optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid()
})

export type ScenePlanningResponse = z.infer<typeof ScenePlanningResponseSchema>

// Scene optimization request schema
export const SceneOptimizationRequestSchema = z.object({
  scenePlanId: z.string().uuid(),
  targetDuration: z.number().min(15).max(180),
  preserveKeyScenes: z.array(z.string().uuid()).default([]),
  optimizationStrategy: z.enum(['proportional', 'content_aware', 'manual']).default('proportional')
})

export type SceneOptimizationRequest = z.infer<typeof SceneOptimizationRequestSchema>

// Scene edit request schema (for individual scene modifications)
export const SceneEditRequestSchema = z.object({
  scenePlanId: z.string().uuid(),
  sceneId: z.string().uuid(),
  edits: z.object({
    timing: z.object({
      startTime: z.number().min(0).optional(),
      duration: z.number().min(0.5).max(30).optional(),
      endTime: z.number().min(0).optional()
    }).optional(),
    textContent: z.string().min(1).max(1000).optional(),
    visualKeywords: z.array(z.string()).max(8).optional(),
    visualType: z.enum(['AVATAR', 'STOCK_VIDEO', 'STOCK_IMAGE']).optional(),
    mood: z.enum(['energetic', 'calm', 'dramatic', 'professional', 'humorous', 'inspiring']).optional()
  }),
  reason: z.string().max(500).optional(),
  appliedBy: z.string().optional()
})

export type SceneEditRequest = z.infer<typeof SceneEditRequestSchema>

// Scene validation result schema
export const SceneValidationResultSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.object({
    type: z.enum(['timing_overlap', 'duration_invalid', 'missing_asset', 'keyword_missing', 'sequence_error']),
    sceneId: z.string().uuid().optional(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info']),
    suggestedFix: z.string().optional()
  })),
  totalDurationMismatch: z.number().optional(),
  recommendedAdjustments: z.array(z.object({
    sceneId: z.string().uuid(),
    suggestedDuration: z.number(),
    reason: z.string()
  })).optional()
})

export type SceneValidationResult = z.infer<typeof SceneValidationResultSchema>

// Asset suggestion schema for scenes
export const AssetSuggestionSchema = z.object({
  sceneId: z.string().uuid(),
  primarySuggestions: z.array(z.object({
    type: z.enum(['AVATAR', 'STOCK_VIDEO', 'STOCK_IMAGE']),
    query: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string()
  })),
  alternativeSuggestions: z.array(z.object({
    type: z.enum(['AVATAR', 'STOCK_VIDEO', 'STOCK_IMAGE']),
    query: z.string(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string()
  })).optional()
})

export type AssetSuggestion = z.infer<typeof AssetSuggestionSchema>

// Timing analysis result schema
export const TimingAnalysisSchema = z.object({
  scenePlanId: z.string().uuid(),
  totalDuration: z.number(),
  targetDuration: z.number(),
  variance: z.number(), // Difference between total and target
  scenes: z.array(z.object({
    sceneId: z.string().uuid(),
    currentDuration: z.number(),
    optimalDuration: z.number(),
    wordCount: z.number(),
    wordsPerSecond: z.number(),
    speakingRate: z.enum(['slow', 'normal', 'fast']),
    adjustmentNeeded: z.number(), // Positive = needs extension, negative = needs reduction
    confidence: z.number().min(0).max(1)
  })),
  recommendations: z.array(z.object({
    type: z.enum(['extend_scene', 'reduce_scene', 'split_scene', 'merge_scenes', 'add_pause', 'increase_pace']),
    affectedScenes: z.array(z.string().uuid()),
    impact: z.number(), // Expected time change in seconds
    priority: z.enum(['high', 'medium', 'low']),
    description: z.string()
  }))
})

export type TimingAnalysis = z.infer<typeof TimingAnalysisSchema>