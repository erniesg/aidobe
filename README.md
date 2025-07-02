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

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers and R2 enabled
- OpenAI API key
- Replicate API token

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/erniesg/aidobe.git
cd aidobe
npm install
```

### 2. Get Required API Keys

#### OpenAI API Key
1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-proj-...`)

#### Replicate API Token
1. Visit [Replicate Account](https://replicate.com/account/api-tokens)
2. Create a new token
3. Copy the token (starts with `r8_...`)

#### Cloudflare API Token
1. Visit [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create token with "Custom token" template
3. Required permissions:
   - Account: Cloudflare Workers:Edit
   - Zone: Zone Settings:Read, Zone:Read
   - Account: D1:Edit
   - Account: R2:Edit

### 3. Environment Configuration

Create your local environment file:
```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your credentials:
```bash
ACCESS_PASSWORD="your-secure-password-here"
OPENAI_API_KEY=sk-proj-your-openai-key-here
REPLICATE_API_TOKEN=r8_your-replicate-token-here
ENVIRONMENT=dev
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token-here
```

### 4. Cloudflare Resources Setup

#### Create D1 Database
```bash
# Export your Cloudflare API token
export CLOUDFLARE_API_TOKEN=your-cloudflare-api-token-here

# Create the database
wrangler d1 create aidobe
```

Copy the database ID from the output and update `wrangler.toml`:
```toml
database_id = "your-database-id-here"
```

#### Create R2 Buckets
```bash
wrangler r2 bucket create aidobe-outputs
wrangler r2 bucket create aidobe-prompts
```

### 5. Database Schema Initialization

```bash
# Initialize local database (for development)
wrangler d1 execute aidobe --env dev --file=./scripts/schema.sql

# Initialize remote database (for deployed environments)
wrangler d1 execute aidobe --env dev --remote --file=./scripts/schema.sql
```

## Running Locally

### Development Server
```bash
npm run dev
```
This starts the development server on `http://localhost:8787`

### Test API Locally
```bash
curl -X POST http://localhost:8787/api/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secure-password-here" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "enhance": true,
    "provider": "openai"
  }'
```

## Deployment

### Development Environment

1. Set development secrets:
```bash
export CLOUDFLARE_API_TOKEN=your-cloudflare-api-token-here

echo "your-secure-password" | wrangler secret put ACCESS_PASSWORD --env dev
echo "sk-proj-your-openai-key" | wrangler secret put OPENAI_API_KEY --env dev  
echo "r8_your-replicate-token" | wrangler secret put REPLICATE_API_TOKEN --env dev
```

2. Deploy to dev:
```bash
wrangler deploy --env dev
```

Your dev environment will be available at: `https://aidobe-dev.your-subdomain.workers.dev`

### Production Environment

1. Set production secrets:
```bash
echo "your-production-password" | wrangler secret put ACCESS_PASSWORD --env prod
echo "sk-proj-your-openai-key" | wrangler secret put OPENAI_API_KEY --env prod
echo "r8_your-replicate-token" | wrangler secret put REPLICATE_API_TOKEN --env prod
```

2. Initialize production database:
```bash
wrangler d1 execute aidobe --env prod --remote --file=./scripts/schema.sql
```

3. Deploy to production:
```bash
wrangler deploy --env prod
```

Your production environment will be available at: `https://aidobe.your-subdomain.workers.dev`

## Testing

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test Suites
```bash
npm run test -- tests/unit/
npm run test -- tests/integration/
```

### Live API Testing
```bash
# Test development deployment
curl -X POST https://aidobe-dev.your-subdomain.workers.dev/api/images/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-password" \
  -d '{"prompt": "A red apple", "provider": "openai"}'
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

### View Generated Images

Generated images are accessible via:
```
GET /media/image/{output-id}
```

## Environment Management

### Local Development
- Uses `.dev.vars` file for environment variables
- Database runs locally via Wrangler
- R2 storage runs locally via Wrangler

### Dev Environment (`--env dev`)
- Remote Cloudflare Workers deployment
- Remote D1 database
- Remote R2 storage
- Secrets managed via `wrangler secret put --env dev`

### Production Environment (`--env prod`)
- Remote Cloudflare Workers deployment
- Remote D1 database
- Remote R2 storage  
- Secrets managed via `wrangler secret put --env prod`

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

## Common Commands Reference

```bash
# Development
npm run dev                    # Start development server
npm run test                   # Run all tests
npm run test:coverage          # Run tests with coverage
npm run lint                   # Run ESLint
npm run format                 # Format code with Prettier
npm run typecheck              # Check TypeScript types

# Database
wrangler d1 execute aidobe --file=./scripts/schema.sql              # Local DB
wrangler d1 execute aidobe --env dev --remote --file=./scripts/schema.sql   # Remote dev DB
wrangler d1 execute aidobe --env prod --remote --file=./scripts/schema.sql  # Remote prod DB

# Deployment  
wrangler deploy --env dev      # Deploy to development
wrangler deploy --env prod     # Deploy to production

# Secrets Management
wrangler secret put ACCESS_PASSWORD --env dev
wrangler secret put OPENAI_API_KEY --env dev
wrangler secret put REPLICATE_API_TOKEN --env dev
```

## Troubleshooting

### Common Issues

1. **"Internal Server Error" on deployment**
   - Check that all secrets are set: `wrangler secret list --env dev`
   - Verify database schema is initialized
   - Check Wrangler logs: `wrangler tail --env dev`

2. **"Missing or invalid authorization header"**
   - Ensure `Authorization: Bearer password` header is included
   - Verify the password matches your `ACCESS_PASSWORD` secret

3. **TypeScript errors during commit**
   - Run `npm run typecheck` to see all errors
   - Fix type issues before committing
   - Use `git commit --no-verify` only for emergencies

### Getting Help

- Check the [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- Review test files for usage examples
- Check the `/docs` directory for additional documentation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details