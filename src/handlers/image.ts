import { Hono } from 'hono'
import { z } from 'zod'
import { OpenAIService, ImageGenerationParamsSchema } from '../services/openai'
import { ReplicateService, ReplicateModelSchema } from '../services/replicate'
import { StorageService } from '../services/storage'
import { DatabaseService } from '../services/database'
import type { Env } from '../types/env'

const ImageRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  enhance: z.boolean().default(false),
  provider: z.enum(['openai', 'replicate']).default('openai'),
  model: z.string().optional(),
  parameters: z.record(z.any()).optional()
})

export const imageRoutes = new Hono<{ Bindings: Env }>()

imageRoutes.post('/generate', async (c) => {
  const body = await c.req.json()
  const validation = ImageRequestSchema.safeParse(body)
  
  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.issues }, 400)
  }
  
  const { prompt, enhance, provider, model, parameters } = validation.data
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  // Generate unique ID for this request
  const promptId = crypto.randomUUID()
  
  try {
    let finalPrompt = prompt
    let enhancedPrompt: string | null = null
    
    // Enhance prompt if requested
    if (enhance && provider === 'openai') {
      const openai = new OpenAIService(c.env.OPENAI_API_KEY)
      enhancedPrompt = await openai.enhancePrompt(prompt)
      finalPrompt = enhancedPrompt
    }
    
    // Store prompt in database
    await db.createPrompt({
      id: promptId,
      originalPrompt: prompt,
      enhancedPrompt,
      model: model || (provider === 'openai' ? 'dall-e-3' : 'stability-ai/sdxl'),
      parameters: JSON.stringify(parameters || {}),
      userAgent: c.req.header('user-agent') || '',
      ipAddress: c.req.header('cf-connecting-ip') || ''
    })
    
    let outputs: any[] = []
    
    if (provider === 'openai') {
      const openai = new OpenAIService(c.env.OPENAI_API_KEY)
      const params = ImageGenerationParamsSchema.parse(parameters || {})
      outputs = await openai.generateImage(finalPrompt, params)
    } else if (provider === 'replicate') {
      const replicate = new ReplicateService(c.env.REPLICATE_API_TOKEN)
      const replicateModel = ReplicateModelSchema.parse(model || 'stability-ai/sdxl')
      const config = replicate.getModelConfig(replicateModel)
      
      const prediction = await replicate.createPrediction(replicateModel, {
        prompt: finalPrompt,
        ...config,
        ...parameters
      })
      
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
      
      // Download and upload to R2
      const imageResponse = await fetch(output.url)
      const imageBuffer = await imageResponse.arrayBuffer()
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