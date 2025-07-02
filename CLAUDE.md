# CLAUDE.md - aidobe

This file provides guidance to Claude Code when working with the aidobe codebase.

## Project Overview

aidobe is an AI-powered image and video generation platform built on Cloudflare Workers. It serves as a clean, modern alternative to the existing wanx implementation with proper structure, comprehensive testing, and production-ready architecture.

## Core Purpose

- **Prompt Experimentation**: Easy testing of different prompts and models
- **Multi-Provider Support**: OpenAI DALL-E and Replicate models
- **Secure Access**: Password-gated API with environment-based authentication
- **Data Collection**: Comprehensive tracking of prompts, outputs, and usage patterns
- **Download Management**: Easy export of generated content with metadata

## Architecture Principles

### 1. **Edge-First Design**
- Cloudflare Workers for global performance
- R2 storage for media files
- D1 database for metadata and analytics
- Minimal latency for users worldwide

### 2. **Type Safety**
- TypeScript throughout the codebase
- Zod for runtime validation
- Comprehensive type definitions

### 3. **Test-Driven Development**
- Unit tests for individual components
- Integration tests for API endpoints
- High test coverage requirement (>90%)

### 4. **Security First**
- Environment-based authentication
- No hardcoded secrets
- Secure headers and CORS configuration

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (lightweight, fast)
- **Language**: TypeScript
- **Validation**: Zod
- **Testing**: Vitest
- **Storage**: Cloudflare R2 + D1
- **AI Providers**: OpenAI, Replicate

## Project Structure

```
aidobe/
├── src/
│   ├── handlers/          # HTTP route handlers
│   │   ├── image.ts       # Image generation endpoints
│   │   ├── video.ts       # Video generation endpoints
│   │   ├── prompt.ts      # Prompt management
│   │   └── download.ts    # Download management
│   ├── services/          # Business logic
│   │   ├── openai.ts      # OpenAI API integration
│   │   ├── replicate.ts   # Replicate API integration
│   │   ├── storage.ts     # R2 storage operations
│   │   └── database.ts    # D1 database operations
│   ├── middleware/        # Request middleware
│   │   ├── auth.ts        # Authentication
│   │   └── error.ts       # Error handling
│   ├── types/             # TypeScript definitions
│   └── index.ts           # Main application entry
├── tests/
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── scripts/
│   └── schema.sql         # Database schema
└── docs/                  # Additional documentation
```

## Development Workflow

### 1. **Adding New Features**
1. Write failing tests first (TDD approach)
2. Implement the feature with proper error handling
3. Ensure all tests pass
4. Update documentation if needed

### 2. **Adding New AI Models**
1. Add model configuration to the appropriate service
2. Update validation schemas
3. Add comprehensive tests
4. Document the new model capabilities

### 3. **Database Changes**
1. Update schema.sql with migrations
2. Update TypeScript interfaces
3. Update database service methods
4. Test with realistic data

## Common Development Commands

```bash
# Development
npm run dev              # Start development server
npm run test             # Run all tests
npm run test:ui          # Run tests with UI
npm run test:coverage    # Run tests with coverage
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run typecheck        # Check TypeScript types

# Deployment
npm run deploy           # Deploy to production
wrangler deploy --env dev     # Deploy to dev

# Database
wrangler d1 execute aidobe --file=./scripts/schema.sql  # Run migrations
wrangler d1 execute aidobe --command="SELECT * FROM prompts LIMIT 10"  # Query data
```

## Key Patterns

### 1. **Handler Pattern**
Each handler focuses on HTTP request/response logic:
- Input validation with Zod
- Authentication via middleware
- Business logic delegation to services
- Proper error responses

### 2. **Service Pattern**
Services contain business logic:
- AI provider integrations
- Database operations
- Storage management
- External API calls

### 3. **Middleware Pattern**
Middleware handles cross-cutting concerns:
- Authentication
- CORS
- Error handling
- Logging

## Testing Strategy

### 1. **Unit Tests**
- Test individual functions and classes
- Mock external dependencies
- Focus on business logic

### 2. **Integration Tests**
- Test API endpoints end-to-end
- Use real Cloudflare Workers environment
- Test error conditions

### 3. **E2E Tests**
- Test complete user workflows
- Test with real AI providers (in staging)
- Performance and reliability testing

## Environment Configuration

### Development (.dev.vars)
```
ACCESS_PASSWORD=dev-password
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
ENVIRONMENT=development
```

### Production (wrangler.toml vars)
```
ACCESS_PASSWORD=secure-production-password
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
ENVIRONMENT=production
```

## Deployment Pipeline

1. **Local Development**: `npm run dev`
2. **Testing**: `npm run test:coverage`
3. **Dev Environment**: `wrangler deploy --env dev`
4. **Production**: `wrangler deploy --env prod`

## Error Handling

- All errors are properly caught and logged
- User-friendly error messages
- Detailed error information in development
- Proper HTTP status codes

## Performance Considerations

- Efficient database queries with proper indexing
- Minimal API calls to external services
- Optimized image/video processing
- Caching where appropriate

## Security Measures

- Password-based API authentication
- Input validation and sanitization
- Secure environment variable handling
- CORS configuration
- Rate limiting (to be implemented)

## Monitoring and Analytics

- Track generation requests and success rates
- Monitor popular prompts and models
- Storage usage analytics
- Performance metrics

## Future Enhancements

- Frontend web interface
- User accounts and authentication
- Advanced prompt templates
- Batch processing capabilities
- Webhook integrations
- Rate limiting and quotas