import { Hono } from 'hono'
import { z } from 'zod'
import { DatabaseService } from '../services/database'
import { StorageService } from '../services/storage'
import type { Env } from '../types/env'

// Asset upload request schema
const AssetUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  assetType: z.enum(['video', 'image', 'audio']),
  fileData: z.array(z.number()).min(1), // Array of bytes representing file data
  metadata: z.record(z.any()).optional(),
})

// Asset query parameters schema
const AssetListQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  pageSize: z.string().transform(Number).default('20'),
  type: z.enum(['video', 'image', 'audio']).optional(),
})

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  video: 500 * 1024 * 1024, // 500MB
  image: 50 * 1024 * 1024,  // 50MB
  audio: 100 * 1024 * 1024, // 100MB
}

// Supported file types
const SUPPORTED_FILE_TYPES = {
  video: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/aac'],
}

export function createAssetPipelineRoutes() {
  const assetRoutes = new Hono<{ Bindings: Env }>()

  /**
   * POST /api/assets/upload
   * Upload a new asset (video, image, or audio)
   */
  assetRoutes.post('/upload', async (c) => {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
      console.log(`[${requestId}] Asset upload request received`)

      // Parse and validate request body
      const body = await c.req.json()
      const validation = AssetUploadSchema.safeParse(body)

      if (!validation.success) {
        return c.json({
          success: false,
          error: 'Invalid request format',
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      const { filename, contentType, assetType, fileData, metadata } = validation.data

      // Validate file type
      if (!SUPPORTED_FILE_TYPES[assetType].includes(contentType)) {
        return c.json({
          success: false,
          error: `Unsupported file type: ${contentType} for asset type: ${assetType}`,
          supportedTypes: SUPPORTED_FILE_TYPES[assetType],
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      // Validate file size
      const fileSize = fileData.length
      if (fileSize > FILE_SIZE_LIMITS[assetType]) {
        return c.json({
          success: false,
          error: `File size exceeds maximum limit of ${Math.round(FILE_SIZE_LIMITS[assetType] / 1024 / 1024)}MB for ${assetType} assets`,
          currentSize: Math.round(fileSize / 1024 / 1024),
          maxSize: Math.round(FILE_SIZE_LIMITS[assetType] / 1024 / 1024),
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      // Convert file data array back to ArrayBuffer
      const fileBuffer = new Uint8Array(fileData).buffer

      // Generate unique asset ID and R2 key
      const assetId = crypto.randomUUID()
      const fileExtension = filename.split('.').pop()
      const r2Key = `assets/${assetId}.${fileExtension}`

      console.log(`[${requestId}] Uploading asset ${assetId} (${Math.round(fileSize / 1024 / 1024)}MB)`)

      // Initialize services
      const db = new DatabaseService(c.env.DB)
      const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)

      // Upload to R2 storage
      const uploadResult = await storage.uploadAsset(r2Key, fileBuffer, contentType)

      if (!uploadResult.success) {
        console.error(`[${requestId}] Storage upload failed:`, uploadResult.error)
        return c.json({
          success: false,
          error: uploadResult.error,
          timestamp: new Date().toISOString(),
          requestId,
        }, 500)
      }

      // Create asset record in database
      const assetRecord = {
        id: assetId,
        filename,
        contentType,
        size: fileSize,
        r2Key,
        url: uploadResult.data!.url,
        assetType,
        uploadedAt: new Date().toISOString(),
        metadata: metadata || {},
      }

      const dbAsset = await db.createAsset(assetRecord)

      const response = {
        success: true,
        data: {
          asset: dbAsset,
          upload: {
            url: uploadResult.data!.url,
            key: r2Key,
            size: fileSize,
            contentType,
            uploadedAt: uploadResult.data!.uploadedAt,
          },
          summary: {
            assetId,
            filename,
            assetType,
            sizeFormatted: `${Math.round(fileSize / 1024 / 1024 * 100) / 100}MB`,
            processingTime: Date.now() - startTime,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }

      console.log(`[${requestId}] Asset ${assetId} uploaded successfully in ${Date.now() - startTime}ms`)
      return c.json(response, 201)

    } catch (error) {
      console.error(`[${requestId}] Asset upload failed:`, error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }
  })

  /**
   * GET /api/assets/:assetId/download
   * Generate a secure download URL for an asset
   */
  assetRoutes.get('/:assetId/download', async (c) => {
    const requestId = crypto.randomUUID()

    try {
      const assetId = c.req.param('assetId')

      if (!assetId) {
        return c.json({
          success: false,
          error: 'Asset ID is required',
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      console.log(`[${requestId}] Generating download URL for asset ${assetId}`)

      // Initialize services
      const db = new DatabaseService(c.env.DB)
      const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)

      // Get asset from database
      const asset = await db.getAsset(assetId)

      if (!asset) {
        console.warn(`[${requestId}] Asset ${assetId} not found`)
        return c.json({
          success: false,
          error: 'Asset not found',
          timestamp: new Date().toISOString(),
          requestId,
        }, 404)
      }

      // Generate download URL from storage
      const downloadResult = await storage.getDownloadUrl(asset.r2Key)

      if (!downloadResult.success) {
        console.error(`[${requestId}] Failed to generate download URL:`, downloadResult.error)
        return c.json({
          success: false,
          error: downloadResult.error,
          timestamp: new Date().toISOString(),
          requestId,
        }, 500)
      }

      const response = {
        success: true,
        data: {
          downloadUrl: downloadResult.data!.downloadUrl,
          expiresAt: downloadResult.data!.expiresAt,
          asset: {
            id: asset.id,
            filename: asset.filename,
            size: asset.size,
            assetType: asset.assetType,
            contentType: asset.contentType,
            uploadedAt: asset.uploadedAt,
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }

      console.log(`[${requestId}] Download URL generated for asset ${assetId}`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Download URL generation failed:`, error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }
  })

  /**
   * GET /api/assets
   * List assets with pagination and filtering
   */
  assetRoutes.get('/', async (c) => {
    const requestId = crypto.randomUUID()

    try {
      // Parse query parameters
      const queryParams: Record<string, string> = {}
      const queries = c.req.queries()
      for (const [key, value] of Object.entries(queries)) {
        queryParams[key] = Array.isArray(value) ? value[0] : value
      }
      const validation = AssetListQuerySchema.safeParse(queryParams)

      if (!validation.success) {
        return c.json({
          success: false,
          error: 'Invalid query parameters',
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      const { page, pageSize, type } = validation.data

      console.log(`[${requestId}] Listing assets: page=${page}, pageSize=${pageSize}, type=${type || 'all'}`)

      // Initialize services
      const db = new DatabaseService(c.env.DB)

      // Get assets from database
      let assetsResult
      if (type) {
        assetsResult = await db.getAssetsByType(type, page, pageSize)
      } else {
        assetsResult = await db.getAssets(page, pageSize)
      }

      const response = {
        success: true,
        data: {
          assets: assetsResult.assets,
          pagination: {
            page: assetsResult.page,
            pageSize: assetsResult.pageSize,
            total: assetsResult.total,
            totalPages: assetsResult.totalPages,
          },
          filter: type ? { type } : {},
        },
        timestamp: new Date().toISOString(),
        requestId,
      }

      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset listing failed:`, error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }
  })

  /**
   * GET /api/assets/:assetId
   * Get detailed information about a specific asset
   */
  assetRoutes.get('/:assetId', async (c) => {
    const requestId = crypto.randomUUID()

    try {
      const assetId = c.req.param('assetId')

      if (!assetId) {
        return c.json({
          success: false,
          error: 'Asset ID is required',
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      console.log(`[${requestId}] Getting asset details for ${assetId}`)

      // Initialize services
      const db = new DatabaseService(c.env.DB)

      // Get asset from database
      const asset = await db.getAsset(assetId)

      if (!asset) {
        console.warn(`[${requestId}] Asset ${assetId} not found`)
        return c.json({
          success: false,
          error: 'Asset not found',
          timestamp: new Date().toISOString(),
          requestId,
        }, 404)
      }

      const response = {
        success: true,
        data: {
          asset,
        },
        timestamp: new Date().toISOString(),
        requestId,
      }

      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset retrieval failed:`, error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }
  })

  /**
   * DELETE /api/assets/:assetId
   * Delete an asset and its associated storage
   */
  assetRoutes.delete('/:assetId', async (c) => {
    const requestId = crypto.randomUUID()

    try {
      const assetId = c.req.param('assetId')

      if (!assetId) {
        return c.json({
          success: false,
          error: 'Asset ID is required',
          timestamp: new Date().toISOString(),
          requestId,
        }, 400)
      }

      console.log(`[${requestId}] Deleting asset ${assetId}`)

      // Initialize services
      const db = new DatabaseService(c.env.DB)
      const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)

      // Get asset from database first
      const asset = await db.getAsset(assetId)

      if (!asset) {
        console.warn(`[${requestId}] Asset ${assetId} not found for deletion`)
        return c.json({
          success: false,
          error: 'Asset not found',
          timestamp: new Date().toISOString(),
          requestId,
        }, 404)
      }

      // Delete from storage first
      const storageDeleteResult = await storage.deleteAsset(asset.r2Key)

      if (!storageDeleteResult.success) {
        console.error(`[${requestId}] Failed to delete asset from storage:`, storageDeleteResult.error)
        return c.json({
          success: false,
          error: storageDeleteResult.error,
          timestamp: new Date().toISOString(),
          requestId,
        }, 500)
      }

      // Delete from database
      await db.deleteAsset(assetId)

      const response = {
        success: true,
        data: {
          deleted: {
            assetId,
            filename: asset.filename,
            r2Key: asset.r2Key,
            deletedAt: new Date().toISOString(),
          },
        },
        timestamp: new Date().toISOString(),
        requestId,
      }

      console.log(`[${requestId}] Asset ${assetId} deleted successfully`)
      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset deletion failed:`, error)
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date().toISOString(),
        requestId,
      }, 500)
    }
  })

  /**
   * GET /api/assets/health
   * Get asset storage health and statistics
   */
  assetRoutes.get('/health', async (c) => {
    const requestId = crypto.randomUUID()

    try {
      console.log(`[${requestId}] Getting asset storage health status`)

      // Initialize services
      const storage = new StorageService(c.env.R2_OUTPUTS, c.env.R2_PROMPTS)

      // Get storage statistics
      const storageStats = await storage.listAssets()

      const response = {
        success: true,
        data: {
          status: 'healthy',
          storage: storageStats.success ? storageStats.data : {
            totalAssets: 0,
            totalSize: 0,
            assetTypes: { video: 0, image: 0, audio: 0 },
          },
          limits: {
            video: `${FILE_SIZE_LIMITS.video / 1024 / 1024}MB`,
            image: `${FILE_SIZE_LIMITS.image / 1024 / 1024}MB`,
            audio: `${FILE_SIZE_LIMITS.audio / 1024 / 1024}MB`,
          },
          supportedTypes: SUPPORTED_FILE_TYPES,
          capabilities: {
            upload: true,
            download: true,
            delete: true,
            metadata: true,
          },
          version: '1.0.0',
        },
        timestamp: new Date().toISOString(),
        requestId,
      }

      return c.json(response, 200)

    } catch (error) {
      console.error(`[${requestId}] Asset health check failed:`, error)
      return c.json({
        success: false,
        error: 'Asset health check failed',
        timestamp: new Date().toISOString(),
        requestId,
      }, 503)
    }
  })

  return assetRoutes
}