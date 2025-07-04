import { z } from 'zod'

// Basic model configuration schema for simple usage
export const BasicModelConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'replicate', 'huggingface']),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  systemPrompt: z.string().optional(),
  fallbackModel: z.string().optional(),
  version: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
})

// Comprehensive model configuration schema for full features
export const FullModelConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  version: z.string(),
  
  // Provider information
  provider: z.enum(['openai', 'anthropic', 'google', 'replicate', 'huggingface']),
  model: z.string().min(1),
  endpoint: z.string().url().optional(), // custom endpoint if needed
  
  // Model capabilities
  capabilities: z.object({
    maxTokens: z.number().int().positive(),
    supportsImages: z.boolean().default(false),
    supportsStreaming: z.boolean().default(true),
    supportsFunctions: z.boolean().default(false),
    supportsSystemPrompts: z.boolean().default(true),
    inputCostPer1000Tokens: z.number().positive().optional(), // USD
    outputCostPer1000Tokens: z.number().positive().optional() // USD
  }),
  
  // Default parameters
  defaultParams: z.object({
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().positive().optional(),
    topP: z.number().min(0).max(1).optional(),
    topK: z.number().int().positive().optional(),
    frequencyPenalty: z.number().min(-2).max(2).optional(),
    presencePenalty: z.number().min(-2).max(2).optional(),
    stop: z.array(z.string()).optional()
  }).default({}),
  
  // Usage contexts where this model is appropriate
  usageContexts: z.array(z.enum([
    'script_generation',
    'script_editing',
    'scene_extraction',
    'asset_evaluation',
    'prompt_enhancement',
    'content_analysis',
    'quality_assessment'
  ])).default([]),
  
  // Performance characteristics
  performance: z.object({
    averageLatency: z.number().positive().optional(), // ms
    successRate: z.number().min(0).max(1).optional(),
    qualityScore: z.number().min(0).max(1).optional(),
    lastBenchmarked: z.string().datetime().optional()
  }).default({}),
  
  // Configuration metadata
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).max(10).default(5), // higher = preferred
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().optional()
})

// Use basic schema by default for simplicity
export const ModelConfigSchema = BasicModelConfigSchema

export type ModelConfig = z.infer<typeof ModelConfigSchema>

// Simplified prompt template schema for basic usage
export const PromptTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  category: z.string(),
  content: z.string().min(10), // Jinja2 template with variables
  version: z.string(),
  variables: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    required: z.boolean(),
    description: z.string()
  })),
  metadata: z.object({
    description: z.string().optional(),
    author: z.string().optional(),
    tags: z.array(z.string()).default([]),
    isActive: z.boolean().default(true)
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

export type PromptTemplate = z.infer<typeof PromptTemplateSchema>

// Provider configuration schema for external services
export const ProviderConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.enum([
    'llm_provider',
    'image_provider',
    'video_provider',
    'audio_provider',
    'storage_provider',
    'search_provider'
  ]),
  
  // Connection details
  connection: z.object({
    baseUrl: z.string().url(),
    apiVersion: z.string().optional(),
    authType: z.enum(['api_key', 'bearer_token', 'oauth', 'none']),
    rateLimits: z.object({
      requestsPerMinute: z.number().int().positive().optional(),
      requestsPerDay: z.number().int().positive().optional(),
      tokensPerMinute: z.number().int().positive().optional(),
      concurrentRequests: z.number().int().positive().optional()
    }).optional()
  }),
  
  // Available models/services
  services: z.array(z.object({
    serviceId: z.string(),
    name: z.string(),
    description: z.string().optional(),
    endpoint: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']).default('POST'),
    
    // Input/output configuration
    inputSchema: z.record(z.unknown()).optional(),
    outputSchema: z.record(z.unknown()).optional(),
    
    // Cost information
    pricing: z.object({
      type: z.enum(['per_request', 'per_token', 'per_minute', 'subscription']),
      amount: z.number().positive(),
      currency: z.string().default('USD'),
      unit: z.string() // 'request', '1000 tokens', 'minute', etc.
    }).optional(),
    
    // Performance characteristics
    performance: z.object({
      averageLatency: z.number().positive().optional(),
      successRate: z.number().min(0).max(1).optional(),
      uptime: z.number().min(0).max(1).optional()
    }).default({})
  })).default([]),
  
  // Health monitoring
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'down', 'unknown']).default('unknown'),
    lastChecked: z.string().datetime().optional(),
    lastSuccessful: z.string().datetime().optional(),
    consecutiveFailures: z.number().int().min(0).default(0),
    responseTime: z.number().positive().optional() // ms
  }).default({}),
  
  // Feature flags and configuration
  features: z.object({
    supportsStreaming: z.boolean().default(false),
    supportsBatch: z.boolean().default(false),
    supportsWebhooks: z.boolean().default(false),
    maxRetries: z.number().int().min(0).max(10).default(3),
    timeout: z.number().int().positive().default(30000), // ms
    fallbackProvider: z.string().optional() // another provider ID
  }).default({}),
  
  // Environment-specific settings
  environment: z.enum(['development', 'staging', 'production']).default('production'),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(1).max(10).default(5),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().optional()
})

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

// Environment configuration schema for deployment settings
export const EnvironmentConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  type: z.enum(['development', 'staging', 'production']),
  
  // Feature flags
  features: z.object({
    enableImageGeneration: z.boolean().default(true),
    enableVideoGeneration: z.boolean().default(true),
    enableAudioGeneration: z.boolean().default(true),
    enableHumanReview: z.boolean().default(true),
    enableCaching: z.boolean().default(true),
    enableAnalytics: z.boolean().default(true),
    enableDebugLogging: z.boolean().default(false),
    maxConcurrentJobs: z.number().int().min(1).max(100).default(10)
  }).default({}),
  
  // Resource limits
  limits: z.object({
    maxJobDuration: z.number().int().positive().default(3600), // seconds
    maxFileSize: z.number().int().positive().default(100000000), // bytes (100MB)
    maxScenes: z.number().int().min(1).max(50).default(20),
    maxAssetsPerScene: z.number().int().min(1).max(10).default(5),
    maxRetries: z.number().int().min(0).max(10).default(3),
    requestTimeout: z.number().int().positive().default(30000) // ms
  }).default({}),
  
  // Quality settings
  quality: z.object({
    defaultVideoQuality: z.enum(['draft', 'standard', 'high', 'ultra']).default('standard'),
    minQualityScore: z.number().min(0).max(1).default(0.7),
    enableQualityChecks: z.boolean().default(true),
    autoRejectLowQuality: z.boolean().default(false),
    qualityCheckTimeout: z.number().int().positive().default(10000) // ms
  }).default({}),
  
  // Storage configuration
  storage: z.object({
    retentionDays: z.number().int().min(1).max(365).default(30),
    compressionEnabled: z.boolean().default(true),
    encryptionEnabled: z.boolean().default(true),
    backupEnabled: z.boolean().default(true),
    cdnEnabled: z.boolean().default(true)
  }).default({}),
  
  // Monitoring and alerting
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableTracing: z.boolean().default(false),
    enableProfiling: z.boolean().default(false),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    alertOnErrors: z.boolean().default(true),
    alertOnSlowRequests: z.boolean().default(true),
    slowRequestThreshold: z.number().int().positive().default(5000) // ms
  }).default({}),
  
  // External integrations
  integrations: z.object({
    webhooksEnabled: z.boolean().default(false),
    webhookRetries: z.number().int().min(0).max(5).default(3),
    webhookTimeout: z.number().int().positive().default(10000), // ms
    analyticsProvider: z.string().optional(),
    errorTrackingProvider: z.string().optional()
  }).default({}),
  
  // Security settings
  security: z.object({
    enableCors: z.boolean().default(true),
    allowedOrigins: z.array(z.string()).default(['*']),
    enableRateLimit: z.boolean().default(true),
    rateLimitRequests: z.number().int().positive().default(100),
    rateLimitWindow: z.number().int().positive().default(3600), // seconds
    requireAuth: z.boolean().default(true),
    maxLoginAttempts: z.number().int().min(1).max(10).default(5)
  }).default({}),
  
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  isActive: z.boolean().default(true)
})

export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>

// Runtime configuration update schema
export const ConfigUpdateRequestSchema = z.object({
  type: z.enum(['model', 'prompt', 'provider', 'environment']),
  configId: z.string().uuid(),
  
  // Partial updates allowed
  updates: z.record(z.unknown()),
  
  // Update metadata
  reason: z.string().optional(),
  updatedBy: z.string().optional(),
  
  // Validation options
  validateOnly: z.boolean().default(false), // test without applying
  rollbackAfter: z.number().int().positive().optional(), // seconds to auto-rollback
  
  // Deployment options
  deploymentStrategy: z.enum(['immediate', 'gradual', 'scheduled']).default('immediate'),
  trafficPercentage: z.number().min(0).max(100).default(100), // for gradual deployment
  scheduledAt: z.string().datetime().optional()
})

export type ConfigUpdateRequest = z.infer<typeof ConfigUpdateRequestSchema>

// Configuration validation result schema
export const ConfigValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.object({
    field: z.string(),
    message: z.string(),
    severity: z.enum(['error', 'warning', 'info'])
  })).default([]),
  
  warnings: z.array(z.string()).default([]),
  
  // Compatibility checks
  compatibility: z.object({
    modelsCompatible: z.boolean(),
    promptsValid: z.boolean(),
    providersReachable: z.boolean(),
    resourcesAvailable: z.boolean()
  }),
  
  // Performance impact estimation
  performanceImpact: z.object({
    estimatedLatencyChange: z.number().optional(), // ms
    estimatedCostChange: z.number().optional(), // percentage
    estimatedQualityChange: z.number().optional() // percentage
  }).optional(),
  
  validatedAt: z.string().datetime()
})

export type ConfigValidationResult = z.infer<typeof ConfigValidationResultSchema>

// Validation functions
export function validateModelCompatibility(model: ModelConfig, template: PromptTemplate): boolean {
  // Check if model supports the template's requirements
  if (template.compatibleModels.length > 0) {
    return template.compatibleModels.includes(model.id)
  }
  
  // Check capabilities
  const templateText = template.template
  
  // Check if template uses functions but model doesn't support them
  if (templateText.includes('function_call') && !model.capabilities.supportsFunctions) {
    return false
  }
  
  // Check if template uses images but model doesn't support them
  if (templateText.includes('image') && !model.capabilities.supportsImages) {
    return false
  }
  
  // Check token limits
  const estimatedTokens = templateText.length / 4 // rough estimation
  if (estimatedTokens > model.capabilities.maxTokens) {
    return false
  }
  
  return true
}

export function renderPromptTemplate(template: PromptTemplate, variables: Record<string, unknown>): string {
  let rendered = template.template
  
  // Simple variable substitution (in production, use a proper template engine like Jinja2)
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    rendered = rendered.replace(placeholder, String(value))
  }
  
  // Check for unresolved variables
  const unresolvedVars = rendered.match(/{{\s*\w+\s*}}/g)
  if (unresolvedVars) {
    throw new Error(`Unresolved template variables: ${unresolvedVars.join(', ')}`)
  }
  
  return rendered
}

export function validateTemplateVariables(template: PromptTemplate, variables: Record<string, unknown>): {valid: boolean, errors: string[]} {
  const errors: string[] = []
  
  // Check required variables
  for (const varDef of template.variables) {
    if (varDef.required && !(varDef.name in variables)) {
      errors.push(`Required variable '${varDef.name}' is missing`)
      continue
    }
    
    const value = variables[varDef.name]
    if (value === undefined && varDef.required) {
      errors.push(`Required variable '${varDef.name}' is undefined`)
      continue
    }
    
    // Type validation
    if (value !== undefined) {
      switch (varDef.type) {
        case 'string':
          if (typeof value !== 'string') {
            errors.push(`Variable '${varDef.name}' must be a string`)
          } else if (varDef.validation?.minLength && value.length < varDef.validation.minLength) {
            errors.push(`Variable '${varDef.name}' is too short (minimum ${varDef.validation.minLength} characters)`)
          } else if (varDef.validation?.maxLength && value.length > varDef.validation.maxLength) {
            errors.push(`Variable '${varDef.name}' is too long (maximum ${varDef.validation.maxLength} characters)`)
          }
          break
          
        case 'number':
          if (typeof value !== 'number') {
            errors.push(`Variable '${varDef.name}' must be a number`)
          }
          break
          
        case 'boolean':
          if (typeof value !== 'boolean') {
            errors.push(`Variable '${varDef.name}' must be a boolean`)
          }
          break
          
        case 'array':
          if (!Array.isArray(value)) {
            errors.push(`Variable '${varDef.name}' must be an array`)
          }
          break
          
        case 'object':
          if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            errors.push(`Variable '${varDef.name}' must be an object`)
          }
          break
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

export function calculateConfigPriority(
  config: ModelConfig | ProviderConfig,
  context: string
): number {
  let score = config.priority * 10 // Base priority score
  
  // Factor in performance metrics
  if ('performance' in config && config.performance) {
    if (config.performance.successRate) {
      score += config.performance.successRate * 20
    }
    
    if (config.performance.averageLatency) {
      // Lower latency = higher score
      score += Math.max(0, 20 - (config.performance.averageLatency / 100))
    }
  }
  
  // Factor in health status for providers
  if ('health' in config && config.health) {
    switch (config.health.status) {
      case 'healthy':
        score += 20
        break
      case 'degraded':
        score += 10
        break
      case 'down':
        score -= 50
        break
    }
  }
  
  // Factor in usage context for models
  if ('usageContexts' in config && config.usageContexts.includes(context as any)) {
    score += 15
  }
  
  return Math.max(0, score)
}

export function selectBestConfig<T extends ModelConfig | ProviderConfig>(
  configs: T[],
  context: string = 'general'
): T | null {
  const activeConfigs = configs.filter(config => config.isActive)
  
  if (activeConfigs.length === 0) {
    return null
  }
  
  // Sort by calculated priority score
  const sortedConfigs = activeConfigs.sort((a, b) => {
    return calculateConfigPriority(b, context) - calculateConfigPriority(a, context)
  })
  
  return sortedConfigs[0]
}