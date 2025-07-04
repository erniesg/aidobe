import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unstable_dev } from 'wrangler'
import type { Unstable_DevWorker } from 'wrangler'

/**
 * Integration tests for the complete aidobe API endpoints
 * Tests the full video generation workflow through the API layer
 */
describe('API Endpoints Integration', () => {
  let worker: Unstable_DevWorker

  beforeEach(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      env: 'test'
    })
  })

  afterEach(async () => {
    await worker.stop()
  })

  describe('Scripts API', () => {
    it('should parse articles successfully', async () => {
      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: [
            {
              id: 'article-1',
              title: 'Test Article',
              content: 'This is a test article about technology trends.',
              url: 'https://example.com/article-1',
              tags: ['technology', 'trends']
            }
          ],
          jobId: crypto.randomUUID()
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.parsedArticles).toBeDefined()
      expect(data.data.parsedArticles.length).toBe(1)
      expect(data.data.summary.totalArticles).toBe(1)
    })

    it('should generate structured scripts', async () => {
      const response = await worker.fetch('/api/scripts/generate-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: crypto.randomUUID(),
          articleIds: ['article-1', 'article-2'],
          contentPreferences: {
            style: 'tech_in_asia',
            targetDuration: 90,
            targetAudience: 'tech enthusiasts',
            energyLevel: 'high',
            includeConflict: true,
            bodySegmentCount: 2
          },
          generationConfig: {
            numberOfVariations: 2,
            temperature: 0.8,
            promptTemplate: 'tech-in-asia-script-v2',
            useStructuredOutput: true,
            enhancementFlags: ['optimize_hooks']
          }
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.scripts).toBeDefined()
      expect(data.data.scripts.length).toBe(2)
      expect(data.data.summary.generatedCount).toBe(2)
    })

    it('should handle script health check', async () => {
      const response = await worker.fetch('/api/scripts/health')
      
      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('healthy')
      expect(data.data.services).toBeDefined()
    })
  })

  describe('Assets API', () => {
    it('should search for assets', async () => {
      const response = await worker.fetch('/api/assets/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'technology startup office',
          type: 'image',
          providers: ['pexels', 'pixabay'],
          maxResults: 5,
          orientation: 'vertical',
          minQuality: 0.7
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.assets).toBeDefined()
      expect(data.data.summary.totalFound).toBeGreaterThan(0)
      expect(data.data.summary.mediaType).toBe('image')
    })

    it('should evaluate assets for relevance', async () => {
      const response = await worker.fetch('/api/assets/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: [crypto.randomUUID(), crypto.randomUUID()],
          sceneContext: {
            sceneId: crypto.randomUUID(),
            textContent: 'A modern startup office with developers coding',
            visualKeywords: ['office', 'computers', 'developers'],
            duration: 5,
            sceneType: 'main'
          },
          criteria: ['relevance', 'visual_quality', 'tiktok_suitability'],
          evaluationModel: 'claude_vision'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.evaluatedAssets).toBeDefined()
      expect(data.data.evaluatedAssets.length).toBe(2)
      expect(data.data.summary.averageScore).toBeGreaterThan(0)
    })

    it('should process scenes in batch', async () => {
      const jobId = crypto.randomUUID()
      
      const response = await worker.fetch('/api/assets/batch-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          scenes: [
            {
              sceneId: crypto.randomUUID(),
              searchQuery: 'modern office space',
              visualKeywords: ['office', 'modern', 'workspace'],
              requirements: {
                mediaType: 'image',
                style: 'professional',
                aspectRatio: '9:16'
              }
            },
            {
              sceneId: crypto.randomUUID(),
              searchQuery: 'technology innovation',
              visualKeywords: ['tech', 'innovation', 'future'],
              requirements: {
                mediaType: 'image',
                style: 'futuristic',
                aspectRatio: '9:16'
              }
            }
          ],
          preferences: {
            providers: ['pexels'],
            maxResultsPerScene: 5,
            evaluateAssets: true,
            selectBest: true
          }
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.results).toBeDefined()
      expect(data.data.results.length).toBe(2)
      expect(data.data.summary.totalScenes).toBe(2)
      expect(data.data.summary.successfulScenes).toBe(2)
    })
  })

  describe('Audio API', () => {
    it('should generate TTS audio', async () => {
      const response = await worker.fetch('/api/audio/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: crypto.randomUUID(),
          scriptId: crypto.randomUUID(),
          text: 'This is a test script for text-to-speech generation.',
          voicePreferences: {
            provider: 'openai',
            voiceId: 'alloy',
            gender: 'neutral',
            style: 'conversational'
          },
          parameters: {
            speed: 1.1,
            pitch: 1.0,
            volume: 1.0
          },
          outputFormat: 'mp3',
          includeWordTimings: true
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.audioFile).toBeDefined()
      expect(data.data.audioFile.duration).toBeGreaterThan(0)
      expect(data.data.summary.provider).toBe('openai')
    })

    it('should search for background music', async () => {
      const response = await worker.fetch('/api/audio/search-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: crypto.randomUUID(),
          mood: 'upbeat',
          duration: { min: 30, max: 120 },
          videoContext: {
            totalDuration: 90,
            energyLevel: 0.8,
            keyMoments: [
              { time: 10, description: 'Key point revelation', intensity: 0.9 }
            ]
          },
          maxResults: 3,
          licenseType: 'royalty_free'
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.musicSelections).toBeDefined()
      expect(data.data.musicSelections.length).toBeGreaterThan(0)
      expect(data.data.summary.mood).toBe('upbeat')
    })

    it('should mix voice and background audio', async () => {
      const response = await worker.fetch('/api/audio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: crypto.randomUUID(),
          voiceAudioId: crypto.randomUUID(),
          musicSelectionId: crypto.randomUUID(),
          mixConfig: {
            voiceVolume: 1.0,
            musicVolume: 0.3,
            enableDucking: true,
            fadeInDuration: 1.0,
            fadeOutDuration: 1.0,
            normalization: true,
            outputFormat: 'mp3'
          }
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.mixedAudio).toBeDefined()
      expect(data.data.mixedAudio.url).toMatch(/^https:\/\/.*\.mp3$/)
      expect(data.data.summary.outputFormat).toBe('mp3')
    })

    it('should list available TTS voices', async () => {
      const response = await worker.fetch('/api/audio/voices')
      
      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.voices).toBeDefined()
      expect(data.data.voices.length).toBeGreaterThan(0)
      expect(data.data.summary.totalVoices).toBeGreaterThan(0)
    })
  })

  describe('Video API', () => {
    it('should assemble video from components', async () => {
      const response = await worker.fetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: crypto.randomUUID(),
          finalScriptId: crypto.randomUUID(),
          audioMixId: crypto.randomUUID(),
          scenes: [
            {
              sceneId: crypto.randomUUID(),
              sequenceNumber: 1,
              textContent: 'Welcome to our tech showcase',
              startTime: 0,
              endTime: 5,
              selectedAssetUrl: 'https://example.com/asset1.jpg',
              assetType: 'image',
              effects: {
                kenBurns: {
                  enabled: true,
                  startScale: 1.2,
                  endScale: 1.5,
                  direction: 'zoom_in'
                }
              }
            }
          ],
          videoSettings: {
            outputFormat: 'mp4',
            resolution: '1080x1920',
            framerate: 30,
            quality: 'high'
          }
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.assemblyResult).toBeDefined()
      expect(data.data.summary.totalScenes).toBe(1)
      expect(data.data.summary.outputFormat).toBe('mp4')
    })

    it('should add captions to video', async () => {
      const response = await worker.fetch('/api/video/add-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: crypto.randomUUID(),
          captionSettings: {
            style: 'modern',
            position: 'bottom',
            fontFamily: 'Arial',
            fontSize: 24,
            fontColor: '#FFFFFF',
            backgroundColor: '#000000',
            backgroundOpacity: 0.7,
            animation: 'fade_in'
          },
          wordTimings: [
            { word: 'Welcome', startTime: 0, endTime: 0.5, confidence: 0.95 },
            { word: 'to', startTime: 0.5, endTime: 0.7, confidence: 0.98 },
            { word: 'our', startTime: 0.7, endTime: 1.0, confidence: 0.96 }
          ]
        })
      })

      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.captionedVideo).toBeDefined()
      expect(data.data.summary.wordsProcessed).toBe(3)
    })

    it('should track video processing progress', async () => {
      const jobId = crypto.randomUUID()
      
      const response = await worker.fetch(`/api/video/progress/${jobId}`)
      
      expect(response.status).toBe(200)
      const data = await response.json() as any
      expect(data.success).toBe(true)
      expect(data.data.progress).toBeDefined()
      expect(data.data.progress.jobId).toBe(jobId)
      expect(data.data.progress.status).toMatch(/^(pending|processing|completed|failed)$/)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid JSON gracefully', async () => {
      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })

      expect(response.status).toBe(400)
      const data = await response.json() as any
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should validate required fields', async () => {
      const response = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing required articles field
          jobId: crypto.randomUUID()
        })
      })

      expect(response.status).toBe(400)
      const data = await response.json() as any
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid request format')
      expect(data.details).toBeDefined()
    })

    it('should handle missing route gracefully', async () => {
      const response = await worker.fetch('/api/nonexistent/endpoint')
      
      expect(response.status).toBe(404)
    })
  })

  describe('Complete Workflow Integration', () => {
    it('should execute complete video generation workflow', async () => {
      const jobId = crypto.randomUUID()
      
      // Step 1: Parse articles
      const parseResponse = await worker.fetch('/api/scripts/parse-articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: [{
            id: 'workflow-article-1',
            title: 'Revolutionary AI Technology',
            content: 'A comprehensive look at the latest AI breakthroughs that are changing the world.',
            url: 'https://example.com/ai-tech',
            tags: ['ai', 'technology', 'innovation']
          }],
          jobId
        })
      })
      
      expect(parseResponse.status).toBe(200)
      const parseData = await parseResponse.json() as any
      expect(parseData.success).toBe(true)

      // Step 2: Generate structured script
      const scriptResponse = await worker.fetch('/api/scripts/generate-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          articleIds: ['workflow-article-1'],
          contentPreferences: {
            style: 'tech_in_asia',
            targetDuration: 60,
            targetAudience: 'tech enthusiasts',
            energyLevel: 'high',
            includeConflict: true,
            bodySegmentCount: 1
          },
          generationConfig: {
            numberOfVariations: 1,
            temperature: 0.8,
            useStructuredOutput: true,
            enhancementFlags: []
          }
        })
      })
      
      expect(scriptResponse.status).toBe(200)
      const scriptData = await scriptResponse.json() as any
      expect(scriptData.success).toBe(true)
      const script = scriptData.data.scripts[0]

      // Step 3: Generate TTS audio
      const ttsResponse = await worker.fetch('/api/audio/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          scriptId: script.id,
          text: 'Revolutionary AI technology is transforming our world.',
          voicePreferences: { provider: 'openai', voiceId: 'alloy' },
          parameters: { speed: 1.0, pitch: 1.0, volume: 1.0 },
          outputFormat: 'mp3',
          includeWordTimings: true
        })
      })
      
      expect(ttsResponse.status).toBe(200)
      const ttsData = await ttsResponse.json() as any
      expect(ttsData.success).toBe(true)

      // Step 4: Search for assets
      const assetResponse = await worker.fetch('/api/assets/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'artificial intelligence technology',
          type: 'image',
          providers: ['pexels'],
          maxResults: 3,
          orientation: 'vertical'
        })
      })
      
      expect(assetResponse.status).toBe(200)
      const assetData = await assetResponse.json() as any
      expect(assetData.success).toBe(true)

      // Step 5: Select background music
      const musicResponse = await worker.fetch('/api/audio/search-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          mood: 'inspirational',
          duration: { min: 30, max: 90 },
          videoContext: {
            totalDuration: 60,
            energyLevel: 0.7,
            keyMoments: []
          },
          maxResults: 1,
          licenseType: 'royalty_free'
        })
      })
      
      expect(musicResponse.status).toBe(200)
      const musicData = await musicResponse.json() as any
      expect(musicData.success).toBe(true)

      // Step 6: Mix audio
      const mixResponse = await worker.fetch('/api/audio/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          voiceAudioId: ttsData.data.audioFile.id,
          musicSelectionId: musicData.data.musicSelections[0].id,
          mixConfig: {
            voiceVolume: 1.0,
            musicVolume: 0.2,
            enableDucking: true,
            outputFormat: 'mp3'
          }
        })
      })
      
      expect(mixResponse.status).toBe(200)
      const mixData = await mixResponse.json() as any
      expect(mixData.success).toBe(true)

      // Step 7: Assemble final video
      const videoResponse = await worker.fetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          finalScriptId: script.id,
          audioMixId: mixData.data.mixedAudio.url,
          scenes: [{
            sceneId: crypto.randomUUID(),
            sequenceNumber: 1,
            textContent: 'Revolutionary AI technology is transforming our world.',
            startTime: 0,
            endTime: 5,
            selectedAssetUrl: assetData.data.assets[0].url,
            assetType: 'image',
            effects: {
              kenBurns: {
                enabled: true,
                startScale: 1.0,
                endScale: 1.2,
                direction: 'zoom_in'
              }
            }
          }],
          videoSettings: {
            outputFormat: 'mp4',
            resolution: '1080x1920',
            framerate: 30,
            quality: 'high'
          }
        })
      })
      
      expect(videoResponse.status).toBe(200)
      const videoData = await videoResponse.json() as any
      expect(videoData.success).toBe(true)
      
      console.log('✅ Complete workflow executed successfully!')
      console.log(`🎬 Generated video URL: ${videoData.data.assemblyResult.outputUrl}`)
    }, 30000) // 30 second timeout for complete workflow
  })

  describe('Performance & Reliability', () => {
    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => 
        worker.fetch('/api/scripts/health')
      )
      
      const responses = await Promise.all(requests)
      
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })
    })

    it('should respond within reasonable time limits', async () => {
      const start = Date.now()
      
      const response = await worker.fetch('/api/assets/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'test query',
          type: 'image',
          maxResults: 5
        })
      })
      
      const duration = Date.now() - start
      
      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(5000) // Should respond within 5 seconds
    })
  })
})