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
const mockStorage = {
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

const mockDatabase = {
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
  StorageService: vi.fn().mockImplementation(() => mockStorage),
}))

vi.mock('../../../src/services/database', () => ({
  DatabaseService: vi.fn().mockImplementation(() => mockDatabase),
}))

describe('Asset Pipeline Handlers', () => {
  let app: Hono
  let assetRoutes: any

  beforeEach(async () => {
    app = new Hono()
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Set up default successful mocking
    mockStorage.uploadAsset.mockResolvedValue({
      success: true,
      data: {
        key: 'assets/test-asset-123.mp4',
        url: 'https://storage.example.com/assets/test-asset-123.mp4',
        size: 15728640,
        contentType: 'video/mp4',
        uploadedAt: new Date().toISOString(),
      },
    })
    
    mockStorage.getDownloadUrl.mockResolvedValue({
      success: true,
      data: {
        downloadUrl: 'https://storage.example.com/download/test-asset-123.mp4?token=abc123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    
    mockDatabase.createAsset.mockResolvedValue({
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
    
    // Import the routes after mocking
    const { createAssetPipelineRoutes } = await import('../../../src/handlers/asset-pipeline')
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
      expect(mockStorage.uploadAsset).toHaveBeenCalled()
      expect(mockDatabase.createAsset).toHaveBeenCalled()
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

      mockDatabase.createAsset.mockResolvedValue({
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
      mockStorage.uploadAsset.mockResolvedValue({
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
      mockDatabase.getAsset.mockResolvedValue({
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
      expect(mockDatabase.getAsset).toHaveBeenCalledWith('test-asset-123')
      expect(mockStorage.getDownloadUrl).toHaveBeenCalled()
    })

    it('should handle non-existent asset', async () => {
      mockDatabase.getAsset.mockResolvedValue(null)

      const response = await app.request('/api/assets/non-existent/download', {
        method: 'GET',
      }, mockEnv)

      expect(response.status).toBe(404)
      
      const body = await response.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Asset not found')
    })

    it('should handle storage download URL generation failures', async () => {
      mockDatabase.getAsset.mockResolvedValue({
        id: 'test-asset-123',
        r2Key: 'assets/test-asset-123.mp4',
      })

      mockStorage.getDownloadUrl.mockResolvedValue({
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

      mockDatabase.getAssets.mockResolvedValue({
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
      expect(mockDatabase.getAssets).toHaveBeenCalledWith(1, 20)
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

      mockDatabase.getAssetsByType.mockResolvedValue({
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
      expect(mockDatabase.getAssetsByType).toHaveBeenCalledWith('video', 1, 20)
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

      mockDatabase.getAsset.mockResolvedValue(mockAsset)

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
      mockDatabase.getAsset.mockResolvedValue(null)

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

      mockDatabase.getAsset.mockResolvedValue(mockAsset)
      mockStorage.deleteAsset.mockResolvedValue({ success: true })
      mockDatabase.deleteAsset.mockResolvedValue(undefined)

      const response = await app.request('/api/assets/test-asset-123', {
        method: 'DELETE',
      }, mockEnv)

      expect(response.status).toBe(200)
      
      const body = await response.json()
      expect(body.success).toBe(true)
      expect(body.data.deleted.assetId).toBe('test-asset-123')
      expect(mockStorage.deleteAsset).toHaveBeenCalledWith('assets/test-asset-123.mp4')
      expect(mockDatabase.deleteAsset).toHaveBeenCalledWith('test-asset-123')
    })

    it('should handle non-existent asset deletion', async () => {
      mockDatabase.getAsset.mockResolvedValue(null)

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

      mockDatabase.getAsset.mockResolvedValue(mockAsset)
      mockStorage.deleteAsset.mockResolvedValue({
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
      mockStorage.listAssets.mockResolvedValue({
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