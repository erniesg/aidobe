export class StorageService {
  private outputsBucket: R2Bucket
  private promptsBucket: R2Bucket

  constructor(outputsBucket: R2Bucket, promptsBucket: R2Bucket) {
    this.outputsBucket = outputsBucket
    this.promptsBucket = promptsBucket
  }

  async uploadImage(key: string, data: ArrayBuffer): Promise<string> {
    await this.outputsBucket.put(key, data, {
      httpMetadata: {
        contentType: key.endsWith('.png') ? 'image/png' : 'image/webp'
      }
    })
    // Return the R2 key for now - we'll generate presigned URLs when requested
    return key
  }

  async uploadVideo(key: string, data: ArrayBuffer): Promise<string> {
    await this.outputsBucket.put(key, data, {
      httpMetadata: {
        contentType: 'video/mp4'
      }
    })
    // Return the R2 key for now - we'll generate presigned URLs when requested
    return key
  }

  async savePromptData(key: string, data: any): Promise<void> {
    await this.promptsBucket.put(key, JSON.stringify(data, null, 2), {
      httpMetadata: {
        contentType: 'application/json'
      }
    })
  }

  async getPromptData(key: string): Promise<any> {
    const object = await this.promptsBucket.get(key)
    if (!object) return null
    
    const text = await object.text()
    return JSON.parse(text)
  }

  async listOutputs(prefix: string): Promise<string[]> {
    const list = await this.outputsBucket.list({ prefix })
    return list.objects.map(obj => obj.key)
  }

  async deleteOutput(key: string): Promise<void> {
    await this.outputsBucket.delete(key)
  }

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // Check if file exists
    const object = await this.outputsBucket.get(key)
    if (!object) throw new Error('File not found')
    
    // For local development, we can't generate presigned URLs easily
    // In production, you'd use: await this.outputsBucket.sign(key, { expiresIn })
    // For now, return a placeholder that indicates the file exists
    return `r2://aidobe-outputs/${key}?expires=${Date.now() + expiresIn * 1000}`
  }
}