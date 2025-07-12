import type { Env } from '../types/env'
import { TracingService } from './tracing'

export interface LLMTraceInput {
  provider: string
  model: string
  prompt: string
  maxTokens: number
  temperature: number
  structuredOutput: boolean
  hasImage?: boolean
  hasCustomInstructions?: boolean
  startTime: number
}

export interface LLMTraceOutput {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  success: boolean
  error?: string
}

export interface VideoScriptGenerationInput {
  articleTitle: string
  articleContent: string
  contentLength: number
  duration: number
  llmProvider: string
  model?: string
  customInstructions?: string
  hasImage: boolean
  algoliaObjectId?: string
  userId?: string
  jobId?: string
  requestId: string
  sourceArticle?: any
}

export interface VideoScriptGenerationOutput {
  script: any
  success: boolean
  title?: string
  segments?: string[]
  duration?: string | number
  error?: string
}

/**
 * Dedicated service for LLM-specific tracing and observability
 * Isolates all Langfuse/observability logic from business handlers
 */
export class LLMTracingService {
  private tracingService: TracingService
  private isEnabled: boolean = false

  constructor(env: Env) {
    this.tracingService = new TracingService(env)
    this.isEnabled = !!(env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY)
  }

  /**
   * Start tracing a video script generation request
   */
  async startVideoScriptTrace(input: VideoScriptGenerationInput) {
    if (!this.isEnabled) return null

    // Map VideoScriptGenerationInput to the expected interface
    const trace = await this.tracingService.startVideoScriptGeneration({
      title: input.articleTitle,
      content: input.articleContent,
      duration: input.duration,
      provider: input.llmProvider,
      userId: input.userId,
      requestId: input.requestId
    })
    return trace
  }

  /**
   * Trace an LLM generation call with detailed parameters and response
   */
  async traceLLMCall(trace: any, input: LLMTraceInput, output: LLMTraceOutput) {
    if (!this.isEnabled || !trace) return

    await this.tracingService.traceLLMGeneration(trace, input, output)
  }

  /**
   * Update trace with final video script generation results
   */
  async updateTraceWithResults(
    trace: any, 
    output: VideoScriptGenerationOutput,
    metadata: {
      totalProcessingTime: number
      providerUsed: string
      modelUsed: string
      tokenUsage?: any
    }
  ) {
    if (!this.isEnabled || !trace) return

    await trace.update({
      output: {
        script: output.script,
        success: output.success,
        title: output.title,
        segments: output.segments,
        duration: output.duration,
        ...(output.error && { error: output.error })
      },
      metadata: {
        total_processing_time_ms: metadata.totalProcessingTime,
        provider_used: metadata.providerUsed,
        model_used: metadata.modelUsed,
        token_usage: metadata.tokenUsage
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })
  }

  /**
   * Record parsing errors or JSON validation failures
   */
  async recordParsingError(
    trace: any,
    input: LLMTraceInput,
    rawContent: string,
    error: Error
  ) {
    if (!this.isEnabled || !trace) return

    await this.tracingService.traceLLMGeneration(trace, input, {
      content: rawContent,
      success: false,
      error: `JSON parsing failed: ${error.message}`
    })
  }

  /**
   * Record image analysis tracing
   */
  async traceImageAnalysis(
    trace: any,
    input: {
      provider: string
      imageType: string
      imageSize: number
      prompt: string
      startTime: number
    },
    output: {
      description: string
      success: boolean
      error?: string
    }
  ) {
    if (!this.isEnabled || !trace) return

    trace.span({
      name: 'image-analysis',
      input: {
        provider: input.provider,
        image_type: input.imageType,
        image_size_estimate: `${Math.round(input.imageSize / 1024)}KB`,
        analysis_prompt: input.prompt
      },
      output: output.success ? {
        description: output.description,
        description_length: output.description.length
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })
  }

  /**
   * Record template loading and rendering
   */
  async traceTemplateProcessing(
    trace: any,
    input: {
      templateName: string
      templateLength: number
      variables: Record<string, any>
      startTime: number
    },
    output: {
      renderedPrompt: string
      success: boolean
      error?: string
    }
  ) {
    if (!this.isEnabled || !trace) return

    trace.span({
      name: 'template-processing',
      input: {
        template_name: input.templateName,
        template_length: input.templateLength,
        variables_provided: Object.keys(input.variables),
        has_custom_instructions: !!input.variables.customInstructions,
        has_image_description: !!input.variables.imageDescription
      },
      output: output.success ? {
        rendered_prompt_length: output.renderedPrompt.length
      } : {
        error: output.error
      },
      metadata: {
        processing_time_ms: Date.now() - input.startTime,
        success: output.success
      },
      level: output.success ? 'DEFAULT' : 'ERROR'
    })
  }

  /**
   * Add user context to existing trace
   */
  async addUserContext(trace: any, userId: string, sessionId?: string) {
    if (!this.isEnabled || !trace) return

    trace.update({
      userId,
      sessionId,
      metadata: {
        ...trace.metadata,
        user_id: userId,
        session_id: sessionId
      }
    })
  }

  /**
   * Record user feedback for continuous improvement
   */
  async recordUserFeedback(
    traceId: string,
    feedback: {
      rating: number // 1-5
      quality: 'poor' | 'fair' | 'good' | 'excellent'
      comments?: string
      wouldUseAgain: boolean
      scriptUseful?: boolean
      providerPreference?: string
    }
  ) {
    if (!this.isEnabled) return

    await this.tracingService.trackFeedback(traceId, feedback)
  }

  /**
   * Record performance metrics for optimization
   */
  async recordPerformanceMetrics(
    trace: any,
    metrics: {
      totalLatency: number
      llmLatency: number
      templateLatency: number
      parsingLatency: number
      providerLatency: number
    }
  ) {
    if (!this.isEnabled || !trace) return

    trace.span({
      name: 'performance-metrics',
      input: {},
      output: {
        total_latency_ms: metrics.totalLatency,
        llm_latency_ms: metrics.llmLatency,
        template_latency_ms: metrics.templateLatency,
        parsing_latency_ms: metrics.parsingLatency,
        provider_latency_ms: metrics.providerLatency,
        llm_percentage: Math.round((metrics.llmLatency / metrics.totalLatency) * 100)
      },
      metadata: {
        performance_analysis: true
      }
    })
  }

  /**
   * Flush all pending traces (call at end of request)
   */
  async flush() {
    if (!this.isEnabled) return
    
    await this.tracingService.flush()
  }

  /**
   * Check if tracing is enabled
   */
  get enabled(): boolean {
    return this.isEnabled
  }

  /**
   * Get trace URL for debugging (if available)
   */
  getTraceUrl(traceId: string): string | null {
    if (!this.isEnabled) return null
    
    const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
    return `${baseUrl}/trace/${traceId}`
  }
}

/**
 * Factory function to create LLM tracing service
 */
export function createLLMTracingService(env: Env): LLMTracingService {
  return new LLMTracingService(env)
}