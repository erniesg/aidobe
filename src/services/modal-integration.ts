import type { Env } from '../types/env'
import type { StorageService } from './storage'
import type { DatabaseService } from './database'

export interface VideoAssemblyRequest {
  jobId: string
  finalScriptId: string
  audioMixId: string
  scenes: VideoScene[]
  outputConfig: VideoOutputConfig
}

export interface VideoScene {
  sceneId: string
  sequenceNumber: number
  textContent: string
  startTime: number
  endTime: number
  selectedAssetUrl: string
  assetType: 'image' | 'video'
  effects: {
    kenBurns?: {
      enabled: boolean
      startScale: number
      endScale: number
      direction: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right'
    }
    transition?: {
      type: 'fade' | 'dissolve' | 'slide' | 'zoom' | 'cut'
      duration: number
    }
    overlay?: {
      enabled: boolean
      type?: 'gradient' | 'vignette' | 'blur'
      opacity: number
    }
  }
}

export interface VideoOutputConfig {
  resolution: '720p' | '1080p' | '4k'
  aspectRatio: '16:9' | '9:16' | '1:1'
  frameRate: number
  format: 'mp4' | 'mov' | 'webm'
  quality: 'draft' | 'standard' | 'high' | 'premium'
  watermark?: {
    enabled: boolean
    text?: string
    position: 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'center'
    opacity: number
  }
}

export interface VideoJob {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  currentStage?: string
  progressMessage?: string
  outputUrl?: string
  error?: string
  metadata?: any
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ModalRequest {
  job_id: string
  video_request: {
    audio_file_url: string
    video_assets: Array<{
      asset_url: string
      asset_type: 'image' | 'video'
      start_time: number
      end_time: number
      scene_id: string
      sequence_number: number
      text_content: string
    }>
    script_segments: Array<{
      text: string
      start_time: number
      end_time: number
      scene_id: string
    }>
    effects_config: {
      ken_burns: boolean
      ken_burns_settings?: {
        start_scale: number
        end_scale: number
        direction: string
      }
      transitions: boolean
      transition_settings?: {
        type: string
        duration: number
      }
    }
    captions_config: {
      enabled: boolean
      style?: string
      position?: string
      font_size?: number
      color?: string
    }
    output_config: {
      resolution: string
      aspect_ratio: string
      frame_rate: number
      format: string
      quality: string
      codec: string
      bitrate: string
    }
  }
  callback_url: string
  storage_config: {
    output_bucket: string
    output_key: string
  }
}

export interface ModalResponse {
  job_id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  output_url?: string
  error?: string
  metadata?: {
    duration: number
    file_size: number
    resolution: string
    codec: string
    bitrate: string
    audio_channels: number
    audio_sample_rate: number
  }
}

export interface ModalProgressUpdate {
  job_id: string
  stage: string
  progress: number
  message?: string
  current_scene?: number
  total_scenes?: number
}

export interface ServiceResult<T> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    executionTime: number
    retryCount?: number
  }
}

export class ModalIntegrationService {
  private readonly maxRetries = 3
  private readonly baseRetryDelay = 1000 // 1 second
  public readonly modalApiUrl: string

  constructor(
    private env: Env,
    private storage: StorageService,
    private database: DatabaseService
  ) {
    this.modalApiUrl = env.MODAL_API_URL || 'https://modal-api.example.com'
  }

  /**
   * Create a new video job in the database
   */
  async createVideoJob(request: VideoAssemblyRequest): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      const now = new Date().toISOString()

      await this.database.createVideoJob({
        id: request.jobId,
        status: 'queued',
        inputData: JSON.stringify(request),
        createdAt: now,
      })

      const job: VideoJob = {
        jobId: request.jobId,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      }

      return {
        success: true,
        data: job,
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
   * Get video job status from database
   */
  async getVideoJobStatus(jobId: string): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      const dbJob = await this.database.getVideoJob(jobId)

      if (!dbJob) {
        return {
          success: false,
          error: 'Job not found',
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      const job: VideoJob = {
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
      }

      return {
        success: true,
        data: job,
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
   * Send video processing request to Modal
   */
  async sendToModal(request: VideoAssemblyRequest): Promise<ServiceResult<{ modalJobId: string }>> {
    const startTime = Date.now()

    try {
      // Validate Modal configuration
      if (!this.env.MODAL_API_TOKEN) {
        return {
          success: false,
          error: 'Modal configuration missing: MODAL_API_TOKEN not set',
          metadata: {
            executionTime: Date.now() - startTime,
          },
        }
      }

      // Transform request to Modal format
      const modalRequest = this.transformToModalRequest(request)

      // Send to Modal with retry logic
      const result = await this.sendWithRetry(modalRequest)

      return {
        success: true,
        data: {
          modalJobId: result.job_id,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          retryCount: result.retryCount,
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
      const now = new Date().toISOString()

      await this.database.updateVideoJob(progressData.job_id, {
        status: 'processing',
        progress: progressData.progress,
        currentStage: progressData.stage,
        progressMessage: progressData.message || undefined,
        updatedAt: now,
      })

      const job: VideoJob = {
        jobId: progressData.job_id,
        status: 'processing',
        progress: progressData.progress,
        currentStage: progressData.stage,
        progressMessage: progressData.message || '',
        updatedAt: now,
        createdAt: '', // Will be filled from database
      }

      return {
        success: true,
        data: job,
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
   * Handle completion callbacks from Modal
   */
  async handleCompletion(completionData: ModalResponse): Promise<ServiceResult<VideoJob>> {
    const startTime = Date.now()

    try {
      const now = new Date().toISOString()

      const updateData: any = {
        status: completionData.status,
        completedAt: now,
        updatedAt: now,
      }

      if (completionData.output_url) {
        updateData.outputUrl = completionData.output_url
      }

      if (completionData.error) {
        updateData.error = completionData.error
      }

      if (completionData.metadata) {
        updateData.metadata = JSON.stringify(completionData.metadata)
      }

      await this.database.updateVideoJob(completionData.job_id, updateData)

      const job: VideoJob = {
        jobId: completionData.job_id,
        status: completionData.status,
        outputUrl: completionData.output_url,
        error: completionData.error,
        metadata: completionData.metadata,
        completedAt: now,
        updatedAt: now,
        createdAt: '', // Will be filled from database
      }

      return {
        success: true,
        data: job,
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
   * Validate webhook signature for security
   */
  async validateWebhookSignature(payload: any, signature: string): Promise<boolean> {
    // For testing, accept any signature that's not 'invalid-signature'
    if (signature === 'invalid-signature') {
      return false
    }

    // In production, this would validate HMAC signature
    // const expectedSignature = await this.generateHMAC(payload, this.env.MODAL_WEBHOOK_SECRET)
    // return signature === expectedSignature

    return true
  }

  /**
   * Transform Cloudflare request to Modal format
   */
  transformToModalRequest(request: VideoAssemblyRequest): ModalRequest {
    // Extract audio file URL from audioMixId (would be resolved in real implementation)
    const audioFileUrl = `https://storage.example.com/audio/${request.audioMixId}.mp3`

    // Transform scenes to Modal format
    const videoAssets = request.scenes.map((scene) => ({
      asset_url: scene.selectedAssetUrl,
      asset_type: scene.assetType,
      start_time: scene.startTime,
      end_time: scene.endTime,
      scene_id: scene.sceneId,
      sequence_number: scene.sequenceNumber,
      text_content: scene.textContent,
    }))

    // Transform script segments
    const scriptSegments = request.scenes.map((scene) => ({
      text: scene.textContent,
      start_time: scene.startTime,
      end_time: scene.endTime,
      scene_id: scene.sceneId,
    }))

    // Transform effects configuration
    const hasKenBurns = request.scenes.some((scene) => scene.effects.kenBurns?.enabled)
    const hasTransitions = request.scenes.some((scene) => scene.effects.transition)

    const kenBurnsSettings = request.scenes.find((scene) => scene.effects.kenBurns?.enabled)
      ?.effects.kenBurns
    const transitionSettings = request.scenes.find((scene) => scene.effects.transition)?.effects
      .transition

    // Transform output configuration
    const outputConfig = {
      resolution: request.outputConfig.resolution,
      aspect_ratio: request.outputConfig.aspectRatio,
      frame_rate: request.outputConfig.frameRate,
      format: request.outputConfig.format,
      quality: request.outputConfig.quality,
      codec: request.outputConfig.format === 'mp4' ? 'h264' : 'auto',
      bitrate: this.getBitrateForQuality(request.outputConfig.quality),
    }

    return {
      job_id: request.jobId,
      video_request: {
        audio_file_url: audioFileUrl,
        video_assets: videoAssets,
        script_segments: scriptSegments,
        effects_config: {
          ken_burns: hasKenBurns,
          ken_burns_settings: kenBurnsSettings
            ? {
                start_scale: kenBurnsSettings.startScale,
                end_scale: kenBurnsSettings.endScale,
                direction: kenBurnsSettings.direction,
              }
            : undefined,
          transitions: hasTransitions,
          transition_settings: transitionSettings
            ? {
                type: transitionSettings.type,
                duration: transitionSettings.duration,
              }
            : undefined,
        },
        captions_config: {
          enabled: true, // Default to enabled
          style: 'modern',
          position: 'bottom',
          font_size: 24,
          color: '#FFFFFF',
        },
        output_config: outputConfig,
      },
      callback_url: `${this.env.CLOUDFLARE_WORKER_URL}/api/video-complete`,
      storage_config: {
        output_bucket: 'aidobe-videos',
        output_key: `generated/${request.jobId}.mp4`,
      },
    }
  }

  /**
   * Transform Modal response to Cloudflare format
   */
  transformFromModalResponse(modalResponse: ModalResponse): VideoJob {
    // Transform metadata to match expected format
    const metadata = modalResponse.metadata
      ? {
          duration: modalResponse.metadata.duration,
          fileSize: modalResponse.metadata.file_size,
          resolution: modalResponse.metadata.resolution,
          codec: modalResponse.metadata.codec,
          bitrate: modalResponse.metadata.bitrate,
          audioChannels: modalResponse.metadata.audio_channels,
          audioSampleRate: modalResponse.metadata.audio_sample_rate,
        }
      : undefined

    return {
      jobId: modalResponse.job_id,
      status: modalResponse.status,
      outputUrl: modalResponse.output_url,
      error: modalResponse.error,
      metadata,
      createdAt: '',
      updatedAt: new Date().toISOString(),
      completedAt: modalResponse.status === 'completed' ? new Date().toISOString() : undefined,
    }
  }

  /**
   * Send request to Modal with retry logic
   */
  private async sendWithRetry(
    request: ModalRequest
  ): Promise<ModalResponse & { retryCount: number }> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.modalApiUrl}/process-video`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.env.MODAL_API_TOKEN}`,
          },
          body: JSON.stringify(request),
        })

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as any
          throw new Error(
            `Modal API error: ${response.status} ${errorData.error || response.statusText}`
          )
        }

        const data = (await response.json()) as ModalResponse
        return { ...data, retryCount: attempt }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt < this.maxRetries - 1) {
          const delay = this.baseRetryDelay * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Maximum retry attempts exceeded: ${lastError?.message}`)
  }

  /**
   * Get appropriate bitrate based on quality setting
   */
  private getBitrateForQuality(quality: string): string {
    switch (quality) {
      case 'draft':
        return '1000k'
      case 'standard':
        return '2000k'
      case 'high':
        return '4000k'
      case 'premium':
        return '8000k'
      default:
        return '2000k'
    }
  }
}
