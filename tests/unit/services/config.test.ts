import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConfigurationService } from '../../../src/services/config'
import type { Env } from '../../../src/types/env'
import type { ModelConfig, PromptTemplate } from '../../../src/schemas/config'

// Mock template engine
vi.mock('../../../src/services/template-engine', () => ({
  TemplateEngine: vi.fn().mockImplementation(() => ({
    loadTemplate: vi.fn(),
    renderTemplate: vi.fn(),
    clearCache: vi.fn(),
    listTemplates: vi.fn()
  }))
}))

// Mock implementations
const mockKV = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  list: vi.fn()
}

const mockTemplateEngine = {
  loadTemplate: vi.fn(),
  renderTemplate: vi.fn(),
  clearCache: vi.fn(),
  listTemplates: vi.fn()
}

const mockEnv: Env = {
  ENVIRONMENT: 'test',
  ACCESS_PASSWORD: 'test-password',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  ARGIL_API_KEY: 'test-argil-key',
  ARGIL_WEBHOOK_SECRET: 'test-webhook-secret',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: mockKV as any
}

describe('ConfigurationService', () => {
  let service: ConfigurationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ConfigurationService(mockEnv)
    // Replace the template engine with our mock
    ;(service as any).templateEngine = mockTemplateEngine
  })

  describe('getModelConfig', () => {
    it('should return default configuration when no config exists in KV', async () => {
      mockKV.get.mockResolvedValue(null)

      const result = await service.getModelConfig('script_generation')

      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.8,
        maxTokens: 1500
      })
      expect(result.version).toBe('default')
      expect(mockKV.get).toHaveBeenCalledWith('config:model:script_generation')
    })

    it('should return stored configuration from KV', async () => {
      const storedConfig: ModelConfig = {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.9,
        maxTokens: 4000,
        version: '2.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z'
      }

      mockKV.get.mockResolvedValue(JSON.stringify(storedConfig))

      const result = await service.getModelConfig('script_generation')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(storedConfig)
      expect(result.version).toBe('2.0.0')
      expect(result.lastUpdated).toBe('2024-01-02T00:00:00Z')
    })

    it('should handle invalid JSON in KV storage', async () => {
      mockKV.get.mockResolvedValue('invalid json')

      const result = await service.getModelConfig('script_generation')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Unexpected token')
      expect(result.data).toMatchObject({
        provider: 'openai',
        model: 'gpt-4'
      }) // Should fallback to default
    })

    it('should cache configuration after first load', async () => {
      const config: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockKV.get.mockResolvedValue(JSON.stringify(config))

      // First call
      await service.getModelConfig('test_context')
      // Second call
      await service.getModelConfig('test_context')

      // KV should only be called once due to caching
      expect(mockKV.get).toHaveBeenCalledTimes(1)
    })

    it('should return context-specific defaults', async () => {
      mockKV.get.mockResolvedValue(null)

      const scriptResult = await service.getModelConfig('script_generation')
      const assetResult = await service.getModelConfig('asset_generation')

      expect(scriptResult.data?.temperature).toBe(0.8)
      expect(scriptResult.data?.systemPrompt).toContain('video script writer')
      
      expect(assetResult.data?.provider).toBe('replicate')
      expect(assetResult.data?.model).toBe('flux-1.1-pro')
    })
  })

  describe('updateModelConfig', () => {
    it('should update configuration with version increment', async () => {
      const currentConfig: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockKV.get.mockResolvedValue(JSON.stringify(currentConfig))
      mockKV.put.mockResolvedValue(undefined)

      const updates = { temperature: 0.9, maxTokens: 2000 }
      const result = await service.updateModelConfig('script_generation', updates, {
        validateFirst: false
      })

      expect(result.success).toBe(true)
      expect(result.data?.temperature).toBe(0.9)
      expect(result.data?.maxTokens).toBe(2000)
      expect(result.data?.version).not.toBe('1.0.0') // Should be incremented
      expect(mockKV.put).toHaveBeenCalled()
    })

    it('should validate configuration before updating', async () => {
      mockKV.get.mockResolvedValue(null) // Start with default

      const invalidUpdates = { temperature: 5.0 } // Invalid temperature
      const result = await service.updateModelConfig('script_generation', invalidUpdates, {
        validateFirst: true
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Number must be less than or equal to 2')
      expect(mockKV.put).not.toHaveBeenCalled()
    })

    it('should create backup before updating', async () => {
      const currentConfig: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockKV.get.mockResolvedValue(JSON.stringify(currentConfig))
      mockKV.put.mockResolvedValue(undefined)

      const updates = { temperature: 0.8 }
      await service.updateModelConfig('script_generation', updates, {
        createBackup: true,
        validateFirst: false
      })

      // Should have made two KV puts: one for backup, one for update
      expect(mockKV.put).toHaveBeenCalledTimes(2)
      
      // Check that backup was created
      const backupCall = mockKV.put.mock.calls.find(call => 
        call[0].startsWith('backup:model:script_generation:')
      )
      expect(backupCall).toBeDefined()
    })

    it('should handle update failures gracefully', async () => {
      mockKV.get.mockResolvedValue(null)
      mockKV.put.mockRejectedValue(new Error('KV storage error'))

      const updates = { temperature: 0.8 }
      const result = await service.updateModelConfig('script_generation', updates, {
        validateFirst: false
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('KV storage error')
    })
  })

  describe('getPromptTemplate', () => {
    it('should load template via template engine', async () => {
      const mockTemplate = {
        metadata: {
          id: 'script-generation-basic',
          name: 'Basic Script Generation',
          category: 'script',
          version: '1.0.0',
          description: 'Basic script template',
          author: 'system',
          tags: ['script', 'basic'],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          variables: []
        },
        content: 'Generate a script for {{topic}}',
        examples: []
      }

      mockTemplateEngine.loadTemplate.mockResolvedValue(mockTemplate)

      const result = await service.getPromptTemplate('script', 'generation-basic')

      expect(result.success).toBe(true)
      expect(result.data?.id).toBe('script-generation-basic')
      expect(result.data?.content).toBe('Generate a script for {{topic}}')
      expect(mockTemplateEngine.loadTemplate).toHaveBeenCalledWith('script-generation-basic', false)
    })

    it('should handle template not found', async () => {
      mockTemplateEngine.loadTemplate.mockResolvedValue(null)

      const result = await service.getPromptTemplate('script', 'nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should cache template after first load', async () => {
      const mockTemplate = {
        metadata: {
          id: 'script-test',
          name: 'Test Template',
          category: 'script',
          version: '1.0.0',
          description: 'Test template',
          author: 'system',
          tags: ['test'],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          variables: []
        },
        content: 'Test content',
        examples: []
      }

      mockTemplateEngine.loadTemplate.mockResolvedValue(mockTemplate)

      // First call
      await service.getPromptTemplate('script', 'test')
      // Second call
      await service.getPromptTemplate('script', 'test')

      // Template engine should only be called once due to caching
      expect(mockTemplateEngine.loadTemplate).toHaveBeenCalledTimes(1)
    })
  })

  describe('renderPrompt', () => {
    it('should render template with variables', async () => {
      const template: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        category: 'test',
        content: 'Hello {{name}}, welcome to {{platform}}!',
        version: '1.0.0',
        variables: [
          { name: 'name', type: 'string', required: true, description: 'User name' },
          { name: 'platform', type: 'string', required: true, description: 'Platform name' }
        ],
        metadata: {
          description: 'Test template',
          author: 'system',
          tags: ['test'],
          isActive: true
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'Hello John, welcome to aidobe!',
        renderTime: 10,
        variablesUsed: ['name', 'platform'],
        missingVariables: []
      })

      const variables = { name: 'John', platform: 'aidobe' }
      const result = await service.renderPrompt(template, variables)

      expect(result.success).toBe(true)
      expect(result.data).toBe('Hello John, welcome to aidobe!')
      expect(mockTemplateEngine.renderTemplate).toHaveBeenCalledWith(
        'test-template',
        variables,
        { validateVariables: true, throwOnMissing: false }
      )
    })

    it('should handle template rendering errors', async () => {
      const template: PromptTemplate = {
        id: 'error-template',
        name: 'Error Template',
        category: 'test',
        content: 'Test content',
        version: '1.0.0',
        variables: [],
        metadata: {
          description: 'Error template',
          author: 'system',
          tags: ['test'],
          isActive: true
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: false,
        error: 'Template rendering failed',
        renderTime: 5,
        variablesUsed: [],
        missingVariables: ['required_var']
      })

      const result = await service.renderPrompt(template, {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Template rendering failed')
    })

    it('should load template by string ID', async () => {
      const mockTemplate = {
        metadata: {
          id: 'string-template',
          name: 'String Template',
          category: 'test',
          version: '1.0.0',
          description: 'String template',
          author: 'system',
          tags: ['test'],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          variables: []
        },
        content: 'Content from {{source}}',
        examples: []
      }

      mockTemplateEngine.loadTemplate.mockResolvedValue(mockTemplate)
      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'Content from database',
        renderTime: 8,
        variablesUsed: ['source'],
        missingVariables: []
      })

      const result = await service.renderPrompt('string-template', { source: 'database' })

      expect(result.success).toBe(true)
      expect(result.data).toBe('Content from database')
    })
  })

  describe('testModelConfiguration', () => {
    it('should validate good configuration', async () => {
      const goodConfig: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      const result = await service.testModelConfiguration('script_generation', goodConfig)

      expect(result.success).toBe(true)
      expect(result.overallScore).toBe(100)
      expect(result.results).toHaveLength(4)
      expect(result.results.every(r => r.passed)).toBe(true)
    })

    it('should identify configuration problems', async () => {
      const badConfig: ModelConfig = {
        provider: 'invalid_provider' as any, // Use unsupported provider
        model: 'unknown_model',
        temperature: 5.0, // Invalid temperature
        maxTokens: -100, // Invalid max tokens
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      const result = await service.testModelConfiguration('script_generation', badConfig)

      expect(result.success).toBe(false)
      expect(result.overallScore).toBeLessThanOrEqual(50)
      
      const failedTests = result.results.filter(r => !r.passed)
      expect(failedTests.length).toBeGreaterThan(0)
      
      // Should identify parameter validation issues
      const paramTest = result.results.find(r => r.test === 'Parameter Validation')
      expect(paramTest?.passed).toBe(false)
      
      // Should identify provider compatibility issues
      const providerTest = result.results.find(r => r.test === 'Provider Compatibility')
      expect(providerTest?.passed).toBe(false)
    })

    it('should provide helpful recommendations', async () => {
      const highTempConfig: ModelConfig = {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 1.5, // High temperature
        version: '1.0.0',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      const result = await service.testModelConfiguration('script_generation', highTempConfig)

      expect(result.recommendations).toContain(
        'High temperature setting may produce inconsistent results'
      )
      expect(result.recommendations).toContain(
        'Consider setting a fallback model for improved reliability'
      )
    })
  })

  describe('cache management', () => {
    it('should clear all caches', () => {
      service.clearAllCaches()
      
      expect(mockTemplateEngine.clearCache).toHaveBeenCalled()
    })
  })

  describe('getSystemStatus', () => {
    it('should return healthy status when all services work', async () => {
      mockKV.get.mockResolvedValue(null) // Health check passes
      mockTemplateEngine.listTemplates.mockResolvedValue([])

      const status = await service.getSystemStatus()

      expect(status.healthy).toBe(true)
      expect(status.services).toHaveLength(2)
      expect(status.services.every(s => s.status === 'healthy')).toBe(true)
    })

    it('should detect unhealthy services', async () => {
      mockKV.get.mockRejectedValue(new Error('KV error'))
      mockTemplateEngine.listTemplates.mockRejectedValue(new Error('Template error'))

      const status = await service.getSystemStatus()

      expect(status.healthy).toBe(false)
      expect(status.services.find(s => s.name === 'KV Storage')?.status).toBe('unhealthy')
      expect(status.services.find(s => s.name === 'Template Engine')?.status).toBe('degraded')
    })
  })
})