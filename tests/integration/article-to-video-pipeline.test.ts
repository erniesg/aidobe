import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFile } from 'fs/promises'
import { join } from 'path'
import type { Env } from '../../src/types/env'
import { unstable_dev } from 'wrangler'
import type { UnstableDevWorker } from 'wrangler'

describe('Article to Video Pipeline Integration Tests', () => {
  let worker: UnstableDevWorker
  let env: Env

  beforeAll(async () => {
    // Start the worker using .dev.vars
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      env: 'dev', // Use dev environment which loads .dev.vars
      local: true
    })
  }, 60000) // 60 second timeout for worker startup

  afterAll(async () => {
    await worker.stop()
  })

  describe('Step 1: Article Parsing', () => {
    it('should parse markdown article from fixtures', async () => {
      // Read the test article
      const articlePath = join(__dirname, '../fixtures/articles/apple_loses_ai_executive.md')
      const articleContent = await readFile(articlePath, 'utf-8')

      // Parse the article
      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articles: [{
            title: 'Apple loses AI executive to Meta\'s hiring spree',
            content: articleContent,
            url: 'https://test.example.com/apple-ai-executive',
            tags: ['AI', 'Apple', 'Meta', 'Executive']
          }]
        })
      })

      expect(response.status).toBe(200)
      
      const result = await response.json() as any
      expect(result.success).toBe(true)
      expect(result.data.parsedArticles).toHaveLength(1)
      
      const parsedArticle = result.data.parsedArticles[0]
      
      // OpenAI is now working! We got real analysis with detailed key points
      
      expect(parsedArticle).toMatchObject({
        title: 'Apple loses AI executive to Meta\'s hiring spree', // Use the actual article title
        keyPoints: expect.any(Array),
        sentiment: expect.stringMatching(/positive|neutral|negative/),
        tiktokPotential: expect.any(Number)
      })
      expect(parsedArticle.tiktokPotential).toBeGreaterThanOrEqual(0.5) // Should have reasonable TikTok potential
      
      // Store for next step
      global.parsedArticleId = parsedArticle.id
    })

    it('should handle multiple articles from fixtures', async () => {
      const articles = []
      
      // Load both test articles
      for (const filename of ['ai-video-revolution.md', 'tiktok-marketing-trends.md']) {
        const articlePath = join(__dirname, '../fixtures/articles', filename)
        const content = await readFile(articlePath, 'utf-8')
        
        articles.push({
          title: filename.replace('.md', '').replace(/-/g, ' '),
          content,
          url: `https://test.example.com/${filename.replace('.md', '')}`,
          tags: ['AI', 'Content']
        })
      }

      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ articles })
      })

      expect(response.status).toBe(200)
      
      const result = await response.json() as any
      expect(result.success).toBe(true)
      expect(result.data.parsedArticles).toHaveLength(2)
      expect(result.data.summary.averageTikTokPotential).toBeGreaterThan(0.6)
    })
  })

  describe('Step 2: Script Generation', () => {
    it('should generate script from parsed article', async () => {
      // First parse an article to get data
      const articlePath = join(__dirname, '../fixtures/articles/apple_loses_ai_executive.md')
      const articleContent = await readFile(articlePath, 'utf-8')

      const parseResponse = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articles: [{
            title: 'Apple loses AI executive to Meta\'s hiring spree',
            content: articleContent,
            url: 'https://test.example.com/apple-ai-executive',
            tags: ['AI', 'Apple', 'Meta']
          }]
        })
      })

      const parseResult = await parseResponse.json() as any
      const parsedArticle = parseResult.data.parsedArticles[0]

      // Generate video script
      const scriptResponse = await worker.fetch('/api/scripts/generate-video-script', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: parsedArticle.title,
          content: parsedArticle.content,
          keyPoints: parsedArticle.keyPoints,
          style: 'informative',
          duration: 60
        })
      })

      expect(scriptResponse.status).toBe(200)
      
      const scriptResult = await scriptResponse.json() as any
      
      // Log the actual script generated by OpenAI
      console.log('OpenAI Generated Script:', JSON.stringify(scriptResult.data.script, null, 2))
      
      expect(scriptResult.success).toBe(true)
      expect(scriptResult.data.script).toMatchObject({
        video_structure: expect.objectContaining({
          title: expect.any(String),
          throughline: expect.any(String),
          duration: expect.any(String),
          target_audience: expect.any(String)
        }),
        script_segments: expect.objectContaining({
          hook: expect.objectContaining({
            order_id: 1,
            voiceover: expect.any(String),
            visual_direction: expect.any(String),
            b_roll_keywords: expect.any(Array)
          }),
          body: expect.any(Object),
          conclusion: expect.any(Object)
        }),
        production_notes: expect.objectContaining({
          music_vibe: expect.any(String),
          overall_tone: expect.any(String)
        })
      })
      
      // Store for next steps
      global.generatedScript = scriptResult.data.script
    })
  })

  describe('Step 3: Argil Complete Video Generation', () => {
    it('should send script to Argil for complete generation', async () => {
      // Use the generated script from step 2
      const testScript = global.generatedScript?.content || "AI is transforming how we create TikTok content. Here's what you need to know about the future of content creation."
      
      const response = await worker.fetch('/api/argil/generate/script', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          script: testScript,
          avatarId: 'avatar-casual', // Use config avatar ID
          voiceId: '6f3a01fb-6c2c-4c50-8689-34f364657d7c', // Anthea - Singapore
          gestureSlug: 'friendly',
          videoName: 'Test Argil Video Generation',
          aspectRatio: '9:16',
          subtitles: {
            enabled: true,
            language: 'en'
          }
        })
      })

      expect(response.status).toBe(200)
      
      const result = await response.json() as any
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        status: expect.stringMatching(/IDLE|GENERATING_AUDIO|GENERATING_VIDEO|DONE/),
        moments: expect.any(Array)
      })
      
      // Store for tracking
      global.argilJobId = result.data.id
    })

    it('should track Argil job progress and get video URL', async () => {
      const jobId = global.argilJobId
      if (!jobId) {
        // Create a mock job if previous test was skipped
        global.argilJobId = 'mock-argil-job-id'
      }
      
      // Get job status (using existing Argil status endpoint)
      const statusResponse = await worker.fetch(`/api/argil/video/${global.argilJobId}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD}`
        }
      })

      expect(statusResponse.status).toBe(200)
      
      const statusResult = await statusResponse.json() as any
      expect(statusResult.success).toBe(true)
      expect(statusResult.data).toMatchObject({
        id: global.argilJobId,
        status: expect.stringMatching(/IDLE|GENERATING_AUDIO|GENERATING_VIDEO|DONE|FAILED/),
        moments: expect.any(Array)
      })

      // If completed, should have video URL
      if (statusResult.data.status === 'DONE' && statusResult.data.videoUrl) {
        global.baseVideoUrl = statusResult.data.videoUrl
      } else {
        // Use mock URL for testing
        global.baseVideoUrl = 'https://mock-argil.com/video/test.mp4'
      }
    })

    it('should transcribe Argil video using audio processing service', async () => {
      const baseVideoUrl = global.baseVideoUrl || 'https://mock-argil.com/video/test.mp4'
      
      // Test transcription endpoint (this would use the audio processing service)
      const transcribeResponse = await worker.fetch('/api/audio/transcribe', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          audioUrl: baseVideoUrl.replace('.mp4', '.mp3') // Convert to audio URL
          // provider defaults to 'whisper'
        })
      })

      expect(transcribeResponse.status).toBe(200)
      
      const transcribeResult = await transcribeResponse.json() as any
      expect(transcribeResult.success).toBe(true)
      expect(transcribeResult.data).toMatchObject({
        id: expect.any(String),
        fullText: expect.any(String),
        wordTimings: expect.any(Array),
        confidence: expect.any(Number),
        language: 'en'
      })
      
      global.transcription = transcribeResult.data.wordTimings
    })
  })

  describe('Step 4: Scene Planning & Asset Discovery', () => {
    it('should search for relevant assets based on script scenes', async () => {
      const searchQueries = [
        'AI technology futuristic',
        'TikTok content creation',
        'Video production tools'
      ]

      for (const query of searchQueries) {
        const response = await worker.fetch('/api/assets/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            type: 'image',
            providers: ['pexels', 'pixabay'],
            maxResults: 5,
            orientation: 'vertical',
            minQuality: 0.7
          })
        })

        expect(response.status).toBe(200)
        
        const result = await response.json() as any
        expect(result.success).toBe(true)
        expect(result.data.assets).toBeInstanceOf(Array)
        expect(result.data.assets.length).toBeGreaterThan(0)
        
        // Each asset should have required fields
        if (result.data.assets.length > 0) {
          expect(result.data.assets[0]).toMatchObject({
            id: expect.any(String),
            url: expect.stringContaining('http'),
            type: 'image',
            provider: expect.any(String),
            metadata: expect.any(Object)
          })
        }
      }
    })

    it('should evaluate and select best assets for scenes', async () => {
      // First search for assets
      const searchResponse = await worker.fetch('/api/assets/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: 'AI technology',
          type: 'image',
          maxResults: 10
        })
      })

      const searchResult = await searchResponse.json() as any
      const assetIds = searchResult.data.assets.map((a: any) => a.id)

      // Evaluate assets
      const evalResponse = await worker.fetch('/api/assets/evaluate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetIds: assetIds.slice(0, 5),
          sceneContext: {
            sceneId: 'test-scene-1',
            textContent: 'AI is revolutionizing content creation',
            visualKeywords: ['AI', 'technology', 'futuristic'],
            duration: 5,
            sceneType: 'main'
          },
          criteria: ['relevance', 'visual_quality', 'tiktok_suitability']
        })
      })

      expect(evalResponse.status).toBe(200)
      
      const evalResult = await evalResponse.json() as any
      expect(evalResult.success).toBe(true)
      expect(evalResult.data.evaluatedAssets).toBeInstanceOf(Array)
      expect(evalResult.data.summary.averageScore).toBeGreaterThan(0.5)
    })
  })

  describe('Step 5: Video Assembly & Final Output', () => {
    it('should assemble final overlay video with assets', async () => {
      const testScenePlan = global.scenePlan || {
        scenes: [
          {
            id: 'scene1',
            startTime: 0,
            endTime: 3,
            assetUrl: 'https://test.com/asset1.jpg',
            effect: 'ken_burns'
          }
        ],
        totalDuration: 10
      }
      
      const response = await worker.fetch('/api/video/assemble-overlay', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          baseVideoUrl: global.baseVideoUrl || 'https://test.com/base.mp4',
          scenePlan: testScenePlan,
          transcription: global.transcription || [],
          effects: {
            includeSubtitles: true,
            includeKenBurns: true,
            backgroundBlur: true
          },
          outputFormat: {
            aspectRatio: '9:16',
            resolution: '1080x1920',
            fps: 30
          }
        })
      })

      expect(response.status).toBe(200)
      
      const result = await response.json() as any
      expect(result.success).toBe(true)
      expect(result.data).toMatchObject({
        jobId: expect.any(String),
        status: expect.stringMatching(/processing|queued/),
        estimatedDuration: expect.any(Number)
      })
      
      global.assemblyJobId = result.data.jobId
    })

    it('should track assembly progress and get final video', async () => {
      const jobId = global.assemblyJobId || 'mock-assembly-job'
      
      const statusResponse = await worker.fetch(`/api/video/assembly-status/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD}`
        }
      })

      expect(statusResponse.status).toBe(200)
      
      const statusResult = await statusResponse.json() as any
      expect(statusResult.success).toBe(true)
      expect(statusResult.data).toMatchObject({
        jobId: jobId,
        status: expect.stringMatching(/processing|completed|queued/),
        progress: expect.any(Number)
      })

      // If completed, should have final video
      if (statusResult.data.status === 'completed') {
        expect(statusResult.data.result).toMatchObject({
          finalVideoUrl: expect.stringContaining('http'),
          duration: expect.any(Number),
          resolution: expect.any(String),
          fileSize: expect.any(Number)
        })
        
        global.finalVideoUrl = statusResult.data.result.finalVideoUrl
      }
    })

    it('should create complete workflow job that orchestrates the entire pipeline', async () => {
      // Read the test article
      const articlePath = join(__dirname, '../fixtures/articles/apple_loses_ai_executive.md')
      const articleContent = await readFile(articlePath, 'utf-8')
      
      // Create a complete workflow job that handles the entire Argil pipeline
      const jobResponse = await worker.fetch('/api/jobs/complete-workflow', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'argil_complete_generation',
          input: {
            article: {
              title: 'Apple loses AI executive to Meta\'s hiring spree',
              content: articleContent,
              url: 'https://test.example.com/apple-ai-executive'
            },
            preferences: {
              avatarId: 'avatar-casual',
              style: 'informative',
              duration: 60,
              aspectRatio: '9:16',
              includeEffects: true,
              includeSubtitles: true,
              voiceId: '6f3a01fb-6c2c-4c50-8689-34f364657d7c',
              gestureSlug: 'friendly'
            }
          }
        })
      })

      expect(jobResponse.status).toBe(201)
      
      const jobResult = await jobResponse.json() as any
      expect(jobResult.success).toBe(true)
      expect(jobResult.data.job).toMatchObject({
        id: expect.any(String),
        type: 'argil_complete_generation',
        status: expect.stringMatching(/queued|processing/),
        createdAt: expect.any(String)
      })

      // Check job status tracking
      const statusResponse = await worker.fetch(`/api/jobs/${jobResult.data.job.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD}`
        }
      })

      expect(statusResponse.status).toBe(200)
      
      const statusResult = await statusResponse.json() as any
      expect(statusResult.success).toBe(true)
      expect(statusResult.data.job).toMatchObject({
        id: jobResult.data.job.id,
        status: expect.any(String),
        progress: expect.any(Number),
        currentStep: expect.any(String)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid article content gracefully', async () => {
      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ACCESS_PASSWORD || 'DI3+@##AN@:rKEFi'}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articles: [{
            title: '',  // Invalid: empty title
            content: 'Too short',  // Invalid: content too short
            url: 'not-a-url',  // Invalid: not a valid URL
            tags: []
          }]
        })
      })

      expect(response.status).toBe(400)
      
      const result = await response.json() as any
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid')
    })

    it('should handle missing authentication', async () => {
      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          articles: [{
            title: 'Test',
            content: 'Test content',
            url: 'https://example.com'
          }]
        })
      })

      expect(response.status).toBe(401)
    })
  })
})

// Store values between tests
declare global {
  var parsedArticleId: string
  var generatedScript: any
  var argilJobId: string
  var baseVideoUrl: string
  var transcription: any[]
  var scenePlan: any
  var assemblyJobId: string
  var finalVideoUrl: string
}