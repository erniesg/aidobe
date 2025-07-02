import { z } from 'zod'

export const ReplicateModelSchema = z.enum([
  'stability-ai/sdxl',
  'stability-ai/stable-diffusion',
  'lucataco/flux-dev',
  'black-forest-labs/flux-schnell',
  'minimax/video-01',
  'lightricks/ltx-video'
])

export type ReplicateModel = z.infer<typeof ReplicateModelSchema>

interface ReplicatePrediction {
  id: string
  status: string
  output?: string[] | string
  error?: string
  logs?: string
}

export class ReplicateService {
  private apiToken: string
  private baseUrl = 'https://api.replicate.com/v1'

  constructor(apiToken: string) {
    this.apiToken = apiToken
  }

  async createPrediction(model: ReplicateModel, input: Record<string, any>) {
    const [owner, name] = model.split('/')
    const modelVersions: Record<string, string> = {
      'stability-ai/sdxl': '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      'stability-ai/stable-diffusion': 'db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf',
      'lucataco/flux-dev': '019b0e0e4d44f9e40bef3123dc3339ebe7a5cf989c3877fa2c50b41e694f4c87',
      'black-forest-labs/flux-schnell': '3a50784a95ac0a29fe166683d86a689f03bbca1c0ff97e9ebc1e7f88e50f7117',
      'minimax/video-01': '755881e27dc7633e5e44e5fafcd0c0d89fb305833a3c3e17261560f9e0e21836',
      'lightricks/ltx-video': '327ad890f13443933e89797866988e74c3f487ecdc1b6f5b0dc80e07b89ac642'
    }

    const response = await fetch(`${this.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: modelVersions[model],
        input
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Replicate API error: ${error}`)
    }

    return response.json() as Promise<ReplicatePrediction>
  }

  async getPrediction(id: string): Promise<ReplicatePrediction> {
    const response = await fetch(`${this.baseUrl}/predictions/${id}`, {
      headers: {
        'Authorization': `Token ${this.apiToken}`
      }
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Replicate API error: ${error}`)
    }

    return response.json()
  }

  async waitForCompletion(id: string, maxWaitMs = 300000): Promise<ReplicatePrediction> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const prediction = await this.getPrediction(id)
      
      if (prediction.status === 'succeeded' || prediction.status === 'failed' || prediction.status === 'canceled') {
        return prediction
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    throw new Error('Prediction timeout')
  }

  getModelConfig(model: ReplicateModel): Record<string, any> {
    const configs: Record<ReplicateModel, any> = {
      'stability-ai/sdxl': {
        width: 1024,
        height: 1024,
        num_inference_steps: 25,
        guidance_scale: 7.5,
        scheduler: 'DPMSolverMultistep'
      },
      'stability-ai/stable-diffusion': {
        width: 512,
        height: 512,
        num_inference_steps: 50,
        guidance_scale: 7.5
      },
      'lucataco/flux-dev': {
        aspect_ratio: '1:1',
        num_outputs: 1,
        output_format: 'webp',
        output_quality: 80,
        guidance: 3.5,
        steps: 28
      },
      'black-forest-labs/flux-schnell': {
        aspect_ratio: '1:1',
        num_outputs: 1,
        output_format: 'webp',
        output_quality: 80,
        go_fast: true,
        megapixels: '1',
        steps: 4
      },
      'minimax/video-01': {
        prompt_optimizer: true,
        frame_rate: 25
      },
      'lightricks/ltx-video': {
        negative_prompt: 'worst quality, inconsistent motion',
        num_frames: 121,
        frame_rate: 25,
        guidance_scale: 7.5,
        num_inference_steps: 50
      }
    }
    
    return configs[model] || {}
  }
}