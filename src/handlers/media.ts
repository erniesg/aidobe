import { Hono } from 'hono'
import { StorageService } from '../services/storage'
import { DatabaseService } from '../services/database'
import type { Env } from '../types/env'

export const mediaRoutes = new Hono<{ Bindings: Env }>()

// Serve images directly from R2
mediaRoutes.get('/image/:outputId', async (c) => {
  const outputId = c.req.param('outputId')
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  try {
    // Get output record to find the R2 key
    const output = await db.db.prepare(`
      SELECT r2_key, type FROM outputs WHERE id = ?
    `).bind(outputId).first()
    
    if (!output || (output as any).type !== 'image') {
      return c.json({ error: 'Image not found' }, 404)
    }
    
    // Get the file from R2
    const r2Key = (output as any).r2_key
    const object = await c.env.R2_OUTPUTS.get(r2Key)
    
    if (!object) {
      return c.json({ error: 'File not found in storage' }, 404)
    }
    
    // Return the image with proper headers
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/png')
    headers.set('Cache-Control', 'public, max-age=31536000') // 1 year cache
    headers.set('Content-Disposition', `inline; filename="${outputId}.png"`)
    
    return new Response(object.body, { headers })
    
  } catch (error) {
    console.error('Error serving image:', error)
    return c.json({ 
      error: 'Failed to serve image',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// Serve videos directly from R2
mediaRoutes.get('/video/:outputId', async (c) => {
  const outputId = c.req.param('outputId')
  const db = new DatabaseService(c.env.DB)
  
  try {
    // Get output record to find the R2 key
    const output = await db.db.prepare(`
      SELECT r2_key, type FROM outputs WHERE id = ?
    `).bind(outputId).first()
    
    if (!output || (output as any).type !== 'video') {
      return c.json({ error: 'Video not found' }, 404)
    }
    
    // Get the file from R2
    const r2Key = (output as any).r2_key
    const object = await c.env.R2_OUTPUTS.get(r2Key)
    
    if (!object) {
      return c.json({ error: 'File not found in storage' }, 404)
    }
    
    // Return the video with proper headers
    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType || 'video/mp4')
    headers.set('Cache-Control', 'public, max-age=31536000') // 1 year cache
    headers.set('Content-Disposition', `inline; filename="${outputId}.mp4"`)
    
    return new Response(object.body, { headers })
    
  } catch (error) {
    console.error('Error serving video:', error)
    return c.json({ 
      error: 'Failed to serve video',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})