import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioSegmentationService } from '../../../src/services/audio-segmentation'
import type { WordTiming } from '../../../src/schemas/audio'
import type { Env } from '../../../src/types/env'

// Mock environment for testing
const mockEnv: Env = {
  ENVIRONMENT: 'test',
  ACCESS_PASSWORD: 'test-password',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  ARGIL_API_KEY: 'test-argil-key',
  ARGIL_WEBHOOK_SECRET: 'test-webhook-secret',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any,
}

// Mock fetch and other globals
global.fetch = vi.fn()

describe('AudioSegmentationService', () => {
  let service: AudioSegmentationService
  let mockFetch: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.mocked(fetch)
    service = new AudioSegmentationService(mockEnv)
  })

  describe('generateFullAudio', () => {
    it('should generate full audio from script using TTS', async () => {
      const script =
        'Today we will discuss AI advances. Let me explain the key concepts. In conclusion, AI is transforming everything.'

      // Mock ElevenLabs TTS API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024), // Mock audio data
        headers: new Headers({
          'content-type': 'audio/mpeg',
        }),
      })

      const result = await service.generateFullAudio({
        script,
        voiceId: 'rachel',
        voiceSettings: {
          stability: 0.8,
          similarity: 0.9,
          speed: 1.0,
        },
        outputFormat: 'mp3',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.audioUrl).toMatch(/^https:\/\/.*\.mp3$/)
      expect(result.data?.duration).toBeGreaterThan(0)
      expect(result.data?.script).toBe(script)
      expect(result.data?.provider).toBe('elevenlabs')
    })

    it('should handle TTS API failures gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      })

      const result = await service.generateFullAudio({
        script: 'Test script',
        voiceId: 'rachel',
        outputFormat: 'mp3',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Rate limit exceeded')
    })

    it('should validate script length', async () => {
      const result = await service.generateFullAudio({
        script: '', // Empty script
        voiceId: 'rachel',
        outputFormat: 'mp3',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Script cannot be empty')
    })

    it('should support different voice providers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
        headers: new Headers({ 'content-type': 'audio/mpeg' }),
      })

      const result = await service.generateFullAudio({
        script: 'Test script',
        provider: 'openai',
        voiceId: 'alloy',
        outputFormat: 'mp3',
      })

      expect(result.success).toBe(true)
      expect(result.data?.provider).toBe('openai')
    })
  })

  describe('transcribeAudio', () => {
    it('should transcribe audio with word-level timing using Whisper', async () => {
      const audioUrl = 'https://example.com/full-narration.mp3'

      // Mock Whisper API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: 'Today we will discuss AI advances. Let me explain the key concepts.',
          words: [
            { word: 'Today', start: 0.0, end: 0.5 },
            { word: 'we', start: 0.5, end: 0.7 },
            { word: 'will', start: 0.7, end: 0.9 },
            { word: 'discuss', start: 0.9, end: 1.4 },
            { word: 'AI', start: 1.4, end: 1.7 },
            { word: 'advances', start: 1.7, end: 2.3 },
            { word: 'Let', start: 3.0, end: 3.2 },
            { word: 'me', start: 3.2, end: 3.4 },
            { word: 'explain', start: 3.4, end: 3.9 },
            { word: 'the', start: 3.9, end: 4.0 },
            { word: 'key', start: 4.0, end: 4.3 },
            { word: 'concepts', start: 4.3, end: 4.9 },
          ],
        }),
      })

      const result = await service.transcribeAudio({
        audioUrl,
        provider: 'openai_whisper',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.fullText).toBe(
        'Today we will discuss AI advances. Let me explain the key concepts.'
      )
      expect(result.data?.wordTimings).toHaveLength(12)
      expect(result.data?.wordTimings[0]).toMatchObject({
        word: 'Today',
        startTime: 0.0,
        endTime: 0.5,
      })
      expect(result.data?.duration).toBeGreaterThan(0)
    })

    it('should handle transcription failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid audio format' }),
      })

      const result = await service.transcribeAudio({
        audioUrl: 'https://example.com/invalid-audio.mp3',
        provider: 'openai_whisper',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid audio format')
    })

    it('should validate audio URL accessibility', async () => {
      const result = await service.transcribeAudio({
        audioUrl: 'invalid-url',
        provider: 'openai_whisper',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid audio URL')
    })
  })

  describe('extractAudioSegments', () => {
    it('should extract audio segments for avatar scenes', async () => {
      const fullAudioUrl = 'https://example.com/full-narration.mp3'
      const wordTimings: WordTiming[] = [
        { word: 'Today', startTime: 0.0, endTime: 0.5 },
        { word: 'we', startTime: 0.5, endTime: 0.7 },
        { word: 'will', startTime: 0.7, endTime: 0.9 },
        { word: 'discuss', startTime: 0.9, endTime: 1.4 },
        { word: 'AI', startTime: 1.4, endTime: 1.7 },
        { word: 'advances', startTime: 1.7, endTime: 2.3 },
        { word: 'Let', startTime: 3.0, endTime: 3.2 },
        { word: 'me', startTime: 3.2, endTime: 3.4 },
        { word: 'explain', startTime: 3.4, endTime: 3.9 },
        { word: 'the', startTime: 3.9, endTime: 4.0 },
        { word: 'key', startTime: 4.0, endTime: 4.3 },
        { word: 'concepts', startTime: 4.3, endTime: 4.9 },
      ]

      const extractionRanges = [
        {
          sceneId: 'intro',
          startTime: 0.0,
          endTime: 2.3,
          purpose: 'regular' as const,
          text: 'Today we will discuss AI advances',
        },
        {
          sceneId: 'avatar_explain',
          startTime: 3.0,
          endTime: 4.9,
          purpose: 'avatar' as const,
          text: 'Let me explain the key concepts',
        },
      ]

      // Mock audio extraction API (could be FFmpeg service)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [
            {
              sceneId: 'intro',
              audioUrl: 'https://storage.com/intro-segment.mp3',
              duration: 2.3,
            },
            {
              sceneId: 'avatar_explain',
              audioUrl: 'https://storage.com/avatar-segment.mp3',
              duration: 1.9,
            },
          ],
        }),
      })

      const result = await service.extractAudioSegments({
        fullAudioUrl,
        extractionRanges,
        wordTimings,
        fullTranscript: 'Today we will discuss AI advances. Let me explain the key concepts.',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.segments).toHaveLength(2)

      const avatarSegment = result.data?.segments.find((s) => s.sceneId === 'avatar_explain')
      expect(avatarSegment).toBeDefined()
      expect(avatarSegment?.audioUrl).toBe('https://storage.com/avatar-segment.mp3')
      expect(avatarSegment?.transcript).toBe('Let me explain the key concepts')
      expect(avatarSegment?.duration).toBe(1.9)
      expect(avatarSegment?.wordTimings).toHaveLength(6) // 6 words in the segment
    })

    it('should handle audio processing failures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Audio processing failed' }),
      })

      const result = await service.extractAudioSegments({
        fullAudioUrl: 'https://example.com/audio.mp3',
        extractionRanges: [
          {
            sceneId: 'test',
            startTime: 0,
            endTime: 10,
            purpose: 'avatar',
            text: 'test',
          },
        ],
        wordTimings: [],
        fullTranscript: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Audio processing failed')
    })

    it('should validate extraction ranges', async () => {
      const result = await service.extractAudioSegments({
        fullAudioUrl: 'https://example.com/audio.mp3',
        extractionRanges: [
          {
            sceneId: 'test',
            startTime: 10, // Start after end
            endTime: 5,
            purpose: 'avatar',
            text: 'test',
          },
        ],
        wordTimings: [],
        fullTranscript: 'test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid time range')
    })
  })

  describe('processFullWorkflow', () => {
    it('should handle complete TTS → transcription → segmentation workflow', async () => {
      const script =
        'Today we will discuss AI advances. Let me explain the key concepts. In conclusion, AI is transforming everything.'

      const sceneRanges = [
        {
          sceneId: 'intro',
          startTime: 0.0,
          endTime: 2.3,
          purpose: 'regular' as const,
          text: 'Today we will discuss AI advances',
        },
        {
          sceneId: 'avatar_explain',
          startTime: 3.0,
          endTime: 4.9,
          purpose: 'avatar' as const,
          text: 'Let me explain the key concepts',
        },
        {
          sceneId: 'conclusion',
          startTime: 6.0,
          endTime: 8.5,
          purpose: 'regular' as const,
          text: 'In conclusion, AI is transforming everything',
        },
      ]

      // Mock TTS generation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
        headers: new Headers({ 'content-type': 'audio/mpeg' }),
      })

      // Mock transcription
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: script,
          words: [
            { word: 'Today', start: 0.0, end: 0.5 },
            { word: 'we', start: 0.5, end: 0.7 },
            { word: 'will', start: 0.7, end: 0.9 },
            { word: 'discuss', start: 0.9, end: 1.4 },
            { word: 'AI', start: 1.4, end: 1.7 },
            { word: 'advances', start: 1.7, end: 2.3 },
            { word: 'Let', start: 3.0, end: 3.2 },
            { word: 'me', start: 3.2, end: 3.4 },
            { word: 'explain', start: 3.4, end: 3.9 },
            { word: 'the', start: 3.9, end: 4.0 },
            { word: 'key', start: 4.0, end: 4.3 },
            { word: 'concepts', start: 4.3, end: 4.9 },
          ],
        }),
      })

      // Mock audio segmentation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          segments: [
            {
              sceneId: 'intro',
              audioUrl: 'https://storage.com/intro-segment.mp3',
              duration: 2.3,
            },
            {
              sceneId: 'avatar_explain',
              audioUrl: 'https://storage.com/avatar-segment.mp3',
              duration: 1.9,
            },
            {
              sceneId: 'conclusion',
              audioUrl: 'https://storage.com/conclusion-segment.mp3',
              duration: 2.5,
            },
          ],
        }),
      })

      const result = await service.processFullWorkflow({
        script,
        sceneRanges,
        voiceSettings: {
          provider: 'elevenlabs',
          voiceId: 'rachel',
          stability: 0.8,
          similarity: 0.9,
        },
        outputFormat: 'mp3',
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.fullAudioUrl).toBeDefined()
      expect(result.data?.transcription).toBeDefined()
      expect(result.data?.segments).toHaveLength(3)

      const avatarSegment = result.data?.segments.find((s) => s.sceneId === 'avatar_explain')
      expect(avatarSegment).toBeDefined()
      expect(avatarSegment?.purpose).toBe('avatar')
      expect(avatarSegment?.audioUrl).toBe('https://storage.com/avatar-segment.mp3')
    })

    it('should handle workflow failures at any stage', async () => {
      // Mock TTS failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'TTS service unavailable' }),
      })

      const result = await service.processFullWorkflow({
        script: 'Test script',
        sceneRanges: [],
        voiceSettings: {
          provider: 'elevenlabs',
          voiceId: 'rachel',
        },
        outputFormat: 'mp3',
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('TTS service unavailable')
    })
  })

  describe('caching and performance', () => {
    it('should cache TTS results for identical scripts', async () => {
      const script = 'Cacheable test script'

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
        headers: new Headers({ 'content-type': 'audio/mpeg' }),
      })

      // First call
      const result1 = await service.generateFullAudio({
        script,
        voiceId: 'rachel',
        outputFormat: 'mp3',
      })

      // Second call should use cache
      const result2 = await service.generateFullAudio({
        script,
        voiceId: 'rachel',
        outputFormat: 'mp3',
      })

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result2.metadata?.cached).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only called once due to caching
    })

    it('should provide performance metrics', async () => {
      const metrics = await service.getPerformanceMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.totalRequests).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.averageProcessingTime).toBeGreaterThanOrEqual(0)
      expect(metrics.providerBreakdown).toBeDefined()
    })
  })

  describe('error handling and validation', () => {
    it('should validate audio format support', async () => {
      const result = await service.generateFullAudio({
        script: 'Test script',
        voiceId: 'rachel',
        outputFormat: 'unsupported' as any,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unsupported audio format')
    })

    it('should handle concurrent requests gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
        headers: new Headers({ 'content-type': 'audio/mpeg' }),
      })

      const requests = Array.from({ length: 5 }, (_, i) =>
        service.generateFullAudio({
          script: `Test script ${i}`,
          voiceId: 'rachel',
          outputFormat: 'mp3',
        })
      )

      const results = await Promise.all(requests)

      expect(results).toHaveLength(5)
      expect(results.every((r) => r.success)).toBe(true)
    })
  })
})
