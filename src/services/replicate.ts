import { z } from 'zod'

export const ReplicateModelSchema = z.enum([
  'black-forest-labs/flux-1.1-pro-ultra',
  'recraft-ai/recraft-v3',
  'bytedance/seedream-3',
  'google/imagen-4'
])

export const ReplicateVideoModelSchema = z.enum([
  'minimax/video-01',
  'lightricks/ltx-video'
])

export type ReplicateModel = z.infer<typeof ReplicateModelSchema>
export type ReplicateVideoModel = z.infer<typeof ReplicateVideoModelSchema>

// Flux 1.1 Pro Ultra schemas (from API docs)
export const FluxAspectRatioSchema = z.enum([
  '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', 
  '4:5', '3:4', '2:3', '9:16', '9:21'
])

export const FluxOutputFormatSchema = z.enum(['jpg', 'png'])

export const FluxParametersSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspect_ratio: FluxAspectRatioSchema.default('9:16'),
  output_format: FluxOutputFormatSchema.default('jpg'),
  image_prompt: z.string().url().optional(),
  image_prompt_strength: z.number().min(0).max(1).default(0.1),
  safety_tolerance: z.number().int().min(1).max(6).default(2),
  seed: z.number().int().optional(),
  raw: z.boolean().default(false)
})

export type FluxParameters = z.infer<typeof FluxParametersSchema>

// Seedream-3 schemas (bytedance/seedream-3 from API docs)
export const Seedream3ParametersSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspect_ratio: z.enum(['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9', 'custom']).default('9:16'),
  size: z.enum(['small', 'regular', 'big']).default('regular'),
  width: z.number().int().min(512).max(2048).default(2048),
  height: z.number().int().min(512).max(2048).default(2048),
  guidance_scale: z.number().min(1).max(10).default(2.5),
  seed: z.number().int().optional()
})

export type Seedream3Parameters = z.infer<typeof Seedream3ParametersSchema>

// Imagen-4 schemas (from API docs)
export const ImagenParametersSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspect_ratio: z.enum(['1:1', '9:16', '16:9', '3:4', '4:3']).default('9:16'),
  output_format: z.enum(['jpg', 'png']).default('jpg'),
  safety_filter_level: z.enum(['block_low_and_above', 'block_medium_and_above', 'block_only_high']).default('block_only_high')
})

export type ImagenParameters = z.infer<typeof ImagenParametersSchema>

// Recraft-v3 specific schemas
export const RecraftSizeSchema = z.enum([
  '1024x1024', '1365x1024', '1024x1365', '1536x1024', '1024x1536',
  '1820x1024', '1024x1820', '1024x2048', '2048x1024', '1434x1024',
  '1024x1434', '1024x1280', '1280x1024', '1024x1707', '1707x1024'
])

export const RecraftStyleSchema = z.enum([
  'any', 'realistic_image', 'digital_illustration',
  'digital_illustration/pixel_art', 'digital_illustration/hand_drawn',
  'digital_illustration/grain', 'digital_illustration/infantile_sketch',
  'digital_illustration/2d_art_poster', 'digital_illustration/handmade_3d',
  'digital_illustration/hand_drawn_outline', 'digital_illustration/engraving_color',
  'digital_illustration/2d_art_poster_2', 'realistic_image/b_and_w',
  'realistic_image/hard_flash', 'realistic_image/hdr',
  'realistic_image/natural_light', 'realistic_image/studio_portrait',
  'realistic_image/enterprise', 'realistic_image/motion_blur'
])

export const RecraftAspectRatioSchema = z.enum([
  'Not set', '1:1', '4:3', '3:4', '3:2', '2:3', '16:9', '9:16',
  '1:2', '2:1', '7:5', '5:7', '4:5', '5:4', '3:5', '5:3'
])

export const RecraftParametersSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspect_ratio: RecraftAspectRatioSchema.default('9:16'), // Default to vertical
  size: RecraftSizeSchema.default('1024x1365'), // Vertical default
  style: RecraftStyleSchema.default('any')
})

export type RecraftParameters = z.infer<typeof RecraftParametersSchema>

// Model preset configurations with sensible defaults
export const ModelPresets = {
  'black-forest-labs/flux-1.1-pro-ultra': {
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'jpg',
      safety_tolerance: 2,
      raw: false
    },
    description: '🚀 Flux 1.1 Pro Ultra (Latest, best quality)',
    category: 'Premium'
  },
  'recraft-ai/recraft-v3': {
    defaultParams: {
      aspect_ratio: '9:16',
      style: 'any'
    },
    description: '🎨 Recraft v3 (Stylized, vector-style)',
    category: 'Artistic'
  },
  'bytedance/seedream-3': {
    defaultParams: {
      aspect_ratio: '9:16',
      size: 'regular',
      guidance_scale: 2.5
    },
    description: '📸 SeeaDream-3 (Photorealistic)',
    category: 'Realistic'
  },
  'google/imagen-4': {
    defaultParams: {
      aspect_ratio: '9:16',
      output_format: 'jpg',
      safety_filter_level: 'block_only_high'
    },
    description: '🔥 Imagen-4 (Google, high quality)',
    category: 'Premium'
  }
} as const

// TikTok/Vertical optimized presets
export const TikTokPresets = {
  portrait: {
    aspect_ratio: '9:16' as const,
    output_format: 'jpg' as const,
    safety_tolerance: 3,
    raw: false
  },
  story: {
    aspect_ratio: '9:16' as const,
    output_format: 'jpg' as const,
    safety_tolerance: 2,
    raw: true
  },
  square: {
    aspect_ratio: '1:1' as const,
    output_format: 'jpg' as const,
    safety_tolerance: 3,
    raw: false
  },
  cinematic: {
    aspect_ratio: '21:9' as const,
    output_format: 'jpg' as const,
    safety_tolerance: 2,
    raw: true
  }
} as const

export type TikTokPreset = keyof typeof TikTokPresets

// Recraft style presets for different content types
export const RecraftStylePresets = {
  photorealistic: 'realistic_image',
  illustration: 'digital_illustration',
  anime: 'digital_illustration/2d_art_poster',
  pixelArt: 'digital_illustration/pixel_art',
  handDrawn: 'digital_illustration/hand_drawn',
  vintage: 'digital_illustration/engraving_color',
  portrait: 'realistic_image/studio_portrait',
  blackAndWhite: 'realistic_image/b_and_w',
  hdr: 'realistic_image/hdr',
  motion: 'realistic_image/motion_blur'
} as const

export type RecraftStylePreset = keyof typeof RecraftStylePresets

interface ReplicatePrediction {
  id: string
  status: string
  output?: string[] | string
  error?: string
  logs?: string
}

export class ReplicateService {
  private apiToken: string
  private baseUrl = 'https://api.replicate.com/v1'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  async createPrediction(model: ReplicateModel, input: Record<string, any>) {
    const response = await fetch(`${this.baseUrl}/models/${model}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Replicate API error: ${error}`)
    }

    return response.json() as Promise<ReplicatePrediction>
  }

  async getPrediction(id: string): Promise<ReplicatePrediction> {
    const response = await fetch(`${this.baseUrl}/predictions/${id}`, {
      headers: {
        'Authorization': `Token ${this.apiToken}`
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Replicate API error: ${error}`)
    }

    return response.json()
  }

  async waitForCompletion(id: string, maxWaitMs = 300000): Promise<ReplicatePrediction> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const prediction = await this.getPrediction(id)
      
      if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
        return prediction
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Prediction timeout')
  }

  getModelConfig(model: ReplicateModel): Record<string, any> {
    const configs: Record<ReplicateModel, any> = {
      'black-forest-labs/flux-1.1-pro-ultra': {
        aspect_ratio: '9:16',
        output_format: 'jpg',
        safety_tolerance: 2,
        raw: false
      },
      'recraft-ai/recraft-v3': {
        aspect_ratio: '9:16',
        style: 'any'
      },
      'bytedance/seedream-3': {
        aspect_ratio: '9:16',
        size: 'regular',
        guidance_scale: 2.5
      },
      'google/imagen-4': {
        aspect_ratio: '9:16',
        output_format: 'jpg',
        safety_filter_level: 'block_only_high'
      }
    }
    
    return configs[model] || {}
  }

  // Enhanced Flux 1.1 Pro Ultra generation
  async generateFluxImage(params: FluxParameters, model: ReplicateModel = 'black-forest-labs/flux-1.1-pro-ultra'): Promise<ReplicatePrediction> {
    const validatedParams = FluxParametersSchema.parse(params)
    
    const fluxInput = {
      prompt: validatedParams.prompt,
      aspect_ratio: validatedParams.aspect_ratio,
      output_format: validatedParams.output_format,
      safety_tolerance: validatedParams.safety_tolerance,
      raw: validatedParams.raw,
      ...(validatedParams.image_prompt && { image_prompt: validatedParams.image_prompt }),
      ...(validatedParams.image_prompt_strength !== 0.1 && { image_prompt_strength: validatedParams.image_prompt_strength }),
      ...(validatedParams.seed && { seed: validatedParams.seed })
    }

    return this.createPrediction(model, fluxInput)
  }

  // Seedream-3 generation with full parameter support  
  async generateSeedream3Image(params: Seedream3Parameters): Promise<ReplicatePrediction> {
    const validatedParams = Seedream3ParametersSchema.parse(params)
    
    const seedreamInput = {
      prompt: validatedParams.prompt,
      aspect_ratio: validatedParams.aspect_ratio,
      size: validatedParams.size,
      guidance_scale: validatedParams.guidance_scale,
      ...(validatedParams.aspect_ratio === 'custom' && validatedParams.width && { width: validatedParams.width }),
      ...(validatedParams.aspect_ratio === 'custom' && validatedParams.height && { height: validatedParams.height }),
      ...(validatedParams.seed && { seed: validatedParams.seed })
    }

    return this.createPrediction('bytedance/seedream-3', seedreamInput)
  }

  // Imagen-4 generation with safety controls
  async generateImagenImage(params: ImagenParameters): Promise<ReplicatePrediction> {
    const validatedParams = ImagenParametersSchema.parse(params)
    
    const imagenInput = {
      prompt: validatedParams.prompt,
      aspect_ratio: validatedParams.aspect_ratio,
      output_format: validatedParams.output_format,
      safety_filter_level: validatedParams.safety_filter_level
    }

    return this.createPrediction('google/imagen-4', imagenInput)
  }

  // Recraft-v3 generation with style options
  async generateRecraftImage(params: RecraftParameters): Promise<ReplicatePrediction> {
    const validatedParams = RecraftParametersSchema.parse(params)
    
    const recraftInput: any = {
      prompt: validatedParams.prompt,
      style: validatedParams.style
    }

    // Use aspect_ratio if set, otherwise use size
    if (validatedParams.aspect_ratio !== 'Not set') {
      recraftInput.aspect_ratio = validatedParams.aspect_ratio
    } else {
      recraftInput.size = validatedParams.size
    }

    return this.createPrediction('recraft-ai/recraft-v3', recraftInput)
  }

  // Helper to validate parameters based on model
  validateModelParameters(model: ReplicateModel, params: any): any {
    switch (model) {
      case 'black-forest-labs/flux-1.1-pro-ultra':
        return FluxParametersSchema.parse(params)
      case 'recraft-ai/recraft-v3':
        return RecraftParametersSchema.parse(params)
      case 'bytedance/seedream-3':
        return Seedream3ParametersSchema.parse(params)
      case 'google/imagen-4':
        return ImagenParametersSchema.parse(params)
      default:
        return params
    }
  }

  // Apply TikTok preset with optional overrides
  async generateTikTokImage(
    prompt: string, 
    preset: TikTokPreset = 'portrait', 
    overrides: Partial<FluxParameters> = {}
  ): Promise<ReplicatePrediction> {
    const basePreset = TikTokPresets[preset]
    // Start with schema defaults
    const defaultParams: FluxParameters = {
      prompt,
      aspect_ratio: '9:16',
      output_format: 'jpg',
      image_prompt_strength: 0.1,
      safety_tolerance: 2,
      raw: false
    }
    
    const params: FluxParameters = {
      ...defaultParams,
      ...basePreset,
      ...overrides
    }
    
    return this.generateFluxImage(params)
  }

  // Generate metadata for storage
  generateImageMetadata(params: FluxParameters, prediction: ReplicatePrediction) {
    return {
      id: prediction.id,
      model: 'black-forest-labs/flux-1.1-pro-ultra',
      parameters: params,
      status: prediction.status,
      created_at: new Date().toISOString(),
      error: prediction.error,
      output_url: Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
    }
  }

  // Validate if image prompt is compatible
  isValidImagePromptUrl(url: string): boolean {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const lowerUrl = url.toLowerCase()
    return validExtensions.some(ext => lowerUrl.includes(ext))
  }

  // Get optimized parameters for different use cases
  getOptimizedParams(useCase: 'social' | 'print' | 'web' | 'art'): Partial<FluxParameters> {
    const optimizations = {
      social: {
        aspect_ratio: '9:16' as const,
        output_format: 'jpg' as const,
        safety_tolerance: 3,
        raw: false
      },
      print: {
        aspect_ratio: '3:2' as const,
        output_format: 'png' as const,
        safety_tolerance: 2,
        raw: true
      },
      web: {
        aspect_ratio: '16:9' as const,
        output_format: 'jpg' as const,
        safety_tolerance: 3,
        raw: false
      },
      art: {
        aspect_ratio: '1:1' as const,
        output_format: 'png' as const,
        safety_tolerance: 1,
        raw: true
      }
    }
    
    return optimizations[useCase]
  }
}