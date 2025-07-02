# aidobe

AI-powered image and video generation platform built on Cloudflare Workers, designed for prompt experimentation and content creation.

## Features

- **Multiple AI Providers**: OpenAI DALL-E and Replicate models
- **Password Protection**: Secure access with environment-based authentication
- **Prompt Enhancement**: AI-powered prompt improvement suggestions
- **Storage Management**: Cloudflare R2 for media files, D1 for metadata
- **Analytics**: Track popular prompts and usage patterns
- **Download Management**: Batch downloads with metadata export
- **Comprehensive Testing**: Unit and integration tests with high coverage

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Environment Setup

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your API keys and password
```

### 3. Database Setup

```bash
# Create D1 database
wrangler d1 create aidobe

# Update wrangler.toml with your database ID
# Run migrations
wrangler d1 execute aidobe --file=./scripts/schema.sql
```

### 4. R2 Bucket Setup

```bash
# Create R2 buckets
wrangler r2 bucket create aidobe-outputs
wrangler r2 bucket create aidobe-prompts
```

### 5. Development

```bash
npm run dev
```

### 6. Testing

```bash
npm test
npm run test:coverage
```

### 7. Deployment

```bash
npm run deploy
```

## API Endpoints

### Authentication
All API endpoints require a Bearer token matching the `ACCESS_PASSWORD` environment variable.

```bash
Authorization: Bearer your-password-here
```

### Image Generation

```bash
POST /api/images/generate
{
  "prompt": "A beautiful sunset over mountains",
  "enhance": true,
  "provider": "openai",
  "model": "dall-e-3",
  "parameters": {
    "size": "1024x1024",
    "quality": "hd"
  }
}
```

### Video Generation

```bash
POST /api/videos/generate
{
  "prompt": "A calm ocean with gentle waves",
  "model": "minimax/video-01",
  "parameters": {
    "frame_rate": 25
  }
}
```

### Prompt Enhancement

```bash
POST /api/prompts/enhance
{
  "prompt": "a cat",
  "style": "photorealistic",
  "context": "for a pet portrait"
}
```

### Download Management

```bash
POST /api/downloads/prepare
{
  "outputIds": ["uuid1", "uuid2"],
  "format": "individual",
  "includeMetadata": true
}
```

## Architecture

- **Cloudflare Workers**: Edge computing for global performance
- **Hono Framework**: Fast, lightweight web framework
- **TypeScript**: Type-safe development
- **Zod**: Runtime type validation
- **Vitest**: Modern testing framework
- **R2 Storage**: Media file storage
- **D1 Database**: Metadata and analytics

## Supported Models

### OpenAI
- DALL-E 2
- DALL-E 3

### Replicate
- Stability AI SDXL
- Flux Dev/Schnell
- Minimax Video-01
- LTX Video

## Development Workflow

1. **Write tests first** following TDD principles
2. **Implement features** with proper error handling
3. **Run linting and formatting**: `npm run lint && npm run format`
4. **Test thoroughly**: `npm run test:coverage`
5. **Deploy to dev**: `wrangler deploy --env dev`
6. **Deploy to production**: `wrangler deploy --env prod`

## Environment Variables

- `ACCESS_PASSWORD`: Password for API access
- `OPENAI_API_KEY`: OpenAI API key
- `REPLICATE_API_TOKEN`: Replicate API token
- `ENVIRONMENT`: deployment environment (development/production)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details