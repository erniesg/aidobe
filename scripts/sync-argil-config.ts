/**
 * Script to sync Argil configuration with real API data
 * This will update the configuration files with actual voice and avatar IDs
 */

import { fetchArgilData } from './fetch-argil-config'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

// Ensure API key is set
if (!process.env.ARGIL_API_KEY) {
  console.error('❌ ARGIL_API_KEY environment variable is required')
  console.error('💡 Set it with: export ARGIL_API_KEY="your-api-key-here"')
  process.exit(1)
}

interface SyncResult {
  success: boolean
  error?: string
  data?: {
    voicesUpdated: number
    avatarsUpdated: number
  }
}

async function syncConfiguration(): Promise<SyncResult> {
  console.log('🔄 Syncing Argil configuration with real API...\n')

  try {
    // Fetch voices
    console.log('📢 Fetching voices from /v1/voices...')
    const voicesResult = await fetchArgilData('/v1/voices')

    if (!voicesResult.success) {
      return {
        success: false,
        error: `Failed to fetch voices: ${voicesResult.error}`,
      }
    }

    // Fetch avatars
    console.log('👤 Fetching avatars from /v1/avatars...')
    const avatarsResult = await fetchArgilData('/v1/avatars')

    if (!avatarsResult.success) {
      console.log('⚠️  Warning: Failed to fetch avatars:', avatarsResult.error)
    }

    // Update TypeScript configuration
    console.log('\n📝 Updating TypeScript configuration...')
    const configPath = join(process.cwd(), 'src/config/argil-config.ts')
    let configContent = readFileSync(configPath, 'utf8')

    // Build new voices array
    const voices = voicesResult.data
      .filter((voice: any) => voice.status === 'IDLE') // Only include ready voices
      .slice(0, 10) // Limit to first 10 for performance
      .map((voice: any) => ({
        id: voice.id,
        name: voice.name,
        createdAt: voice.createdAt,
        updatedAt: voice.updatedAt,
        status: voice.status,
        sampleUrl: voice.sampleUrl,
      }))

    // Replace voices in config
    const voicesString = `  voices: ${JSON.stringify(voices, null, 4).replace(/"/g, "'")},`
    configContent = configContent.replace(/voices: \[[\s\S]*?\],/, voicesString)

    // Update avatars if we have them
    if (avatarsResult.success) {
      const avatars = avatarsResult.data
        .filter((avatar: any) => avatar.status === 'IDLE')
        .slice(0, 5) // Limit to first 5
        .map((avatar: any, index: number) => ({
          id: avatar.id,
          name: avatar.name,
          defaultVoiceId: voices[index]?.id || voices[0]?.id,
          availableGestures: avatar.gestures?.map((g: any) => g.slug) || ['wave', 'point', 'nod'],
          aspectRatio: avatar.width > avatar.height ? '16:9' : '9:16',
          description: `${avatar.name} avatar`,
          status: avatar.status,
          width: avatar.width,
          height: avatar.height,
          thumbnailUrl: avatar.thumbnailUrl,
          createdAt: avatar.createdAt,
          updatedAt: avatar.updatedAt,
        }))

      if (avatars.length > 0) {
        const avatarsString = `  avatars: ${JSON.stringify(avatars, null, 4).replace(/"/g, "'")},`
        configContent = configContent.replace(/avatars: \[[\s\S]*?\],/, avatarsString)
      }
    }

    // Write updated config
    writeFileSync(configPath, configContent)
    console.log('✅ TypeScript configuration updated!')

    // Update YAML configuration
    console.log('📄 Updating YAML configuration...')
    const yamlPath = join(process.cwd(), 'src/config/argil.yaml')
    let yamlContent = readFileSync(yamlPath, 'utf8')

    // Build YAML voices section
    const voicesYaml = voices
      .map(
        (voice) => `  - id: "${voice.id}"
    name: "${voice.name}"
    status: "${voice.status}"
    createdAt: "${voice.createdAt}"
    updatedAt: "${voice.updatedAt}"${
      voice.sampleUrl
        ? `
    sampleUrl: "${voice.sampleUrl}"`
        : ''
    }`
      )
      .join('\n')

    // Replace voices in YAML
    yamlContent = yamlContent.replace(
      /voices:\s*\n[\s\S]*?(?=\n\w|\n# |\navatar)/,
      `voices:\n${voicesYaml}\n\n`
    )

    writeFileSync(yamlPath, yamlContent)
    console.log('✅ YAML configuration updated!')

    // Generate summary
    console.log('\n📊 Configuration Summary:')
    console.log(`  Voices synced: ${voices.length}`)
    console.log(`  Avatars synced: ${avatarsResult.success ? avatarsResult.data.length : 0}`)
    console.log(`  API endpoint: https://api.argil.ai`)
    console.log(`  Last sync: ${new Date().toISOString()}`)

    // Show some example voice IDs
    console.log('\n🎤 Available Voice IDs:')
    voices.slice(0, 5).forEach((voice: any) => {
      console.log(`  ${voice.name}: ${voice.id}`)
    })

    return {
      success: true,
      data: {
        voicesUpdated: voices.length,
        avatarsUpdated: avatarsResult.success ? avatarsResult.data.length : 0,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Run if called directly
if (import.meta.main || (typeof require !== 'undefined' && require.main === module)) {
  syncConfiguration()
    .then((result) => {
      if (result.success) {
        console.log('\n🎉 Configuration sync completed successfully!')
        console.log('💡 Your Argil configuration is now up-to-date with your account.')
      } else {
        console.error('\n❌ Configuration sync failed:', result.error)
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('\n💥 Sync script crashed:', error)
      process.exit(1)
    })
}

export { syncConfiguration }
