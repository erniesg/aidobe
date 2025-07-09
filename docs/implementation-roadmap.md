# Aidobe Implementation Roadmap

## Priority Implementation Order

Based on the wanx architecture analysis and current aidobe state, here's the recommended implementation order for maximum impact:

### Phase 1: Core Avatar Integration (Week 1-2)
**Priority: Critical - Enables differentiated video generation**

#### 1.1 Avatar Service Foundation
- **File**: `src/services/avatar-generation.ts`
- **Dependencies**: Argil SDK, HeyGen SDK
- **Handlers**: `src/handlers/avatars.ts`

```typescript
// New service for avatar integration
class AvatarGenerationService {
  async generateArgilVideo(request: ArgilVideoRequest): Promise<ServiceResponse<ArgilVideoResult>>
  async generateHeyGenVideo(request: HeyGenVideoRequest): Promise<ServiceResponse<HeyGenVideoResult>>
  async listAvailableAvatars(provider?: string): Promise<ServiceResponse<Avatar[]>>
  async getAvatarCapabilities(avatarId: string): Promise<ServiceResponse<AvatarCapabilities>>
}
```

#### 1.2 Avatar API Endpoints
```typescript
// src/handlers/avatars.ts
POST /api/avatars/generate-argil
POST /api/avatars/generate-heygen  
GET /api/avatars/list-available
GET /api/avatars/{avatarId}/capabilities
POST /api/avatars/{avatarId}/test-voice
```

#### 1.3 Webhook Integration
```typescript
// src/handlers/webhooks.ts
POST /webhooks/argil
POST /webhooks/heygen
// Handle completion callbacks from avatar providers
```

### Phase 2: Enhanced Asset Orchestration (Week 2-3)
**Priority: High - Improves asset quality and selection**

#### 2.1 Advanced Asset Services
```typescript
// src/services/asset-orchestration.ts
class AssetOrchestrationService {
  async planAssetStrategy(scenes: Scene[]): Promise<ServiceResponse<AssetPlan>>
  async executeAssetPlan(plan: AssetPlan): Promise<ServiceResponse<AssetResults>>
  async evaluateAssetQuality(assets: Asset[], context: SceneContext): Promise<ServiceResponse<EvaluationResults>>
  async selectOptimalAsset(candidates: Asset[], criteria: SelectionCriteria): Promise<ServiceResponse<Asset>>
}
```

#### 2.2 Multi-Provider Asset Search
```typescript
POST /api/orchestration/plan-assets
POST /api/orchestration/execute-plan
POST /api/orchestration/evaluate-batch
PUT /api/orchestration/override-selection
```

#### 2.3 Asset Resolution Pipeline
```typescript
// Handles user uploads, stock searches, AI generation fallbacks
class AssetResolver {
  async resolveUserAssets(instructions: string[]): Promise<AssetMapping>
  async resolveStockAssets(queries: string[]): Promise<AssetMapping>
  async resolveWithAIGeneration(failed: string[]): Promise<AssetMapping>
}
```

### Phase 3: Advanced Video Effects (Week 3-4)
**Priority: High - Adds professional video quality**

#### 3.1 Ken Burns Effect Engine
```typescript
// src/services/effects/ken-burns.ts
class KenBurnsService {
  async applyKenBurnsEffect(input: EffectInput): Promise<ServiceResponse<EffectResult>>
  async generateEffectPreview(input: EffectInput): Promise<ServiceResponse<string[]>>
  async batchApplyEffects(inputs: EffectInput[]): Promise<ServiceResponse<EffectResult[]>>
}
```

#### 3.2 3D Depth Effects
```typescript
// src/services/effects/depth-effects.ts  
class DepthEffectsService {
  async estimateDepth(imageUrl: string): Promise<ServiceResponse<DepthMap>>
  async apply3DEffect(image: string, depthMap: DepthMap): Promise<ServiceResponse<string>>
  async createParallaxVideo(image: string, settings: ParallaxSettings): Promise<ServiceResponse<string>>
}
```

#### 3.3 Background Enhancement
```typescript
// src/services/effects/background-effects.ts
class BackgroundEffectsService {
  async applyBackgroundBlur(input: MediaInput): Promise<ServiceResponse<string>>
  async forceVerticalAspect(input: MediaInput): Promise<ServiceResponse<string>>
  async addBackgroundFill(input: MediaInput, color: string): Promise<ServiceResponse<string>>
}
```

#### 3.4 Effects API Endpoints
```typescript
POST /api/effects/ken-burns
POST /api/effects/3d-depth  
POST /api/effects/background-blur
POST /api/effects/batch-apply
GET /api/effects/preview/{effectId}
```

### Phase 4: Transcript Processing (Week 4-5)
**Priority: Medium - Enables precise timing control**

#### 4.1 Transcript Segmentation
```typescript
// src/services/transcript-processing.ts
class TranscriptProcessingService {
  async splitIntoSegments(transcript: Transcript, strategy: SplitStrategy): Promise<ServiceResponse<TranscriptSegment[]>>
  async alignWithScenes(segments: TranscriptSegment[], scenes: Scene[]): Promise<ServiceResponse<AlignmentResult>>
  async generateWordTimings(audioUrl: string, text: string): Promise<ServiceResponse<WordTiming[]>>
  async validateTimingAccuracy(timings: WordTiming[], audioUrl: string): Promise<ServiceResponse<ValidationResult>>
}
```

#### 4.2 Timing API Endpoints
```typescript
POST /api/transcripts/split-segments
POST /api/transcripts/align-with-scenes
POST /api/transcripts/generate-timings
POST /api/transcripts/validate-timings
PUT /api/transcripts/adjust-timing
```

### Phase 5: REGEN Workflow (Week 5-6)
**Priority: Medium - Enables video iteration**

#### 5.1 Asset Guide Parser
```typescript
// src/services/regen/guide-parser.ts
class AssetGuideParser {
  async parseGuideText(guideText: string): Promise<ServiceResponse<ParsedGuide>>
  async extractOverlays(guide: ParsedGuide): Promise<ServiceResponse<Overlay[]>>
  async validateGuideStructure(guide: ParsedGuide): Promise<ServiceResponse<ValidationResult>>
  async generateScriptFromOverlays(overlays: Overlay[]): Promise<ServiceResponse<RegeneratedScript>>
}
```

#### 5.2 Asset Resolution Engine
```typescript
// src/services/regen/asset-resolver.ts
class RegenAssetResolver {
  async resolveAssetInstructions(instructions: AssetInstruction[]): Promise<ServiceResponse<ResolvedAssets>>
  async downloadUserAssets(userAssets: UserAsset[]): Promise<ServiceResponse<LocalAssetMapping>>
  async searchStockAlternatives(failed: FailedAsset[]): Promise<ServiceResponse<AlternativeAssets>>
}
```

#### 5.3 REGEN API Endpoints
```typescript
POST /api/regen/parse-guide
POST /api/regen/resolve-assets  
POST /api/regen/generate-script
POST /api/regen/execute-regeneration
GET /api/regen/status/{regenId}
```

### Phase 6: Workflow Templates (Week 6-7)
**Priority: Low - Improves user experience**

#### 6.1 Template Engine
```typescript
// src/services/workflow-templates.ts
class WorkflowTemplateService {
  async createTemplate(template: WorkflowTemplate): Promise<ServiceResponse<string>>
  async executeTemplate(templateId: string, inputs: TemplateInputs): Promise<ServiceResponse<WorkflowExecution>>
  async listTemplates(category?: string): Promise<ServiceResponse<WorkflowTemplate[]>>
  async cloneTemplate(templateId: string, modifications: any): Promise<ServiceResponse<string>>
}
```

#### 6.2 Template API Endpoints
```typescript
POST /api/workflows/create-template
POST /api/workflows/execute
GET /api/workflows/templates
PUT /api/workflows/templates/{id}
DELETE /api/workflows/templates/{id}
GET /api/workflows/executions/{id}
POST /api/workflows/executions/{id}/cancel
```

### Phase 7: Analytics & Monitoring (Week 7-8)
**Priority: Low - Operational excellence**

#### 7.1 Analytics Service
```typescript
// src/services/analytics.ts
class AnalyticsService {
  async trackGenerationMetrics(jobId: string, metrics: GenerationMetrics): Promise<void>
  async getPerformanceMetrics(timeRange: TimeRange): Promise<ServiceResponse<PerformanceData>>
  async getProviderMetrics(provider: string): Promise<ServiceResponse<ProviderMetrics>>
  async getCostAnalysis(timeRange: TimeRange): Promise<ServiceResponse<CostData>>
}
```

#### 7.2 Analytics Endpoints
```typescript
POST /api/analytics/track-generation
GET /api/analytics/performance
GET /api/analytics/providers
GET /api/analytics/costs
GET /api/analytics/usage-trends
```

## Implementation Details

### Database Schema Extensions

#### Jobs Table (Existing - Extend)
```sql
ALTER TABLE jobs ADD COLUMN workflow_type TEXT;
ALTER TABLE jobs ADD COLUMN avatar_provider TEXT;
ALTER TABLE jobs ADD COLUMN effect_settings JSONB;
ALTER TABLE jobs ADD COLUMN regen_source_job_id TEXT;
```

#### New Tables Needed
```sql
-- Avatar jobs tracking
CREATE TABLE avatar_jobs (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  provider TEXT NOT NULL, -- 'argil' | 'heygen'
  avatar_id TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  external_job_id TEXT,
  status TEXT NOT NULL,
  result_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Effect applications tracking  
CREATE TABLE effect_applications (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  scene_id TEXT NOT NULL,
  effect_type TEXT NOT NULL,
  effect_settings JSONB NOT NULL,
  input_asset_url TEXT NOT NULL,
  output_asset_url TEXT,
  status TEXT NOT NULL,
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Asset orchestration tracking
CREATE TABLE asset_orchestrations (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES jobs(id),
  scene_id TEXT NOT NULL,
  search_query TEXT NOT NULL,
  provider_attempts JSONB NOT NULL, -- Track which providers were tried
  selected_asset_url TEXT,
  selection_confidence REAL,
  fallback_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REGEN workflow tracking
CREATE TABLE regen_workflows (
  id TEXT PRIMARY KEY,
  source_job_id TEXT REFERENCES jobs(id),
  asset_guide_text TEXT NOT NULL,
  parsed_overlays JSONB NOT NULL,
  resolved_assets JSONB NOT NULL,
  status TEXT NOT NULL,
  output_job_id TEXT REFERENCES jobs(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflow templates
CREATE TABLE workflow_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  workflow_type TEXT NOT NULL,
  template_config JSONB NOT NULL,
  default_settings JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template executions
CREATE TABLE template_executions (
  id TEXT PRIMARY KEY,
  template_id TEXT REFERENCES workflow_templates(id),
  job_id TEXT REFERENCES jobs(id),
  input_parameters JSONB NOT NULL,
  execution_status TEXT NOT NULL,
  current_step TEXT,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

### External Service Integrations

#### Argil Integration
```typescript
// src/integrations/argil-client.ts
class ArgilClient {
  async createVideoJob(request: ArgilVideoRequest): Promise<ArgilJobResponse>
  async renderVideo(videoId: string): Promise<ArgilRenderResponse>
  async getJobStatus(jobId: string): Promise<ArgilStatusResponse>
  async listAvatars(): Promise<ArgilAvatar[]}
  async getAvatar(avatarId: string): Promise<ArgilAvatar>
}
```

#### HeyGen Integration
```typescript
// src/integrations/heygen-client.ts
class HeyGenClient {
  async createVideoGeneration(request: HeyGenRequest): Promise<HeyGenResponse>
  async getGenerationStatus(id: string): Promise<HeyGenStatus>
  async listAvatars(): Promise<HeyGenAvatar[]}
  async listVoices(): Promise<HeyGenVoice[]}
}
```

#### FFmpeg Effects Integration
```typescript
// src/integrations/ffmpeg-processor.ts
class FFmpegProcessor {
  async applyKenBurnsEffect(input: KenBurnsInput): Promise<string>
  async apply3DDepthEffect(input: DepthInput): Promise<string>
  async applyBackgroundBlur(input: BlurInput): Promise<string>
  async compositeVideoLayers(layers: VideoLayer[]): Promise<string>
}
```

### Error Handling Strategy

#### Retry Logic
```typescript
class RetryHandler {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries && this.isRetryableError(error)) {
          await this.sleep(backoffMs * Math.pow(2, attempt));
          continue;
        }
        
        throw error;
      }
    }
    
    throw lastError;
  }
  
  private isRetryableError(error: any): boolean {
    // Network errors, timeout errors, 5xx responses
    return error.code === 'NETWORK_ERROR' || 
           error.code === 'TIMEOUT' ||
           (error.status >= 500 && error.status < 600);
  }
}
```

#### Fallback Mechanisms
```typescript
class ProviderFallbackHandler {
  async executeWithFallback<T>(
    primaryProvider: () => Promise<T>,
    fallbackProviders: (() => Promise<T>)[]
  ): Promise<T> {
    try {
      return await primaryProvider();
    } catch (primaryError) {
      for (const fallback of fallbackProviders) {
        try {
          return await fallback();
        } catch (fallbackError) {
          // Log but continue to next fallback
        }
      }
      
      throw new Error('All providers failed');
    }
  }
}
```

### Testing Strategy

#### Unit Tests
```typescript
// tests/unit/services/avatar-generation.test.ts
describe('AvatarGenerationService', () => {
  it('should generate Argil video successfully', async () => {
    // Test implementation
  });
  
  it('should handle Argil API failures gracefully', async () => {
    // Test error handling
  });
  
  it('should fallback to alternative avatar when primary fails', async () => {
    // Test fallback logic
  });
});
```

#### Integration Tests
```typescript
// tests/integration/workflows/avatar-workflow.test.ts
describe('Avatar Workflow Integration', () => {
  it('should complete full Argil workflow end-to-end', async () => {
    // Test complete workflow
  });
  
  it('should handle webhook callbacks correctly', async () => {
    // Test webhook integration
  });
});
```

#### End-to-End Tests
```typescript
// tests/e2e/complete-workflows.test.ts
describe('Complete Workflow Tests', () => {
  it('should generate video from article to final output', async () => {
    // Test full pipeline
  });
});
```

### Deployment Considerations

#### Environment Variables
```bash
# Avatar Providers
ARGIL_API_KEY=sk-...
HEYGEN_API_KEY=...

# Video Processing
FFMPEG_PATH=/usr/bin/ffmpeg
MAX_VIDEO_RESOLUTION=1080p
MAX_PROCESSING_TIME=600000

# Storage
MAX_ASSET_SIZE_MB=100
ASSET_CACHE_TTL=3600

# Webhooks
WEBHOOK_SECRET_KEY=...
WEBHOOK_TIMEOUT_MS=30000
```

#### Resource Requirements
- **CPU**: 4+ cores for video processing
- **Memory**: 8GB+ for large video files
- **Storage**: 100GB+ for temporary files
- **Network**: High bandwidth for asset downloads

#### Scaling Considerations
- Separate workers for CPU-intensive tasks (effects processing)
- Queue system for background jobs
- CDN for asset delivery
- Database read replicas for analytics

This roadmap provides a structured approach to implementing the missing functionality while maintaining system reliability and performance.