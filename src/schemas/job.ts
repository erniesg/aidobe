import { z } from 'zod'

// Article input schema
export const ArticleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  content: z.string().min(10),
  url: z.string().url(),
  author: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  tags: z.array(z.string()).default([])
})

export type Article = z.infer<typeof ArticleSchema>

// Parsed article schema (after processing)
export const ParsedArticleSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  url: z.string().url(),
  keyPoints: z.array(z.string()),
  sentiment: z.enum(['positive', 'negative', 'neutral']),
  tiktokPotential: z.number().min(0).max(1),
  extractedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({})
})

export type ParsedArticle = z.infer<typeof ParsedArticleSchema>

// Job preferences schema
export const JobPreferencesSchema = z.object({
  style: z.enum(['informative', 'dramatic', 'humorous', 'professional']).optional(),
  duration: z.number().min(15).max(120).optional(),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  voice: z.string().optional(),
  musicGenre: z.string().optional(),
  includeEffects: z.boolean().default(true),
  targetAudience: z.enum(['general', 'tech', 'business', 'entertainment']).optional()
})

export type JobPreferences = z.infer<typeof JobPreferencesSchema>

// Job input schema
export const JobInputSchema = z.object({
  articles: z.array(ArticleSchema).min(1).max(10),
  preferences: JobPreferencesSchema.optional(),
  workflowId: z.string().default('default-tiktok-generation'),
  userId: z.string().optional(),
  projectId: z.string().optional()
})

export type JobInput = z.infer<typeof JobInputSchema>

// Checkpoint schema for human review
export const CheckpointSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  type: z.enum([
    'script_review',
    'scene_review', 
    'asset_review',
    'final_review'
  ]),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  data: z.record(z.unknown()),
  reviewUrl: z.string().url().optional(),
  expiresAt: z.string().datetime().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  feedback: z.string().optional(),
  createdAt: z.string().datetime()
})

export type Checkpoint = z.infer<typeof CheckpointSchema>

// Audit log schema
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  action: z.enum([
    'job_created',
    'script_generated',
    'script_edited',
    'script_finalized',
    'scene_plan_created',
    'scene_edited',
    'asset_searched',
    'asset_generated',
    'asset_selected',
    'audio_generated',
    'video_assembled',
    'job_completed',
    'job_failed',
    'checkpoint_created',
    'checkpoint_approved',
    'config_updated'
  ]),
  actor: z.string().optional(), // user ID or 'system'
  details: z.record(z.unknown()).default({}),
  timestamp: z.string().datetime(),
  metadata: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    duration: z.number().optional() // milliseconds
  }).optional()
})

export type AuditLog = z.infer<typeof AuditLogSchema>

// Job state schema (for workflow state management)
export const JobStateSchema = z.object({
  currentStep: z.string().optional(),
  completedSteps: z.array(z.string()).default([]),
  articlesParsed: z.boolean().default(false),
  scriptsGenerated: z.boolean().default(false),
  scriptFinalized: z.boolean().default(false),
  scenesExtracted: z.boolean().default(false),
  assetsDiscovered: z.boolean().default(false),
  audioGenerated: z.boolean().default(false),
  videoAssembled: z.boolean().default(false),
  humanReviewRequired: z.boolean().default(false),
  data: z.record(z.unknown()).default({})
})

export type JobState = z.infer<typeof JobStateSchema>

// Job results schema
export const JobResultsSchema = z.object({
  finalVideoUrl: z.string().url().optional(),
  finalVideoId: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  duration: z.number().optional(), // seconds
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive()
  }).optional(),
  fileSize: z.number().optional(), // bytes
  generatedAssets: z.array(z.string()).default([]), // asset URLs
  metadata: z.record(z.unknown()).default({})
})

export type JobResults = z.infer<typeof JobResultsSchema>

// Main video job schema
export const VideoJobSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string(),
  status: z.enum([
    'created',
    'parsing_articles',
    'generating_scripts',
    'awaiting_script_review',
    'extracting_scenes',
    'awaiting_scene_review',
    'discovering_assets',
    'awaiting_asset_review',
    'generating_audio',
    'assembling_video',
    'awaiting_final_review',
    'completed',
    'failed',
    'cancelled'
  ]),
  input: JobInputSchema,
  state: JobStateSchema.default({}),
  results: JobResultsSchema.default({}),
  checkpoints: z.array(CheckpointSchema).default([]),
  audit: z.array(AuditLogSchema).default([]),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    step: z.string().optional(),
    details: z.record(z.unknown()).optional()
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  createdBy: z.string().optional(),
  tags: z.array(z.string()).default([])
})

export type VideoJob = z.infer<typeof VideoJobSchema>

// Job creation input (external API)
export const CreateJobInputSchema = z.object({
  articles: z.array(ArticleSchema).min(1).max(10),
  preferences: JobPreferencesSchema.optional(),
  workflowId: z.string().optional(),
  userId: z.string().optional(),
  projectId: z.string().optional()
})

export type CreateJobInput = z.infer<typeof CreateJobInputSchema>

// Job update input (for state updates)
export const UpdateJobStateInputSchema = z.object({
  status: VideoJobSchema.shape.status.optional(),
  state: z.record(z.unknown()).optional(),
  results: z.record(z.unknown()).optional(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    step: z.string().optional(),
    details: z.record(z.unknown()).optional()
  }).optional()
})

export type UpdateJobStateInput = z.infer<typeof UpdateJobStateInputSchema>

// Validation functions
export function validateJobStateTransition(
  currentStatus: VideoJob['status'], 
  newStatus: VideoJob['status']
): boolean {
  const validTransitions: Record<VideoJob['status'], VideoJob['status'][]> = {
    created: ['parsing_articles', 'failed', 'cancelled'],
    parsing_articles: ['generating_scripts', 'failed', 'cancelled'],
    generating_scripts: ['awaiting_script_review', 'extracting_scenes', 'failed', 'cancelled'],
    awaiting_script_review: ['extracting_scenes', 'generating_scripts', 'failed', 'cancelled'],
    extracting_scenes: ['awaiting_scene_review', 'discovering_assets', 'failed', 'cancelled'],
    awaiting_scene_review: ['discovering_assets', 'extracting_scenes', 'failed', 'cancelled'],
    discovering_assets: ['awaiting_asset_review', 'generating_audio', 'failed', 'cancelled'],
    awaiting_asset_review: ['generating_audio', 'discovering_assets', 'failed', 'cancelled'],
    generating_audio: ['assembling_video', 'failed', 'cancelled'],
    assembling_video: ['awaiting_final_review', 'completed', 'failed', 'cancelled'],
    awaiting_final_review: ['completed', 'assembling_video', 'failed', 'cancelled'],
    completed: [], // Terminal state
    failed: ['created'], // Can restart
    cancelled: ['created'] // Can restart
  }

  return validTransitions[currentStatus]?.includes(newStatus) ?? false
}

export function isTerminalJobStatus(status: VideoJob['status']): boolean {
  return ['completed', 'failed', 'cancelled'].includes(status)
}

export function requiresHumanReview(status: VideoJob['status']): boolean {
  return status.startsWith('awaiting_')
}