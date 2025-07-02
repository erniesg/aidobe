import { Hono } from 'hono'
import { z } from 'zod'
import { ReplicateService, ReplicateModelSchema } from '../services/replicate'
import { StorageService } from '../services/storage'
import { DatabaseService } from '../services/database'
import type { Env } from '../types/env'

const VideoRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  model: ReplicateModelSchema.default('minimax/video-01'),
  parameters: z.record(z.any()).optional()
})

export const videoRoutes = new Hono<{ Bindings: Env }>()

videoRoutes.post('/generate', async (c) => {
  const body = await c.req.json()
  const validation = VideoRequestSchema.safeParse(body)
  
  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.issues }, 400)
  }
  
  const { prompt, model, parameters } = validation.data
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  const replicate = new ReplicateService(c.env.REPLICATE_API_TOKEN)
  
  const promptId = crypto.randomUUID()
  
  try {
    // Store prompt in database
    await db.createPrompt({
      id: promptId,
      originalPrompt: prompt,
      model,
      parameters: JSON.stringify(parameters || {}),
      userAgent: c.req.header('user-agent') || '',
      ipAddress: c.req.header('cf-connecting-ip') || ''
    })
    
    const config = replicate.getModelConfig(model)
    const prediction = await replicate.createPrediction(model, {
      prompt,
      ...config,
      ...parameters
    })
    
    // For video generation, we typically need to wait longer
    const completed = await replicate.waitForCompletion(prediction.id, 600000) // 10 minutes
    
    if (completed.status === 'failed') {
      throw new Error(completed.error || 'Video generation failed')
    }
    
    const videoUrls = Array.isArray(completed.output) ? completed.output : [completed.output]
    const savedOutputs = []
    
    for (let i = 0; i < videoUrls.length; i++) {
      const videoUrl = videoUrls[i]
      if (!videoUrl) continue
      
      const outputId = crypto.randomUUID()
      const r2Key = `videos/${promptId}/${outputId}.mp4`
      
      // Download and upload to R2
      const videoResponse = await fetch(videoUrl)
      const videoBuffer = await videoResponse.arrayBuffer()
      const r2Url = await storage.uploadVideo(r2Key, videoBuffer)
      
      await db.createOutput({
        id: outputId,
        promptId,
        url: r2Url,
        r2Key,
        type: 'video',
        fileSize: videoBuffer.byteLength
      })
      
      savedOutputs.push({
        id: outputId,
        url: r2Url
      })
    }
    
    await db.updatePromptStatus(promptId, 'completed')
    
    return c.json({
      promptId,
      prompt,
      model,
      outputs: savedOutputs
    })
    
  } catch (error) {
    console.error('Video generation error:', error)
    await db.updatePromptStatus(promptId, 'failed', error instanceof Error ? error.message : 'Unknown error')
    
    return c.json({
      error: 'Video generation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

videoRoutes.get('/history', async (c) => {
  const db = new DatabaseService(c.env.DB)
  const limit = parseInt(c.req.query('limit') || '50')
  const offset = parseInt(c.req.query('offset') || '0')
  
  const prompts = await db.getPrompts('video', limit, offset)
  return c.json({ prompts })
})