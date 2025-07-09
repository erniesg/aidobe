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

  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<{ success: boolean; data?: { downloadUrl: string; expiresAt: string }; error?: string }> {
    try {
      // Check if file exists
      const object = await this.outputsBucket.get(key)
      if (!object) {
        return { success: false, error: 'File not found' }
      }
      
      // For local development, we can't generate presigned URLs easily
      // In production, you'd use: await this.outputsBucket.sign(key, { expiresIn })
      // For now, return a placeholder that indicates the file exists
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      const downloadUrl = `r2://aidobe-outputs/${key}?expires=${Date.now() + expiresIn * 1000}`
      
      return {
        success: true,
        data: { downloadUrl, expiresAt }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async uploadAsset(key: string, data: ArrayBuffer, contentType: string): Promise<{ success: boolean; data?: { url: string; uploadedAt: string }; error?: string }> {
    try {
      await this.outputsBucket.put(key, data, {
        httpMetadata: {
          contentType
        }
      })
      
      return {
        success: true,
        data: {
          url: `r2://aidobe-outputs/${key}`,
          uploadedAt: new Date().toISOString()
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async deleteAsset(key: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.outputsBucket.delete(key)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async listAssets(): Promise<{ success: boolean; data?: { totalAssets: number; totalSize: number; assetTypes: { video: number; image: number; audio: number } }; error?: string }> {
    try {
      const list = await this.outputsBucket.list({ prefix: 'assets/' })
      
      let totalSize = 0
      const assetTypes = { video: 0, image: 0, audio: 0 }
      
      for (const obj of list.objects) {
        totalSize += obj.size || 0
        
        // Determine asset type from file extension
        const ext = obj.key.split('.').pop()?.toLowerCase()
        if (ext && ['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
          assetTypes.video++
        } else if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
          assetTypes.image++
        } else if (ext && ['mp3', 'wav', 'aac', 'mpeg'].includes(ext)) {
          assetTypes.audio++
        }
      }
      
      return {
        success: true,
        data: {
          totalAssets: list.objects.length,
          totalSize,
          assetTypes
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}