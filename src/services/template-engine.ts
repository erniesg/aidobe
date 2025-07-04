import type { Env } from '../types/env'

// Template variable types
export interface TemplateVariables {
  [key: string]: any
  // Common variables
  jobId?: string
  articleTitles?: string[]
  articleSummaries?: string[]
  keyPoints?: string[]
  targetDuration?: number
  style?: string
  targetAudience?: string
  customInstructions?: string
  
  // Content-specific variables
  mainTopic?: string
  conflictAngle?: string
  surprisingFacts?: string[]
  dataPoints?: Array<{value: string, context: string}>
  quotes?: Array<{text: string, source: string}>
  
  // Production variables
  visualStyle?: string
  musicVibe?: string
  energyLevel?: string
  aspectRatio?: string
}

// Template metadata
export interface TemplateMetadata {
  id: string
  name: string
  description: string
  category: string
  version: string
  author: string
  createdAt: string
  updatedAt: string
  variables: Array<{
    name: string
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    required: boolean
    description: string
    defaultValue?: any
  }>
  tags: string[]
  isActive: boolean
}

// Template structure
export interface Template {
  metadata: TemplateMetadata
  content: string // Jinja2 template content
  examples?: Array<{
    name: string
    variables: TemplateVariables
    expectedOutput?: string
  }>
}

// Template rendering result
export interface TemplateRenderResult {
  success: boolean
  output?: string
  error?: string
  renderTime: number
  variablesUsed: string[]
  missingVariables: string[]
}

export class TemplateEngine {
  private templateCache = new Map<string, Template>()
  private cacheExpiry = new Map<string, number>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private env: Env) {}

  /**
   * Render a template with variables using Jinja2-like syntax
   */
  async renderTemplate(
    templateId: string, 
    variables: TemplateVariables,
    options: {
      useCache?: boolean
      validateVariables?: boolean
      throwOnMissing?: boolean
    } = {}
  ): Promise<TemplateRenderResult> {
    const startTime = Date.now()
    
    try {
      // Load template
      const template = await this.loadTemplate(templateId, options.useCache !== false)
      
      if (!template) {
        return {
          success: false,
          error: `Template '${templateId}' not found`,
          renderTime: Date.now() - startTime,
          variablesUsed: [],
          missingVariables: []
        }
      }

      // Validate variables if requested
      if (options.validateVariables) {
        const validation = this.validateVariables(template, variables)
        if (!validation.isValid && options.throwOnMissing) {
          return {
            success: false,
            error: `Missing required variables: ${validation.missingRequired.join(', ')}`,
            renderTime: Date.now() - startTime,
            variablesUsed: [],
            missingVariables: validation.missingRequired
          }
        }
      }

      // Render template
      const result = this.processJinja2Template(template.content, variables)
      
      return {
        success: true,
        output: result.output,
        renderTime: Date.now() - startTime,
        variablesUsed: result.variablesUsed,
        missingVariables: result.missingVariables
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown rendering error',
        renderTime: Date.now() - startTime,
        variablesUsed: [],
        missingVariables: []
      }
    }
  }

  /**
   * Load template from KV storage with caching
   */
  private async loadTemplate(templateId: string, useCache: boolean = true): Promise<Template | null> {
    // Check cache first
    if (useCache && this.isTemplateCached(templateId)) {
      return this.templateCache.get(templateId) || null
    }

    try {
      // Load from KV storage
      const templateData = await this.env.KV?.get(`template:${templateId}`)
      
      if (!templateData) {
        return null
      }

      const template: Template = JSON.parse(templateData)
      
      // Cache the template
      if (useCache) {
        this.cacheTemplate(templateId, template)
      }

      return template

    } catch (error) {
      console.error(`Failed to load template ${templateId}:`, error)
      return null
    }
  }

  /**
   * Process Jinja2-like template syntax
   * This is a simplified implementation - in production, use a proper Jinja2 engine
   */
  private processJinja2Template(
    template: string, 
    variables: TemplateVariables
  ): {output: string, variablesUsed: string[], missingVariables: string[]} {
    let output = template
    const variablesUsed: string[] = []
    const missingVariables: string[] = []

    // Handle variable substitution {{ variable }}
    const variablePattern = /\{\{\s*([^}]+)\s*\}\}/g
    output = output.replace(variablePattern, (match, varPath) => {
      const trimmedPath = varPath.trim()
      const value = this.getNestedValue(variables, trimmedPath)
      
      if (value !== undefined) {
        variablesUsed.push(trimmedPath)
        return this.formatValue(value)
      } else {
        missingVariables.push(trimmedPath)
        return match // Keep original if not found
      }
    })

    // Handle simple conditionals {% if condition %}...{% endif %}
    const conditionalPattern = /\{\%\s*if\s+([^%]+)\s*\%\}(.*?)\{\%\s*endif\s*\%\}/gs
    output = output.replace(conditionalPattern, (match, condition, content) => {
      const trimmedCondition = condition.trim()
      const value = this.getNestedValue(variables, trimmedCondition)
      
      if (this.isTruthy(value)) {
        variablesUsed.push(trimmedCondition)
        return content
      } else {
        return ''
      }
    })

    // Handle simple loops {% for item in array %}...{% endfor %}
    const forPattern = /\{\%\s*for\s+(\w+)\s+in\s+([^%]+)\s*\%\}(.*?)\{\%\s*endfor\s*\%\}/gs
    output = output.replace(forPattern, (match, itemName, arrayPath, content) => {
      const array = this.getNestedValue(variables, arrayPath.trim())
      
      if (Array.isArray(array)) {
        variablesUsed.push(arrayPath.trim())
        return array.map(item => {
          // Create temporary variables for loop item
          const loopVariables = { ...variables, [itemName]: item }
          return this.processJinja2Template(content, loopVariables).output
        }).join('')
      } else {
        missingVariables.push(arrayPath.trim())
        return ''
      }
    })

    // Handle filters {{ variable | filter }}
    const filterPattern = /\{\{\s*([^|]+)\s*\|\s*([^}]+)\s*\}\}/g
    output = output.replace(filterPattern, (match, varPath, filterName) => {
      const value = this.getNestedValue(variables, varPath.trim())
      const filter = filterName.trim()
      
      if (value !== undefined) {
        variablesUsed.push(varPath.trim())
        return this.applyFilter(value, filter)
      } else {
        missingVariables.push(varPath.trim())
        return match
      }
    })

    return { output, variablesUsed, missingVariables }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
  }

  /**
   * Format value for template output
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return ''
    }
    
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    
    return String(value)
  }

  /**
   * Check if value is truthy for conditionals
   */
  private isTruthy(value: any): boolean {
    if (value === null || value === undefined || value === false) {
      return false
    }
    
    if (typeof value === 'string' && value.trim() === '') {
      return false
    }
    
    if (Array.isArray(value) && value.length === 0) {
      return false
    }
    
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return false
    }
    
    return true
  }

  /**
   * Apply simple filters
   */
  private applyFilter(value: any, filter: string): string {
    switch (filter.toLowerCase()) {
      case 'upper':
        return String(value).toUpperCase()
      case 'lower':
        return String(value).toLowerCase()
      case 'title':
        return String(value).replace(/\w\S*/g, (txt) => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        )
      case 'length':
        return String(Array.isArray(value) ? value.length : String(value).length)
      case 'first':
        return Array.isArray(value) ? String(value[0] || '') : String(value).charAt(0)
      case 'last':
        return Array.isArray(value) ? String(value[value.length - 1] || '') : String(value).slice(-1)
      case 'join':
        return Array.isArray(value) ? value.join(', ') : String(value)
      case 'trim':
        return String(value).trim()
      case 'truncate':
        const str = String(value)
        return str.length > 100 ? str.slice(0, 97) + '...' : str
      default:
        return String(value)
    }
  }

  /**
   * Validate template variables
   */
  private validateVariables(
    template: Template, 
    variables: TemplateVariables
  ): {isValid: boolean, missingRequired: string[], extraProvided: string[]} {
    const requiredVariables = template.metadata.variables
      .filter(v => v.required)
      .map(v => v.name)
    
    const providedVariables = Object.keys(variables)
    
    const missingRequired = requiredVariables.filter(
      required => !providedVariables.includes(required)
    )
    
    const extraProvided = providedVariables.filter(
      provided => !template.metadata.variables.some(v => v.name === provided)
    )

    return {
      isValid: missingRequired.length === 0,
      missingRequired,
      extraProvided
    }
  }

  /**
   * Cache management
   */
  private isTemplateCached(templateId: string): boolean {
    const cached = this.templateCache.has(templateId)
    const expiry = this.cacheExpiry.get(templateId)
    
    if (cached && expiry && Date.now() < expiry) {
      return true
    }
    
    // Clean up expired cache
    if (cached && expiry && Date.now() >= expiry) {
      this.templateCache.delete(templateId)
      this.cacheExpiry.delete(templateId)
    }
    
    return false
  }

  private cacheTemplate(templateId: string, template: Template): void {
    this.templateCache.set(templateId, template)
    this.cacheExpiry.set(templateId, Date.now() + this.CACHE_TTL)
  }

  /**
   * Store template in KV storage
   */
  async storeTemplate(template: Template): Promise<boolean> {
    try {
      await this.env.KV?.put(`template:${template.metadata.id}`, JSON.stringify(template))
      
      // Invalidate cache
      this.templateCache.delete(template.metadata.id)
      this.cacheExpiry.delete(template.metadata.id)
      
      return true
    } catch (error) {
      console.error(`Failed to store template ${template.metadata.id}:`, error)
      return false
    }
  }

  /**
   * List available templates
   */
  async listTemplates(category?: string): Promise<TemplateMetadata[]> {
    try {
      // In a real implementation, you'd use KV list operations
      // For now, return a mock list
      const templates: TemplateMetadata[] = []
      
      // This would be implemented with proper KV listing
      // const keys = await this.env.KV?.list({ prefix: 'template:' })
      
      return templates.filter(t => !category || t.category === category)
    } catch (error) {
      console.error('Failed to list templates:', error)
      return []
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      await this.env.KV?.delete(`template:${templateId}`)
      
      // Clean up cache
      this.templateCache.delete(templateId)
      this.cacheExpiry.delete(templateId)
      
      return true
    } catch (error) {
      console.error(`Failed to delete template ${templateId}:`, error)
      return false
    }
  }

  /**
   * Test template rendering with example data
   */
  async testTemplate(templateId: string, exampleIndex: number = 0): Promise<TemplateRenderResult> {
    const template = await this.loadTemplate(templateId)
    
    if (!template) {
      return {
        success: false,
        error: `Template '${templateId}' not found`,
        renderTime: 0,
        variablesUsed: [],
        missingVariables: []
      }
    }

    const example = template.examples?.[exampleIndex]
    if (!example) {
      return {
        success: false,
        error: `Example ${exampleIndex} not found for template '${templateId}'`,
        renderTime: 0,
        variablesUsed: [],
        missingVariables: []
      }
    }

    return this.renderTemplate(templateId, example.variables, { useCache: false })
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear()
    this.cacheExpiry.clear()
  }
}