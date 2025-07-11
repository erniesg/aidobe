import { Langfuse, LangfuseMedia } from 'langfuse'
import type { Env } from '../types/env'

export class TracingService {
  private langfuse: Langfuse | null = null
  private isEnabled: boolean = false

  constructor(env: Env) {
    if (env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY) {
      this.langfuse = new Langfuse({
        secretKey: env.LANGFUSE_SECRET_KEY,
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        baseUrl: env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
        flushAt: 1, // Send traces immediately for debugging
        debug: env.ENVIRONMENT === 'development'
      })
      this.isEnabled = true
      console.log('✅ Langfuse tracing initialized')
    } else {
      console.log('⚠️ Langfuse not configured - tracing disabled')
    }
  }

  /**
   * Start tracing a complete article-to-video pipeline
   */
  async startPipeline(input: {
    articleTitle: string
    articleContent: string
    preferences?: any
    userId?: string
    jobId?: string
  }) {
    if (!this.isEnabled || !this.langfuse) return null

    const trace = this.langfuse.trace({
      name: 'article-to-video-pipeline',
      input: {
        article_title: input.articleTitle,
        article_length: input.articleContent.length,
        preferences: input.preferences
      },
      metadata: {
        user_id: input.userId,
        job_id: input.jobId,
        pipeline_version: '1.0',
        timestamp: new Date().toISOString()
      },
      tags: ['video-generation', 'article-processing']
    })

    console.log(`🔍 Started pipeline trace: ${trace.id}`)
    return trace
  }

  /**
   * Trace article parsing step
   */
  async traceArticleParsing(trace: any, input: {
    articles: any[]
    startTime: number
  }, output: {
    parsedArticles: any[]
    success: boolean
    error?: string
  }) {
    if (!this.isEnabled || !trace) return

    const span = trace.span({
      name: 'article-parsing',
      input: {
        article_count: input.articles.length,
        total_content_length: input.articles.reduce((sum, a) => sum + (a.content?.length || 0), 0)
      },
      output: output.success ? {
        parsed_count: output.parsedArticles.length,
        avg_tiktok_potential: output.parsedArticles.reduce((sum, a) => sum + a.tiktokPotential, 0) / output.parsedArticles.length,
        key_points_extracted: output.parsedArticles.map(a => a.keyPoints?.length || 0)
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`📝 Traced article parsing - Success: ${output.success}`)
  }

  /**
   * Trace script generation step
   */
  async traceScriptGeneration(trace: any, input: {
    parsedArticles: any[]
    style: string
    duration: number
    startTime: number
  }, output: {
    script: any
    success: boolean
    error?: string
  }) {
    if (!this.isEnabled || !trace) return

    const span = trace.span({
      name: 'script-generation',
      input: {
        article_count: input.parsedArticles.length,
        target_style: input.style,
        target_duration: input.duration
      },
      output: output.success ? {
        script_length: output.script.content?.length || 0,
        scene_count: output.script.scenes?.length || 0,
        actual_duration: output.script.duration,
        hook_included: output.script.includeHook,
        cta_included: output.script.includeCTA
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success,
        model_used: 'gpt-4' // Track which model was used
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`📄 Traced script generation - Duration: ${output.script?.duration}s`)
  }

  /**
   * Trace TTS generation step
   */
  async traceTTSGeneration(trace: any, input: {
    text: string
    voice: string
    speed: number
    startTime: number
  }, output: {
    audioUrl?: string
    duration?: number
    format?: string
    success: boolean
    error?: string
  }) {
    if (!this.isEnabled || !trace) return

    const span = trace.span({
      name: 'tts-generation',
      input: {
        text_length: input.text.length,
        voice: input.voice,
        speed: input.speed
      },
      output: output.success ? {
        audio_duration: output.duration,
        format: output.format,
        audio_url: output.audioUrl,
        // Note: For large audio files, we store URL instead of binary data
        audio_size_estimate: `${Math.round((output.duration || 0) * 24)}KB` // Rough MP3 estimate
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success,
        provider: 'openai-tts'
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`🎵 Traced TTS generation - Duration: ${output.duration}s`)
  }

  /**
   * Trace asset search/generation step
   */
  async traceAssetDiscovery(trace: any, input: {
    queries: string[]
    type: 'search' | 'generate'
    providers?: string[]
    startTime: number
  }, output: {
    assets: any[]
    success: boolean
    error?: string
    selectedAssets?: any[]
  }) {
    if (!this.isEnabled || !trace) return

    // For images, we can include small thumbnails
    const assetOutputs = output.success ? output.assets.map(asset => ({
      asset_id: asset.id,
      type: asset.type,
      provider: asset.provider,
      url: asset.url,
      quality_score: asset.qualityScore || 0,
      relevance_score: asset.relevanceScore || 0,
      // Include small thumbnail if available
      ...(asset.thumbnailUrl && {
        thumbnail: new LangfuseMedia({
          contentType: 'image/jpeg',
          url: asset.thumbnailUrl
        })
      })
    })) : []

    const span = trace.span({
      name: `asset-${input.type}`,
      input: {
        query_count: input.queries.length,
        queries: input.queries,
        providers: input.providers,
        asset_type: input.type
      },
      output: output.success ? {
        assets_found: output.assets.length,
        assets_selected: output.selectedAssets?.length || 0,
        avg_quality: output.assets.reduce((sum, a) => sum + (a.qualityScore || 0), 0) / Math.max(output.assets.length, 1),
        assets: assetOutputs
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`🖼️ Traced asset ${input.type} - Found: ${output.assets.length}`)
  }

  /**
   * Trace video assembly step
   */
  async traceVideoAssembly(trace: any, input: {
    scriptId: string
    audioUrl: string
    assets: any[]
    effects: any
    startTime: number
  }, output: {
    videoUrl?: string
    duration?: number
    resolution?: string
    fileSize?: number
    success: boolean
    error?: string
  }) {
    if (!this.isEnabled || !trace) return

    const span = trace.span({
      name: 'video-assembly',
      input: {
        asset_count: input.assets.length,
        has_audio: !!input.audioUrl,
        effects_enabled: !!input.effects,
        script_id: input.scriptId
      },
      output: output.success ? {
        video_url: output.videoUrl,
        duration: output.duration,
        resolution: output.resolution,
        file_size_mb: output.fileSize ? Math.round(output.fileSize / (1024 * 1024)) : 0,
        // For video files, we typically store URL/metadata rather than binary data
        // due to size constraints
        video_info: {
          format: 'mp4',
          codec: 'h264',
          aspect_ratio: '9:16'
        }
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success,
        assembly_provider: 'modal-ffmpeg'
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`🎬 Traced video assembly - Size: ${output.fileSize ? Math.round(output.fileSize / (1024 * 1024)) : 0}MB`)
  }

  /**
   * Trace job completion with final results
   */
  async tracePipelineCompletion(trace: any, input: {
    jobId: string
    totalStartTime: number
  }, output: {
    finalVideoUrl?: string
    totalAssets: number
    success: boolean
    error?: string
  }) {
    if (!this.isEnabled || !trace) return

    const totalTime = Date.now() - input.totalStartTime

    trace.update({
      output: output.success ? {
        final_video_url: output.finalVideoUrl,
        total_assets_used: output.totalAssets,
        pipeline_success: true
      } : {
        error: output.error,
        pipeline_success: false
      },
      metadata: {
        total_processing_time_ms: totalTime,
        total_processing_time_readable: `${Math.round(totalTime / 1000)}s`,
        job_id: input.jobId,
        completed_at: new Date().toISOString()
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`✅ Pipeline completed - Total time: ${Math.round(totalTime / 1000)}s, Success: ${output.success}`)
  }

  /**
   * Trace LLM generation calls
   */
  async traceLLMGeneration(trace: any, input: {
    provider: string
    model: string
    prompt: string
    maxTokens: number
    temperature: number
    structuredOutput: boolean
    hasImage?: boolean
    hasCustomInstructions?: boolean
    startTime: number
  }, output: {
    content: string
    usage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
    success: boolean
    error?: string
  }) {
    if (!this.isEnabled || !trace) return

    const generation = trace.generation({
      name: 'video-script-generation',
      input: {
        prompt: input.prompt,
        prompt_length: input.prompt.length,
        has_image: input.hasImage || false,
        has_custom_instructions: input.hasCustomInstructions || false
      },
      output: output.success ? {
        content: output.content,
        content_length: output.content.length
      } : {
        error: output.error
      },
      model: input.model,
      modelParameters: {
        provider: input.provider,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        structuredOutput: input.structuredOutput
      },
      usage: output.usage ? {
        input: output.usage.inputTokens,
        output: output.usage.outputTokens,
        total: output.usage.totalTokens
      } : undefined,
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success,
        provider: input.provider
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })

    console.log(`🤖 Traced LLM generation - Provider: ${input.provider}, Tokens: ${output.usage?.totalTokens || 0}`)
    return generation
  }

  /**
   * Start tracing video script generation
   */
  async startVideoScriptGeneration(input: {
    title: string
    content: string
    duration: number
    provider: string
    userId?: string
    requestId: string
  }) {
    if (!this.isEnabled || !this.langfuse) return null

    const trace = this.langfuse.trace({
      name: 'video-script-generation',
      input: {
        title: input.title,
        content_length: input.content.length,
        target_duration: input.duration,
        llm_provider: input.provider
      },
      metadata: {
        user_id: input.userId,
        request_id: input.requestId,
        timestamp: new Date().toISOString()
      },
      tags: ['video-script', 'llm-generation', input.provider]
    })

    console.log(`🔍 Started video script trace: ${trace.id}`)
    return trace
  }

  /**
   * Track user feedback on generated videos
   */
  async trackFeedback(traceId: string, feedback: {
    rating: number // 1-5
    quality: 'poor' | 'fair' | 'good' | 'excellent'
    comments?: string
    wouldUseAgain: boolean
  }) {
    if (!this.isEnabled || !this.langfuse) return

    this.langfuse.score({
      traceId,
      name: 'user-rating',
      value: feedback.rating,
      comment: JSON.stringify({
        quality: feedback.quality,
        comments: feedback.comments,
        would_use_again: feedback.wouldUseAgain
      })
    })

    console.log(`⭐ Feedback recorded for trace ${traceId}: ${feedback.rating}/5`)
  }

  /**
   * Flush any pending traces (call at end of request)
   */
  async flush() {
    if (!this.isEnabled || !this.langfuse) return
    
    await this.langfuse.flushAsync()
  }
}

// Helper function to create tracing service
export function createTracingService(env: Env): TracingService {
  return new TracingService(env)
}