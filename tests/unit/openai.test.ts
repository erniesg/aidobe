import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { OpenAIService, ImageGenerationParamsSchema } from '../../src/services/openai'
import { z } from 'zod'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('OpenAI Service', () => {
  let openaiService: OpenAIService

  beforeEach(() => {
    openaiService = new OpenAIService('test-api-key')
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('generateImage', () => {
    describe('Input validation', () => {
      it('should validate parameters before API call', async () => {
        const invalidParams = { model: 'invalid-model' }
        
        expect(() => 
          ImageGenerationParamsSchema.parse(invalidParams)
        ).toThrow(z.ZodError)
      })

      it('should handle empty prompt', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [] })
        })

        const result = await openaiService.generateImage('', {
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'high',
          n: 1
        })

        expect(result).toEqual([])
      })

      it('should handle very long prompts', async () => {
        const longPrompt = 'a'.repeat(4000) // OpenAI has a 4000 char limit
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            data: [{ url: 'https://example.com/image.png' }]
          })
        })

        const result = await openaiService.generateImage(longPrompt, {
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'high',
          n: 1
        })

        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        expect(body.prompt).toBe(longPrompt)
        expect(result).toHaveLength(1)
      })
    })

    describe('Output validation', () => {
      it('should return correct data structure for single image', async () => {
        const mockUrl = 'https://example.com/image1.png'
        const mockRevisedPrompt = 'enhanced prompt'
        
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            data: [
              { url: mockUrl, revised_prompt: mockRevisedPrompt }
            ]
          })
        })

        const result = await openaiService.generateImage('test prompt', {
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'high',
          n: 1
        })

        expect(result).toHaveLength(1)
        expect(result[0]).toEqual({
          url: mockUrl,
          revised_prompt: mockRevisedPrompt
        })
      })

      it('should handle multiple images', async () => {
        const mockData = Array.from({ length: 5 }, (_, i) => ({
          url: `https://example.com/image${i}.png`,
          revised_prompt: `enhanced prompt ${i}`
        }))

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: mockData })
        })

        const result = await openaiService.generateImage('test prompt', {
          model: 'dall-e-2',
          size: '1024x1024',
          quality: 'high',
          n: 5
        })

        expect(result).toHaveLength(5)
        result.forEach((item: any, index: number) => {
          expect(item.url).toBe(`https://example.com/image${index}.png`)
          expect(item.revised_prompt).toBe(`enhanced prompt ${index}`)
        })
      })

      it('should handle missing revised_prompt', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            data: [{ url: 'https://example.com/image.png' }]
          })
        })

        const result = await openaiService.generateImage('test', {
          model: 'dall-e-2',
          size: '1024x1024',
          quality: 'high',
          n: 1
        })

        expect(result[0]).toEqual({
          url: 'https://example.com/image.png',
          revised_prompt: undefined
        })
      })
    })

    describe('API interaction', () => {
      it('should send correct headers and body', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ data: [] })
        })

        const params = {
          model: 'dall-e-3' as const,
          size: '1536x1024' as const,
          quality: 'high' as const,
          style: 'natural' as const,
          n: 1
        }

        await openaiService.generateImage('test prompt', params)

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/images/generations',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Authorization': 'Bearer test-api-key',
              'Content-Type': 'application/json'
            }
          })
        )
        
        // Check the body content more flexibly
        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        expect(body).toMatchObject({
          prompt: 'test prompt',
          ...params
        })
      })

      it('should handle rate limit errors', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 429,
          text: () => Promise.resolve('Rate limit exceeded')
        })

        await expect(
          openaiService.generateImage('test', {
            model: 'dall-e-3',
            size: '1024x1024',
            quality: 'high',
            n: 1
          })
        ).rejects.toThrow('OpenAI API error: Rate limit exceeded')
      })

      it('should handle malformed API response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ invalid: 'response' })
        })

        const result = await openaiService.generateImage('test', {
          model: 'dall-e-3',
          size: '1024x1024',
          quality: 'high',
          n: 1
        })

        expect(result).toEqual([])
      })
    })
  })

  describe('enhancePrompt', () => {
    describe('Input handling', () => {
      it('should handle prompts with special characters', async () => {
        const specialPrompt = 'Test with "quotes" & symbols! @#$%'
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Enhanced prompt' } }]
          })
        })

        await openaiService.enhancePrompt(specialPrompt)

        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        expect(body.messages[1].content).toBe(specialPrompt)
      })

      it('should include context when provided', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Enhanced prompt' } }]
          })
        })

        await openaiService.enhancePrompt('sunset', 'photorealistic style')

        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        expect(body.messages[0].content).toContain('photorealistic style')
      })
    })

    describe('Output validation', () => {
      it('should return enhanced prompt string', async () => {
        const enhancedText = 'A vibrant sunset with golden hues'
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: enhancedText } }]
          })
        })

        const result = await openaiService.enhancePrompt('sunset')
        
        expect(result).toBe(enhancedText)
        expect(typeof result).toBe('string')
      })

      it('should handle empty response', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: '' } }]
          })
        })

        const result = await openaiService.enhancePrompt('test')
        expect(result).toBe('')
      })

      it('should handle missing choices', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ choices: [] })
        })

        await expect(
          openaiService.enhancePrompt('test')
        ).rejects.toThrow()
      })
    })

    describe('API parameters', () => {
      it('should use correct model and settings', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Enhanced' } }]
          })
        })

        await openaiService.enhancePrompt('test')

        const [, options] = mockFetch.mock.calls[0]
        const body = JSON.parse(options.body)
        
        expect(body.model).toBe('gpt-4o')
        expect(body.max_tokens).toBe(150)
        expect(body.temperature).toBe(0.7)
      })
    })
  })

  describe('Error handling', () => {
    it('should provide meaningful error messages', async () => {
      const errorCases = [
        { status: 401, message: 'Invalid API key' },
        { status: 403, message: 'Access forbidden' },
        { status: 500, message: 'Internal server error' }
      ]

      for (const { status, message } of errorCases) {
        mockFetch.mockResolvedValue({
          ok: false,
          status,
          text: () => Promise.resolve(message)
        })

        await expect(
          openaiService.generateImage('test', {
            model: 'dall-e-3',
            size: '1024x1024',
            quality: 'high',
            n: 1
          })
        ).rejects.toThrow(`OpenAI API error: ${message}`)
      }
    })
  })
})