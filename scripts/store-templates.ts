#!/usr/bin/env tsx

/**
 * Script to store prompt templates in Cloudflare KV storage for the aidobe project.
 * This allows runtime configuration of prompts without deployment.
 * 
 * Usage:
 *   npm run store-templates
 *   # or for specific environment:
 *   npx wrangler kv:key put --env production "template:tech-in-asia-script-v2" --path config/prompt-templates/tech-in-asia-script.json
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const TEMPLATES_DIR = join(__dirname, '..', 'config', 'prompt-templates')
const KV_PREFIX = 'template:'

interface Template {
  metadata: {
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
      type: string
      required: boolean
      description: string
      defaultValue?: any
    }>
    tags: string[]
    isActive: boolean
  }
  content: string
  examples?: any[]
}

async function storeTemplate(templatePath: string, environment: string = 'development') {
  try {
    console.log(`📖 Reading template from ${templatePath}`)
    
    const templateContent = readFileSync(templatePath, 'utf-8')
    const template: Template = JSON.parse(templateContent)
    
    const templateId = template.metadata.id
    const kvKey = `${KV_PREFIX}${templateId}`
    
    console.log(`🔑 Storing template with ID: ${templateId}`)
    console.log(`📋 Template name: ${template.metadata.name}`)
    console.log(`🏷️  Template version: ${template.metadata.version}`)
    console.log(`🎯 Environment: ${environment}`)
    
    // For development, we'll just validate the template structure
    if (environment === 'development' || environment === 'validate') {
      console.log('✅ Template structure is valid')
      console.log('🧪 Variables defined:', template.metadata.variables.map(v => v.name).join(', '))
      console.log('📊 Examples available:', template.examples?.length || 0)
      
      if (environment === 'validate') {
        return
      }
    }
    
    // Store in KV using wrangler CLI
    const command = [
      'npx wrangler kv:key put',
      `--env ${environment}`,
      `"${kvKey}"`,
      `--path "${templatePath}"`
    ].join(' ')
    
    console.log(`⚡ Command to run:\n${command}`)
    console.log('\n💡 To store this template, run the command above')
    
  } catch (error) {
    console.error(`❌ Failed to process template ${templatePath}:`, error)
    process.exit(1)
  }
}

async function storeAllTemplates(environment: string = 'development') {
  console.log(`🚀 Storing all templates for ${environment} environment\n`)
  
  try {
    const templateFiles = readdirSync(TEMPLATES_DIR).filter(file => file.endsWith('.json'))
    
    if (templateFiles.length === 0) {
      console.log('⚠️  No template files found in', TEMPLATES_DIR)
      return
    }
    
    console.log(`📁 Found ${templateFiles.length} template files:\n`)
    
    for (const file of templateFiles) {
      const templatePath = join(TEMPLATES_DIR, file)
      await storeTemplate(templatePath, environment)
      console.log('') // Empty line for separation
    }
    
    console.log('✨ Template processing complete!')
    
  } catch (error) {
    console.error('❌ Failed to store templates:', error)
    process.exit(1)
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const environment = args[0] || 'development'
  const templatePath = args[1]
  
  console.log('🎨 Aidobe Template Storage Tool\n')
  
  if (templatePath) {
    // Store specific template
    await storeTemplate(templatePath, environment)
  } else {
    // Store all templates
    await storeAllTemplates(environment)
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { storeTemplate, storeAllTemplates }