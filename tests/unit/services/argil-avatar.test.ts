import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ArgilAvatarService } from '../../../src/services/argil-avatar'
import { TranscriptSplitter } from '../../../src/utils/transcript-splitter'
import type { WordTiming } from '../../../src/schemas/audio'
import type { Env } from '../../../src/types/env'

// Mock environment for testing
const mockEnv: Env = {
  ARGIL_API_KEY: 'test-argil-key',
  ARGIL_WEBHOOK_SECRET: 'test-webhook-secret',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any,
  ACCESS_PASSWORD: 'test-password',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  ENVIRONMENT: 'test',
}

// Mock fetch globally
global.fetch = vi.fn()

describe('ArgilAvatarService', () => {
  let service: ArgilAvatarService
  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.mocked(fetch)
    service = new ArgilAvatarService(mockEnv)
  })

  describe('generateFromScript', () => {
    it('should generate avatar video from script using transcript splitting', async () => {
      const script = 'Hello world. This is a test script for avatar generation.'
      const wordTimings: WordTiming[] = [
        { word: 'Hello', startTime: 0, endTime: 0.5 },
        { word: 'world', startTime: 0.5, endTime: 1.0 },
        { word: 'This', startTime: 1.5, endTime: 1.8 },
        { word: 'is', startTime: 1.8, endTime: 2.0 },
        { word: 'a', startTime: 2.0, endTime: 2.1 },
        { word: 'test', startTime: 2.1, endTime: 2.5 },
        { word: 'script', startTime: 2.5, endTime: 3.0 },
        { word: 'for', startTime: 3.0, endTime: 3.2 },
        { word: 'avatar', startTime: 3.2, endTime: 3.8 },
        { word: 'generation', startTime: 3.8, endTime: 4.5 },
      ]

      // Mock Argil API response for creating video
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-123',
          name: 'Generated Video',
          status: 'IDLE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          moments: [
            {
              transcript: script,
              avatarId: 'avatar-1',
              voiceId: 'voice-1',
              gestureSlug: 'friendly',
            },
          ],
        }),
      })

      const result = await service.generateFromScript({
        script,
        wordTimings,
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
        gestureSlug: 'friendly',
        videoName: 'Test Video',
      })

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('video-123')
      expect(result.data?.status).toBe('IDLE')
      expect(result.data?.moments).toBeDefined()
      expect(result.data?.moments?.length).toBeGreaterThan(0)
    })

    it('should handle long scripts by automatically splitting them into moments', async () => {
      // Create a script with multiple words that exceeds 250 characters
      const words = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ')
      const longScript = words + ' ' + words // About 500 characters

      const wordTimings: WordTiming[] = Array.from({ length: 100 }, (_, i) => ({
        word: `word${i % 50}`,
        startTime: i * 0.1,
        endTime: (i + 1) * 0.1,
      }))

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-456',
          name: 'Generated Video',
          status: 'IDLE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          moments: [
            { transcript: 'a'.repeat(250), avatarId: 'avatar-1' },
            { transcript: 'a'.repeat(250), avatarId: 'avatar-1' },
          ],
        }),
      })

      const result = await service.generateFromScript({
        script: longScript,
        wordTimings,
        avatarId: 'avatar-1',
      })

      expect(result.success).toBe(true)
      expect(result.data?.moments?.length).toBeGreaterThan(1)
      // Should make one API call to create video with multiple moments
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should validate avatar ID exists', async () => {
      const result = await service.generateFromScript({
        script: 'test',
        wordTimings: [],
        avatarId: 'non-existent-avatar',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Avatar not found')
    })

    it('should handle API errors gracefully', async () => {
      // Mock all retry attempts to fail with rate limit error
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            error: 'Rate limit exceeded',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            error: 'Rate limit exceeded',
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({
            error: 'Rate limit exceeded',
          }),
        })

      const result = await service.generateFromScript({
        script: 'test',
        wordTimings: [{ word: 'test', startTime: 0, endTime: 1 }],
        avatarId: 'avatar-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit exceeded')
    })
  })

  describe('generateFromAudioSegment', () => {
    it('should generate avatar video from audio segment', async () => {
      const audioUrl = 'https://example.com/audio.mp3'
      const transcript = 'Hello world'
      const timing = { startTime: 0, endTime: 2.0 }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-audio-789',
          name: 'Audio Segment Video',
          status: 'IDLE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          moments: [
            {
              transcript,
              avatarId: 'avatar-1',
              voiceId: 'voice-1',
            },
          ],
        }),
      })

      const result = await service.generateFromAudioSegment({
        audioUrl,
        transcript,
        timing,
        avatarId: 'avatar-1',
        voiceId: 'voice-1',
      })

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('video-audio-789')
      expect(result.data?.status).toBe('IDLE')
      expect(result.data?.moments?.length).toBe(1)
    })

    it('should handle transcript longer than 250 characters', async () => {
      const longTranscript = 'a'.repeat(300)

      const result = await service.generateFromAudioSegment({
        audioUrl: 'https://example.com/audio.mp3',
        transcript: longTranscript,
        timing: { startTime: 0, endTime: 10 },
        avatarId: 'avatar-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Transcript too long')
    })
  })

  describe('getVideoStatus', () => {
    it('should retrieve video status from Argil API', async () => {
      const videoId = 'video-123'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: videoId,
          name: 'Test Video',
          status: 'DONE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:01:00Z',
          videoUrl: 'https://argil.com/video.mp4',
          moments: [],
        }),
      })

      const result = await service.getVideoStatus(videoId)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('DONE')
      expect(result.data?.videoUrl).toBe('https://argil.com/video.mp4')
    })

    it('should handle video not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Video not found',
        }),
      })

      const result = await service.getVideoStatus('non-existent-video')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Video not found')
    })
  })

  describe('renderVideo', () => {
    it('should start video rendering process', async () => {
      const videoId = 'video-123'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: videoId,
          name: 'Test Video',
          status: 'GENERATING_AUDIO',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:01:00Z',
          moments: [],
        }),
      })

      const result = await service.renderVideo(videoId)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('GENERATING_AUDIO')
    })

    it('should handle render request failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'Cannot render video in current state',
        }),
      })

      const result = await service.renderVideo('video-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cannot render video')
    })
  })

  describe('getAvatars', () => {
    it('should return available avatars', async () => {
      const result = await service.getAvatars()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data?.length).toBeGreaterThan(0)
    })

    it('should include avatar information', async () => {
      const result = await service.getAvatars()

      expect(result.success).toBe(true)
      const firstAvatar = result.data?.[0]
      expect(firstAvatar).toHaveProperty('id')
      expect(firstAvatar).toHaveProperty('name')
      expect(firstAvatar).toHaveProperty('defaultVoiceId')
      expect(firstAvatar).toHaveProperty('availableGestures')
      expect(firstAvatar).toHaveProperty('aspectRatio')
    })
  })

  describe('getVoices', () => {
    it('should return available voices', async () => {
      const result = await service.getVoices()

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data?.length).toBeGreaterThan(0)
    })

    it('should include voice information', async () => {
      const result = await service.getVoices()

      expect(result.success).toBe(true)
      const firstVoice = result.data?.[0]
      expect(firstVoice).toHaveProperty('id')
      expect(firstVoice).toHaveProperty('name')
      expect(firstVoice).toHaveProperty('language')
      expect(firstVoice).toHaveProperty('gender')
      expect(firstVoice).toHaveProperty('style')
    })
  })

  describe('webhookHandler', () => {
    it('should handle webhook notifications from Argil', async () => {
      const webhookPayload = {
        video_id: 'video-123',
        status: 'DONE',
        event: 'VIDEO_GENERATION_SUCCESS',
      }

      const result = await service.webhookHandler(webhookPayload, 'valid-signature')

      expect(result.success).toBe(true)
      expect(result.data?.processed).toBe(true)
      expect(result.data?.videoId).toBe('video-123')
    })

    it('should validate webhook signature', async () => {
      const webhookPayload = {
        video_id: 'video-123',
        status: 'DONE',
      }

      const result = await service.webhookHandler(webhookPayload, 'invalid-signature')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid webhook signature')
    })
  })

  describe('error handling and recovery', () => {
    it('should implement exponential backoff for rate limiting', async () => {
      // Mock rate limit responses
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit exceeded' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'video-123',
            name: 'Test Video',
            status: 'IDLE',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
            moments: [],
          }),
        })

      const result = await service.generateFromScript({
        script: 'test',
        wordTimings: [{ word: 'test', startTime: 0, endTime: 1 }],
        avatarId: 'avatar-1',
      })

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await service.generateFromScript({
        script: 'test',
        wordTimings: [{ word: 'test', startTime: 0, endTime: 1 }],
        avatarId: 'avatar-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  describe('performance and caching', () => {
    it('should cache avatar configurations', async () => {
      // First call
      const result1 = await service.getAvatars()
      expect(result1.success).toBe(true)

      // Second call should use cache
      const result2 = await service.getAvatars()
      expect(result2.success).toBe(true)
      expect(result2.metadata?.cached).toBe(true)
    })

    it('should cache voice configurations', async () => {
      // First call
      const result1 = await service.getVoices()
      expect(result1.success).toBe(true)

      // Second call should use cache
      const result2 = await service.getVoices()
      expect(result2.success).toBe(true)
      expect(result2.metadata?.cached).toBe(true)
    })

    it('should track API usage metrics', async () => {
      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-metrics-123',
          name: 'Test Video',
          status: 'IDLE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          moments: [
            {
              transcript: 'test',
              avatarId: 'avatar-1',
            },
          ],
        }),
      })

      await service.generateFromScript({
        script: 'test',
        wordTimings: [{ word: 'test', startTime: 0, endTime: 1 }],
        avatarId: 'avatar-1',
      })

      const metrics = await service.getUsageMetrics()
      expect(metrics.totalRequests).toBeGreaterThan(0)
      expect(metrics.successRate).toBeDefined()
      expect(metrics.averageResponseTime).toBeDefined()
    })
  })

  describe('createVideo', () => {
    it('should create video with proper moments structure', async () => {
      const videoRequest = {
        name: 'Test Video',
        moments: [
          {
            transcript: 'Hello world',
            avatarId: 'avatar-1',
            voiceId: 'voice-1',
            gestureSlug: 'friendly',
          },
        ],
        aspectRatio: '16:9' as const,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-123',
          name: 'Test Video',
          status: 'IDLE',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          moments: videoRequest.moments,
        }),
      })

      const result = await service.createVideo(videoRequest)

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('video-123')
      expect(result.data?.name).toBe('Test Video')
      expect(result.data?.moments).toEqual(videoRequest.moments)
    })
  })
})
