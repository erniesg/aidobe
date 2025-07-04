import type { Env } from '../types/env'
import { 
  type ModelConfig, 
  type PromptTemplate, 
  type ProviderConfig,
  type EnvironmentConfig,
  ModelConfigSchema,
  PromptTemplateSchema,
  ProviderConfigSchema,
  EnvironmentConfigSchema
} from '../schemas/config'
import { TemplateEngine, type Template, type TemplateVariables } from './template-engine'

interface ConfigurationResult<T> {
  success: boolean
  data?: T
  error?: string
  version?: string
  lastUpdated?: string
}

interface ConfigurationTestResult {
  success: boolean
  results: Array<{
    test: string
    passed: boolean
    details?: string
    executionTime?: number
  }>
  overallScore: number
  recommendations: string[]
}

/**
 * Configuration Service for runtime management of models, prompts, and system settings
 * Enables configuration changes without deployment via KV storage
 */
export class ConfigurationService {
  private templateEngine: TemplateEngine
  private configCache = new Map<string, { data: any; expiry: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private env: Env) {
    this.templateEngine = new TemplateEngine(env)
  }

  /**
   * Get model configuration by context (e.g., 'script_generation', 'asset_generation')
   */
  async getModelConfig(context: string): Promise<ConfigurationResult<ModelConfig>> {
    const cacheKey = `model_config:${context}`
    
    // Check cache first
    const cached = this.getCachedConfig(cacheKey)
    if (cached) {
      return { success: true, data: cached as ModelConfig }
    }

    try {
      // Load from KV storage
      const configData = await this.env.KV?.get(`config:model:${context}`)
      
      if (!configData) {
        // Return default configuration
        const defaultConfig = this.getDefaultModelConfig(context)
        return { 
          success: true, 
          data: defaultConfig,
          version: 'default',
          lastUpdated: new Date().toISOString()
        }
      }

      const parsedConfig = JSON.parse(configData)
      const validatedConfig = ModelConfigSchema.parse(parsedConfig)
      
      // Cache the result
      this.setCachedConfig(cacheKey, validatedConfig)
      
      return { 
        success: true, 
        data: validatedConfig,
        version: validatedConfig.version,
        lastUpdated: validatedConfig.updatedAt
      }

    } catch (error) {
      console.error(`Failed to load model config for ${context}:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        data: this.getDefaultModelConfig(context) // Fallback to default
      }
    }
  }

  /**
   * Update model configuration with validation and version management
   */
  async updateModelConfig(
    context: string, 
    config: Partial<ModelConfig>,
    options: {
      validateFirst?: boolean
      createBackup?: boolean
      rollbackOnError?: boolean
    } = {}
  ): Promise<ConfigurationResult<ModelConfig>> {
    const { validateFirst = true, createBackup = true, rollbackOnError = true } = options

    try {
      // Get current configuration for merging
      const currentResult = await this.getModelConfig(context)
      const currentConfig = currentResult.data || this.getDefaultModelConfig(context)

      // Merge with new configuration
      const updatedConfig: ModelConfig = {
        ...currentConfig,
        ...config,
        version: this.generateVersion(),
        updatedAt: new Date().toISOString()
      }

      // Validate the updated configuration
      const validatedConfig = ModelConfigSchema.parse(updatedConfig)

      // Optional validation test
      if (validateFirst) {
        const testResult = await this.testModelConfiguration(context, validatedConfig)
        if (!testResult.success) {
          return {
            success: false,
            error: `Configuration validation failed: ${testResult.results.map(r => r.details).join(', ')}`
          }
        }
      }

      // Create backup if requested
      if (createBackup && currentResult.success && currentResult.data) {
        await this.createConfigBackup(context, 'model', currentResult.data)
      }

      // Store updated configuration
      await this.env.KV?.put(
        `config:model:${context}`, 
        JSON.stringify(validatedConfig)
      )

      // Clear cache
      this.clearCache(`model_config:${context}`)

      return { 
        success: true, 
        data: validatedConfig,
        version: validatedConfig.version,
        lastUpdated: validatedConfig.updatedAt
      }

    } catch (error) {
      console.error(`Failed to update model config for ${context}:`, error)
      
      if (rollbackOnError) {
        // Attempt to restore from backup
        await this.rollbackConfiguration(context, 'model')
      }

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get prompt template by category and name
   */
  async getPromptTemplate(category: string, name: string): Promise<ConfigurationResult<PromptTemplate>> {
    const templateId = `${category}-${name}`
    const cacheKey = `prompt_template:${templateId}`
    
    // Check cache first
    const cached = this.getCachedConfig(cacheKey)
    if (cached) {
      return { success: true, data: cached as PromptTemplate }
    }

    try {
      // Try to load template via template engine  
      const template = await (this.templateEngine as any).loadTemplate(templateId, false)
      
      if (!template) {
        return { 
          success: false, 
          error: `Template '${templateId}' not found` 
        }
      }

      // Convert template format to PromptTemplate
      const promptTemplate: PromptTemplate = {
        id: template.metadata.id,
        name: template.metadata.name,
        category: template.metadata.category,
        content: template.content,
        version: template.metadata.version,
        variables: template.metadata.variables,
        metadata: {
          description: template.metadata.description,
          author: template.metadata.author,
          tags: template.metadata.tags,
          isActive: template.metadata.isActive
        },
        createdAt: template.metadata.createdAt,
        updatedAt: template.metadata.updatedAt
      }

      // Validate the template
      const validatedTemplate = PromptTemplateSchema.parse(promptTemplate)
      
      // Cache the result
      this.setCachedConfig(cacheKey, validatedTemplate)
      
      return { 
        success: true, 
        data: validatedTemplate,
        version: validatedTemplate.version,
        lastUpdated: validatedTemplate.updatedAt
      }

    } catch (error) {
      console.error(`Failed to load prompt template ${templateId}:`, error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Render prompt template with variables
   */
  async renderPrompt(
    template: PromptTemplate | string, 
    variables: TemplateVariables
  ): Promise<ConfigurationResult<string>> {
    try {
      let templateId: string
      let templateContent: string

      if (typeof template === 'string') {
        templateId = template
        const templateResult = await this.getPromptTemplate('', template)
        if (!templateResult.success || !templateResult.data) {
          return { success: false, error: `Template '${template}' not found` }
        }
        templateContent = templateResult.data.content
      } else {
        templateId = template.id
        templateContent = template.content
      }

      // Use template engine to render
      const renderResult = await this.templateEngine.renderTemplate(templateId, variables, {
        validateVariables: true,
        throwOnMissing: false
      })

      if (!renderResult.success) {
        return { 
          success: false, 
          error: renderResult.error 
        }
      }

      return { 
        success: true, 
        data: renderResult.output || ''
      }

    } catch (error) {
      console.error('Failed to render prompt template:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Test model configuration with sample requests
   */
  async testModelConfiguration(
    context: string, 
    config: ModelConfig
  ): Promise<ConfigurationTestResult> {
    const results: ConfigurationTestResult['results'] = []
    let overallScore = 0

    try {
      // Test 1: Validate configuration schema
      const startTime = Date.now()
      try {
        ModelConfigSchema.parse(config)
        results.push({
          test: 'Schema Validation',
          passed: true,
          details: 'Configuration schema is valid',
          executionTime: Date.now() - startTime
        })
        overallScore += 25
      } catch (error) {
        results.push({
          test: 'Schema Validation',
          passed: false,
          details: error instanceof Error ? error.message : 'Schema validation failed',
          executionTime: Date.now() - startTime
        })
      }

      // Test 2: Check required fields
      const requiredFields = ['provider', 'model']
      const missingFields = requiredFields.filter(field => !config[field as keyof ModelConfig])
      
      if (missingFields.length === 0) {
        results.push({
          test: 'Required Fields',
          passed: true,
          details: 'All required fields are present'
        })
        overallScore += 25
      } else {
        results.push({
          test: 'Required Fields',
          passed: false,
          details: `Missing required fields: ${missingFields.join(', ')}`
        })
      }

      // Test 3: Validate parameter ranges
      const parameterTests = []
      
      if (config.temperature !== undefined) {
        const tempValid = config.temperature >= 0 && config.temperature <= 2
        parameterTests.push({
          param: 'temperature',
          valid: tempValid,
          value: config.temperature,
          range: '0-2'
        })
      }

      if (config.maxTokens !== undefined) {
        const tokensValid = config.maxTokens > 0 && config.maxTokens <= 8192
        parameterTests.push({
          param: 'maxTokens',
          valid: tokensValid,
          value: config.maxTokens,
          range: '1-8192'
        })
      }

      const invalidParams = parameterTests.filter(test => !test.valid)
      
      if (invalidParams.length === 0) {
        results.push({
          test: 'Parameter Validation',
          passed: true,
          details: 'All parameters are within valid ranges'
        })
        overallScore += 25
      } else {
        results.push({
          test: 'Parameter Validation',
          passed: false,
          details: `Invalid parameters: ${invalidParams.map(p => `${p.param}=${p.value} (expected ${p.range})`).join(', ')}`
        })
      }

      // Test 4: Provider compatibility
      const supportedProviders = ['openai', 'anthropic', 'google', 'replicate']
      const providerValid = supportedProviders.includes(config.provider)
      
      if (providerValid) {
        results.push({
          test: 'Provider Compatibility',
          passed: true,
          details: `Provider '${config.provider}' is supported`
        })
        overallScore += 25
      } else {
        results.push({
          test: 'Provider Compatibility',
          passed: false,
          details: `Provider '${config.provider}' is not supported. Supported providers: ${supportedProviders.join(', ')}`
        })
      }

    } catch (error) {
      results.push({
        test: 'Configuration Test',
        passed: false,
        details: error instanceof Error ? error.message : 'Unknown error during testing'
      })
    }

    // Generate recommendations
    const recommendations: string[] = []
    
    if (overallScore < 50) {
      recommendations.push('Configuration has critical issues that need to be addressed before use')
    } else if (overallScore < 75) {
      recommendations.push('Configuration has some issues that should be reviewed')
    }

    if (config.temperature !== undefined && config.temperature > 1.2) {
      recommendations.push('High temperature setting may produce inconsistent results')
    }

    if (!config.fallbackModel) {
      recommendations.push('Consider setting a fallback model for improved reliability')
    }

    return {
      success: overallScore > 50,
      results,
      overallScore,
      recommendations
    }
  }

  /**
   * List available configurations by type
   */
  async listConfigurations(
    type: 'model' | 'template' | 'provider',
    category?: string
  ): Promise<ConfigurationResult<Array<{ id: string; name: string; version: string; lastUpdated: string }>>> {
    try {
      // This would use KV list operations in a real implementation
      // For now, return mock data based on known configurations
      
      const mockConfigurations = [
        {
          id: 'script_generation',
          name: 'Script Generation Model',
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        },
        {
          id: 'asset_generation',
          name: 'Asset Generation Model',
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      ]

      return {
        success: true,
        data: mockConfigurations
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create a backup of current configuration
   */
  private async createConfigBackup(
    context: string, 
    type: 'model' | 'template' | 'provider',
    config: any
  ): Promise<void> {
    const timestamp = new Date().toISOString()
    const backupKey = `backup:${type}:${context}:${timestamp}`
    
    await this.env.KV?.put(backupKey, JSON.stringify({
      config,
      createdAt: timestamp,
      type,
      context
    }))
  }

  /**
   * Rollback to previous configuration
   */
  private async rollbackConfiguration(
    context: string, 
    type: 'model' | 'template' | 'provider'
  ): Promise<void> {
    // This would implement rollback logic using backup keys
    // For now, just log the attempt
    console.warn(`Rollback requested for ${type} configuration in context: ${context}`)
  }

  /**
   * Get default model configuration for a context
   */
  private getDefaultModelConfig(context: string): ModelConfig {
    const baseConfig: ModelConfig = {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2048,
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Context-specific defaults
    switch (context) {
      case 'script_generation':
        return {
          ...baseConfig,
          temperature: 0.8,
          maxTokens: 1500,
          systemPrompt: 'You are an expert video script writer specializing in engaging TikTok content.'
        }
      
      case 'asset_generation':
        return {
          ...baseConfig,
          provider: 'replicate',
          model: 'flux-1.1-pro',
          temperature: 0.9
        }
      
      default:
        return baseConfig
    }
  }

  /**
   * Generate a new version string
   */
  private generateVersion(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `v${timestamp}-${random}`
  }

  /**
   * Cache management
   */
  private getCachedConfig(key: string): any | null {
    const cached = this.configCache.get(key)
    if (cached && Date.now() < cached.expiry) {
      return cached.data
    }
    
    // Clean up expired cache
    if (cached) {
      this.configCache.delete(key)
    }
    
    return null
  }

  private setCachedConfig(key: string, data: any): void {
    this.configCache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    })
  }

  private clearCache(key?: string): void {
    if (key) {
      this.configCache.delete(key)
    } else {
      this.configCache.clear()
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.clearCache()
    this.templateEngine.clearCache()
  }

  /**
   * Get system health and configuration status
   */
  async getSystemStatus(): Promise<{
    healthy: boolean
    services: Array<{
      name: string
      status: 'healthy' | 'degraded' | 'unhealthy'
      details?: string
    }>
    lastChecked: string
  }> {
    const services = []

    // Check KV availability
    try {
      await this.env.KV?.get('health-check')
      services.push({
        name: 'KV Storage',
        status: 'healthy' as const
      })
    } catch (error) {
      services.push({
        name: 'KV Storage',
        status: 'unhealthy' as const,
        details: 'KV storage is not accessible'
      })
    }

    // Check template engine
    try {
      await this.templateEngine.listTemplates()
      services.push({
        name: 'Template Engine',
        status: 'healthy' as const
      })
    } catch (error) {
      services.push({
        name: 'Template Engine',
        status: 'degraded' as const,
        details: 'Template engine has limited functionality'
      })
    }

    const healthy = services.every(service => service.status === 'healthy')

    return {
      healthy,
      services,
      lastChecked: new Date().toISOString()
    }
  }
}