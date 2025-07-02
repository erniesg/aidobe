import { z } from 'zod'

export const ImageGenerationParamsSchema = z.object({
  model: z.enum(['dall-e-2', 'dall-e-3']).default('dall-e-3'),
  size: z.enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792']).default('1024x1024'),
  quality: z.enum(['standard', 'hd']).default('standard'),
  style: z.enum(['vivid', 'natural']).optional(),
  n: z.number().int().min(1).max(10).default(1)
})

export type ImageGenerationParams = z.infer<typeof ImageGenerationParamsSchema>

export class OpenAIService {
  private apiKey: string
  private baseUrl = 'https://api.openai.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateImage(prompt: string, params: ImageGenerationParams) {
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model: params.model,
        size: params.size,
        quality: params.quality,
        style: params.style,
        n: params.n
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const data = await response.json() as any
    return (data.data || []).map((item: any) => ({
      url: item.url,
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
        model: 'gpt-4-turbo-preview',
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
}