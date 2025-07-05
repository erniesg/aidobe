import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../types/env'
import {
  JobManagementService,
  type CreateJobRequest,
  type UpdateJobRequest,
  type JobSearchFilters,
} from '../services/job-management'

const app = new Hono<{ Bindings: Env }>()

// Validation schemas
const CreateJobSchema = z.object({
  type: z.enum(['video_generation', 'script_generation', 'asset_discovery', 'audio_processing']),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  metadata: z
    .object({
      userId: z.string().optional(),
      estimatedDuration: z.number().optional(),
      steps: z
        .array(
          z.object({
            name: z.string(),
            startedAt: z.string().optional(),
            completedAt: z.string().optional(),
            error: z.string().optional(),
            result: z.any().optional(),
          })
        )
        .optional(),
    })
    .optional(),
})

const UpdateJobSchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  progress: z.number().min(0).max(100).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  currentStep: z.string().optional(),
  stepProgress: z.number().min(0).max(100).optional(),
})

const JobSearchSchema = z.object({
  type: z
    .enum(['video_generation', 'script_generation', 'asset_discovery', 'audio_processing'])
    .optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  userId: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
})

export class JobHandlers {
  constructor(private jobService: JobManagementService) {}

  setupRoutes() {
    // Create a new job
    app.post('/create', async (c) => {
      try {
        const body = await c.req.json()
        const validatedRequest = CreateJobSchema.parse(body)

        const job = await this.jobService.createJob(validatedRequest)

        return c.json({
          success: true,
          data: job,
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job creation failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job creation failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          400
        )
      }
    })

    // Get job status/progress
    app.get('/:jobId', async (c) => {
      try {
        const jobId = c.req.param('jobId')

        if (!jobId) {
          return c.json(
            {
              success: false,
              error: 'Job ID is required',
            },
            400
          )
        }

        const job = await this.jobService.getJobProgress(jobId)

        if (!job) {
          return c.json(
            {
              success: false,
              error: 'Job not found',
            },
            404
          )
        }

        return c.json({
          success: true,
          data: job,
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job retrieval failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job retrieval failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          500
        )
      }
    })

    // Update job status
    app.patch('/:jobId', async (c) => {
      try {
        const jobId = c.req.param('jobId')
        const body = await c.req.json()
        const validatedRequest = UpdateJobSchema.parse(body)

        if (!jobId) {
          return c.json(
            {
              success: false,
              error: 'Job ID is required',
            },
            400
          )
        }

        const job = await this.jobService.updateJobStatus(jobId, validatedRequest)

        if (!job) {
          return c.json(
            {
              success: false,
              error: 'Job not found',
            },
            404
          )
        }

        return c.json({
          success: true,
          data: job,
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job update failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job update failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          400
        )
      }
    })

    // Cancel a job
    app.post('/:jobId/cancel', async (c) => {
      try {
        const jobId = c.req.param('jobId')

        if (!jobId) {
          return c.json(
            {
              success: false,
              error: 'Job ID is required',
            },
            400
          )
        }

        const job = await this.jobService.cancelJob(jobId)

        if (!job) {
          return c.json(
            {
              success: false,
              error: 'Job not found',
            },
            404
          )
        }

        return c.json({
          success: true,
          data: job,
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job cancellation failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job cancellation failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          400
        )
      }
    })

    // Delete a job
    app.delete('/:jobId', async (c) => {
      try {
        const jobId = c.req.param('jobId')

        if (!jobId) {
          return c.json(
            {
              success: false,
              error: 'Job ID is required',
            },
            400
          )
        }

        const deleted = await this.jobService.deleteJob(jobId)

        return c.json({
          success: true,
          data: { deleted },
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job deletion failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job deletion failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          400
        )
      }
    })

    // Search/list jobs
    app.get('/', async (c) => {
      try {
        const query = c.req.query()
        const validatedQuery = JobSearchSchema.parse({
          type: query.type,
          status: query.status,
          userId: query.userId,
          priority: query.priority,
          createdAfter: query.createdAfter,
          createdBefore: query.createdBefore,
          limit: query.limit ? parseInt(query.limit) : undefined,
          offset: query.offset ? parseInt(query.offset) : undefined,
        })

        const jobs = await this.jobService.searchJobs(validatedQuery)

        return c.json({
          success: true,
          data: jobs,
          metadata: {
            totalResults: jobs.length,
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job search failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job search failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          400
        )
      }
    })

    // Get job statistics
    app.get('/stats/overview', async (c) => {
      try {
        const stats = await this.jobService.getJobStatistics()

        return c.json({
          success: true,
          data: stats,
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job statistics failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job statistics failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          500
        )
      }
    })

    // Get jobs requiring attention
    app.get('/stats/attention', async (c) => {
      try {
        const jobs = await this.jobService.getJobsRequiringAttention()

        return c.json({
          success: true,
          data: jobs,
          metadata: {
            totalResults: jobs.length,
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Jobs requiring attention query failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Query failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          500
        )
      }
    })

    // Cleanup old jobs
    app.post('/cleanup', async (c) => {
      try {
        const body = await c.req.json().catch(() => ({}))
        const olderThanDays = body.olderThanDays || 30

        const deletedCount = await this.jobService.cleanupOldJobs(olderThanDays)

        return c.json({
          success: true,
          data: { deletedCount },
          metadata: {
            executionTime: Date.now(),
            requestId: crypto.randomUUID(),
          },
        })
      } catch (error) {
        console.error('Job cleanup failed:', error)
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : 'Job cleanup failed',
            metadata: {
              executionTime: Date.now(),
              requestId: crypto.randomUUID(),
            },
          },
          500
        )
      }
    })

    return app
  }
}

export function createJobRoutes(env: Env) {
  const jobService = new JobManagementService(env)
  const handlers = new JobHandlers(jobService)

  return handlers.setupRoutes()
}
