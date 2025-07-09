# Aidobe API Endpoint Plan

## Overview

This document provides a comprehensive plan for all API endpoints needed in aidobe to support the complete video generation workflow inspired by wanx. Each endpoint is designed to be atomic, idempotent, and capable of recovery/resume operations.

## Existing Endpoints

### Image Generation
- `POST /api/images/generate` - Generate images using multiple AI providers
- `GET /api/images/history` - Get image generation history
- `DELETE /api/images/{promptId}/{imageId}` - Delete specific image

### Video Generation (Legacy)
- `POST /api/videos/generate` - Generate video using Replicate models
- `GET /api/videos/history` - Get video generation history

### Video Assembly Pipeline
- `POST /api/video/assemble` - Assemble complete video from scenes
- `POST /api/video/apply-effects` - Apply visual effects to scenes
- `POST /api/video/add-captions` - Add captions with word-level timing
- `GET /api/video/progress/{jobId}` - Get rendering progress
- `GET /api/video/download/{jobId}` - Download completed video
- `DELETE /api/video/cancel/{jobId}` - Cancel video processing
- `GET /api/video/health` - Health check

### Script Generation
- `POST /api/scripts/parse-articles` - Parse articles for script generation
- `POST /api/scripts/generate-structured` - Generate structured scripts
- `POST /api/scripts/generate-drafts` - Legacy draft generation
- `PUT /api/scripts/edit-draft/{draftId}` - Edit existing draft
- `POST /api/scripts/finalize/{draftId}` - Finalize draft for production
- `POST /api/scripts/extract-scenes` - Extract scenes from script

### Audio Processing
- `POST /api/audio/generate-tts` - Generate text-to-speech
- `POST /api/audio/search-music` - Search for background music
- `POST /api/audio/mix` - Mix voice and background music
- `POST /api/audio/transcribe` - Transcribe audio with timing
- `POST /api/audio/clone-voice` - Clone voice for generation
- `GET /api/audio/voices` - List available TTS voices

### Asset Management
- `POST /api/assets/search` - Search assets across providers
- `POST /api/assets/generate` - Generate custom assets
- `POST /api/assets/evaluate` - Evaluate asset relevance
- `POST /api/assets/select-best` - Select best asset for scene
- `POST /api/assets/batch-process` - Process multiple scenes
- `PUT /api/assets/override/{sceneId}` - Override asset selection

### Job Management
- `POST /api/jobs/create` - Create new job
- `GET /api/jobs/{jobId}` - Get job status
- `PATCH /api/jobs/{jobId}` - Update job status
- `POST /api/jobs/{jobId}/cancel` - Cancel job
- `DELETE /api/jobs/{jobId}` - Delete job
- `GET /api/jobs` - Search/list jobs
- `GET /api/jobs/stats/overview` - Get statistics
- `POST /api/jobs/cleanup` - Cleanup old jobs

## New Endpoints Needed

### 1. Avatar Generation Endpoints

#### `POST /api/avatars/generate-argil`
Generate video using Argil avatar system.

**Input Schema:**
```json
{
  "jobId": "uuid",
  "scriptId": "uuid",
  "segments": [{
    "segmentId": "string",
    "text": "string",
    "avatarId": "string",
    "voiceId": "string",
    "duration": "number"
  }],
  "aspectRatio": "9:16|16:9|1:1",
  "webhookUrl": "string"
}
```

**Output Schema:**
```json
{
  "argilJobId": "string",
  "status": "queued|processing|completed|failed",
  "segments": [{
    "segmentId": "string",
    "argilVideoId": "string",
    "status": "string"
  }],
  "estimatedTime": "number"
}
```

**Idempotency:** Uses jobId + scriptId as key
**Recovery:** Can resume from segment failures

#### `POST /api/avatars/generate-heygen`
Generate video using HeyGen avatar system.

**Input Schema:**
```json
{
  "jobId": "uuid",
  "scriptId": "uuid",
  "videoTitle": "string",
  "transcript": "string",
  "avatarId": "string",
  "voiceId": "string",
  "aspectRatio": "9:16|16:9|1:1",
  "webhookUrl": "string"
}
```

**Output Schema:**
```json
{
  "heygenVideoId": "string",
  "status": "pending|processing|completed|failed",
  "videoUrl": "string",
  "thumbnailUrl": "string"
}
```

**Idempotency:** Uses jobId + transcript hash
**Recovery:** Can check status and retry

#### `GET /api/avatars/list-available`
List available avatars across providers.

**Output Schema:**
```json
{
  "avatars": [{
    "id": "string",
    "name": "string",
    "provider": "argil|heygen",
    "previewUrl": "string",
    "capabilities": ["string"]
  }]
}
```

### 2. Transcript Processing Endpoints

#### `POST /api/transcripts/split-segments`
Split transcript into timed segments for overlay generation.

**Input Schema:**
```json
{
  "transcriptId": "uuid",
  "audioFileId": "uuid",
  "splitStrategy": "word|phrase|sentence",
  "targetSegmentDuration": "number",
  "overlapMs": "number"
}
```

**Output Schema:**
```json
{
  "segments": [{
    "segmentId": "uuid",
    "text": "string",
    "startTime": "number",
    "endTime": "number",
    "wordTimings": [{
      "word": "string",
      "start": "number",
      "end": "number"
    }]
  }],
  "totalDuration": "number"
}
```

**Idempotency:** Uses transcriptId + strategy as key
**Recovery:** Can be rerun safely

#### `POST /api/transcripts/align-with-scenes`
Align transcript segments with visual scenes.

**Input Schema:**
```json
{
  "transcriptSegments": ["segmentId"],
  "sceneIds": ["sceneId"],
  "alignmentStrategy": "sequential|smart|manual",
  "constraints": {
    "minSceneDuration": "number",
    "maxSceneDuration": "number"
  }
}
```

**Output Schema:**
```json
{
  "alignments": [{
    "sceneId": "string",
    "segmentIds": ["string"],
    "startTime": "number",
    "endTime": "number",
    "confidence": "number"
  }],
  "unalignedSegments": ["string"]
}
```

### 3. Asset Orchestration Endpoints

#### `POST /api/orchestration/plan-assets`
Create comprehensive asset plan for all scenes.

**Input Schema:**
```json
{
  "jobId": "uuid",
  "scenes": [{
    "sceneId": "string",
    "text": "string",
    "visualKeywords": ["string"],
    "duration": "number"
  }],
  "preferences": {
    "providers": ["pexels|pixabay|envato"],
    "quality": "standard|high|premium",
    "style": "string"
  }
}
```

**Output Schema:**
```json
{
  "assetPlan": [{
    "sceneId": "string",
    "primaryAsset": {
      "type": "image|video",
      "source": "string",
      "query": "string"
    },
    "alternativeAssets": [{}]
  }],
  "estimatedCost": "number"
}
```

#### `POST /api/orchestration/execute-plan`
Execute asset orchestration plan with multi-source fallback.

**Input Schema:**
```json
{
  "planId": "uuid",
  "assetPlan": [{}],
  "parallel": "boolean",
  "maxRetries": "number"
}
```

**Output Schema:**
```json
{
  "executionId": "uuid",
  "results": [{
    "sceneId": "string",
    "status": "success|failed|pending",
    "selectedAsset": {
      "url": "string",
      "type": "string",
      "provider": "string"
    },
    "attempts": "number"
  }]
}
```

**Idempotency:** Uses planId as key
**Recovery:** Tracks attempts per scene

### 4. Video Effects Endpoints

#### `POST /api/effects/ken-burns`
Apply Ken Burns effect to image/video.

**Input Schema:**
```json
{
  "assetId": "uuid",
  "effect": {
    "type": "zoom_in|zoom_out|pan_left|pan_right|custom",
    "startScale": "number",
    "endScale": "number",
    "startPosition": {"x": "number", "y": "number"},
    "endPosition": {"x": "number", "y": "number"},
    "duration": "number",
    "easing": "linear|ease-in|ease-out|ease-in-out"
  }
}
```

**Output Schema:**
```json
{
  "effectId": "uuid",
  "outputUrl": "string",
  "preview": {
    "thumbnails": ["string"],
    "duration": "number"
  }
}
```

#### `POST /api/effects/3d-depth`
Apply 3D depth effect using AI depth estimation.

**Input Schema:**
```json
{
  "imageId": "uuid",
  "depthSettings": {
    "intensity": "number",
    "focusPoint": {"x": "number", "y": "number"},
    "parallaxAmount": "number"
  }
}
```

#### `POST /api/effects/background-blur`
Apply background blur for vertical video optimization.

**Input Schema:**
```json
{
  "assetId": "uuid",
  "blurSettings": {
    "blurRadius": "number",
    "maintainAspectRatio": "boolean",
    "backgroundColor": "string"
  }
}
```

### 5. Workflow Configuration Endpoints

#### `POST /api/workflows/create-template`
Create reusable workflow template.

**Input Schema:**
```json
{
  "name": "string",
  "type": "original|argil|heygen|regen",
  "steps": [{
    "stepId": "string",
    "action": "string",
    "parameters": {},
    "dependencies": ["stepId"]
  }],
  "defaults": {}
}
```

#### `POST /api/workflows/execute`
Execute workflow with specific configuration.

**Input Schema:**
```json
{
  "templateId": "uuid",
  "jobId": "uuid",
  "inputs": {
    "articles": [{}],
    "style": "string",
    "targetDuration": "number"
  },
  "overrides": {}
}
```

**Output Schema:**
```json
{
  "executionId": "uuid",
  "status": "running|completed|failed",
  "currentStep": "string",
  "progress": "number",
  "results": {}
}
```

### 6. Prompt Template Management

#### `POST /api/prompts/create-template`
Create reusable prompt template.

**Input Schema:**
```json
{
  "name": "string",
  "category": "script|scene|asset|effect",
  "template": "string",
  "variables": [{
    "name": "string",
    "type": "string",
    "required": "boolean",
    "default": "any"
  }],
  "examples": [{}]
}
```

#### `POST /api/prompts/render`
Render prompt template with variables.

**Input Schema:**
```json
{
  "templateId": "uuid",
  "variables": {},
  "context": {}
}
```

**Output Schema:**
```json
{
  "renderedPrompt": "string",
  "tokens": "number",
  "warnings": ["string"]
}
```

### 7. REGEN Workflow Endpoints

#### `POST /api/regen/parse-guide`
Parse asset regeneration guide.

**Input Schema:**
```json
{
  "jobId": "uuid",
  "guideText": "string",
  "originalJobId": "uuid"
}
```

**Output Schema:**
```json
{
  "overlays": [{
    "overlayId": "string",
    "type": "AVATAR|STOCK_IMAGE|STOCK_VIDEO|USER_UPLOADED",
    "text": "string",
    "assetInstruction": "string",
    "timing": {}
  }],
  "totalDuration": "number"
}
```

#### `POST /api/regen/resolve-assets`
Resolve asset instructions to actual files.

**Input Schema:**
```json
{
  "overlays": [{}],
  "assetMappings": {},
  "searchFallback": "boolean"
}
```

#### `POST /api/regen/generate-video`
Generate new video from REGEN instructions.

**Input Schema:**
```json
{
  "regenPlanId": "uuid",
  "resolvedAssets": {},
  "outputSettings": {
    "resolution": "string",
    "format": "string"
  }
}
```

**Idempotency:** Uses regenPlanId
**Recovery:** Can resume from last successful overlay

### 8. Analytics & Monitoring

#### `POST /api/analytics/track-generation`
Track generation metrics.

**Input Schema:**
```json
{
  "jobId": "uuid",
  "event": "string",
  "metrics": {
    "duration": "number",
    "cost": "number",
    "quality": "number"
  },
  "metadata": {}
}
```

#### `GET /api/analytics/performance`
Get performance metrics.

**Query Parameters:**
- `timeRange`: last24h|last7d|last30d
- `groupBy`: provider|workflow|user

## Data Flow Diagrams

### Original Workflow
```
Articles → Parse → Generate Script → TTS Audio → Asset Search → Video Assembly → Effects → Captions → Final Video
```

### Argil Workflow
```
Articles → Parse → Script Generation → Argil API (Avatar + TTS) → Asset Search (B-roll) → Video Assembly → Final Video
```

### HeyGen Workflow
```
Articles → Parse → Script → HeyGen API → Webhook → Asset Orchestration → Video Assembly → Final Video
```

### REGEN Workflow
```
Asset Guide → Parse Overlays → Resolve Assets → Generate New Script → Argil Video → Apply Overlays → Final Video
```

## Idempotency Strategies

1. **Request ID Based**: Each request includes unique ID, responses cached
2. **Content Hash Based**: Hash of input parameters used as idempotency key
3. **Job ID Based**: Operations tied to job ID are inherently idempotent
4. **Timestamp Window**: Duplicate requests within time window rejected

## Recovery Mechanisms

1. **Checkpoint Storage**: Store progress at each major step
2. **Partial Result Caching**: Cache successful sub-operations
3. **Retry with Backoff**: Exponential backoff for transient failures
4. **Alternative Provider Fallback**: Switch providers on failure
5. **Manual Override Options**: Allow user intervention for stuck jobs

## Prompt Usage by Endpoint

### Script Generation
- **Template**: `tech_in_asia_script_prompt.md`
- **Variables**: article_content, style, duration, audience

### Asset Search
- **Template**: `visual_scene_planner_prompt_template.md`
- **Variables**: scene_text, keywords, style_preference

### Asset Evaluation
- **Template**: Custom evaluation prompt
- **Variables**: asset_url, scene_context, quality_criteria

### Effect Selection
- **Template**: Ken Burns effect selection prompt
- **Variables**: image_content, scene_emotion, duration

## Error Handling

Each endpoint returns standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {},
    "retryable": true,
    "suggestedAction": "string"
  },
  "requestId": "uuid",
  "timestamp": "ISO8601"
}
```

## Rate Limiting

- **Per User**: 100 requests/minute
- **Per Job**: 10 concurrent operations
- **Per Provider**: Respects upstream limits
- **Burst Allowance**: 2x limit for 10 seconds

## Webhook Integration

All long-running operations support webhooks:

```json
{
  "webhookUrl": "https://example.com/webhook",
  "webhookEvents": ["started", "progress", "completed", "failed"],
  "webhookAuth": {
    "type": "bearer|hmac",
    "secret": "string"
  }
}
```

This comprehensive API design ensures atomic, resumable operations with proper error handling and monitoring capabilities.