import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AssetDiscoveryService } from '../../../src/services/asset-discovery'
import type { Env } from '../../../src/types/env'
import type { 
  AssetSearchRequest, 
  AssetEvaluationRequest, 
  AssetGenerationRequest,
  AssetOverrideRequest,
  AssetSearchResult,
  GeneratedAsset
} from '../../../src/schemas/asset'

const mockEnv: Env = {
  ENVIRONMENT: 'test',
  ACCESS_PASSWORD: 'test-password',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any
}

describe('AssetDiscoveryService', () => {
  let service: AssetDiscoveryService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AssetDiscoveryService(mockEnv)
  })

  describe('searchAssets', () => {
    it('should search across multiple providers and return ranked results', async () => {
      const request: AssetSearchRequest = {
        query: 'technology startup office',
        mediaType: 'image',
        maxResults: 5,
        requirements: {
          aspectRatio: '16:9',
          license: 'commercial',
          resolution: 'high'
        }
      }

      const result = await service.searchAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.length).toBeGreaterThan(0)
      expect(result.data!.length).toBeLessThanOrEqual(5)
      expect(result.metadata?.providersUsed).toContain('Pexels')
      expect(result.metadata?.providersUsed).toContain('Pixabay')
      expect(result.metadata?.executionTime).toBeGreaterThan(0)
    })

    it('should cache search results for performance', async () => {
      const request: AssetSearchRequest = {
        query: 'test query',
        mediaType: 'image',
        maxResults: 3
      }

      // First call
      const result1 = await service.searchAssets(request)
      expect(result1.metadata?.cacheHit).toBeFalsy()

      // Second call should hit cache
      const result2 = await service.searchAssets(request)
      expect(result2.metadata?.cacheHit).toBe(true)
      expect(result2.metadata?.executionTime).toBeLessThan(result1.metadata?.executionTime!)
    })

    it('should handle provider failures gracefully', async () => {
      // Mock a provider to fail
      const originalProviders = (service as any).providers
      const mockProvider = {
        name: 'FailingProvider',
        search: vi.fn().mockRejectedValue(new Error('Provider error'))
      }
      originalProviders.set('failing', mockProvider)

      const request: AssetSearchRequest = {
        query: 'test query',
        mediaType: 'image',
        maxResults: 3
      }

      const result = await service.searchAssets(request)

      // Should still succeed with other providers
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })

    it('should deduplicate results from multiple providers', async () => {
      const request: AssetSearchRequest = {
        query: 'unique test query',
        mediaType: 'image',
        maxResults: 10
      }

      const result = await service.searchAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      // Check for duplicate URLs
      const urls = result.data!.map(asset => asset.url)
      const uniqueUrls = new Set(urls)
      expect(urls.length).toBe(uniqueUrls.size)
    })

    it('should filter by media type correctly', async () => {
      const imageRequest: AssetSearchRequest = {
        query: 'test',
        mediaType: 'image',
        maxResults: 5
      }

      const result = await service.searchAssets(imageRequest)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      result.data!.forEach(asset => {
        expect(asset.mediaType).toBe('image')
      })
    })
  })

  describe('evaluateAssets', () => {
    it('should evaluate assets and return scores', async () => {
      const mockAssets: AssetSearchResult[] = [
        {
          id: 'test-asset-1',
          title: 'High Quality Tech Office',
          description: 'Modern startup office with great lighting',
          url: 'https://example.com/asset1',
          thumbnailUrl: 'https://example.com/thumb1',
          mediaType: 'image',
          license: 'commercial',
          provider: 'test',
          metadata: {
            width: 1920,
            height: 1080,
            tags: ['office', 'technology', 'startup']
          }
        },
        {
          id: 'test-asset-2',
          title: 'Low Quality Image',
          description: 'Blurry photo of something',
          url: 'https://example.com/asset2',
          thumbnailUrl: 'https://example.com/thumb2',
          mediaType: 'image',
          license: 'commercial',
          provider: 'test',
          metadata: {
            width: 640,
            height: 480,
            tags: ['blurry']
          }
        }
      ]

      const request: AssetEvaluationRequest = {
        assets: mockAssets,
        criteria: ['technology', 'office', 'startup'],
        context: {
          sceneType: 'intro',
          sceneContext: 'Technology startup office environment'
        }
      }

      const result = await service.evaluateAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!).toHaveLength(2)

      const evaluations = result.data!
      
      // Check that each asset has evaluation scores
      evaluations.forEach(asset => {
        expect(asset.evaluation).toBeDefined()
        expect(asset.evaluation.overallScore).toBeGreaterThanOrEqual(0)
        expect(asset.evaluation.overallScore).toBeLessThanOrEqual(1)
        expect(asset.evaluation.relevanceScore).toBeGreaterThanOrEqual(0)
        expect(asset.evaluation.qualityScore).toBeGreaterThanOrEqual(0)
        expect(asset.evaluation.tiktokSuitability).toBeGreaterThanOrEqual(0)
        expect(asset.evaluation.confidence).toBeGreaterThanOrEqual(0)
        expect(asset.evaluation.criteria).toHaveLength(3)
        expect(asset.evaluation.evaluatedAt).toBeDefined()
      })

      // Higher quality asset should have better scores
      const highQualityAsset = evaluations.find(a => a.id === 'test-asset-1')!
      const lowQualityAsset = evaluations.find(a => a.id === 'test-asset-2')!
      
      expect(highQualityAsset.evaluation.qualityScore).toBeGreaterThan(lowQualityAsset.evaluation.qualityScore)
      expect(highQualityAsset.evaluation.relevanceScore).toBeGreaterThan(lowQualityAsset.evaluation.relevanceScore)
    })

    it('should sort results by overall score', async () => {
      const mockAssets: AssetSearchResult[] = Array.from({ length: 5 }, (_, i) => ({
        id: `asset-${i}`,
        title: `Asset ${i}`,
        description: `Description ${i}`,
        url: `https://example.com/asset${i}`,
        thumbnailUrl: `https://example.com/thumb${i}`,
        mediaType: 'image' as const,
        license: 'commercial' as const,
        provider: 'test',
        metadata: {
          width: 1920 - i * 100, // Decreasing quality
          height: 1080,
          tags: ['test']
        }
      }))

      const request: AssetEvaluationRequest = {
        assets: mockAssets,
        criteria: ['test']
      }

      const result = await service.evaluateAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()

      // Should be sorted by overall score (descending)
      const scores = result.data!.map(asset => asset.evaluation.overallScore)
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i-1]).toBeGreaterThanOrEqual(scores[i])
      }
    })

    it('should handle empty asset list', async () => {
      const request: AssetEvaluationRequest = {
        assets: [],
        criteria: ['test']
      }

      const result = await service.evaluateAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  describe('generateAssets', () => {
    it('should generate assets with AI providers', async () => {
      const request: AssetGenerationRequest = {
        prompt: 'A modern tech startup office with developers working',
        mediaType: 'image',
        variations: 2,
        parameters: {
          style: 'modern',
          aspectRatio: '9:16',
          quality: 'high'
        },
        context: {
          sceneType: 'main',
          sceneContext: 'Office environment for tech video'
        }
      }

      const result = await service.generateAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!).toHaveLength(2)
      expect(result.metadata?.providersUsed).toContain('Replicate')

      result.data!.forEach((asset, index) => {
        expect(asset.id).toBeDefined()
        expect(asset.mediaType).toBe('image')
        expect(asset.generationParams).toBeDefined()
        expect(asset.generationParams?.prompt).toBe(request.prompt)
        expect(asset.metadata?.variationIndex).toBe(index)
        expect(asset.metadata?.originalPrompt).toBe(request.prompt)
        expect(asset.metadata?.enhancedPrompt).toContain(request.prompt)
      })
    })

    it('should handle generation failures gracefully', async () => {
      // Mock provider to fail
      const mockProvider = {
        name: 'FailingGenerator',
        generate: vi.fn().mockRejectedValue(new Error('Generation failed'))
      }
      ;(service as any).providers.set('failing', mockProvider)

      const request: AssetGenerationRequest = {
        prompt: 'test prompt',
        mediaType: 'image',
        variations: 1
      }

      // Force using the failing provider by clearing others
      ;(service as any).providers.clear()
      ;(service as any).providers.set('failing', mockProvider)

      const result = await service.generateAssets(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to generate any assets')
    })

    it('should enhance prompts when supported', async () => {
      const request: AssetGenerationRequest = {
        prompt: 'office',
        mediaType: 'image',
        variations: 1,
        context: {
          sceneType: 'intro',
          sceneContext: 'modern workspace'
        }
      }

      const result = await service.generateAssets(request)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data![0].metadata?.enhancedPrompt).toContain('office')
      expect(result.data![0].metadata?.enhancedPrompt).toContain('modern workspace')
    })

    it('should handle missing generation providers', async () => {
      // Clear all providers
      ;(service as any).providers.clear()

      const request: AssetGenerationRequest = {
        prompt: 'test prompt',
        mediaType: 'image',
        variations: 1
      }

      const result = await service.generateAssets(request)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No generation providers available')
    })
  })

  describe('selectBestAsset', () => {
    it('should select the highest scoring asset', async () => {
      const mockEvaluatedAssets = [
        {
          id: 'asset-1',
          title: 'Low Score Asset',
          description: 'Description',
          url: 'https://example.com/1',
          thumbnailUrl: 'https://example.com/thumb1',
          mediaType: 'image' as const,
          license: 'commercial' as const,
          provider: 'test',
          metadata: {},
          evaluation: {
            overallScore: 0.3,
            relevanceScore: 0.2,
            qualityScore: 0.4,
            tiktokSuitability: 0.3,
            confidence: 0.6,
            criteria: [],
            flags: ['low_quality'],
            evaluatedAt: new Date().toISOString()
          }
        },
        {
          id: 'asset-2',
          title: 'High Score Asset',
          description: 'Description',
          url: 'https://example.com/2',
          thumbnailUrl: 'https://example.com/thumb2',
          mediaType: 'image' as const,
          license: 'commercial' as const,
          provider: 'test',
          metadata: {},
          evaluation: {
            overallScore: 0.9,
            relevanceScore: 0.8,
            qualityScore: 0.9,
            tiktokSuitability: 1.0,
            confidence: 0.9,
            criteria: [],
            flags: [],
            evaluatedAt: new Date().toISOString()
          }
        }
      ]

      const result = await service.selectBestAsset(mockEvaluatedAssets)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.id).toBe('asset-2')
      expect(result.data!.evaluation.selectionReason).toBeDefined()
      expect(result.data!.evaluation.alternativesConsidered).toBe(1)
    })

    it('should filter by minimum score', async () => {
      const mockEvaluatedAssets = [
        {
          id: 'asset-1',
          title: 'Low Score Asset',
          description: 'Description',
          url: 'https://example.com/1',
          thumbnailUrl: 'https://example.com/thumb1',
          mediaType: 'image' as const,
          license: 'commercial' as const,
          provider: 'test',
          metadata: {},
          evaluation: {
            overallScore: 0.3,
            relevanceScore: 0.2,
            qualityScore: 0.4,
            tiktokSuitability: 0.3,
            confidence: 0.6,
            criteria: [],
            flags: ['low_quality'],
            evaluatedAt: new Date().toISOString()
          }
        }
      ]

      const result = await service.selectBestAsset(mockEvaluatedAssets, {
        minimumScore: 0.5
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeNull() // No assets meet minimum score
    })

    it('should handle empty asset list', async () => {
      const result = await service.selectBestAsset([])

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
      expect(result.metadata?.totalResults).toBe(0)
    })

    it('should prioritize quality when requested', async () => {
      const mockEvaluatedAssets = [
        {
          id: 'asset-1',
          title: 'High Relevance Asset',
          description: 'Description',
          url: 'https://example.com/1',
          thumbnailUrl: 'https://example.com/thumb1',
          mediaType: 'image' as const,
          license: 'commercial' as const,
          provider: 'test',
          metadata: {},
          evaluation: {
            overallScore: 0.7,
            relevanceScore: 0.9,
            qualityScore: 0.5,
            tiktokSuitability: 0.7,
            confidence: 0.8,
            criteria: [],
            flags: [],
            evaluatedAt: new Date().toISOString()
          }
        },
        {
          id: 'asset-2',
          title: 'High Quality Asset',
          description: 'Description',
          url: 'https://example.com/2',
          thumbnailUrl: 'https://example.com/thumb2',
          mediaType: 'image' as const,
          license: 'commercial' as const,
          provider: 'test',
          metadata: {},
          evaluation: {
            overallScore: 0.7,
            relevanceScore: 0.5,
            qualityScore: 0.95,
            tiktokSuitability: 0.7,
            confidence: 0.8,
            criteria: [],
            flags: [],
            evaluatedAt: new Date().toISOString()
          }
        }
      ]

      const result = await service.selectBestAsset(mockEvaluatedAssets, {
        prioritizeQuality: true
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data!.id).toBe('asset-2') // Should pick higher quality asset
    })
  })

  describe('overrideAssetSelection', () => {
    it('should successfully override asset selection', async () => {
      const request: AssetOverrideRequest = {
        sceneId: 'scene-123',
        assetId: 'asset-456',
        reason: 'Better fits the narrative',
        overriddenBy: 'user-789'
      }

      const result = await service.overrideAssetSelection(request)

      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
      expect(result.metadata?.providersUsed).toContain('override_engine')
    })

    it('should validate required fields', async () => {
      const incompleteRequest: AssetOverrideRequest = {
        sceneId: '',
        assetId: 'asset-456',
        reason: 'Test',
        overriddenBy: 'user-789'
      }

      const result = await service.overrideAssetSelection(incompleteRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Asset ID and Scene ID are required')
    })
  })

  describe('cache management', () => {
    it('should clear cache successfully', () => {
      service.clearCache()

      // Cache should be empty after clearing
      expect(service.getStatistics().cacheSize).toBe(0)
    })
  })

  describe('service statistics', () => {
    it('should return correct statistics', () => {
      const stats = service.getStatistics()

      expect(stats.providersCount).toBeGreaterThan(0)
      expect(stats.providers).toContain('pexels')
      expect(stats.providers).toContain('pixabay')
      expect(stats.providers).toContain('replicate')
      expect(stats.cacheSize).toBeGreaterThanOrEqual(0)
    })
  })

  describe('provider integration', () => {
    it('should have initialized default providers', () => {
      const stats = service.getStatistics()

      expect(stats.providers).toContain('pexels')
      expect(stats.providers).toContain('pixabay')
      expect(stats.providers).toContain('replicate')
      expect(stats.providersCount).toBe(3)
    })
  })

  describe('error handling', () => {
    it('should handle search errors gracefully', async () => {
      // This test verifies that the service doesn't crash on errors
      const request: AssetSearchRequest = {
        query: '',
        mediaType: 'image',
        maxResults: -1 // Invalid input
      }

      const result = await service.searchAssets(request)

      // Should either succeed with filtered results or fail gracefully
      expect(typeof result.success).toBe('boolean')
      expect(result.metadata).toBeDefined()
    })
  })
})