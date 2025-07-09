import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ModalIntegrationService } from '../../../src/services/modal-integration'
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

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('ModalIntegrationService', () => {
  let service: ModalIntegrationService
  let mockStorage: any
  let mockDatabase: any

  beforeEach(() => {
    mockStorage = {
      uploadVideo: vi.fn(),
      downloadUrl: vi.fn(),
    }
    mockDatabase = {
      createVideoJob: vi.fn(),
      updateVideoJob: vi.fn(),
      getVideoJob: vi.fn(),
    }

    service = new ModalIntegrationService(mockEnv, mockStorage, mockDatabase)

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Video Job Management', () => {
    it('should create a new video job', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [
          {
            sceneId: 'scene-1',
            sequenceNumber: 1,
            textContent: 'Test scene content',
            startTime: 0,
            endTime: 5,
            selectedAssetUrl: 'https://example.com/asset1.mp4',
            assetType: 'video' as const,
            effects: {
              kenBurns: {
                enabled: true,
                startScale: 1.2,
                endScale: 1.5,
                direction: 'zoom_in' as const,
              },
            },
          },
        ],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      mockDatabase.createVideoJob.mockResolvedValue({
        id: 'job-db-id',
        status: 'queued',
        createdAt: new Date().toISOString(),
      })

      const result = await service.createVideoJob(request)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.status).toBe('queued')
      expect(mockDatabase.createVideoJob).toHaveBeenCalledWith({
        id: 'test-job-123',
        status: 'queued',
        inputData: JSON.stringify(request),
        createdAt: expect.any(String),
      })
    })

    it('should handle job creation errors', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      mockDatabase.createVideoJob.mockRejectedValue(new Error('Database error'))

      const result = await service.createVideoJob(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database error')
    })

    it('should get video job status', async () => {
      const jobId = 'test-job-123'
      mockDatabase.getVideoJob.mockResolvedValue({
        id: jobId,
        status: 'processing',
        progress: 0.5,
        currentStage: 'assembling_video',
        updatedAt: new Date().toISOString(),
      })

      const result = await service.getVideoJobStatus(jobId)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe(jobId)
      expect(result.data?.status).toBe('processing')
      expect(result.data?.progress).toBe(0.5)
      expect(mockDatabase.getVideoJob).toHaveBeenCalledWith(jobId)
    })

    it('should handle job not found', async () => {
      const jobId = 'non-existent-job'
      mockDatabase.getVideoJob.mockResolvedValue(null)

      const result = await service.getVideoJobStatus(jobId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Job not found')
    })
  })

  describe('Modal Webhook Integration', () => {
    it('should send video processing request to Modal', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [
          {
            sceneId: 'scene-1',
            sequenceNumber: 1,
            textContent: 'Test content',
            startTime: 0,
            endTime: 5,
            selectedAssetUrl: 'https://example.com/asset1.mp4',
            assetType: 'video' as const,
            effects: {},
          },
        ],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          job_id: 'test-job-123',
          status: 'queued',
          message: 'Video processing started',
        }),
      })

      const result = await service.sendToModal(request)

      expect(result.success).toBe(true)
      expect(result.data?.modalJobId).toBe('test-job-123')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/process-video'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-modal-token',
          },
          body: expect.stringContaining('"job_id":"test-job-123"'),
        })
      )
    })

    it('should handle Modal API errors', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'Internal server error',
        }),
      })

      const result = await service.sendToModal(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Modal API error')
    })

    it('should handle network errors', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await service.sendToModal(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('Webhook Callbacks', () => {
    it('should handle progress updates from Modal', async () => {
      const progressData = {
        job_id: 'test-job-123',
        stage: 'processing',
        progress: 0.5,
        message: 'Processing scene 2 of 4',
        current_scene: 2,
        total_scenes: 4,
      }

      mockDatabase.updateVideoJob.mockResolvedValue({
        id: 'test-job-123',
        status: 'processing',
        progress: 0.5,
      })

      const result = await service.handleProgressUpdate(progressData)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.progress).toBe(0.5)
      expect(mockDatabase.updateVideoJob).toHaveBeenCalledWith('test-job-123', {
        status: 'processing',
        progress: 0.5,
        currentStage: 'processing',
        progressMessage: 'Processing scene 2 of 4',
        updatedAt: expect.any(String),
      })
    })

    it('should handle completion callbacks from Modal', async () => {
      const completionData = {
        job_id: 'test-job-123',
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

      mockDatabase.updateVideoJob.mockResolvedValue({
        id: 'test-job-123',
        status: 'completed',
        outputUrl: 'https://storage.example.com/video-123.mp4',
      })

      const result = await service.handleCompletion(completionData)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.status).toBe('completed')
      expect(result.data?.outputUrl).toBe('https://storage.example.com/video-123.mp4')
      expect(mockDatabase.updateVideoJob).toHaveBeenCalledWith('test-job-123', {
        status: 'completed',
        outputUrl: 'https://storage.example.com/video-123.mp4',
        metadata: JSON.stringify(completionData.metadata),
        completedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should handle failure callbacks from Modal', async () => {
      const failureData = {
        job_id: 'test-job-123',
        status: 'failed' as const,
        error: 'Video processing failed due to corrupted asset',
      }

      mockDatabase.updateVideoJob.mockResolvedValue({
        id: 'test-job-123',
        status: 'failed',
        error: 'Video processing failed due to corrupted asset',
      })

      const result = await service.handleCompletion(failureData)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.status).toBe('failed')
      expect(result.data?.error).toBe('Video processing failed due to corrupted asset')
      expect(mockDatabase.updateVideoJob).toHaveBeenCalledWith('test-job-123', {
        status: 'failed',
        error: 'Video processing failed due to corrupted asset',
        completedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('should validate webhook signatures', async () => {
      const payload = {
        job_id: 'test-job-123',
        status: 'completed',
        output_url: 'https://storage.example.com/video-123.mp4',
      }

      const validSignature = 'valid-signature'
      const invalidSignature = 'invalid-signature'

      // Test valid signature
      const validResult = await service.validateWebhookSignature(payload, validSignature)
      expect(validResult).toBe(true)

      // Test invalid signature
      const invalidResult = await service.validateWebhookSignature(payload, invalidSignature)
      expect(invalidResult).toBe(false)
    })
  })

  describe('Request Transformation', () => {
    it('should transform Cloudflare request to Modal format', async () => {
      const cloudflareRequest = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [
          {
            sceneId: 'scene-1',
            sequenceNumber: 1,
            textContent: 'Test scene content',
            startTime: 0,
            endTime: 5,
            selectedAssetUrl: 'https://example.com/asset1.mp4',
            assetType: 'video' as const,
            effects: {
              kenBurns: {
                enabled: true,
                startScale: 1.2,
                endScale: 1.5,
                direction: 'zoom_in' as const,
              },
            },
          },
        ],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      const modalRequest = service.transformToModalRequest(cloudflareRequest)

      expect(modalRequest.job_id).toBe('test-job-123')
      expect(modalRequest.video_request.video_assets).toHaveLength(1)
      expect(modalRequest.video_request.video_assets[0].asset_url).toBe(
        'https://example.com/asset1.mp4'
      )
      expect(modalRequest.video_request.effects_config.ken_burns).toBe(true)
      expect(modalRequest.video_request.output_config.resolution).toBe('1080p')
      expect(modalRequest.callback_url).toContain('/video-complete')
    })

    it('should transform Modal response to Cloudflare format', async () => {
      const modalResponse = {
        job_id: 'test-job-123',
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

      const cloudflareResponse = service.transformFromModalResponse(modalResponse)

      expect(cloudflareResponse.jobId).toBe('test-job-123')
      expect(cloudflareResponse.status).toBe('completed')
      expect(cloudflareResponse.outputUrl).toBe('https://storage.example.com/video-123.mp4')
      expect(cloudflareResponse.metadata.duration).toBe(120)
      expect(cloudflareResponse.metadata.fileSize).toBe(15728640)
    })
  })

  describe('Configuration and Environment', () => {
    it('should use correct Modal API endpoint', async () => {
      expect(service.modalApiUrl).toBe('https://modal-api.example.com')
    })

    it('should handle missing Modal configuration', async () => {
      const serviceWithoutConfig = new ModalIntegrationService(
        { ...mockEnv, MODAL_API_TOKEN: undefined } as any,
        mockStorage,
        mockDatabase
      )

      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      const result = await serviceWithoutConfig.sendToModal(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Modal configuration missing')
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should retry failed requests with exponential backoff', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      // Mock first two calls to fail, third to succeed
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            job_id: 'test-job-123',
            status: 'queued',
          }),
        })

      const result = await service.sendToModal(request)

      expect(result.success).toBe(true)
      expect(result.data?.modalJobId).toBe('test-job-123')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should fail after maximum retry attempts', async () => {
      const request = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p' as const,
          aspectRatio: '16:9' as const,
          frameRate: 30,
          format: 'mp4' as const,
          quality: 'standard' as const,
        },
      }

      // Mock all calls to fail
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })

      const result = await service.sendToModal(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Maximum retry attempts exceeded')
      expect(mockFetch).toHaveBeenCalledTimes(3) // Initial call + 2 retries
    })
  })
})
