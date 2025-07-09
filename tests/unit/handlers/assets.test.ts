import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import type { Env } from '../../../src/types/env'

// Mock environment
const mockEnv: Env = {
  ARGIL_API_KEY: 'test-argil-key',
  ARGIL_WEBHOOK_SECRET: 'test-webhook-secret',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  ACCESS_PASSWORD: 'test-password',
  ENVIRONMENT: 'test',
  MODAL_API_URL: 'https://modal-api.example.com',
  MODAL_API_TOKEN: 'test-modal-token',
  MODAL_WEBHOOK_SECRET: 'test-modal-webhook-secret',
  CLOUDFLARE_WORKER_URL: 'https://worker.example.com',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any,
}

// Mock services
const mockStorageInstance = {
  uploadAsset: vi.fn(),
  getDownloadUrl: vi.fn(),
  deleteAsset: vi.fn(),
  getAssetMetadata: vi.fn(),
  listAssets: vi.fn(),
  uploadImage: vi.fn(),
  uploadVideo: vi.fn(),
  savePromptData: vi.fn(),
  getPromptData: vi.fn(),
  listOutputs: vi.fn(),
  deleteOutput: vi.fn(),
}

const mockDatabaseInstance = {
  createAsset: vi.fn(),
  getAsset: vi.fn(),
  updateAsset: vi.fn(),
  deleteAsset: vi.fn(),
  getAssets: vi.fn(),
  getAssetsByType: vi.fn(),
  createPrompt: vi.fn(),
  updatePromptStatus: vi.fn(),
  updatePromptMetadata: vi.fn(),
  createOutput: vi.fn(),
  getPrompts: vi.fn(),
  getPromptById: vi.fn(),
  logAnalytics: vi.fn(),
  getAnalytics: vi.fn(),
  createVideoJob: vi.fn(),
  getVideoJob: vi.fn(),
  updateVideoJob: vi.fn(),
  getVideoJobs: vi.fn(),
  deleteVideoJob: vi.fn(),
}

vi.mock('../../../src/services/storage', () => ({
  StorageService: vi.fn().mockImplementation(() => mockStorageInstance),
}))

vi.mock('../../../src/services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => mockDatabaseInstance),
}))

// Import the routes after mocking
import { createAssetPipelineRoutes } from '../../../src/handlers/asset-pipeline'

describe('Asset Pipeline Handlers', () => {
  let app: Hono
  let assetRoutes: any

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    
    // Set up default successful mocking
    mockStorageInstance.uploadAsset.mockResolvedValue({
      success: true,
      data: {
        url: 'https://storage.example.com/assets/test-asset-123.mp4',
        uploadedAt: new Date().toISOString(),
      },
    })
    
    mockStorageInstance.getDownloadUrl.mockResolvedValue({
      success: true,
      data: {
        downloadUrl: 'https://storage.example.com/download/test-asset-123.mp4?token=abc123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    
    mockStorageInstance.deleteAsset.mockResolvedValue({
      success: true,
    })
    
    mockStorageInstance.listAssets.mockResolvedValue({
      success: true,
      data: {
        totalAssets: 150,
        totalSize: 2147483648,
        assetTypes: {
          video: 75,
          image: 65,
          audio: 10,
        },
      },
    })
    
    mockDatabaseInstance.createAsset.mockResolvedValue({
      id: 'test-asset-123',
      filename: 'sample-video.mp4',
      contentType: 'video/mp4',
      size: 15728640,
      r2Key: 'assets/test-asset-123.mp4',
      url: 'https://storage.example.com/assets/test-asset-123.mp4',
      assetType: 'video',
      uploadedAt: new Date().toISOString(),
      metadata: {
        duration: 120,
        resolution: '1080p',
        frameRate: 30,
      },
    })
    
    mockDatabaseInstance.getAsset.mockResolvedValue({
      id: 'test-asset-123',
      filename: 'sample-video.mp4',
      contentType: 'video/mp4',
      size: 15728640,
      r2Key: 'assets/test-asset-123.mp4',
      url: 'https://storage.example.com/assets/test-asset-123.mp4',
      assetType: 'video',
      uploadedAt: new Date().toISOString(),
      metadata: {
        duration: 120,
        resolution: '1080p',
        frameRate: 30,
      },
    })
    
    mockDatabaseInstance.getAssets.mockResolvedValue({
      assets: [
        {
          id: 'asset-1',
          filename: 'video1.mp4',
          assetType: 'video',
          uploadedAt: new Date().toISOString(),
        },
        {
          id: 'asset-2',
          filename: 'image1.jpg',
          assetType: 'image',
          uploadedAt: new Date().toISOString(),
        },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })
    
    mockDatabaseInstance.getAssetsByType.mockResolvedValue({
      assets: [
        {
          id: 'video-1',
          filename: 'video1.mp4',
          assetType: 'video',
          uploadedAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    })
    
    mockDatabaseInstance.deleteAsset.mockResolvedValue(undefined)
    
    // Create fresh app instance
    app = new Hono()
    
    // Create routes
    assetRoutes = createAssetPipelineRoutes()
    app.route('/api/assets', assetRoutes)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/assets/upload', () => {
    it('should upload a video asset successfully', async () => {
      const assetData = {
        filename: 'sample-video.mp4',
        contentType: 'video/mp4',
        assetType: 'video',
        metadata: {
          duration: 120,
          resolution: '1080p',
          frameRate: 30,
        },
      }

      // Mock file data as ArrayBuffer
      const mockFileBuffer = new ArrayBuffer(1024)
      
      const response = await app.request('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetData,
          fileData: Array.from(new Uint8Array(mockFileBuffer)),
        }),
      }, mockEnv)

      expect(response.status).toBe(201)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.asset.id).toBe('test-asset-123')
      expect(body.data.asset.filename).toBe('sample-video.mp4')
      expect(body.data.asset.assetType).toBe('video')
      expect(body.data.upload.url).toBe('https://storage.example.com/assets/test-asset-123.mp4')
      expect(mockStorageInstance.uploadAsset).toHaveBeenCalled()
      expect(mockDatabaseInstance.createAsset).toHaveBeenCalled()
    })

    it('should upload an image asset successfully', async () => {
      const assetData = {
        filename: 'sample-image.jpg',
        contentType: 'image/jpeg',
        assetType: 'image',
        metadata: {
          width: 1920,
          height: 1080,
          format: 'JPEG',
        },
      }

      mockDatabaseInstance.createAsset.mockResolvedValueOnce({
        id: 'test-image-456',
        filename: 'sample-image.jpg',
        contentType: 'image/jpeg',
        size: 2048000,
        r2Key: 'assets/test-image-456.jpg',
        url: 'https://storage.example.com/assets/test-image-456.jpg',
        assetType: 'image',
        uploadedAt: new Date().toISOString(),
        metadata: assetData.metadata,
      })

      const mockFileBuffer = new ArrayBuffer(1024)
      
      const response = await app.request('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetData,
          fileData: Array.from(new Uint8Array(mockFileBuffer)),
        }),
      }, mockEnv)

      expect(response.status).toBe(201)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.asset.assetType).toBe('image')
      expect(body.data.asset.filename).toBe('sample-image.jpg')
    })

    it('should validate file size limits', async () => {
      const assetData = {
        filename: 'large-video.mp4',
        contentType: 'video/mp4',
        assetType: 'video',
      }

      // Mock a file that's too large (> 500MB)
      const mockLargeBuffer = new ArrayBuffer(600 * 1024 * 1024) // 600MB
      
      const response = await app.request('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetData,
          fileData: Array.from(new Uint8Array(mockLargeBuffer)),
        }),
      }, mockEnv)

      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('File size exceeds maximum limit')
    })

    it('should validate supported file types', async () => {
      const assetData = {
        filename: 'unsupported.txt',
        contentType: 'text/plain',
        assetType: 'document',
      }

      const mockFileBuffer = new ArrayBuffer(1024)
      
      const response = await app.request('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetData,
          fileData: Array.from(new Uint8Array(mockFileBuffer)),
        }),
      }, mockEnv)

      expect(response.status).toBe(400)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Unsupported file type')
    })

    it('should handle storage upload failures', async () => {
      mockStorageInstance.uploadAsset.mockResolvedValueOnce({
        success: false,
        error: 'Storage service unavailable',
      })

      const assetData = {
        filename: 'sample-video.mp4',
        contentType: 'video/mp4',
        assetType: 'video',
      }

      const mockFileBuffer = new ArrayBuffer(1024)
      
      const response = await app.request('/api/assets/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...assetData,
          fileData: Array.from(new Uint8Array(mockFileBuffer)),
        }),
      }, mockEnv)

      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Storage service unavailable')
    })
  })

  describe('GET /api/assets/:assetId/download', () => {
    it('should generate download URL for existing asset', async () => {
      mockDatabaseInstance.getAsset.mockResolvedValue({
        id: 'test-asset-123',
        filename: 'sample-video.mp4',
        contentType: 'video/mp4',
        size: 15728640,
        r2Key: 'assets/test-asset-123.mp4',
        url: 'https://storage.example.com/assets/test-asset-123.mp4',
        assetType: 'video',
        uploadedAt: new Date().toISOString(),
      })

      const response = await app.request('/api/assets/test-asset-123/download', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.downloadUrl).toBe('https://storage.example.com/download/test-asset-123.mp4?token=abc123')
      expect(body.data.expiresAt).toBeDefined()
      expect(body.data.asset.filename).toBe('sample-video.mp4')
      expect(mockDatabaseInstance.getAsset).toHaveBeenCalledWith('test-asset-123')
      expect(mockStorageInstance.getDownloadUrl).toHaveBeenCalled()
    })

    it('should handle non-existent asset', async () => {
      mockDatabaseInstance.getAsset.mockResolvedValueOnce(null)

      const response = await app.request('/api/assets/non-existent/download', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Asset not found')
    })

    it('should handle storage download URL generation failures', async () => {
      mockDatabaseInstance.getAsset.mockResolvedValueOnce({
        id: 'test-asset-123',
        r2Key: 'assets/test-asset-123.mp4',
      })

      mockStorageInstance.getDownloadUrl.mockResolvedValueOnce({
        success: false,
        error: 'Failed to generate download URL',
      })

      const response = await app.request('/api/assets/test-asset-123/download', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Failed to generate download URL')
    })
  })

  describe('GET /api/assets', () => {
    it('should list assets with pagination', async () => {
      const mockAssets = [
        {
          id: 'asset-1',
          filename: 'video1.mp4',
          assetType: 'video',
          uploadedAt: new Date().toISOString(),
        },
        {
          id: 'asset-2',
          filename: 'image1.jpg',
          assetType: 'image',
          uploadedAt: new Date().toISOString(),
        },
      ]

      mockDatabaseInstance.getAssets.mockResolvedValue({
        assets: mockAssets,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })

      const response = await app.request('/api/assets?page=1&pageSize=20', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.assets).toHaveLength(2)
      expect(body.data.pagination.total).toBe(2)
      expect(body.data.pagination.page).toBe(1)
      expect(mockDatabaseInstance.getAssets).toHaveBeenCalledWith(1, 20)
    })

    it('should filter assets by type', async () => {
      const mockVideoAssets = [
        {
          id: 'video-1',
          filename: 'video1.mp4',
          assetType: 'video',
          uploadedAt: new Date().toISOString(),
        },
      ]

      mockDatabaseInstance.getAssetsByType.mockResolvedValue({
        assets: mockVideoAssets,
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })

      const response = await app.request('/api/assets?type=video', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.assets).toHaveLength(1)
      expect(body.data.assets[0].assetType).toBe('video')
      expect(mockDatabaseInstance.getAssetsByType).toHaveBeenCalledWith('video', 1, 20)
    })
  })

  describe('GET /api/assets/:assetId', () => {
    it('should get asset details', async () => {
      const mockAsset = {
        id: 'test-asset-123',
        filename: 'sample-video.mp4',
        contentType: 'video/mp4',
        size: 15728640,
        r2Key: 'assets/test-asset-123.mp4',
        url: 'https://storage.example.com/assets/test-asset-123.mp4',
        assetType: 'video',
        uploadedAt: new Date().toISOString(),
        metadata: {
          duration: 120,
          resolution: '1080p',
          frameRate: 30,
        },
      }

      mockDatabaseInstance.getAsset.mockResolvedValue(mockAsset)

      const response = await app.request('/api/assets/test-asset-123', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.asset.id).toBe('test-asset-123')
      expect(body.data.asset.filename).toBe('sample-video.mp4')
      expect(body.data.asset.metadata.duration).toBe(120)
    })

    it('should handle non-existent asset', async () => {
      mockDatabaseInstance.getAsset.mockResolvedValueOnce(null)

      const response = await app.request('/api/assets/non-existent', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Asset not found')
    })
  })

  describe('DELETE /api/assets/:assetId', () => {
    it('should delete asset successfully', async () => {
      const mockAsset = {
        id: 'test-asset-123',
        r2Key: 'assets/test-asset-123.mp4',
        filename: 'sample-video.mp4',
      }

      mockDatabaseInstance.getAsset.mockResolvedValue(mockAsset)
      mockStorageInstance.deleteAsset.mockResolvedValue({ success: true })
      mockDatabaseInstance.deleteAsset.mockResolvedValue(undefined)

      const response = await app.request('/api/assets/test-asset-123', {
        method: 'DELETE',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.deleted.assetId).toBe('test-asset-123')
      expect(mockStorageInstance.deleteAsset).toHaveBeenCalledWith('assets/test-asset-123.mp4')
      expect(mockDatabaseInstance.deleteAsset).toHaveBeenCalledWith('test-asset-123')
    })

    it('should handle non-existent asset deletion', async () => {
      mockDatabaseInstance.getAsset.mockResolvedValueOnce(null)

      const response = await app.request('/api/assets/non-existent', {
        method: 'DELETE',
      }, mockEnv)

      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Asset not found')
    })

    it('should handle storage deletion failures', async () => {
      const mockAsset = {
        id: 'test-asset-123',
        r2Key: 'assets/test-asset-123.mp4',
      }

      mockDatabaseInstance.getAsset.mockResolvedValueOnce(mockAsset)
      mockStorageInstance.deleteAsset.mockResolvedValueOnce({
        success: false,
        error: 'Storage deletion failed',
      })

      const response = await app.request('/api/assets/test-asset-123', {
        method: 'DELETE',
      }, mockEnv)

      expect(response.status).toBe(500)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Storage deletion failed')
    })
  })

  describe('Asset Health and Statistics', () => {
    it('should return asset storage health status', async () => {
      mockStorageInstance.listAssets.mockResolvedValue({
        success: true,
        data: {
          totalAssets: 150,
          totalSize: 2147483648, // 2GB
          assetTypes: {
            video: 75,
            image: 65,
            audio: 10,
          },
        },
      })

      const response = await app.request('/api/assets/health', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.status).toBe('healthy')
      expect(body.data.storage.totalAssets).toBe(150)
      expect(body.data.storage.totalSize).toBe(2147483648)
      expect(body.data.storage.assetTypes.video).toBe(75)
    })
  })
})