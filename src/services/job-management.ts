import type { Env } from '../types/env'

export interface JobStatus {
  id: string
  type: 'video_generation' | 'script_generation' | 'asset_discovery' | 'audio_processing'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  result?: any
  error?: string
  metadata: {
    userId?: string
    priority?: 'low' | 'medium' | 'high'
    estimatedDuration?: number
    startedAt?: string
    completedAt?: string
    steps?: JobStep[]
  }
  createdAt: string
  updatedAt: string
}

export interface JobStep {
  id: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  progress: number
  startedAt?: string
  completedAt?: string
  error?: string
  result?: any
}

export interface CreateJobRequest {
  type: JobStatus['type']
  priority?: 'low' | 'medium' | 'high'
  metadata?: {
    userId?: string
    estimatedDuration?: number
    steps?: Omit<JobStep, 'id' | 'status' | 'progress'>[]
  }
}

export interface UpdateJobRequest {
  status?: JobStatus['status']
  progress?: number
  result?: any
  error?: string
  currentStep?: string
  stepProgress?: number
}

export interface JobSearchFilters {
  type?: JobStatus['type']
  status?: JobStatus['status']
  userId?: string
  priority?: 'low' | 'medium' | 'high'
  createdAfter?: string
  createdBefore?: string
  limit?: number
  offset?: number
}

export class JobManagementService {
  constructor(private env: Env) {}

  /**
   * Create a new job with initial status
   */
  async createJob(request: CreateJobRequest): Promise<JobStatus> {
    const jobId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Initialize steps if provided
    const steps: JobStep[] =
      request.metadata?.steps?.map((step) => ({
        ...step,
        id: crypto.randomUUID(),
        status: 'pending' as const,
        progress: 0,
      })) || []

    const job: JobStatus = {
      id: jobId,
      type: request.type,
      status: 'pending',
      progress: 0,
      metadata: {
        userId: request.metadata?.userId,
        priority: request.priority || 'medium',
        estimatedDuration: request.metadata?.estimatedDuration,
        steps,
      },
      createdAt: now,
      updatedAt: now,
    }

    // Store in database
    await this.env.DB.prepare(
      `
      INSERT INTO jobs (
        id, type, status, progress, result, error, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
      .bind(
        job.id,
        job.type,
        job.status,
        job.progress,
        null,
        null,
        JSON.stringify(job.metadata),
        job.createdAt,
        job.updatedAt
      )
      .run()

    console.log(`Created job ${jobId} of type ${request.type}`)
    return job
  }

  /**
   * Update job status and progress
   */
  async updateJobStatus(jobId: string, updates: UpdateJobRequest): Promise<JobStatus | null> {
    const existing = await this.getJobProgress(jobId)
    if (!existing) {
      throw new Error(`Job ${jobId} not found`)
    }

    const now = new Date().toISOString()
    const updatedJob: JobStatus = {
      ...existing,
      ...updates,
      updatedAt: now,
    }

    // Handle step updates
    if (updates.currentStep && existing.metadata.steps) {
      const steps = [...existing.metadata.steps]
      const stepIndex = steps.findIndex((s) => s.name === updates.currentStep)

      if (stepIndex >= 0) {
        steps[stepIndex] = {
          ...steps[stepIndex],
          status: updates.stepProgress === 100 ? 'completed' : 'processing',
          progress: updates.stepProgress || steps[stepIndex].progress,
          startedAt: steps[stepIndex].startedAt || now,
          completedAt: updates.stepProgress === 100 ? now : undefined,
        }
      }

      updatedJob.metadata = {
        ...updatedJob.metadata,
        steps,
      }
    }

    // Set completion timestamp
    if (updates.status === 'completed' || updates.status === 'failed') {
      updatedJob.metadata.completedAt = now
    }

    // Set start timestamp if moving to processing
    if (updates.status === 'processing' && existing.status === 'pending') {
      updatedJob.metadata.startedAt = now
    }

    // Update in database
    await this.env.DB.prepare(
      `
      UPDATE jobs 
      SET status = ?, progress = ?, result = ?, error = ?, metadata = ?, updated_at = ?
      WHERE id = ?
    `
    )
      .bind(
        updatedJob.status,
        updatedJob.progress,
        updates.result ? JSON.stringify(updates.result) : existing.result,
        updates.error || existing.error,
        JSON.stringify(updatedJob.metadata),
        updatedJob.updatedAt,
        jobId
      )
      .run()

    console.log(
      `Updated job ${jobId}: ${updates.status || existing.status} (${updatedJob.progress}%)`
    )
    return updatedJob
  }

  /**
   * Get job progress and current status
   */
  async getJobProgress(jobId: string): Promise<JobStatus | null> {
    const result = await this.env.DB.prepare(
      `
      SELECT * FROM jobs WHERE id = ?
    `
    )
      .bind(jobId)
      .first()

    if (!result) return null

    return {
      id: result.id as string,
      type: result.type as JobStatus['type'],
      status: result.status as JobStatus['status'],
      progress: result.progress as number,
      result: result.result ? JSON.parse(result.result as string) : undefined,
      error: (result.error as string) || undefined,
      metadata: JSON.parse(result.metadata as string),
      createdAt: result.created_at as string,
      updatedAt: result.updated_at as string,
    }
  }

  /**
   * Delete a job and its associated data
   */
  async deleteJob(jobId: string): Promise<boolean> {
    const job = await this.getJobProgress(jobId)
    if (!job) return false

    // Only allow deletion of completed, failed, or cancelled jobs
    if (!['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new Error(
        `Cannot delete job ${jobId} with status ${job.status}. Only completed, failed, or cancelled jobs can be deleted.`
      )
    }

    const result = await this.env.DB.prepare(
      `
      DELETE FROM jobs WHERE id = ?
    `
    )
      .bind(jobId)
      .run()

    console.log(`Deleted job ${jobId}`)
    return result.success
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<JobStatus | null> {
    const job = await this.getJobProgress(jobId)
    if (!job) return null

    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      throw new Error(`Cannot cancel job ${jobId} with status ${job.status}`)
    }

    return await this.updateJobStatus(jobId, {
      status: 'cancelled',
      error: 'Job cancelled by user',
    })
  }

  /**
   * Search and filter jobs
   */
  async searchJobs(filters: JobSearchFilters = {}): Promise<JobStatus[]> {
    let query = 'SELECT * FROM jobs WHERE 1=1'
    const params: any[] = []

    if (filters.type) {
      query += ' AND type = ?'
      params.push(filters.type)
    }

    if (filters.status) {
      query += ' AND status = ?'
      params.push(filters.status)
    }

    if (filters.userId) {
      query += ' AND JSON_EXTRACT(metadata, "$.userId") = ?'
      params.push(filters.userId)
    }

    if (filters.priority) {
      query += ' AND JSON_EXTRACT(metadata, "$.priority") = ?'
      params.push(filters.priority)
    }

    if (filters.createdAfter) {
      query += ' AND created_at >= ?'
      params.push(filters.createdAfter)
    }

    if (filters.createdBefore) {
      query += ' AND created_at <= ?'
      params.push(filters.createdBefore)
    }

    query += ' ORDER BY created_at DESC'

    if (filters.limit) {
      query += ' LIMIT ?'
      params.push(filters.limit)
    }

    if (filters.offset) {
      query += ' OFFSET ?'
      params.push(filters.offset)
    }

    const results = await this.env.DB.prepare(query)
      .bind(...params)
      .all()

    return results.results.map((row) => ({
      id: row.id as string,
      type: row.type as JobStatus['type'],
      status: row.status as JobStatus['status'],
      progress: row.progress as number,
      result: row.result ? JSON.parse(row.result as string) : undefined,
      error: (row.error as string) || undefined,
      metadata: JSON.parse(row.metadata as string),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }))
  }

  /**
   * Get job statistics
   */
  async getJobStatistics(): Promise<{
    total: number
    byStatus: Record<JobStatus['status'], number>
    byType: Record<JobStatus['type'], number>
    averageDuration: number
    successRate: number
  }> {
    const stats = await this.env.DB.prepare(
      `
      SELECT 
        COUNT(*) as total,
        status,
        type,
        AVG(
          CASE 
            WHEN status IN ('completed', 'failed') 
            THEN (julianday(JSON_EXTRACT(metadata, '$.completedAt')) - julianday(JSON_EXTRACT(metadata, '$.startedAt'))) * 24 * 60 * 60
            ELSE NULL 
          END
        ) as avg_duration
      FROM jobs 
      GROUP BY status, type
    `
    ).all()

    const byStatus: Record<JobStatus['status'], number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }

    const byType: Record<JobStatus['type'], number> = {
      video_generation: 0,
      script_generation: 0,
      asset_discovery: 0,
      audio_processing: 0,
    }

    let total = 0
    let completedJobs = 0
    let totalDuration = 0
    let jobsWithDuration = 0

    for (const row of stats.results) {
      const count = row.total as number
      const status = row.status as JobStatus['status']
      const type = row.type as JobStatus['type']
      const avgDuration = row.avg_duration as number

      total += count
      byStatus[status] = (byStatus[status] || 0) + count
      byType[type] = (byType[type] || 0) + count

      if (status === 'completed') {
        completedJobs += count
      }

      if (avgDuration) {
        totalDuration += avgDuration * count
        jobsWithDuration += count
      }
    }

    return {
      total,
      byStatus,
      byType,
      averageDuration: jobsWithDuration > 0 ? totalDuration / jobsWithDuration : 0,
      successRate: total > 0 ? completedJobs / total : 0,
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const result = await this.env.DB.prepare(
      `
      DELETE FROM jobs 
      WHERE status IN ('completed', 'failed', 'cancelled') 
      AND created_at < ?
    `
    )
      .bind(cutoffDate.toISOString())
      .run()

    console.log(`Cleaned up old jobs older than ${olderThanDays} days`)
    return result.success ? 1 : 0
  }

  /**
   * Get jobs requiring attention (failed, stuck, etc.)
   */
  async getJobsRequiringAttention(): Promise<JobStatus[]> {
    const twoHoursAgo = new Date()
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2)

    return await this.searchJobs({
      status: 'processing',
      createdBefore: twoHoursAgo.toISOString(),
    })
  }
}
