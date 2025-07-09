import { Hono } from 'hono'
import { ArgilAvatarService } from '../services/argil-avatar'
import { AudioSegmentationService } from '../services/audio-segmentation'
import { ArgilConfigManager } from '../config/argil-config'
import { z } from 'zod'
import type { Env } from '../types/env'

// Request validation schemas
const GenerateFromScriptSchema = z.object({
  script: z.string().min(1, 'Script cannot be empty').max(4000, 'Script too long'),
  avatarId: z.string().min(1, 'Avatar ID is required'),
  voiceId: z.string().optional(),
  gestureSlug: z.string().optional(),
  videoName: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16']).optional(),
  subtitles: z
    .object({
      enabled: z.boolean(),
      language: z.string().optional(),
    })
    .optional(),
})

const GenerateFromAudioSchema = z.object({
  audioUrl: z.string().url('Invalid audio URL'),
  transcript: z
    .string()
    .min(1, 'Transcript cannot be empty')
    .max(250, 'Transcript too long for single moment'),
  timing: z
    .object({
      startTime: z.number().min(0, 'Start time must be non-negative'),
      endTime: z.number().min(0, 'End time must be non-negative'),
    })
    .refine((data) => data.endTime > data.startTime, 'End time must be after start time'),
  avatarId: z.string().min(1, 'Avatar ID is required'),
  voiceId: z.string().optional(),
  gestureSlug: z.string().optional(),
  videoName: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16']).optional(),
})

const FullWorkflowSchema = z.object({
  script: z.string().min(1, 'Script cannot be empty').max(4000, 'Script too long'),
  sceneRanges: z
    .array(
      z.object({
        sceneId: z.string().min(1, 'Scene ID is required'),
        startTime: z.number().min(0, 'Start time must be non-negative'),
        endTime: z.number().min(0, 'End time must be non-negative'),
        purpose: z.enum(['avatar', 'regular']),
        text: z.string().min(1, 'Scene text cannot be empty'),
      })
    )
    .min(1, 'At least one scene range is required'),
  voiceSettings: z.object({
    provider: z.enum(['elevenlabs', 'openai']),
    voiceId: z.string().min(1, 'Voice ID is required'),
    stability: z.number().min(0).max(1).optional(),
    similarity: z.number().min(0).max(1).optional(),
    speed: z.number().min(0.5).max(2).optional(),
    temperature: z.number().min(0).max(1).optional(),
  }),
  outputFormat: z.enum(['mp3', 'wav', 'ogg']),
  avatarId: z.string().min(1, 'Avatar ID is required'),
  gestureSlug: z.string().optional(),
  aspectRatio: z.enum(['16:9', '9:16']).optional(),
})

const WebhookSchema = z
  .object({
    video_id: z.string().optional(),
    id: z.string().optional(),
    status: z.string(),
    event: z.string().optional(),
    videoUrl: z.string().optional(),
    error: z.string().optional(),
  })
  .refine((data) => data.video_id || data.id, 'Either video_id or id must be provided')

/**
 * Create Argil API handlers
 */
export function createArgilHandlers(app: Hono<{ Bindings: Env }>) {
  // Initialize services and config
  const configManager = new ArgilConfigManager()

  app.get('/api/argil/config', async (c) => {
    try {
      const config = configManager.getConfig()

      return c.json({
        success: true,
        data: {
          voices: configManager.getVoices(),
          avatars: configManager.getAvatars(),
          useMockResponses: configManager.shouldUseMockResponses(),
          requestCount: configManager.getEstimatedCost(),
          maxRequests: config.cost_management.max_requests_per_session,
        },
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get configuration',
        },
        500
      )
    }
  })

  app.get('/api/argil/voices', async (c) => {
    try {
      const argilService = new ArgilAvatarService(c.env)
      const result = await argilService.getVoices()

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          500
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch voices',
        },
        500
      )
    }
  })

  app.get('/api/argil/avatars', async (c) => {
    try {
      const argilService = new ArgilAvatarService(c.env)
      const result = await argilService.getAvatars()

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          500
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to fetch avatars',
        },
        500
      )
    }
  })

  app.post('/api/argil/generate/script', async (c) => {
    try {
      // Cost management check
      if (!configManager.canMakeRequest()) {
        return c.json(
          {
            success: false,
            error: 'Request limit exceeded for this session. This helps prevent unexpected costs.',
          },
          429
        )
      }

      const body = await c.req.json()
      const validatedData = GenerateFromScriptSchema.parse(body)

      // Validate avatar and voice combination
      const validation = configManager.validateAvatarVoiceCombination(
        validatedData.avatarId,
        validatedData.voiceId
      )

      if (!validation.valid) {
        return c.json(
          {
            success: false,
            error: validation.error,
          },
          400
        )
      }

      // Log API call for cost tracking
      configManager.incrementRequestCount()

      const argilService = new ArgilAvatarService(c.env)

      // For now, we need word timings. In a real implementation,
      // this would come from previous TTS step
      const mockWordTimings = [
        { word: 'mock', startTime: 0, endTime: 0.5 },
        { word: 'timing', startTime: 0.5, endTime: 1.0 },
      ]

      const result = await argilService.generateFromScript({
        script: validatedData.script,
        wordTimings: mockWordTimings,
        avatarId: validatedData.avatarId,
        voiceId: validatedData.voiceId || validation.avatar!.defaultVoiceId,
        gestureSlug: validatedData.gestureSlug,
        videoName: validatedData.videoName,
        aspectRatio: validatedData.aspectRatio,
        subtitles: validatedData.subtitles,
      })

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          500
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: {
          ...result.metadata,
          estimatedCost: configManager.getEstimatedCost(),
          usedMockResponse: configManager.shouldUseMockResponses(),
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: 'Validation failed',
            details: error.issues,
          },
          400
        )
      }

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate from script',
        },
        500
      )
    }
  })

  app.post('/api/argil/generate/audio', async (c) => {
    try {
      // Cost management check
      if (!configManager.canMakeRequest()) {
        return c.json(
          {
            success: false,
            error: 'Request limit exceeded for this session. This helps prevent unexpected costs.',
          },
          429
        )
      }

      const body = await c.req.json()
      const validatedData = GenerateFromAudioSchema.parse(body)

      // Validate avatar and voice combination
      const validation = configManager.validateAvatarVoiceCombination(
        validatedData.avatarId,
        validatedData.voiceId
      )

      if (!validation.valid) {
        return c.json(
          {
            success: false,
            error: validation.error,
          },
          400
        )
      }

      // Log API call for cost tracking
      configManager.incrementRequestCount()

      const argilService = new ArgilAvatarService(c.env)
      const result = await argilService.generateFromAudioSegment({
        audioUrl: validatedData.audioUrl,
        transcript: validatedData.transcript,
        timing: validatedData.timing,
        avatarId: validatedData.avatarId,
        voiceId: validatedData.voiceId || validation.avatar!.defaultVoiceId,
        gestureSlug: validatedData.gestureSlug,
        videoName: validatedData.videoName,
        aspectRatio: validatedData.aspectRatio,
      })

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          500
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: {
          ...result.metadata,
          estimatedCost: configManager.getEstimatedCost(),
          usedMockResponse: configManager.shouldUseMockResponses(),
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: 'Validation failed',
            details: error.issues,
          },
          400
        )
      }

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate from audio',
        },
        500
      )
    }
  })

  app.post('/api/argil/workflow/full', async (c) => {
    try {
      // Cost management check
      if (!configManager.canMakeRequest()) {
        return c.json(
          {
            success: false,
            error: 'Request limit exceeded for this session. This helps prevent unexpected costs.',
          },
          429
        )
      }

      const body = await c.req.json()
      const validatedData = FullWorkflowSchema.parse(body)

      // Validate avatar and voice combination
      const validation = configManager.validateAvatarVoiceCombination(validatedData.avatarId)

      if (!validation.valid) {
        return c.json(
          {
            success: false,
            error: validation.error,
          },
          400
        )
      }

      // Log API call for cost tracking (this counts as one request even though it's a full workflow)
      configManager.incrementRequestCount()

      // Initialize services
      const audioService = new AudioSegmentationService(c.env)
      const argilService = new ArgilAvatarService(c.env)

      // Step 1: Process audio segmentation workflow
      const audioResult = await audioService.processFullWorkflow({
        script: validatedData.script,
        sceneRanges: validatedData.sceneRanges,
        voiceSettings: validatedData.voiceSettings,
        outputFormat: validatedData.outputFormat,
      })

      if (!audioResult.success) {
        return c.json(
          {
            success: false,
            error: `Audio processing failed: ${audioResult.error}`,
          },
          500
        )
      }

      // Step 2: Process avatar generation for avatar scenes
      const avatarResults = []
      for (const segment of audioResult.data!.segments) {
        if (segment.purpose === 'avatar') {
          const argilResult = await argilService.generateFromAudioSegment({
            audioUrl: segment.audioUrl,
            transcript: segment.transcript,
            timing: {
              startTime: segment.startTime,
              endTime: segment.endTime,
            },
            avatarId: validatedData.avatarId,
            gestureSlug: validatedData.gestureSlug,
            videoName: `${segment.sceneId}_avatar_video`,
            aspectRatio: validatedData.aspectRatio,
          })

          if (argilResult.success) {
            avatarResults.push({
              sceneId: segment.sceneId,
              videoResult: argilResult.data,
              segment: segment,
            })
          } else {
            // Log error but continue with other segments
            console.error(
              `Failed to generate avatar for scene ${segment.sceneId}:`,
              argilResult.error
            )
          }
        }
      }

      return c.json({
        success: true,
        data: {
          audioWorkflow: audioResult.data,
          avatarVideos: avatarResults,
          totalSegments: audioResult.data!.segments.length,
          avatarSegments: avatarResults.length,
          processedAt: new Date().toISOString(),
        },
        metadata: {
          executionTime: Date.now(),
          estimatedCost: configManager.getEstimatedCost(),
          usedMockResponse: configManager.shouldUseMockResponses(),
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: 'Validation failed',
            details: error.issues,
          },
          400
        )
      }

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process full workflow',
        },
        500
      )
    }
  })

  app.get('/api/argil/video/:videoId/status', async (c) => {
    try {
      const videoId = c.req.param('videoId')
      if (!videoId) {
        return c.json(
          {
            success: false,
            error: 'Video ID is required',
          },
          400
        )
      }

      const argilService = new ArgilAvatarService(c.env)
      const result = await argilService.getVideoStatus(videoId)

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          result.error?.includes('not found') ? 404 : 500
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get video status',
        },
        500
      )
    }
  })

  app.post('/api/argil/video/:videoId/render', async (c) => {
    try {
      const videoId = c.req.param('videoId')
      if (!videoId) {
        return c.json(
          {
            success: false,
            error: 'Video ID is required',
          },
          400
        )
      }

      const argilService = new ArgilAvatarService(c.env)
      const result = await argilService.renderVideo(videoId)

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          500
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to render video',
        },
        500
      )
    }
  })

  app.post('/api/webhooks/argil', async (c) => {
    try {
      const signature = c.req.header('x-argil-signature') || ''
      const body = await c.req.json()

      const validatedData = WebhookSchema.parse(body)

      const argilService = new ArgilAvatarService(c.env)
      const result = await argilService.webhookHandler(validatedData, signature)

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error,
          },
          400
        )
      }

      return c.json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: 'Invalid webhook payload',
            details: error.issues,
          },
          400
        )
      }

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process webhook',
        },
        500
      )
    }
  })

  app.get('/api/argil/usage', async (c) => {
    try {
      const argilService = new ArgilAvatarService(c.env)
      const usageMetrics = await argilService.getUsageMetrics()

      return c.json({
        success: true,
        data: {
          ...usageMetrics,
          sessionCost: configManager.getEstimatedCost(),
          requestCount: configManager['requestCount'] || 0,
          useMockResponses: configManager.shouldUseMockResponses(),
        },
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get usage metrics',
        },
        500
      )
    }
  })

  app.post('/api/argil/config/reset-session', async (c) => {
    try {
      configManager.resetRequestCount()

      return c.json({
        success: true,
        message: 'Session reset successfully',
        data: {
          requestCount: 0,
          estimatedCost: 0,
        },
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to reset session',
        },
        500
      )
    }
  })

  return app
}
