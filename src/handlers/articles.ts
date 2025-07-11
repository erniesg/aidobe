import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import { createAlgoliaService, type AlgoliaArticle } from '../services/algolia'

// Request schemas for article endpoints
const SearchArticlesRequestSchema = z.object({
  query: z.string().optional(),
  filters: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  page: z.number().int().min(0).default(0)
})

const GetArticleByIdRequestSchema = z.object({
  objectId: z.string().min(1, 'Object ID is required')
})

const SearchByTitleRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  exact: z.boolean().default(false)
})

const AdvancedSearchRequestSchema = z.object({
  query: z.string().optional(),
  author: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  minReadingTime: z.number().int().min(1).optional(),
  maxReadingTime: z.number().int().max(60).optional(),
  publishedAfter: z.string().datetime().optional(),
  publishedBefore: z.string().datetime().optional(),
  hasImage: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20)
})

// Response schemas
const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid()
})

export class ArticleHandlers {
  private algoliaService: any

  constructor(private env: Env) {
    this.algoliaService = createAlgoliaService(env)
  }

  /**
   * GET /api/articles/search
   * Search articles in Algolia index with various filters
   */
  async searchArticles(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      // Parse query parameters
      const query = c.req.query('query') || ''
      const filters = c.req.query('filters') || ''
      const author = c.req.query('author')
      const category = c.req.query('category')
      const tags = c.req.query('tags') ? c.req.query('tags').split(',') : undefined
      const limit = parseInt(c.req.query('limit') || '20')
      const page = parseInt(c.req.query('page') || '0')

      // Validate request
      const validatedRequest = SearchArticlesRequestSchema.parse({
        query: query || undefined,
        filters: filters || undefined,
        author,
        category,
        tags,
        limit,
        page
      })

      console.log(`[${requestId}] Searching articles with query: "${validatedRequest.query || 'all'}"`)

      // Search articles
      const searchResult = await this.algoliaService.searchArticles({
        query: validatedRequest.query,
        filters: validatedRequest.filters,
        hitsPerPage: validatedRequest.limit,
        page: validatedRequest.page
      })

      const response = {
        success: true,
        data: {
          articles: searchResult.hits,
          pagination: {
            total: searchResult.nbHits,
            page: searchResult.page,
            totalPages: searchResult.nbPages,
            limit: searchResult.hitsPerPage
          },
          query: searchResult.query,
          processingTimeMS: searchResult.processingTimeMS
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Found ${searchResult.hits.length} articles in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Article search failed:`, error)

      if (error instanceof z.ZodError) {
        return c.json({
          success: false,
          error: 'Invalid request parameters',
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
        error: error instanceof Error ? error.message : 'Article search failed',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * GET /api/articles/:objectId
   * Get a specific article by its Algolia object ID
   */
  async getArticleById(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const objectId = c.req.param('objectId')
      
      if (!objectId) {
        return c.json({
          success: false,
          error: 'Object ID is required',
          timestamp: new Date().toISOString(),
          requestId
        }, 400)
      }

      console.log(`[${requestId}] Getting article by ID: ${objectId}`)

      // Get article by ID
      const article = await this.algoliaService.getArticleById(objectId)

      if (!article) {
        return c.json({
          success: false,
          error: 'Article not found',
          timestamp: new Date().toISOString(),
          requestId
        }, 404)
      }

      const response = {
        success: true,
        data: {
          article
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Retrieved article "${article.title}" in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Get article by ID failed:`, error)

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get article',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/articles/search/title
   * Search articles by title (exact or partial match)
   */
  async searchByTitle(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const body = await c.req.json()
      const validatedRequest = SearchByTitleRequestSchema.parse(body)

      console.log(`[${requestId}] Searching by title: "${validatedRequest.title}" (exact: ${validatedRequest.exact})`)

      // Search by title
      const articles = validatedRequest.exact 
        ? await this.algoliaService.searchByTitle(validatedRequest.title)
        : await this.algoliaService.searchByPartialTitle(validatedRequest.title)

      const response = {
        success: true,
        data: {
          articles,
          count: articles.length,
          searchType: validatedRequest.exact ? 'exact' : 'partial',
          title: validatedRequest.title
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Found ${articles.length} articles by title in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Search by title failed:`, error)

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
        error: error instanceof Error ? error.message : 'Title search failed',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * GET /api/articles/video-candidates
   * Get articles that are good candidates for video script generation
   */
  async getVideoScriptCandidates(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const limit = parseInt(c.req.query('limit') || '20')

      console.log(`[${requestId}] Getting video script candidates (limit: ${limit})`)

      // Get articles suitable for video generation
      const articles = await this.algoliaService.getVideoScriptCandidates(limit)

      const response = {
        success: true,
        data: {
          articles,
          count: articles.length,
          criteria: {
            minContentLength: 500,
            minTitleLength: 10,
            description: 'Articles with sufficient content for engaging video scripts'
          }
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Found ${articles.length} video script candidates in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Get video candidates failed:`, error)

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get video candidates',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * POST /api/articles/search/advanced
   * Advanced search with multiple filters and criteria
   */
  async advancedSearch(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const body = await c.req.json()
      const validatedRequest = AdvancedSearchRequestSchema.parse(body)

      console.log(`[${requestId}] Advanced search with filters:`, {
        query: validatedRequest.query,
        author: validatedRequest.author,
        category: validatedRequest.category,
        tags: validatedRequest.tags
      })

      // Perform advanced search
      const articles = await this.algoliaService.advancedSearch({
        query: validatedRequest.query,
        author: validatedRequest.author,
        category: validatedRequest.category,
        tags: validatedRequest.tags,
        minReadingTime: validatedRequest.minReadingTime,
        maxReadingTime: validatedRequest.maxReadingTime,
        publishedAfter: validatedRequest.publishedAfter ? new Date(validatedRequest.publishedAfter) : undefined,
        publishedBefore: validatedRequest.publishedBefore ? new Date(validatedRequest.publishedBefore) : undefined,
        hasImage: validatedRequest.hasImage,
        limit: validatedRequest.limit
      })

      const response = {
        success: true,
        data: {
          articles,
          count: articles.length,
          filters: validatedRequest
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Advanced search found ${articles.length} articles in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Advanced search failed:`, error)

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
        error: error instanceof Error ? error.message : 'Advanced search failed',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }

  /**
   * GET /api/articles/recent
   * Get recently published articles
   */
  async getRecentArticles(c: any): Promise<Response> {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      const days = parseInt(c.req.query('days') || '30')

      console.log(`[${requestId}] Getting articles from last ${days} days`)

      // Get recent articles
      const articles = await this.algoliaService.searchRecentArticles(days)

      const response = {
        success: true,
        data: {
          articles,
          count: articles.length,
          period: `${days} days`,
          cutoffDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        },
        timestamp: new Date().toISOString(),
        requestId
      }

      console.log(`[${requestId}] Found ${articles.length} recent articles in ${Date.now() - startTime}ms`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Get recent articles failed:`, error)

      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent articles',
        timestamp: new Date().toISOString(),
        requestId
      }, 500)
    }
  }
}

/**
 * Create article routes
 */
export function createArticleRoutes(handlers: ArticleHandlers) {
  const app = new Hono()

  // Search articles
  app.get('/search', (c) => handlers.searchArticles(c))
  
  // Get article by ID
  app.get('/:objectId', (c) => handlers.getArticleById(c))
  
  // Search by title
  app.post('/search/title', (c) => handlers.searchByTitle(c))
  
  // Get video script candidates
  app.get('/video-candidates', (c) => handlers.getVideoScriptCandidates(c))
  
  // Advanced search
  app.post('/search/advanced', (c) => handlers.advancedSearch(c))
  
  // Get recent articles
  app.get('/recent', (c) => handlers.getRecentArticles(c))

  return app
}