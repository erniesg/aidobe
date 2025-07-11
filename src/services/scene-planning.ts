import type { Env } from '../types/env'
import { 
  ScenePlanSchema, 
  SceneSchema, 
  ExtractScenesRequestSchema,
  type ScenePlan, 
  type Scene,
  type ExtractScenesRequest
} from '../schemas/scene'
import { 
  VideoStructureSchema,
  ScriptSegmentSchema,
  type VideoStructure
} from '../schemas/script'

// Wanx-style script structure for compatibility
export interface WanxScript {
  video_structure: {
    title: string
    duration: string | number
    throughline: string
    target_audience?: string
  }
  script_segments: {
    hook: {
      order_id: number
      voiceover: string
      visual_direction: string
      b_roll_keywords: string[]
    }
    conflict: {
      order_id: number
      voiceover: string
      visual_direction: string
      b_roll_keywords: string[]
    }
    body: {
      order_id: number
      voiceover: string
      visual_direction: string
      b_roll_keywords: string[]
    }
    conclusion: {
      order_id: number
      voiceover: string
      visual_direction: string
      b_roll_keywords: string[]
    }
  }
  production_notes?: {
    music_vibe?: string
    overall_tone?: string
  }
}

export interface TranscriptionData {
  wordTimings: Array<{
    word: string
    start: number
    end: number
    confidence?: number
  }>
  fullText: string
  totalDuration: number
}

export interface ScenePlanningPreferences {
  averageSceneDuration?: number
  preferredAssetTypes?: Array<'AVATAR' | 'STOCK_VIDEO' | 'STOCK_IMAGE'>
  includeTransitions?: boolean
  targetSceneCount?: number
  extractionStrategy?: 'automatic' | 'sentence_based' | 'paragraph_based' | 'semantic_breaks'
}

export class ScenePlanningService {
  constructor(private env: Env) {}

  /**
   * Generate detailed scene plan from script segments with timing extraction
   */
  async generateScenePlan(
    script: WanxScript,
    transcription?: TranscriptionData,
    preferences: ScenePlanningPreferences = {}
  ): Promise<ScenePlan> {
    const {
      averageSceneDuration = 5,
      preferredAssetTypes = ['STOCK_VIDEO', 'STOCK_IMAGE'],
      includeTransitions = true,
      extractionStrategy = 'automatic'
    } = preferences

    // Extract target duration
    const targetDurationStr = script.video_structure.duration
    const targetDuration = typeof targetDurationStr === 'number' 
      ? targetDurationStr 
      : parseInt(targetDurationStr.replace(/[^\d]/g, '')) || 60

    // Build scenes from script segments
    const scenes = await this.extractScenesFromScript(
      script,
      targetDuration,
      transcription,
      preferences
    )

    // Calculate total duration
    const totalDuration = scenes.length > 0 
      ? Math.max(...scenes.map(s => s.timing.endTime))
      : 0

    // Create scene plan
    const scenePlan: ScenePlan = {
      id: crypto.randomUUID(),
      jobId: crypto.randomUUID(), // Would be passed from job context
      scriptId: crypto.randomUUID(), // Would be the source script ID
      title: script.video_structure.title,
      totalDuration,
      sceneCount: scenes.length,
      scenes,
      globalSettings: {
        aspectRatio: '9:16',
        resolution: {
          width: 1080,
          height: 1920
        },
        frameRate: 30,
        defaultCaptionStyle: {
          fontSize: 24,
          fontFamily: 'Arial Black',
          color: '#FFFFFF',
          position: 'bottom',
          shadow: true
        },
        defaultTransition: {
          type: 'fade',
          duration: includeTransitions ? 0.3 : 0
        }
      },
      validation: {
        timingValid: this.validateSceneTiming(scenes),
        allAssetsAvailable: false, // Would be checked by asset service
        durationMatches: Math.abs(totalDuration - targetDuration) <= 5,
        issuesFound: []
      },
      approval: {
        status: 'draft',
        version: 1
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return scenePlan
  }

  /**
   * Extract scenes from wanx-style script structure
   */
  private async extractScenesFromScript(
    script: WanxScript,
    targetDuration: number,
    transcription?: TranscriptionData,
    preferences: ScenePlanningPreferences = {}
  ): Promise<Scene[]> {
    const segments = script.script_segments
    const segmentKeys = ['hook', 'conflict', 'body', 'conclusion'] as const
    
    let currentTime = 0
    const scenes: Scene[] = []

    // Calculate total word count for proportional timing
    const totalWordCount = Object.values(segments).reduce((total, segment) => {
      return total + (segment?.voiceover?.split(' ').length || 0)
    }, 0)

    for (let i = 0; i < segmentKeys.length; i++) {
      const segmentKey = segmentKeys[i]
      const segment = segments[segmentKey]
      
      if (!segment) continue

      // Calculate timing based on word count and transcription
      const timing = this.calculateSceneTiming(
        segment.voiceover,
        totalWordCount,
        targetDuration,
        transcription,
        currentTime
      )

      // Determine visual type and asset suggestions
      const visualType = this.determineVisualType(
        segment.visual_direction,
        preferences.preferredAssetTypes || []
      )

      // Extract visual keywords from both b_roll_keywords and visual_direction
      const visualKeywords = this.extractVisualKeywords(
        segment.b_roll_keywords,
        segment.visual_direction,
        segment.voiceover
      )

      // Create scene object
      const scene: Scene = {
        id: crypto.randomUUID(),
        jobId: crypto.randomUUID(), // Would be passed from context
        scriptId: crypto.randomUUID(), // Would be the source script ID
        sequenceNumber: i + 1,
        title: `${segmentKey.charAt(0).toUpperCase() + segmentKey.slice(1)} Scene`,
        type: this.mapSegmentTypeToSceneType(segmentKey),
        textContent: segment.voiceover,
        visualKeywords,
        mood: this.inferMoodFromSegment(segmentKey, segment.voiceover),
        timing: {
          startTime: timing.startTime,
          duration: timing.duration,
          endTime: timing.endTime,
          fadeIn: i === 0 ? 0.5 : 0, // Fade in only for first scene
          fadeOut: i === segmentKeys.length - 1 ? 0.5 : 0 // Fade out only for last scene
        },
        primaryAsset: undefined, // Will be populated by asset discovery
        secondaryAssets: [],
        audioSegment: {
          startOffset: timing.startTime,
          duration: timing.duration,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0
        },
        captions: [], // Will be populated by caption generation
        effects: [], // Will be populated by effects service
        metadata: {
          generatedAt: new Date().toISOString(),
          sourceText: segment.voiceover,
          extractionMethod: 'automatic',
          confidence: 0.8,
          reviewStatus: 'pending'
        },
        overrides: {
          assetOverridden: false,
          timingOverridden: false,
          effectsOverridden: false
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      scenes.push(scene)
      currentTime = timing.endTime
    }

    return scenes
  }

  /**
   * Calculate scene timing based on word count and speaking rate
   */
  private calculateSceneTiming(
    voiceover: string,
    totalWordCount: number,
    targetDuration: number,
    transcription?: TranscriptionData,
    currentTime: number = 0
  ): { startTime: number; duration: number; endTime: number } {
    const wordCount = voiceover.split(' ').length
    
    // Use transcription data if available for more accurate timing
    if (transcription && transcription.wordTimings.length > 0) {
      // Calculate based on actual speech timing
      const avgWordsPerSecond = transcription.wordTimings.length / transcription.totalDuration
      const estimatedDuration = wordCount / avgWordsPerSecond
      
      // Scale to fit target duration proportionally
      const proportionalDuration = (wordCount / totalWordCount) * targetDuration
      const duration = Math.max(2, Math.min(15, proportionalDuration))
      
      return {
        startTime: currentTime,
        duration,
        endTime: currentTime + duration
      }
    }
    
    // Fallback to word count estimation (160 words per minute average speaking rate)
    const estimatedDuration = Math.max(2, (wordCount / 160) * 60)
    const proportionalDuration = (wordCount / totalWordCount) * targetDuration
    const duration = Math.max(2, Math.min(15, proportionalDuration))
    
    return {
      startTime: currentTime,
      duration,
      endTime: currentTime + duration
    }
  }

  /**
   * Determine visual type based on visual direction and preferences
   */
  private determineVisualType(
    visualDirection: string,
    preferredTypes: string[]
  ): 'AVATAR' | 'STOCK_VIDEO' | 'STOCK_IMAGE' {
    const direction = visualDirection.toLowerCase()
    
    // Check for avatar indicators
    if (direction.includes('avatar') || 
        direction.includes('person') || 
        direction.includes('speaking') ||
        direction.includes('presenter')) {
      return 'AVATAR'
    }
    
    // Check for static content indicators
    if (direction.includes('chart') || 
        direction.includes('graphic') || 
        direction.includes('text') ||
        direction.includes('logo') ||
        direction.includes('screenshot')) {
      return 'STOCK_IMAGE'
    }
    
    // Default to preferred type or stock video
    if (preferredTypes.includes('STOCK_VIDEO')) {
      return 'STOCK_VIDEO'
    } else if (preferredTypes.includes('STOCK_IMAGE')) {
      return 'STOCK_IMAGE'
    }
    
    return 'STOCK_VIDEO' // Default fallback
  }

  /**
   * Extract and enhance visual keywords
   */
  private extractVisualKeywords(
    bRollKeywords: string[],
    visualDirection: string,
    voiceover: string
  ): string[] {
    const keywords = new Set<string>()
    
    // Add b-roll keywords
    bRollKeywords.forEach(keyword => keywords.add(keyword.toLowerCase()))
    
    // Extract keywords from visual direction
    const directionWords = visualDirection.toLowerCase()
      .split(/[,\s]+/)
      .filter(word => word.length > 3)
      .slice(0, 3) // Limit to prevent too many keywords
    
    directionWords.forEach(word => keywords.add(word))
    
    // Extract relevant nouns from voiceover
    const voiceoverKeywords = this.extractNounsFromText(voiceover)
    voiceoverKeywords.slice(0, 2).forEach(keyword => keywords.add(keyword))
    
    return Array.from(keywords).slice(0, 6) // Max 6 keywords per scene
  }

  /**
   * Simple noun extraction from text
   */
  private extractNounsFromText(text: string): string[] {
    // Simple pattern matching for common nouns
    const patterns = [
      /\b(technology|innovation|company|business|product|service|platform|system|data|market|industry|startup|growth|revenue|users|customers)\b/gi,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g // Proper nouns
    ]
    
    const keywords = new Set<string>()
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach(match => keywords.add(match.toLowerCase()))
      }
    })
    
    return Array.from(keywords)
  }

  /**
   * Map script segment type to scene type
   */
  private mapSegmentTypeToSceneType(segmentType: string): Scene['type'] {
    switch (segmentType) {
      case 'hook': return 'hook'
      case 'conflict': return 'main'
      case 'body': return 'main'
      case 'conclusion': return 'conclusion'
      default: return 'main'
    }
  }

  /**
   * Infer mood from segment type and content
   */
  private inferMoodFromSegment(segmentType: string, voiceover: string): Scene['mood'] {
    const text = voiceover.toLowerCase()
    
    // Check for emotional indicators
    if (text.includes('exciting') || text.includes('amazing') || text.includes('incredible')) {
      return 'energetic'
    }
    
    if (text.includes('problem') || text.includes('challenge') || text.includes('crisis')) {
      return 'dramatic'
    }
    
    if (text.includes('funny') || text.includes('weird') || text.includes('crazy')) {
      return 'humorous'
    }
    
    // Default based on segment type
    switch (segmentType) {
      case 'hook': return 'energetic'
      case 'conflict': return 'dramatic'
      case 'body': return 'professional'
      case 'conclusion': return 'inspiring'
      default: return 'professional'
    }
  }

  /**
   * Validate scene timing for overlaps and consistency
   */
  private validateSceneTiming(scenes: Scene[]): boolean {
    if (scenes.length === 0) return true
    
    for (let i = 0; i < scenes.length - 1; i++) {
      const currentScene = scenes[i]
      const nextScene = scenes[i + 1]
      
      // Check for overlaps
      if (currentScene.timing.endTime > nextScene.timing.startTime) {
        return false
      }
      
      // Check for unreasonable durations
      if (currentScene.timing.duration < 1 || currentScene.timing.duration > 30) {
        return false
      }
    }
    
    return true
  }

  /**
   * Calculate total duration from scenes
   */
  calculateTotalDuration(scenes: Scene[]): number {
    if (scenes.length === 0) return 0
    
    const lastScene = scenes[scenes.length - 1]
    return lastScene.timing.endTime
  }

  /**
   * Optimize scene timing to fit target duration
   */
  optimizeSceneTiming(scenes: Scene[], targetDuration: number): Scene[] {
    const currentDuration = this.calculateTotalDuration(scenes)
    const scaleFactor = targetDuration / currentDuration
    
    let currentTime = 0
    
    return scenes.map(scene => {
      const newDuration = Math.max(1, scene.timing.duration * scaleFactor)
      const optimizedScene = {
        ...scene,
        timing: {
          ...scene.timing,
          startTime: currentTime,
          duration: newDuration,
          endTime: currentTime + newDuration
        }
      }
      
      currentTime += newDuration
      return optimizedScene
    })
  }
}