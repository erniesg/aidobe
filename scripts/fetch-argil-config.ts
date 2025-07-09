/**
 * Script to fetch actual voice and avatar configurations from Argil API
 * Run this to see what the real API structure looks like
 */

const ARGIL_API_KEY = process.env.ARGIL_API_KEY || ''
const ARGIL_BASE_URL = 'https://api.argil.ai'

if (!ARGIL_API_KEY) {
  console.error('❌ ARGIL_API_KEY environment variable is required')
  console.error('💡 Set it with: export ARGIL_API_KEY="your-api-key-here"')
  process.exit(1)
}

interface ApiResponse {
  success: boolean
  data?: any
  error?: string
}

async function fetchArgilData(
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<ApiResponse> {
  try {
    console.log(`Fetching ${method} ${endpoint}...`)

    const response = await fetch(`${ARGIL_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'x-api-key': ARGIL_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'aidobe-config-fetcher/1.0',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    console.log(`Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
      }
    }

    const data = await response.json()
    return {
      success: true,
      data,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function createTestVideo(): Promise<ApiResponse> {
  const testVideoPayload = {
    name: 'Test Configuration Video',
    moments: [
      {
        transcript: 'Hello, this is a test video to understand the API structure.',
        avatarId: 'test-avatar', // This will likely fail, but may show us valid avatar IDs
        voiceId: 'test-voice', // This will likely fail, but may show us valid voice IDs
      },
    ],
    aspectRatio: '16:9',
  }

  // Try different video creation endpoints
  const videoPaths = ['/videos', '/v1/videos', '/api/videos', '/api/v1/videos']

  for (const path of videoPaths) {
    const result = await fetchArgilData(path, 'POST', testVideoPayload)
    if (
      result.success ||
      (result.error && result.error.includes('avatar')) ||
      result.error.includes('voice')
    ) {
      console.log(`Video endpoint found: ${path}`)
      return result
    }
  }

  return {
    success: false,
    error: 'No working video endpoints found',
  }
}

async function main() {
  console.log('🔍 Fetching Argil API configuration...\n')

  // Try different endpoint variations
  const endpointsToTry = [
    { name: 'voices', paths: ['/voices', '/v1/voices', '/api/voices', '/api/v1/voices'] },
    { name: 'avatars', paths: ['/avatars', '/v1/avatars', '/api/avatars', '/api/v1/avatars'] },
    { name: 'videos', paths: ['/videos', '/v1/videos', '/api/videos', '/api/v1/videos'] },
  ]

  const workingEndpoints: Record<string, string> = {}

  for (const endpoint of endpointsToTry) {
    console.log(`\n🔍 Testing ${endpoint.name} endpoints...`)

    for (const path of endpoint.paths) {
      const result = await fetchArgilData(path)

      if (result.success) {
        console.log(`✅ Success with ${path}:`)
        console.log(JSON.stringify(result.data, null, 2))

        workingEndpoints[endpoint.name] = path

        // If it's an array, show structure of first item
        if (Array.isArray(result.data) && result.data.length > 0) {
          console.log(`\n📋 ${endpoint.name} object structure (first item):`)
          const firstItem = result.data[0]
          Object.keys(firstItem).forEach((key) => {
            console.log(
              `  ${key}: ${typeof firstItem[key]} ${Array.isArray(firstItem[key]) ? '(array)' : ''}`
            )
          })
        }
        break // Found working endpoint, move to next
      } else {
        console.log(`❌ ${path}: ${result.error?.substring(0, 100)}...`)
      }
    }
  }

  console.log('\n' + '='.repeat(50) + '\n')

  // Test creating a simple video to see the API structure and error messages
  console.log('🎬 Testing video creation endpoint to understand required fields...')
  const videoResult = await createTestVideo()

  if (videoResult.success) {
    console.log('✅ Video creation test successful:')
    console.log(JSON.stringify(videoResult.data, null, 2))
  } else {
    console.log('❌ Video creation failed (expected, but may show valid IDs):')
    console.log(videoResult.error)
  }

  console.log('\n🎯 Summary:')
  console.log('Working endpoints found:')
  Object.entries(workingEndpoints).forEach(([name, path]) => {
    console.log(`  ${name}: ${path}`)
  })

  console.log('\n💡 Next steps:')
  console.log(
    '1. Update the configuration files with real voice and avatar IDs from the working endpoints'
  )
  console.log('2. Use the object structures shown above to create proper TypeScript interfaces')
  console.log('3. Test the video creation endpoint with valid avatar and voice IDs')
}

// Run if called directly
if (import.meta.main || (typeof require !== 'undefined' && require.main === module)) {
  main().catch(console.error)
}

export { fetchArgilData }
