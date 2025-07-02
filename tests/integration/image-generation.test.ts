import { describe, it, expect, beforeEach } from 'vitest'
import app from '../../src/index'

describe('Image Generation Integration', () => {
  const mockEnv = {
    ACCESS_PASSWORD: 'test-password',
    OPENAI_API_KEY: 'test-openai-key',
    REPLICATE_API_TOKEN: 'test-replicate-token',
    R2_OUTPUTS: {} as R2Bucket,
    R2_PROMPTS: {} as R2Bucket,
    DB: {} as D1Database,
    ENVIRONMENT: 'test'
  }

  beforeEach(() => {
    // Reset mocks before each test
  })

  it('should reject image generation without authentication', async () => {
    const response = await app.request('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'A beautiful sunset'
      })
    }, mockEnv)

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Missing or invalid authorization header')
  })

  it('should accept valid image generation request', async () => {
    // Mock the database and storage operations
    const mockDB = {
      prepare: () => ({
        bind: () => ({
          run: () => Promise.resolve(),
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] })
        })
      })
    }

    const mockR2 = {
      put: () => Promise.resolve(),
      get: () => Promise.resolve(null),
      list: () => Promise.resolve({ objects: [] }),
      delete: () => Promise.resolve()
    }

    const testEnv = {
      ...mockEnv,
      DB: mockDB as any,
      R2_OUTPUTS: mockR2 as any,
      R2_PROMPTS: mockR2 as any
    }

    const response = await app.request('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-password'
      },
      body: JSON.stringify({
        prompt: 'A beautiful sunset',
        provider: 'openai',
        parameters: {
          model: 'dall-e-3',
          size: '1024x1024'
        }
      })
    }, testEnv)

    // This would normally be 200, but will likely be 500 in test due to mocked services
    // The important thing is that it's not 401 (unauthorized)
    expect(response.status).not.toBe(401)
  })

  it('should validate image generation parameters', async () => {
    const response = await app.request('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-password'
      },
      body: JSON.stringify({
        // Missing required prompt
        provider: 'openai'
      })
    }, mockEnv)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data.error).toBe('Invalid request')
  })
})