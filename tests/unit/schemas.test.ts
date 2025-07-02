import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ImageGenerationParamsSchema } from '../../src/services/openai'
import { ReplicateModelSchema } from '../../src/services/replicate'

describe('Input Validation Schemas', () => {
  describe('ImageGenerationParamsSchema', () => {
    it('should accept valid parameters with defaults', () => {
      const result = ImageGenerationParamsSchema.parse({})
      
      expect(result).toEqual({
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        n: 1
      })
    })

    it('should accept all valid DALL-E 3 parameters', () => {
      const params = {
        model: 'dall-e-3' as const,
        size: '1792x1024' as const,
        quality: 'hd' as const,
        style: 'vivid' as const,
        n: 1
      }
      
      const result = ImageGenerationParamsSchema.parse(params)
      expect(result).toEqual(params)
    })

    it('should accept DALL-E 2 parameters', () => {
      const params = {
        model: 'dall-e-2' as const,
        size: '512x512' as const,
        n: 5
      }
      
      const result = ImageGenerationParamsSchema.parse(params)
      expect(result).toMatchObject(params)
    })

    it('should reject invalid model', () => {
      expect(() => 
        ImageGenerationParamsSchema.parse({ model: 'dall-e-4' })
      ).toThrow(z.ZodError)
    })

    it('should reject invalid size', () => {
      expect(() => 
        ImageGenerationParamsSchema.parse({ size: '2048x2048' })
      ).toThrow(z.ZodError)
    })

    it('should reject invalid quality', () => {
      expect(() => 
        ImageGenerationParamsSchema.parse({ quality: 'ultra' })
      ).toThrow(z.ZodError)
    })

    it('should reject n outside range', () => {
      expect(() => 
        ImageGenerationParamsSchema.parse({ n: 0 })
      ).toThrow(z.ZodError)
      
      expect(() => 
        ImageGenerationParamsSchema.parse({ n: 11 })
      ).toThrow(z.ZodError)
    })

    it('should reject non-integer n', () => {
      expect(() => 
        ImageGenerationParamsSchema.parse({ n: 1.5 })
      ).toThrow(z.ZodError)
    })
  })

  describe('ReplicateModelSchema', () => {
    const validModels = [
      'stability-ai/sdxl',
      'stability-ai/stable-diffusion',
      'lucataco/flux-dev',
      'black-forest-labs/flux-schnell',
      'minimax/video-01',
      'lightricks/ltx-video'
    ]

    it.each(validModels)('should accept valid model: %s', (model) => {
      const result = ReplicateModelSchema.parse(model)
      expect(result).toBe(model)
    })

    it('should reject invalid models', () => {
      expect(() => 
        ReplicateModelSchema.parse('invalid/model')
      ).toThrow(z.ZodError)
      
      expect(() => 
        ReplicateModelSchema.parse('stability-ai/sdxl-turbo')
      ).toThrow(z.ZodError)
    })

    it('should reject non-string input', () => {
      expect(() => 
        ReplicateModelSchema.parse(123)
      ).toThrow(z.ZodError)
      
      expect(() => 
        ReplicateModelSchema.parse({ model: 'stability-ai/sdxl' })
      ).toThrow(z.ZodError)
    })
  })

  describe('Image Request Schema', () => {
    // Since we can't import from handlers, let's define it here for testing
    const ImageRequestSchema = z.object({
      prompt: z.string().min(1).max(1000),
      enhance: z.boolean().default(false),
      provider: z.enum(['openai', 'replicate']).default('openai'),
      model: z.string().optional(),
      parameters: z.record(z.any()).optional()
    })

    it('should accept minimal valid request', () => {
      const result = ImageRequestSchema.parse({
        prompt: 'A beautiful sunset'
      })
      
      expect(result).toEqual({
        prompt: 'A beautiful sunset',
        enhance: false,
        provider: 'openai'
      })
    })

    it('should accept full request with all parameters', () => {
      const request = {
        prompt: 'A detailed landscape',
        enhance: true,
        provider: 'replicate' as const,
        model: 'stability-ai/sdxl',
        parameters: {
          width: 1024,
          height: 1024,
          num_inference_steps: 25
        }
      }
      
      const result = ImageRequestSchema.parse(request)
      expect(result).toEqual(request)
    })

    it('should reject empty prompt', () => {
      expect(() => 
        ImageRequestSchema.parse({ prompt: '' })
      ).toThrow(z.ZodError)
    })

    it('should reject prompt over 1000 characters', () => {
      const longPrompt = 'a'.repeat(1001)
      expect(() => 
        ImageRequestSchema.parse({ prompt: longPrompt })
      ).toThrow(z.ZodError)
    })

    it('should reject invalid provider', () => {
      expect(() => 
        ImageRequestSchema.parse({ 
          prompt: 'test',
          provider: 'midjourney'
        })
      ).toThrow(z.ZodError)
    })

    it('should handle various parameter types', () => {
      const result = ImageRequestSchema.parse({
        prompt: 'test',
        parameters: {
          string: 'value',
          number: 123,
          boolean: true,
          array: [1, 2, 3],
          nested: { key: 'value' }
        }
      })
      
      expect(result.parameters).toEqual({
        string: 'value',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: { key: 'value' }
      })
    })
  })

  describe('Type safety', () => {
    it('should infer correct types from schemas', () => {
      type ImageParams = z.infer<typeof ImageGenerationParamsSchema>
      type ReplicateModel = z.infer<typeof ReplicateModelSchema>
      
      // These should compile without errors
      const params: ImageParams = {
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        n: 1
      }
      
      const model: ReplicateModel = 'stability-ai/sdxl'
      
      expect(params.model).toBe('dall-e-3')
      expect(model).toBe('stability-ai/sdxl')
    })
  })
})