import { Hono } from 'hono'
import { z } from 'zod'
import { DatabaseService } from '../services/database'
import { StorageService } from '../services/storage'
import { ModalIntegrationService } from '../services/modal-integration'
import { VideoQueueService } from '../services/video-queue'
import type { Env } from '../types/env'

// Webhook payload schemas
const ModalProgressUpdateSchema = z.object({
  job_id: z.string().uuid(),
  stage: z.string(),
  progress: z.number().min(0).max(1),
  message: z.string().optional(),
  current_scene: z.number().int().positive().optional(),
  total_scenes: z.number().int().positive().optional(),
  estimated_time_remaining: z.number().optional(),
})

const ModalCompletionSchema = z.object({
  job_id: z.string().uuid(),
  status: z.enum(['completed', 'failed', 'cancelled']),
  output_url: z.string().url().optional(),
  error: z.string().optional(),
  metadata: z.object({
    duration: z.number().optional(),
    file_size: z.number().optional(),
    resolution: z.string().optional(),
    codec: z.string().optional(),
    bitrate: z.string().optional(),
    audio_channels: z.number().optional(),
    audio_sample_rate: z.number().optional(),
    processing_time: z.number().optional(),
  }).optional(),
})

const ModalTestSchema = z.object({
  test: z.boolean(),
  message: z.string().optional(),
  timestamp: z.string().optional(),
})

export const videoWebhookRoutes = new Hono<{ Bindings: Env }>()

/**
 * POST /api/video/webhooks/modal/progress
 * Handle progress updates from Modal video processing
 */
videoWebhookRoutes.post('/modal/progress', async (c) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Validate content type
    const contentType = c.req.header('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return c.json({
        success: false,
        error: 'Content-Type must be application/json',
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    // Validate webhook signature
    const signature = c.req.header('X-Modal-Signature')
    if (!signature) {
      return c.json({
        success: false,
        error: 'Missing webhook signature',
        timestamp: new Date().toISOString(),
        requestId,
      }, 401)
    }

    // Parse and validate request body
    let body: any
    try {
      body = await c.req.json()
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON in request body',
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    const validation = ModalProgressUpdateSchema.safeParse(body)
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid request format',
        details: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    const progressData = validation.data

    console.log(`[${requestId}] Received progress update for job ${progressData.job_id}: ${progressData.stage} (${Math.round(progressData.progress * 100)}%)`)

    // Initialize services
    let db: DatabaseService
    let storage: StorageService
    let modalIntegration: ModalIntegrationService
    let videoQueue: VideoQueueService

    try {
      db = new DatabaseService(c.env.DB)
      storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
      modalIntegration = new ModalIntegrationService(c.env, storage, db)
      videoQueue = new VideoQueueService(c.env, storage, db, modalIntegration)
    } catch (error) {
      console.error(`[${requestId}] Service initialization failed:`, error)
      return c.json({
        success: false,
        error: 'Service initialization failed',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }

    // Validate webhook signature
    const isValidSignature = await modalIntegration.validateWebhookSignature(body, signature)
    if (!isValidSignature) {
      console.warn(`[${requestId}] Invalid webhook signature for job ${progressData.job_id}`)
      return c.json({
        success: false,
        error: 'Invalid webhook signature',
        timestamp: new Date().toISOString(),
        requestId,
      }, 401)
    }

    // Process progress update
    const result = await videoQueue.handleProgressUpdate(progressData)

    if (!result.success) {
      console.error(`[${requestId}] Failed to process progress update:`, result.error)
      return c.json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }

    const response = {
      success: true,
      data: result.data,
      metadata: {
        requestId,
        processingTime: Date.now() - startTime,
        executionTime: result.metadata?.executionTime,
      },
      timestamp: new Date().toISOString(),
    }

    console.log(`[${requestId}] Progress update processed for job ${progressData.job_id} in ${Date.now() - startTime}ms`)
    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Progress webhook failed:`, error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    }, 500)
  }
})

/**
 * POST /api/video/webhooks/modal/complete
 * Handle completion notifications from Modal video processing
 */
videoWebhookRoutes.post('/modal/complete', async (c) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Validate content type
    const contentType = c.req.header('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return c.json({
        success: false,
        error: 'Content-Type must be application/json',
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    // Validate webhook signature
    const signature = c.req.header('X-Modal-Signature')
    if (!signature) {
      return c.json({
        success: false,
        error: 'Missing webhook signature',
        timestamp: new Date().toISOString(),
        requestId,
      }, 401)
    }

    // Parse and validate request body
    let body: any
    try {
      body = await c.req.json()
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON in request body',
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    const validation = ModalCompletionSchema.safeParse(body)
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid request format',
        details: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    const completionData = validation.data

    console.log(`[${requestId}] Received completion notification for job ${completionData.job_id}: ${completionData.status}`)

    // Initialize services
    let db: DatabaseService
    let storage: StorageService
    let modalIntegration: ModalIntegrationService
    let videoQueue: VideoQueueService

    try {
      db = new DatabaseService(c.env.DB)
      storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
      modalIntegration = new ModalIntegrationService(c.env, storage, db)
      videoQueue = new VideoQueueService(c.env, storage, db, modalIntegration)
    } catch (error) {
      console.error(`[${requestId}] Service initialization failed:`, error)
      return c.json({
        success: false,
        error: 'Service initialization failed',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }

    // Validate webhook signature
    const isValidSignature = await modalIntegration.validateWebhookSignature(body, signature)
    if (!isValidSignature) {
      console.warn(`[${requestId}] Invalid webhook signature for job ${completionData.job_id}`)
      return c.json({
        success: false,
        error: 'Invalid webhook signature',
        timestamp: new Date().toISOString(),
        requestId,
      }, 401)
    }

    // Process completion
    const result = await videoQueue.handleCompletion(completionData)

    if (!result.success) {
      console.error(`[${requestId}] Failed to process completion:`, result.error)
      return c.json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }

    const response = {
      success: true,
      data: result.data,
      metadata: {
        requestId,
        processingTime: Date.now() - startTime,
        executionTime: result.metadata?.executionTime,
      },
      timestamp: new Date().toISOString(),
    }

    console.log(`[${requestId}] Completion processed for job ${completionData.job_id} in ${Date.now() - startTime}ms`)
    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Completion webhook failed:`, error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    }, 500)
  }
})

/**
 * GET /api/video/webhooks/modal/health
 * Health check endpoint for webhook services
 */
videoWebhookRoutes.get('/modal/health', async (c) => {
  const requestId = crypto.randomUUID()

  try {
    const response = {
      success: true,
      data: {
        status: 'healthy',
        webhooks: {
          progress: 'active',
          completion: 'active',
          test: 'active',
        },
        environment: c.env.ENVIRONMENT,
        modalApiUrl: c.env.MODAL_API_URL,
        workerUrl: c.env.CLOUDFLARE_WORKER_URL,
        capabilities: {
          signatureValidation: true,
          progressTracking: true,
          completionHandling: true,
          errorReporting: true,
        },
        version: '1.0.0',
      },
      timestamp: new Date().toISOString(),
      requestId,
    }

    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Webhook health check failed:`, error)
    return c.json({
      success: false,
      error: 'Webhook health check failed',
      timestamp: new Date().toISOString(),
      requestId,
    }, 503)
  }
})

/**
 * POST /api/video/webhooks/modal/test
 * Test endpoint for webhook connectivity
 */
videoWebhookRoutes.post('/modal/test', async (c) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()

  try {
    // Validate content type
    const contentType = c.req.header('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return c.json({
        success: false,
        error: 'Content-Type must be application/json',
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    // Validate webhook signature
    const signature = c.req.header('X-Modal-Signature')
    if (!signature) {
      return c.json({
        success: false,
        error: 'Missing webhook signature',
        timestamp: new Date().toISOString(),
        requestId,
      }, 401)
    }

    // Parse and validate request body
    let body: any
    try {
      body = await c.req.json()
    } catch (error) {
      return c.json({
        success: false,
        error: 'Invalid JSON in request body',
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    const validation = ModalTestSchema.safeParse(body)
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid test request format',
        details: validation.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        timestamp: new Date().toISOString(),
        requestId,
      }, 400)
    }

    const testData = validation.data

    console.log(`[${requestId}] Received test webhook:`, testData.message || 'No message')

    // Initialize services for signature validation
    let db: DatabaseService
    let storage: StorageService
    let modalIntegration: ModalIntegrationService

    try {
      db = new DatabaseService(c.env.DB)
      storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
      modalIntegration = new ModalIntegrationService(c.env, storage, db)
    } catch (error) {
      console.error(`[${requestId}] Service initialization failed:`, error)
      return c.json({
        success: false,
        error: 'Service initialization failed',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }

    // Validate webhook signature
    const isValidSignature = await modalIntegration.validateWebhookSignature(body, signature)
    if (!isValidSignature) {
      console.warn(`[${requestId}] Invalid webhook signature for test`)
      return c.json({
        success: false,
        error: 'Invalid webhook signature',
        timestamp: new Date().toISOString(),
        requestId,
      }, 401)
    }

    const response = {
      success: true,
      data: {
        received: true,
        echo: testData,
        processingTime: Date.now() - startTime,
        environment: c.env.ENVIRONMENT,
        webhook: 'test',
      },
      timestamp: new Date().toISOString(),
      requestId,
    }

    console.log(`[${requestId}] Test webhook processed successfully in ${Date.now() - startTime}ms`)
    return c.json(response, 200)

  } catch (error) {
    console.error(`[${requestId}] Test webhook failed:`, error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
      requestId,
    }, 500)
  }
})

/**
 * Middleware for basic rate limiting
 */
videoWebhookRoutes.use('/modal/*', async (c, next) => {
  // Simple rate limiting based on IP address
  const clientIP = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 100 // per minute per IP

  // In production, you would use a proper rate limiting store (Redis, KV, etc.)
  // For now, we'll just log the request for monitoring
  console.log(`[WEBHOOK] Request from ${clientIP} at ${new Date().toISOString()}`)

  await next()
})

/**
 * Global error handler for webhook routes
 */
videoWebhookRoutes.onError((error, c) => {
  const requestId = crypto.randomUUID()
  console.error(`[${requestId}] Webhook error:`, error)
  
  return c.json({
    success: false,
    error: 'Internal webhook error',
    timestamp: new Date().toISOString(),
    requestId,
  }, 500)
})