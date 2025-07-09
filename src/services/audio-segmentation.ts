import type { WordTiming } from '../schemas/audio'
import type { Env } from '../types/env'

export interface TTSRequest {
  script: string
  provider?: 'elevenlabs' | 'openai'
  voiceId: string
  voiceSettings?: {
    stability?: number
    similarity?: number
    speed?: number
    temperature?: number
  }
  outputFormat: 'mp3' | 'wav' | 'ogg'
}

export interface TTSResult {
  audioUrl: string
  duration: number
  script: string
  provider: string
  voiceId: string
  generatedAt: string
}

export interface TranscriptionRequest {
  audioUrl: string
  provider?: 'openai_whisper' | 'elevenlabs'
  language?: string
}

export interface TranscriptionResult {
  fullText: string
  wordTimings: WordTiming[]
  duration: number
  confidence: number
  provider: string
  processedAt: string
}

export interface AudioExtractionRange {
  sceneId: string
  startTime: number
  endTime: number
  purpose: 'avatar' | 'regular'
  text: string
}

export interface AudioSegmentationRequest {
  fullAudioUrl: string
  extractionRanges: AudioExtractionRange[]
  wordTimings: WordTiming[]
  fullTranscript: string
}

export interface AudioSegment {
  sceneId: string
  audioUrl: string
  transcript: string
  duration: number
  purpose: 'avatar' | 'regular'
  wordTimings: WordTiming[]
  startTime: number
  endTime: number
}

export interface AudioSegmentationResult {
  segments: AudioSegment[]
  totalDuration: number
  processedAt: string
}

export interface FullWorkflowRequest {
  script: string
  sceneRanges: AudioExtractionRange[]
  voiceSettings: {
    provider: 'elevenlabs' | 'openai'
    voiceId: string
    stability?: number
    similarity?: number
    speed?: number
    temperature?: number
  }
  outputFormat: 'mp3' | 'wav' | 'ogg'
}

export interface FullWorkflowResult {
  fullAudioUrl: string
  transcription: TranscriptionResult
  segments: AudioSegment[]
  totalDuration: number
  processedAt: string
}

export interface PerformanceMetrics {
  totalRequests: number
  cacheHitRate: number
  averageProcessingTime: number
  providerBreakdown: {
    tts: Record<string, number>
    transcription: Record<string, number>
  }
}

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    executionTime: number
    cached?: boolean
    retryCount?: number
  }
}

export class AudioSegmentationService {
  private readonly cache = new Map<string, any>()
  private readonly metrics: PerformanceMetrics = {
    totalRequests: 0,
    cacheHitRate: 0,
    averageProcessingTime: 0,
    providerBreakdown: {
      tts: {},
      transcription: {},
    },
  }

  constructor(private env: Env) {}

  /**
   * Generate full audio from script using TTS
   */
  async generateFullAudio(request: TTSRequest): Promise<ServiceResult<TTSResult>> {
    const startTime = Date.now()

    try {
      // Validate input
      if (!request.script || request.script.trim().length === 0) {
        return {
          success: false,
          error: 'Script cannot be empty',
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      if (!['mp3', 'wav', 'ogg'].includes(request.outputFormat)) {
        return {
          success: false,
          error: 'Unsupported audio format',
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      // Check cache
      const cacheKey = this.getCacheKey('tts', request)
      if (this.cache.has(cacheKey)) {
        this.metrics.cacheHitRate++
        return {
          success: true,
          data: this.cache.get(cacheKey),
          metadata: { executionTime: Date.now() - startTime, cached: true },
        }
      }

      // Generate audio based on provider
      const provider = request.provider || 'elevenlabs'
      let audioData: ArrayBuffer

      if (provider === 'elevenlabs') {
        audioData = await this.generateElevenLabsAudio(request)
      } else if (provider === 'openai') {
        audioData = await this.generateOpenAIAudio(request)
      } else {
        return {
          success: false,
          error: `Unsupported TTS provider: ${provider}`,
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      // Upload to storage and get URL
      const audioUrl = await this.uploadAudioToStorage(audioData, request.outputFormat)

      // Estimate duration (in real implementation, would analyze audio)
      const duration = this.estimateAudioDuration(request.script)

      const result: TTSResult = {
        audioUrl,
        duration,
        script: request.script,
        provider,
        voiceId: request.voiceId,
        generatedAt: new Date().toISOString(),
      }

      // Cache result
      this.cache.set(cacheKey, result)
      this.metrics.totalRequests++
      this.metrics.providerBreakdown.tts[provider] =
        (this.metrics.providerBreakdown.tts[provider] || 0) + 1

      return {
        success: true,
        data: result,
        metadata: { executionTime: Date.now() - startTime },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTime: Date.now() - startTime },
      }
    }
  }

  /**
   * Transcribe audio with word-level timing
   */
  async transcribeAudio(
    request: TranscriptionRequest
  ): Promise<ServiceResult<TranscriptionResult>> {
    const startTime = Date.now()

    try {
      // Validate audio URL
      if (!this.isValidUrl(request.audioUrl)) {
        return {
          success: false,
          error: 'Invalid audio URL',
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      // Check cache
      const cacheKey = this.getCacheKey('transcription', request)
      if (this.cache.has(cacheKey)) {
        this.metrics.cacheHitRate++
        return {
          success: true,
          data: this.cache.get(cacheKey),
          metadata: { executionTime: Date.now() - startTime, cached: true },
        }
      }

      const provider = request.provider || 'openai_whisper'
      let transcriptionData: any

      if (provider === 'openai_whisper') {
        transcriptionData = await this.transcribeWithWhisper(request)
      } else {
        return {
          success: false,
          error: `Unsupported transcription provider: ${provider}`,
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      // Convert to our format
      const wordTimings: WordTiming[] = transcriptionData.words.map((word: any) => ({
        word: word.word,
        startTime: word.start,
        endTime: word.end,
      }))

      const result: TranscriptionResult = {
        fullText: transcriptionData.text,
        wordTimings,
        duration: wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime : 0,
        confidence: 0.9, // Mock confidence
        provider,
        processedAt: new Date().toISOString(),
      }

      // Cache result
      this.cache.set(cacheKey, result)
      this.metrics.totalRequests++
      this.metrics.providerBreakdown.transcription[provider] =
        (this.metrics.providerBreakdown.transcription[provider] || 0) + 1

      return {
        success: true,
        data: result,
        metadata: { executionTime: Date.now() - startTime },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTime: Date.now() - startTime },
      }
    }
  }

  /**
   * Extract audio segments from full audio
   */
  async extractAudioSegments(
    request: AudioSegmentationRequest
  ): Promise<ServiceResult<AudioSegmentationResult>> {
    const startTime = Date.now()

    try {
      // Validate extraction ranges
      for (const range of request.extractionRanges) {
        if (range.startTime >= range.endTime) {
          return {
            success: false,
            error: 'Invalid time range: start time must be before end time',
            metadata: { executionTime: Date.now() - startTime },
          }
        }
      }

      // Extract all audio segments in a single API call
      const extractionResponse = await this.extractAllAudioSegments(
        request.fullAudioUrl,
        request.extractionRanges
      )

      // Process results into our format
      const segments: AudioSegment[] = []

      for (const range of request.extractionRanges) {
        // Find the corresponding extracted segment
        const extractedSegment = extractionResponse.segments.find(
          (s: any) => s.sceneId === range.sceneId
        )

        if (!extractedSegment) {
          throw new Error(`Failed to extract segment for scene: ${range.sceneId}`)
        }

        // Get word timings for this segment
        const segmentWordTimings = this.getWordTimingsForRange(
          request.wordTimings,
          range.startTime,
          range.endTime
        )

        segments.push({
          sceneId: range.sceneId,
          audioUrl: extractedSegment.audioUrl,
          transcript: range.text,
          duration: Math.round((range.endTime - range.startTime) * 10) / 10, // Round to 1 decimal place
          purpose: range.purpose,
          wordTimings: segmentWordTimings,
          startTime: range.startTime,
          endTime: range.endTime,
        })
      }

      const result: AudioSegmentationResult = {
        segments,
        totalDuration: Math.max(...request.extractionRanges.map((r) => r.endTime)),
        processedAt: new Date().toISOString(),
      }

      return {
        success: true,
        data: result,
        metadata: { executionTime: Date.now() - startTime },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTime: Date.now() - startTime },
      }
    }
  }

  /**
   * Process complete workflow: TTS → Transcription → Segmentation
   */
  async processFullWorkflow(
    request: FullWorkflowRequest
  ): Promise<ServiceResult<FullWorkflowResult>> {
    const startTime = Date.now()

    try {
      // Step 1: Generate full audio
      const ttsResult = await this.generateFullAudio({
        script: request.script,
        provider: request.voiceSettings.provider,
        voiceId: request.voiceSettings.voiceId,
        voiceSettings: request.voiceSettings,
        outputFormat: request.outputFormat,
      })

      if (!ttsResult.success) {
        return {
          success: false,
          error: ttsResult.error,
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      // Step 2: Transcribe audio
      const transcriptionResult = await this.transcribeAudio({
        audioUrl: ttsResult.data!.audioUrl,
        provider: 'openai_whisper',
      })

      if (!transcriptionResult.success) {
        return {
          success: false,
          error: transcriptionResult.error,
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      // Step 3: Extract audio segments
      const segmentationResult = await this.extractAudioSegments({
        fullAudioUrl: ttsResult.data!.audioUrl,
        extractionRanges: request.sceneRanges,
        wordTimings: transcriptionResult.data!.wordTimings,
        fullTranscript: transcriptionResult.data!.fullText,
      })

      if (!segmentationResult.success) {
        return {
          success: false,
          error: segmentationResult.error,
          metadata: { executionTime: Date.now() - startTime },
        }
      }

      const result: FullWorkflowResult = {
        fullAudioUrl: ttsResult.data!.audioUrl,
        transcription: transcriptionResult.data!,
        segments: segmentationResult.data!.segments,
        totalDuration: segmentationResult.data!.totalDuration,
        processedAt: new Date().toISOString(),
      }

      return {
        success: true,
        data: result,
        metadata: { executionTime: Date.now() - startTime },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { executionTime: Date.now() - startTime },
      }
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return { ...this.metrics }
  }

  /**
   * Private helper methods
   */

  private async generateElevenLabsAudio(request: TTSRequest): Promise<ArrayBuffer> {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + request.voiceId, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.env.ARGIL_API_KEY, // Using as ElevenLabs key for testing
      },
      body: JSON.stringify({
        text: request.script,
        voice_settings: request.voiceSettings || {},
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.arrayBuffer()
  }

  private async generateOpenAIAudio(request: TTSRequest): Promise<ArrayBuffer> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: request.script,
        voice: request.voiceId,
        response_format: request.outputFormat,
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.arrayBuffer()
  }

  private async transcribeWithWhisper(request: TranscriptionRequest): Promise<any> {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: request.audioUrl,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  }

  private async extractAllAudioSegments(
    fullAudioUrl: string,
    extractionRanges: AudioExtractionRange[]
  ): Promise<{ segments: Array<{ sceneId: string; audioUrl: string; duration: number }> }> {
    // Mock audio extraction - in real implementation would use FFmpeg
    const response = await fetch('/api/audio/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioUrl: fullAudioUrl,
        ranges: extractionRanges.map((range) => ({
          sceneId: range.sceneId,
          startTime: range.startTime,
          endTime: range.endTime,
        })),
      }),
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as any
      throw new Error(error.error || 'Audio processing failed')
    }

    const result = (await response.json()) as {
      segments: Array<{ sceneId: string; audioUrl: string; duration: number }>
    }

    // Return the segments directly
    return result
  }

  private getWordTimingsForRange(
    wordTimings: WordTiming[],
    startTime: number,
    endTime: number
  ): WordTiming[] {
    return wordTimings
      .filter((timing) => timing.startTime >= startTime && timing.endTime <= endTime)
      .map((timing) => ({
        ...timing,
        startTime: timing.startTime - startTime, // Adjust to segment start
        endTime: timing.endTime - startTime,
      }))
  }

  private async uploadAudioToStorage(audioData: ArrayBuffer, format: string): Promise<string> {
    // Mock upload - in real implementation would upload to R2/S3
    const filename = `generated-audio-${Date.now()}.${format}`
    return `https://mock-storage.com/audio/${filename}`
  }

  private estimateAudioDuration(script: string): number {
    // Rough estimation: ~150 words per minute
    const words = script.split(' ').length
    return (words / 150) * 60
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private getCacheKey(type: string, request: any): string {
    return `${type}-${JSON.stringify(request)}`
  }
}
