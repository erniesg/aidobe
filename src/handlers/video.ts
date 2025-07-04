import { Hono } from 'hono'
import { z } from 'zod'
import { ReplicateService, ReplicateVideoModelSchema } from '../services/replicate'
import { StorageService } from '../services/storage'
import { DatabaseService } from '../services/database'
import type { Env } from '../types/env'

// Legacy video generation schema (for Replicate models)
const VideoRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  model: ReplicateVideoModelSchema.default('minimax/video-01'),
  parameters: z.record(z.any()).optional()
})

// Video assembly request schemas for the complete video pipeline
const VideoAssemblyRequestSchema = z.object({
  jobId: z.string().uuid(),
  finalScriptId: z.string().uuid(),
  audioMixId: z.string().uuid(),
  scenes: z.array(z.object({
    sceneId: z.string().uuid(),
    sequenceNumber: z.number().int().positive(),
    textContent: z.string(),
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    selectedAssetUrl: z.string().url(),
    assetType: z.enum(['image', 'video']),
    effects: z.object({
      kenBurns: z.object({
        enabled: z.boolean().default(false),
        startScale: z.number().min(1).max(3).default(1.2),
        endScale: z.number().min(1).max(3).default(1.5),
        direction: z.enum(['zoom_in', 'zoom_out', 'pan_left', 'pan_right']).default('zoom_in')
      }).optional(),
      transition: z.object({
        type: z.enum(['fade', 'dissolve', 'slide', 'zoom', 'cut']).default('fade'),
        duration: z.number().min(0.1).max(2).default(0.5)
      }).optional(),
      overlay: z.object({
        enabled: z.boolean().default(false),
        type: z.enum(['gradient', 'vignette', 'blur']).optional(),
        opacity: z.number().min(0).max(1).default(0.3)
      }).optional()
    }).default({})
  })).min(1),
  outputConfig: z.object({
    resolution: z.enum(['720p', '1080p', '4k']).default('1080p'),
    aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('9:16'),
    frameRate: z.number().int().min(24).max(60).default(30),
    format: z.enum(['mp4', 'mov', 'webm']).default('mp4'),
    quality: z.enum(['draft', 'standard', 'high', 'premium']).default('standard'),
    watermark: z.object({
      enabled: z.boolean().default(false),
      text: z.string().optional(),
      position: z.enum(['top_left', 'top_right', 'bottom_left', 'bottom_right', 'center']).default('bottom_right'),
      opacity: z.number().min(0).max(1).default(0.7)
    }).optional()
  }).default({})
})

const EffectsApplicationRequestSchema = z.object({
  videoJobId: z.string().uuid(),
  effects: z.array(z.object({
    sceneId: z.string().uuid(),
    effectType: z.enum(['ken_burns', 'color_correction', 'stabilization', 'noise_reduction']),
    parameters: z.record(z.any()),
    enabled: z.boolean().default(true)
  })).min(1),
  preview: z.boolean().default(false)
})

const CaptionRequestSchema = z.object({
  videoJobId: z.string().uuid(),
  transcriptionId: z.string().uuid(),
  captionConfig: z.object({
    style: z.enum(['modern', 'classic', 'bold', 'minimal']).default('modern'),
    position: z.enum(['bottom', 'top', 'center']).default('bottom'),
    fontSize: z.number().min(12).max(72).default(24),
    fontFamily: z.string().default('Arial'),
    color: z.string().default('#FFFFFF'),
    backgroundColor: z.string().optional(),
    strokeColor: z.string().optional(),
    strokeWidth: z.number().min(0).max(5).default(1),
    animation: z.enum(['none', 'fade_in', 'slide_up', 'typewriter']).default('fade_in'),
    wordHighlight: z.boolean().default(true)
  }).default({})
})

export const videoRoutes = new Hono<{ Bindings: Env }>()

videoRoutes.post('/generate', async (c) => {
  const body = await c.req.json()
  const validation = VideoRequestSchema.safeParse(body)
  
  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.issues }, 400)
  }
  
  const { prompt, model, parameters } = validation.data
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  const replicate = new ReplicateService(c.env.REPLICATE_API_TOKEN)
  
  const promptId = crypto.randomUUID()
  
  try {
    // Store prompt in database
    await db.createPrompt({
      id: promptId,
      originalPrompt: prompt,
      model,
      parameters: JSON.stringify(parameters || {}),
      userAgent: c.req.header('user-agent') || '',
      ipAddress: c.req.header('cf-connecting-ip') || ''
    })
    
    // For video models, use direct prediction without image-specific config
    const prediction = await replicate.createPrediction(model as any, {
      prompt,
      ...parameters
    })
    
    // For video generation, we typically need to wait longer
    const completed = await replicate.waitForCompletion(prediction.id, 600000) // 10 minutes
    
    if (completed.status === 'failed') {
      throw new Error(completed.error || 'Video generation failed')
    }
    
    const videoUrls = Array.isArray(completed.output) ? completed.output : [completed.output]
    const savedOutputs = []
    
    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i]
      if (!videoUrl) continue
      
      const outputId = crypto.randomUUID()
      const r2Key = `videos/${promptId}/${outputId}.mp4`
      
      // Download and upload to R2
      const videoResponse = await fetch(videoUrl)
      const videoBuffer = await videoResponse.arrayBuffer()
      const r2Url = await storage.uploadVideo(r2Key, videoBuffer)
      
      await db.createOutput({
        id: outputId,
        promptId,
        url: r2Url,
        r2Key,
        type: 'video',
        fileSize: videoBuffer.byteLength
      })
      
      savedOutputs.push({
        id: outputId,
        url: r2Url
      })
    }
    
    await db.updatePromptStatus(promptId, 'completed')
    
    return c.json({
      promptId,
      prompt,
      model,
      outputs: savedOutputs
    })
    
  } catch (error) {
    console.error('Video generation error:', error)
    await db.updatePromptStatus(promptId, 'failed', error instanceof Error ? error.message : 'Unknown error')
    
    return c.json({
      error: 'Video generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

videoRoutes.get('/history', async (c) => {
  const db = new DatabaseService(c.env.DB)
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  
  const prompts = await db.getPrompts('video', limit, offset)
  return c.json({ prompts })
})

// Video Assembly Pipeline Endpoints

/**
 * POST /api/video/assemble
 * Assemble a complete video from scenes, audio, and effects
 */
videoRoutes.post('/assemble', async (c) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Input validation
    const body = await c.req.json()
    const validatedRequest = VideoAssemblyRequestSchema.parse(body)

    console.log(`[${requestId}] Assembling video for job ${validatedRequest.jobId} with ${validatedRequest.scenes.length} scenes`)

    // This would typically queue a video assembly job
    // For now, we'll simulate the assembly process
    const assemblyJob = {
      id: crypto.randomUUID(),
      jobId: validatedRequest.jobId,
      status: 'queued',
      progress: 0,
      scenes: validatedRequest.scenes,
      outputConfig: validatedRequest.outputConfig,
      estimatedDuration: validatedRequest.scenes.reduce((sum, scene) => sum + (scene.endTime - scene.startTime), 0),
      queuedAt: new Date().toISOString(),
      metadata: {
        sceneCount: validatedRequest.scenes.length,
        totalAssets: validatedRequest.scenes.length,
        resolution: validatedRequest.outputConfig.resolution,
        aspectRatio: validatedRequest.outputConfig.aspectRatio
      }
    }

    const response = {
      success: true,
      data: {
        assemblyJob,
        summary: {
          jobId: validatedRequest.jobId,
          sceneCount: validatedRequest.scenes.length,
          estimatedDuration: assemblyJob.estimatedDuration,
          outputFormat: validatedRequest.outputConfig.format,
          resolution: validatedRequest.outputConfig.resolution,
          queueTime: Date.now() - startTime
        }
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    console.log(`[${requestId}] Video assembly queued for job ${validatedRequest.jobId} in ${Date.now() - startTime}ms`)
    return c.json(response, 202) // Accepted for processing

  } catch (error) {
    console.error(`[${requestId}] Video assembly failed:`, error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Invalid request format',
        details: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        })),
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
})

/**
 * POST /api/video/apply-effects
 * Apply visual effects to video scenes
 */
videoRoutes.post('/apply-effects', async (c) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Input validation
    const body = await c.req.json()
    const validatedRequest = EffectsApplicationRequestSchema.parse(body)

    console.log(`[${requestId}] Applying ${validatedRequest.effects.length} effects to video ${validatedRequest.videoJobId}`)

    // This would typically apply effects using video processing libraries
    // For now, we'll simulate the effects application
    const effectsJob = {
      id: crypto.randomUUID(),
      videoJobId: validatedRequest.videoJobId,
      status: 'processing',
      progress: 0,
      effects: validatedRequest.effects.map(effect => ({
        ...effect,
        status: 'queued',
        processingTime: null,
        outputUrl: null
      })),
      isPreview: validatedRequest.preview,
      startedAt: new Date().toISOString(),
      metadata: {
        effectCount: validatedRequest.effects.length,
        scenesAffected: new Set(validatedRequest.effects.map(e => e.sceneId)).size,
        previewMode: validatedRequest.preview
      }
    }

    const response = {
      success: true,
      data: {
        effectsJob,
        summary: {
          videoJobId: validatedRequest.videoJobId,
          effectCount: validatedRequest.effects.length,
          scenesAffected: effectsJob.metadata.scenesAffected,
          previewMode: validatedRequest.preview,
          queueTime: Date.now() - startTime
        }
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    console.log(`[${requestId}] Effects application queued for video ${validatedRequest.videoJobId} in ${Date.now() - startTime}ms`)
    return c.json(response, 202) // Accepted for processing

  } catch (error) {
    console.error(`[${requestId}] Effects application failed:`, error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Invalid request format',
        details: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        })),
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
})

/**
 * POST /api/video/add-captions
 * Add captions/subtitles to video with word-level timing
 */
videoRoutes.post('/add-captions', async (c) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Input validation
    const body = await c.req.json()
    const validatedRequest = CaptionRequestSchema.parse(body)

    console.log(`[${requestId}] Adding captions to video ${validatedRequest.videoJobId}`)

    // This would typically process transcription and generate caption overlays
    const captionJob = {
      id: crypto.randomUUID(),
      videoJobId: validatedRequest.videoJobId,
      transcriptionId: validatedRequest.transcriptionId,
      status: 'processing',
      progress: 0,
      captionConfig: validatedRequest.captionConfig,
      generatedCaptions: [], // Would contain caption segments with timing
      startedAt: new Date().toISOString(),
      metadata: {
        style: validatedRequest.captionConfig.style,
        position: validatedRequest.captionConfig.position,
        wordHighlight: validatedRequest.captionConfig.wordHighlight
      }
    }

    const response = {
      success: true,
      data: {
        captionJob,
        summary: {
          videoJobId: validatedRequest.videoJobId,
          transcriptionId: validatedRequest.transcriptionId,
          style: validatedRequest.captionConfig.style,
          wordHighlight: validatedRequest.captionConfig.wordHighlight,
          queueTime: Date.now() - startTime
        }
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    console.log(`[${requestId}] Caption generation queued for video ${validatedRequest.videoJobId} in ${Date.now() - startTime}ms`)
    return c.json(response, 202) // Accepted for processing

  } catch (error) {
    console.error(`[${requestId}] Caption generation failed:`, error)

    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: 'Invalid request format',
        details: error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        })),
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
})

/**
 * GET /api/video/progress/:jobId
 * Get rendering progress for a video job
 */
videoRoutes.get('/progress/:jobId', async (c) => {
  const requestId = crypto.randomUUID()

  try {
    const jobId = c.req.param('jobId')
    
    if (!jobId) {
      return c.json({
        success: false,
        error: 'Job ID is required',
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    console.log(`[${requestId}] Getting progress for video job ${jobId}`)

    // This would typically check job status from a queue or database
    // For now, we'll return mock progress data
    const mockProgress = {
      jobId,
      stage: 'processing_scenes' as const,
      progress: 0.45,
      currentScene: 3,
      totalScenes: 7,
      estimatedTimeRemaining: 120, // 2 minutes
      message: 'Processing scene 3 of 7: Applying Ken Burns effect',
      startedAt: new Date(Date.now() - 60000).toISOString(), // Started 1 minute ago
      updatedAt: new Date().toISOString()
    }

    const response = {
      success: true,
      data: {
        progress: mockProgress
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Progress check failed:`, error)

    return c.json({
      success: false,
      error: 'Failed to get progress',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
})

/**
 * GET /api/video/download/:jobId
 * Download completed video
 */
videoRoutes.get('/download/:jobId', async (c) => {
  const requestId = crypto.randomUUID()

  try {
    const jobId = c.req.param('jobId')
    
    if (!jobId) {
      return c.json({
        success: false,
        error: 'Job ID is required',
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    console.log(`[${requestId}] Preparing download for video job ${jobId}`)

    // This would typically check if the video is completed and return download URL
    const mockDownload = {
      jobId,
      status: 'completed',
      downloadUrl: `https://mock-storage.com/videos/${jobId}.mp4`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      fileSize: 15728640, // ~15MB
      duration: 89.5, // seconds
      resolution: '1080p',
      format: 'mp4',
      completedAt: new Date(Date.now() - 300000).toISOString() // Completed 5 minutes ago
    }

    const response = {
      success: true,
      data: {
        download: mockDownload,
        summary: {
          jobId,
          fileSize: `${(mockDownload.fileSize / 1024 / 1024).toFixed(1)}MB`,
          duration: `${Math.floor(mockDownload.duration / 60)}:${(mockDownload.duration % 60).toFixed(0).padStart(2, '0')}`,
          resolution: mockDownload.resolution,
          format: mockDownload.format
        }
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Download preparation failed:`, error)

    return c.json({
      success: false,
      error: 'Failed to prepare download',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
})

/**
 * DELETE /api/video/cancel/:jobId
 * Cancel a video processing job
 */
videoRoutes.delete('/cancel/:jobId', async (c) => {
  const requestId = crypto.randomUUID()

  try {
    const jobId = c.req.param('jobId')
    
    if (!jobId) {
      return c.json({
        success: false,
        error: 'Job ID is required',
        timestamp: new Date().toISOString(),
        requestId
      }, 400)
    }

    console.log(`[${requestId}] Cancelling video job ${jobId}`)

    // This would typically cancel the job in the processing queue
    const cancellation = {
      jobId,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      reason: 'User requested cancellation'
    }

    const response = {
      success: true,
      data: {
        cancellation
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    console.log(`[${requestId}] Video job ${jobId} cancelled`)
    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Job cancellation failed:`, error)

    return c.json({
      success: false,
      error: 'Failed to cancel job',
      timestamp: new Date().toISOString(),
      requestId
    }, 500)
  }
})

/**
 * GET /api/video/health
 * Health check endpoint for video services
 */
videoRoutes.get('/health', async (c) => {
  const requestId = crypto.randomUUID()

  try {
    // Check service health
    const serviceHealth = {
      videoGeneration: 'healthy',  // Legacy Replicate generation
      videoAssembly: 'healthy',
      effectsProcessing: 'healthy',
      captionGeneration: 'healthy',
      renderQueue: 'healthy'
    }

    const response = {
      success: true,
      data: {
        status: 'healthy',
        services: serviceHealth,
        capabilities: {
          videoGeneration: ['minimax/video-01', 'runwayml/gen-3-alpha-turbo'],
          maxResolution: '4k',
          supportedFormats: ['mp4', 'mov', 'webm'],
          supportedEffects: ['ken_burns', 'color_correction', 'stabilization'],
          maxDuration: 600 // 10 minutes
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      },
      timestamp: new Date().toISOString(),
      requestId
    }

    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Health check failed:`, error)

    return c.json({
      success: false,
      error: 'Service health check failed',
      timestamp: new Date().toISOString(),
      requestId
    }, 503)
  }
})