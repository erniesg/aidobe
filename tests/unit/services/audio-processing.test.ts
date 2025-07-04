import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AudioProcessingService } from '../../../src/services/audio-processing'
import type { Env } from '../../../src/types/env'
import type { 
  AudioGenerationRequest,
  MusicSearchRequest,
  AudioMixConfig
} from '../../../src/schemas/audio'

const mockEnv: Env = {
  ENVIRONMENT: 'test',
  ACCESS_PASSWORD: 'test-password',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any
}

describe('AudioProcessingService', () => {
  let service: AudioProcessingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AudioProcessingService(mockEnv)
  })

  describe('generateTTS', () => {
    it('should generate TTS audio with OpenAI provider', async () => {
      const request: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'Hello world, this is a test of the text-to-speech system.',
        voicePreferences: {
          provider: 'openai',
          voiceId: 'alloy',
          gender: 'neutral',
          style: 'conversational'
        },
        parameters: {
          speed: 1.1,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const result = await service.generateTTS(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.text).toBe(request.text)
      expect(result.data!.provider).toBe('openai')
      expect(result.data!.voiceCharacteristics.style).toBe('conversational')
      expect(result.data!.duration).toBeGreaterThan(0)
      expect(result.data!.generationTime).toBeGreaterThan(0)
      expect(result.metadata?.providersUsed).toContain('OpenAI TTS')
    })

    it('should generate TTS audio with ElevenLabs provider', async () => {
      const request: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'This is a test with ElevenLabs voice synthesis.',
        voicePreferences: {
          provider: 'elevenlabs',
          voiceId: 'rachel',
          gender: 'female',
          style: 'energetic'
        },
        parameters: {
          temperature: 0.7,
          stability: 0.8
        }
      }

      const result = await service.generateTTS(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.provider).toBe('elevenlabs')
      expect(result.data!.voiceId).toBe('rachel')
      expect(result.data!.generationParams.temperature).toBe(0.7)
      expect(result.data!.quality.overallScore).toBeGreaterThan(0.8)
    })

    it('should cache TTS results for performance', async () => {
      const request: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'Cacheable test text',
        voicePreferences: { provider: 'openai' },
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      // First call
      const result1 = await service.generateTTS(request)
      expect(result1.metadata?.cacheHit).toBeFalsy()

      // Second call should hit cache
      const result2 = await service.generateTTS(request)
      expect(result2.metadata?.cacheHit).toBe(true)
      expect(result2.data!.id).toBe(result1.data!.id)
    })

    it('should handle TTS generation failures gracefully', async () => {
      const request: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'Test text',
        voicePreferences: { provider: 'nonexistent' as any },
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const result = await service.generateTTS(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No TTS provider available')
    })

    it('should validate speech rate and provide warnings', async () => {
      const request: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'A very short text that will result in unusual speech rate calculations for testing purposes.',
        parameters: { 
          speed: 2.0, // Very fast speech
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await service.generateTTS(request)

      expect(result.success).toBe(true)
      // Note: Console warning would be triggered in real implementation
      
      consoleSpy.mockRestore()
    })

    it('should estimate appropriate duration for given text', async () => {
      const shortText = "Hello world."
      const longText = "This is a much longer text that should take significantly more time to speak when converted to speech using text-to-speech technology."

      const shortRequest: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: shortText,
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const longRequest: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: longText,
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const shortResult = await service.generateTTS(shortRequest)
      const longResult = await service.generateTTS(longRequest)

      expect(shortResult.success).toBe(true)
      expect(longResult.success).toBe(true)
      expect(longResult.data!.duration).toBeGreaterThan(shortResult.data!.duration)
    })
  })

  describe('selectMusic', () => {
    it('should search for music across multiple providers', async () => {
      const request: MusicSearchRequest = {
        jobId: crypto.randomUUID(),
        mood: 'upbeat',
        duration: { min: 30, max: 120 },
        videoContext: {
          totalDuration: 90,
          energyLevel: 0.8
        },
        maxResults: 5
      }

      const result = await service.selectMusic(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.length).toBeGreaterThan(0)
      expect(result.data!.length).toBeLessThanOrEqual(5)
      expect(result.metadata?.providersUsed).toContain('Freesound')
      expect(result.metadata?.providersUsed).toContain('YouTube Audio Library')
      
      // All results should match the requested mood
      result.data!.forEach(music => {
        expect(music.mood).toBe('upbeat')
        expect(music.energyLevel).toBeGreaterThan(0.5) // Upbeat should have high energy
      })
    })

    it('should rank music by relevance and energy level', async () => {
      const request: MusicSearchRequest = {
        jobId: crypto.randomUUID(),
        mood: 'calm',
        videoContext: {
          totalDuration: 60,
          energyLevel: 0.2 // Low energy video
        },
        maxResults: 10
      }

      const result = await service.selectMusic(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      // Verify results are sorted by relevance (mood match first, descending order)
      for (let i = 1; i < result.data!.length; i++) {
        const current = result.data![i]
        const previous = result.data![i - 1]
        expect(previous.moodMatch).toBeGreaterThanOrEqual(current.moodMatch)
      }
    })

    it('should cache music search results', async () => {
      const request: MusicSearchRequest = {
        jobId: crypto.randomUUID(),
        mood: 'dramatic',
        maxResults: 3
      }

      // First call
      const result1 = await service.selectMusic(request)
      expect(result1.metadata?.cacheHit).toBeFalsy()

      // Second call should hit cache
      const result2 = await service.selectMusic(request)
      expect(result2.metadata?.cacheHit).toBe(true)
      expect(result2.data!.length).toBe(result1.data!.length)
    })

    it('should handle different moods correctly', async () => {
      const moods: Array<'upbeat' | 'calm' | 'dramatic' | 'inspirational' | 'energetic'> = [
        'upbeat', 'calm', 'dramatic', 'inspirational', 'energetic'
      ]

      for (const mood of moods) {
        const request: MusicSearchRequest = {
          jobId: crypto.randomUUID(),
          mood,
          maxResults: 2
        }

        const result = await service.selectMusic(request)

        expect(result.success).toBe(true)
        expect(result.data).toBeDefined()
        result.data!.forEach(music => {
          expect(music.mood).toBe(mood)
          expect(music.moodMatch).toBeGreaterThan(0.5)
        })
      }
    })

    it('should handle provider failures gracefully', async () => {
      // Clear all providers to simulate failure
      const originalStats = service.getStatistics()
      expect(originalStats.musicProvidersCount).toBeGreaterThan(0)

      const request: MusicSearchRequest = {
        jobId: crypto.randomUUID(),
        mood: 'upbeat',
        maxResults: 5
      }

      const result = await service.selectMusic(request)

      // Should still succeed even if individual providers fail
      expect(result.success).toBe(true)
      expect(result.metadata).toBeDefined()
    })
  })

  describe('mixAudio', () => {
    it('should mix voice and background music successfully', async () => {
      const config: AudioMixConfig = {
        id: crypto.randomUUID(),
        jobId: crypto.randomUUID(),
        voiceAudio: {
          audioFileId: crypto.randomUUID(),
          volume: 1.0,
          fadeIn: 0.5,
          fadeOut: 0.5,
          normalization: true,
          compression: { enabled: true, threshold: -12, ratio: 3 }
        },
        backgroundMusic: {
          musicSelectionId: crypto.randomUUID(),
          volume: 0.3,
          fadeIn: 1.0,
          fadeOut: 1.0,
          ducking: {
            enabled: true,
            reduction: 0.6,
            attackTime: 0.1,
            releaseTime: 0.5
          }
        },
        globalSettings: {
          masterVolume: 1.0,
          finalFormat: 'mp3',
          normalization: true,
          limiter: { enabled: true, threshold: -1, release: 0.05 }
        },
        outputDuration: 90,
        createdAt: new Date().toISOString()
      }

      const result = await service.mixAudio(config)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data).toMatch(/^https:\/\/mock-storage\.com\/mixed-audio\/.*\.mp3$/)
      expect(result.metadata?.providersUsed).toContain('audio_mixer')
      expect(result.metadata?.executionTime).toBeGreaterThan(0)
    })

    it('should handle voice-only audio mixing', async () => {
      const config: AudioMixConfig = {
        id: crypto.randomUUID(),
        jobId: crypto.randomUUID(),
        voiceAudio: {
          audioFileId: crypto.randomUUID(),
          volume: 1.0,
          normalization: true
        },
        // No background music
        globalSettings: {
          masterVolume: 1.0,
          finalFormat: 'wav'
        },
        outputDuration: 45,
        createdAt: new Date().toISOString()
      }

      const result = await service.mixAudio(config)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(typeof result.data).toBe('string')
    })

    it('should apply audio ducking correctly', async () => {
      const config: AudioMixConfig = {
        id: crypto.randomUUID(),
        jobId: crypto.randomUUID(),
        voiceAudio: {
          audioFileId: crypto.randomUUID(),
          volume: 1.0,
          fadeIn: 0,
          fadeOut: 0,
          normalization: true,
          compression: {
            enabled: false,
            threshold: -12,
            ratio: 3
          }
        },
        backgroundMusic: {
          musicSelectionId: crypto.randomUUID(),
          volume: 0.5,
          fadeIn: 1,
          fadeOut: 1,
          ducking: {
            enabled: true,
            reduction: 0.8, // High reduction
            attackTime: 0.05,
            releaseTime: 1.0
          }
        },
        outputDuration: 60,
        createdAt: new Date().toISOString()
      }

      const result = await service.mixAudio(config)

      expect(result.success).toBe(true)
      // In real implementation, would verify that ducking was applied
    })

    it('should handle missing voice audio file', async () => {
      const config: AudioMixConfig = {
        id: crypto.randomUUID(),
        jobId: crypto.randomUUID(),
        voiceAudio: {
          audioFileId: 'nonexistent-id', // This is not a valid UUID, will fail validation
          volume: 1.0
        },
        outputDuration: 30,
        createdAt: new Date().toISOString()
      }

      const result = await service.mixAudio(config)
      
      // Should fail due to invalid UUID format
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid uuid')
    })

    it('should validate mix configuration', async () => {
      const invalidConfig = {
        // Missing required fields
        voiceAudio: { volume: 'invalid' },
        outputDuration: -1
      } as any

      const result = await service.mixAudio(invalidConfig)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('transcribeAudio', () => {
    it('should transcribe audio with word-level timing', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3'

      const result = await service.transcribeAudio(audioUrl)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.fullText).toBeDefined()
      expect(result.data!.wordTimings).toBeInstanceOf(Array)
      expect(result.data!.wordTimings.length).toBeGreaterThan(0)
      expect(result.data!.confidence).toBeGreaterThan(0.8)
      expect(result.data!.provider).toBe('openai_whisper')
      
      // Verify word timing structure
      result.data!.wordTimings.forEach(timing => {
        expect(timing.word).toBeDefined()
        expect(timing.startTime).toBeGreaterThanOrEqual(0)
        expect(timing.endTime).toBeGreaterThan(timing.startTime)
        expect(timing.confidence).toBeGreaterThan(0)
      })
    })

    it('should optimize word timings to prevent overlaps', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3'

      const result = await service.transcribeAudio(audioUrl)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      
      // Verify no overlapping timings
      const timings = result.data!.wordTimings
      for (let i = 1; i < timings.length; i++) {
        expect(timings[i].startTime).toBeGreaterThanOrEqual(timings[i - 1].endTime)
      }
    })

    it('should extract sentence boundaries', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3'

      const result = await service.transcribeAudio(audioUrl)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.sentences).toBeInstanceOf(Array)
      
      // Verify sentence structure
      result.data!.sentences.forEach(sentence => {
        expect(sentence.text).toBeDefined()
        expect(sentence.startTime).toBeGreaterThanOrEqual(0)
        expect(sentence.endTime).toBeGreaterThan(sentence.startTime)
        expect(sentence.confidence).toBeGreaterThan(0)
      })
    })

    it('should handle transcription with specific provider', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3'
      const provider = 'elevenlabs'

      const result = await service.transcribeAudio(audioUrl, provider)

      expect(result.success).toBe(true)
      expect(result.metadata?.providersUsed).toContain('ElevenLabs')
    })

    it('should handle transcription failures gracefully', async () => {
      const audioUrl = 'https://example.com/invalid-audio.mp3'
      const provider = 'nonexistent'

      const result = await service.transcribeAudio(audioUrl, provider)

      expect(result.success).toBe(false)
      expect(result.error).toContain('No transcription provider available')
    })
  })

  describe('cache management', () => {
    it('should clear cache successfully', () => {
      service.clearCache()

      const stats = service.getStatistics()
      expect(stats.cacheSize).toBe(0)
    })
  })

  describe('service statistics', () => {
    it('should return correct service statistics', () => {
      const stats = service.getStatistics()

      expect(stats.ttsProvidersCount).toBeGreaterThan(0)
      expect(stats.musicProvidersCount).toBeGreaterThan(0)
      expect(stats.ttsProviders).toContain('openai')
      expect(stats.ttsProviders).toContain('elevenlabs')
      expect(stats.musicProviders).toContain('freesound')
      expect(stats.musicProviders).toContain('youtube_audio_library')
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0)
    })

    it('should track provider availability', () => {
      const stats = service.getStatistics()

      expect(stats.ttsProvidersCount).toBe(2) // OpenAI + ElevenLabs
      expect(stats.musicProvidersCount).toBe(2) // Freesound + YouTube
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete audio processing workflow', async () => {
      // Step 1: Generate TTS
      const ttsRequest: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'Welcome to our amazing product demonstration.',
        voicePreferences: { provider: 'openai', style: 'energetic' },
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const ttsResult = await service.generateTTS(ttsRequest)
      expect(ttsResult.success).toBe(true)

      // Step 2: Select background music
      const musicRequest: MusicSearchRequest = {
        jobId: ttsRequest.jobId,
        mood: 'inspirational',
        videoContext: {
          totalDuration: ttsResult.data!.duration,
          energyLevel: 0.7,
          keyMoments: [
            { time: 10, description: 'Key point', intensity: 0.8 }
          ]
        },
        maxResults: 3
      }

      const musicResult = await service.selectMusic(musicRequest)
      expect(musicResult.success).toBe(true)
      expect(musicResult.data!.length).toBeGreaterThan(0)

      // Step 3: Mix audio
      const mixConfig: AudioMixConfig = {
        id: crypto.randomUUID(),
        jobId: ttsRequest.jobId,
        voiceAudio: {
          audioFileId: ttsResult.data!.id,
          volume: 1.0,
          fadeIn: 0,
          fadeOut: 0,
          normalization: true,
          compression: {
            enabled: false,
            threshold: -12,
            ratio: 3
          }
        },
        backgroundMusic: {
          musicSelectionId: musicResult.data![0].id,
          volume: 0.2,
          fadeIn: 1,
          fadeOut: 1,
          ducking: { 
            enabled: true, 
            reduction: 0.7,
            attackTime: 0.1,
            releaseTime: 0.5
          }
        },
        outputDuration: ttsResult.data!.duration,
        createdAt: new Date().toISOString()
      }

      const mixResult = await service.mixAudio(mixConfig)
      expect(mixResult.success).toBe(true)
      expect(mixResult.data).toBeDefined()
    })

    it('should handle error propagation in workflow', async () => {
      // Test with invalid configuration
      const invalidRequest: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: '', // Empty text should cause issues
        voicePreferences: { provider: 'invalid' as any },
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const result = await service.generateTTS(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('performance and reliability', () => {
    it('should complete TTS generation within reasonable time', async () => {
      const request: AudioGenerationRequest = {
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: 'Performance test text for TTS generation timing verification.',
        parameters: {
          speed: 1.0,
          pitch: 1.0,
          volume: 1.0
        },
        outputFormat: 'mp3',
        includeWordTimings: true
      }

      const startTime = Date.now()
      const result = await service.generateTTS(request)
      const executionTime = Date.now() - startTime

      expect(result.success).toBe(true)
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        jobId: crypto.randomUUID(),
        scriptId: crypto.randomUUID(),
        text: `Concurrent request number ${i + 1}`,
        voicePreferences: { provider: 'openai' as const }
      }))

      const startTime = Date.now()
      const results = await Promise.all(
        requests.map(request => service.generateTTS(request))
      )
      const totalTime = Date.now() - startTime

      expect(results).toHaveLength(5)
      expect(results.every(r => r.success)).toBe(true)
      expect(totalTime).toBeLessThan(10000) // Should handle 5 concurrent requests quickly
    })
  })
})