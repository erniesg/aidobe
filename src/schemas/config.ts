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