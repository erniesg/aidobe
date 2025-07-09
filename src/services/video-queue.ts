import type { Env } from '../types/env'
import type { StorageService } from './storage'
import type { DatabaseService } from './database'
import type {
  ModalIntegrationService,
  VideoAssemblyRequest,
  VideoJob,
  ModalResponse,
  ModalProgressUpdate,
  ServiceResult,
} from './modal-integration'

export interface QueueStats {
  queuedJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  totalJobs: number
  averageProcessingTime?: number
  queuePosition?: number
}

export interface JobHistory {
  jobs: VideoJob[]
  totalCount: number
  currentPage: number
  pageSize: number
  hasNext: boolean
}

export interface JobCancellation {
  jobId: string
  status: 'cancelled'
  cancelledAt: string
  reason: string
}

export class VideoQueueService {
  constructor(
    private env: Env,
    private storage: StorageService,
    private database: DatabaseService,
    private modalIntegration: ModalIntegrationService
  ) {}

  /**
   * Queue a video assembly job
   */
  async queueVideoAssembly(request: VideoAssemblyRequest): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      // Create job in database via Modal integration
      const createResult = await this.modalIntegration.createVideoJob(request)

      if (!createResult.success) {
        return {
          success: false,
          error: createResult.error || 'Failed to create video job',
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      // Send to Modal for processing
      const modalResult = await this.modalIntegration.sendToModal(request)

      if (!modalResult.success) {
        return {
          success: false,
          error: modalResult.error || 'Failed to send job to Modal',
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      return {
        success: true,
        data: createResult.data,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      const result = await this.modalIntegration.getVideoJobStatus(jobId)

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Get job history with pagination
   */
  async getJobHistory(limit = 50, offset = 0): Promise<ServiceResult<JobHistory>> {
    const startTime = Date.now()

    try {
      const dbJobs = await this.database.getVideoJobs(limit, offset)

      const jobs: VideoJob[] = dbJobs.map((dbJob) => ({
        jobId: dbJob.id,
        status: dbJob.status,
        progress: dbJob.progress,
        currentStage: dbJob.currentStage,
        progressMessage: dbJob.progressMessage,
        outputUrl: dbJob.outputUrl,
        error: dbJob.error,
        metadata: dbJob.metadata ? JSON.parse(dbJob.metadata) : undefined,
        createdAt: dbJob.createdAt,
        updatedAt: dbJob.updatedAt || dbJob.createdAt,
        completedAt: dbJob.completedAt,
      }))

      const history: JobHistory = {
        jobs,
        totalCount: jobs.length,
        currentPage: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasNext: jobs.length === limit,
      }

      return {
        success: true,
        data: history,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Cancel a video job
   */
  async cancelJob(jobId: string): Promise<ServiceResult<JobCancellation>> {
    const startTime = Date.now()

    try {
      // First check if job exists and can be cancelled
      const statusResult = await this.modalIntegration.getVideoJobStatus(jobId)

      if (!statusResult.success) {
        return {
          success: false,
          error: statusResult.error || 'Job not found',
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      const job = statusResult.data!

      // Check if job can be cancelled
      if (job.status === 'completed' || job.status === 'failed') {
        return {
          success: false,
          error: `Cannot cancel job in ${job.status} state`,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      // Update job status to cancelled
      const now = new Date().toISOString()
      await this.database.updateVideoJob(jobId, {
        status: 'cancelled',
        updatedAt: now,
      })

      const cancellation: JobCancellation = {
        jobId,
        status: 'cancelled',
        cancelledAt: now,
        reason: 'User requested cancellation',
      }

      return {
        success: true,
        data: cancellation,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Handle progress updates from Modal webhook
   */
  async handleProgressUpdate(progressData: ModalProgressUpdate): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      const result = await this.modalIntegration.handleProgressUpdate(progressData)

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Handle completion updates from Modal webhook
   */
  async handleCompletion(completionData: ModalResponse): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      const result = await this.modalIntegration.handleCompletion(completionData)

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<ServiceResult<QueueStats>> {
    const startTime = Date.now()

    try {
      // Get all jobs to compute statistics
      const dbJobs = await this.database.getVideoJobs(1000, 0) // Get a large number for stats

      const stats: QueueStats = {
        queuedJobs: dbJobs.filter((job) => job.status === 'queued').length,
        processingJobs: dbJobs.filter((job) => job.status === 'processing').length,
        completedJobs: dbJobs.filter((job) => job.status === 'completed').length,
        failedJobs: dbJobs.filter((job) => job.status === 'failed').length,
        totalJobs: dbJobs.length,
      }

      // Calculate average processing time for completed jobs
      const completedJobs = dbJobs.filter((job) => job.status === 'completed' && job.completedAt)
      if (completedJobs.length > 0) {
        const totalProcessingTime = completedJobs.reduce((sum, job) => {
          const created = new Date(job.createdAt).getTime()
          const completed = new Date(job.completedAt!).getTime()
          return sum + (completed - created)
        }, 0)
        stats.averageProcessingTime = Math.round(totalProcessingTime / completedJobs.length)
      }

      return {
        success: true,
        data: stats,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(): Promise<
    ServiceResult<{
      status: 'healthy' | 'degraded' | 'unhealthy'
      queueDepth: number
      processingCapacity: number
      averageResponseTime: number
      errorRate: number
    }>
  > {
    const startTime = Date.now()

    try {
      const statsResult = await this.getQueueStats()

      if (!statsResult.success) {
        return {
          success: false,
          error: statsResult.error,
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      const stats = statsResult.data!

      // Calculate health metrics
      const queueDepth = stats.queuedJobs
      const processingCapacity = stats.processingJobs
      const errorRate = stats.totalJobs > 0 ? stats.failedJobs / stats.totalJobs : 0

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

      // Determine health status based on metrics
      if (queueDepth > 50 || errorRate > 0.1) {
        status = 'degraded'
      }
      if (queueDepth > 100 || errorRate > 0.25) {
        status = 'unhealthy'
      }

      return {
        success: true,
        data: {
          status,
          queueDepth,
          processingCapacity,
          averageResponseTime: stats.averageProcessingTime || 0,
          errorRate,
        },
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      }
    }
  }
}
