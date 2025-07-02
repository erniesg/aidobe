interface PromptRecord {
  id: string
  originalPrompt: string
  enhancedPrompt?: string | null
  model: string
  parameters: string
  userAgent: string
  ipAddress: string
}

interface OutputRecord {
  id: string
  promptId: string
  url: string
  r2Key: string
  type: 'image' | 'video'
  width?: number
  height?: number
  duration?: number
  fileSize?: number
  metadata?: string
}

export class DatabaseService {
  public db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async createPrompt(prompt: PromptRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO prompts (
        id, original_prompt, enhanced_prompt, model, parameters, 
        status, created_at, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `).bind(
      prompt.id,
      prompt.originalPrompt,
      prompt.enhancedPrompt,
      prompt.model,
      prompt.parameters,
      Date.now(),
      prompt.userAgent,
      prompt.ipAddress
    ).run()
  }

  async updatePromptStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    if (status === 'completed' || status === 'failed') {
      await this.db.prepare(`
        UPDATE prompts 
        SET status = ?, completed_at = ?, error_message = ?
        WHERE id = ?
      `).bind(status, Date.now(), errorMessage || null, id).run()
    } else {
      await this.db.prepare(`
        UPDATE prompts 
        SET status = ?, error_message = ?
        WHERE id = ?
      `).bind(status, errorMessage || null, id).run()
    }
  }

  async createOutput(output: OutputRecord): Promise<void> {
    await this.db.prepare(`
      INSERT INTO outputs (
        id, prompt_id, url, r2_key, type, width, height, 
        duration, file_size, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      output.id,
      output.promptId,
      output.url,
      output.r2Key,
      output.type,
      output.width || null,
      output.height || null,
      output.duration || null,
      output.fileSize || null,
      output.metadata || null,
      Date.now()
    ).run()
  }

  async getPrompts(type?: string, limit = 50, offset = 0): Promise<any[]> {
    let query = `
      SELECT p.*, 
             COUNT(o.id) as output_count,
             GROUP_CONCAT(o.url) as output_urls
      FROM prompts p
      LEFT JOIN outputs o ON p.id = o.prompt_id
    `
    
    const params: any[] = []
    
    if (type) {
      query += ` WHERE o.type = ? OR o.type IS NULL`
      params.push(type)
    }
    
    query += `
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `
    params.push(limit, offset)
    
    const result = await this.db.prepare(query).bind(...params).all()
    
    return result.results?.map((row: any) => ({
      ...row,
      parameters: JSON.parse(row.parameters || '{}'),
      output_urls: row.output_urls ? row.output_urls.split(',') : []
    })) || []
  }

  async getPromptById(id: string): Promise<any> {
    const result = await this.db.prepare(`
      SELECT p.*, 
             o.id as output_id, o.url as output_url, o.type as output_type,
             o.width, o.height, o.duration, o.file_size, o.metadata
      FROM prompts p
      LEFT JOIN outputs o ON p.id = o.prompt_id
      WHERE p.id = ?
    `).bind(id).all()
    
    if (!result.results?.length) return null
    
    const first = result.results[0] as any
    const prompt = {
      id: first.id,
      originalPrompt: first.original_prompt,
      enhancedPrompt: first.enhanced_prompt,
      model: first.model,
      parameters: JSON.parse(first.parameters || '{}'),
      status: first.status,
      createdAt: first.created_at,
      completedAt: first.completed_at,
      errorMessage: first.error_message,
      outputs: result.results.filter((r: any) => r.output_id).map((r: any) => ({
        id: r.output_id,
        url: r.output_url,
        type: r.output_type,
        width: r.width,
        height: r.height,
        duration: r.duration,
        fileSize: r.file_size,
        metadata: r.metadata ? JSON.parse(r.metadata) : null
      }))
    }
    
    return prompt
  }

  async logAnalytics(eventType: string, promptId?: string, model?: string, metadata?: any): Promise<void> {
    await this.db.prepare(`
      INSERT INTO analytics (id, event_type, prompt_id, model, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      eventType,
      promptId || null,
      model || null,
      Date.now(),
      metadata ? JSON.stringify(metadata) : null
    ).run()
  }

  async getAnalytics(days = 7): Promise<any[]> {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    const result = await this.db.prepare(`
      SELECT event_type, model, COUNT(*) as count
      FROM analytics
      WHERE timestamp > ?
      GROUP BY event_type, model
      ORDER BY count DESC
    `).bind(since).all()
    
    return result.results || []
  }
}