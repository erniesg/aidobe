import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import { AssetDiscoveryService } from '../services/asset-discovery'
import {
  type AssetSearchRequest,
  type AssetGenerationRequest,
  type AssetEvaluationRequest,
  AssetSearchRequestSchema,
  AssetGenerationRequestSchema,
  AssetEvaluationRequestSchema
} from '../schemas/asset'

// Additional request schemas for API endpoints
const AssetOverrideRequestSchema = z.object({
  sceneId: z.string().uuid(),
  assetUrl: z.string().url(),
  assetType: z.enum(['image', 'video']),
  reason: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

const BatchAssetRequestSchema = z.object({
  scenes: z.array(z.object({
    sceneId: z.string().uuid(),
    searchQuery: z.string().min(1).max(200),
    visualKeywords: z.array(z.string()).default([]),
    duration: z.number().positive().optional(),
    requirements: z.object({
      mediaType: z.enum(['image', 'video']).default('image'),
      style: z.string().optional(),
      quality: z.enum(['standard', 'high', 'premium']).default('standard'),
      aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional()
    }).optional()
  })).min(1).max(20),
  jobId: z.string().uuid(),
  preferences: z.object({
    providers: z.array(z.enum(['pexels', 'pixabay', 'envato'])).optional(),
    maxResultsPerScene: z.number().int().min(1).max(50).default(10),
    evaluateAssets: z.boolean().default(true),
    selectBest: z.boolean().default(true)
  }).optional()
})

export class AssetHandlers {
  private assetService: AssetDiscoveryService

  constructor(private env: Env) {
    this.assetService = new AssetDiscoveryService(env)
  }

  /**
   * POST /api/assets/search
   * Search for assets across multiple providers
   */
  async searchAssets(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = AssetSearchRequestSchema.parse(body)

      console.log(`[${requestId}] Searching assets: "${validatedRequest.query}" (${validatedRequest.type})`)

      // Search for assets
      const searchResult = await this.assetService.searchAssets(validatedRequest)

      if (!searchResult.success) {
        return c.json({
          success: false,
          error: searchResult.error || 'Asset search failed',
          timestamp: new Date().toISOString(),
          requestId
        }, 500)
      }

      const response = {
        success: true,
        data: {
          assets: searchResult.data,
          summary: {
            query: validatedRequest.query,
            totalFound: searchResult.data?.length || 0,
            mediaType: validatedRequest.type,
            providersUsed: searchResult.metadata?.providersUsed || [],
            processingTime: Date.now() - startTime,
            cacheHit: searchResult.metadata?.cacheHit || false
          },
          metadata: searchResult.metadata
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Found ${searchResult.data?.length || 0} assets in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset search failed:`, error)

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
   * POST /api/assets/generate
   * Generate custom assets using AI providers
   */
  async generateAssets(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = AssetGenerationRequestSchema.parse(body)

      console.log(`[${requestId}] Generating ${validatedRequest.type}: "${validatedRequest.prompt}"`)

      // Generate assets
      const generationResult = await this.assetService.generateAssets(validatedRequest)

      if (!generationResult.success) {
        return c.json({
          success: false,
          error: generationResult.error || 'Asset generation failed',
          timestamp: new Date().toISOString(),
          requestId
        }, 500)
      }

      const response = {
        success: true,
        data: {
          generatedAssets: generationResult.data,
          summary: {
            prompt: validatedRequest.prompt,
            mediaType: validatedRequest.type,
            generatedCount: generationResult.data?.length || 0,
            providersUsed: generationResult.metadata?.providersUsed || [],
            processingTime: Date.now() - startTime,
            totalCost: generationResult.metadata?.executionTime
          },
          metadata: generationResult.metadata
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Generated ${generationResult.data?.length || 0} assets in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset generation failed:`, error)

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
   * POST /api/assets/evaluate
   * Evaluate assets for relevance and quality
   */
  async evaluateAssets(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = AssetEvaluationRequestSchema.parse(body)

      console.log(`[${requestId}] Evaluating ${validatedRequest.assetIds.length} assets for scene "${validatedRequest.sceneContext.textContent}"`)

      // Evaluate assets
      const evaluationResult = await this.assetService.evaluateAssets(validatedRequest)

      if (!evaluationResult.success) {
        return c.json({
          success: false,
          error: evaluationResult.error || 'Asset evaluation failed',
          timestamp: new Date().toISOString(),
          requestId
        }, 500)
      }

      const response = {
        success: true,
        data: {
          evaluatedAssets: evaluationResult.data,
          summary: {
            sceneId: validatedRequest.sceneContext.sceneId,
            assetsEvaluated: validatedRequest.assetIds.length,
            averageScore: evaluationResult.data ? evaluationResult.data.reduce((sum, asset) => sum + asset.overallScore, 0) / Math.max(evaluationResult.data.length, 1) : 0,
            topScore: evaluationResult.data?.length ? Math.max(...evaluationResult.data.map(asset => asset.overallScore)) : 0,
            processingTime: Date.now() - startTime
          },
          metadata: evaluationResult.metadata
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Evaluated ${validatedRequest.assets.length} assets in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset evaluation failed:`, error)

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
   * POST /api/assets/select-best
   * Select the best asset for a scene using multi-criteria decision making
   */
  async selectBestAsset(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation - reuse evaluation request schema
      const body = await c.req.json()
      const validatedRequest = AssetEvaluationRequestSchema.parse(body)

      console.log(`[${requestId}] Selecting best asset from ${validatedRequest.assetIds.length} options for scene "${validatedRequest.sceneContext.textContent}"`)

      // Select best asset - we'll need to fetch the actual assets first based on assetIds
      const mockAssets: any[] = [] // In real implementation, this would fetch assets by IDs
      const selectionResult = await this.assetService.selectBestAsset(mockAssets, {
        prioritizeQuality: true,
        prioritizeRelevance: true,
        minimumScore: 0.7,
        avoidDuplicates: true
      })

      if (!selectionResult.success) {
        return c.json({
          success: false,
          error: selectionResult.error || 'Asset selection failed',
          timestamp: new Date().toISOString(),
          requestId
        }, 500)
      }

      const response = {
        success: true,
        data: {
          selectedAsset: selectionResult.data,
          summary: {
            sceneId: validatedRequest.sceneContext.sceneId,
            candidatesConsidered: validatedRequest.assetIds.length,
            selectedScore: selectionResult.data?.overallScore,
            confidence: selectionResult.metadata?.executionTime,
            processingTime: Date.now() - startTime
          },
          metadata: selectionResult.metadata
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Selected best asset (score: ${selectionResult.data?.overallScore}) in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset selection failed:`, error)

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
   * POST /api/assets/batch-process
   * Process multiple scenes for asset discovery in batch
   */
  async batchProcessScenes(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Input validation
      const body = await c.req.json()
      const validatedRequest = BatchAssetRequestSchema.parse(body)

      console.log(`[${requestId}] Batch processing ${validatedRequest.scenes.length} scenes for job ${validatedRequest.jobId}`)

      const results = []
      const preferences = validatedRequest.preferences || {}

      // Process each scene
      for (const scene of validatedRequest.scenes) {
        try {
          const sceneStartTime = Date.now()

          // Search for assets
          const searchRequest: AssetSearchRequest = {
            query: scene.searchQuery,
            type: scene.requirements?.mediaType || 'image',
            maxResults: preferences?.maxResultsPerScene || 10,
            providers: preferences?.providers || ['pexels', 'pixabay'],
            license: 'all',
            orientation: 'vertical',
            minResolution: { width: 720, height: 1280 },
            minQuality: 0.6,
            excludeAI: false
          }

          const searchResult = await this.assetService.searchAssets(searchRequest)

          let evaluatedAssets = searchResult.data || []
          let selectedAsset = null

          // Evaluate assets if requested
          if (preferences?.evaluateAssets && searchResult.success && searchResult.data) {
            const evalRequest: AssetEvaluationRequest = {
              assetIds: searchResult.data.map(asset => asset.id),
              sceneContext: {
                sceneId: scene.sceneId,
                textContent: scene.searchQuery,
                visualKeywords: scene.visualKeywords,
                duration: scene.duration || 5,
                sceneType: 'main'
              },
              criteria: ['relevance', 'visual_quality', 'tiktok_suitability'],
              evaluationModel: 'claude_vision',
              includeAlternatives: true
            }

            const evalResult = await this.assetService.evaluateAssets(evalRequest)
            if (evalResult.success && evalResult.data) {
              // The evaluation result returns EvaluatedAsset[], but we need AssetSearchResult[]
              // In a real implementation, we'd need to map these properly
              evaluatedAssets = searchResult.data // Keep the original search results for now
            }
          }

          // Select best asset if requested
          if (preferences?.selectBest && evaluatedAssets.length > 0) {
            const selectionResult = await this.assetService.selectBestAsset(
              evaluatedAssets,
              {
                sceneId: scene.sceneId,
                textContent: scene.searchQuery,
                visualKeywords: scene.visualKeywords,
                duration: scene.duration || 5,
                sceneType: 'main'
              }
            )

            if (selectionResult.success && selectionResult.data) {
              selectedAsset = selectionResult.data
            }
          }

          results.push({
            sceneId: scene.sceneId,
            searchQuery: scene.searchQuery,
            success: true,
            assetsFound: searchResult.data?.length || 0,
            evaluatedAssets: preferences?.evaluateAssets ? evaluatedAssets : undefined,
            selectedAsset: preferences?.selectBest ? selectedAsset : undefined,
            processingTime: Date.now() - sceneStartTime
          })

        } catch (sceneError) {
          console.error(`[${requestId}] Failed to process scene ${scene.sceneId}:`, sceneError)
          results.push({
            sceneId: scene.sceneId,
            searchQuery: scene.searchQuery,
            success: false,
            error: sceneError instanceof Error ? sceneError.message : 'Unknown error',
            processingTime: Date.now() - Date.now()
          })
        }
      }

      const successfulScenes = results.filter(r => r.success)
      const failedScenes = results.filter(r => !r.success)

      const response = {
        success: true,
        data: {
          results,
          summary: {
            jobId: validatedRequest.jobId,
            totalScenes: validatedRequest.scenes.length,
            successfulScenes: successfulScenes.length,
            failedScenes: failedScenes.length,
            totalAssetsFound: successfulScenes.reduce((sum, r) => sum + (r.assetsFound || 0), 0),
            averageProcessingTime: successfulScenes.reduce((sum, r) => sum + r.processingTime, 0) / Math.max(successfulScenes.length, 1),
            totalProcessingTime: Date.now() - startTime
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Batch processed ${validatedRequest.scenes.length} scenes in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Batch processing failed:`, error)

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
   * PUT /api/assets/override/:sceneId
   * Override asset selection for a specific scene
   */
  async overrideAsset(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const sceneId = c.req.param('sceneId')
      
      if (!sceneId) {
        return c.json({
          success: false,
          error: 'Scene ID is required',
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      // Input validation
      const body = await c.req.json()
      const validatedRequest = AssetOverrideRequestSchema.parse({
        ...body,
        sceneId
      })

      console.log(`[${requestId}] Overriding asset for scene ${sceneId} with ${validatedRequest.assetUrl}`)

      // This would typically update the asset selection in storage
      // For now, we'll just return a success response
      const overrideRecord = {
        sceneId: validatedRequest.sceneId,
        originalAssetUrl: null, // Would be loaded from storage
        newAssetUrl: validatedRequest.assetUrl,
        assetType: validatedRequest.assetType,
        reason: validatedRequest.reason,
        overriddenAt: new Date().toISOString(),
        metadata: validatedRequest.metadata
      }

      const response = {
        success: true,
        data: {
          override: overrideRecord,
          summary: {
            sceneId: validatedRequest.sceneId,
            assetType: validatedRequest.assetType,
            processingTime: Date.now() - startTime
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Successfully overrode asset for scene ${sceneId} in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset override failed:`, error)

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
   * GET /api/assets/health
   * Health check endpoint for asset services
   */
  async healthCheck(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()

    try {
      // Check service health by testing provider availability
      // This is a simplified check - in production, you'd ping actual providers
      const providerHealth = {
        Pexels: 'healthy',
        Pixabay: 'healthy', 
        Replicate: 'healthy'
      }

      const response = {
        success: true,
        data: {
          status: 'healthy',
          services: {
            assetDiscovery: 'healthy',
            assetGeneration: 'healthy',
            assetEvaluation: 'healthy'
          },
          providers: providerHealth,
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
 * Create and configure asset API routes
 */
export function createAssetRoutes(env: Env): Hono {
  const app = new Hono()
  const handlers = new AssetHandlers(env)

  // Search assets endpoint
  app.post('/search', async (c) => {
    return handlers.searchAssets(c)
  })

  // Generate assets endpoint
  app.post('/generate', async (c) => {
    return handlers.generateAssets(c)
  })

  // Evaluate assets endpoint
  app.post('/evaluate', async (c) => {
    return handlers.evaluateAssets(c)
  })

  // Select best asset endpoint
  app.post('/select-best', async (c) => {
    return handlers.selectBestAsset(c)
  })

  // Batch process scenes endpoint
  app.post('/batch-process', async (c) => {
    return handlers.batchProcessScenes(c)
  })

  // Override asset endpoint
  app.put('/override/:sceneId', async (c) => {
    return handlers.overrideAsset(c)
  })

  // Health check endpoint
  app.get('/health', async (c) => {
    return handlers.healthCheck(c)
  })

  return app
}