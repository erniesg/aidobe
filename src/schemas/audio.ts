import { z } from 'zod'

// Word-level timing schema for precise synchronization
export const WordTimingSchema = z.object({
  word: z.string(),
  startTime: z.number().min(0), // seconds
  endTime: z.number().min(0), // seconds
  confidence: z.number().min(0).max(1).optional() // TTS confidence
})

export type WordTiming = z.infer<typeof WordTimingSchema>

// Audio file schema for TTS results
export const AudioFileSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  scriptId: z.string().uuid(),
  
  // Audio content
  text: z.string().min(1).max(5000),
  audioUrl: z.string().url(),
  localPath: z.string().optional(),
  
  // Audio properties
  duration: z.number().min(0.1), // seconds
  format: z.enum(['mp3', 'wav', 'ogg', 'aac']).default('mp3'),
  sampleRate: z.number().int().positive().default(44100), // Hz
  bitrate: z.number().int().positive().optional(), // kbps
  channels: z.number().int().min(1).max(2).default(1), // mono/stereo
  fileSize: z.number().int().positive().optional(), // bytes
  
  // TTS provider information
  provider: z.enum(['openai', 'elevenlabs', 'google', 'azure', 'aws_polly']),
  voiceId: z.string(),
  voiceName: z.string().optional(),
  model: z.string().optional(),
  
  // Voice characteristics
  voiceCharacteristics: z.object({
    gender: z.enum(['male', 'female', 'neutral']).optional(),
    age: z.enum(['child', 'young_adult', 'adult', 'elderly']).optional(),
    accent: z.string().optional(), // 'american', 'british', 'australian', etc.
    style: z.enum(['neutral', 'conversational', 'energetic', 'calm', 'dramatic']).optional(),
    speed: z.number().min(0.5).max(2).default(1), // playback speed multiplier
    pitch: z.number().min(0.5).max(2).default(1), // pitch multiplier
    volume: z.number().min(0).max(1).default(1) // volume level
  }).default({}),
  
  // Generation parameters
  generationParams: z.object({
    temperature: z.number().min(0).max(1).optional(),
    stability: z.number().min(0).max(1).optional(),
    similarityBoost: z.number().min(0).max(1).optional(),
    speakingRate: z.number().min(0.25).max(4).optional(),
    customInstructions: z.string().optional()
  }).default({}),
  
  // Quality metrics
  quality: z.object({
    overallScore: z.number().min(0).max(1).optional(),
    clarity: z.number().min(0).max(1).optional(),
    naturalness: z.number().min(0).max(1).optional(),
    pronunciation: z.number().min(0).max(1).optional(),
    emotionalFit: z.number().min(0).max(1).optional()
  }).default({}),
  
  // Processing metadata
  generationTime: z.number().positive(), // milliseconds
  cost: z.number().positive().optional(), // USD
  retryCount: z.number().int().min(0).default(0),
  
  // Status and timestamps
  status: z.enum(['generating', 'completed', 'failed', 'processing']).default('generating'),
  error: z.string().optional(),
  generatedAt: z.string().datetime(),
  processedAt: z.string().datetime().optional()
})

export type AudioFile = z.infer<typeof AudioFileSchema>

// Transcription schema with word-level timing
export const TranscriptionSchema = z.object({
  id: z.string().uuid(),
  audioFileId: z.string().uuid(),
  
  // Transcription content
  fullText: z.string(),
  wordTimings: z.array(WordTimingSchema),
  
  // Transcription metadata
  confidence: z.number().min(0).max(1),
  language: z.string().default('en'),
  provider: z.enum(['openai_whisper', 'google_speech', 'azure_speech', 'aws_transcribe']),
  model: z.string().optional(),
  
  // Sentence and phrase level timing
  sentences: z.array(z.object({
    text: z.string(),
    startTime: z.number().min(0),
    endTime: z.number().min(0),
    confidence: z.number().min(0).max(1).optional(),
    words: z.array(z.number().int().min(0)) // indices into wordTimings array
  })).default([]),
  
  // Processing info
  transcribedAt: z.string().datetime(),
  processingTime: z.number().positive(), // milliseconds
  
  // Quality validation
  validation: z.object({
    textAccuracy: z.number().min(0).max(1).optional(),
    timingAccuracy: z.number().min(0).max(1).optional(),
    hasErrors: z.boolean().default(false),
    errorDetails: z.array(z.string()).default([])
  }).default({})
})

export type Transcription = z.infer<typeof TranscriptionSchema>

// Music selection schema for background music
export const MusicSelectionSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  
  // Music file information
  title: z.string(),
  artist: z.string().optional(),
  album: z.string().optional(),
  genre: z.string().optional(),
  mood: z.enum(['upbeat', 'calm', 'dramatic', 'inspirational', 'funky', 'emotional', 'energetic']),
  
  // File properties
  audioUrl: z.string().url(),
  localPath: z.string().optional(),
  duration: z.number().min(1), // seconds
  format: z.enum(['mp3', 'wav', 'ogg', 'aac']).default('mp3'),
  bpm: z.number().int().min(60).max(200).optional(), // beats per minute
  key: z.string().optional(), // musical key (C, D, E, etc.)
  
  // Licensing and attribution
  license: z.enum(['royalty_free', 'creative_commons', 'licensed', 'custom']),
  attribution: z.string().optional(),
  licenseUrl: z.string().url().optional(),
  provider: z.enum(['freesound', 'youtube_audio_library', 'epidemic_sound', 'custom']),
  
  // Usage configuration
  usage: z.object({
    startTime: z.number().min(0).default(0), // where to start in the music file
    fadeInDuration: z.number().min(0).max(5).default(1), // seconds
    fadeOutDuration: z.number().min(0).max(5).default(1), // seconds
    volume: z.number().min(0).max(1).default(0.3), // background volume level
    loopIfNeeded: z.boolean().default(true) // loop if video is longer than music
  }).default({}),
  
  // Selection reasoning
  selectionReason: z.string(),
  moodMatch: z.number().min(0).max(1), // how well it matches the video mood
  energyLevel: z.number().min(0).max(1), // energy level compatibility
  
  selectedAt: z.string().datetime(),
  selectedBy: z.string().optional() // user ID or 'system'
})

export type MusicSelection = z.infer<typeof MusicSelectionSchema>

// Audio mix configuration schema for final audio assembly
export const AudioMixConfigSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  
  // Main components
  voiceAudio: z.object({
    audioFileId: z.string().uuid(),
    volume: z.number().min(0).max(1).default(1),
    fadeIn: z.number().min(0).max(2).default(0),
    fadeOut: z.number().min(0).max(2).default(0),
    normalization: z.boolean().default(true), // normalize volume levels
    compression: z.object({
      enabled: z.boolean().default(false),
      threshold: z.number().min(-60).max(0).default(-12), // dB
      ratio: z.number().min(1).max(20).default(3)
    }).default({})
  }),
  
  backgroundMusic: z.object({
    musicSelectionId: z.string().uuid().optional(),
    volume: z.number().min(0).max(1).default(0.2),
    fadeIn: z.number().min(0).max(5).default(1),
    fadeOut: z.number().min(0).max(5).default(1),
    ducking: z.object({
      enabled: z.boolean().default(true), // lower music when voice is present
      reduction: z.number().min(0).max(1).default(0.6), // how much to reduce
      attackTime: z.number().min(0.01).max(1).default(0.1), // seconds
      releaseTime: z.number().min(0.1).max(5).default(0.5) // seconds
    }).default({})
  }).optional(),
  
  // Sound effects (optional)
  soundEffects: z.array(z.object({
    id: z.string().uuid(),
    audioUrl: z.string().url(),
    startTime: z.number().min(0), // when to play in the final mix
    volume: z.number().min(0).max(1).default(0.5),
    fadeIn: z.number().min(0).max(2).default(0),
    fadeOut: z.number().min(0).max(2).default(0),
    description: z.string().optional()
  })).default([]),
  
  // Global mix settings
  globalSettings: z.object({
    masterVolume: z.number().min(0).max(1).default(1),
    finalFormat: z.enum(['mp3', 'wav', 'aac']).default('mp3'),
    sampleRate: z.number().int().positive().default(44100),
    bitrate: z.number().int().positive().default(192), // kbps
    channels: z.number().int().min(1).max(2).default(2), // stereo output
    
    // Audio processing
    normalization: z.boolean().default(true),
    limiter: z.object({
      enabled: z.boolean().default(true),
      threshold: z.number().min(-10).max(0).default(-1), // dB
      release: z.number().min(0.01).max(1).default(0.05) // seconds
    }).default({}),
    
    // Noise reduction
    noiseReduction: z.object({
      enabled: z.boolean().default(true),
      strength: z.number().min(0).max(1).default(0.3)
    }).default({})
  }).default({}),
  
  // Output specifications
  outputDuration: z.number().min(1), // target duration in seconds
  
  // Processing metadata
  createdAt: z.string().datetime(),
  processedAt: z.string().datetime().optional(),
  processingTime: z.number().positive().optional(), // milliseconds
  outputUrl: z.string().url().optional(),
  outputPath: z.string().optional()
})

export type AudioMixConfig = z.infer<typeof AudioMixConfigSchema>

// Audio generation request schema
export const AudioGenerationRequestSchema = z.object({
  jobId: z.string().uuid(),
  scriptId: z.string().uuid(),
  text: z.string().min(1).max(5000),
  
  // Voice preferences
  voicePreferences: z.object({
    provider: z.enum(['openai', 'elevenlabs', 'google', 'azure', 'aws_polly']).optional(),
    voiceId: z.string().optional(),
    gender: z.enum(['male', 'female', 'neutral']).optional(),
    age: z.enum(['child', 'young_adult', 'adult', 'elderly']).optional(),
    accent: z.string().optional(),
    style: z.enum(['neutral', 'conversational', 'energetic', 'calm', 'dramatic']).optional()
  }).optional(),
  
  // Generation parameters
  parameters: z.object({
    speed: z.number().min(0.5).max(2).default(1),
    pitch: z.number().min(0.5).max(2).default(1),
    volume: z.number().min(0).max(1).default(1),
    temperature: z.number().min(0).max(1).optional(),
    stability: z.number().min(0).max(1).optional()
  }).default({}),
  
  // Output requirements
  outputFormat: z.enum(['mp3', 'wav', 'ogg', 'aac']).default('mp3'),
  includeWordTimings: z.boolean().default(true),
  targetDuration: z.number().min(5).max(120).optional() // seconds
})

export type AudioGenerationRequest = z.infer<typeof AudioGenerationRequestSchema>

// Music search request schema
export const MusicSearchRequestSchema = z.object({
  jobId: z.string().uuid(),
  
  // Search criteria
  mood: z.enum(['upbeat', 'calm', 'dramatic', 'inspirational', 'funky', 'emotional', 'energetic']),
  genre: z.string().optional(),
  duration: z.object({
    min: z.number().min(1).default(30),
    max: z.number().min(1).default(300)
  }).default({}),
  bpm: z.object({
    min: z.number().int().min(60).optional(),
    max: z.number().int().max(200).optional()
  }).optional(),
  
  // Context from video
  videoContext: z.object({
    totalDuration: z.number().min(1),
    energyLevel: z.number().min(0).max(1), // overall energy of the video
    keyMoments: z.array(z.object({
      time: z.number().min(0),
      description: z.string(),
      intensity: z.number().min(0).max(1)
    })).default([])
  }).optional(),
  
  // Licensing requirements
  licenseType: z.enum(['royalty_free', 'creative_commons', 'any']).default('royalty_free'),
  maxResults: z.number().int().min(1).max(20).default(10)
})

export type MusicSearchRequest = z.infer<typeof MusicSearchRequestSchema>

// Validation functions
export function validateAudioDuration(
  expectedDuration: number, 
  actualDuration: number, 
  tolerance: number = 0.5
): boolean {
  return Math.abs(expectedDuration - actualDuration) <= tolerance
}

export function calculateSpeechRate(text: string, duration: number): number {
  const wordCount = text.trim().split(/\s+/).length
  return (wordCount / duration) * 60 // words per minute
}

export function validateSpeechRate(text: string, duration: number): {
  valid: boolean
  rate: number
  recommendation: string
} {
  const rate = calculateSpeechRate(text, duration)
  
  // Optimal range for TikTok: 140-180 WPM
  if (rate >= 140 && rate <= 180) {
    return { valid: true, rate, recommendation: 'Optimal speech rate' }
  } else if (rate < 140) {
    return { valid: false, rate, recommendation: 'Speech rate too slow, consider shortening pauses or increasing speed' }
  } else {
    return { valid: false, rate, recommendation: 'Speech rate too fast, consider adding pauses or reducing speed' }
  }
}

export function optimizeWordTimings(wordTimings: WordTiming[]): WordTiming[] {
  // Ensure no overlaps and smooth transitions
  return wordTimings.map((timing, index) => {
    const nextTiming = wordTimings[index + 1]
    
    // If there's a gap or overlap with the next word, adjust
    if (nextTiming && timing.endTime >= nextTiming.startTime) {
      const midpoint = (timing.endTime + nextTiming.startTime) / 2
      return {
        ...timing,
        endTime: midpoint
      }
    }
    
    return timing
  })
}

export function extractSentenceBoundaries(
  text: string, 
  wordTimings: WordTiming[]
): Array<{text: string, startTime: number, endTime: number}> {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const result: Array<{text: string, startTime: number, endTime: number}> = []
  
  let wordIndex = 0
  
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/)
    const startTime = wordTimings[wordIndex]?.startTime || 0
    
    // Find the end time of the last word in this sentence
    let endTime = startTime
    for (let i = 0; i < sentenceWords.length && wordIndex < wordTimings.length; i++) {
      endTime = wordTimings[wordIndex].endTime
      wordIndex++
    }
    
    result.push({
      text: sentence.trim(),
      startTime,
      endTime
    })
  }
  
  return result
}

export function calculateAudioLevels(
  voiceVolume: number,
  musicVolume: number,
  duckingEnabled: boolean = true
): {voiceLevel: number, musicLevel: number} {
  const voiceLevel = Math.min(1, Math.max(0, voiceVolume))
  let musicLevel = Math.min(1, Math.max(0, musicVolume))
  
  // Apply ducking - reduce music when voice is present
  if (duckingEnabled && voiceLevel > 0) {
    musicLevel = musicLevel * (1 - voiceLevel * 0.6) // Reduce by up to 60%
  }
  
  return { voiceLevel, musicLevel }
}

export function detectAudioQualityIssues(audioFile: AudioFile): string[] {
  const issues: string[] = []
  
  // Check duration mismatch
  const expectedDuration = calculateSpeechRate(audioFile.text, audioFile.duration)
  if (expectedDuration < 100 || expectedDuration > 200) {
    issues.push(`Unusual speech rate: ${expectedDuration.toFixed(1)} WPM`)
  }
  
  // Check file size
  if (audioFile.fileSize && audioFile.duration) {
    const kbps = (audioFile.fileSize * 8) / (audioFile.duration * 1000)
    if (kbps < 64) {
      issues.push('Low audio quality: bitrate appears too low')
    }
  }
  
  // Check quality scores
  if (audioFile.quality.clarity && audioFile.quality.clarity < 0.7) {
    issues.push('Low clarity score detected')
  }
  
  if (audioFile.quality.naturalness && audioFile.quality.naturalness < 0.6) {
    issues.push('Unnatural speech detected')
  }
  
  return issues
}