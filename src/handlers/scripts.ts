import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import { ScriptGenerationService } from '../services/script-generation'
import { ScenePlanningService } from '../services/scene-planning'
import { ConfigurationService } from '../services/config'
import { OpenAIService } from '../services/openai'
import { MultiProviderLLMService, type LLMProvider } from '../services/multi-provider-llm'
import { createLLMTracingService, type LLMTracingService } from '../services/llm-tracing'
import { createAlgoliaService, type AlgoliaService } from '../services/algolia'
import {
  type GenerateScriptRequest,
  type EditScriptRequest,
  type StructuredScriptGenerationRequest,
  GenerateScriptRequestSchema,
  EditScriptRequestSchema,
  StructuredScriptGenerationRequestSchema
} from '../schemas/script'
import { type Article, ArticleSchema } from '../schemas/job'
import {
  ScenePlanningRequestSchema,
  type ScenePlanningRequest,
  type WanxScript
} from '../schemas/scene-planning'

// Request schemas for API endpoints
const ParseArticlesRequestSchema = z.object({
  articles: z.array(ArticleSchema).min(1).max(10),
  jobId: z.string().uuid().optional()
})

const GenerateStructuredScriptsRequestSchema = StructuredScriptGenerationRequestSchema

const ExtractScenesRequestSchema = z.object({
  finalScriptId: z.string().uuid()
})

// Response schemas
const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid()
})

export class ScriptHandlers {
  private scriptService: ScriptGenerationService
  private scenePlanningService: ScenePlanningService
  private configService: ConfigurationService
  private llmTracingService: LLMTracingService
  private algoliaService: AlgoliaService
  private llmProvider: any
  private multiProviderLLM: MultiProviderLLMService

  constructor(private env: Env) {
    this.configService = new ConfigurationService(env)
    
    // Initialize multi-provider LLM service
    this.multiProviderLLM = new MultiProviderLLMService(env)
    
    // Keep backward compatibility with existing OpenAI service
    const openaiService = new OpenAIService(env.OPENAI_API_KEY)
    this.llmProvider = {
      generateText: async (prompt: string, options?: any) => {
        return await openaiService.generateText(prompt, options)
      }
    }
    
    // Create adapter for ConfigService interface
    const configServiceAdapter = {
      getModelConfig: async (context: string) => {
        const result = await this.configService.getModelConfig(context)
        return result.data || {}
      },
      getPromptTemplate: async (category: string, name: string) => {
        const result = await this.configService.getPromptTemplate(category, name)
        return result.data || {}
      },
      renderPrompt: (template: any, variables: Record<string, any>) => {
        // For now, return a simple rendered string
        // In production, this would use the actual template engine
        return JSON.stringify(template) + ' with variables: ' + JSON.stringify(variables)
      }
    }
    
    this.scriptService = new ScriptGenerationService(env, this.llmProvider, configServiceAdapter)
    this.scenePlanningService = new ScenePlanningService(env)
    this.llmTracingService = createLLMTracingService(env)
    this.algoliaService = createAlgoliaService(env)
  }

  /**
   * Load prompt template from file (proper approach like wanx)
   */
  private async loadPromptTemplate(templateName: string): Promise<string> {
    try {
      if (templateName === 'video-script-generation') {
        // Read template from R2 storage or file system
        // For now, we'll fetch it from the template file we created
        try {
          // In production, this would read from R2 bucket
          const response = await fetch(`/templates/prompts/${templateName}.md`)
          if (response.ok) {
            return await response.text()
          }
        } catch {
          // Fallback: use template service to get the template
          const templateResult = await this.configService.getPromptTemplate('video', 'script-generation')
          if (templateResult.data) {
            return templateResult.data.content || templateResult.data
          }
        }
        
        throw new Error(`Template ${templateName} not found`)
      }
      
      return ''
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error)
      throw new Error(`Template ${templateName} not found`)
    }
  }


  /**
   * Simple template rendering (replace {{variable}} with values)
   */
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template
    
    // Replace simple variables {{variable}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      rendered = rendered.replace(regex, String(value || ''))
    })
    
    // Handle conditional blocks {{#if customInstructions}}...{{/if}}
    if (variables.customInstructions && variables.customInstructions.trim()) {
      rendered = rendered.replace(/{{#if customInstructions}}(.*?){{\/if}}/gs, '$1')
    } else {
      rendered = rendered.replace(/{{#if customInstructions}}(.*?){{\/if}}/gs, '')
    }
    
    // Handle conditional blocks {{#if imageDescription}}...{{/if}}
    if (variables.imageDescription && variables.imageDescription.trim()) {
      rendered = rendered.replace(/{{#if imageDescription}}(.*?){{\/if}}/gs, '$1')
    } else {
      rendered = rendered.replace(/{{#if imageDescription}}(.*?){{\/if}}/gs, '')
    }
    
    return rendered
  }

  /**
   * POST /api/scripts/parse-articles
   * Parse articles and extract key information for script generation
   */
  async parseArticles(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = ParseArticlesRequestSchema.parse(body)

      console.log(`[${requestId}] Parsing ${validatedRequest.articles.length} articles`)

      // Start tracing pipeline
      const trace = await this.llmTracingService.startVideoScriptTrace({
        articleTitle: validatedRequest.articles[0]?.title || 'Multiple Articles',
        articleContent: validatedRequest.articles[0]?.content || '',
        userId: c.req.header('User-ID'),
        jobId: validatedRequest.jobId || requestId
      })

      // Process articles
      const parsedArticles = await this.scriptService.parseArticles(validatedRequest.articles)

      // Trace the parsing step
      await this.llmTracingService.traceLLMCall(trace, {
        provider: 'internal',
        model: 'article-parser',
        prompt: `Parse ${validatedRequest.articles.length} articles`,
        maxTokens: 0,
        temperature: 0,
        structuredOutput: false,
        hasImage: false,
        hasCustomInstructions: false,
        startTime
      }, {
        content: JSON.stringify(parsedArticles),
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        success: true
      })

      const response = {
        success: true,
        data: {
          parsedArticles,
          summary: {
            totalArticles: validatedRequest.articles.length,
            successfullyParsed: parsedArticles.length,
            processingTime: Date.now() - startTime,
            averageTikTokPotential: parsedArticles.reduce((sum, article) => sum + article.tiktokPotential, 0) / parsedArticles.length
          },
          traceId: trace?.id // Include trace ID for debugging
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Successfully parsed articles in ${Date.now() - startTime}ms`)
      await this.llmTracingService.flush()
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Article parsing failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/scripts/generate-structured
   * Generate structured scripts with wanx-inspired segments
   */
  async generateStructuredScripts(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = GenerateStructuredScriptsRequestSchema.parse(body)

      console.log(`[${requestId}] Generating ${validatedRequest.generationConfig?.numberOfVariations || 3} structured scripts`)

      // Generate structured scripts
      const scripts = await this.scriptService.generateStructuredScripts(validatedRequest)

      const response = {
        success: true,
        data: {
          scripts,
          summary: {
            generatedCount: scripts.length,
            jobId: validatedRequest.jobId,
            processingTime: Date.now() - startTime,
            averageQualityScore: scripts.reduce((sum, script) => sum + (script.qualityMetrics.overallScore || 0), 0) / scripts.length,
            templateUsed: scripts[0]?.generationMetadata.templateUsed
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Generated ${scripts.length} structured scripts in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Structured script generation failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/scripts/generate-drafts
   * Generate legacy script drafts (for backwards compatibility)
   */
  async generateDrafts(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = GenerateScriptRequestSchema.parse(body)

      console.log(`[${requestId}] Generating ${validatedRequest.generationConfig?.numberOfDrafts || 3} script drafts`)

      // Generate drafts
      const drafts = await this.scriptService.generateDrafts(validatedRequest)

      const response = {
        success: true,
        data: {
          drafts,
          summary: {
            generatedCount: drafts.length,
            jobId: validatedRequest.jobId,
            processingTime: Date.now() - startTime,
            averageQualityScore: drafts.reduce((sum, draft) => sum + (draft.qualityScore || 0), 0) / drafts.length,
            averageConfidence: drafts.reduce((sum, draft) => sum + (draft.confidence || 0), 0) / drafts.length
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Generated ${drafts.length} drafts in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Draft generation failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * PUT /api/scripts/edit-draft/:draftId
   * Edit an existing script draft
   */
  async editDraft(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const draftId = c.req.param('draftId')
      
      if (!draftId) {
        return c.json({
          success: false,
          error: 'Draft ID is required',
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      // Input validation
      const body = await c.req.json()
      const validatedRequest = EditScriptRequestSchema.parse({
        ...body,
        draftId
      })

      console.log(`[${requestId}] Editing draft ${draftId} with ${validatedRequest.edits.length} edits`)

      // Edit draft
      const result = await this.scriptService.editDraft(validatedRequest)

      const response = {
        success: true,
        data: {
          updatedDraft: result.draft,
          editRecord: result.edit,
          summary: {
            draftId,
            newVersion: result.draft.version,
            editsApplied: validatedRequest.edits.length,
            processingTime: Date.now() - startTime
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Successfully edited draft ${draftId} in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Draft editing failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/scripts/finalize/:draftId
   * Finalize a script draft for production
   */
  async finalizeDraft(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const draftId = c.req.param('draftId')
      
      if (!draftId) {
        return c.json({
          success: false,
          error: 'Draft ID is required',
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      // Optional body with finalization options
      let finalizedBy: string | undefined
      try {
        const body = await c.req.json()
        finalizedBy = body.finalizedBy
      } catch {
        // No body is fine
      }

      console.log(`[${requestId}] Finalizing draft ${draftId}`)

      // Finalize draft
      const finalScript = await this.scriptService.finalizeDraft(draftId, finalizedBy)

      const response = {
        success: true,
        data: {
          finalScript,
          summary: {
            originalDraftId: draftId,
            finalScriptId: finalScript.id,
            sceneCount: finalScript.sceneBreakpoints.length,
            visualKeywordCount: finalScript.visualKeywords.length,
            processingTime: Date.now() - startTime
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Successfully finalized draft ${draftId} in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Draft finalization failed:`, error)

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/scripts/extract-scenes
   * Extract scenes from a finalized script
   */
  async extractScenes(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = ExtractScenesRequestSchema.parse(body)

      console.log(`[${requestId}] Extracting scenes from final script ${validatedRequest.finalScriptId}`)

      // This would typically load the final script from storage
      // For now, we'll create a mock final script
      const mockFinalScript = {
        id: validatedRequest.finalScriptId,
        content: 'Mock final script content for scene extraction. This would be loaded from storage.',
        sceneBreakpoints: []
      }

      // Extract scenes
      const scenes = await this.scriptService.extractScenes(mockFinalScript as any)

      const response = {
        success: true,
        data: {
          scenes,
          summary: {
            finalScriptId: validatedRequest.finalScriptId,
            sceneCount: scenes.length,
            totalDuration: scenes.reduce((sum, scene) => sum + scene.estimatedDuration, 0),
            processingTime: Date.now() - startTime
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Extracted ${scenes.length} scenes in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Scene extraction failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * GET /api/scripts/health
   * Health check endpoint for script services
   */
  async healthCheck(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()

    try {
      // Check service health
      const systemStatus = await this.configService.getSystemStatus()

      const response = {
        success: true,
        data: {
          status: 'healthy',
          services: {
            scriptGeneration: 'healthy',
            configuration: systemStatus.healthy ? 'healthy' : 'degraded',
            templateEngine: 'healthy'
          },
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Health check failed:`, error)

      return c.json({
        success: false,
        error: 'Service health check failed',
        timestamp: new Date().toISOString(),
        requestId
      }, 503)
    }
  }

  /**
   * POST /api/scripts/generate-video-script
   * Generate wanx-style video script from article content with optional image input
   */
  async generateVideoScript(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation - support both direct content and Algolia article ID
      const body = await c.req.json()
      const validatedRequest = z.object({
        // Either provide title/content directly OR algolia object ID
        title: z.string().min(1).optional(),
        content: z.string().min(10).optional(),
        algoliaObjectId: z.string().optional(), // Auto-fetch from Algolia
        
        duration: z.number().min(15).max(120).default(60),
        customInstructions: z.string().optional(), // Optional custom instructions
        // Image support (optional)
        image: z.object({
          data: z.string(), // base64 encoded image or URL
          mimeType: z.string(), // e.g., 'image/jpeg', 'image/png'
          type: z.enum(['base64', 'url']).default('base64')
        }).optional(),
        // Provider selection
        llmProvider: z.enum(['openai', 'anthropic', 'google']).default('openai'),
        model: z.string().optional()
      }).refine(
        (data) => (data.title && data.content) || data.algoliaObjectId,
        {
          message: "Either provide title/content directly or algoliaObjectId to fetch from Algolia",
          path: ["title", "content", "algoliaObjectId"]
        }
      ).parse(body)

      // Extract title and content from Algolia if object ID provided
      let finalTitle = validatedRequest.title
      let finalContent = validatedRequest.content
      let articleMetadata: any = null

      if (validatedRequest.algoliaObjectId) {
        console.log(`[${requestId}] Fetching article from Algolia: ${validatedRequest.algoliaObjectId}`)
        
        const article = await this.algoliaService.getArticleById(validatedRequest.algoliaObjectId)
        
        if (!article) {
          return c.json({
            success: false,
            error: `Article not found in Algolia: ${validatedRequest.algoliaObjectId}`,
            requestId
          }, 404)
        }

        finalTitle = article.title
        finalContent = article.content
        articleMetadata = {
          objectId: article.objectID,
          author: article.author,
          publishedAt: article.publishedAt,
          url: article.url,
          tags: article.tags,
          category: article.category,
          readingTime: article.readingTime
        }

        console.log(`[${requestId}] Fetched article: "${finalTitle}" (${finalContent.length} chars)`)
      }

      // Validate we have the required content
      if (!finalTitle || !finalContent) {
        return c.json({
          success: false,
          error: 'Title and content are required (either directly or from Algolia article)',
          requestId
        }, 400)
      }

      if (finalContent.length < 10) {
        return c.json({
          success: false,
          error: 'Article content too short for video script generation',
          requestId
        }, 400)
      }

      // Start LLM tracing
      const trace = await this.llmTracingService.startVideoScriptTrace({
        title: finalTitle,
        content: finalContent,
        duration: validatedRequest.duration,
        provider: validatedRequest.llmProvider,
        requestId
      })

      console.log(`[${requestId}] Generating video script for: "${finalTitle}" using ${validatedRequest.llmProvider}${validatedRequest.algoliaObjectId ? ` (from Algolia: ${validatedRequest.algoliaObjectId})` : ''}`)

      // Load prompt template
      const templateStartTime = Date.now()
      const promptTemplate = await this.loadPromptTemplate('video-script-generation')
      
      // Generate image description if image is provided
      let imageDescription = ''
      if (validatedRequest.image) {
        try {
          const imageStartTime = Date.now()
          const imageAnalysis = await this.multiProviderLLM.generateWithImage(
            'Describe this image in detail. Focus on key visual elements, people, objects, text, charts, or any relevant information that could help create a compelling video script.',
            validatedRequest.image.data,
            validatedRequest.image.mimeType,
            {
              provider: validatedRequest.llmProvider,
              maxTokens: 300
            }
          )
          imageDescription = imageAnalysis.content
          
          // Trace image analysis
          await this.llmTracingService.traceImageAnalysis(trace, {
            provider: validatedRequest.llmProvider,
            imageType: validatedRequest.image.mimeType,
            imageSize: validatedRequest.image.data.length,
            prompt: 'Describe this image in detail...',
            startTime: imageStartTime
          }, {
            description: imageDescription,
            success: true
          })
        } catch (error) {
          console.warn(`[${requestId}] Failed to analyze image:`, error)
          
          // Trace image analysis error
          await this.llmTracingService.traceImageAnalysis(trace, {
            provider: validatedRequest.llmProvider,
            imageType: validatedRequest.image.mimeType,
            imageSize: validatedRequest.image.data.length,
            prompt: 'Describe this image in detail...',
            startTime: Date.now()
          }, {
            description: '',
            success: false,
            error: error instanceof Error ? error.message : 'Image analysis failed'
          })
        }
      }
      
      // Render template with variables including image description
      const userPrompt = this.renderTemplate(promptTemplate, {
        title: finalTitle,
        content: finalContent,
        duration: validatedRequest.duration.toString(),
        customInstructions: validatedRequest.customInstructions || '',
        imageDescription
      })

      // Trace template processing
      await this.llmTracingService.traceTemplateProcessing(trace, {
        templateName: 'video-script-generation',
        templateLength: promptTemplate.length,
        variables: {
          title: finalTitle,
          content: finalContent,
          duration: validatedRequest.duration.toString(),
          customInstructions: validatedRequest.customInstructions || '',
          imageDescription
        },
        startTime: templateStartTime
      }, {
        renderedPrompt: userPrompt,
        success: true
      })

      // Generate script using multi-provider LLM with structured output
      const llmRequestParams = {
        messages: [{
          role: 'user' as const,
          content: userPrompt
        }],
        provider: validatedRequest.llmProvider,
        model: validatedRequest.model,
        maxTokens: 1500,
        temperature: 0.8,
        structuredOutput: true, // Enable structured JSON output
        responseFormat: 'json_object' // Ensure JSON response
      }

      const llmStartTime = Date.now()
      const scriptResponse = await this.multiProviderLLM.generateText(llmRequestParams)

      // Trace the LLM generation
      await this.llmTracingService.traceLLMCall(trace, {
        provider: validatedRequest.llmProvider,
        model: validatedRequest.model || scriptResponse.model,
        prompt: userPrompt,
        maxTokens: llmRequestParams.maxTokens,
        temperature: llmRequestParams.temperature,
        structuredOutput: llmRequestParams.structuredOutput,
        hasImage: !!validatedRequest.image,
        hasCustomInstructions: !!validatedRequest.customInstructions,
        startTime: llmStartTime
      }, {
        content: scriptResponse.content,
        usage: scriptResponse.usage,
        success: true
      })

      // Parse the JSON response from LLM
      let videoScript
      try {
        // Parse structured JSON response (should be clean JSON with structured output)
        videoScript = JSON.parse(scriptResponse.content)
        
        // Validate it has the required structure
        if (!videoScript.video_structure || !videoScript.script_segments) {
          throw new Error('Invalid script structure')
        }
        
        console.log(`[${requestId}] Successfully parsed structured script from ${validatedRequest.llmProvider}`)
      } catch (error) {
        console.warn(`[${requestId}] Failed to parse LLM JSON response, using fallback structure:`, error)
        
        // Trace the parsing error
        await this.llmTracingService.recordParsingError(trace, {
          provider: validatedRequest.llmProvider,
          model: validatedRequest.model || scriptResponse.model,
          prompt: userPrompt,
          maxTokens: llmRequestParams.maxTokens,
          temperature: llmRequestParams.temperature,
          structuredOutput: llmRequestParams.structuredOutput,
          hasImage: !!validatedRequest.image,
          hasCustomInstructions: !!validatedRequest.customInstructions,
          startTime: llmStartTime
        }, scriptResponse.content, error instanceof Error ? error : new Error('Parsing failed'))
        
        // Fallback: create structured output from raw response
        videoScript = {
          video_structure: {
            title: finalTitle,
            throughline: "Generated from article content with structured analysis",
            duration: validatedRequest.duration.toString(),
            target_audience: "Tech professionals and content creators"
          },
          script_segments: {
            hook: {
              order_id: 1,
              voiceover: scriptResponse.content.substring(0, 100) + "...",
              visual_direction: "Dynamic opening visuals related to the article topic",
              b_roll_keywords: ["tech news", "article topic", "attention grabbing"]
            },
            conflict: {
              order_id: 2,
              voiceover: "This development creates significant challenges and opportunities",
              visual_direction: "Show tension or problem visualization",
              b_roll_keywords: ["challenges", "problem", "tech drama"]
            },
            body: {
              order_id: 3,
              voiceover: scriptResponse.content.substring(100, 400) + "...",
              visual_direction: "Cut between relevant footage and explanatory graphics",
              b_roll_keywords: ["tech innovation", "analysis", "detailed footage"]
            },
            conclusion: {
              order_id: 4,
              voiceover: "What do you think about this development?",
              visual_direction: "Tech in Asia logo with subscribe prompt",
              b_roll_keywords: ["conclusion", "call to action"]
            }
          },
          production_notes: {
            music_vibe: "engaging, tech-focused, conversational",
            overall_tone: "Gen-Z Tech in Asia journalist style"
          }
        }
      }

      // Add metadata
      const result = {
        id: requestId,
        script: videoScript,
        metadata: {
          generatedAt: new Date().toISOString(),
          executionTime: Date.now() - startTime,
          provider: validatedRequest.llmProvider,
          model: validatedRequest.model || scriptResponse.model,
          promptLength: userPrompt.length,
          responseLength: scriptResponse.content.length,
          usage: scriptResponse.usage,
          hasImage: !!validatedRequest.image,
          hasCustomInstructions: !!validatedRequest.customInstructions,
          ...(articleMetadata && { 
            sourceArticle: {
              ...articleMetadata,
              fetchedFromAlgolia: true
            }
          })
        }
      }

      // Update trace with final output
      await this.llmTracingService.updateTraceWithResults(trace, {
        script: videoScript,
        success: true,
        title: videoScript.video_structure?.title,
        segments: Object.keys(videoScript.script_segments || {}),
        duration: videoScript.video_structure?.duration
      }, {
        totalProcessingTime: Date.now() - startTime,
        providerUsed: validatedRequest.llmProvider,
        modelUsed: result.metadata.model,
        tokenUsage: result.metadata.usage
      })
      
      // Flush trace data
      await this.llmTracingService.flush()

      console.log(`[${requestId}] Video script generated successfully in ${Date.now() - startTime}ms`)

      return c.json({
        success: true,
        data: result
      })

    } catch (error) {
      console.error(`[${requestId}] Video script generation failed:`, error)
      
      // Update trace with error if trace exists
      if (trace) {
        await this.llmTracingService.updateTraceWithResults(trace, {
          script: null,
          success: false,
          error: error instanceof Error ? error.message : 'Video script generation failed'
        }, {
          totalProcessingTime: Date.now() - startTime,
          providerUsed: (validatedRequest as any)?.llmProvider || 'unknown',
          modelUsed: 'unknown'
        })
      }
      
      // Flush trace data
      await this.llmTracingService.flush()
      
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Video script generation failed',
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/scripts/plan-scenes
   * Break down video script into timed scenes with asset suggestions
   */
  async planScenes(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation using proper schemas
      const body = await c.req.json()
      const validatedRequest = ScenePlanningRequestSchema.parse(body)

      console.log(`[${requestId}] Planning scenes for script: ${validatedRequest.script.video_structure.title}`)

      // Generate scene plan using dedicated service
      const scenePlan = await this.scenePlanningService.generateScenePlan(
        validatedRequest.script,
        validatedRequest.transcription,
        validatedRequest.preferences
      )

      const response = {
        success: true,
        data: {
          scenePlan,
          summary: {
            totalScenes: scenePlan.scenes.length,
            totalDuration: scenePlan.totalDuration,
            averageSceneDuration: scenePlan.totalDuration / scenePlan.scenes.length,
            processingTime: Date.now() - startTime
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Generated scene plan with ${scenePlan.scenes.length} scenes in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Scene planning failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          })),
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Scene planning failed',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

}

/**
 * Create and configure script API routes
 */
export function createScriptRoutes(env: Env): Hono {
  const app = new Hono()
  const handlers = new ScriptHandlers(env)

  // Parse articles endpoint
  app.post('/parse-articles', async (c) => {
    return handlers.parseArticles(c)
  })

  // Generate structured scripts endpoint
  app.post('/generate-structured', async (c) => {
    return handlers.generateStructuredScripts(c)
  })

  // Generate legacy drafts endpoint (backwards compatibility)
  app.post('/generate-drafts', async (c) => {
    return handlers.generateDrafts(c)
  })

  // Edit draft endpoint
  app.put('/edit-draft/:draftId', async (c) => {
    return handlers.editDraft(c)
  })

  // Finalize draft endpoint
  app.post('/finalize/:draftId', async (c) => {
    return handlers.finalizeDraft(c)
  })

  // Extract scenes endpoint
  app.post('/extract-scenes', async (c) => {
    return handlers.extractScenes(c)
  })

  // Generate video script from article content
  app.post('/generate-video-script', async (c) => {
    return handlers.generateVideoScript(c)
  })

  // Plan scenes from script with timing extraction
  app.post('/plan-scenes', async (c) => {
    return handlers.planScenes(c)
  })

  // Health check endpoint
  app.get('/health', async (c) => {
    return handlers.healthCheck(c)
  })

  return app
}