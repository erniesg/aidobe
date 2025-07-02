import { Hono } from 'hono'
import { z } from 'zod'
import { OpenAIService, ImageGenerationParamsSchema } from '../services/openai'
import { 
  ReplicateService, ReplicateModelSchema, FluxParametersSchema, 
  RecraftParametersSchema, Seedream3ParametersSchema, ImagenParametersSchema, TikTokPresets 
} from '../services/replicate'
import { StorageService } from '../services/storage'
import { DatabaseService } from '../services/database'
import type { Env } from '../types/env'

const ImageRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  enhance: z.boolean().default(false),
  provider: z.enum(['openai', 'replicate']).default('openai'),
  model: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  // Flux-specific fields for easy access
  aspect_ratio: z.enum(['21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '9:21']).optional(),
  output_format: z.enum(['jpg', 'png']).optional(),
  safety_tolerance: z.number().int().min(1).max(6).optional(),
  raw: z.boolean().optional(),
  seed: z.number().int().optional(),
  image_prompt: z.string().url().optional(),
  image_prompt_strength: z.number().min(0).max(1).optional(),
  preset: z.enum(['portrait', 'story', 'square', 'cinematic']).optional(),
  use_case: z.enum(['social', 'print', 'web', 'art']).optional()
})

export const imageRoutes = new Hono<{ Bindings: Env }>()

imageRoutes.post('/generate', async (c) => {
  const body = await c.req.json()
  const validation = ImageRequestSchema.safeParse(body)
  
  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.issues }, 400)
  }
  
  const { 
    prompt, enhance, provider, model, parameters,
    aspect_ratio, output_format, safety_tolerance, raw, seed,
    image_prompt, image_prompt_strength, preset, use_case
  } = validation.data
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  // Generate unique ID for this request
  const promptId = crypto.randomUUID()
  
  try {
    let finalPrompt = prompt
    let enhancedPrompt: string | null = null
    
    // Disable prompt enhancement for now to avoid API call issues
    // if (enhance && provider === 'openai') {
    //   const openai = new OpenAIService(c.env.OPENAI_API_KEY)
    //   const targetModel = parameters?.model || 'gpt-image-1'
    //   
    //   if (targetModel === 'gpt-image-1') {
    //     enhancedPrompt = await openai.enhancePromptForGptImage(prompt)
    //   } else {
    //     enhancedPrompt = await openai.enhancePrompt(prompt)
    //   }
    //   finalPrompt = enhancedPrompt || prompt
    // }
    console.log('DEBUG: Skipping prompt enhancement to avoid extra API calls')
    
    // Store prompt in database
    await db.createPrompt({
      id: promptId,
      originalPrompt: prompt,
      enhancedPrompt,
      model: `${provider}:${model}` || (provider === 'openai' ? 'openai:gpt-image-1' : 'replicate:fofr/flux-pro'),
      parameters: JSON.stringify(parameters || {}),
      userAgent: c.req.header('user-agent') || '',
      ipAddress: c.req.header('cf-connecting-ip') || ''
    })
    
    let outputs: any[] = []
    
    if (provider === 'openai') {
      console.log('DEBUG: OPENAI_API_KEY exists?', !!c.env.OPENAI_API_KEY)
      console.log('DEBUG: OPENAI_API_KEY length:', c.env.OPENAI_API_KEY?.length)
      console.log('DEBUG: OPENAI_API_KEY prefix:', c.env.OPENAI_API_KEY?.substring(0, 10))
      const openai = new OpenAIService(c.env.OPENAI_API_KEY)
      
      // Build OpenAI parameters with vertical optimization
      const openaiParams: any = {
        model: parameters?.model || 'gpt-image-1',
        size: '1024x1536', // GPT-Image-1 vertical size for TikTok
        quality: 'high', // GPT-Image-1 quality
        ...parameters
      }
      
      // Apply use case optimization if specified
      if (use_case) {
        Object.assign(openaiParams, openai.getOptimizedParams(use_case))
      }
      
      const params = ImageGenerationParamsSchema.parse(openaiParams)
      outputs = await openai.generateImage(finalPrompt, params)
    } else if (provider === 'replicate') {
      const replicate = new ReplicateService(c.env.REPLICATE_API_TOKEN)
      const replicateModel = ReplicateModelSchema.parse(model || 'fofr/flux-pro')
      
      let prediction: any
      
      // Handle model-specific generation with unified approach
      const modelConfig = replicate.getModelConfig(replicateModel)
      
      // Build base parameters
      const baseParams: any = {
        prompt: finalPrompt,
        aspect_ratio: aspect_ratio || '9:16', // Default TikTok format
        ...modelConfig
      }
      
      // Apply preset if specified
      if (preset && TikTokPresets[preset]) {
        Object.assign(baseParams, TikTokPresets[preset])
      }
      
      // Apply use case optimization
      if (use_case) {
        Object.assign(baseParams, replicate.getOptimizedParams(use_case))
      }
      
      // Override with specific request parameters
      if (output_format) baseParams.output_format = output_format
      if (safety_tolerance !== undefined) baseParams.safety_tolerance = safety_tolerance
      if (raw !== undefined) baseParams.raw = raw
      if (seed !== undefined) baseParams.seed = seed
      if (image_prompt) baseParams.image_prompt = image_prompt
      if (image_prompt_strength !== undefined) baseParams.image_prompt_strength = image_prompt_strength
      
      // Merge any additional frontend parameters
      Object.assign(baseParams, parameters || {})
      
      // Generate with the specific model
      if (replicateModel === 'black-forest-labs/flux-1.1-pro-ultra') {
        const validatedParams = FluxParametersSchema.parse(baseParams)
        prediction = await replicate.generateFluxImage(validatedParams, replicateModel)
      } else if (replicateModel === 'recraft-ai/recraft-v3') {
        const validatedParams = RecraftParametersSchema.parse(baseParams)
        prediction = await replicate.generateRecraftImage(validatedParams)
      } else if (replicateModel === 'bytedance/seedream-3') {
        const validatedParams = Seedream3ParametersSchema.parse(baseParams)
        prediction = await replicate.generateSeedream3Image(validatedParams)
      } else if (replicateModel === 'google/imagen-4') {
        const validatedParams = ImagenParametersSchema.parse(baseParams)
        prediction = await replicate.generateImagenImage(validatedParams)
      } else {
        // Handle other Replicate models with default params
        const config = replicate.getModelConfig(replicateModel)
        prediction = await replicate.createPrediction(replicateModel, {
          prompt: finalPrompt,
          ...config,
          ...parameters
        })
      }
      
      const completed = await replicate.waitForCompletion(prediction.id)
      
      if (completed.status === 'failed') {
        throw new Error(completed.error || 'Generation failed')
      }
      
      const output = Array.isArray(completed.output) ? completed.output : [completed.output]
      outputs = output.filter(Boolean).map(url => ({ url }))
    }
    
    // Store outputs and upload to R2
    const savedOutputs = []
    for (let i = 0; i < outputs.length; i++) {
      const output = outputs[i]
      const outputId = crypto.randomUUID()
      const r2Key = `images/${promptId}/${outputId}.${provider === 'openai' ? 'png' : 'webp'}`
      
      let imageBuffer: ArrayBuffer
      
      if (provider === 'openai' && output.b64_json) {
        // For OpenAI gpt-image-1, we get base64 data directly
        console.log('DEBUG: Converting base64 to buffer for OpenAI image')
        const base64Data = output.b64_json
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        imageBuffer = bytes.buffer
      } else if (output.url) {
        // For Replicate and DALL-E with URLs
        console.log('DEBUG: Downloading image from URL:', output.url)
        const imageResponse = await fetch(output.url)
        imageBuffer = await imageResponse.arrayBuffer()
      } else {
        throw new Error('No image data available (no URL or b64_json)')
      }
      
      await storage.uploadImage(r2Key, imageBuffer)
      
      // Create viewable URL for this Worker
      const viewUrl = `${new URL(c.req.url).origin}/media/image/${outputId}`
      
      await db.createOutput({
        id: outputId,
        promptId,
        url: viewUrl,
        r2Key,
        type: 'image'
      })
      
      savedOutputs.push({
        id: outputId,
        url: viewUrl,
        revisedPrompt: output.revised_prompt
      })
    }
    
    // Mark prompt as completed
    await db.updatePromptStatus(promptId, 'completed')
    
    return c.json({
      promptId,
      originalPrompt: prompt,
      enhancedPrompt,
      outputs: savedOutputs
    })
    
  } catch (error) {
    console.error('Image generation error:', error)
    await db.updatePromptStatus(promptId, 'failed', error instanceof Error ? error.message : 'Unknown error')
    
    return c.json({
      error: 'Generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

imageRoutes.get('/history', async (c) => {
  const db = new DatabaseService(c.env.DB)
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  
  try {
    const prompts = await db.getPrompts('image', limit, offset)
    return c.json({ prompts })
  } catch (error) {
    console.error('Error fetching image history:', error)
    return c.json({ 
      error: 'Failed to fetch history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Delete specific image output
imageRoutes.delete('/:promptId/:outputId', async (c) => {
  const promptId = c.req.param('promptId')
  const outputId = c.req.param('outputId')
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  try {
    const output = await db.db.prepare(`
      SELECT * FROM outputs WHERE id = ? AND prompt_id = ?
    `).bind(outputId, promptId).first()
    
    if (!output) {
      return c.json({ error: 'Output not found' }, 404)
    }
    
    // Delete from R2 if r2_key exists
    if ((output as any).r2_key) {
      await storage.deleteOutput((output as any).r2_key)
    }
    
    // Delete from database
    await db.db.prepare(`DELETE FROM outputs WHERE id = ?`).bind(outputId).run()
    
    return c.json({ success: true })
    
  } catch (error) {
    console.error('Delete image error:', error)
    return c.json({
      error: 'Failed to delete image',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Delete entire prompt and all its outputs
imageRoutes.delete('/:promptId', async (c) => {
  const promptId = c.req.param('promptId')
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  try {
    // Get all outputs for this prompt
    const outputs = await db.db.prepare(`
      SELECT * FROM outputs WHERE prompt_id = ?
    `).bind(promptId).all()
    
    // Delete all outputs from R2
    for (const output of (outputs.results || [])) {
      if ((output as any).r2_key) {
        try {
          await storage.deleteOutput((output as any).r2_key)
        } catch (error) {
          console.warn('Failed to delete R2 object:', (output as any).r2_key, error)
        }
      }
    }
    
    // Delete all outputs from database
    await db.db.prepare(`DELETE FROM outputs WHERE prompt_id = ?`).bind(promptId).run()
    
    // Delete prompt from database
    await db.db.prepare(`DELETE FROM prompts WHERE id = ?`).bind(promptId).run()
    
    return c.json({ success: true })
    
  } catch (error) {
    console.error('Delete prompt error:', error)
    return c.json({
      error: 'Failed to delete prompt',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})