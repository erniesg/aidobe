import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import { ScriptGenerationService } from '../services/script-generation'
import { ConfigurationService } from '../services/config'
import {
  type GenerateScriptRequest,
  type EditScriptRequest,
  type StructuredScriptGenerationRequest,
  GenerateScriptRequestSchema,
  EditScriptRequestSchema,
  StructuredScriptGenerationRequestSchema
} from '../schemas/script'
import { type Article, ArticleSchema } from '../schemas/job'

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
  private configService: ConfigurationService

  constructor(private env: Env) {
    this.configService = new ConfigurationService(env)
    
    // Initialize with mock LLM provider for now
    const mockLLMProvider = {
      generateText: async (prompt: string, options?: any) => {
        // This would be replaced with actual OpenAI/Anthropic integration
        return 'Mock LLM response'
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
    
    this.scriptService = new ScriptGenerationService(env, mockLLMProvider, configServiceAdapter)
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

      // Process articles
      const parsedArticles = await this.scriptService.parseArticles(validatedRequest.articles)

      const response = {
        success: true,
        data: {
          parsedArticles,
          summary: {
            totalArticles: validatedRequest.articles.length,
            successfullyParsed: parsedArticles.length,
            processingTime: Date.now() - startTime,
            averageTikTokPotential: parsedArticles.reduce((sum, article) => sum + article.tiktokPotential, 0) / parsedArticles.length
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Successfully parsed articles in ${Date.now() - startTime}ms`)
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

  // Health check endpoint
  app.get('/health', async (c) => {
    return handlers.healthCheck(c)
  })

  return app
}