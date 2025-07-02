import { z } from 'zod'

export const ImageGenerationParamsSchema = z.object({
  model: z.enum(['dall-e-2', 'dall-e-3', 'gpt-image-1']).default('gpt-image-1'),
  size: z.enum(['1024x1024', '1024x1536', '1536x1024', 'auto']).default('1024x1536'), // GPT-Image-1 sizes - default to vertical
  quality: z.enum(['low', 'medium', 'high', 'auto']).default('high'), // GPT-Image-1 quality values
  style: z.enum(['vivid', 'natural']).optional(),
  n: z.number().int().min(1).max(10).default(1),
  // GPT-Image-1 specific parameters
  moderation: z.enum(['default', 'strict', 'relaxed']).optional(),
  // Note: response_format not supported by gpt-image-1, only by DALL-E models
  response_format: z.enum(['url', 'b64_json']).optional()
})

export type ImageGenerationParams = z.infer<typeof ImageGenerationParamsSchema>

export class OpenAIService {
  private apiKey: string
  private baseUrl = 'https://api.openai.com/v1'

  constructor(apiKey: string) {
    console.log('DEBUG: OpenAI constructor - apiKey exists?', !!apiKey)
    console.log('DEBUG: OpenAI constructor - apiKey length:', apiKey?.length)
    this.apiKey = apiKey
  }

  async generateImage(prompt: string, params: ImageGenerationParams) {
    console.log('DEBUG: generateImage called with prompt:', prompt)
    console.log('DEBUG: params:', JSON.stringify(params, null, 2))
    
    const isGptImage = params.model === 'gpt-image-1'
    
    // Use prompt as-is for now (disable enhancement to avoid additional API calls)
    let finalPrompt = prompt
    console.log('DEBUG: Using direct prompt without enhancement')

    const requestBody: any = {
      prompt: finalPrompt,
      model: params.model,
      size: params.size,
      n: params.n
    }

    // Add model-specific parameters
    if (isGptImage) {
      if (params.quality) requestBody.quality = params.quality
      if (params.moderation) requestBody.moderation = params.moderation
      // Note: gpt-image-1 returns b64_json by default, no response_format parameter needed
    } else {
      // DALL-E specific parameters
      if (params.quality) requestBody.quality = params.quality
      if (params.style) requestBody.style = params.style
      if (params.response_format) requestBody.response_format = params.response_format
    }

    const fullUrl = `${this.baseUrl}/images/generations`
    console.log('DEBUG: Making request to:', fullUrl)
    console.log('DEBUG: baseUrl:', this.baseUrl)
    console.log('DEBUG: Request body:', JSON.stringify(requestBody, null, 2))
    console.log('DEBUG: Authorization header exists?', !!this.apiKey)
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json() as any
    return (data.data || []).map((item: any) => ({
      url: item.url, // May be null for b64_json responses
      b64_json: item.b64_json, // Base64 encoded image data
      revised_prompt: item.revised_prompt
    }))
  }

  async enhancePrompt(prompt: string, context?: string) {
    const systemPrompt = `You are an expert at creating detailed, vivid image generation prompts. 
    Enhance the given prompt by adding specific details about style, lighting, composition, colors, and mood.
    Keep the enhanced prompt under 400 characters.
    ${context ? `Context: ${context}` : ''}`

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json() as any
    return data.choices[0].message.content
  }

  // Enhanced prompt structure for gpt-image-1 (structured prompts work better)
  async enhancePromptForGptImage(prompt: string, context?: string): Promise<string> {
    console.log('DEBUG: enhancePromptForGptImage called with:', prompt)
    const systemPrompt = `You are an expert at creating structured image generation prompts for OpenAI's gpt-image-1 model.
    
    Convert the user's simple prompt into a detailed, structured prompt that includes:
    - Scene setting and composition
    - Subject details (appearance, pose, expression, clothing)
    - Camera angle and framing (close-up, medium shot, wide shot, etc.)
    - Lighting and mood
    - Style and aesthetic choices
    - Colors and atmosphere
    
    Focus on vertical formats (9:16 aspect ratio) optimized for social media content.
    Keep the enhanced prompt under 500 characters but rich in visual detail.
    
    ${context ? `Context: ${context}` : ''}
    
    Example format:
    "A cinematic medium shot of [subject] in [setting]. [Subject details]. [Camera angle]. [Lighting]. [Style]. [Colors/mood]."
    `

    console.log('DEBUG: Making chat completions request for prompt enhancement')
    const chatUrl = `${this.baseUrl}/chat/completions`
    console.log('DEBUG: Chat URL:', chatUrl)
    
    const response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      // If enhancement fails, return original prompt
      console.warn('Failed to enhance prompt, using original')
      return prompt
    }

    const data = await response.json() as any
    return data.choices[0].message.content || prompt
  }

  // Generate optimized parameters for different use cases
  getOptimizedParams(useCase: 'social' | 'portrait' | 'landscape' | 'art'): Partial<ImageGenerationParams> {
    const optimizations = {
      social: {
        model: 'gpt-image-1' as const,
        size: '1024x1536' as const, // Vertical for TikTok/Stories
        quality: 'high' as const,
        moderation: 'default' as const
      },
      portrait: {
        model: 'gpt-image-1' as const,
        size: '1024x1536' as const, // Vertical
        quality: 'high' as const,
        moderation: 'default' as const
      },
      landscape: {
        model: 'gpt-image-1' as const,
        size: '1536x1024' as const, // Horizontal
        quality: 'high' as const,
        moderation: 'default' as const
      },
      art: {
        model: 'gpt-image-1' as const,
        size: '1024x1024' as const, // Square
        quality: 'high' as const,
        moderation: 'relaxed' as const
      }
    }
    
    return optimizations[useCase]
  }
}