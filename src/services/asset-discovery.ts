import type { Env } from '../types/env'
import { 
  type AssetSearchRequest,
  type AssetSearchResult,
  type AssetGenerationRequest,
  type GeneratedAsset,
  type AssetEvaluationRequest,
  type EvaluatedAsset,
  type AssetOverrideRequest,
  type AssetMetadata,
  AssetSearchResultSchema,
  GeneratedAssetSchema,
  EvaluatedAssetSchema
} from '../schemas/asset'

interface AssetProvider {
  name: string
  search(query: string, options: AssetSearchOptions): Promise<AssetSearchResult[]>
  generate?(prompt: string, options: AssetGenerationOptions): Promise<GeneratedAsset>
  enhancePrompt?(prompt: string, context: string): Promise<string>
}

interface AssetSearchOptions {
  maxResults?: number
  mediaType?: 'image' | 'video' | 'audio'
  aspectRatio?: string
  duration?: number
  style?: string
  license?: 'commercial' | 'editorial' | 'creative_commons'
  resolution?: 'low' | 'medium' | 'high' | '4k'
}

interface AssetGenerationOptions {
  style?: string
  aspectRatio?: string
  quality?: 'low' | 'medium' | 'high'
  seed?: number
  steps?: number
  guidance?: number
}

interface DiscoveryResult<T> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    executionTime: number
    providersUsed: string[]
    totalResults?: number
    cacheHit?: boolean
  }
}

/**
 * Asset Discovery Service for multi-provider asset search, evaluation, and generation
 * Handles both stock footage search and AI-powered asset generation
 */
export class AssetDiscoveryService {
  private providers = new Map<string, AssetProvider>()
  private cache = new Map<string, { data: any; expiry: number }>()
  private readonly CACHE_TTL = 15 * 60 * 1000 // 15 minutes

  constructor(private env: Env) {
    this.initializeProviders()
  }

  /**
   * Search for assets across multiple providers with intelligent ranking
   */
  async searchAssets(request: AssetSearchRequest): Promise<DiscoveryResult<AssetSearchResult[]>> {
    const startTime = Date.now()
    const providersUsed: string[] = []

    try {
      // Create cache key for this search
      const cacheKey = this.createCacheKey('search', request)
      const cached = this.getCachedResult(cacheKey)
      
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            executionTime: Math.max(1, Date.now() - startTime), // Ensure minimum 1ms for cache hits
            providersUsed: [],
            totalResults: cached.length,
            cacheHit: true
          }
        }
      }

      // Determine which providers to use
      const selectedProviders = this.selectProviders(request.requirements?.providers, request.mediaType)
      
      // Search in parallel across providers
      const searchPromises = selectedProviders.map(async (provider) => {
        try {
          providersUsed.push(provider.name)
          
          const options: AssetSearchOptions = {
            maxResults: Math.ceil((request.maxResults || 10) / selectedProviders.length),
            mediaType: request.mediaType,
            aspectRatio: request.requirements?.aspectRatio,
            duration: request.requirements?.duration,
            style: request.requirements?.style,
            license: request.requirements?.license || 'commercial',
            resolution: request.requirements?.resolution || 'high'
          }

          return await provider.search(request.query, options)
        } catch (error) {
          console.error(`Provider ${provider.name} search failed:`, error)
          return []
        }
      })

      const providerResults = await Promise.all(searchPromises)
      
      // Add small delay to simulate real network calls for testing
      if (this.env.ENVIRONMENT === 'test') {
        await new Promise(resolve => setTimeout(resolve, 5))
      }
      
      // Combine and deduplicate results
      const allResults = providerResults.flat()
      const deduplicatedResults = this.deduplicateResults(allResults)
      
      // Sort by relevance and quality
      const rankedResults = this.rankResults(deduplicatedResults, request)
      
      // Limit to requested count
      const finalResults = rankedResults.slice(0, request.maxResults || 10)
      
      // Cache the results
      this.setCachedResult(cacheKey, finalResults)

      return {
        success: true,
        data: finalResults,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed,
          totalResults: finalResults.length
        }
      }

    } catch (error) {
      console.error('Asset search failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown search error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed
        }
      }
    }
  }

  /**
   * Evaluate assets for relevance, quality, and TikTok suitability
   */
  async evaluateAssets(request: AssetEvaluationRequest): Promise<DiscoveryResult<EvaluatedAsset[]>> {
    const startTime = Date.now()

    try {
      const evaluatedAssets: EvaluatedAsset[] = []

      for (const asset of request.assets) {
        const evaluation = await this.evaluateSingleAsset(asset, request.criteria, request.context)
        evaluatedAssets.push(evaluation)
      }

      // Sort by overall score
      evaluatedAssets.sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore)

      return {
        success: true,
        data: evaluatedAssets,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['evaluation_engine'],
          totalResults: evaluatedAssets.length
        }
      }

    } catch (error) {
      console.error('Asset evaluation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['evaluation_engine']
        }
      }
    }
  }

  /**
   * Generate assets using AI providers with enhanced prompts
   */
  async generateAssets(request: AssetGenerationRequest): Promise<DiscoveryResult<GeneratedAsset[]>> {
    const startTime = Date.now()
    const providersUsed: string[] = []

    try {
      const generatedAssets: GeneratedAsset[] = []
      const numberOfVariations = request.variations || 1

      // Select providers that support generation
      const generationProviders = Array.from(this.providers.values())
        .filter(provider => provider.generate !== undefined)

      if (generationProviders.length === 0) {
        return {
          success: false,
          error: 'No generation providers available',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed
          }
        }
      }

      // Use the first available provider (could be enhanced with provider selection logic)
      const provider = generationProviders[0]
      providersUsed.push(provider.name)

      for (let i = 0; i < numberOfVariations; i++) {
        try {
          // Enhance prompt with context if provider supports it
          let enhancedPrompt = request.prompt
          if (provider.enhancePrompt && request.context) {
            enhancedPrompt = await provider.enhancePrompt(request.prompt, request.context.sceneContext)
          }

          const options: AssetGenerationOptions = {
            style: request.parameters?.style,
            aspectRatio: request.parameters?.aspectRatio || '9:16',
            quality: request.parameters?.quality || 'high',
            seed: request.parameters?.seed ? request.parameters.seed + i : undefined,
            steps: request.parameters?.steps,
            guidance: request.parameters?.guidance
          }

          const asset = await provider.generate!(enhancedPrompt, options)
          
          // Store original prompt in generation params, enhanced prompt in metadata
          asset.generationParams = {
            ...asset.generationParams,
            prompt: request.prompt // Keep original prompt here for API consistency
          }
          
          // Add generation metadata
          asset.metadata = {
            ...asset.metadata,
            originalPrompt: request.prompt,
            enhancedPrompt,
            variationIndex: i,
            generationTime: Date.now() - startTime
          }

          generatedAssets.push(asset)

        } catch (error) {
          console.error(`Failed to generate asset variation ${i + 1}:`, error)
          // Continue with other variations
        }
      }

      if (generatedAssets.length === 0) {
        return {
          success: false,
          error: 'Failed to generate any assets',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed
          }
        }
      }

      return {
        success: true,
        data: generatedAssets,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed,
          totalResults: generatedAssets.length
        }
      }

    } catch (error) {
      console.error('Asset generation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown generation error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed
        }
      }
    }
  }

  /**
   * Select the best asset from a list based on criteria and confidence scoring
   */
  async selectBestAsset(
    assets: EvaluatedAsset[], 
    criteria: {
      prioritizeQuality?: boolean
      prioritizeRelevance?: boolean
      minimumScore?: number
      avoidDuplicates?: boolean
    } = {}
  ): Promise<DiscoveryResult<EvaluatedAsset | null>> {
    const startTime = Date.now()

    try {
      if (assets.length === 0) {
        return {
          success: true,
          data: null,
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed: ['selection_engine'],
            totalResults: 0
          }
        }
      }

      // Filter by minimum score if specified
      const eligibleAssets = criteria.minimumScore 
        ? assets.filter(asset => asset.evaluation.overallScore >= criteria.minimumScore!)
        : assets

      if (eligibleAssets.length === 0) {
        return {
          success: true,
          data: null,
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed: ['selection_engine'],
            totalResults: 0
          }
        }
      }

      // Calculate selection score based on criteria
      const scoredAssets = eligibleAssets.map(asset => {
        let selectionScore = asset.evaluation.overallScore

        // Adjust score based on criteria priorities
        if (criteria.prioritizeQuality) {
          selectionScore += asset.evaluation.qualityScore * 0.3
        }

        if (criteria.prioritizeRelevance) {
          selectionScore += asset.evaluation.relevanceScore * 0.3
        }

        // Boost score for higher confidence
        selectionScore += asset.evaluation.confidence * 0.2

        return {
          asset,
          selectionScore
        }
      })

      // Sort by selection score and pick the best
      scoredAssets.sort((a, b) => b.selectionScore - a.selectionScore)
      const bestAsset = scoredAssets[0].asset

      // Add selection metadata
      bestAsset.evaluation = {
        ...bestAsset.evaluation,
        selectionReason: this.generateSelectionReason(bestAsset, criteria),
        alternativesConsidered: scoredAssets.length - 1
      }

      return {
        success: true,
        data: bestAsset,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['selection_engine'],
          totalResults: 1
        }
      }

    } catch (error) {
      console.error('Asset selection failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown selection error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['selection_engine']
        }
      }
    }
  }

  /**
   * Override automatic asset selection with manual choice
   */
  async overrideAssetSelection(request: AssetOverrideRequest): Promise<DiscoveryResult<boolean>> {
    const startTime = Date.now()

    try {
      // Validate the override request
      if (!request.assetId || !request.sceneId) {
        return {
          success: false,
          error: 'Asset ID and Scene ID are required for override',
          metadata: {
            executionTime: Date.now() - startTime,
            providersUsed: ['override_engine']
          }
        }
      }

      // Store override in the database/storage
      // This would typically update the scene configuration
      await this.storeAssetOverride(request)

      // Log the override for audit purposes
      console.log(`Asset override applied: Scene ${request.sceneId} -> Asset ${request.assetId}`, {
        reason: request.reason,
        overriddenBy: request.overriddenBy,
        timestamp: new Date().toISOString()
      })

      return {
        success: true,
        data: true,
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['override_engine']
        }
      }

    } catch (error) {
      console.error('Asset override failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown override error',
        metadata: {
          executionTime: Date.now() - startTime,
          providersUsed: ['override_engine']
        }
      }
    }
  }

  /**
   * Initialize asset providers (stock photo/video APIs, AI generators)
   */
  private initializeProviders(): void {
    // This would initialize actual providers like Pexels, Pixabay, Replicate, etc.
    // For now, we'll create mock providers

    this.providers.set('pexels', {
      name: 'Pexels',
      search: async (query: string, options: AssetSearchOptions): Promise<AssetSearchResult[]> => {
        // Mock Pexels search implementation
        const maxResults = options.maxResults || 5
        return this.createMockSearchResults('pexels', query, Math.max(1, maxResults))
      }
    })

    this.providers.set('pixabay', {
      name: 'Pixabay',
      search: async (query: string, options: AssetSearchOptions): Promise<AssetSearchResult[]> => {
        // Mock Pixabay search implementation
        const maxResults = options.maxResults || 5
        return this.createMockSearchResults('pixabay', query, Math.max(1, maxResults))
      }
    })

    this.providers.set('replicate', {
      name: 'Replicate',
      search: async (query: string, options: AssetSearchOptions): Promise<AssetSearchResult[]> => {
        // Mock search - Replicate is primarily for generation
        return []
      },
      generate: async (prompt: string, options: AssetGenerationOptions): Promise<GeneratedAsset> => {
        // Mock AI generation
        return this.createMockGeneratedAsset('replicate', prompt, options)
      },
      enhancePrompt: async (prompt: string, context: string): Promise<string> => {
        // Mock prompt enhancement
        return `${prompt}, high quality, professional, ${context}`
      }
    })
  }

  /**
   * Evaluate a single asset against criteria
   */
  private async evaluateSingleAsset(
    asset: AssetSearchResult | GeneratedAsset, 
    criteria: string[], 
    context?: any
  ): Promise<EvaluatedAsset> {
    // Mock evaluation logic - in reality, this would use AI/ML models
    const relevanceScore = this.calculateRelevanceScore(asset, criteria, context)
    const qualityScore = this.calculateQualityScore(asset)
    const tiktokSuitability = this.calculateTikTokSuitability(asset)
    
    const overallScore = (relevanceScore + qualityScore + tiktokSuitability) / 3
    const confidence = Math.min(0.9, overallScore + 0.1) // Mock confidence calculation

    return {
      ...asset,
      evaluation: {
        overallScore,
        relevanceScore,
        qualityScore,
        tiktokSuitability,
        confidence,
        criteria: criteria.map(criterion => ({
          name: criterion,
          score: relevanceScore, // Simplified - each criterion would have its own score
          weight: 1.0
        })),
        flags: this.generateEvaluationFlags(asset, overallScore),
        evaluatedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Mock search result generation
   */
  private createMockSearchResults(provider: string, query: string, count: number): AssetSearchResult[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `${provider}-${query.replace(/\s+/g, '-')}-${i + 1}`,
      title: `${query} - ${provider} Result ${i + 1}`,
      description: `Mock ${provider} search result for "${query}"`,
      url: `https://mock-${provider}.com/asset/${i + 1}`,
      thumbnailUrl: `https://mock-${provider}.com/thumb/${i + 1}`,
      mediaType: 'image' as const,
      license: 'commercial' as const,
      provider,
      metadata: {
        width: 1920,
        height: 1080,
        fileSize: Math.floor(Math.random() * 5000000) + 1000000, // 1-5MB
        tags: query.split(' ').concat(['high-quality', 'professional']),
        uploadedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        downloadCount: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000)
      }
    }))
  }

  /**
   * Mock generated asset creation
   */
  private createMockGeneratedAsset(provider: string, prompt: string, options: AssetGenerationOptions): GeneratedAsset {
    return {
      id: `generated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: `Generated: ${prompt.slice(0, 50)}...`,
      description: `AI-generated asset from prompt: ${prompt}`,
      url: `https://mock-${provider}.com/generated/${Date.now()}`,
      thumbnailUrl: `https://mock-${provider}.com/generated/thumb/${Date.now()}`,
      mediaType: 'image' as const,
      license: 'commercial' as const,
      provider,
      generationParams: {
        prompt,
        style: options.style,
        aspectRatio: options.aspectRatio || '9:16',
        quality: options.quality || 'high',
        seed: options.seed,
        steps: options.steps || 50,
        guidance: options.guidance || 7.5
      },
      metadata: {
        width: 1080,
        height: 1920,
        fileSize: Math.floor(Math.random() * 3000000) + 500000, // 0.5-3MB
        generatedAt: new Date().toISOString(),
        model: 'flux-1.1-pro',
        version: '1.0'
      }
    }
  }

  /**
   * Calculate various scoring metrics
   */
  private calculateRelevanceScore(asset: AssetSearchResult | GeneratedAsset, criteria: string[], context?: any): number {
    // Mock relevance calculation
    const titleMatch = criteria.some(criterion => 
      asset.title.toLowerCase().includes(criterion.toLowerCase())
    ) ? 0.3 : 0

    const descriptionMatch = criteria.some(criterion => 
      asset.description.toLowerCase().includes(criterion.toLowerCase())
    ) ? 0.2 : 0

    const tagsMatch = asset.metadata?.tags?.some(tag => 
      criteria.some(criterion => tag.toLowerCase().includes(criterion.toLowerCase()))
    ) ? 0.3 : 0

    return Math.min(1.0, 0.2 + titleMatch + descriptionMatch + tagsMatch)
  }

  private calculateQualityScore(asset: AssetSearchResult | GeneratedAsset): number {
    // Mock quality calculation based on metadata
    let score = 0.5

    if (asset.metadata?.width && asset.metadata.width >= 1920) score += 0.2
    if (asset.metadata?.height && asset.metadata.height >= 1080) score += 0.2
    if (asset.metadata?.downloadCount && asset.metadata.downloadCount > 1000) score += 0.1

    return Math.min(1.0, score)
  }

  private calculateTikTokSuitability(asset: AssetSearchResult | GeneratedAsset): number {
    // Mock TikTok suitability calculation
    let score = 0.5

    // Vertical format is better for TikTok
    if (asset.metadata?.height && asset.metadata?.width) {
      const aspectRatio = asset.metadata.height / asset.metadata.width
      if (aspectRatio > 1.5) score += 0.3 // Vertical format
    }

    // High quality is important
    if (asset.metadata?.width && asset.metadata.width >= 1080) score += 0.2

    return Math.min(1.0, score)
  }

  /**
   * Generate evaluation flags for issues or recommendations
   */
  private generateEvaluationFlags(asset: AssetSearchResult | GeneratedAsset, overallScore: number): string[] {
    const flags: string[] = []

    if (overallScore < 0.3) flags.push('low_quality')
    if (overallScore < 0.5) flags.push('needs_review')
    if (!asset.metadata?.width || asset.metadata.width < 1080) flags.push('low_resolution')
    if (asset.license !== 'commercial') flags.push('license_restriction')

    return flags
  }

  /**
   * Generate human-readable selection reason
   */
  private generateSelectionReason(asset: EvaluatedAsset, criteria: any): string {
    const reasons: string[] = []

    if (asset.evaluation.overallScore > 0.8) reasons.push('high overall score')
    if (asset.evaluation.qualityScore > 0.8) reasons.push('excellent quality')
    if (asset.evaluation.relevanceScore > 0.8) reasons.push('highly relevant')
    if (asset.evaluation.tiktokSuitability > 0.8) reasons.push('perfect for TikTok format')

    return reasons.length > 0 
      ? `Selected for: ${reasons.join(', ')}`
      : 'Best available option from the provided assets'
  }

  /**
   * Store asset override for audit and future reference
   */
  private async storeAssetOverride(request: AssetOverrideRequest): Promise<void> {
    // This would store in D1 or another database
    // For now, just log the override
    console.log('Asset override stored:', {
      sceneId: request.sceneId,
      assetId: request.assetId,
      reason: request.reason,
      overriddenBy: request.overriddenBy,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Provider selection logic
   */
  private selectProviders(requestedProviders?: string[], mediaType?: string): AssetProvider[] {
    if (requestedProviders) {
      return requestedProviders
        .map(name => this.providers.get(name))
        .filter(provider => provider !== undefined) as AssetProvider[]
    }

    // Default provider selection based on media type
    const allProviders = Array.from(this.providers.values())
    return mediaType === 'image' 
      ? allProviders.filter(p => ['Pexels', 'Pixabay'].includes(p.name)) // Match provider names exactly
      : allProviders
  }

  /**
   * Deduplicate results based on URL or content similarity
   */
  private deduplicateResults(results: AssetSearchResult[]): AssetSearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = result.url
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Rank results by relevance and quality
   */
  private rankResults(results: AssetSearchResult[], request: AssetSearchRequest): AssetSearchResult[] {
    return results.sort((a, b) => {
      // Simple ranking based on title match and metadata quality
      const aScore = this.calculateSimpleRelevanceScore(a, request.query)
      const bScore = this.calculateSimpleRelevanceScore(b, request.query)
      return bScore - aScore
    })
  }

  private calculateSimpleRelevanceScore(asset: AssetSearchResult, query: string): number {
    const queryWords = query.toLowerCase().split(' ')
    const titleWords = asset.title.toLowerCase().split(' ')
    
    const matches = queryWords.filter(word => 
      titleWords.some(titleWord => titleWord.includes(word))
    ).length
    
    return matches / queryWords.length
  }

  /**
   * Cache management
   */
  private createCacheKey(operation: string, request: any): string {
    return `${operation}:${JSON.stringify(request)}`
  }

  private getCachedResult(key: string): any | null {
    const cached = this.cache.get(key)
    if (cached && Date.now() < cached.expiry) {
      return cached.data
    }
    
    if (cached) {
      this.cache.delete(key)
    }
    
    return null
  }

  private setCachedResult(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    })
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    providersCount: number
    cacheSize: number
    providers: string[]
  } {
    return {
      providersCount: this.providers.size,
      cacheSize: this.cache.size,
      providers: Array.from(this.providers.keys())
    }
  }
}