import { Hono } from 'hono'
import { z } from 'zod'
import { OpenAIService } from '../services/openai'
import { DatabaseService } from '../services/database'
import { StorageService } from '../services/storage'
import type { Env } from '../types/env'

const EnhanceRequestSchema = z.object({
  prompt: z.string().min(1).max(1000),
  context: z.string().optional(),
  style: z.enum(['photorealistic', 'artistic', 'cinematic', 'minimalist', 'fantasy']).optional()
})

export const promptRoutes = new Hono<{ Bindings: Env }>()

promptRoutes.post('/enhance', async (c) => {
  const body = await c.req.json()
  const validation = EnhanceRequestSchema.safeParse(body)
  
  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.issues }, 400)
  }
  
  const { prompt, context, style } = validation.data
  
  try {
    const openai = new OpenAIService(c.env.OPENAI_API_KEY)
    
    let enhancementContext = context || ''
    if (style) {
      const stylePrompts = {
        photorealistic: 'Create a photorealistic image with sharp details, natural lighting, and high resolution quality.',
        artistic: 'Create an artistic image with creative composition, vibrant colors, and expressive style.',
        cinematic: 'Create a cinematic image with dramatic lighting, film-like composition, and movie poster quality.',
        minimalist: 'Create a minimalist image with clean lines, simple composition, and subtle colors.',
        fantasy: 'Create a fantasy image with magical elements, otherworldly atmosphere, and imaginative details.'
      }
      enhancementContext += ` Style preference: ${stylePrompts[style]}`
    }
    
    const enhancedPrompt = await openai.enhancePrompt(prompt, enhancementContext)
    
    const db = new DatabaseService(c.env.DB)
    await db.logAnalytics('prompt_enhancement', undefined, 'gpt-4-turbo-preview', {
      originalLength: prompt.length,
      enhancedLength: enhancedPrompt.length,
      style
    })
    
    return c.json({
      originalPrompt: prompt,
      enhancedPrompt,
      improvementSuggestions: [
        'Consider adding specific lighting conditions',
        'Include artistic style or medium',
        'Specify composition and framing',
        'Add color palette preferences',
        'Include mood and atmosphere details'
      ]
    })
    
  } catch (error) {
    console.error('Prompt enhancement error:', error)
    return c.json({
      error: 'Enhancement failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

promptRoutes.get('/popular', async (c) => {
  const db = new DatabaseService(c.env.DB)
  const days = parseInt(c.req.query('days') || '30')
  const limit = parseInt(c.req.query('limit') || '20')
  
  try {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    const result = await db.db.prepare(`
      SELECT 
        p.original_prompt,
        p.enhanced_prompt,
        p.model,
        COUNT(o.id) as generation_count,
        MAX(p.created_at) as last_used
      FROM prompts p
      LEFT JOIN outputs o ON p.id = o.prompt_id
      WHERE p.created_at > ? AND p.status = 'completed'
      GROUP BY p.original_prompt, p.model
      HAVING generation_count > 0
      ORDER BY generation_count DESC, last_used DESC
      LIMIT ?
    `).bind(since, limit).all()
    
    return c.json({
      popularPrompts: result.results || []
    })
    
  } catch (error) {
    console.error('Popular prompts error:', error)
    return c.json({
      error: 'Failed to fetch popular prompts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

promptRoutes.get('/analytics', async (c) => {
  const db = new DatabaseService(c.env.DB)
  const days = parseInt(c.req.query('days') || '7')
  
  try {
    const analytics = await db.getAnalytics(days)
    
    const summary = {
      totalGenerations: analytics.reduce((sum, item) => sum + (item.count || 0), 0),
      modelUsage: analytics.filter(item => item.event_type === 'generation_completed'),
      topModels: analytics
        .filter(item => item.event_type === 'generation_completed')
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 5)
    }
    
    return c.json(summary)
    
  } catch (error) {
    console.error('Analytics error:', error)
    return c.json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

promptRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = new DatabaseService(c.env.DB)
  
  try {
    const prompt = await db.getPromptById(id)
    
    if (!prompt) {
      return c.json({ error: 'Prompt not found' }, 404)
    }
    
    return c.json(prompt)
    
  } catch (error) {
    console.error('Get prompt error:', error)
    return c.json({
      error: 'Failed to fetch prompt',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})