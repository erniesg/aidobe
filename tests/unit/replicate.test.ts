import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReplicateService, ReplicateModelSchema } from '../../src/services/replicate'
import { z } from 'zod'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Replicate Service', () => {
  let replicateService: ReplicateService
  const testToken = 'test-replicate-token'

  beforeEach(() => {
    replicateService = new ReplicateService(testToken)
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Model validation', () => {
    it('should validate supported models', () => {
      const validModels = [
        'stability-ai/sdxl',
        'stability-ai/stable-diffusion',
        'lucataco/flux-dev',
        'black-forest-labs/flux-schnell',
        'minimax/video-01',
        'lightricks/ltx-video'
      ]

      validModels.forEach(model => {
        expect(() => ReplicateModelSchema.parse(model)).not.toThrow()
      })
    })

    it('should reject invalid models', () => {
      const invalidModels = [
        'invalid/model',
        'stability-ai/invalid',
        '',
        123,
        null,
        undefined
      ]

      invalidModels.forEach(model => {
        expect(() => ReplicateModelSchema.parse(model)).toThrow(z.ZodError)
      })
    })
  })

  describe('createPrediction', () => {
    describe('Input handling', () => {
      it('should accept valid image generation parameters', async () => {
        const mockResponse = {
          id: 'test-prediction-id',
          status: 'starting'
        }
        
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse)
        })

        const input = {
          prompt: 'A beautiful landscape',
          width: 1024,
          height: 1024,
          num_inference_steps: 25
        }

        const result = await replicateService.createPrediction('stability-ai/sdxl', input)

        expect(result).toEqual(mockResponse)
        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.replicate.com/v1/predictions',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Authorization': `Token ${testToken}`,
              'Content-Type': 'application/json'
            }
          })
        )
      })

      it('should handle video generation parameters', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ id: 'video-id', status: 'starting' })
        })

        const input = {
          prompt: 'A serene ocean scene',
          frame_rate: 25,
          num_frames: 121
        }

        await replicateService.createPrediction('minimax/video-01', input)

        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        
        expect(body.input).toEqual(input)
        expect(body.version).toBeTruthy()
      })

      it('should include user input in prediction', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ id: 'test-id', status: 'starting' })
        })

        const userInput = { prompt: 'test', custom_param: 'value' }
        
        await replicateService.createPrediction('lucataco/flux-dev', userInput)

        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        
        // User input should be included
        expect(body.input.prompt).toBe('test')
        expect(body.input.custom_param).toBe('value')
      })
    })

    describe('Output validation', () => {
      it('should return prediction object with required fields', async () => {
        const mockPrediction = {
          id: 'pred-123',
          status: 'processing',
          created_at: '2024-01-01T00:00:00Z',
          urls: {
            get: 'https://api.replicate.com/v1/predictions/pred-123',
            cancel: 'https://api.replicate.com/v1/predictions/pred-123/cancel'
          }
        }

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockPrediction)
        })

        const result = await replicateService.createPrediction('stability-ai/sdxl', { prompt: 'test' })

        expect(result.id).toBe('pred-123')
        expect(result.status).toBe('processing')
        expect(typeof result.id).toBe('string')
        expect(typeof result.status).toBe('string')
      })
    })

    describe('Error handling', () => {
      it('should handle API errors', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          text: () => Promise.resolve('Invalid API token')
        })

        await expect(
          replicateService.createPrediction('stability-ai/sdxl', { prompt: 'test' })
        ).rejects.toThrow('Replicate API error: Invalid API token')
      })

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        await expect(
          replicateService.createPrediction('stability-ai/sdxl', { prompt: 'test' })
        ).rejects.toThrow('Network error')
      })
    })
  })

  describe('waitForCompletion', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should poll until completion', async () => {
      const predictionId = 'test-id'
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: predictionId, status: 'starting' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: predictionId, status: 'processing' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ 
            id: predictionId, 
            status: 'succeeded',
            output: ['https://example.com/output.png']
          })
        })

      const promise = replicateService.waitForCompletion(predictionId)
      
      // Fast-forward through polling intervals
      await vi.advanceTimersByTimeAsync(2500)
      
      const result = await promise
      
      expect(result.status).toBe('succeeded')
      expect(result.output).toEqual(['https://example.com/output.png'])
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle failed predictions', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          status: 'failed',
          error: 'Model error'
        })
      })

      const result = await replicateService.waitForCompletion('test-id')
      
      expect(result.status).toBe('failed')
      expect(result.error).toBe('Model error')
    })

    it('should timeout after maxWaitMs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          status: 'processing'
        })
      })

      const promise = replicateService.waitForCompletion('test-id', 5000)
      
      await vi.advanceTimersByTimeAsync(6000)
      
      await expect(promise).rejects.toThrow('Prediction timeout')
    })
  })

  describe('getModelConfig', () => {
    it('should return correct config for each model', () => {
      const models = [
        'stability-ai/sdxl',
        'lucataco/flux-dev',
        'minimax/video-01',
        'lightricks/ltx-video'
      ] as const

      models.forEach(model => {
        const config = replicateService.getModelConfig(model)
        expect(config).toBeDefined()
        expect(typeof config).toBe('object')
      })
    })

    it('should return empty object for unknown models', () => {
      // @ts-expect-error Testing invalid model
      const config = replicateService.getModelConfig('unknown/model')
      expect(config).toEqual({})
    })

    it('should include model-specific parameters', () => {
      const sdxlConfig = replicateService.getModelConfig('stability-ai/sdxl')
      expect(sdxlConfig).toHaveProperty('width', 1024)
      expect(sdxlConfig).toHaveProperty('height', 1024)
      expect(sdxlConfig).toHaveProperty('num_inference_steps', 25)

      const videoConfig = replicateService.getModelConfig('minimax/video-01')
      expect(videoConfig).toHaveProperty('frame_rate', 25)
      expect(videoConfig).toHaveProperty('prompt_optimizer', true)
    })
  })

  describe('Output type validation', () => {
    it('should handle image outputs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          status: 'succeeded',
          output: ['https://example.com/image1.png', 'https://example.com/image2.png']
        })
      })

      const result = await replicateService.getPrediction('test-id')
      
      expect(Array.isArray(result.output)).toBe(true)
      expect(result.output).toHaveLength(2)
      (result.output as string[])?.forEach((url: string) => {
        expect(typeof url).toBe('string')
        expect(url).toMatch(/^https?:\/\//)
      })
    })

    it('should handle video outputs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          status: 'succeeded',
          output: 'https://example.com/video.mp4'
        })
      })

      const result = await replicateService.getPrediction('test-id')
      
      expect(typeof result.output).toBe('string')
      expect(result.output).toMatch(/\.mp4$/)
    })

    it('should handle null outputs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: 'test-id',
          status: 'processing',
          output: null
        })
      })

      const result = await replicateService.getPrediction('test-id')
      
      expect(result.output).toBeNull()
    })
  })
})