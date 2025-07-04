import type { Env } from '../types/env'
import {
  type ScriptDraft,
  type ScriptEdit,
  type FinalScript,
  type GenerateScriptRequest,
  type EditScriptRequest,
  type StructuredScript,
  type StructuredScriptGenerationRequest,
  type StructuredScriptEditRequest,
  ScriptDraftSchema,
  FinalScriptSchema,
  StructuredScriptSchema,
  extractVisualKeywords,
  calculateScriptQuality
} from '../schemas/script'
import { 
  type Article,
  type ParsedArticle,
  type VideoJob,
  type AuditLog,
  AuditLogSchema
} from '../schemas/job'
import { TemplateEngine, type TemplateVariables } from './template-engine'

interface LLMProvider {
  generateText(prompt: string, options?: any): Promise<string>
}

interface ConfigService {
  getModelConfig(context: string): Promise<any>
  getPromptTemplate(category: string, name: string): Promise<any>
  renderPrompt(template: any, variables: Record<string, any>): string
}

export class ScriptGenerationService {
  private templateEngine: TemplateEngine

  constructor(
    private env: Env,
    private llmProvider: LLMProvider,
    private configService: ConfigService
  ) {
    this.templateEngine = new TemplateEngine(env)
  }

  /**
   * Parse articles and extract key information for script generation
   */
  async parseArticles(articles: Article[]): Promise<ParsedArticle[]> {
    const parsedArticles: ParsedArticle[] = []
    
    for (const article of articles) {
      try {
        // Sanitize HTML content
        const cleanContent = this.sanitizeHTML(article.content)
        
        // Extract key points using LLM
        const keyPoints = await this.extractKeyPoints(cleanContent)
        
        // Analyze sentiment
        const sentiment = await this.analyzeSentiment(cleanContent)
        
        // Score TikTok potential
        const tiktokPotential = this.scoreTikTokPotential(cleanContent, keyPoints)
        
        const parsedArticle: ParsedArticle = {
          id: article.id || crypto.randomUUID(),
          title: article.title,
          content: cleanContent,
          url: article.url,
          keyPoints,
          sentiment,
          tiktokPotential,
          extractedAt: new Date().toISOString(),
          metadata: {
            originalLength: article.content.length,
            cleanedLength: cleanContent.length,
            keyPointCount: keyPoints.length
          }
        }
        
        parsedArticles.push(parsedArticle)
        
      } catch (error) {
        console.error(`Failed to parse article ${article.title}:`, error)
        // Continue with other articles rather than failing completely
        continue
      }
    }
    
    if (parsedArticles.length === 0) {
      throw new Error('Failed to parse any articles successfully')
    }
    
    return parsedArticles
  }

  /**
   * Generate structured scripts using wanx-inspired templates with segments, visual direction, and production notes
   */
  async generateStructuredScripts(request: StructuredScriptGenerationRequest): Promise<StructuredScript[]> {
    const scripts: StructuredScript[] = []
    const numberOfVariations = request.generationConfig?.numberOfVariations || 3
    
    // Get template ID from config or use default
    const templateId = request.generationConfig?.promptTemplate || 'tech-in-asia-script-v2'
    
    // Prepare template variables from request and articles
    const templateVariables = await this.prepareTemplateVariables(request)
    
    for (let i = 0; i < numberOfVariations; i++) {
      try {
        const script = await this.generateSingleStructuredScript(
          request, 
          templateId, 
          templateVariables, 
          i + 1
        )
        scripts.push(script)
      } catch (error) {
        console.error(`Failed to generate structured script ${i + 1}:`, error)
        // Continue with other variations
        continue
      }
    }
    
    if (scripts.length === 0) {
      throw new Error('Failed to generate any structured scripts')
    }
    
    return scripts
  }

  /**
   * Generate multiple script drafts from parsed articles (legacy method for backwards compatibility)
   */
  async generateDrafts(request: GenerateScriptRequest): Promise<ScriptDraft[]> {
    const drafts: ScriptDraft[] = []
    const numberOfDrafts = request.generationConfig?.numberOfDrafts || 3
    
    // Get model configuration
    const modelConfig = await this.configService.getModelConfig('script_generation')
    
    // Get prompt template
    const promptTemplate = await this.configService.getPromptTemplate('script_generation', 'tiktok_video')
    
    for (let i = 0; i < numberOfDrafts; i++) {
      try {
        const draft = await this.generateSingleDraft(request, promptTemplate, modelConfig, i + 1)
        drafts.push(draft)
      } catch (error) {
        console.error(`Failed to generate draft ${i + 1}:`, error)
        // Continue with other drafts
        continue
      }
    }
    
    if (drafts.length === 0) {
      throw new Error('Failed to generate any script drafts')
    }
    
    return drafts
  }

  /**
   * Edit an existing script draft
   */
  async editDraft(request: EditScriptRequest): Promise<{ draft: ScriptDraft; edit: ScriptEdit }> {
    // This would typically load the existing draft from storage
    // For now, we'll simulate this
    const existingDraft = await this.loadDraft(request.draftId)
    
    if (!existingDraft) {
      throw new Error(`Draft ${request.draftId} not found`)
    }
    
    // Apply edits
    let editedContent = existingDraft.content
    let editedTitle = existingDraft.title
    let editedHooks = [...existingDraft.hooks]
    let editedCallToAction = existingDraft.callToAction
    let editedHashtags = [...existingDraft.hashtags]
    
    for (const edit of request.edits) {
      switch (edit.field) {
        case 'content':
          editedContent = this.applyTextEdit(editedContent, edit)
          break
        case 'title':
          editedTitle = edit.value
          break
        case 'hooks':
          editedHooks = this.applyArrayEdit(editedHooks, edit)
          break
        case 'callToAction':
          editedCallToAction = edit.value
          break
        case 'hashtags':
          editedHashtags = this.applyArrayEdit(editedHashtags, edit)
          break
      }
    }
    
    // Create new version
    const updatedDraft: ScriptDraft = {
      ...existingDraft,
      version: existingDraft.version + 1,
      title: editedTitle,
      content: editedContent,
      hooks: editedHooks,
      callToAction: editedCallToAction,
      hashtags: editedHashtags,
      wordCount: editedContent.split(/\s+/).length,
      estimatedDuration: this.estimateDuration(editedContent),
      qualityScore: calculateScriptQuality({
        ...existingDraft,
        content: editedContent,
        wordCount: editedContent.split(/\s+/).length,
        hooks: editedHooks,
        callToAction: editedCallToAction,
        hashtags: editedHashtags
      }),
      updatedAt: new Date().toISOString()
    }
    
    // Create edit record
    const editRecord: ScriptEdit = {
      id: crypto.randomUUID(),
      draftId: request.draftId,
      editType: this.determineEditType(request.edits),
      changes: {
        field: request.edits[0]?.field || 'content',
        oldValue: this.getFieldValue(existingDraft, request.edits[0]?.field || 'content'),
        newValue: this.getFieldValue(updatedDraft, request.edits[0]?.field || 'content')
      },
      reason: request.reason,
      appliedAt: new Date().toISOString(),
      metadata: {}
    }
    
    return {
      draft: updatedDraft,
      edit: editRecord
    }
  }

  /**
   * Finalize a script draft for production
   */
  async finalizeDraft(draftId: string, finalizedBy?: string): Promise<FinalScript> {
    const draft = await this.loadDraft(draftId)
    
    if (!draft) {
      throw new Error(`Draft ${draftId} not found`)
    }
    
    if (draft.status !== 'reviewed') {
      throw new Error('Draft must be reviewed before finalization')
    }
    
    // Extract visual keywords for scene planning
    const visualKeywords = extractVisualKeywords(draft.content)
    
    // Generate scene breakpoints
    const sceneBreakpoints = await this.generateSceneBreakpoints(draft.content)
    
    const finalScript: FinalScript = {
      id: crypto.randomUUID(),
      jobId: draft.jobId,
      originalDraftId: draft.id,
      title: draft.title,
      content: draft.content,
      style: draft.style,
      estimatedDuration: draft.estimatedDuration,
      wordCount: draft.wordCount,
      hooks: draft.hooks,
      callToAction: draft.callToAction,
      hashtags: draft.hashtags,
      sceneBreakpoints,
      visualKeywords,
      approvalHistory: [{
        approvedBy: finalizedBy || 'system',
        approvedAt: new Date().toISOString(),
        version: draft.version,
        notes: 'Script finalized for production'
      }],
      finalizedAt: new Date().toISOString(),
      finalizedBy,
      metadata: {
        originalDraftVersion: draft.version,
        qualityScore: draft.qualityScore,
        processingTime: Date.now() // This would be calculated properly
      }
    }
    
    return finalScript
  }

  /**
   * Extract scenes from a finalized script
   */
  async extractScenes(finalScript: FinalScript): Promise<Array<{
    sequenceNumber: number
    textContent: string
    visualKeywords: string[]
    estimatedDuration: number
    sceneType: 'intro' | 'main' | 'transition' | 'conclusion'
  }>> {
    const scenes: Array<{
      sequenceNumber: number
      textContent: string
      visualKeywords: string[]
      estimatedDuration: number
      sceneType: 'intro' | 'main' | 'transition' | 'conclusion'
    }> = []
    
    // Use scene breakpoints if available
    if (finalScript.sceneBreakpoints.length > 0) {
      for (let i = 0; i < finalScript.sceneBreakpoints.length; i++) {
        const breakpoint = finalScript.sceneBreakpoints[i]
        const nextBreakpoint = finalScript.sceneBreakpoints[i + 1]
        
        const startPos = breakpoint.position
        const endPos = nextBreakpoint?.position || finalScript.content.length
        
        const sceneText = finalScript.content.slice(startPos, endPos).trim()
        const sceneKeywords = extractVisualKeywords(sceneText)
        
        scenes.push({
          sequenceNumber: i + 1,
          textContent: sceneText,
          visualKeywords: sceneKeywords.map(vk => vk.keyword),
          estimatedDuration: breakpoint.estimatedDuration || this.estimateDuration(sceneText),
          sceneType: breakpoint.sceneType
        })
      }
    } else {
      // Fallback: split by sentences/paragraphs
      const sentences = finalScript.content.split(/[.!?]+/).filter(s => s.trim().length > 0)
      const scenesPerSentence = Math.max(1, Math.floor(sentences.length / 5)) // Aim for 5 scenes
      
      for (let i = 0; i < sentences.length; i += scenesPerSentence) {
        const sceneText = sentences.slice(i, i + scenesPerSentence).join('. ') + '.'
        const sceneKeywords = extractVisualKeywords(sceneText)
        
        let sceneType: 'intro' | 'main' | 'transition' | 'conclusion' = 'main'
        if (i === 0) sceneType = 'intro'
        else if (i + scenesPerSentence >= sentences.length) sceneType = 'conclusion'
        
        scenes.push({
          sequenceNumber: Math.floor(i / scenesPerSentence) + 1,
          textContent: sceneText,
          visualKeywords: sceneKeywords.map(vk => vk.keyword),
          estimatedDuration: this.estimateDuration(sceneText),
          sceneType
        })
      }
    }
    
    return scenes
  }

  // Private helper methods

  private sanitizeHTML(content: string): string {
    // Remove HTML tags and decode entities
    return content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  private async extractKeyPoints(content: string): Promise<string[]> {
    const template = await this.configService.getPromptTemplate('content_analysis', 'key_points')
    const prompt = this.configService.renderPrompt(template, { content })
    
    const response = await this.llmProvider.generateText(prompt)
    
    // Parse response - assuming it returns bullet points
    return response
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 10) // Limit to top 10 key points
  }

  private async analyzeSentiment(content: string): Promise<'positive' | 'negative' | 'neutral'> {
    // Simple keyword-based sentiment analysis
    // In production, this would use a proper sentiment analysis model
    const positiveWords = ['great', 'amazing', 'excellent', 'wonderful', 'fantastic', 'good', 'best', 'love', 'perfect', 'incredible']
    const negativeWords = ['bad', 'terrible', 'awful', 'worst', 'hate', 'horrible', 'disaster', 'failed', 'problem', 'issues']
    
    const words = content.toLowerCase().split(/\s+/)
    const positiveCount = words.filter(word => positiveWords.includes(word)).length
    const negativeCount = words.filter(word => negativeWords.includes(word)).length
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  private scoreTikTokPotential(content: string, keyPoints: string[]): number {
    let score = 0.5 // Base score
    
    // Check for trending topics and engagement factors
    const tiktokKeywords = ['trending', 'viral', 'amazing', 'shocking', 'incredible', 'you won\'t believe']
    const hasEngagementWords = tiktokKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    )
    
    if (hasEngagementWords) score += 0.2
    
    // Check content length (TikTok favors concise content)
    const wordCount = content.split(/\s+/).length
    if (wordCount >= 50 && wordCount <= 150) score += 0.2
    else if (wordCount > 150) score -= 0.1
    
    // Check for visual potential
    const visualWords = ['show', 'see', 'look', 'watch', 'visual', 'image', 'video']
    const hasVisualPotential = visualWords.some(word => 
      content.toLowerCase().includes(word)
    )
    
    if (hasVisualPotential) score += 0.1
    
    return Math.min(1, Math.max(0, score))
  }

  private async generateSingleDraft(
    request: GenerateScriptRequest,
    promptTemplate: any,
    modelConfig: any,
    draftNumber: number
  ): Promise<ScriptDraft> {
    const startTime = Date.now()
    
    // Render prompt with variables
    const prompt = this.configService.renderPrompt(promptTemplate, {
      jobId: request.jobId,
      targetDuration: request.preferences?.targetDuration || 60,
      style: request.preferences?.style || 'informative',
      customInstructions: request.preferences?.customInstructions || '',
      draftNumber
    })
    
    // Generate script content
    const response = await this.llmProvider.generateText(prompt, {
      temperature: request.generationConfig?.temperature || 0.7
    })
    
    // Parse the response to extract components
    const parsed = this.parseScriptResponse(response)
    
    const estimatedDuration = this.estimateDuration(parsed.content)
    const wordCount = parsed.content.split(/\s+/).length
    
    const draft: ScriptDraft = {
      id: crypto.randomUUID(),
      jobId: request.jobId,
      version: 1,
      title: parsed.title,
      content: parsed.content,
      style: request.preferences?.style || 'informative',
      estimatedDuration,
      wordCount,
      hooks: parsed.hooks,
      callToAction: parsed.callToAction,
      hashtags: parsed.hashtags,
      metadata: {
        modelUsed: modelConfig.model || 'unknown',
        promptVersion: promptTemplate.version || '1.0',
        temperature: request.generationConfig?.temperature || 0.7,
        generationTime: Date.now() - startTime,
        sourceArticleIds: request.articleIds
      },
      status: 'draft',
      confidence: this.calculateConfidence(parsed, request),
      qualityScore: calculateScriptQuality({
        id: '',
        jobId: request.jobId,
        version: 1,
        title: parsed.title,
        content: parsed.content,
        style: request.preferences?.style || 'informative',
        estimatedDuration,
        wordCount,
        hooks: parsed.hooks,
        callToAction: parsed.callToAction,
        hashtags: parsed.hashtags,
        metadata: {
        modelUsed: modelConfig?.model || 'gpt-4',
        promptVersion: promptTemplate?.version || '1.0',
        sourceArticleIds: request.articleIds || [],
        generationTime: Date.now() - startTime,
        temperature: modelConfig?.temperature
      },
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    return draft
  }

  private parseScriptResponse(response: string): {
    title: string
    content: string
    hooks: string[]
    callToAction?: string
    hashtags: string[]
  } {
    // Simple parsing - in production, use more robust structured output
    const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0)
    
    let title = ''
    let content = ''
    let hooks: string[] = []
    let callToAction: string | undefined
    let hashtags: string[] = []
    
    let currentSection = 'content'
    let contentLines: string[] = []
    
    for (const line of lines) {
      if (line.toLowerCase().startsWith('title:')) {
        title = line.substring(6).trim()
        currentSection = 'title'
      } else if (line.toLowerCase().startsWith('hooks:')) {
        currentSection = 'hooks'
      } else if (line.toLowerCase().startsWith('cta:') || line.toLowerCase().startsWith('call to action:')) {
        const colonIndex = line.indexOf(':')
        if (colonIndex !== -1) {
          callToAction = line.substring(colonIndex + 1).trim()
        }
        currentSection = 'cta'
      } else if (line.toLowerCase().startsWith('hashtags:')) {
        currentSection = 'hashtags'
        // Also parse hashtags on the same line
        const hashtagsAfterColon = line.substring(line.indexOf(':') + 1).trim()
        if (hashtagsAfterColon) {
          const lineHashtags = hashtagsAfterColon.split(/\s+/).filter(tag => tag.startsWith('#'))
          hashtags.push(...lineHashtags)
        }
      } else if (line.startsWith('#')) {
        hashtags.push(line)
      } else if (currentSection === 'hashtags' && line.includes('#')) {
        // Parse hashtags from a line that contains them
        const lineHashtags = line.split(/\s+/).filter(tag => tag.startsWith('#'))
        hashtags.push(...lineHashtags)
      } else if (line.startsWith('-') && currentSection === 'hooks') {
        hooks.push(line.substring(1).trim())
      } else if (currentSection === 'content' || (currentSection === 'title' && !line.toLowerCase().includes(':'))) {
        contentLines.push(line)
      }
    }
    
    // Join content lines
    content = contentLines.join(' ').trim()
    
    return {
      title: title || 'Generated TikTok Script',
      content: content || response.trim(),
      hooks,
      callToAction,
      hashtags
    }
  }

  private estimateDuration(content: string): number {
    const wordCount = content.split(/\s+/).length
    const wordsPerSecond = 2.5 // Average speaking rate for TikTok
    return Math.round(wordCount / wordsPerSecond)
  }

  private calculateConfidence(parsed: any, request: GenerateScriptRequest): number {
    let confidence = 0.7 // Base confidence
    
    // Higher confidence for longer, structured content
    if (parsed.content.length > 100) confidence += 0.1
    if (parsed.hooks.length > 0) confidence += 0.1
    if (parsed.callToAction) confidence += 0.05
    if (parsed.hashtags.length >= 3) confidence += 0.05
    
    return Math.min(1, confidence)
  }

  private async generateSceneBreakpoints(content: string): Promise<FinalScript['sceneBreakpoints']> {
    // Simple sentence-based breakpoint generation
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [content]
    const breakpoints: FinalScript['sceneBreakpoints'] = []
    
    let position = 0
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i]
      
      let sceneType: 'intro' | 'main' | 'transition' | 'conclusion' = 'main'
      if (i === 0) sceneType = 'intro'
      else if (i === sentences.length - 1) sceneType = 'conclusion'
      
      breakpoints.push({
        position,
        sceneType,
        estimatedDuration: this.estimateDuration(sentence)
      })
      
      position += sentence.length
    }
    
    return breakpoints
  }

  // Mock methods that would typically interface with storage
  private async loadDraft(draftId: string): Promise<ScriptDraft | null> {
    // This would load from database/storage
    // For now, return null to simulate not found
    return null
  }

  private applyTextEdit(text: string, edit: EditScriptRequest['edits'][0]): string {
    switch (edit.action) {
      case 'replace':
        return edit.value
      case 'insert': {
        const pos = edit.position || 0
        return text.slice(0, pos) + edit.value + text.slice(pos)
      }
      case 'delete': {
        const start = edit.position || 0
        const end = start + (edit.length || 0)
        return text.slice(0, start) + text.slice(end)
      }
      case 'append':
        return text + edit.value
      case 'prepend':
        return edit.value + text
      default:
        return text
    }
  }

  private applyArrayEdit(array: string[], edit: EditScriptRequest['edits'][0]): string[] {
    switch (edit.action) {
      case 'replace':
        return [edit.value]
      case 'append':
        return [...array, edit.value]
      case 'prepend':
        return [edit.value, ...array]
      default:
        return array
    }
  }

  private determineEditType(edits: EditScriptRequest['edits']): ScriptEdit['editType'] {
    if (edits.some(e => e.field === 'content')) return 'content_change'
    if (edits.some(e => e.field === 'title')) return 'title_change'
    if (edits.some(e => e.field === 'hooks')) return 'hooks_modification'
    if (edits.some(e => e.field === 'callToAction')) return 'cta_update'
    if (edits.some(e => e.field === 'hashtags')) return 'hashtag_update'
    return 'content_change'
  }

  private getFieldValue(draft: ScriptDraft, field: string): any {
    switch (field) {
      case 'title': return draft.title
      case 'content': return draft.content
      case 'hooks': return draft.hooks
      case 'callToAction': return draft.callToAction
      case 'hashtags': return draft.hashtags
      default: return draft.content
    }
  }

  /**
   * Prepare template variables for structured script generation
   */
  private async prepareTemplateVariables(request: StructuredScriptGenerationRequest): Promise<TemplateVariables> {
    // This would typically load articles by IDs from storage
    // For now, we'll create mock data based on the request
    const variables: TemplateVariables = {
      jobId: request.jobId,
      articleTitles: ['Mock Article Title'], // Would load real titles
      keyPoints: ['Mock key point 1', 'Mock key point 2'], // Would load real key points
      targetDuration: request.contentPreferences?.targetDuration || 60,
      style: request.contentPreferences?.style || 'tech_in_asia',
      targetAudience: request.contentPreferences?.targetAudience || 'tech enthusiasts',
      energyLevel: request.contentPreferences?.energyLevel || 'high',
      includeConflict: request.contentPreferences?.includeConflict !== false,
      visualStyle: request.productionPreferences?.visualStyle || 'modern',
      musicVibe: request.productionPreferences?.musicVibe || 'upbeat electronic',
      customInstructions: request.generationConfig?.customInstructions
    }
    
    return variables
  }

  /**
   * Generate a single structured script with wanx-inspired segments
   */
  private async generateSingleStructuredScript(
    request: StructuredScriptGenerationRequest,
    templateId: string,
    variables: TemplateVariables,
    variationNumber: number
  ): Promise<StructuredScript> {
    const startTime = Date.now()
    
    try {
      // Render the Jinja2 template with variables
      const renderResult = await this.templateEngine.renderTemplate(templateId, variables, {
        validateVariables: true,
        throwOnMissing: false
      })
      
      if (!renderResult.success || !renderResult.output) {
        throw new Error(`Template rendering failed: ${renderResult.error}`)
      }
      
      // Generate structured content using LLM with the rendered prompt
      const response = await this.llmProvider.generateText(renderResult.output, {
        temperature: request.generationConfig?.temperature || 0.8,
        // Add structured output configuration here if your LLM provider supports it
        response_format: { type: 'json_object' }
      })
      
      // Parse the structured JSON response
      const structuredResponse = this.parseStructuredResponse(response)
      
      // Create the structured script object
      const script: StructuredScript = {
        id: crypto.randomUUID(),
        jobId: request.jobId,
        version: variationNumber,
        videoStructure: structuredResponse.videoStructure,
        scriptSegments: structuredResponse.scriptSegments,
        productionNotes: structuredResponse.productionNotes,
        qualityMetrics: this.calculateQualityMetrics(structuredResponse),
        generationMetadata: {
          modelUsed: request.generationConfig?.model || 'gpt-4',
          promptVersion: 'v2.0',
          templateUsed: templateId,
          generationTime: Date.now() - startTime,
          sourceArticleIds: request.articleIds,
          enhancementFlags: request.generationConfig?.enhancementFlags || []
        },
        status: 'generated',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      return script
      
    } catch (error) {
      console.error(`Structured script generation failed for variation ${variationNumber}:`, error)
      throw error
    }
  }

  /**
   * Parse structured JSON response from LLM
   */
  private parseStructuredResponse(response: string): any {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response)
      
      // Validate the structure matches our expected schema
      return StructuredScriptSchema.omit({ 
        id: true, 
        jobId: true, 
        version: true, 
        generationMetadata: true, 
        status: true, 
        createdAt: true, 
        updatedAt: true 
      }).parse(parsed)
      
    } catch (parseError) {
      console.error('Failed to parse structured response:', parseError)
      console.error('Response was:', response)
      
      // Fallback: try to extract JSON from text if it's wrapped in markdown or other text
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return StructuredScriptSchema.omit({ 
            id: true, 
            jobId: true, 
            version: true, 
            generationMetadata: true, 
            status: true, 
            createdAt: true, 
            updatedAt: true 
          }).parse(parsed)
        } catch (retryError) {
          console.error('Retry parse also failed:', retryError)
        }
      }
      
      throw new Error(`Failed to parse structured response: ${parseError}`)
    }
  }

  /**
   * Calculate quality metrics for a structured script
   */
  private calculateQualityMetrics(structuredResponse: any): any {
    const metrics: any = {}
    
    // Hook engagement score based on length and impact words
    if (structuredResponse.scriptSegments?.hook?.voiceover) {
      const hookText = structuredResponse.scriptSegments.hook.voiceover
      const impactWords = ['amazing', 'shocking', 'incredible', 'unbelievable', 'secret', 'truth']
      const hasImpact = impactWords.some(word => hookText.toLowerCase().includes(word))
      const lengthScore = hookText.length >= 15 && hookText.length <= 100 ? 1 : 0.5
      metrics.hookEngagement = hasImpact ? Math.min(1, lengthScore + 0.3) : lengthScore
    }
    
    // Narrative flow based on segment coherence
    const segments = structuredResponse.scriptSegments
    if (segments?.hook && segments?.conclusion) {
      metrics.narrativeFlow = 0.8 // Basic score for having key segments
      if (segments.conflict) metrics.narrativeFlow += 0.1
      if (segments.body?.length > 0) metrics.narrativeFlow += 0.1
    }
    
    // Visual direction quality based on specificity
    let visualScore = 0
    const allSegments = [segments?.hook, segments?.conflict, ...segments?.body || [], segments?.conclusion].filter(Boolean)
    for (const segment of allSegments) {
      if (segment?.visualDirection && segment.visualDirection.length > 20) {
        visualScore += 0.25
      }
    }
    metrics.visualDirection = Math.min(1, visualScore)
    
    // Overall score as average
    const scores = Object.values(metrics).filter(score => typeof score === 'number') as number[]
    metrics.overallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5
    
    return metrics
  }
}