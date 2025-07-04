import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ScriptGenerationService } from '../../../src/services/script-generation'
import type { Env } from '../../../src/types/env'
import type { 
  GenerateScriptRequest, 
  EditScriptRequest, 
  StructuredScriptGenerationRequest, 
  StructuredScript 
} from '../../../src/schemas/script'
import type { Article } from '../../../src/schemas/job'

// Mock template engine
vi.mock('../../../src/services/template-engine', () => ({
  TemplateEngine: vi.fn().mockImplementation(() => ({
    renderTemplate: vi.fn(),
    loadTemplate: vi.fn(),
    clearCache: vi.fn(),
    listTemplates: vi.fn()
  }))
}))

// Mock implementations
const mockLLMProvider = {
  generateText: vi.fn()
}

const mockConfigService = {
  getModelConfig: vi.fn(),
  getPromptTemplate: vi.fn(),
  renderPrompt: vi.fn()
}

const mockTemplateEngine = {
  renderTemplate: vi.fn(),
  loadTemplate: vi.fn(),
  clearCache: vi.fn(),
  listTemplates: vi.fn()
}

const mockEnv: Env = {
  ENVIRONMENT: 'test',
  ACCESS_PASSWORD: 'test-password',
  OPENAI_API_KEY: 'test-openai-key',
  REPLICATE_API_TOKEN: 'test-replicate-token',
  R2_OUTPUTS: {} as any,
  R2_PROMPTS: {} as any,
  DB: {} as any,
  KV: {} as any
}

describe('ScriptGenerationService', () => {
  let service: ScriptGenerationService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ScriptGenerationService(mockEnv, mockLLMProvider, mockConfigService)
    // Replace the template engine with our mock
    ;(service as any).templateEngine = mockTemplateEngine
  })

  describe('parseArticles', () => {
    it('should parse articles and extract key information', async () => {
      const articles: Article[] = [
        {
          title: 'Amazing AI Breakthrough',
          content: '<p>This is an <strong>amazing</strong> breakthrough in AI technology. Scientists have developed incredible new methods.</p>',
          url: 'https://example.com/article1',
          tags: ['ai', 'technology', 'breakthrough']
        }
      ]

      // Mock LLM responses
      mockLLMProvider.generateText
        .mockResolvedValueOnce('- Revolutionary AI technology\n- New breakthrough methods\n- Scientific innovation') // key points
      
      mockConfigService.getPromptTemplate.mockResolvedValue({
        template: 'Extract key points from: {{content}}',
        version: '1.0'
      })
      mockConfigService.renderPrompt.mockReturnValue('Extract key points from: This is an amazing breakthrough...')

      const result = await service.parseArticles(articles)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        title: 'Amazing AI Breakthrough',
        content: expect.stringContaining('amazing breakthrough'),
        keyPoints: ['Revolutionary AI technology', 'New breakthrough methods', 'Scientific innovation'],
        sentiment: 'positive',
        tiktokPotential: expect.any(Number)
      })
      expect(result[0].tiktokPotential).toBeGreaterThan(0.5) // Should be high due to "amazing"
    })

    it('should handle HTML sanitization correctly', async () => {
      const articles: Article[] = [
        {
          title: 'Test Article',
          content: '<script>alert("xss")</script><p>Safe content &amp; more</p>',
          url: 'https://example.com/test',
          tags: ['test']
        }
      ]

      mockLLMProvider.generateText.mockResolvedValue('- Safe content')
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test prompt')

      const result = await service.parseArticles(articles)

      expect(result[0].content).not.toContain('<script>')
      expect(result[0].content).not.toContain('&amp;')
      expect(result[0].content).toContain('Safe content')
    })

    it('should handle sentiment analysis correctly', async () => {
      const positiveArticle: Article[] = [{
        title: 'Great News',
        content: 'This is fantastic and amazing news! Great breakthrough!',
        url: 'https://example.com/positive',
        tags: ['news', 'positive']
      }]

      const negativeArticle: Article[] = [{
        title: 'Bad News',
        content: 'This is terrible and awful. Bad situation with horrible problems.',
        url: 'https://example.com/negative',
        tags: ['news', 'negative']
      }]

      mockLLMProvider.generateText.mockResolvedValue('- Test point')
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')

      const positiveResult = await service.parseArticles(positiveArticle)
      const negativeResult = await service.parseArticles(negativeArticle)

      expect(positiveResult[0].sentiment).toBe('positive')
      expect(negativeResult[0].sentiment).toBe('negative')
    })

    it('should handle LLM failures gracefully', async () => {
      const articles: Article[] = [
        {
          title: 'Test Article',
          content: 'Test content',
          url: 'https://example.com/test',
          tags: ['test']
        }
      ]

      mockLLMProvider.generateText.mockRejectedValue(new Error('LLM failed'))
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })

      await expect(service.parseArticles(articles)).rejects.toThrow('Failed to parse any articles successfully')
    })
  })

  describe('generateDrafts', () => {
    it('should generate multiple script drafts', async () => {
      const request: GenerateScriptRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1'],
        preferences: {
          style: 'informative',
          targetDuration: 60,
          includeHashtags: true,
          includeCTA: true
        },
        generationConfig: {
          numberOfDrafts: 2,
          temperature: 0.8
        }
      }

      mockConfigService.getModelConfig.mockResolvedValue({
        model: 'gpt-4',
        temperature: 0.7
      })

      mockConfigService.getPromptTemplate.mockResolvedValue({
        template: 'Generate TikTok script for {{style}} style with {{targetDuration}}s duration',
        version: '1.0'
      })

      mockConfigService.renderPrompt.mockReturnValue('Generate TikTok script for informative style with 60s duration')

      // Mock LLM responses for two drafts
      mockLLMProvider.generateText
        .mockResolvedValueOnce(`Title: Amazing AI Facts
This is an incredible breakthrough! Did you know AI can now predict the future? 
Hooks:
- Mind-blowing AI predictions
CTA: Follow for more tech updates!
Hashtags: #ai #tech #amazing #future`)
        .mockResolvedValueOnce(`Title: Future Tech Revealed
The future is here and it's incredible! Scientists just made history.
Hooks:
- Revolutionary discovery
CTA: Subscribe for daily tech news!
Hashtags: #technology #science #breakthrough #viral`)

      const result = await service.generateDrafts(request)

      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Amazing AI Facts')
      expect(result[0].style).toBe('informative')
      expect(result[0].hooks).toContain('Mind-blowing AI predictions')
      expect(result[0].callToAction).toBe('Follow for more tech updates!')
      expect(result[0].hashtags).toEqual(expect.arrayContaining(['#ai', '#tech', '#amazing', '#future']))
      
      expect(result[1].title).toBe('Future Tech Revealed')
      expect(result[1].style).toBe('informative')
    })

    it('should handle generation failures gracefully', async () => {
      const request: GenerateScriptRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1']
      }

      mockConfigService.getModelConfig.mockResolvedValue({ model: 'gpt-4' })
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test prompt')
      mockLLMProvider.generateText.mockRejectedValue(new Error('Generation failed'))

      await expect(service.generateDrafts(request)).rejects.toThrow('Failed to generate any script drafts')
    })

    it('should calculate quality scores correctly', async () => {
      const request: GenerateScriptRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1']
      }

      mockConfigService.getModelConfig.mockResolvedValue({ model: 'gpt-4' })
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')

      // High quality response with hooks, CTA, hashtags
      mockLLMProvider.generateText.mockResolvedValue(`
        Title: High Quality Script
        This is a well-structured script with perfect length and engaging content that tells a story.
        Hooks:
        - Amazing hook one
        - Incredible hook two
        CTA: Follow for more amazing content!
        Hashtags: #viral #amazing #content #follow #subscribe
      `)

      const result = await service.generateDrafts(request)

      expect(result[0].qualityScore).toBeGreaterThan(0.4)
      expect(result[0].confidence).toBeGreaterThan(0.6)
    })
  })

  describe('editDraft', () => {
    it('should apply content edits correctly', async () => {
      const request: EditScriptRequest = {
        draftId: 'test-draft-id',
        edits: [
          {
            field: 'content',
            action: 'replace',
            value: 'New amazing content that will go viral!'
          }
        ],
        preserveFormatting: true,
        reason: 'Improving engagement'
      }

      // Mock loadDraft to return existing draft
      const existingDraft = {
        id: 'test-draft-id',
        jobId: 'test-job',
        version: 1,
        title: 'Original Title',
        content: 'Original content',
        style: 'informative' as const,
        estimatedDuration: 30,
        wordCount: 20,
        hooks: ['Original hook'],
        callToAction: 'Original CTA',
        hashtags: ['#original'],
        metadata: {},
        status: 'reviewed' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      // Mock the private loadDraft method
      vi.spyOn(service as any, 'loadDraft').mockResolvedValue(existingDraft)

      const result = await service.editDraft(request)

      expect(result.draft.content).toBe('New amazing content that will go viral!')
      expect(result.draft.version).toBe(2)
      expect(result.draft.wordCount).toBe(7) // New word count
      expect(result.edit.editType).toBe('content_change')
      expect(result.edit.reason).toBe('Improving engagement')
    })

    it('should handle multiple field edits', async () => {
      const request: EditScriptRequest = {
        draftId: 'test-draft-id',
        edits: [
          {
            field: 'title',
            action: 'replace',
            value: 'New Amazing Title'
          },
          {
            field: 'hashtags',
            action: 'append',
            value: '#new'
          }
        ],
        preserveFormatting: true
      }

      const existingDraft = {
        id: 'test-draft-id',
        jobId: 'test-job',
        version: 1,
        title: 'Old Title',
        content: 'Content',
        style: 'informative' as const,
        estimatedDuration: 30,
        wordCount: 20,
        hooks: [],
        hashtags: ['#old'],
        metadata: {},
        status: 'reviewed' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      vi.spyOn(service as any, 'loadDraft').mockResolvedValue(existingDraft)

      const result = await service.editDraft(request)

      expect(result.draft.title).toBe('New Amazing Title')
      expect(result.draft.hashtags).toContain('#new')
      expect(result.draft.hashtags).toContain('#old')
    })

    it('should throw error for non-existent draft', async () => {
      const request: EditScriptRequest = {
        draftId: 'non-existent-id',
        edits: [{ field: 'content', action: 'replace', value: 'new content' }],
        preserveFormatting: true
      }

      vi.spyOn(service as any, 'loadDraft').mockResolvedValue(null)

      await expect(service.editDraft(request)).rejects.toThrow('Draft non-existent-id not found')
    })
  })

  describe('finalizeDraft', () => {
    it('should finalize a reviewed draft', async () => {
      const mockDraft = {
        id: 'test-draft-id',
        jobId: 'test-job',
        version: 2,
        title: 'Final Title',
        content: 'This is the final content. It has multiple sentences. Each sentence could be a scene.',
        style: 'professional' as const,
        estimatedDuration: 45,
        wordCount: 25,
        hooks: ['Great hook'],
        callToAction: 'Subscribe now!',
        hashtags: ['#final', '#professional'],
        metadata: {},
        status: 'reviewed' as const,
        qualityScore: 0.85,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      vi.spyOn(service as any, 'loadDraft').mockResolvedValue(mockDraft)

      const result = await service.finalizeDraft('test-draft-id', 'user-123')

      expect(result).toMatchObject({
        originalDraftId: 'test-draft-id',
        title: 'Final Title',
        content: mockDraft.content,
        finalizedBy: 'user-123'
      })
      expect(result.visualKeywords).toBeInstanceOf(Array)
      expect(result.sceneBreakpoints.length).toBeGreaterThan(0)
      expect(result.approvalHistory).toHaveLength(1)
      expect(result.approvalHistory[0].approvedBy).toBe('user-123')
    })

    it('should reject non-reviewed drafts', async () => {
      const mockDraft = {
        id: 'test-draft-id',
        status: 'draft' as const
      }

      vi.spyOn(service as any, 'loadDraft').mockResolvedValue(mockDraft)

      await expect(service.finalizeDraft('test-draft-id')).rejects.toThrow('Draft must be reviewed before finalization')
    })
  })

  describe('extractScenes', () => {
    it('should extract scenes from finalized script with breakpoints', async () => {
      const mockFinalScript = {
        id: 'final-script-id',
        content: 'First sentence is intro. Second sentence is main content. Third sentence concludes everything.',
        sceneBreakpoints: [
          { position: 0, sceneType: 'intro' as const, estimatedDuration: 5 },
          { position: 25, sceneType: 'main' as const, estimatedDuration: 10 },
          { position: 55, sceneType: 'conclusion' as const, estimatedDuration: 8 }
        ]
      }

      const result = await service.extractScenes(mockFinalScript as any)

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        sequenceNumber: 1,
        sceneType: 'intro',
        textContent: expect.stringContaining('First sentence')
      })
      expect(result[1]).toMatchObject({
        sequenceNumber: 2,
        sceneType: 'main'
      })
      expect(result[2]).toMatchObject({
        sequenceNumber: 3,
        sceneType: 'conclusion'
      })
    })

    it('should fallback to sentence-based splitting when no breakpoints', async () => {
      const mockFinalScript = {
        id: 'final-script-id',
        content: 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.',
        sceneBreakpoints: []
      }

      const result = await service.extractScenes(mockFinalScript as any)

      expect(result.length).toBeGreaterThan(0)
      expect(result[0].sceneType).toBe('intro')
      expect(result[result.length - 1].sceneType).toBe('conclusion')
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle empty articles array', async () => {
      await expect(service.parseArticles([])).rejects.toThrow()
    })

    it('should handle malformed script responses', async () => {
      const request: GenerateScriptRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1']
      }

      mockConfigService.getModelConfig.mockResolvedValue({ model: 'gpt-4' })
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')

      // Malformed response without proper structure
      mockLLMProvider.generateText.mockResolvedValue('Just plain text without any structure')

      const result = await service.generateDrafts(request)

      // Default numberOfDrafts is 3, but we only get successful response once
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0].content).toBe('Just plain text without any structure')
      expect(result[0].title).toBe('Generated TikTok Script') // Default title
    })

    it('should handle very long content appropriately', async () => {
      const longContent = 'word '.repeat(1000) // 1000 words
      const articles: Article[] = [{
        title: 'Long Article',
        content: longContent,
        url: 'https://example.com/long',
        tags: ['long', 'content']
      }]

      mockLLMProvider.generateText.mockResolvedValue('- Long content summary')
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')

      const result = await service.parseArticles(articles)

      expect(result[0].tiktokPotential).toBeLessThan(0.5) // Should be lower for very long content
    })

    it('should handle special characters in content', async () => {
      const articles: Article[] = [{
        title: 'Special Chars',
        content: 'Content with émojis 🚀 and spëcial chäractërs & symbols!',
        url: 'https://example.com/special',
        tags: ['special', 'chars']
      }]

      mockLLMProvider.generateText.mockResolvedValue('- Special content')
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')

      const result = await service.parseArticles(articles)

      expect(result[0].content).toContain('émojis')
      expect(result[0].content).toContain('🚀')
    })
  })

  describe('generateStructuredScripts', () => {
    it('should generate structured scripts with wanx-inspired segments', async () => {
      const request: StructuredScriptGenerationRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1', 'article-2'],
        contentPreferences: {
          style: 'tech_in_asia',
          targetDuration: 90,
          targetAudience: 'tech enthusiasts',
          energyLevel: 'high',
          includeConflict: true
        },
        productionPreferences: {
          visualStyle: 'modern',
          musicVibe: 'upbeat electronic',
          overallTone: 'enthusiastic'
        },
        generationConfig: {
          numberOfVariations: 2,
          temperature: 0.8,
          promptTemplate: 'tech-in-asia-script-v2'
        }
      }

      // Mock template engine rendering
      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'Generate a structured TikTok script with the following segments...',
        renderTime: 50,
        variablesUsed: ['targetDuration', 'style', 'targetAudience'],
        missingVariables: []
      })

      // Mock structured JSON response from LLM
      const mockStructuredResponse = {
        videoStructure: {
          throughline: 'Revolutionary AI breakthrough changes everything',
          title: 'AI Breakthrough That Will Shock You! 🤖',
          duration: '90 seconds',
          targetAudience: 'tech enthusiasts',
          style: 'tech_in_asia',
          energyLevel: 'high',
          complexity: 'moderate'
        },
        scriptSegments: {
          hook: {
            orderId: 1,
            segmentType: 'hook',
            voiceover: 'Did you know AI just achieved something impossible?',
            visualDirection: 'Close-up shot of surprised face, then quick cut to AI visualization',
            bRollKeywords: ['ai', 'breakthrough', 'technology', 'robot']
          },
          conflict: {
            orderId: 2,
            segmentType: 'conflict',
            voiceover: 'Scientists said this would take decades, but it happened overnight',
            visualDirection: 'Split screen showing old predictions vs new reality',
            bRollKeywords: ['scientists', 'prediction', 'timeline', 'research']
          },
          body: [
            {
              orderId: 3,
              segmentType: 'body',
              voiceover: 'Here\'s exactly what happened and why it matters',
              visualDirection: 'Animated explanation with clear graphics',
              bRollKeywords: ['explanation', 'data', 'charts', 'innovation']
            }
          ],
          conclusion: {
            orderId: 4,
            segmentType: 'conclusion',
            voiceover: 'This changes everything we thought we knew about AI',
            visualDirection: 'Dramatic reveal shot with future implications',
            bRollKeywords: ['future', 'impact', 'change', 'evolution']
          }
        },
        productionNotes: {
          musicVibe: 'upbeat electronic with builds',
          overallTone: 'enthusiastic and informative'
        }
      }

      mockLLMProvider.generateText.mockResolvedValueOnce(JSON.stringify(mockStructuredResponse))
      mockLLMProvider.generateText.mockResolvedValueOnce(JSON.stringify({
        ...mockStructuredResponse,
        videoStructure: {
          ...mockStructuredResponse.videoStructure,
          title: 'Mind-Blowing AI Discovery! 🚀'
        }
      }))

      const result = await service.generateStructuredScripts(request)

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        jobId: 'test-job-id',
        version: 1,
        videoStructure: {
          throughline: 'Revolutionary AI breakthrough changes everything',
          title: 'AI Breakthrough That Will Shock You! 🤖',
          duration: '90 seconds',
          targetAudience: 'tech enthusiasts',
          style: 'tech_in_asia',
          energyLevel: 'high',
          complexity: 'moderate'
        },
        scriptSegments: {
          hook: expect.objectContaining({
            orderId: 1,
            segmentType: 'hook',
            voiceover: expect.stringContaining('impossible'),
            visualDirection: expect.any(String),
            bRollKeywords: expect.arrayContaining(['ai', 'breakthrough'])
          }),
          conflict: expect.objectContaining({
            orderId: 2,
            segmentType: 'conflict',
            voiceover: expect.any(String)
          }),
          body: expect.arrayContaining([
            expect.objectContaining({
              orderId: 3,
              segmentType: 'body',
              voiceover: expect.any(String)
            })
          ]),
          conclusion: expect.objectContaining({
            orderId: 4,
            segmentType: 'conclusion',
            voiceover: expect.any(String)
          })
        },
        productionNotes: {
          musicVibe: 'upbeat electronic with builds',
          overallTone: 'enthusiastic and informative'
        }
      })

      expect(result[0].qualityMetrics).toBeDefined()
      expect(result[0].generationMetadata.templateUsed).toBe('tech-in-asia-script-v2')
      expect(result[0].status).toBe('generated')
    })

    it('should handle template rendering failures gracefully', async () => {
      const request: StructuredScriptGenerationRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1'],
        generationConfig: {
          numberOfVariations: 1 // Only test 1 variation to get specific error
        }
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: false,
        error: 'Template not found',
        renderTime: 10,
        variablesUsed: [],
        missingVariables: ['required_var']
      })

      await expect(service.generateStructuredScripts(request)).rejects.toThrow('Template rendering failed')
    })

    it('should handle malformed JSON response from LLM', async () => {
      const request: StructuredScriptGenerationRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1'],
        generationConfig: {
          numberOfVariations: 1 // Only test 1 variation to get specific error
        }
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'test prompt',
        renderTime: 10,
        variablesUsed: [],
        missingVariables: []
      })

      // Return malformed JSON
      mockLLMProvider.generateText.mockResolvedValue('This is not valid JSON response')

      await expect(service.generateStructuredScripts(request)).rejects.toThrow('Failed to parse structured response')
    })

    it('should extract JSON from markdown-wrapped response', async () => {
      const request: StructuredScriptGenerationRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1'],
        generationConfig: {
          numberOfVariations: 1 // Only test 1 variation for specific test
        }
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'test prompt',
        renderTime: 10,
        variablesUsed: [],
        missingVariables: []
      })

      const mockStructuredResponse = {
        videoStructure: {
          throughline: 'Test throughline with sufficient length',
          title: 'Test Title',
          duration: '60 seconds',
          targetAudience: 'general',
          style: 'tech_in_asia',
          energyLevel: 'medium',
          complexity: 'simple'
        },
        scriptSegments: {
          hook: {
            orderId: 1,
            segmentType: 'hook',
            voiceover: 'Test hook',
            visualDirection: 'Test visual direction',
            bRollKeywords: ['test', 'hook']
          },
          body: [
            {
              orderId: 2,
              segmentType: 'body',
              voiceover: 'Test body content',
              visualDirection: 'Body visual direction',
              bRollKeywords: ['body', 'content']
            }
          ],
          conclusion: {
            orderId: 3,
            segmentType: 'conclusion',
            voiceover: 'Test conclusion',
            visualDirection: 'Test visual end direction',
            bRollKeywords: ['conclusion', 'end']
          }
        },
        productionNotes: {
          musicVibe: 'calm',
          overallTone: 'informative'
        }
      }

      // Wrap JSON in markdown
      const markdownResponse = `Here's the structured script:
\`\`\`json
${JSON.stringify(mockStructuredResponse)}
\`\`\``

      mockLLMProvider.generateText.mockResolvedValue(markdownResponse)

      const result = await service.generateStructuredScripts(request)

      expect(result).toHaveLength(1)
      expect(result[0].videoStructure.title).toBe('Test Title')
    })

    it('should calculate quality metrics correctly', async () => {
      const request: StructuredScriptGenerationRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1'],
        generationConfig: {
          numberOfVariations: 1 // Only test 1 variation for specific test
        }
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'test prompt',
        renderTime: 10,
        variablesUsed: [],
        missingVariables: []
      })

      // High-quality response with impact words and good structure
      const highQualityResponse = {
        videoStructure: {
          throughline: 'Amazing breakthrough that defies all expectations',
          title: 'Incredible Discovery!',
          duration: '60 seconds',
          targetAudience: 'general',
          style: 'tech_in_asia',
          energyLevel: 'high',
          complexity: 'moderate'
        },
        scriptSegments: {
          hook: {
            orderId: 1,
            segmentType: 'hook',
            voiceover: 'This shocking discovery will amaze you and change everything!',
            visualDirection: 'Dramatic close-up with stunning visual effects and quick cuts',
            bRollKeywords: ['shocking', 'discovery', 'amazing']
          },
          conflict: {
            orderId: 2,
            segmentType: 'conflict',
            voiceover: 'But scientists said this was impossible',
            visualDirection: 'Expert interviews and contradicting evidence',
            bRollKeywords: ['scientists', 'impossible', 'evidence']
          },
          body: [
            {
              orderId: 3,
              segmentType: 'body',
              voiceover: 'Here\'s the incredible truth behind it all',
              visualDirection: 'Detailed animation explaining the breakthrough with clear graphics',
              bRollKeywords: ['truth', 'breakthrough', 'explanation']
            }
          ],
          conclusion: {
            orderId: 4,
            segmentType: 'conclusion',
            voiceover: 'This changes everything we thought we knew',
            visualDirection: 'Dramatic finale with future implications montage',
            bRollKeywords: ['changes', 'everything', 'future']
          }
        },
        productionNotes: {
          musicVibe: 'epic and dramatic',
          overallTone: 'mind-blowing'
        }
      }

      mockLLMProvider.generateText.mockResolvedValue(JSON.stringify(highQualityResponse))

      const result = await service.generateStructuredScripts(request)

      expect(result[0].qualityMetrics.hookEngagement).toBeGreaterThan(0.8)
      expect(result[0].qualityMetrics.narrativeFlow).toBeGreaterThan(0.8)
      expect(result[0].qualityMetrics.visualDirection).toBeGreaterThan(0.5)
      expect(result[0].qualityMetrics.overallScore).toBeGreaterThan(0.7)
    })

    it('should use default configuration when not provided', async () => {
      const request: StructuredScriptGenerationRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1']
        // No configurations provided, should use defaults
      }

      mockTemplateEngine.renderTemplate.mockResolvedValue({
        success: true,
        output: 'test prompt',
        renderTime: 10,
        variablesUsed: [],
        missingVariables: []
      })

      const mockResponse = {
        videoStructure: {
          throughline: 'Default script throughline with sufficient length',
          title: 'Default Title',
          duration: '60 seconds',
          targetAudience: 'general',
          style: 'tech_in_asia',
          energyLevel: 'medium',
          complexity: 'moderate'
        },
        scriptSegments: {
          hook: {
            orderId: 1,
            segmentType: 'hook',
            voiceover: 'Default hook',
            visualDirection: 'Default visual direction',
            bRollKeywords: ['default', 'hook']
          },
          body: [
            {
              orderId: 2,
              segmentType: 'body',
              voiceover: 'Default body content',
              visualDirection: 'Default body visual',
              bRollKeywords: ['default', 'body']
            }
          ],
          conclusion: {
            orderId: 3,
            segmentType: 'conclusion',
            voiceover: 'Default conclusion',
            visualDirection: 'Default end visual direction',
            bRollKeywords: ['default', 'end']
          }
        },
        productionNotes: {
          musicVibe: 'neutral',
          overallTone: 'informative'
        }
      }

      mockLLMProvider.generateText.mockResolvedValue(JSON.stringify(mockResponse))

      const result = await service.generateStructuredScripts(request)

      expect(result).toHaveLength(3) // Default numberOfVariations
      expect(result[0].generationMetadata.templateUsed).toBe('tech-in-asia-script-v2') // Default template
    })
  })

  describe('Performance and validation', () => {
    it('should complete parsing within reasonable time', async () => {
      const articles: Article[] = Array(5).fill(0).map((_, i) => ({
        title: `Article ${i}`,
        content: `Content for article ${i}. This is test content.`,
        url: `https://example.com/article${i}`,
        tags: [`article${i}`, 'test']
      }))

      mockLLMProvider.generateText.mockResolvedValue('- Test point')
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')

      const startTime = Date.now()
      await service.parseArticles(articles)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should validate script quality scores are within bounds', async () => {
      const request: GenerateScriptRequest = {
        jobId: 'test-job-id',
        articleIds: ['article-1']
      }

      mockConfigService.getModelConfig.mockResolvedValue({ model: 'gpt-4' })
      mockConfigService.getPromptTemplate.mockResolvedValue({ template: 'test', version: '1.0' })
      mockConfigService.renderPrompt.mockReturnValue('test')
      mockLLMProvider.generateText.mockResolvedValue('Test content')

      const result = await service.generateDrafts(request)

      expect(result[0].qualityScore).toBeGreaterThanOrEqual(0)
      expect(result[0].qualityScore).toBeLessThanOrEqual(1)
      expect(result[0].confidence).toBeGreaterThanOrEqual(0)
      expect(result[0].confidence).toBeLessThanOrEqual(1)
    })
  })
})