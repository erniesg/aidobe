import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { authMiddleware } from '../../src/middleware/auth'
import type { Context, Next } from 'hono'
import type { Env } from '../../src/types/env'

describe('Auth Middleware', () => {
  let mockNext: Next
  let mockEnv: Partial<Env>
  
  beforeEach(() => {
    mockNext = vi.fn().mockResolvedValue(undefined)
    mockEnv = {
      ACCESS_PASSWORD: 'test-password-123'
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const createMockContext = (authHeader?: string): Partial<Context<{ Bindings: Env }>> => ({
    req: {
      header: vi.fn().mockReturnValue(authHeader)
    } as any,
    env: mockEnv as Env,
    json: vi.fn().mockReturnValue({ json: true })
  })

  describe('Input validation', () => {
    it('should reject requests without authorization header', async () => {
      const mockC = createMockContext()
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Missing or invalid authorization header' }, 
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject empty authorization header', async () => {
      const mockC = createMockContext('')
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Missing or invalid authorization header' }, 
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject authorization header with only Bearer', async () => {
      const mockC = createMockContext('Bearer ')
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Invalid password' }, 
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject non-Bearer authorization schemes', async () => {
      const mockC = createMockContext('Basic dGVzdDp0ZXN0')
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Missing or invalid authorization header' }, 
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle case-insensitive Bearer prefix', async () => {
      const mockC = createMockContext('bearer test-password-123')
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Missing or invalid authorization header' }, 
        401
      )
    })
  })

  describe('Password validation', () => {
    it('should reject incorrect passwords', async () => {
      const mockC = createMockContext('Bearer wrong-password')
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Invalid password' }, 
        401
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should accept correct password', async () => {
      const mockC = createMockContext('Bearer test-password-123')
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockC.json).not.toHaveBeenCalled()
    })

    it('should handle passwords with special characters', async () => {
      const specialPassword = 'p@$$w0rd!#$%^&*()'
      const mockC = createMockContext(`Bearer ${specialPassword}`)
      mockC.env = { ACCESS_PASSWORD: specialPassword } as Env
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockNext).toHaveBeenCalledTimes(1)
      expect(mockC.json).not.toHaveBeenCalled()
    })
  })

  describe('Environment configuration', () => {
    it('should handle missing ACCESS_PASSWORD', async () => {
      const mockC = createMockContext('Bearer test-password-123')
      mockC.env = {} as Env
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Server configuration error' }, 
        500
      )
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle empty ACCESS_PASSWORD', async () => {
      const mockC = createMockContext('Bearer test-password-123')
      mockC.env = { ACCESS_PASSWORD: '' } as Env
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.json).toHaveBeenCalledWith(
        { error: 'Server configuration error' }, 
        500
      )
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('Output types', () => {
    it('should return correct error response structure', async () => {
      const mockC = createMockContext()
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      const [response, status] = (mockC.json as any).mock.calls[0]
      expect(response).toMatchObject({ error: expect.any(String) })
      expect(status).toBe(401)
    })

    it('should not modify context on success', async () => {
      const mockC = createMockContext('Bearer test-password-123')
      const originalContext = { ...mockC }
      
      await authMiddleware(mockC as Context<{ Bindings: Env }>, mockNext)
      
      expect(mockC.req).toBe(originalContext.req)
      expect(mockC.env).toBe(originalContext.env)
    })
  })
})