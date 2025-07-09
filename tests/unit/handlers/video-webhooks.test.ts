import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { videoWebhookRoutes } from '../../../src/handlers/video-webhooks'
import type { Env } from '../../../src/types/env'

// Mock environment
const mockEnv: Env = {
  ARGIL_API_KEY: 'test-argil-key',
  ARGIL_WEBHOOK_SECRET: 'test-webhook-secret',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  ACCESS_PASSWORD: 'test-password',
  ENVIRONMENT: 'test',
  MODAL_API_URL: 'https://modal-api.example.com',
  MODAL_API_TOKEN: 'test-modal-token',
  MODAL_WEBHOOK_SECRET: 'test-modal-webhook-secret',
  CLOUDFLARE_WORKER_URL: 'https://worker.example.com',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any,
}

// Mock services
const mockVideoQueue = {
  handleProgressUpdate: vi.fn(),
  handleCompletion: vi.fn(),
  getJobStatus: vi.fn(),
}

const mockModalIntegration = {
  validateWebhookSignature: vi.fn(),
}

const mockDatabase = {
  createVideoJob: vi.fn(),
  updateVideoJob: vi.fn(),
  getVideoJob: vi.fn(),
  getVideoJobs: vi.fn(),
}

const mockStorage = {
  uploadVideo: vi.fn(),
  downloadUrl: vi.fn(),
}

vi.mock('../../../src/services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => mockDatabase),
}))

vi.mock('../../../src/services/storage', () => ({
  StorageService: vi.fn().mockImplementation(() => mockStorage),
}))

vi.mock('../../../src/services/modal-integration', () => ({
  ModalIntegrationService: vi.fn().mockImplementation(() => mockModalIntegration),
}))

vi.mock('../../../src/services/video-queue', () => ({
  VideoQueueService: vi.fn().mockImplementation(() => mockVideoQueue),
}))

describe('Video Webhook Handlers', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/api/video/webhooks', videoWebhookRoutes)
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Set up default successful mocking
    mockModalIntegration.validateWebhookSignature.mockResolvedValue(true)
    mockVideoQueue.handleProgressUpdate.mockResolvedValue({
      success: true,
      data: {
        jobId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'processing',
        progress: 0.5,
        currentStage: 'processing',
        progressMessage: 'Processing scene 2 of 4',
        updatedAt: new Date().toISOString(),
      },
    })
    mockVideoQueue.handleCompletion.mockResolvedValue({
      success: true,
      data: {
        jobId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'completed',
        outputUrl: 'https://storage.example.com/video-123.mp4',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/video/webhooks/modal/progress', () => {
    it('should handle valid progress update', async () => {
      const progressData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        stage: 'processing',
        progress: 0.5,
        message: 'Processing scene 2 of 4',
        current_scene: 2,
        total_scenes: 4,
      }

      const response = await app.request('/api/video/webhooks/modal/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(progressData),
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
      expect(body.data.progress).toBe(0.5)
      expect(mockVideoQueue.handleProgressUpdate).toHaveBeenCalledWith(progressData)
    })

    it('should handle missing signature header', async () => {
      const progressData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        stage: 'processing',
        progress: 0.5,
      }

      const response = await app.request('/api/video/webhooks/modal/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progressData),
      }, mockEnv)

      expect(response.status).toBe(401)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Missing webhook signature')
    })

    it('should validate request body schema', async () => {
      const invalidData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        // Missing required fields
      }

      const response = await app.request('/api/video/webhooks/modal/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(invalidData),
      }, mockEnv)

      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Invalid request format')
    })
  })

  describe('POST /api/video/webhooks/modal/complete', () => {
    it('should handle successful completion', async () => {
      const completionData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'completed' as const,
        output_url: 'https://storage.example.com/video-123.mp4',
        metadata: {
          duration: 120,
          file_size: 15728640,
          resolution: '1080p',
          codec: 'h264',
          bitrate: '2000k',
          audio_channels: 2,
          audio_sample_rate: 44100,
        },
      }

      const response = await app.request('/api/video/webhooks/modal/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(completionData),
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
      expect(body.data.status).toBe('completed')
      expect(mockVideoQueue.handleCompletion).toHaveBeenCalledWith(completionData)
    })

    it('should handle failed completion', async () => {
      const failureData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'failed' as const,
        error: 'Video processing failed due to corrupted asset',
      }

      mockVideoQueue.handleCompletion.mockResolvedValue({
        success: true,
        data: {
          jobId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          status: 'failed',
          error: 'Video processing failed due to corrupted asset',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const response = await app.request('/api/video/webhooks/modal/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(failureData),
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.jobId).toBe('f47ac10b-58cc-4372-a567-0e02b2c3d479')
      expect(body.data.status).toBe('failed')
      expect(body.data.error).toBe('Video processing failed due to corrupted asset')
    })

    it('should validate completion request schema', async () => {
      const invalidData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'invalid-status',
      }

      const response = await app.request('/api/video/webhooks/modal/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(invalidData),
      }, mockEnv)

      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Invalid request format')
    })
  })

  describe('GET /api/video/webhooks/modal/health', () => {
    it('should return webhook health status', async () => {
      const response = await app.request('/api/video/webhooks/modal/health', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('healthy')
      expect(body.data.webhooks).toBeDefined()
      expect(body.data.webhooks.progress).toBe('active')
      expect(body.data.webhooks.completion).toBe('active')
    })

    it('should include environment information', async () => {
      const response = await app.request('/api/video/webhooks/modal/health', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.data.environment).toBe('test')
      expect(body.data.modalApiUrl).toBe('https://modal-api.example.com')
      expect(body.data.workerUrl).toBe('https://worker.example.com')
    })
  })

  describe('POST /api/video/webhooks/modal/test', () => {
    it('should handle test webhook', async () => {
      const testData = {
        test: true,
        message: 'Test webhook delivery',
        timestamp: new Date().toISOString(),
      }

      const response = await app.request('/api/video/webhooks/modal/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(testData),
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.received).toBe(true)
      expect(body.data.echo).toEqual(testData)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await app.request('/api/video/webhooks/modal/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Modal-Signature': 'valid-signature',
        },
        body: 'invalid json',
      }, mockEnv)

      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Invalid JSON')
    })

    it('should handle missing content type', async () => {
      const progressData = {
        job_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        stage: 'processing',
        progress: 0.5,
      }

      const response = await app.request('/api/video/webhooks/modal/progress', {
        method: 'POST',
        headers: {
          'X-Modal-Signature': 'valid-signature',
        },
        body: JSON.stringify(progressData),
      }, mockEnv)

      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Content-Type must be application/json')
    })
  })
})