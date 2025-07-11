import type { Env } from '../types/env'

export interface AlgoliaArticle {
  objectID: string
  title: string
  content: string
  excerpt?: string
  author?: string
  publishedAt?: string
  url?: string
  tags?: string[]
  category?: string
  readingTime?: number
  featuredImage?: string
  seo?: {
    metaTitle?: string
    metaDescription?: string
  }
}

export interface AlgoliaSearchResult {
  hits: AlgoliaArticle[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
  processingTimeMS: number
  query: string
}

export interface AlgoliaSearchParams {
  query?: string
  filters?: string
  attributesToRetrieve?: string[]
  hitsPerPage?: number
  page?: number
}

/**
 * Service for searching and retrieving articles from Algolia index
 */
export class AlgoliaService {
  private appId: string
  private apiKey: string
  private indexName: string = 'posts-v2'
  private baseUrl: string

  constructor(env: Env) {
    this.appId = env.ALGOLIA_APP_ID
    this.apiKey = env.ALGOLIA_API_KEY
    this.baseUrl = `https://${this.appId}-dsn.algolia.net/1/indexes/${this.indexName}`
  }

  /**
   * Search articles by title or content
   */
  async searchArticles(params: AlgoliaSearchParams): Promise<AlgoliaSearchResult> {
    const searchParams = new URLSearchParams()
    
    if (params.query) {
      searchParams.append('query', params.query)
    }
    
    if (params.filters) {
      searchParams.append('filters', params.filters)
    }
    
    if (params.attributesToRetrieve) {
      searchParams.append('attributesToRetrieve', params.attributesToRetrieve.join(','))
    }
    
    searchParams.append('hitsPerPage', (params.hitsPerPage || 20).toString())
    searchParams.append('page', (params.page || 0).toString())

    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': this.appId,
        'X-Algolia-API-Key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: params.query || '',
        filters: params.filters || '',
        attributesToRetrieve: params.attributesToRetrieve || [
          'objectID', 'title', 'content', 'excerpt', 'author', 
          'publishedAt', 'url', 'tags', 'category', 'readingTime', 'featuredImage'
        ],
        hitsPerPage: params.hitsPerPage || 20,
        page: params.page || 0
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Algolia search failed: ${response.status} - ${error}`)
    }

    return await response.json()
  }

  /**
   * Get a specific article by object ID
   */
  async getArticleById(objectId: string): Promise<AlgoliaArticle | null> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(objectId)}`, {
      method: 'GET',
      headers: {
        'X-Algolia-Application-Id': this.appId,
        'X-Algolia-API-Key': this.apiKey
      }
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Algolia get article failed: ${response.status} - ${error}`)
    }

    return await response.json()
  }

  /**
   * Search articles by exact title match
   */
  async searchByTitle(title: string): Promise<AlgoliaArticle[]> {
    const result = await this.searchArticles({
      filters: `title:"${title}"`,
      hitsPerPage: 10
    })
    
    return result.hits
  }

  /**
   * Search articles by partial title match
   */
  async searchByPartialTitle(titleFragment: string): Promise<AlgoliaArticle[]> {
    const result = await this.searchArticles({
      query: titleFragment,
      attributesToRetrieve: [
        'objectID', 'title', 'content', 'excerpt', 'author', 
        'publishedAt', 'url', 'tags', 'readingTime'
      ],
      hitsPerPage: 10
    })
    
    return result.hits
  }

  /**
   * Search articles by author
   */
  async searchByAuthor(author: string): Promise<AlgoliaArticle[]> {
    const result = await this.searchArticles({
      filters: `author:"${author}"`,
      hitsPerPage: 20
    })
    
    return result.hits
  }

  /**
   * Search articles by category or tags
   */
  async searchByCategory(category: string): Promise<AlgoliaArticle[]> {
    const result = await this.searchArticles({
      filters: `category:"${category}" OR tags:"${category}"`,
      hitsPerPage: 20
    })
    
    return result.hits
  }

  /**
   * Search recent articles (published within last N days)
   */
  async searchRecentArticles(days: number = 30): Promise<AlgoliaArticle[]> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const timestamp = Math.floor(cutoffDate.getTime() / 1000)

    const result = await this.searchArticles({
      filters: `publishedAt >= ${timestamp}`,
      hitsPerPage: 50
    })
    
    return result.hits
  }

  /**
   * Get articles suitable for video script generation
   * Filters for articles with sufficient content and good engagement potential
   */
  async getVideoScriptCandidates(limit: number = 20): Promise<AlgoliaArticle[]> {
    const result = await this.searchArticles({
      // Filter for articles with sufficient content (at least 500 chars)
      // and published within last 60 days for relevancy
      filters: `NOT content:""`,
      attributesToRetrieve: [
        'objectID', 'title', 'content', 'excerpt', 'author', 
        'publishedAt', 'url', 'tags', 'readingTime', 'featuredImage'
      ],
      hitsPerPage: limit
    })
    
    // Filter articles with sufficient content length on client side
    return result.hits.filter(article => 
      article.content && 
      article.content.length >= 500 && 
      article.title && 
      article.title.length >= 10
    )
  }

  /**
   * Search articles with advanced filters
   */
  async advancedSearch(options: {
    query?: string
    author?: string
    category?: string
    tags?: string[]
    minReadingTime?: number
    maxReadingTime?: number
    publishedAfter?: Date
    publishedBefore?: Date
    hasImage?: boolean
    limit?: number
  }): Promise<AlgoliaArticle[]> {
    const filters: string[] = []

    if (options.author) {
      filters.push(`author:"${options.author}"`)
    }

    if (options.category) {
      filters.push(`category:"${options.category}"`)
    }

    if (options.tags && options.tags.length > 0) {
      const tagFilters = options.tags.map(tag => `tags:"${tag}"`).join(' OR ')
      filters.push(`(${tagFilters})`)
    }

    if (options.minReadingTime) {
      filters.push(`readingTime >= ${options.minReadingTime}`)
    }

    if (options.maxReadingTime) {
      filters.push(`readingTime <= ${options.maxReadingTime}`)
    }

    if (options.publishedAfter) {
      const timestamp = Math.floor(options.publishedAfter.getTime() / 1000)
      filters.push(`publishedAt >= ${timestamp}`)
    }

    if (options.publishedBefore) {
      const timestamp = Math.floor(options.publishedBefore.getTime() / 1000)
      filters.push(`publishedAt <= ${timestamp}`)
    }

    if (options.hasImage !== undefined) {
      if (options.hasImage) {
        filters.push(`NOT featuredImage:""`)
      } else {
        filters.push(`featuredImage:""`)
      }
    }

    const result = await this.searchArticles({
      query: options.query || '',
      filters: filters.join(' AND '),
      hitsPerPage: options.limit || 20
    })

    return result.hits
  }
}

/**
 * Factory function to create Algolia service
 */
export function createAlgoliaService(env: Env): AlgoliaService {
  return new AlgoliaService(env)
}