import { z } from 'zod'

// Scene timing schema
export const SceneTimingSchema = z.object({
  startTime: z.number().min(0), // seconds
  duration: z.number().min(0.5).max(30), // seconds
  endTime: z.number().min(0), // calculated: startTime + duration
  fadeIn: z.number().min(0).max(2).default(0), // seconds
  fadeOut: z.number().min(0).max(2).default(0) // seconds
})

export type SceneTiming = z.infer<typeof SceneTimingSchema>

// Visual effect schema
export const EffectSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'ken_burns',
    'zoom_in',
    'zoom_out', 
    'pan_left',
    'pan_right',
    'fade',
    'blur',
    'sharpen',
    'saturation',
    'brightness',
    'contrast',
    'overlay_text',
    'particle_effect',
    'transition'
  ]),
  intensity: z.number().min(0).max(1).default(0.5),
  duration: z.number().min(0.1).max(10).optional(), // seconds, null for full scene
  startTime: z.number().min(0).optional(), // relative to scene start
  parameters: z.record(z.unknown()).default({}), // effect-specific parameters
  enabled: z.boolean().default(true)
})

export type Effect = z.infer<typeof EffectSchema>

// Scene asset reference schema
export const SceneAssetSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['image', 'video', 'generated_image', 'stock_video']),
  url: z.string().url(),
  localPath: z.string().optional(), // for downloaded assets
  source: z.enum(['pexels', 'pixabay', 'replicate', 'openai', 'manual_upload']),
  
  // Asset metadata
  metadata: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().optional(), // for videos
    fileSize: z.number().int().positive().optional(),
    format: z.string().optional(),
    license: z.string().optional(),
    attribution: z.string().optional()
  }).default({}),
  
  // Selection reasoning
  relevanceScore: z.number().min(0).max(1).optional(),
  qualityScore: z.number().min(0).max(1).optional(),
  selectionReason: z.string().optional(),
  
  // Positioning and effects for this scene
  positioning: z.object({
    x: z.number().default(0), // center offset
    y: z.number().default(0), // center offset  
    scale: z.number().min(0.1).max(3).default(1),
    rotation: z.number().min(-180).max(180).default(0),
    opacity: z.number().min(0).max(1).default(1)
  }).default({}),
  
  effects: z.array(EffectSchema).default([]),
  createdAt: z.string().datetime()
})

export type SceneAsset = z.infer<typeof SceneAssetSchema>

// Individual scene schema
export const SceneSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  scriptId: z.string().uuid(), // reference to final script
  
  // Scene identification
  sequenceNumber: z.number().int().min(1),
  title: z.string().min(1).max(100).optional(),
  type: z.enum(['intro', 'main', 'transition', 'conclusion', 'hook', 'cta']),
  
  // Content
  textContent: z.string().min(1).max(1000), // the script text for this scene
  visualKeywords: z.array(z.string()).default([]), // keywords for asset search
  mood: z.enum(['energetic', 'calm', 'dramatic', 'professional', 'humorous', 'inspiring']).optional(),
  
  // Timing
  timing: SceneTimingSchema,
  
  // Assets
  primaryAsset: SceneAssetSchema.optional(), // main visual
  secondaryAssets: z.array(SceneAssetSchema).default([]), // overlays, backgrounds
  
  // Audio references
  audioSegment: z.object({
    ttsId: z.string().uuid().optional(), // reference to TTS generation
    startOffset: z.number().min(0), // offset in the full audio
    duration: z.number().min(0.5), // duration of this segment
    volume: z.number().min(0).max(1).default(1),
    fadeIn: z.number().min(0).max(2).default(0),
    fadeOut: z.number().min(0).max(2).default(0)
  }).optional(),
  
  // Captions and text overlays
  captions: z.array(z.object({
    id: z.string().uuid(),
    text: z.string(),
    startTime: z.number().min(0), // relative to scene start
    duration: z.number().min(0.1),
    style: z.object({
      fontSize: z.number().min(12).max(72).default(24),
      fontFamily: z.string().default('Arial'),
      color: z.string().default('#FFFFFF'),
      backgroundColor: z.string().optional(),
      position: z.enum(['top', 'center', 'bottom']).default('bottom'),
      alignment: z.enum(['left', 'center', 'right']).default('center'),
      bold: z.boolean().default(false),
      italic: z.boolean().default(false),
      shadow: z.boolean().default(true)
    }).default({})
  })).default([]),
  
  // Scene-level effects
  effects: z.array(EffectSchema).default([]),
  
  // Generation metadata
  metadata: z.object({
    generatedAt: z.string().datetime(),
    sourceText: z.string(), // original script portion
    extractionMethod: z.enum(['automatic', 'manual', 'hybrid']),
    confidence: z.number().min(0).max(1).optional(),
    reviewStatus: z.enum(['pending', 'approved', 'needs_revision']).default('pending')
  }),
  
  // Manual overrides
  overrides: z.object({
    assetOverridden: z.boolean().default(false),
    timingOverridden: z.boolean().default(false),
    effectsOverridden: z.boolean().default(false),
    lastOverrideBy: z.string().optional(),
    lastOverrideAt: z.string().datetime().optional()
  }).default({}),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type Scene = z.infer<typeof SceneSchema>

// Complete scene plan schema
export const ScenePlanSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  scriptId: z.string().uuid(),
  
  // Plan overview
  title: z.string().min(1).max(200),
  totalDuration: z.number().min(15).max(120), // seconds
  sceneCount: z.number().int().min(1).max(20),
  
  // Scenes in order
  scenes: z.array(SceneSchema).min(1),
  
  // Global settings that apply to all scenes
  globalSettings: z.object({
    aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
    resolution: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }),
    frameRate: z.number().int().min(24).max(60).default(30),
    
    // Default styling
    defaultCaptionStyle: z.object({
      fontSize: z.number().min(12).max(72).default(24),
      fontFamily: z.string().default('Arial Black'),
      color: z.string().default('#FFFFFF'),
      position: z.enum(['top', 'center', 'bottom']).default('bottom'),
      shadow: z.boolean().default(true)
    }).default({}),
    
    // Transition settings
    defaultTransition: z.object({
      type: z.enum(['cut', 'fade', 'slide', 'zoom']).default('fade'),
      duration: z.number().min(0).max(2).default(0.3)
    }).default({})
  }),
  
  // Quality validation
  validation: z.object({
    timingValid: z.boolean(),
    allAssetsAvailable: z.boolean(),
    durationMatches: z.boolean(),
    issuesFound: z.array(z.string()).default([]),
    lastValidatedAt: z.string().datetime().optional()
  }).default({
    timingValid: false,
    allAssetsAvailable: false,
    durationMatches: false
  }),
  
  // Approval tracking
  approval: z.object({
    status: z.enum(['draft', 'pending_review', 'approved', 'rejected']).default('draft'),
    approvedBy: z.string().optional(),
    approvedAt: z.string().datetime().optional(),
    rejectionReason: z.string().optional(),
    version: z.number().int().positive().default(1)
  }),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type ScenePlan = z.infer<typeof ScenePlanSchema>

// Scene edit request schema
export const SceneEditSchema = z.object({
  sceneId: z.string().uuid(),
  editType: z.enum([
    'timing_adjustment',
    'asset_replacement',
    'effect_modification',
    'caption_update',
    'content_revision',
    'positioning_change'
  ]),
  
  changes: z.object({
    // Timing changes
    timing: SceneTimingSchema.partial().optional(),
    
    // Asset changes
    primaryAsset: SceneAssetSchema.optional(),
    assetsToAdd: z.array(SceneAssetSchema).optional(),
    assetsToRemove: z.array(z.string().uuid()).optional(),
    
    // Effect changes
    effectsToAdd: z.array(EffectSchema).optional(),
    effectsToRemove: z.array(z.string().uuid()).optional(),
    effectsToModify: z.array(z.object({
      effectId: z.string().uuid(),
      changes: EffectSchema.partial()
    })).optional(),
    
    // Caption changes
    captionsToAdd: z.array(z.object({
      id: z.string().uuid(),
      text: z.string(),
      startTime: z.number().min(0),
      duration: z.number().min(0.1),
      style: z.object({
        fontSize: z.number().min(12).max(72).default(24),
        fontFamily: z.string().default('Arial'),
        color: z.string().default('#FFFFFF'),
        backgroundColor: z.string().optional(),
        position: z.enum(['top', 'center', 'bottom']).default('bottom'),
        alignment: z.enum(['left', 'center', 'right']).default('center'),
        bold: z.boolean().default(false),
        italic: z.boolean().default(false),
        shadow: z.boolean().default(true)
      }).default({})
    })).optional(),
    captionsToRemove: z.array(z.string().uuid()).optional(),
    captionsToModify: z.array(z.object({
      captionId: z.string().uuid(),
      changes: z.object({
        text: z.string().optional(),
        startTime: z.number().min(0).optional(),
        duration: z.number().min(0.1).optional(),
        style: z.object({
          fontSize: z.number().min(12).max(72).optional(),
          fontFamily: z.string().optional(),
          color: z.string().optional(),
          backgroundColor: z.string().optional(),
          position: z.enum(['top', 'center', 'bottom']).optional(),
          alignment: z.enum(['left', 'center', 'right']).optional(),
          bold: z.boolean().optional(),
          italic: z.boolean().optional(),
          shadow: z.boolean().optional()
        }).optional()
      })
    })).optional(),
    
    // Content changes
    textContent: z.string().optional(),
    visualKeywords: z.array(z.string()).optional(),
    mood: SceneSchema.shape.mood.optional()
  }),
  
  reason: z.string().optional(),
  appliedBy: z.string().optional(),
  appliedAt: z.string().datetime()
})

export type SceneEdit = z.infer<typeof SceneEditSchema>

// Scene extraction request schema
export const ExtractScenesRequestSchema = z.object({
  jobId: z.string().uuid(),
  scriptId: z.string().uuid(),
  preferences: z.object({
    targetSceneCount: z.number().int().min(1).max(20).optional(),
    averageSceneDuration: z.number().min(3).max(15).optional(), // seconds
    extractionStrategy: z.enum(['automatic', 'sentence_based', 'paragraph_based', 'semantic_breaks']).default('automatic'),
    includeTransitions: z.boolean().default(true)
  }).optional(),
  
  globalSettings: ScenePlanSchema.shape.globalSettings.optional()
})

export type ExtractScenesRequest = z.infer<typeof ExtractScenesRequestSchema>

// Validation functions
export function validateSceneTiming(scenes: Scene[]): {valid: boolean, issues: string[]} {
  const issues: string[] = []
  let currentTime = 0
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    
    // Check if scene starts at the right time
    if (Math.abs(scene.timing.startTime - currentTime) > 0.1) {
      issues.push(`Scene ${i + 1}: Start time ${scene.timing.startTime}s doesn't match expected ${currentTime}s`)
    }
    
    // Check duration
    if (scene.timing.duration < 0.5) {
      issues.push(`Scene ${i + 1}: Duration ${scene.timing.duration}s is too short (minimum 0.5s)`)
    }
    
    if (scene.timing.duration > 30) {
      issues.push(`Scene ${i + 1}: Duration ${scene.timing.duration}s is too long (maximum 30s)`)
    }
    
    // Check end time calculation
    const expectedEndTime = scene.timing.startTime + scene.timing.duration
    if (Math.abs(scene.timing.endTime - expectedEndTime) > 0.01) {
      issues.push(`Scene ${i + 1}: End time ${scene.timing.endTime}s doesn't match calculated ${expectedEndTime}s`)
    }
    
    // Check for overlaps with next scene
    if (i < scenes.length - 1) {
      const nextScene = scenes[i + 1]
      if (scene.timing.endTime > nextScene.timing.startTime) {
        issues.push(`Scene ${i + 1} overlaps with scene ${i + 2}`)
      }
    }
    
    currentTime = scene.timing.endTime
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

export function calculateTotalDuration(scenes: Scene[]): number {
  if (scenes.length === 0) return 0
  
  const lastScene = scenes[scenes.length - 1]
  return lastScene.timing.endTime
}

export function extractVisualKeywordsFromText(text: string): string[] {
  // Enhanced visual keyword extraction
  const visualPatterns = [
    // Objects and entities
    /\b(building|house|car|vehicle|person|people|crowd|animal|tree|flower|mountain|ocean|sky|cloud)\b/gi,
    // Actions and movements
    /\b(running|walking|flying|jumping|dancing|swimming|driving|working|playing|cooking|reading)\b/gi,
    // Visual descriptors
    /\b(bright|dark|colorful|massive|tiny|beautiful|stunning|amazing|incredible|fast|slow|big|small)\b/gi,
    // Colors
    /\b(red|blue|green|yellow|orange|purple|black|white|golden|silver|pink|brown|gray)\b/gi,
    // Visual verbs
    /\b(show|see|look|view|display|reveal|appear|emerge|demonstrate|illustrate|present)\b/gi
  ]
  
  const keywords = new Set<string>()
  
  visualPatterns.forEach(pattern => {
    const matches = text.match(pattern)
    if (matches) {
      matches.forEach(match => keywords.add(match.toLowerCase()))
    }
  })
  
  return Array.from(keywords)
}

export function optimizeSceneTiming(scenes: Scene[], targetDuration: number): Scene[] {
  const currentDuration = calculateTotalDuration(scenes)
  const scaleFactor = targetDuration / currentDuration
  
  return scenes.map((scene, index) => {
    const newDuration = Math.max(0.5, scene.timing.duration * scaleFactor)
    const newStartTime = index === 0 ? 0 : scenes[index - 1].timing.endTime
    
    return {
      ...scene,
      timing: {
        ...scene.timing,
        duration: newDuration,
        startTime: newStartTime,
        endTime: newStartTime + newDuration
      }
    }
  })
}

export function generateSceneTransitions(scenes: Scene[]): Effect[] {
  const transitions: Effect[] = []
  
  for (let i = 0; i < scenes.length - 1; i++) {
    const currentScene = scenes[i]
    const nextScene = scenes[i + 1]
    
    // Choose transition type based on scene types
    let transitionType: Effect['type'] = 'fade'
    
    if (currentScene.type === 'intro' && nextScene.type === 'main') {
      transitionType = 'zoom_in'
    } else if (currentScene.type === 'main' && nextScene.type === 'conclusion') {
      transitionType = 'fade'
    } else if (currentScene.mood !== nextScene.mood) {
      transitionType = 'fade'
    }
    
    transitions.push({
      id: crypto.randomUUID(),
      type: transitionType,
      intensity: 0.5,
      duration: 0.3,
      startTime: currentScene.timing.endTime - 0.15,
      parameters: {},
      enabled: true
    })
  }
  
  return transitions
}