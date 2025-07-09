import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VideoQueueService } from '../../../src/services/video-queue'
import type { Env } from '../../../src/types/env'
import type { VideoAssemblyRequest } from '../../../src/services/modal-integration'

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

describe('VideoQueueService', () => {
  let service: VideoQueueService
  let mockStorage: any
  let mockDatabase: any
  let mockModalIntegration: any

  beforeEach(() => {
    mockStorage = {
      uploadVideo: vi.fn(),
      downloadUrl: vi.fn(),
    }
    mockDatabase = {
      createVideoJob: vi.fn(),
      updateVideoJob: vi.fn(),
      getVideoJob: vi.fn(),
      getVideoJobs: vi.fn(),
    }
    mockModalIntegration = {
      createVideoJob: vi.fn(),
      sendToModal: vi.fn(),
      getVideoJobStatus: vi.fn(),
      handleProgressUpdate: vi.fn(),
      handleCompletion: vi.fn(),
    }

    service = new VideoQueueService(mockEnv, mockStorage, mockDatabase, mockModalIntegration)

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Queue Management', () => {
    it('should queue a video assembly job', async () => {
      const request: VideoAssemblyRequest = {
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
            assetType: 'video',
            effects: {
              kenBurns: {
                enabled: true,
                startScale: 1.2,
                endScale: 1.5,
                direction: 'zoom_in',
              },
            },
          },
        ],
        outputConfig: {
          resolution: '1080p',
          aspectRatio: '16:9',
          frameRate: 30,
          format: 'mp4',
          quality: 'standard',
        },
      }

      mockModalIntegration.createVideoJob.mockResolvedValue({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      mockModalIntegration.sendToModal.mockResolvedValue({
        success: true,
        data: {
          modalJobId: 'test-job-123',
        },
      })

      const result = await service.queueVideoAssembly(request)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.status).toBe('queued')
      expect(mockModalIntegration.createVideoJob).toHaveBeenCalledWith(request)
      expect(mockModalIntegration.sendToModal).toHaveBeenCalledWith(request)
    })

    it('should handle job creation failure', async () => {
      const request: VideoAssemblyRequest = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p',
          aspectRatio: '16:9',
          frameRate: 30,
          format: 'mp4',
          quality: 'standard',
        },
      }

      mockModalIntegration.createVideoJob.mockResolvedValue({
        success: false,
        error: 'Database error',
      })

      const result = await service.queueVideoAssembly(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database error')
      expect(mockModalIntegration.sendToModal).not.toHaveBeenCalled()
    })

    it('should handle Modal API failure', async () => {
      const request: VideoAssemblyRequest = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p',
          aspectRatio: '16:9',
          frameRate: 30,
          format: 'mp4',
          quality: 'standard',
        },
      }

      mockModalIntegration.createVideoJob.mockResolvedValue({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      mockModalIntegration.sendToModal.mockResolvedValue({
        success: false,
        error: 'Modal API error',
      })

      const result = await service.queueVideoAssembly(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Modal API error')
      expect(mockModalIntegration.createVideoJob).toHaveBeenCalledWith(request)
      expect(mockModalIntegration.sendToModal).toHaveBeenCalledWith(request)
    })
  })

  describe('Job Status Management', () => {
    it('should get job status', async () => {
      const jobId = 'test-job-123'

      mockModalIntegration.getVideoJobStatus.mockResolvedValue({
        success: true,
        data: {
          jobId,
          status: 'processing',
          progress: 0.5,
          currentStage: 'assembling_video',
          progressMessage: 'Processing scene 2 of 4',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const result = await service.getJobStatus(jobId)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe(jobId)
      expect(result.data?.status).toBe('processing')
      expect(result.data?.progress).toBe(0.5)
      expect(mockModalIntegration.getVideoJobStatus).toHaveBeenCalledWith(jobId)
    })

    it('should handle job not found', async () => {
      const jobId = 'non-existent-job'

      mockModalIntegration.getVideoJobStatus.mockResolvedValue({
        success: false,
        error: 'Job not found',
      })

      const result = await service.getJobStatus(jobId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Job not found')
    })

    it('should get job history', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'job-2',
          status: 'processing',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      mockDatabase.getVideoJobs.mockResolvedValue(mockJobs)

      const result = await service.getJobHistory(50, 0)

      expect(result.success).toBe(true)
      expect(result.data?.jobs).toHaveLength(2)
      expect(result.data?.jobs[0].jobId).toBe('job-1')
      expect(mockDatabase.getVideoJobs).toHaveBeenCalledWith(50, 0)
    })
  })

  describe('Job Cancellation', () => {
    it('should cancel a queued job', async () => {
      const jobId = 'test-job-123'

      mockModalIntegration.getVideoJobStatus.mockResolvedValue({
        success: true,
        data: {
          jobId,
          status: 'queued',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      mockDatabase.updateVideoJob.mockResolvedValue(undefined)

      const result = await service.cancelJob(jobId)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe(jobId)
      expect(result.data?.status).toBe('cancelled')
      expect(mockDatabase.updateVideoJob).toHaveBeenCalledWith(jobId, {
        status: 'cancelled',
        updatedAt: expect.any(String),
      })
    })

    it('should not cancel a completed job', async () => {
      const jobId = 'test-job-123'

      mockModalIntegration.getVideoJobStatus.mockResolvedValue({
        success: true,
        data: {
          jobId,
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const result = await service.cancelJob(jobId)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot cancel job in completed state')
      expect(mockDatabase.updateVideoJob).not.toHaveBeenCalled()
    })
  })

  describe('Webhook Handling', () => {
    it('should handle progress updates', async () => {
      const progressData = {
        job_id: 'test-job-123',
        stage: 'processing',
        progress: 0.5,
        message: 'Processing scene 2 of 4',
        current_scene: 2,
        total_scenes: 4,
      }

      mockModalIntegration.handleProgressUpdate.mockResolvedValue({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'processing',
          progress: 0.5,
          currentStage: 'processing',
          progressMessage: 'Processing scene 2 of 4',
          updatedAt: new Date().toISOString(),
        },
      })

      const result = await service.handleProgressUpdate(progressData)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.progress).toBe(0.5)
      expect(mockModalIntegration.handleProgressUpdate).toHaveBeenCalledWith(progressData)
    })

    it('should handle completion updates', async () => {
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

      mockModalIntegration.handleCompletion.mockResolvedValue({
        success: true,
        data: {
          jobId: 'test-job-123',
          status: 'completed',
          outputUrl: 'https://storage.example.com/video-123.mp4',
          metadata: completionData.metadata,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      })

      const result = await service.handleCompletion(completionData)

      expect(result.success).toBe(true)
      expect(result.data?.jobId).toBe('test-job-123')
      expect(result.data?.status).toBe('completed')
      expect(result.data?.outputUrl).toBe('https://storage.example.com/video-123.mp4')
      expect(mockModalIntegration.handleCompletion).toHaveBeenCalledWith(completionData)
    })
  })

  describe('Queue Statistics', () => {
    it('should get queue statistics', async () => {
      const mockJobs = [
        { status: 'queued', createdAt: new Date().toISOString() },
        { status: 'processing', createdAt: new Date().toISOString() },
        { status: 'completed', createdAt: new Date().toISOString() },
        { status: 'failed', createdAt: new Date().toISOString() },
      ]

      mockDatabase.getVideoJobs.mockResolvedValue(mockJobs)

      const result = await service.getQueueStats()

      expect(result.success).toBe(true)
      expect(result.data?.queuedJobs).toBe(1)
      expect(result.data?.processingJobs).toBe(1)
      expect(result.data?.completedJobs).toBe(1)
      expect(result.data?.failedJobs).toBe(1)
      expect(result.data?.totalJobs).toBe(4)
    })

    it('should handle empty queue stats', async () => {
      mockDatabase.getVideoJobs.mockResolvedValue([])

      const result = await service.getQueueStats()

      expect(result.success).toBe(true)
      expect(result.data?.queuedJobs).toBe(0)
      expect(result.data?.processingJobs).toBe(0)
      expect(result.data?.completedJobs).toBe(0)
      expect(result.data?.failedJobs).toBe(0)
      expect(result.data?.totalJobs).toBe(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDatabase.getVideoJobs.mockRejectedValue(new Error('Database connection failed'))

      const result = await service.getQueueStats()

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database connection failed')
    })

    it('should handle modal integration errors', async () => {
      const request: VideoAssemblyRequest = {
        jobId: 'test-job-123',
        finalScriptId: 'script-456',
        audioMixId: 'audio-789',
        scenes: [],
        outputConfig: {
          resolution: '1080p',
          aspectRatio: '16:9',
          frameRate: 30,
          format: 'mp4',
          quality: 'standard',
        },
      }

      mockModalIntegration.createVideoJob.mockRejectedValue(new Error('Modal service unavailable'))

      const result = await service.queueVideoAssembly(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Modal service unavailable')
    })
  })
})
