import { z } from 'zod'

// Enhanced Video Structure Schema (inspired by wanx)
export const VideoStructureSchema = z.object({
  throughline: z.string().min(10).max(200), // Core dramatic insight or paradox
  title: z.string().min(5).max(100), // Sharp, curiosity-piquing title under 12 words
  duration: z.string().default('60-90 seconds'), // Target duration
  targetAudience: z.string().optional(), // Primary audience description
  style: z.enum(['tech_in_asia', 'educational', 'entertainment', 'news', 'lifestyle']).default('tech_in_asia'),
  energyLevel: z.enum(['low', 'medium', 'high']).default('high'),
  complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate')
})

export type VideoStructure = z.infer<typeof VideoStructureSchema>

// Script Segment Schema for structured content
export const ScriptSegmentSchema = z.object({
  orderId: z.number().int().positive(),
  segmentType: z.enum(['hook', 'conflict', 'body', 'conclusion']),
  voiceover: z.string().min(5).max(500), // The actual script text for this segment
  visualDirection: z.string().min(10).max(300), // What should be shown on screen
  bRollKeywords: z.array(z.string()).min(2).max(8), // 3-8 search terms for footage
  duration: z.number().min(3).max(30).optional(), // Estimated duration in seconds
  
  // Additional wanx-inspired fields
  emotionalTone: z.enum(['surprise', 'curiosity', 'tension', 'resolution', 'excitement']).optional(),
  pacing: z.enum(['slow', 'medium', 'fast']).default('medium'),
  emphasis: z.array(z.string()).default([]), // Words/phrases to emphasize
  
  // Technical production notes
  cameraMovement: z.enum(['static', 'zoom_in', 'zoom_out', 'pan', 'tracking']).optional(),
  transitionType: z.enum(['cut', 'fade', 'zoom', 'slide']).default('cut')
})

export type ScriptSegment = z.infer<typeof ScriptSegmentSchema>

// Production Notes Schema
export const ProductionNotesSchema = z.object({
  musicVibe: z.string().min(5).max(100), // Background music keywords/description
  overallTone: z.string().min(5).max(100), // Narrator tone description
  
  // Enhanced production guidance
  colorScheme: z.enum(['vibrant', 'muted', 'monochrome', 'warm', 'cool']).optional(),
  visualStyle: z.enum(['modern', 'retro', 'minimalist', 'dynamic', 'cinematic']).optional(),
  brandGuidelines: z.object({
    primaryColor: z.string().optional(),
    logoPlacement: z.enum(['top_right', 'bottom_right', 'center', 'none']).default('bottom_right'),
    fontStyle: z.string().optional()
  }).optional(),
  
  // Audio production notes
  voiceCharacteristics: z.object({
    gender: z.enum(['male', 'female', 'neutral']).optional(),
    age: z.enum(['young', 'adult', 'mature']).optional(),
    accent: z.string().optional(),
    pace: z.enum(['slow', 'normal', 'fast']).default('normal'),
    energy: z.enum(['calm', 'conversational', 'energetic', 'dramatic']).default('conversational')
  }).optional(),
  
  // Technical specifications
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
  frameRate: z.number().int().min(24).max(60).default(30)
})

export type ProductionNotes = z.infer<typeof ProductionNotesSchema>

// Enhanced Structured Script Schema (wanx-inspired)
export const StructuredScriptSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  version: z.number().int().positive(),
  
  // Core video structure
  videoStructure: VideoStructureSchema,
  
  // Structured script segments
  scriptSegments: z.object({
    hook: ScriptSegmentSchema,
    conflict: ScriptSegmentSchema.optional(), // Some scripts may not need conflict
    body: z.array(ScriptSegmentSchema).min(1).max(3), // 1-3 body segments
    conclusion: ScriptSegmentSchema
  }),
  
  // Production guidance
  productionNotes: ProductionNotesSchema,
  
  // Quality metrics
  qualityMetrics: z.object({
    overallScore: z.number().min(0).max(1).optional(),
    hookEngagement: z.number().min(0).max(1).optional(),
    narrativeFlow: z.number().min(0).max(1).optional(),
    visualDirection: z.number().min(0).max(1).optional(),
    audienceAlignment: z.number().min(0).max(1).optional(),
    viralPotential: z.number().min(0).max(1).optional()
  }).default({}),
  
  // Generation metadata
  generationMetadata: z.object({
    modelUsed: z.string(),
    promptVersion: z.string(),
    templateUsed: z.string(),
    generationTime: z.number().positive(),
    promptTokens: z.number().int().positive().optional(),
    completionTokens: z.number().int().positive().optional(),
    totalTokens: z.number().int().positive().optional(),
    cost: z.number().positive().optional(),
    sourceArticleIds: z.array(z.string()).default([]),
    enhancementFlags: z.array(z.string()).default([]) // Features used during generation
  }),
  
  // Workflow status
  status: z.enum(['generated', 'reviewed', 'approved', 'rejected', 'finalized']).default('generated'),
  reviewNotes: z.string().optional(),
  
  // Timestamps
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvedAt: z.string().datetime().optional()
})

export type StructuredScript = z.infer<typeof StructuredScriptSchema>

// Structured Script Generation Request
export const StructuredScriptGenerationRequestSchema = z.object({
  jobId: z.string().uuid(),
  articleIds: z.array(z.string().uuid()).min(1).max(5),
  
  // Content preferences
  contentPreferences: z.object({
    style: VideoStructureSchema.shape.style.optional(),
    targetDuration: z.number().min(15).max(120).default(60), // seconds
    energyLevel: VideoStructureSchema.shape.energyLevel.optional(),
    complexity: VideoStructureSchema.shape.complexity.optional(),
    targetAudience: z.string().optional(),
    customThroughline: z.string().optional(), // Override auto-generated throughline
    includeConflict: z.boolean().default(true),
    bodySegmentCount: z.number().int().min(1).max(3).default(1)
  }).optional(),
  
  // Production preferences
  productionPreferences: z.object({
    musicVibe: z.string().optional(),
    visualStyle: ProductionNotesSchema.shape.visualStyle.optional(),
    voiceCharacteristics: ProductionNotesSchema.shape.voiceCharacteristics.optional(),
    brandGuidelines: ProductionNotesSchema.shape.brandGuidelines.optional(),
    aspectRatio: ProductionNotesSchema.shape.aspectRatio.optional()
  }).optional(),
  
  // Generation configuration
  generationConfig: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    promptTemplate: z.string().optional(), // Template name/ID
    temperature: z.number().min(0).max(2).optional(),
    numberOfVariations: z.number().int().min(1).max(5).default(3),
    useStructuredOutput: z.boolean().default(true),
    enhancementFlags: z.array(z.string()).default([]), // Enable specific features
    customInstructions: z.string().optional()
  }).optional()
})

export type StructuredScriptGenerationRequest = z.infer<typeof StructuredScriptGenerationRequestSchema>

// Structured Script Edit Request
export const StructuredScriptEditRequestSchema = z.object({
  scriptId: z.string().uuid(),
  
  editType: z.enum([
    'video_structure_edit',
    'segment_edit',
    'production_notes_edit',
    'full_regeneration'
  ]),
  
  // Video structure edits
  videoStructureEdits: z.object({
    throughline: z.string().optional(),
    title: z.string().optional(),
    targetAudience: z.string().optional(),
    style: VideoStructureSchema.shape.style.optional(),
    energyLevel: VideoStructureSchema.shape.energyLevel.optional()
  }).optional(),
  
  // Segment-specific edits
  segmentEdits: z.array(z.object({
    segmentType: ScriptSegmentSchema.shape.segmentType,
    orderId: z.number().int().optional(), // For body segments
    edits: z.object({
      voiceover: z.string().optional(),
      visualDirection: z.string().optional(),
      bRollKeywords: z.array(z.string()).optional(),
      emotionalTone: ScriptSegmentSchema.shape.emotionalTone.optional(),
      pacing: ScriptSegmentSchema.shape.pacing.optional()
    })
  })).optional(),
  
  // Production notes edits
  productionNotesEdits: ProductionNotesSchema.partial().optional(),
  
  // Edit metadata
  editReason: z.string().optional(),
  editedBy: z.string().optional(),
  preserveStructure: z.boolean().default(true)
})

export type StructuredScriptEditRequest = z.infer<typeof StructuredScriptEditRequestSchema>

// Script draft schema with versioning
export const ScriptDraftSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  version: z.number().int().positive(),
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(5000),
  style: z.enum(['informative', 'dramatic', 'humorous', 'professional']),
  estimatedDuration: z.number().min(15).max(120), // seconds
  wordCount: z.number().int().positive(),
  hooks: z.array(z.string()).default([]), // attention-grabbing phrases
  callToAction: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  metadata: z.object({
    modelUsed: z.string(),
    promptVersion: z.string(),
    temperature: z.number().optional(),
    generationTime: z.number().optional(), // milliseconds
    sourceArticleIds: z.array(z.string()).default([])
  }),
  status: z.enum(['draft', 'reviewed', 'finalized', 'rejected']).default('draft'),
  confidence: z.number().min(0).max(1).optional(), // AI confidence score
  qualityScore: z.number().min(0).max(1).optional(), // overall quality assessment
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type ScriptDraft = z.infer<typeof ScriptDraftSchema>

// Script edit schema for manual changes
export const ScriptEditSchema = z.object({
  id: z.string().uuid(),
  draftId: z.string().uuid(),
  editType: z.enum([
    'content_change',
    'title_change', 
    'style_adjustment',
    'hooks_modification',
    'cta_update',
    'hashtag_update',
    'duration_adjustment'
  ]),
  changes: z.object({
    field: z.string(),
    oldValue: z.unknown(),
    newValue: z.unknown(),
    startPosition: z.number().int().optional(), // for text edits
    endPosition: z.number().int().optional()
  }),
  reason: z.string().optional(),
  appliedBy: z.string().optional(), // user ID
  appliedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({})
})

export type ScriptEdit = z.infer<typeof ScriptEditSchema>

// Final script schema for approved scripts
export const FinalScriptSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  originalDraftId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(10).max(5000),
  style: z.enum(['informative', 'dramatic', 'humorous', 'professional']),
  estimatedDuration: z.number().min(15).max(120),
  wordCount: z.number().int().positive(),
  hooks: z.array(z.string()).default([]),
  callToAction: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  
  // Scene breakdown hints
  sceneBreakpoints: z.array(z.object({
    position: z.number().int(), // character position in content
    sceneType: z.enum(['intro', 'main', 'transition', 'conclusion']),
    estimatedDuration: z.number().optional() // seconds
  })).default([]),
  
  // Visual elements extracted from content
  visualKeywords: z.array(z.object({
    keyword: z.string(),
    context: z.string(),
    importance: z.number().min(0).max(1),
    position: z.number().int() // character position
  })).default([]),
  
  // Approval tracking
  approvalHistory: z.array(z.object({
    approvedBy: z.string(),
    approvedAt: z.string().datetime(),
    version: z.number().int().positive(),
    notes: z.string().optional()
  })).default([]),
  
  finalizedAt: z.string().datetime(),
  finalizedBy: z.string().optional(),
  metadata: z.record(z.unknown()).default({})
})

export type FinalScript = z.infer<typeof FinalScriptSchema>

// Script metadata schema for generation info
export const ScriptMetadataSchema = z.object({
  jobId: z.string().uuid(),
  generationRound: z.number().int().positive(),
  sourceArticles: z.array(z.object({
    articleId: z.string().uuid(),
    weight: z.number().min(0).max(1), // how much this article influenced the script
    keyPointsUsed: z.array(z.string()).default([])
  })).default([]),
  
  // Generation parameters
  generationConfig: z.object({
    provider: z.string(),
    model: z.string(),
    promptTemplate: z.string(),
    promptVersion: z.string(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    customInstructions: z.string().optional()
  }),
  
  // Performance metrics
  metrics: z.object({
    generationTimeMs: z.number().int().positive(),
    tokenUsage: z.object({
      prompt: z.number().int().positive(),
      completion: z.number().int().positive(),
      total: z.number().int().positive()
    }).optional(),
    cost: z.number().positive().optional(), // USD
    retryCount: z.number().int().min(0).default(0)
  }),
  
  // Quality assessments
  qualityChecks: z.array(z.object({
    check: z.string(),
    passed: z.boolean(),
    score: z.number().min(0).max(1).optional(),
    details: z.string().optional()
  })).default([]),
  
  createdAt: z.string().datetime()
})

export type ScriptMetadata = z.infer<typeof ScriptMetadataSchema>

// Script comparison schema for comparing drafts
export const ScriptComparisonSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  draftIds: z.array(z.string().uuid()).min(2).max(5),
  criteria: z.array(z.enum([
    'engagement_potential',
    'clarity',
    'duration_accuracy',
    'brand_alignment',
    'trending_topics',
    'call_to_action_strength'
  ])).default(['engagement_potential', 'clarity']),
  
  scores: z.record(z.string(), z.object({
    overall: z.number().min(0).max(1),
    breakdown: z.record(z.string(), z.number().min(0).max(1))
  })),
  
  recommendation: z.object({
    bestDraftId: z.string().uuid(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    improvements: z.array(z.string()).default([])
  }),
  
  comparedAt: z.string().datetime(),
  comparedBy: z.string().optional() // 'system' or user ID
})

export type ScriptComparison = z.infer<typeof ScriptComparisonSchema>

// Script generation request schema
export const GenerateScriptRequestSchema = z.object({
  jobId: z.string().uuid(),
  articleIds: z.array(z.string().uuid()).min(1),
  preferences: z.object({
    style: z.enum(['informative', 'dramatic', 'humorous', 'professional']).optional(),
    targetDuration: z.number().min(15).max(120).optional(),
    includeHashtags: z.boolean().default(true),
    includeCTA: z.boolean().default(true),
    customInstructions: z.string().optional()
  }).optional(),
  
  generationConfig: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    promptTemplate: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    numberOfDrafts: z.number().int().min(1).max(5).default(3)
  }).optional()
})

export type GenerateScriptRequest = z.infer<typeof GenerateScriptRequestSchema>

// Script edit request schema
export const EditScriptRequestSchema = z.object({
  draftId: z.string().uuid(),
  edits: z.array(z.object({
    field: z.enum(['title', 'content', 'hooks', 'callToAction', 'hashtags']),
    action: z.enum(['replace', 'insert', 'delete', 'append', 'prepend']),
    value: z.string(),
    position: z.number().int().optional(), // for insert/delete operations
    length: z.number().int().optional() // for delete operations
  })).min(1),
  reason: z.string().optional(),
  preserveFormatting: z.boolean().default(true)
})

export type EditScriptRequest = z.infer<typeof EditScriptRequestSchema>

// Validation functions
export function validateScriptDuration(content: string, targetDuration: number): boolean {
  // Average speaking rate: 150-200 words per minute for TikTok
  const wordsPerMinute = 180
  const wordCount = content.split(/\s+/).length
  const estimatedDuration = (wordCount / wordsPerMinute) * 60
  
  // Allow 20% variance
  const tolerance = targetDuration * 0.2
  return Math.abs(estimatedDuration - targetDuration) <= tolerance
}

export function extractVisualKeywords(content: string): Array<{keyword: string, context: string, importance: number, position: number}> {
  // Visual-oriented keywords that suggest imagery
  const visualPatterns = [
    /\b(show|see|look|view|display|reveal|appear|emerge|bright|dark|colorful|massive|tiny|beautiful|stunning)\b/gi,
    /\b(building|car|person|people|crowd|landscape|sky|water|fire|light|shadow|movement|action)\b/gi,
    /\b(red|blue|green|yellow|orange|purple|black|white|golden|silver)\b/gi
  ]
  
  const keywords: Array<{keyword: string, context: string, importance: number, position: number}> = []
  
  visualPatterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const keyword = match[0].toLowerCase()
      const start = Math.max(0, match.index - 20)
      const end = Math.min(content.length, match.index + match[0].length + 20)
      const context = content.slice(start, end)
      
      keywords.push({
        keyword,
        context,
        importance: 0.7, // Default importance, could be enhanced with NLP
        position: match.index
      })
    }
  })
  
  return keywords
}

export function calculateScriptQuality(script: ScriptDraft): number {
  let score = 0
  let factors = 0
  
  // Duration accuracy (25% weight)
  if (script.estimatedDuration >= 15 && script.estimatedDuration <= 60) {
    score += 0.25
  } else if (script.estimatedDuration <= 90) {
    score += 0.15
  }
  factors += 0.25
  
  // Hook quality (20% weight)
  if (script.hooks.length > 0) {
    score += Math.min(script.hooks.length * 0.05, 0.2)
  }
  factors += 0.2
  
  // Content length appropriateness (15% weight)
  if (script.wordCount >= 50 && script.wordCount <= 200) {
    score += 0.15
  } else if (script.wordCount <= 300) {
    score += 0.1
  }
  factors += 0.15
  
  // CTA presence (10% weight)
  if (script.callToAction && script.callToAction.length > 5) {
    score += 0.1
  }
  factors += 0.1
  
  // Hashtag relevance (10% weight)
  if (script.hashtags.length >= 3 && script.hashtags.length <= 8) {
    score += 0.1
  } else if (script.hashtags.length > 0) {
    score += 0.05
  }
  factors += 0.1
  
  // AI confidence (20% weight)
  if (script.confidence !== undefined) {
    score += script.confidence * 0.2
  }
  factors += 0.2
  
  return Math.min(score / factors, 1)
}