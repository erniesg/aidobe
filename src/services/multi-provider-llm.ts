import type { Env } from '../types/env'

// Supported LLM providers
export type LLMProvider = 'openai' | 'anthropic' | 'google'

// Multimodal content types
export interface TextContent {
  type: 'text'
  text: string
}

export interface ImageContent {
  type: 'image'
  source: {
    type: 'base64' | 'url'
    mediaType: string
    data: string // base64 data or URL
  }
}

export type MessageContent = TextContent | ImageContent

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system'
  content: MessageContent[]
}

export interface LLMRequest {
  messages: LLMMessage[]
  model?: string
  maxTokens?: number
  temperature?: number
  provider?: LLMProvider
  structuredOutput?: boolean // Enable JSON structured output
  responseFormat?: 'json_object' | 'text' // OpenAI structured output
}

export interface LLMResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  model: string
  provider: LLMProvider
}

export interface ProviderConfig {
  apiKey: string
  baseURL?: string
  defaultModel: string
  maxTokens: number
  temperature: number
}

/**
 * Multi-provider LLM service supporting OpenAI, Anthropic, and Google Gemini
 * with vision/multimodal capabilities
 */
export class MultiProviderLLMService {
  private providers: Record<LLMProvider, ProviderConfig>

  constructor(private env: Env) {
    this.providers = {
      openai: {
        apiKey: env.OPENAI_API_KEY,
        baseURL: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o-2024-08-06', // Latest GPT-4o July 2025
        maxTokens: 2000,
        temperature: 0.7
      },
      anthropic: {
        apiKey: env.ANTHROPIC_API_KEY,
        baseURL: 'https://api.anthropic.com',
        defaultModel: 'claude-sonnet-4-20250514', // Sonnet 4 July 2025
        maxTokens: 2000,
        temperature: 0.7
      },
      google: {
        apiKey: env.GOOGLE_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        defaultModel: 'gemini-2.5-flash', // Latest Gemini 2.5 July 2025
        maxTokens: 2000,
        temperature: 0.7
      }
    }
  }

  /**
   * Generate text using the specified provider with optional image inputs
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    const provider = request.provider || 'openai'
    const config = this.providers[provider]

    if (!config.apiKey) {
      throw new Error(`API key not configured for provider: ${provider}`)
    }

    switch (provider) {
      case 'openai':
        return this.generateWithOpenAI(request, config)
      case 'anthropic':
        return this.generateWithAnthropic(request, config)
      case 'google':
        return this.generateWithGoogle(request, config)
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  /**
   * OpenAI GPT-4o/GPT-4 Vision implementation
   */
  private async generateWithOpenAI(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const model = request.model || config.defaultModel
    
    // Convert messages to OpenAI format
    const openaiMessages = request.messages.map(msg => ({
      role: msg.role,
      content: msg.content.map(content => {
        if (content.type === 'text') {
          return { type: 'text', text: content.text }
        } else if (content.type === 'image') {
          return {
            type: 'image_url',
            image_url: {
              url: content.source.type === 'url' 
                ? content.source.data 
                : `data:${content.source.mediaType};base64,${content.source.data}`,
              detail: 'high' // For better image analysis
            }
          }
        }
        return content
      })
    }))

    const requestBody: any = {
      model,
      messages: openaiMessages,
      max_tokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature || config.temperature
    }

    // Add structured output for JSON responses
    if (request.structuredOutput || request.responseFormat === 'json_object') {
      requestBody.response_format = { type: 'json_object' }
    }

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      },
      model,
      provider: 'openai'
    }
  }

  /**
   * Anthropic Claude 3.5 Sonnet implementation
   */
  private async generateWithAnthropic(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const model = request.model || config.defaultModel
    
    // Convert messages to Anthropic format
    const anthropicMessages = request.messages.map(msg => ({
      role: msg.role === 'system' ? 'user' : msg.role, // Anthropic handles system messages differently
      content: msg.content.map(content => {
        if (content.type === 'text') {
          return { type: 'text', text: content.text }
        } else if (content.type === 'image') {
          return {
            type: 'image',
            source: {
              type: content.source.type,
              media_type: content.source.mediaType,
              data: content.source.data
            }
          }
        }
        return content
      })
    }))

    // Handle system message separately if present
    const systemMessage = request.messages.find(msg => msg.role === 'system')
    const systemContent = systemMessage?.content.find(c => c.type === 'text')?.text

    const requestBody: any = {
      model,
      max_tokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature || config.temperature,
      system: systemContent,
      messages: anthropicMessages.filter(msg => msg.role !== 'system')
    }

    // For structured output, add instructions to system message
    if (request.structuredOutput || request.responseFormat === 'json_object') {
      const structuredSystemMessage = systemContent 
        ? `${systemContent}\n\nPlease respond with valid JSON only. Do not include any text before or after the JSON.`
        : 'Please respond with valid JSON only. Do not include any text before or after the JSON.'
      requestBody.system = structuredSystemMessage
    }

    const response = await fetch(`${config.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    
    return {
      content: data.content[0].text,
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      model,
      provider: 'anthropic'
    }
  }

  /**
   * Google Gemini 2.0 Flash implementation
   */
  private async generateWithGoogle(request: LLMRequest, config: ProviderConfig): Promise<LLMResponse> {
    const model = request.model || config.defaultModel
    
    // Convert messages to Gemini format
    const geminiContents = request.messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: msg.content.map(content => {
        if (content.type === 'text') {
          return { text: content.text }
        } else if (content.type === 'image') {
          return {
            inline_data: {
              mime_type: content.source.mediaType,
              data: content.source.data
            }
          }
        }
        return content
      })
    }))

    // Add structured output instructions for Gemini
    if (request.structuredOutput || request.responseFormat === 'json_object') {
      // Add JSON instruction to the first user message
      const firstUserContent = geminiContents.find(c => c.role === 'user')
      if (firstUserContent && firstUserContent.parts[0]) {
        firstUserContent.parts[0].text += '\n\nPlease respond with valid JSON only. Do not include any text before or after the JSON.'
      }
    }

    const response = await fetch(`${config.baseURL}/models/${model}:generateContent?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: request.maxTokens || config.maxTokens,
          temperature: request.temperature || config.temperature
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Google API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    
    return {
      content: data.candidates[0].content.parts[0].text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0
      },
      model,
      provider: 'google'
    }
  }

  /**
   * Helper method to create a simple text-only request
   */
  async generateSimpleText(
    prompt: string, 
    options: {
      provider?: LLMProvider
      model?: string
      maxTokens?: number
      temperature?: number
    } = {}
  ): Promise<string> {
    const response = await this.generateText({
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: prompt }]
      }],
      ...options
    })
    
    return response.content
  }

  /**
   * Helper method to create a request with text and image
   */
  async generateWithImage(
    prompt: string,
    imageData: string,
    imageType: string,
    options: {
      provider?: LLMProvider
      model?: string
      maxTokens?: number
      temperature?: number
      imageSource?: 'base64' | 'url'
    } = {}
  ): Promise<LLMResponse> {
    const imageSource = options.imageSource || 'base64'
    
    return this.generateText({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image',
            source: {
              type: imageSource,
              mediaType: imageType,
              data: imageData
            }
          }
        ]
      }],
      provider: options.provider,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature
    })
  }

  /**
   * Get available models for a provider (July 2025)
   */
  getAvailableModels(provider: LLMProvider): string[] {
    switch (provider) {
      case 'openai':
        return ['gpt-4o-2024-08-06'] // Only the model you specified
      case 'anthropic':
        return ['claude-sonnet-4-20250514'] // Only Sonnet 4 as specified
      case 'google':
        return ['gemini-2.5-flash'] // Only the model you specified
      default:
        return []
    }
  }

  /**
   * Check if a provider supports vision/multimodal inputs
   */
  supportsVision(provider: LLMProvider): boolean {
    return true // All three providers support vision as of 2024
  }

  /**
   * Get provider configuration
   */
  getProviderConfig(provider: LLMProvider): ProviderConfig {
    return this.providers[provider]
  }

  /**
   * Set provider configuration
   */
  setProviderConfig(provider: LLMProvider, config: Partial<ProviderConfig>): void {
    this.providers[provider] = { ...this.providers[provider], ...config }
  }
}