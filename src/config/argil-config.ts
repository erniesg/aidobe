export interface ArgilVoiceConfig {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  status: 'IDLE' | 'TRAINING' | 'FAILED'
  sampleUrl?: string
}

export interface ArgilAvatarConfig {
  id: string
  name: string
  defaultVoiceId: string
  availableGestures: string[]
  aspectRatio: '16:9' | '9:16'
  description: string
}

export interface ArgilApiConfig {
  baseUrl: string
  timeout: number
  retryAttempts: number
  retryDelay: number
}

export interface ArgilCostManagementConfig {
  use_mock_responses: boolean
  max_requests_per_session: number
  log_api_calls: boolean
  estimated_cost_per_video: number
}

export interface ArgilDefaultsConfig {
  aspectRatio: '16:9' | '9:16'
  subtitles: {
    enabled: boolean
    language: string
  }
  backgroundMusic: {
    enabled: boolean
    volume: number
  }
  quality: 'high' | 'medium' | 'low'
  speedAdjustment: {
    enabled: boolean
    factor: number
    preservePitch: boolean
  }
  preferredVoiceId: string
}

export interface ArgilWebhookConfig {
  endpoint: string
  secret: string
}

export interface ArgilEnvironmentConfig {
  use_mock_responses: boolean
  max_requests_per_session: number
  log_api_calls: boolean
}

export interface ArgilConfig {
  voices: ArgilVoiceConfig[]
  avatars: ArgilAvatarConfig[]
  api: ArgilApiConfig
  cost_management: ArgilCostManagementConfig
  defaults: ArgilDefaultsConfig
  webhook: ArgilWebhookConfig
  environments: {
    development: ArgilEnvironmentConfig
    staging: ArgilEnvironmentConfig
    production: ArgilEnvironmentConfig
  }
}

/**
 * Default Argil configuration
 * In production, this should be loaded from argil.yaml
 */
export const DEFAULT_ARGIL_CONFIG: ArgilConfig = {
  voices: [
    {
      id: '0f35210d-fdab-4049-842e-b879c7b5d95a',
      name: 'Sarah',
      createdAt: '2025-07-09T09:58:43.603Z',
      updatedAt: '2025-07-09T09:58:43.603Z',
      status: 'IDLE',
    },
    {
      id: '53725f95-fff8-428f-9e21-a37148200534',
      name: 'Liam',
      createdAt: '2025-07-09T09:58:43.603Z',
      updatedAt: '2025-07-09T09:58:43.603Z',
      status: 'IDLE',
    },
    {
      id: '739486eb-ce04-4817-893b-2b741c821c4c',
      name: 'Gabriel - Calm and Gentle',
      createdAt: '2025-07-09T09:58:43.603Z',
      updatedAt: '2025-07-09T09:58:43.603Z',
      status: 'IDLE',
    },
    {
      id: 'a1c26147-7e7d-4e55-b937-3ab10adf72e3',
      name: 'Aria',
      createdAt: '2025-07-09T09:58:43.603Z',
      updatedAt: '2025-07-09T09:58:43.603Z',
      status: 'IDLE',
    },
    {
      id: '6f3a01fb-6c2c-4c50-8689-34f364657d7c',
      name: 'Anthea - Singapore',
      createdAt: '2025-07-09T09:58:43.603Z',
      updatedAt: '2025-07-09T09:58:43.603Z',
      status: 'IDLE',
    },
  ],
  avatars: [
    {
      id: 'avatar-professional',
      name: 'Professional Avatar',
      defaultVoiceId: '0f35210d-fdab-4049-842e-b879c7b5d95a', // Sarah
      availableGestures: ['wave', 'point', 'thumbs-up', 'nod', 'friendly', 'professional'],
      aspectRatio: '16:9',
      description: 'Business professional avatar suitable for corporate content',
    },
    {
      id: 'avatar-casual',
      name: 'Casual Avatar',
      defaultVoiceId: '53725f95-fff8-428f-9e21-a37148200534', // Liam
      availableGestures: ['wave', 'casual', 'relaxed', 'conversational', 'friendly'],
      aspectRatio: '9:16',
      description: 'Friendly avatar perfect for social media and informal content',
    },
  ],
  api: {
    baseUrl: 'https://api.argil.ai',
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  cost_management: {
    use_mock_responses: true,
    max_requests_per_session: 10,
    log_api_calls: true,
    estimated_cost_per_video: 0.1,
  },
  defaults: {
    aspectRatio: '9:16',
    subtitles: {
      enabled: true,
      language: 'en',
    },
    backgroundMusic: {
      enabled: false,
      volume: 0.3,
    },
    quality: 'high',
    speedAdjustment: {
      enabled: true,
      factor: 1.3, // Change this to any speed (1.0 = normal, 2.0 = 2x speed)
      preservePitch: true,
    },
    preferredVoiceId: '6f3a01fb-6c2c-4c50-8689-34f364657d7c', // Anthea - Singapore
  },
  webhook: {
    endpoint: '/api/webhooks/argil',
    secret: 'your-webhook-secret-here',
  },
  environments: {
    development: {
      use_mock_responses: true,
      max_requests_per_session: 5,
      log_api_calls: true,
    },
    staging: {
      use_mock_responses: false,
      max_requests_per_session: 20,
      log_api_calls: true,
    },
    production: {
      use_mock_responses: false,
      max_requests_per_session: 100,
      log_api_calls: true,
    },
  },
}

/**
 * Configuration manager for Argil settings
 */
export class ArgilConfigManager {
  private config: ArgilConfig
  private environment: 'development' | 'staging' | 'production'
  private requestCount: number = 0

  constructor(config: ArgilConfig = DEFAULT_ARGIL_CONFIG, environment: string = 'development') {
    this.config = config
    this.environment = environment as 'development' | 'staging' | 'production'
  }

  /**
   * Get current configuration with environment overrides
   */
  getConfig(): ArgilConfig {
    const envConfig = this.config.environments[this.environment]

    return {
      ...this.config,
      cost_management: {
        ...this.config.cost_management,
        ...envConfig,
      },
    }
  }

  /**
   * Get available voices
   */
  getVoices(): ArgilVoiceConfig[] {
    return this.config.voices
  }

  /**
   * Get available avatars
   */
  getAvatars(): ArgilAvatarConfig[] {
    return this.config.avatars
  }

  /**
   * Get voice by ID
   */
  getVoice(voiceId: string): ArgilVoiceConfig | undefined {
    return this.config.voices.find((voice) => voice.id === voiceId)
  }

  /**
   * Get avatar by ID
   */
  getAvatar(avatarId: string): ArgilAvatarConfig | undefined {
    return this.config.avatars.find((avatar) => avatar.id === avatarId)
  }

  /**
   * Check if mock responses should be used
   */
  shouldUseMockResponses(): boolean {
    const envConfig = this.config.environments[this.environment]
    return envConfig.use_mock_responses
  }

  /**
   * Check if request is within cost limits
   */
  canMakeRequest(): boolean {
    const envConfig = this.config.environments[this.environment]
    return this.requestCount < envConfig.max_requests_per_session
  }

  /**
   * Increment request count for cost tracking
   */
  incrementRequestCount(): void {
    this.requestCount++

    if (this.config.cost_management.log_api_calls) {
      console.log(
        `Argil API request count: ${this.requestCount}/${this.config.environments[this.environment].max_requests_per_session}`
      )
    }
  }

  /**
   * Reset request count (e.g., for new session)
   */
  resetRequestCount(): void {
    this.requestCount = 0
  }

  /**
   * Get estimated cost for current session
   */
  getEstimatedCost(): number {
    return this.requestCount * this.config.cost_management.estimated_cost_per_video
  }

  /**
   * Validate avatar and voice combination
   */
  validateAvatarVoiceCombination(
    avatarId: string,
    voiceId?: string
  ): {
    valid: boolean
    avatar?: ArgilAvatarConfig
    voice?: ArgilVoiceConfig
    error?: string
  } {
    const avatar = this.getAvatar(avatarId)
    if (!avatar) {
      return {
        valid: false,
        error: `Avatar not found: ${avatarId}`,
      }
    }

    const effectiveVoiceId = voiceId || avatar.defaultVoiceId
    const voice = this.getVoice(effectiveVoiceId)
    if (!voice) {
      return {
        valid: false,
        avatar,
        error: `Voice not found: ${effectiveVoiceId}`,
      }
    }

    return {
      valid: true,
      avatar,
      voice,
    }
  }

  /**
   * Get webhook configuration
   */
  getWebhookConfig(): ArgilWebhookConfig {
    return this.config.webhook
  }

  /**
   * Update configuration (for dynamic updates)
   */
  updateConfig(updates: Partial<ArgilConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Add new voice to configuration
   */
  addVoice(voice: ArgilVoiceConfig): void {
    // Check if voice already exists
    const existingIndex = this.config.voices.findIndex((v) => v.id === voice.id)
    if (existingIndex >= 0) {
      // Update existing voice
      this.config.voices[existingIndex] = voice
    } else {
      // Add new voice
      this.config.voices.push(voice)
    }
  }

  /**
   * Add new avatar to configuration
   */
  addAvatar(avatar: ArgilAvatarConfig): void {
    // Check if avatar already exists
    const existingIndex = this.config.avatars.findIndex((a) => a.id === avatar.id)
    if (existingIndex >= 0) {
      // Update existing avatar
      this.config.avatars[existingIndex] = avatar
    } else {
      // Add new avatar
      this.config.avatars.push(avatar)
    }
  }
}
