/**
 * Example usage of the isolated LLM tracing service
 * This demonstrates how to use the tracing service independently
 */

import { createLLMTracingService } from '../services/llm-tracing'
import type { Env } from '../types/env'

export async function exampleTracingUsage(env: Env) {
  // Initialize the tracing service
  const tracingService = createLLMTracingService(env)
  
  if (!tracingService.enabled) {
    console.log('Tracing not enabled - missing Langfuse configuration')
    return
  }

  // Start a trace for video script generation
  const trace = await tracingService.startVideoScriptTrace({
    title: 'AI Revolutionizes Healthcare',
    content: 'Article content here...',
    duration: 60,
    provider: 'openai',
    requestId: 'example-request-123'
  })

  try {
    // Example LLM call tracing
    const llmStartTime = Date.now()
    
    // Simulate LLM call (replace with actual call)
    const mockResponse = {
      content: '{"video_structure": {"title": "AI Healthcare Revolution"}}',
      usage: { inputTokens: 500, outputTokens: 300, totalTokens: 800 },
      model: 'gpt-4o-2024-08-06',
      provider: 'openai' as const
    }

    // Trace the LLM call
    await tracingService.traceLLMCall(trace, {
      provider: 'openai',
      model: 'gpt-4o-2024-08-06',
      prompt: 'Generate a video script about AI in healthcare...',
      maxTokens: 1500,
      temperature: 0.8,
      structuredOutput: true,
      hasImage: false,
      hasCustomInstructions: true,
      startTime: llmStartTime
    }, {
      content: mockResponse.content,
      usage: mockResponse.usage,
      success: true
    })

    // Example template processing tracing
    await tracingService.traceTemplateProcessing(trace, {
      templateName: 'video-script-generation',
      templateLength: 2847,
      variables: {
        title: 'AI Revolutionizes Healthcare',
        content: 'Article content...',
        duration: '60',
        customInstructions: 'Focus on practical applications'
      },
      startTime: Date.now()
    }, {
      renderedPrompt: 'Final rendered prompt with variables...',
      success: true
    })

    // Example image analysis tracing (optional)
    await tracingService.traceImageAnalysis(trace, {
      provider: 'openai',
      imageType: 'image/jpeg',
      imageSize: 245760, // ~240KB
      prompt: 'Describe this medical diagram...',
      startTime: Date.now()
    }, {
      description: 'A detailed medical diagram showing...',
      success: true
    })

    // Example performance metrics
    await tracingService.recordPerformanceMetrics(trace, {
      totalLatency: 2500,
      llmLatency: 2000,
      templateLatency: 50,
      parsingLatency: 100,
      providerLatency: 1950
    })

    // Update trace with final results
    await tracingService.updateTraceWithResults(trace, {
      script: { video_structure: { title: 'AI Healthcare Revolution' } },
      success: true,
      title: 'AI Healthcare Revolution',
      segments: ['hook', 'conflict', 'body', 'conclusion'],
      duration: '60'
    }, {
      totalProcessingTime: 2500,
      providerUsed: 'openai',
      modelUsed: 'gpt-4o-2024-08-06',
      tokenUsage: mockResponse.usage
    })

    // Add user context (optional)
    await tracingService.addUserContext(trace, 'user-123', 'session-456')

    console.log('✅ Tracing completed successfully')
    console.log(`📊 View trace at: ${trace ? tracingService.getTraceUrl(trace.id) || 'N/A' : 'N/A'}`)

  } catch (error) {
    // Handle errors and update trace
    await tracingService.updateTraceWithResults(trace, {
      script: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, {
      totalProcessingTime: Date.now() - Date.now(),
      providerUsed: 'openai',
      modelUsed: 'gpt-4o-2024-08-06'
    })
    
    console.error('❌ Tracing failed:', error)
  } finally {
    // Always flush traces
    await tracingService.flush()
  }
}

/**
 * Example user feedback recording
 */
export async function exampleFeedbackUsage(env: Env, traceId: string) {
  const tracingService = createLLMTracingService(env)
  
  if (!tracingService.enabled) return
  
  // Record user feedback
  await tracingService.recordUserFeedback(traceId, {
    rating: 4,
    quality: 'good',
    comments: 'Great script, but could be more engaging',
    wouldUseAgain: true,
    scriptUseful: true,
    providerPreference: 'openai'
  })
  
  console.log('📝 User feedback recorded')
}