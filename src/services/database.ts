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

interface VideoJobRecord {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  inputData: string
  progress?: number
  currentStage?: string
  progressMessage?: string
  outputUrl?: string
  error?: string
  metadata?: string
  createdAt: string
  updatedAt?: string
  completedAt?: string
}

export class DatabaseService {
  public db: D1Database

  constructor(db: D1Database) {
    this.db = db
  }

  async createPrompt(prompt: PromptRecord): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO prompts (
        id, original_prompt, enhanced_prompt, model, parameters, 
        status, created_at, user_agent, ip_address
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `
      )
      .bind(
        prompt.id,
        prompt.originalPrompt,
        prompt.enhancedPrompt,
        prompt.model,
        prompt.parameters,
        Date.now(),
        prompt.userAgent,
        prompt.ipAddress
      )
      .run()
  }

  async updatePromptStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    if (status === 'completed' || status === 'failed') {
      await this.db
        .prepare(
          `
        UPDATE prompts 
        SET status = ?, completed_at = ?, error_message = ?
        WHERE id = ?
      `
        )
        .bind(status, Date.now(), errorMessage || null, id)
        .run()
    } else {
      await this.db
        .prepare(
          `
        UPDATE prompts 
        SET status = ?, error_message = ?
        WHERE id = ?
      `
        )
        .bind(status, errorMessage || null, id)
        .run()
    }
  }

  async updatePromptMetadata(id: string, metadata: string): Promise<void> {
    await this.db
      .prepare(
        `
      UPDATE prompts 
      SET parameters = ?
      WHERE id = ?
    `
      )
      .bind(metadata, id)
      .run()
  }

  async createOutput(output: OutputRecord): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO outputs (
        id, prompt_id, url, r2_key, type, width, height, 
        duration, file_size, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
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
      )
      .run()
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

    const result = await this.db
      .prepare(query)
      .bind(...params)
      .all()

    return (
      result.results?.map((row: any) => ({
        ...row,
        parameters: JSON.parse(row.parameters || '{}'),
        output_urls: row.output_urls ? row.output_urls.split(',') : [],
      })) || []
    )
  }

  async getPromptById(id: string): Promise<any> {
    const result = await this.db
      .prepare(
        `
      SELECT p.*, 
             o.id as output_id, o.url as output_url, o.type as output_type,
             o.width, o.height, o.duration, o.file_size, o.metadata
      FROM prompts p
      LEFT JOIN outputs o ON p.id = o.prompt_id
      WHERE p.id = ?
    `
      )
      .bind(id)
      .all()

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
      outputs: result.results
        .filter((r: any) => r.output_id)
        .map((r: any) => ({
          id: r.output_id,
          url: r.output_url,
          type: r.output_type,
          width: r.width,
          height: r.height,
          duration: r.duration,
          fileSize: r.file_size,
          metadata: r.metadata ? JSON.parse(r.metadata) : null,
        })),
    }

    return prompt
  }

  async logAnalytics(
    eventType: string,
    promptId?: string,
    model?: string,
    metadata?: any
  ): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO analytics (id, event_type, prompt_id, model, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
        crypto.randomUUID(),
        eventType,
        promptId || null,
        model || null,
        Date.now(),
        metadata ? JSON.stringify(metadata) : null
      )
      .run()
  }

  async getAnalytics(days = 7): Promise<any[]> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000

    const result = await this.db
      .prepare(
        `
      SELECT event_type, model, COUNT(*) as count
      FROM analytics
      WHERE timestamp > ?
      GROUP BY event_type, model
      ORDER BY count DESC
    `
      )
      .bind(since)
      .all()

    return result.results || []
  }

  // Video Job Management Methods

  async createVideoJob(job: VideoJobRecord): Promise<void> {
    await this.db
      .prepare(
        `
      INSERT INTO video_jobs (
        id, status, input_data, progress, current_stage, progress_message,
        output_url, error, metadata, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .bind(
        job.id,
        job.status,
        job.inputData,
        job.progress || null,
        job.currentStage || null,
        job.progressMessage || null,
        job.outputUrl || null,
        job.error || null,
        job.metadata || null,
        job.createdAt,
        job.updatedAt || null,
        job.completedAt || null
      )
      .run()
  }

  async getVideoJob(id: string): Promise<VideoJobRecord | null> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM video_jobs WHERE id = ?
    `
      )
      .bind(id)
      .first()

    if (!result) return null

    return {
      id: result.id as string,
      status: result.status as any,
      inputData: result.input_data as string,
      progress: result.progress as number,
      currentStage: result.current_stage as string,
      progressMessage: result.progress_message as string,
      outputUrl: result.output_url as string,
      error: result.error as string,
      metadata: result.metadata as string,
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
      completedAt: result.completed_at as string,
    }
  }

  async updateVideoJob(id: string, updates: Partial<VideoJobRecord>): Promise<void> {
    const fields: string[] = []
    const values: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        // Convert camelCase to snake_case for database
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        fields.push(`${dbKey} = ?`)
        values.push(value)
      }
    })

    if (fields.length === 0) return

    values.push(id)

    await this.db
      .prepare(
        `
      UPDATE video_jobs 
      SET ${fields.join(', ')}
      WHERE id = ?
    `
      )
      .bind(...values)
      .run()
  }

  async getVideoJobs(limit = 50, offset = 0): Promise<VideoJobRecord[]> {
    const result = await this.db
      .prepare(
        `
      SELECT * FROM video_jobs
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
      )
      .bind(limit, offset)
      .all()

    return (
      result.results?.map((row: any) => ({
        id: row.id,
        status: row.status,
        inputData: row.input_data,
        progress: row.progress,
        currentStage: row.current_stage,
        progressMessage: row.progress_message,
        outputUrl: row.output_url,
        error: row.error,
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      })) || []
    )
  }

  async deleteVideoJob(id: string): Promise<void> {
    await this.db
      .prepare(
        `
      DELETE FROM video_jobs WHERE id = ?
    `
      )
      .bind(id)
      .run()
  }

  // Asset management methods
  async createAsset(asset: any): Promise<any> {
    await this.db
      .prepare(`
        INSERT INTO assets (
          id, filename, contentType, size, r2Key, url, assetType, 
          uploadedAt, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        asset.id,
        asset.filename,
        asset.contentType,
        asset.size,
        asset.r2Key,
        asset.url,
        asset.assetType,
        asset.uploadedAt,
        JSON.stringify(asset.metadata)
      )
      .run()

    return asset
  }

  async getAsset(id: string): Promise<any> {
    const result = await this.db
      .prepare('SELECT * FROM assets WHERE id = ?')
      .bind(id)
      .first()

    if (!result) return null

    return {
      ...result,
      metadata: JSON.parse((result.metadata as string) || '{}')
    }
  }

  async deleteAsset(id: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM assets WHERE id = ?')
      .bind(id)
      .run()
  }

  async getAssets(page: number = 1, pageSize: number = 20): Promise<any> {
    const offset = (page - 1) * pageSize

    const [assets, countResult] = await Promise.all([
      this.db
        .prepare('SELECT * FROM assets ORDER BY uploadedAt DESC LIMIT ? OFFSET ?')
        .bind(pageSize, offset)
        .all(),
      this.db
        .prepare('SELECT COUNT(*) as total FROM assets')
        .first()
    ])

    const total = (countResult?.total as number) || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      assets: assets.results?.map(asset => ({
        ...asset,
        metadata: JSON.parse((asset.metadata as string) || '{}')
      })) || [],
      total,
      page,
      pageSize,
      totalPages
    }
  }

  async getAssetsByType(type: string, page: number = 1, pageSize: number = 20): Promise<any> {
    const offset = (page - 1) * pageSize

    const [assets, countResult] = await Promise.all([
      this.db
        .prepare('SELECT * FROM assets WHERE assetType = ? ORDER BY uploadedAt DESC LIMIT ? OFFSET ?')
        .bind(type, pageSize, offset)
        .all(),
      this.db
        .prepare('SELECT COUNT(*) as total FROM assets WHERE assetType = ?')
        .bind(type)
        .first()
    ])

    const total = (countResult?.total as number) || 0
    const totalPages = Math.ceil(total / pageSize)

    return {
      assets: assets.results?.map(asset => ({
        ...asset,
        metadata: JSON.parse((asset.metadata as string) || '{}')
      })) || [],
      total,
      page,
      pageSize,
      totalPages
    }
  }
}
