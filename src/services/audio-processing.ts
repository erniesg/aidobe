import type { Env } from '../types/env'
import { 
  type AudioGenerationRequest,
  type MusicSearchRequest,
  type AudioFile,
  type MusicSelection,
  type AudioMixConfig,
  type Transcription,
  type WordTiming,
  AudioFileSchema,
  MusicSelectionSchema,
  AudioMixConfigSchema,
  TranscriptionSchema,
  validateSpeechRate,
  calculateAudioLevels,
  optimizeWordTimings,
  extractSentenceBoundaries
} from '../schemas/audio'

interface AudioProvider {
  name: string
  generateTTS?(request: TTSGenerationRequest): Promise<AudioFile>
  transcribe?(audioUrl: string): Promise<Transcription>
}

interface MusicProvider {
  name: string
  search(request: MusicSearchRequest): Promise<MusicSelection[]>
}

interface TTSGenerationRequest {
  text: string
  voiceId?: string
  voiceCharacteristics?: {
    gender?: 'male' | 'female' | 'neutral'
    style?: 'neutral' | 'conversational' | 'energetic' | 'calm' | 'dramatic'
    speed?: number
    pitch?: number
  }
  parameters?: {
    temperature?: number
    stability?: number
    speakingRate?: number
  }
}

interface AudioResult<T> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    executionTime: number
    providersUsed: string[]
    totalResults?: number
    cacheHit?: boolean
  }
}

/**
 * Audio Processing Service for TTS generation, music selection, and audio mixing
 * Handles voice synthesis, background music selection, and final audio assembly
 */
export class AudioProcessingService {
  private ttsProviders = new Map<string, AudioProvider>()
  private musicProviders = new Map<string, MusicProvider>()
  private cache = new Map<string, { data: any; expiry: number }>()
  private readonly CACHE_TTL = 30 * 60 * 1000 // 30 minutes

  constructor(private env: Env) {
    this.initializeProviders()
  }

  /**
   * Generate text-to-speech audio with word-level timing
   */
  async generateTTS(request: AudioGenerationRequest): Promise<AudioResult<AudioFile>> {
    const startTime = Date.now()
    const providersUsed: string[] = []

    try {
      // Create cache key for this generation
      const cacheKey = this.createCacheKey('tts', request)
      const cached = this.getCachedResult(cacheKey)
      
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed: [],
            cacheHit: true
          }
        }
      }

      // Select TTS provider based on preferences
      const provider = this.selectTTSProvider(request.voicePreferences?.provider)
      if (!provider || !provider.generateTTS) {
        return {
          success: false,
          error: 'No TTS provider available',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed
          }
        }
      }

      providersUsed.push(provider.name)

      // Validate text input
      if (!request.text || request.text.trim().length === 0) {
        return {
          success: false,
          error: 'Text content is required for TTS generation',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed
          }
        }
      }

      // Prepare TTS request
      const ttsRequest: TTSGenerationRequest = {
        text: request.text,
        voiceId: request.voicePreferences?.voiceId,
        voiceCharacteristics: {
          gender: request.voicePreferences?.gender,
          style: request.voicePreferences?.style,
          speed: request.parameters?.speed,
          pitch: request.parameters?.pitch
        },
        parameters: {
          temperature: request.parameters?.temperature,
          stability: request.parameters?.stability,
          speakingRate: request.parameters?.speed
        }
      }

      // Generate TTS
      const audioFile = await provider.generateTTS(ttsRequest)

      // Validate speech rate
      const speechRateValidation = validateSpeechRate(request.text, audioFile.duration)
      if (!speechRateValidation.valid) {
        console.warn(`Speech rate warning: ${speechRateValidation.recommendation}`)
      }

      // Cache the result
      this.setCachedResult(cacheKey, audioFile)

      return {
        success: true,
        data: audioFile,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed,
          totalResults: 1
        }
      }

    } catch (error) {
      console.error('TTS generation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown TTS error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed
        }
      }
    }
  }

  /**
   * Select background music based on mood and video context
   */
  async selectMusic(request: MusicSearchRequest): Promise<AudioResult<MusicSelection[]>> {
    const startTime = Date.now()
    const providersUsed: string[] = []

    try {
      // Create cache key for this search
      const cacheKey = this.createCacheKey('music_search', request)
      const cached = this.getCachedResult(cacheKey)
      
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed: [],
            totalResults: cached.length,
            cacheHit: true
          }
        }
      }

      // Search across all music providers
      const searchPromises = Array.from(this.musicProviders.values()).map(async (provider) => {
        try {
          providersUsed.push(provider.name)
          return await provider.search(request)
        } catch (error) {
          console.error(`Music provider ${provider.name} search failed:`, error)
          return []
        }
      })

      const providerResults = await Promise.all(searchPromises)
      
      // Combine and rank results
      const allMusic = providerResults.flat()
      const rankedMusic = this.rankMusicByRelevance(allMusic, request)
      
      // Limit to requested count
      const finalResults = rankedMusic.slice(0, request.maxResults || 10)
      
      // Cache the results
      this.setCachedResult(cacheKey, finalResults)

      return {
        success: true,
        data: finalResults,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed,
          totalResults: finalResults.length
        }
      }

    } catch (error) {
      console.error('Music selection failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown music selection error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed
        }
      }
    }
  }

  /**
   * Mix audio components into final audio track
   */
  async mixAudio(config: AudioMixConfig): Promise<AudioResult<string>> {
    const startTime = Date.now()

    try {
      // Validate mix configuration
      const validatedConfig = AudioMixConfigSchema.parse(config)

      // Get voice audio file
      const voiceAudio = await this.getAudioFile(validatedConfig.voiceAudio.audioFileId)
      if (!voiceAudio) {
        return {
          success: false,
          error: 'Voice audio file not found',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed: ['audio_mixer']
          }
        }
      }

      // Get background music if specified
      let backgroundMusic: MusicSelection | null = null
      if (validatedConfig.backgroundMusic?.musicSelectionId) {
        backgroundMusic = await this.getMusicSelection(validatedConfig.backgroundMusic.musicSelectionId)
      }

      // Calculate audio levels with ducking
      const audioLevels = calculateAudioLevels(
        validatedConfig.voiceAudio.volume,
        validatedConfig.backgroundMusic?.volume || 0,
        validatedConfig.backgroundMusic?.ducking?.enabled
      )

      // Simulate audio mixing process
      const mixedAudioUrl = await this.performAudioMix(
        voiceAudio,
        backgroundMusic,
        audioLevels,
        validatedConfig
      )

      // Update config with processing metadata
      await this.updateMixConfig(validatedConfig.id, {
        processedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        outputUrl: mixedAudioUrl
      })

      return {
        success: true,
        data: mixedAudioUrl,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['audio_mixer'],
          totalResults: 1
        }
      }

    } catch (error) {
      console.error('Audio mixing failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown audio mixing error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['audio_mixer']
        }
      }
    }
  }

  /**
   * Transcribe audio to text with word-level timing
   */
  async transcribeAudio(audioUrl: string, provider?: string): Promise<AudioResult<Transcription>> {
    const startTime = Date.now()
    const providersUsed: string[] = []

    try {
      // Select transcription provider
      const selectedProvider = this.selectTranscriptionProvider(provider)
      if (!selectedProvider || !selectedProvider.transcribe) {
        return {
          success: false,
          error: 'No transcription provider available',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed
          }
        }
      }

      providersUsed.push(selectedProvider.name)

      // Perform transcription
      const transcription = await selectedProvider.transcribe(audioUrl)

      // Optimize word timings
      const optimizedTimings = optimizeWordTimings(transcription.wordTimings)
      transcription.wordTimings = optimizedTimings

      // Extract sentence boundaries
      const sentences = extractSentenceBoundaries(transcription.fullText, optimizedTimings)
      transcription.sentences = sentences.map((sentence, index) => ({
        text: sentence.text,
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        confidence: 0.95, // Mock confidence
        words: [] // Would contain word indices in real implementation
      }))

      return {
        success: true,
        data: transcription,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed,
          totalResults: 1
        }
      }

    } catch (error) {
      console.error('Audio transcription failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown transcription error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed
        }
      }
    }
  }

  /**
   * Initialize audio and music providers
   */
  private initializeProviders(): void {
    // Initialize TTS providers
    this.ttsProviders.set('openai', {
      name: 'OpenAI TTS',
      generateTTS: async (request: TTSGenerationRequest): Promise<AudioFile> => {
        return this.createMockAudioFile('openai', request)
      }
    })

    this.ttsProviders.set('elevenlabs', {
      name: 'ElevenLabs',
      generateTTS: async (request: TTSGenerationRequest): Promise<AudioFile> => {
        return this.createMockAudioFile('elevenlabs', request)
      },
      transcribe: async (audioUrl: string): Promise<Transcription> => {
        return this.createMockTranscription(audioUrl)
      }
    })

    // Initialize music providers
    this.musicProviders.set('freesound', {
      name: 'Freesound',
      search: async (request: MusicSearchRequest): Promise<MusicSelection[]> => {
        return this.createMockMusicResults('freesound', request, 3)
      }
    })

    this.musicProviders.set('youtube_audio_library', {
      name: 'YouTube Audio Library',
      search: async (request: MusicSearchRequest): Promise<MusicSelection[]> => {
        return this.createMockMusicResults('youtube_audio_library', request, 4)
      }
    })
  }

  /**
   * Create mock audio file for testing
   */
  private createMockAudioFile(provider: string, request: TTSGenerationRequest): AudioFile {
    const duration = this.estimateSpeechDuration(request.text, request.voiceCharacteristics?.speed || 1)
    const wordCount = request.text.split(/\s+/).length
    
    return {
      id: crypto.randomUUID(),
      jobId: crypto.randomUUID(),
      scriptId: crypto.randomUUID(),
      text: request.text,
      audioUrl: `https://mock-${provider}.com/tts/${Date.now()}.mp3`,
      duration,
      format: 'mp3',
      sampleRate: 44100,
      channels: 1,
      provider: provider as any,
      voiceId: request.voiceId || 'default-voice',
      voiceName: `${provider} Default Voice`,
      voiceCharacteristics: {
        gender: request.voiceCharacteristics?.gender || 'neutral',
        style: request.voiceCharacteristics?.style || 'neutral',
        speed: request.voiceCharacteristics?.speed || 1,
        pitch: request.voiceCharacteristics?.pitch || 1,
        volume: 1
      },
      generationParams: {
        temperature: request.parameters?.temperature,
        stability: request.parameters?.stability,
        speakingRate: request.parameters?.speakingRate
      },
      quality: {
        overallScore: 0.85 + Math.random() * 0.1,
        clarity: 0.9,
        naturalness: 0.8,
        pronunciation: 0.95
      },
      generationTime: 2000 + Math.random() * 3000,
      cost: wordCount * 0.001, // $0.001 per word
      status: 'completed',
      generatedAt: new Date().toISOString()
    }
  }

  /**
   * Create mock music search results
   */
  private createMockMusicResults(provider: string, request: MusicSearchRequest, count: number): MusicSelection[] {
    return Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      jobId: request.jobId,
      title: `${request.mood} Track ${i + 1}`,
      artist: `${provider} Artist ${i + 1}`,
      genre: this.getMoodGenre(request.mood),
      mood: request.mood,
      audioUrl: `https://mock-${provider}.com/music/${request.mood}-${i + 1}.mp3`,
      duration: 60 + Math.random() * 180, // 1-4 minutes
      format: 'mp3',
      bpm: this.getMoodBPM(request.mood),
      license: 'royalty_free',
      provider: provider as any,
      usage: {
        startTime: 0,
        fadeInDuration: 1,
        fadeOutDuration: 1,
        volume: 0.3,
        loopIfNeeded: true
      },
      selectionReason: `Perfect ${request.mood} mood match`,
      moodMatch: Math.max(0.5, 0.95 - (i * 0.1)), // Deterministic decreasing scores starting from 0.95
      energyLevel: this.getMoodEnergyLevel(request.mood),
      selectedAt: new Date().toISOString()
    }))
  }

  /**
   * Create mock transcription
   */
  private createMockTranscription(audioUrl: string): Transcription {
    const mockText = "This is a mock transcription of the audio file."
    const words = mockText.split(' ')
    const wordTimings: WordTiming[] = words.map((word, index) => ({
      word,
      startTime: index * 0.5,
      endTime: (index + 1) * 0.5 - 0.1,
      confidence: 0.9 + Math.random() * 0.1
    }))

    return {
      id: crypto.randomUUID(),
      audioFileId: crypto.randomUUID(),
      fullText: mockText,
      wordTimings,
      confidence: 0.95,
      language: 'en',
      provider: 'openai_whisper',
      sentences: [],
      transcribedAt: new Date().toISOString(),
      processingTime: 1000 + Math.random() * 2000,
      validation: {
        textAccuracy: 0.95,
        timingAccuracy: 0.9,
        hasErrors: false,
        errorDetails: []
      }
    }
  }

  /**
   * Helper methods for audio processing
   */
  private estimateSpeechDuration(text: string, speed: number = 1): number {
    const wordCount = text.split(/\s+/).length
    const baseWPM = 150 // words per minute
    const adjustedWPM = baseWPM * speed
    return (wordCount / adjustedWPM) * 60 // convert to seconds
  }

  private getMoodGenre(mood: string): string {
    const moodGenres: Record<string, string> = {
      'upbeat': 'electronic',
      'calm': 'ambient',
      'dramatic': 'cinematic',
      'inspirational': 'orchestral',
      'funky': 'funk',
      'emotional': 'piano',
      'energetic': 'rock'
    }
    return moodGenres[mood] || 'ambient'
  }

  private getMoodBPM(mood: string): number {
    const moodBPMs: Record<string, number> = {
      'upbeat': 120 + Math.random() * 20,
      'calm': 60 + Math.random() * 20,
      'dramatic': 80 + Math.random() * 30,
      'inspirational': 100 + Math.random() * 20,
      'funky': 110 + Math.random() * 20,
      'emotional': 70 + Math.random() * 20,
      'energetic': 130 + Math.random() * 30
    }
    return Math.round(moodBPMs[mood] || 100)
  }

  private getMoodEnergyLevel(mood: string): number {
    const moodEnergy: Record<string, number> = {
      'upbeat': 0.8,
      'calm': 0.3,
      'dramatic': 0.7,
      'inspirational': 0.6,
      'funky': 0.7,
      'emotional': 0.4,
      'energetic': 0.9
    }
    return moodEnergy[mood] || 0.5
  }

  private selectTTSProvider(preferredProvider?: string): AudioProvider | null {
    if (preferredProvider && this.ttsProviders.has(preferredProvider)) {
      return this.ttsProviders.get(preferredProvider)!
    }
    
    // If preferred provider is specified but not found, return null
    if (preferredProvider && !this.ttsProviders.has(preferredProvider)) {
      return null
    }
    
    // Default to first available provider
    return Array.from(this.ttsProviders.values())[0] || null
  }

  private selectTranscriptionProvider(preferredProvider?: string): AudioProvider | null {
    if (preferredProvider && this.ttsProviders.has(preferredProvider)) {
      const provider = this.ttsProviders.get(preferredProvider)!
      if (provider.transcribe) return provider
    }
    
    // If preferred provider is specified but doesn't exist or support transcription, return null
    if (preferredProvider) {
      return null
    }
    
    // Find any provider with transcription capability
    for (const provider of this.ttsProviders.values()) {
      if (provider.transcribe) return provider
    }
    
    return null
  }

  private rankMusicByRelevance(music: MusicSelection[], request: MusicSearchRequest): MusicSelection[] {
    return music.sort((a, b) => {
      // Primary: mood match (descending order - higher scores first)
      const moodDiff = (b.moodMatch || 0) - (a.moodMatch || 0)
      if (Math.abs(moodDiff) > 0.05) return moodDiff
      
      // Secondary: energy level match (closer to requested energy is better)
      const requestedEnergy = request.videoContext?.energyLevel || 0.5
      const aEnergyDiff = Math.abs(a.energyLevel - requestedEnergy)
      const bEnergyDiff = Math.abs(b.energyLevel - requestedEnergy)
      
      return aEnergyDiff - bEnergyDiff
    })
  }

  private async getAudioFile(audioFileId: string): Promise<AudioFile | null> {
    // In real implementation, this would fetch from database
    // For now, return a mock audio file
    return {
      id: audioFileId,
      jobId: crypto.randomUUID(),
      scriptId: crypto.randomUUID(),
      text: "Mock audio file content",
      audioUrl: `https://mock-storage.com/audio/${audioFileId}.mp3`,
      duration: 30,
      format: 'mp3',
      sampleRate: 44100,
      channels: 1,
      provider: 'openai',
      voiceId: 'default-voice',
      voiceCharacteristics: {
        gender: 'neutral',
        style: 'neutral',
        speed: 1,
        pitch: 1,
        volume: 1
      },
      generationParams: {},
      quality: {
        overallScore: 0.9,
        clarity: 0.9,
        naturalness: 0.85,
        pronunciation: 0.95
      },
      generationTime: 2500,
      status: 'completed',
      generatedAt: new Date().toISOString()
    }
  }

  private async getMusicSelection(musicSelectionId: string): Promise<MusicSelection | null> {
    // In real implementation, this would fetch from database
    // For now, return a mock music selection
    return {
      id: musicSelectionId,
      jobId: crypto.randomUUID(),
      title: "Mock Background Music",
      artist: "Mock Artist",
      genre: "ambient",
      mood: "calm",
      audioUrl: `https://mock-storage.com/music/${musicSelectionId}.mp3`,
      duration: 120,
      format: 'mp3',
      license: 'royalty_free',
      provider: 'freesound',
      usage: {
        startTime: 0,
        fadeInDuration: 1,
        fadeOutDuration: 1,
        volume: 0.3,
        loopIfNeeded: true
      },
      selectionReason: "Perfect ambient background",
      moodMatch: 0.9,
      energyLevel: 0.3,
      selectedAt: new Date().toISOString()
    }
  }

  private async performAudioMix(
    voiceAudio: AudioFile,
    backgroundMusic: MusicSelection | null,
    audioLevels: { voiceLevel: number; musicLevel: number },
    config: AudioMixConfig
  ): Promise<string> {
    // Simulate audio mixing process
    // In real implementation, this would use FFmpeg or similar
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate processing time
    
    const mixId = crypto.randomUUID()
    return `https://mock-storage.com/mixed-audio/${mixId}.mp3`
  }

  private async updateMixConfig(configId: string, updates: any): Promise<void> {
    // In real implementation, this would update the database
    console.log(`Updated mix config ${configId}:`, updates)
  }

  /**
   * Cache management
   */
  private createCacheKey(operation: string, request: any): string {
    return `${operation}:${JSON.stringify(request)}`
  }

  private getCachedResult(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiry) {
      return cached.data
    }
    
    if (cached) {
      this.cache.delete(key)
    }
    
    return null
  }

  private setCachedResult(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    })
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    ttsProvidersCount: number
    musicProvidersCount: number
    cacheSize: number
    ttsProviders: string[]
    musicProviders: string[]
  } {
    return {
      ttsProvidersCount: this.ttsProviders.size,
      musicProvidersCount: this.musicProviders.size,
      cacheSize: this.cache.size,
      ttsProviders: Array.from(this.ttsProviders.keys()),
      musicProviders: Array.from(this.musicProviders.keys())
    }
  }
}