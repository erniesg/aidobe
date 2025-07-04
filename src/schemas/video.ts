import { z } from 'zod'

// Video assembly configuration schema for final video composition
export const VideoAssemblyConfigSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  scenePlanId: z.string().uuid(),
  
  // Output specifications
  output: z.object({
    resolution: z.object({
      width: z.number().int().min(240).max(4096),
      height: z.number().int().min(240).max(4096)
    }),
    aspectRatio: z.enum(['9:16', '16:9', '1:1', '4:3', '3:4']).default('9:16'),
    frameRate: z.number().int().min(24).max(60).default(30),
    duration: z.number().min(5).max(300), // seconds
    format: z.enum(['mp4', 'mov', 'webm']).default('mp4'),
    quality: z.enum(['draft', 'standard', 'high', 'ultra']).default('standard')
  }),
  
  // Video codec settings
  encoding: z.object({
    videoCodec: z.enum(['h264', 'h265', 'vp9', 'av1']).default('h264'),
    audioCodec: z.enum(['aac', 'mp3', 'opus']).default('aac'),
    bitrate: z.object({
      video: z.number().int().min(500).max(50000).default(2000), // kbps
      audio: z.number().int().min(64).max(320).default(128) // kbps
    }),
    preset: z.enum(['ultrafast', 'fast', 'medium', 'slow', 'veryslow']).default('medium'),
    constantRateFactor: z.number().int().min(0).max(51).default(23) // CRF for quality
  }).default(() => ({
    videoCodec: 'h264' as const,
    audioCodec: 'aac' as const,
    bitrate: {
      video: 2000,
      audio: 128
    },
    preset: 'medium' as const,
    constantRateFactor: 23
  })),
  
  // Scene assembly configuration
  scenes: z.array(z.object({
    sceneId: z.string().uuid(),
    startTime: z.number().min(0),
    duration: z.number().min(0.1),
    
    // Asset configuration for this scene
    primaryAsset: z.object({
      assetId: z.string().uuid(),
      assetUrl: z.string().url(),
      positioning: z.object({
        x: z.number().default(0), // center offset percentage
        y: z.number().default(0), // center offset percentage
        scale: z.number().min(0.1).max(5).default(1),
        rotation: z.number().min(-180).max(180).default(0),
        opacity: z.number().min(0).max(1).default(1)
      }).default({})
    }),
    
    // Secondary assets (overlays, backgrounds)
    secondaryAssets: z.array(z.object({
      assetId: z.string().uuid(),
      assetUrl: z.string().url(),
      layer: z.number().int().min(0).default(1), // layer order (0 = background)
      positioning: z.object({
        x: z.number().default(0),
        y: z.number().default(0),
        scale: z.number().min(0.1).max(5).default(1),
        rotation: z.number().min(-180).max(180).default(0),
        opacity: z.number().min(0).max(1).default(1)
      }).default({}),
      blendMode: z.enum(['normal', 'multiply', 'screen', 'overlay', 'soft_light']).default('normal')
    })).default([]),
    
    // Transition to next scene
    transition: z.object({
      type: z.enum(['cut', 'fade', 'dissolve', 'slide_left', 'slide_right', 'zoom_in', 'zoom_out']).default('fade'),
      duration: z.number().min(0).max(3).default(0.3),
      easing: z.enum(['linear', 'ease_in', 'ease_out', 'ease_in_out']).default('ease_in_out')
    }).default({})
  })),
  
  // Global effects applied to entire video
  globalEffects: z.object({
    colorGrading: z.object({
      enabled: z.boolean().default(false),
      brightness: z.number().min(-1).max(1).default(0),
      contrast: z.number().min(-1).max(1).default(0),
      saturation: z.number().min(-1).max(1).default(0),
      temperature: z.number().min(-1).max(1).default(0), // warm/cool
      tint: z.number().min(-1).max(1).default(0), // green/magenta
      highlights: z.number().min(-1).max(1).default(0),
      shadows: z.number().min(-1).max(1).default(0)
    }).default({}),
    
    stabilization: z.object({
      enabled: z.boolean().default(false),
      strength: z.number().min(0).max(1).default(0.5)
    }).default({}),
    
    sharpening: z.object({
      enabled: z.boolean().default(false),
      amount: z.number().min(0).max(2).default(0.5)
    }).default({})
  }).default({}),
  
  // Audio configuration
  audio: z.object({
    audioMixConfigId: z.string().uuid(),
    syncOffset: z.number().default(0), // audio sync adjustment in seconds
    fadeIn: z.number().min(0).max(5).default(0),
    fadeOut: z.number().min(0).max(5).default(1)
  }),
  
  // Watermark and branding
  watermark: z.object({
    enabled: z.boolean().default(false),
    imageUrl: z.string().url().optional(),
    text: z.string().optional(),
    position: z.enum(['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center']).default('bottom_right'),
    opacity: z.number().min(0).max(1).default(0.7),
    scale: z.number().min(0.1).max(1).default(0.1)
  }).default({}),
  
  // Processing metadata
  createdAt: z.string().datetime(),
  estimatedProcessingTime: z.number().positive().optional(), // seconds
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal')
})

export type VideoAssemblyConfig = z.infer<typeof VideoAssemblyConfigSchema>

// Effects configuration schema for individual effects
export const EffectsConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum([
    'ken_burns',
    'zoom_in',
    'zoom_out',
    'pan_left',
    'pan_right',
    'rotate',
    'fade_in',
    'fade_out',
    'blur',
    'sharpen',
    'color_shift',
    'particle_overlay',
    'light_rays',
    'glitch',
    'vignette',
    'text_overlay'
  ]),
  
  // Effect timing
  timing: z.object({
    startTime: z.number().min(0), // relative to scene start
    duration: z.number().min(0.1), // 0 means entire scene duration
    easing: z.enum(['linear', 'ease_in', 'ease_out', 'ease_in_out', 'bounce']).default('ease_in_out')
  }),
  
  // Type-specific parameters
  parameters: z.record(z.unknown()).default({}),
  
  // Common properties
  intensity: z.number().min(0).max(1).default(0.5),
  enabled: z.boolean().default(true),
  layer: z.number().int().min(0).default(1), // rendering order
  
  // Masking (apply effect only to certain areas)
  mask: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['rectangle', 'circle', 'polygon', 'gradient']).optional(),
    coordinates: z.array(z.number()).default([]), // depends on mask type
    feather: z.number().min(0).max(1).default(0) // soft edges
  }).default({})
})

export type EffectsConfig = z.infer<typeof EffectsConfigSchema>

// Video output schema for final results
export const VideoOutputSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  assemblyConfigId: z.string().uuid(),
  
  // Output file information
  outputUrl: z.string().url(),
  localPath: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(), // lower quality preview
  
  // Video properties
  duration: z.number().min(1), // actual duration in seconds
  fileSize: z.number().int().positive(), // bytes
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }),
  frameRate: z.number().int().positive(),
  bitrate: z.number().int().positive(), // kbps
  format: z.string(),
  
  // Quality metrics
  quality: z.object({
    overallScore: z.number().min(0).max(1).optional(),
    visualQuality: z.number().min(0).max(1).optional(),
    audioQuality: z.number().min(0).max(1).optional(),
    compression: z.number().min(0).max(1).optional(), // compression efficiency
    artifactsDetected: z.boolean().default(false),
    issues: z.array(z.string()).default([])
  }).default({}),
  
  // Processing information
  processing: z.object({
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    processingTime: z.number().positive().optional(), // seconds
    cpuTime: z.number().positive().optional(), // CPU seconds used
    memoryUsed: z.number().int().positive().optional(), // peak memory in MB
    
    // Processing stages
    stages: z.array(z.object({
      stage: z.string(),
      startedAt: z.string().datetime(),
      completedAt: z.string().datetime().optional(),
      duration: z.number().positive().optional(), // seconds
      status: z.enum(['pending', 'processing', 'completed', 'failed']),
      progress: z.number().min(0).max(1).optional(),
      details: z.string().optional()
    })).default([])
  }),
  
  // Validation results
  validation: z.object({
    durationMatches: z.boolean(),
    audioSyncValid: z.boolean(),
    qualityAcceptable: z.boolean(),
    noCorruption: z.boolean(),
    playbackTested: z.boolean(),
    issues: z.array(z.string()).default([])
  }).default({
    durationMatches: false,
    audioSyncValid: false,
    qualityAcceptable: false,
    noCorruption: false,
    playbackTested: false
  }),
  
  // Delivery information
  delivery: z.object({
    status: z.enum(['processing', 'ready', 'delivered', 'failed']).default('processing'),
    downloadUrl: z.string().url().optional(),
    expiresAt: z.string().datetime().optional(),
    downloadCount: z.number().int().min(0).default(0),
    deliveredAt: z.string().datetime().optional()
  }).default({}),
  
  // Metadata and tags
  metadata: z.object({
    originalInputs: z.record(z.unknown()).default({}),
    effectsApplied: z.array(z.string()).default([]),
    processingProvider: z.string().optional(), // 'cloudflare', 'modal', etc.
    version: z.string().default('1.0')
  }).default({})
})

export type VideoOutput = z.infer<typeof VideoOutputSchema>

// Video processing request schema
export const VideoProcessingRequestSchema = z.object({
  jobId: z.string().uuid(),
  assemblyConfigId: z.string().uuid(),
  
  // Processing options
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  processingProvider: z.enum(['cloudflare', 'modal', 'ffmpeg_local']).optional(),
  
  // Quality requirements
  qualityRequirements: z.object({
    minQualityScore: z.number().min(0).max(1).default(0.7),
    maxFileSize: z.number().int().positive().optional(), // bytes
    maxProcessingTime: z.number().positive().optional(), // seconds
    requirePreview: z.boolean().default(true)
  }).default({}),
  
  // Callback configuration
  webhooks: z.object({
    onProgress: z.string().url().optional(),
    onComplete: z.string().url().optional(),
    onError: z.string().url().optional()
  }).default({}),
  
  // Retry configuration
  retryConfig: z.object({
    maxRetries: z.number().int().min(0).max(5).default(2),
    backoffMultiplier: z.number().min(1).max(10).default(2),
    retryOnFailure: z.boolean().default(true)
  }).default({})
})

export type VideoProcessingRequest = z.infer<typeof VideoProcessingRequestSchema>

// Ken Burns effect specific configuration
export const KenBurnsEffectSchema = z.object({
  startZoom: z.number().min(1).max(3).default(1),
  endZoom: z.number().min(1).max(3).default(1.2),
  startPosition: z.object({
    x: z.number().min(-0.5).max(0.5).default(0),
    y: z.number().min(-0.5).max(0.5).default(0)
  }).default({}),
  endPosition: z.object({
    x: z.number().min(-0.5).max(0.5).default(0),
    y: z.number().min(-0.5).max(0.5).default(0)
  }).default({}),
  easing: z.enum(['linear', 'ease_in', 'ease_out', 'ease_in_out']).default('ease_in_out')
})

export type KenBurnsEffect = z.infer<typeof KenBurnsEffectSchema>

// Text overlay configuration
export const TextOverlaySchema = z.object({
  id: z.string().uuid(),
  text: z.string().min(1).max(500),
  
  // Timing
  startTime: z.number().min(0),
  duration: z.number().min(0.1),
  
  // Positioning
  position: z.object({
    x: z.number().min(0).max(1).default(0.5), // percentage of screen width
    y: z.number().min(0).max(1).default(0.8), // percentage of screen height
    anchor: z.enum(['top_left', 'top_center', 'top_right', 'center_left', 'center', 'center_right', 'bottom_left', 'bottom_center', 'bottom_right']).default('bottom_center')
  }),
  
  // Styling
  style: z.object({
    fontFamily: z.string().default('Arial Black'),
    fontSize: z.number().min(12).max(200).default(48),
    fontWeight: z.enum(['normal', 'bold', 'bolder']).default('bold'),
    color: z.string().default('#FFFFFF'), // hex color
    backgroundColor: z.string().optional(), // hex color, optional background
    borderColor: z.string().optional(),
    borderWidth: z.number().min(0).max(10).default(0),
    
    // Text effects
    shadow: z.object({
      enabled: z.boolean().default(true),
      color: z.string().default('#000000'),
      offsetX: z.number().default(2),
      offsetY: z.number().default(2),
      blur: z.number().min(0).max(20).default(4)
    }).default({}),
    
    outline: z.object({
      enabled: z.boolean().default(false),
      color: z.string().default('#000000'),
      width: z.number().min(0).max(10).default(2)
    }).default({})
  }).default({}),
  
  // Animation
  animation: z.object({
    entrance: z.enum(['none', 'fade_in', 'slide_up', 'slide_down', 'scale_in', 'typewriter']).default('fade_in'),
    exit: z.enum(['none', 'fade_out', 'slide_up', 'slide_down', 'scale_out']).default('fade_out'),
    duration: z.number().min(0.1).max(2).default(0.3)
  }).default({})
})

export type TextOverlay = z.infer<typeof TextOverlaySchema>

// Validation functions
export function validateVideoResolution(width: number, height: number, aspectRatio: string): boolean {
  const aspectRatios = {
    '9:16': 9/16,
    '16:9': 16/9,
    '1:1': 1,
    '4:3': 4/3,
    '3:4': 3/4
  }
  
  const expectedRatio = aspectRatios[aspectRatio as keyof typeof aspectRatios]
  if (!expectedRatio) return false
  
  const actualRatio = width / height
  const tolerance = 0.02 // 2% tolerance
  
  return Math.abs(actualRatio - expectedRatio) <= tolerance
}

export function calculateVideoBitrate(resolution: {width: number, height: number}, frameRate: number, quality: string): number {
  const pixelsPerSecond = resolution.width * resolution.height * frameRate
  
  // Bitrate multipliers based on quality
  const qualityMultipliers = {
    'draft': 0.1,
    'standard': 0.2,
    'high': 0.3,
    'ultra': 0.5
  }
  
  const multiplier = qualityMultipliers[quality as keyof typeof qualityMultipliers] || 0.2
  
  // Base calculation: bits per pixel per second
  const bitsPerPixelPerSecond = 0.1 * multiplier
  
  return Math.round(pixelsPerSecond * bitsPerPixelPerSecond / 1000) // Convert to kbps
}

export function optimizeEffectsForPerformance(effects: EffectsConfig[]): EffectsConfig[] {
  // Sort effects by rendering cost (lighter effects first)
  const effectComplexity = {
    'fade_in': 1,
    'fade_out': 1,
    'zoom_in': 2,
    'zoom_out': 2,
    'pan_left': 2,
    'pan_right': 2,
    'ken_burns': 3,
    'rotate': 3,
    'blur': 4,
    'sharpen': 4,
    'color_shift': 3,
    'text_overlay': 2,
    'vignette': 3,
    'particle_overlay': 5,
    'light_rays': 5,
    'glitch': 4
  }
  
  return effects
    .filter(effect => effect.enabled)
    .sort((a, b) => {
      const complexityA = effectComplexity[a.type as keyof typeof effectComplexity] || 5
      const complexityB = effectComplexity[b.type as keyof typeof effectComplexity] || 5
      return complexityA - complexityB
    })
}

export function validateSceneTransitions(scenes: VideoAssemblyConfig['scenes']): {valid: boolean, issues: string[]} {
  const issues: string[] = []
  
  for (let i = 0; i < scenes.length - 1; i++) {
    const currentScene = scenes[i]
    const nextScene = scenes[i + 1]
    const transition = currentScene.transition
    
    // Check if transition duration is reasonable
    if (transition.duration > currentScene.duration / 2) {
      issues.push(`Scene ${i + 1}: Transition duration (${transition.duration}s) is too long for scene duration (${currentScene.duration}s)`)
    }
    
    // Check for temporal overlap issues
    const currentEndTime = currentScene.startTime + currentScene.duration
    if (currentEndTime > nextScene.startTime) {
      issues.push(`Scene ${i + 1}: Overlaps with next scene`)
    }
    
    // Validate transition timing
    if (transition.duration > 0 && currentEndTime - transition.duration < currentScene.startTime) {
      issues.push(`Scene ${i + 1}: Transition starts before scene begins`)
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

export function estimateProcessingTime(config: VideoAssemblyConfig): number {
  const baseTimePerSecond = 2 // seconds of processing per second of video
  let multiplier = 1
  
  // Factor in resolution
  const totalPixels = config.output.resolution.width * config.output.resolution.height
  if (totalPixels > 2073600) { // 1920x1080
    multiplier *= 1.5
  } else if (totalPixels > 921600) { // 1280x720
    multiplier *= 1.2
  }
  
  // Factor in frame rate
  if (config.output.frameRate > 30) {
    multiplier *= 1.3
  }
  
  // Factor in effects complexity
  const totalEffects = config.scenes.reduce((sum, scene) => {
    return sum + (scene.secondaryAssets?.length || 0)
  }, 0)
  
  if (totalEffects > 10) {
    multiplier *= 1.4
  } else if (totalEffects > 5) {
    multiplier *= 1.2
  }
  
  // Factor in quality setting
  const qualityMultipliers = {
    'draft': 0.5,
    'standard': 1,
    'high': 1.5,
    'ultra': 2.5
  }
  
  multiplier *= qualityMultipliers[config.output.quality] || 1
  
  return Math.ceil(config.output.duration * baseTimePerSecond * multiplier)
}

export function generateOptimalKenBurnsEffect(imageAspectRatio: number, videoDuration: number): KenBurnsEffect {
  // Create subtle Ken Burns effect based on image properties
  const zoomRange = Math.min(0.3, videoDuration * 0.05) // More zoom for longer scenes
  
  return {
    startZoom: 1,
    endZoom: 1 + zoomRange,
    startPosition: {
      x: imageAspectRatio > 1 ? -0.1 : 0, // Pan for wide images
      y: 0
    },
    endPosition: {
      x: imageAspectRatio > 1 ? 0.1 : 0,
      y: imageAspectRatio < 1 ? 0.1 : 0 // Pan for tall images
    },
    easing: 'ease_in_out'
  }
}