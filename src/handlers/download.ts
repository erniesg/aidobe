import { Hono } from 'hono'
import { z } from 'zod'
import { StorageService } from '../services/storage'
import { DatabaseService } from '../services/database'
import type { Env } from '../types/env'

const DownloadRequestSchema = z.object({
  outputIds: z.array(z.string()).min(1).max(50),
  format: z.enum(['individual', 'zip']).default('individual'),
  includeMetadata: z.boolean().default(false)
})

export const downloadRoutes = new Hono<{ Bindings: Env }>()

downloadRoutes.post('/prepare', async (c) => {
  const body = await c.req.json()
  const validation = DownloadRequestSchema.safeParse(body)
  
  if (!validation.success) {
    return c.json({ error: 'Invalid request', details: validation.error.issues }, 400)
  }
  
  const { outputIds, format, includeMetadata } = validation.data
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  try {
    const downloads = []
    
    for (const outputId of outputIds) {
      const result = await db.db.prepare(`
        SELECT o.*, p.original_prompt, p.enhanced_prompt, p.model, p.parameters
        FROM outputs o
        JOIN prompts p ON o.prompt_id = p.id
        WHERE o.id = ?
      `).bind(outputId).first()
      
      if (!result) {
        continue
      }
      
      const output = result as any
      const downloadUrl = await storage.getDownloadUrl(output.r2_key)
      
      downloads.push({
        id: output.id,
        url: downloadUrl,
        filename: `${output.type}_${output.id}.${output.type === 'image' ? 'png' : 'mp4'}`,
        type: output.type,
        metadata: includeMetadata ? {
          prompt: output.original_prompt,
          enhancedPrompt: output.enhanced_prompt,
          model: output.model,
          parameters: JSON.parse(output.parameters || '{}'),
          createdAt: output.created_at
        } : null
      })
    }
    
    // Log download analytics
    await db.logAnalytics('download_prepared', undefined, undefined, {
      outputCount: downloads.length,
      format,
      includeMetadata
    })
    
    if (format === 'zip') {
      // For zip format, we'd need to create a temporary zip file
      // This is a simplified implementation - in production you might want to use a different approach
      return c.json({
        type: 'zip',
        downloads,
        message: 'Individual downloads provided. ZIP functionality requires additional implementation.'
      })
    }
    
    return c.json({
      type: 'individual',
      downloads
    })
    
  } catch (error) {
    console.error('Download preparation error:', error)
    return c.json({
      error: 'Download preparation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

downloadRoutes.get('/history', async (c) => {
  const db = new DatabaseService(c.env.DB)
  const limit = parseInt(c.req.query('limit') || '100')
  const type = c.req.query('type') // 'image' or 'video'
  
  try {
    let query = `
      SELECT o.*, p.original_prompt, p.model, p.created_at as prompt_created_at
      FROM outputs o
      JOIN prompts p ON o.prompt_id = p.id
      WHERE p.status = 'completed'
    `
    
    const params: any[] = []
    
    if (type && (type === 'image' || type === 'video')) {
      query += ` AND o.type = ?`
      params.push(type)
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT ?`
    params.push(limit)
    
    const result = await db.db.prepare(query).bind(...params).all()
    
    const outputs = (result.results || []).map((row: any) => ({
      id: row.id,
      promptId: row.prompt_id,
      url: row.url,
      type: row.type,
      width: row.width,
      height: row.height,
      duration: row.duration,
      fileSize: row.file_size,
      createdAt: row.created_at,
      prompt: row.original_prompt,
      model: row.model
    }))
    
    return c.json({ outputs })
    
  } catch (error) {
    console.error('Download history error:', error)
    return c.json({
      error: 'Failed to fetch download history',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

downloadRoutes.get('/stats', async (c) => {
  const db = new DatabaseService(c.env.DB)
  
  try {
    const stats = await db.db.prepare(`
      SELECT 
        COUNT(*) as total_outputs,
        SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) as total_images,
        SUM(CASE WHEN type = 'video' THEN 1 ELSE 0 END) as total_videos,
        SUM(file_size) as total_storage_bytes,
        AVG(file_size) as avg_file_size
      FROM outputs
    `).first()
    
    return c.json({
      totalOutputs: stats?.total_outputs || 0,
      totalImages: stats?.total_images || 0,
      totalVideos: stats?.total_videos || 0,
      totalStorageBytes: stats?.total_storage_bytes || 0,
      averageFileSize: stats?.avg_file_size || 0,
      totalStorageMB: Math.round((stats?.total_storage_bytes || 0) / (1024 * 1024))
    })
    
  } catch (error) {
    console.error('Download stats error:', error)
    return c.json({
      error: 'Failed to fetch download stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

downloadRoutes.delete('/:id', async (c) => {
  const outputId = c.req.param('id')
  const db = new DatabaseService(c.env.DB)
  const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)
  
  try {
    const output = await db.db.prepare(`
      SELECT * FROM outputs WHERE id = ?
    `).bind(outputId).first()
    
    if (!output) {
      return c.json({ error: 'Output not found' }, 404)
    }
    
    // Delete from R2
    await storage.deleteOutput((output as any).r2_key)
    
    // Delete from database
    await db.db.prepare(`DELETE FROM outputs WHERE id = ?`).bind(outputId).run()
    
    await db.logAnalytics('output_deleted', undefined, undefined, {
      outputId,
      type: (output as any).type
    })
    
    return c.json({ success: true })
    
  } catch (error) {
    console.error('Delete output error:', error)
    return c.json({
      error: 'Failed to delete output',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})