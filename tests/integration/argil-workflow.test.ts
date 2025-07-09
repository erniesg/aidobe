import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ArgilAvatarService } from '../../src/services/argil-avatar'
import { AudioSegmentationService } from '../../src/services/audio-segmentation'
import { ArgilConfigManager } from '../../src/config/argil-config'
import type { Env } from '../../src/types/env'

// Mock environment
const mockEnv: Env = {
  ARGIL_API_KEY: 'test-api-key',
  ARGIL_WEBHOOK_SECRET: 'test-webhook-secret',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  ACCESS_PASSWORD: 'test-password',
  ENVIRONMENT: 'test',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any,
}

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Argil Workflow Integration Tests', () => {
  let argilService: ArgilAvatarService
  let audioService: AudioSegmentationService
  let configManager: ArgilConfigManager

  beforeEach(() => {
    argilService = new ArgilAvatarService(mockEnv)
    audioService = new AudioSegmentationService(mockEnv)
    configManager = new ArgilConfigManager()

    // Reset mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Full Workflow Integration', () => {
    it('should process complete script-to-avatar workflow', async () => {
      // Mock ElevenLabs TTS API response
      const mockTTSResponse = new ArrayBuffer(1024)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockTTSResponse,
      })

      // Mock Whisper transcription response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Hello world, this is a test script for avatar generation.',
          words: [
            { word: 'Hello', start: 0.0, end: 0.5 },
            { word: 'world', start: 0.5, end: 1.0 },
            { word: 'this', start: 1.0, end: 1.2 },
            { word: 'is', start: 1.2, end: 1.3 },
            { word: 'a', start: 1.3, end: 1.4 },
            { word: 'test', start: 1.4, end: 1.7 },
            { word: 'script', start: 1.7, end: 2.1 },
            { word: 'for', start: 2.1, end: 2.3 },
            { word: 'avatar', start: 2.3, end: 2.8 },
            { word: 'generation', start: 2.8, end: 3.5 },
          ],
        }),
      })

      // Mock audio extraction response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [
            {
              sceneId: 'scene-1',
              audioUrl: 'https://mock-storage.com/audio/segment-1.mp3',
              duration: 2.0,
            },
          ],
        }),
      })

      // Mock Argil video creation response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-12345',
          name: 'Test Avatar Video',
          status: 'IDLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          moments: [
            {
              transcript: 'Hello world, this is a test script for avatar generation.',
              avatarId: 'avatar-1',
              voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
            },
          ],
        }),
      })

      // Test full workflow
      const audioResult = await audioService.processFullWorkflow({
        script: 'Hello world, this is a test script for avatar generation.',
        sceneRanges: [
          {
            sceneId: 'scene-1',
            startTime: 0.0,
            endTime: 3.5,
            purpose: 'avatar',
            text: 'Hello world, this is a test script for avatar generation.',
          },
        ],
        voiceSettings: {
          provider: 'elevenlabs',
          voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
          stability: 0.75,
          similarity: 0.85,
        },
        outputFormat: 'mp3',
      })

      expect(audioResult.success).toBe(true)
      expect(audioResult.data).toBeDefined()
      expect(audioResult.data?.segments).toHaveLength(1)
      expect(audioResult.data?.segments[0].purpose).toBe('avatar')

      // Process avatar generation for avatar scenes
      const avatarSegment = audioResult.data?.segments[0]
      expect(avatarSegment).toBeDefined()

      const argilResult = await argilService.generateFromAudioSegment({
        audioUrl: avatarSegment!.audioUrl,
        transcript: avatarSegment!.transcript,
        timing: {
          startTime: avatarSegment!.startTime,
          endTime: avatarSegment!.endTime,
        },
        avatarId: 'avatar-1', // Use test avatar ID
        voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
        videoName: 'Test Avatar Video',
        aspectRatio: '16:9',
      })

      expect(argilResult.success).toBe(true)
      expect(argilResult.data).toBeDefined()
      expect(argilResult.data?.id).toBe('video-12345')
      expect(argilResult.data?.status).toBe('IDLE')
      expect(argilResult.data?.moments).toHaveLength(1)

      // Verify API calls were made in correct order
      expect(mockFetch).toHaveBeenCalledTimes(4)

      // Check TTS call
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://api.elevenlabs.io/v1/text-to-speech/0f35210d-fdab-4049-842e-b879c7b5d95a',
        {
          method: 'POST',
          headers: {
            Accept: 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': 'test-api-key',
          },
          body: JSON.stringify({
            text: 'Hello world, this is a test script for avatar generation.',
            voice_settings: {
              provider: 'elevenlabs',
              voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
              stability: 0.75,
              similarity: 0.85,
            },
          }),
        }
      )

      // Check Argil video creation call
      expect(mockFetch).toHaveBeenNthCalledWith(4, 'https://api.argil.ai/v1/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'User-Agent': 'aidobe/1.0',
        },
        body: JSON.stringify({
          name: 'Test Avatar Video',
          moments: [
            {
              transcript: 'Hello world, this is a test script for avatar generation.',
              avatarId: 'avatar-1',
              voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
            },
          ],
          aspectRatio: '16:9',
        }),
      })
    })

    it('should handle script-based generation with automatic transcript splitting', async () => {
      // Mock Argil video creation for long script
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-67890',
          name: 'Long Script Avatar Video',
          status: 'IDLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          moments: [
            {
              transcript:
                'This is a very long script that needs to be split into multiple moments because Argil has a 250 character limit per moment. This ensures that the avatar generation works correctly with longer content.',
              avatarId: 'avatar-2',
              voiceId: '53725f95-fff8-428f-9e21-a37148200534',
            },
          ],
        }),
      })

      const longScript =
        'This is a very long script that needs to be split into multiple moments because Argil has a 250 character limit per moment. This ensures that the avatar generation works correctly with longer content and maintains proper lip-sync with the generated audio segments.'

      const mockWordTimings = [
        { word: 'This', startTime: 0.0, endTime: 0.2 },
        { word: 'is', startTime: 0.2, endTime: 0.3 },
        { word: 'a', startTime: 0.3, endTime: 0.4 },
        { word: 'very', startTime: 0.4, endTime: 0.6 },
        { word: 'long', startTime: 0.6, endTime: 0.8 },
        { word: 'script', startTime: 0.8, endTime: 1.2 },
        { word: 'that', startTime: 1.2, endTime: 1.4 },
        { word: 'needs', startTime: 1.4, endTime: 1.7 },
        { word: 'to', startTime: 1.7, endTime: 1.8 },
        { word: 'be', startTime: 1.8, endTime: 2.0 },
        { word: 'split', startTime: 2.0, endTime: 2.3 },
        { word: 'into', startTime: 2.3, endTime: 2.5 },
        { word: 'multiple', startTime: 2.5, endTime: 2.9 },
        { word: 'moments', startTime: 2.9, endTime: 3.3 },
        { word: 'because', startTime: 3.3, endTime: 3.7 },
        { word: 'Argil', startTime: 3.7, endTime: 4.0 },
        { word: 'has', startTime: 4.0, endTime: 4.2 },
        { word: 'a', startTime: 4.2, endTime: 4.3 },
        { word: '250', startTime: 4.3, endTime: 4.6 },
        { word: 'character', startTime: 4.6, endTime: 5.0 },
        { word: 'limit', startTime: 5.0, endTime: 5.3 },
        { word: 'per', startTime: 5.3, endTime: 5.5 },
        { word: 'moment', startTime: 5.5, endTime: 5.8 },
        { word: 'This', startTime: 5.8, endTime: 6.0 },
        { word: 'ensures', startTime: 6.0, endTime: 6.4 },
        { word: 'that', startTime: 6.4, endTime: 6.6 },
        { word: 'the', startTime: 6.6, endTime: 6.7 },
        { word: 'avatar', startTime: 6.7, endTime: 7.1 },
        { word: 'generation', startTime: 7.1, endTime: 7.6 },
        { word: 'works', startTime: 7.6, endTime: 7.9 },
        { word: 'correctly', startTime: 7.9, endTime: 8.4 },
        { word: 'with', startTime: 8.4, endTime: 8.6 },
        { word: 'longer', startTime: 8.6, endTime: 9.0 },
        { word: 'content', startTime: 9.0, endTime: 9.4 },
        { word: 'and', startTime: 9.4, endTime: 9.6 },
        { word: 'maintains', startTime: 9.6, endTime: 10.1 },
        { word: 'proper', startTime: 10.1, endTime: 10.5 },
        { word: 'lip-sync', startTime: 10.5, endTime: 11.0 },
        { word: 'with', startTime: 11.0, endTime: 11.2 },
        { word: 'the', startTime: 11.2, endTime: 11.3 },
        { word: 'generated', startTime: 11.3, endTime: 11.8 },
        { word: 'audio', startTime: 11.8, endTime: 12.2 },
        { word: 'segments', startTime: 12.2, endTime: 12.7 },
      ]

      const result = await argilService.generateFromScript({
        script: longScript,
        wordTimings: mockWordTimings,
        avatarId: 'avatar-2', // Use test avatar ID
        voiceId: '53725f95-fff8-428f-9e21-a37148200534',
        videoName: 'Long Script Avatar Video',
        aspectRatio: '9:16',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.id).toBe('video-67890')
      expect(result.data?.moments).toHaveLength(1)

      // Verify API call
      expect(mockFetch).toHaveBeenCalledWith('https://api.argil.ai/v1/videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'User-Agent': 'aidobe/1.0',
        },
        body: expect.stringContaining('Long Script Avatar Video'),
      })
    })

    it('should handle multiple avatar scenes in workflow', async () => {
      // Mock TTS API response
      const mockTTSResponse = new ArrayBuffer(2048)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockTTSResponse,
      })

      // Mock Whisper transcription response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Welcome to our product demo. This is scene one. Now let me show you the features. This is scene two with avatar.',
          words: [
            { word: 'Welcome', start: 0.0, end: 0.5 },
            { word: 'to', start: 0.5, end: 0.6 },
            { word: 'our', start: 0.6, end: 0.8 },
            { word: 'product', start: 0.8, end: 1.2 },
            { word: 'demo', start: 1.2, end: 1.5 },
            { word: 'This', start: 1.5, end: 1.7 },
            { word: 'is', start: 1.7, end: 1.8 },
            { word: 'scene', start: 1.8, end: 2.1 },
            { word: 'one', start: 2.1, end: 2.3 },
            { word: 'Now', start: 2.3, end: 2.5 },
            { word: 'let', start: 2.5, end: 2.7 },
            { word: 'me', start: 2.7, end: 2.8 },
            { word: 'show', start: 2.8, end: 3.0 },
            { word: 'you', start: 3.0, end: 3.2 },
            { word: 'the', start: 3.2, end: 3.3 },
            { word: 'features', start: 3.3, end: 3.8 },
            { word: 'This', start: 3.8, end: 4.0 },
            { word: 'is', start: 4.0, end: 4.1 },
            { word: 'scene', start: 4.1, end: 4.4 },
            { word: 'two', start: 4.4, end: 4.6 },
            { word: 'with', start: 4.6, end: 4.8 },
            { word: 'avatar', start: 4.8, end: 5.2 },
          ],
        }),
      })

      // Mock audio extraction response for multiple segments
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [
            {
              sceneId: 'scene-1',
              audioUrl: 'https://mock-storage.com/audio/segment-1.mp3',
              duration: 2.3,
            },
            {
              sceneId: 'scene-2',
              audioUrl: 'https://mock-storage.com/audio/segment-2.mp3',
              duration: 1.4,
            },
          ],
        }),
      })

      // Mock Argil video creation responses for each avatar scene
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-scene-1',
          name: 'scene-1_avatar_video',
          status: 'IDLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          moments: [
            {
              transcript: 'Welcome to our product demo. This is scene one.',
              avatarId: 'avatar-1',
              voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
            },
          ],
        }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'video-scene-2',
          name: 'scene-2_avatar_video',
          status: 'IDLE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          moments: [
            {
              transcript: 'This is scene two with avatar.',
              avatarId: 'avatar-1',
              voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
            },
          ],
        }),
      })

      // Process full workflow with multiple scenes
      const audioResult = await audioService.processFullWorkflow({
        script:
          'Welcome to our product demo. This is scene one. Now let me show you the features. This is scene two with avatar.',
        sceneRanges: [
          {
            sceneId: 'scene-1',
            startTime: 0.0,
            endTime: 2.3,
            purpose: 'avatar',
            text: 'Welcome to our product demo. This is scene one.',
          },
          {
            sceneId: 'scene-2',
            startTime: 3.8,
            endTime: 5.2,
            purpose: 'avatar',
            text: 'This is scene two with avatar.',
          },
        ],
        voiceSettings: {
          provider: 'elevenlabs',
          voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
        },
        outputFormat: 'mp3',
      })

      expect(audioResult.success).toBe(true)
      expect(audioResult.data?.segments).toHaveLength(2)

      // Process both avatar scenes
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
            avatarId: 'avatar-1',
            videoName: `${segment.sceneId}_avatar_video`,
            aspectRatio: '16:9',
          })

          if (argilResult.success) {
            avatarResults.push({
              sceneId: segment.sceneId,
              videoResult: argilResult.data,
            })
          }
        }
      }

      expect(avatarResults).toHaveLength(2)
      expect(avatarResults[0].videoResult?.id).toBe('video-scene-1')
      expect(avatarResults[1].videoResult?.id).toBe('video-scene-2')

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(5) // TTS + Transcription + Audio extraction + 2 Argil videos
    })

    it('should handle errors gracefully in workflow', async () => {
      // Mock TTS failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'TTS service unavailable' }),
      })

      const audioResult = await audioService.processFullWorkflow({
        script: 'This should fail due to TTS error.',
        sceneRanges: [
          {
            sceneId: 'scene-1',
            startTime: 0.0,
            endTime: 2.0,
            purpose: 'avatar',
            text: 'This should fail due to TTS error.',
          },
        ],
        voiceSettings: {
          provider: 'elevenlabs',
          voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
        },
        outputFormat: 'mp3',
      })

      expect(audioResult.success).toBe(false)
      expect(audioResult.error).toBeDefined()
      expect(audioResult.error).toContain('TTS service unavailable')
    })

    it('should handle Argil API errors gracefully', async () => {
      // Mock Argil API failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid API key' }),
      })

      const result = await argilService.generateFromScript({
        script: 'This should fail due to invalid API key.',
        wordTimings: [
          { word: 'This', startTime: 0.0, endTime: 0.5 },
          { word: 'should', startTime: 0.5, endTime: 0.8 },
          { word: 'fail', startTime: 0.8, endTime: 1.2 },
          { word: 'due', startTime: 1.2, endTime: 1.5 },
          { word: 'to', startTime: 1.5, endTime: 1.7 },
          { word: 'invalid', startTime: 1.7, endTime: 2.2 },
          { word: 'API', startTime: 2.2, endTime: 2.5 },
          { word: 'key', startTime: 2.5, endTime: 2.8 },
        ],
        avatarId: 'avatar-1', // Use a test avatar ID that passes validation
        voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
        videoName: 'Test Video',
        aspectRatio: '16:9',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid API key')
    })

    it('should validate avatar and voice combinations', async () => {
      const validation = configManager.validateAvatarVoiceCombination(
        'avatar-professional',
        '0f35210d-fdab-4049-842e-b879c7b5d95a'
      )

      expect(validation.valid).toBe(true)
      expect(validation.avatar).toBeDefined()
      expect(validation.voice).toBeDefined()
      expect(validation.avatar?.id).toBe('avatar-professional')
      expect(validation.voice?.id).toBe('0f35210d-fdab-4049-842e-b879c7b5d95a')

      // Test invalid avatar
      const invalidValidation = configManager.validateAvatarVoiceCombination(
        'non-existent-avatar',
        '0f35210d-fdab-4049-842e-b879c7b5d95a'
      )

      expect(invalidValidation.valid).toBe(false)
      expect(invalidValidation.error).toContain('Avatar not found')
    })

    it('should track cost and usage metrics', async () => {
      // Test cost management
      expect(configManager.canMakeRequest()).toBe(true)

      // Simulate multiple requests
      configManager.incrementRequestCount()
      configManager.incrementRequestCount()
      configManager.incrementRequestCount()

      expect(configManager.getEstimatedCost()).toBeCloseTo(0.3) // 3 requests * $0.1 per request

      // Test usage metrics
      const usageMetrics = await argilService.getUsageMetrics()
      expect(usageMetrics).toBeDefined()
      expect(usageMetrics.totalRequests).toBe(0) // Fresh service instance
      expect(usageMetrics.successRate).toBe(0)
    })

    it('should handle webhook notifications correctly', async () => {
      const webhookPayload = {
        video_id: 'video-12345',
        status: 'DONE',
        event: 'video.completed',
        videoUrl: 'https://api.argil.ai/videos/video-12345/download',
      }

      const result = await argilService.webhookHandler(webhookPayload, 'valid-signature')

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.processed).toBe(true)
      expect(result.data?.videoId).toBe('video-12345')

      // Test invalid signature
      const invalidResult = await argilService.webhookHandler(webhookPayload, 'invalid-signature')
      expect(invalidResult.success).toBe(false)
      expect(invalidResult.error).toContain('Invalid webhook signature')
    })
  })

  describe('Error Recovery and Retry Logic', () => {
    it('should retry on rate limiting', async () => {
      // Mock rate limiting response, then success
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit exceeded' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'video-retry-success',
            name: 'Retry Test Video',
            status: 'IDLE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            moments: [
              {
                transcript: 'Retry successful',
                avatarId: 'avatar-1',
                voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
              },
            ],
          }),
        })

      const result = await argilService.generateFromScript({
        script: 'Retry test',
        wordTimings: [
          { word: 'Retry', startTime: 0.0, endTime: 0.5 },
          { word: 'test', startTime: 0.5, endTime: 1.0 },
        ],
        avatarId: 'avatar-1',
        voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
        videoName: 'Retry Test Video',
      })

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('video-retry-success')
      expect(mockFetch).toHaveBeenCalledTimes(2) // Initial call + retry
    })

    it('should respect maximum retry attempts', async () => {
      // Mock repeated rate limit failures (429 errors retry, 500 errors don't)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit exceeded' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit exceeded' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: 'Rate limit exceeded' }),
        })

      const result = await argilService.generateFromScript({
        script: 'Max retry test',
        wordTimings: [
          { word: 'Max', startTime: 0.0, endTime: 0.3 },
          { word: 'retry', startTime: 0.3, endTime: 0.7 },
          { word: 'test', startTime: 0.7, endTime: 1.0 },
        ],
        avatarId: 'avatar-1',
        voiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a',
        videoName: 'Max Retry Test Video',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit exceeded')
      expect(mockFetch).toHaveBeenCalledTimes(3) // Maximum retry attempts
    })
  })

  describe('Configuration Management', () => {
    it('should use mock responses in development environment', async () => {
      const devConfigManager = new ArgilConfigManager(undefined, 'development')

      expect(devConfigManager.shouldUseMockResponses()).toBe(true)
      expect(devConfigManager.canMakeRequest()).toBe(true)

      const config = devConfigManager.getConfig()
      expect(config.cost_management.use_mock_responses).toBe(true)
      expect(config.cost_management.max_requests_per_session).toBe(5)
    })

    it('should use real responses in production environment', async () => {
      const prodConfigManager = new ArgilConfigManager(undefined, 'production')

      expect(prodConfigManager.shouldUseMockResponses()).toBe(false)

      const config = prodConfigManager.getConfig()
      expect(config.cost_management.use_mock_responses).toBe(false)
      expect(config.cost_management.max_requests_per_session).toBe(100)
    })

    it('should manage voice and avatar configurations', async () => {
      const voices = configManager.getVoices()
      const avatars = configManager.getAvatars()

      expect(voices).toHaveLength(5)
      expect(avatars).toHaveLength(2)

      // Test specific voice lookup
      const sarahVoice = configManager.getVoice('0f35210d-fdab-4049-842e-b879c7b5d95a')
      expect(sarahVoice).toBeDefined()
      expect(sarahVoice?.name).toBe('Sarah')

      // Test specific avatar lookup
      const professionalAvatar = configManager.getAvatar('avatar-professional')
      expect(professionalAvatar).toBeDefined()
      expect(professionalAvatar?.name).toBe('Professional Avatar')
      expect(professionalAvatar?.defaultVoiceId).toBe('0f35210d-fdab-4049-842e-b879c7b5d95a')
    })
  })
})
