# CLAUDE.md - aidobe

This file provides guidance to Claude Code when working with the aidobe codebase.

## Project Overview

aidobe is a next-generation AI-powered content generation platform built on Cloudflare Workers. It serves as a clean, modern evolution of the wanx video generation platform, focusing on intelligent article-to-video transformation, multi-provider LLM integration, and production-ready media generation with comprehensive observability.

## Core Mission

- **Article-to-Video Intelligence**: Transform Tech in Asia articles into engaging video content with Gen-Z personality
- **Multi-Provider LLM Integration**: Seamless switching between OpenAI, Anthropic, and Google Gemini with vision support
- **Template-Based Prompt Management**: File-based prompt system with Handlebars templating (no KV storage dependency)
- **Algolia Content Integration**: Direct article retrieval from posts-v2 index for automated content workflows
- **Comprehensive Observability**: Langfuse tracing for all LLM operations with detailed analytics
- **Wanx-Compatible Output**: Structured JSON video scripts matching wanx format for seamless integration
- **Scene Planning Intelligence**: Automated timing extraction and scene breakdown from video scripts

## Architecture Philosophy

### 1. **Edge-First Design**
- Cloudflare Workers runtime for global performance
- R2 storage for media assets with CDN integration
- D1 database for metadata, analytics, and job tracking
- Minimal cold start latency for responsive user experience

### 2. **Type Safety Throughout**
- TypeScript for all application logic
- Zod for runtime validation and API contract enforcement
- Comprehensive type definitions for all data structures
- Compile-time error prevention and IDE support

### 3. **Test-Driven Development**
- Unit tests for individual components and services
- Integration tests for API endpoints and workflows
- End-to-end tests for complete user journeys
- Performance tests for optimization validation
- Target: >95% test coverage

### 4. **Security & Reliability First**
- Environment-based authentication with secure token management
- Input validation and sanitization at all entry points
- Comprehensive error handling with graceful degradation
- Rate limiting and abuse prevention
- Audit logging for security and compliance

## Tech Stack

**Core Technologies:**
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Framework**: Hono (lightweight, fast HTTP framework)
- **Language**: TypeScript with strict type checking
- **Validation**: Zod for schema validation and type generation
- **Testing**: Vitest for unit/integration tests
- **Storage**: Cloudflare R2 (S3-compatible) + D1 (SQLite)
- **AI Providers**: OpenAI (GPT-4o, DALL-E), Anthropic (Claude Sonnet 4), Google (Gemini 2.5 Flash), Replicate, Argil
- **Content Integration**: Algolia (posts-v2 index), Tech in Asia article retrieval
- **Observability**: Langfuse tracing, structured logging, comprehensive analytics
- **Template Engine**: File-based Handlebars templates for prompt management
- **Media Processing**: FFmpeg (via Modal), MoviePy, ImageMagick, Ken Burns effects
- **Asset Sources**: Pexels, Pixabay, Envato, SERP API, AI image generation

**Development Tools:**
- **Package Manager**: npm with lockfile versioning
- **Code Quality**: ESLint, Prettier, TypeScript strict mode
- **Documentation**: JSDoc comments, README files
- **Deployment**: Wrangler CLI with environment management

## Project Structure

```
aidobe/
├── src/
│   ├── handlers/          # HTTP route handlers
│   │   ├── image.ts       # Image generation endpoints
│   │   ├── video.ts       # Video generation endpoints  
│   │   ├── scripts.ts     # ✅ Script generation with multi-provider LLM support
│   │   ├── articles.ts    # ✅ Algolia article search and retrieval
│   │   ├── assets.ts      # Asset orchestration and management
│   │   ├── audio.ts       # Audio processing and TTS
│   │   ├── argil.ts       # ✅ Argil avatar generation workflows
│   │   ├── prompt.ts      # Prompt template management
│   │   ├── download.ts    # Media download and export
│   │   └── jobs.ts        # Job management and tracking
│   ├── services/          # Business logic layer
│   │   ├── multi-provider-llm.ts # ✅ Unified LLM service (OpenAI, Anthropic, Google)
│   │   ├── llm-tracing.ts # ✅ Langfuse observability service
│   │   ├── algolia.ts     # ✅ Article retrieval from posts-v2 index
│   │   ├── scene-planning.ts # ✅ Scene timing and breakdown service
│   │   ├── script-generation.ts # Legacy script generation service
│   │   ├── openai.ts      # OpenAI integration
│   │   ├── replicate.ts   # Replicate API integration
│   │   ├── config.ts      # Configuration management
│   │   ├── storage.ts     # R2 storage operations
│   │   └── database.ts    # D1 database operations
│   ├── templates/         # ✅ Template management
│   │   └── prompts/       # ✅ File-based prompt templates
│   │       └── video-script-generation.md # ✅ Gen-Z Tech in Asia prompt
│   ├── schemas/           # ✅ Zod validation schemas
│   │   ├── script.ts      # Script generation schemas
│   │   ├── scene-planning.ts # ✅ Scene planning schemas  
│   │   └── job.ts         # Job management schemas
│   ├── utils/            # Utility functions
│   │   ├── logger.ts     # Structured logging
│   │   ├── crypto.ts     # Cryptographic utilities
│   │   ├── validation.ts # Common validation functions
│   │   └── formatting.ts # Data formatting helpers
│   ├── middleware/       # Request middleware
│   │   ├── auth.ts       # Authentication and authorization
│   │   ├── validation.ts # Request validation
│   │   ├── error.ts      # Error handling and logging
│   │   ├── cors.ts       # CORS configuration
│   │   └── rate-limit.ts # Rate limiting
│   ├── types/            # TypeScript type definitions
│   │   ├── api.ts        # API request/response types
│   │   ├── config.ts     # Configuration interfaces
│   │   ├── database.ts   # Database schema types
│   │   └── providers.ts  # AI provider types
│   ├── config/           # Configuration management
│   │   ├── providers.yaml # AI provider configurations
│   │   ├── effects.yaml  # Video effects parameters
│   │   └── defaults.ts   # Default values and constants
│   ├── utils/            # Utility functions
│   │   ├── logger.ts     # Structured logging
│   │   ├── crypto.ts     # Cryptographic utilities
│   │   ├── validation.ts # Common validation functions
│   │   └── formatting.ts # Data formatting helpers
│   └── index.ts          # Main application entry point
├── tests/
│   ├── unit/             # Unit tests
│   │   ├── services/     # Service layer tests
│   │   ├── handlers/     # Handler tests
│   │   └── utils/        # Utility function tests
│   ├── integration/      # Integration tests
│   │   ├── api/          # API endpoint tests
│   │   └── workflows/    # Complete workflow tests
│   ├── e2e/              # End-to-end tests
│   │   ├── generation/   # Generation workflow tests
│   │   └── download/     # Download functionality tests
│   └── fixtures/         # Test data and fixtures
├── scripts/
│   ├── schema.sql        # Database schema and migrations
│   ├── seed.sql          # Sample data for development
│   └── deploy.ts         # Deployment automation
├── docs/                 # Project documentation
│   ├── api.md           # API documentation
│   ├── architecture.md  # Architecture overview
│   └── deployment.md    # Deployment guide
└── config/
    └── wrangler.toml    # Cloudflare Workers configuration
```

## Development Workflow

### 1. **Feature Development Process**
1. **Planning Phase**: Define requirements and break down tasks
2. **Test-First Development**: Write failing tests before implementation
3. **Implementation**: Build feature with proper error handling
4. **Integration Testing**: Verify end-to-end functionality
5. **Documentation**: Update API docs and code comments
6. **Code Review**: Ensure quality and architectural consistency

### 2. **Adding New AI Providers**
1. Implement the `AIProvider` interface in `services/ai/`
2. Add provider configuration to `config/providers.yaml`
3. Update validation schemas in `types/providers.ts`
4. Add comprehensive unit and integration tests
5. Update API documentation with new provider options

### 3. **Database Schema Changes**
1. Update `scripts/schema.sql` with migration scripts
2. Update TypeScript interfaces in `types/database.ts`
3. Update database service methods in `services/database.ts`
4. Test migrations with realistic data scenarios
5. Document breaking changes in migration notes

### 4. **Adding Media Effects**
1. Implement effect logic in `services/media/effects.ts`
2. Add effect configuration to `config/effects.yaml`
3. Update validation schemas for new parameters
4. Add comprehensive tests with sample media files
5. Document effect parameters and usage examples

## Key Architectural Patterns

### 1. **Service Layer Architecture**
```typescript
// Abstract base service with common functionality
abstract class BaseService {
  protected logger: Logger;
  protected config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
    this.logger = new Logger(this.constructor.name);
  }
  
  protected async handleError(error: Error, context: string): Promise<never> {
    this.logger.error(`Error in ${context}:`, error);
    throw new ServiceError(error.message, context, this.isRetryable(error));
  }
  
  protected abstract isRetryable(error: Error): boolean;
}

// Concrete service implementation
class ImageGenerationService extends BaseService {
  constructor(
    config: ImageConfig,
    private providers: Map<string, AIProvider>,
    private storage: StorageService,
    private database: DatabaseService
  ) {
    super(config);
  }
  
  async generate(prompt: string, options: ImageOptions): Promise<GenerationResult> {
    // Validation, generation, storage, logging
  }
}
```

### 2. **Provider Abstraction Pattern**
```typescript
// Abstract AI provider interface
interface AIProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  
  validateInput(input: GenerationInput): ValidationResult;
  generate(input: GenerationInput): Promise<GenerationOutput>;
  enhanceResult(result: GenerationOutput, enhancement: Enhancement): Promise<GenerationOutput>;
  estimateCost(input: GenerationInput): Promise<CostEstimate>;
}

// Multi-provider management with fallbacks
class ProviderManager {
  constructor(private providers: Map<string, AIProvider>) {}
  
  async generateWithFallback(
    input: GenerationInput,
    preferredProvider?: string
  ): Promise<GenerationResult> {
    const providers = this.getProviderChain(preferredProvider);
    
    for (const provider of providers) {
      try {
        return await provider.generate(input);
      } catch (error) {
        if (!this.isRetryableError(error) || provider === providers[providers.length - 1]) {
          throw error;
        }
        // Log fallback and continue
      }
    }
  }
}
```

### 3. **Request Validation Pattern**
```typescript
// Comprehensive input validation with Zod
const ImageGenerationSchema = z.object({
  prompt: z.string()
    .min(1, "Prompt is required")
    .max(4000, "Prompt too long")
    .refine(prompt => !containsUnsafeContent(prompt), "Unsafe content detected"),
  
  provider: z.enum(['openai', 'replicate', 'stability'])
    .default('openai'),
  
  dimensions: z.object({
    width: z.number().int().min(256).max(2048),
    height: z.number().int().min(256).max(2048)
  }).optional(),
  
  style: z.enum(['realistic', 'artistic', 'cartoon', 'abstract'])
    .optional(),
  
  enhancement: z.object({
    upscale: z.boolean().default(false),
    effects: z.array(z.enum(['sharpen', 'dehaze', 'vibrance'])).default([])
  }).optional()
});

// Type-safe handler with validation
app.post('/api/generate/image', async (c) => {
  try {
    const body = await c.req.json();
    const validated = ImageGenerationSchema.parse(body);
    
    const result = await imageService.generate(validated);
    return c.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation failed", details: error.issues }, 400);
    }
    throw error;
  }
});
```

### 4. **Background Job Processing**
```typescript
// Job management with status tracking
interface JobStatus {
  id: string;
  type: 'image' | 'video';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: GenerationResult;
  error?: string;
  created_at: string;
  updated_at: string;
}

class JobManager {
  async createJob(type: string, input: any): Promise<string> {
    const jobId = crypto.randomUUID();
    
    await this.database.createJob({
      id: jobId,
      type,
      status: 'pending',
      input: JSON.stringify(input),
      created_at: new Date().toISOString()
    });
    
    return jobId;
  }
  
  async processJob(jobId: string): Promise<void> {
    try {
      await this.updateJobStatus(jobId, 'processing');
      
      const result = await this.executeJob(jobId);
      
      await this.updateJobStatus(jobId, 'completed', result);
    } catch (error) {
      await this.updateJobStatus(jobId, 'failed', undefined, error.message);
    }
  }
}
```

## Common Development Commands

### Development Environment
```bash
# Development server with hot reload
npm run dev

# Run development server with specific environment
wrangler dev --env development

# Run all tests
npm run test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run integration tests only
npm run test:integration

# Run end-to-end tests
npm run test:e2e
```

### Code Quality & Linting
```bash
# Check TypeScript types
npm run typecheck

# Run ESLint
npm run lint

# Fix ESLint issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check code formatting
npm run format:check
```

### Database Management
```bash
# Run database migrations
wrangler d1 execute aidobe --file=./scripts/schema.sql

# Seed development database
wrangler d1 execute aidobe --file=./scripts/seed.sql

# Query database
wrangler d1 execute aidobe --command="SELECT COUNT(*) FROM prompts"

# Backup database
wrangler d1 export aidobe --output=backup.sql
```

### Deployment & Operations
```bash
# Deploy to development environment
npm run deploy:dev

# Deploy to production environment
npm run deploy:prod

# Check deployment status
wrangler deployments list

# View application logs
wrangler tail

# Monitor performance metrics
wrangler analytics
```

## Testing Strategy

### 1. **Unit Testing**
- **Focus**: Individual functions and class methods
- **Tools**: Vitest with comprehensive mocking
- **Coverage**: All service logic, utilities, and validation functions
- **Pattern**: Arrange-Act-Assert with descriptive test names

```typescript
// Example unit test
describe('ImageGenerationService', () => {
  it('should validate prompt length and reject overly long prompts', async () => {
    const service = new ImageGenerationService(mockConfig, mockProviders);
    const longPrompt = 'a'.repeat(5000);
    
    await expect(service.generate(longPrompt, {}))
      .rejects
      .toThrow('Prompt too long');
  });
  
  it('should fallback to secondary provider when primary fails', async () => {
    // Test implementation
  });
});
```

### 2. **Integration Testing**
- **Focus**: API endpoints and service interactions
- **Environment**: Real Cloudflare Workers runtime with test database
- **Coverage**: All HTTP endpoints, database operations, external API calls
- **Data**: Fixtures and factories for realistic test scenarios

### 3. **End-to-End Testing**
- **Focus**: Complete user workflows and business processes
- **Environment**: Staging environment with real AI providers
- **Coverage**: Image generation, video creation, download workflows
- **Performance**: Response times, resource usage, error recovery

### 4. **Performance Testing**
- **Focus**: Response times, throughput, resource utilization
- **Tools**: Custom benchmarking with Vitest
- **Metrics**: 95th percentile response times, memory usage, error rates
- **Thresholds**: API responses <500ms, image generation <30s, video generation <5min

## Environment Configuration

### Development Configuration
```bash
# .dev.vars file
ACCESS_PASSWORD=dev-secure-password-123
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...
STABILITY_API_KEY=sk-...
ENVIRONMENT=development
LOG_LEVEL=debug
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=3600
```

### Production Configuration
```toml
# wrangler.toml
name = "aidobe"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
vars = { ENVIRONMENT = "production", LOG_LEVEL = "info" }

[env.production.vars]
ACCESS_PASSWORD = "production-secure-password"
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW = 3600

[[env.production.r2_buckets]]
binding = "MEDIA_BUCKET"
bucket_name = "aidobe-media-prod"

[[env.production.d1_databases]]
binding = "DB"
database_name = "aidobe-prod"
database_id = "xxx-xxx-xxx"
```

## Error Handling & Monitoring

### Error Classification System
```typescript
// Hierarchical error system
abstract class AidobeError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly retryable: boolean;
  
  constructor(message: string, public readonly context?: any) {
    super(message);
    this.name = this.constructor.name;
  }
}

class ValidationError extends AidobeError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
  readonly retryable = false;
}

class ProviderError extends AidobeError {
  readonly code = 'PROVIDER_ERROR';
  readonly statusCode = 502;
  readonly retryable = true;
  
  constructor(message: string, public readonly provider: string, context?: any) {
    super(message, context);
  }
}

class StorageError extends AidobeError {
  readonly code = 'STORAGE_ERROR';
  readonly statusCode = 500;
  readonly retryable = true;
}
```

### Comprehensive Logging
```typescript
// Structured logging with context
interface LogContext {
  requestId?: string;
  userId?: string;
  provider?: string;
  jobId?: string;
  [key: string]: any;
}

class Logger {
  constructor(private component: string) {}
  
  info(message: string, context?: LogContext) {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      component: this.component,
      message,
      ...context
    }));
  }
  
  error(message: string, error?: Error, context?: LogContext) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      component: this.component,
      message,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...context
    }));
  }
}
```

## Performance Optimization

### 1. **Caching Strategy**
- **Provider Results**: Cache successful AI provider responses
- **Asset Storage**: CDN caching for generated media files
- **Database Queries**: Cache frequently accessed data
- **Configuration**: Cache provider configurations and settings

### 2. **Resource Management**
- **Memory Usage**: Monitor and optimize memory consumption
- **CPU Efficiency**: Optimize compute-intensive operations
- **Network Optimization**: Minimize external API calls
- **Storage Optimization**: Compress and optimize media files

### 3. **Scalability Considerations**
- **Edge Distribution**: Leverage Cloudflare's global network
- **Database Scaling**: Optimize queries and indexing
- **Rate Limiting**: Protect against abuse and ensure fair usage
- **Background Processing**: Asynchronous handling of long-running tasks

## Security Measures

### 1. **Authentication & Authorization**
- **API Key Management**: Secure storage and rotation of API keys
- **Access Control**: Role-based permissions for different user types
- **Rate Limiting**: Prevent abuse and ensure service availability
- **Input Validation**: Comprehensive sanitization of all inputs

### 2. **Data Protection**
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Privacy**: Minimize data collection and ensure user privacy
- **Audit Logging**: Track all security-relevant events
- **Compliance**: Adhere to relevant data protection regulations

### 3. **Content Safety**
- **Prompt Filtering**: Detect and prevent harmful content generation
- **Result Validation**: Scan generated content for safety issues
- **Abuse Prevention**: Monitor for misuse patterns
- **Reporting**: Mechanisms for reporting inappropriate content

## Analytics & Monitoring

### 1. **Usage Analytics**
- **Generation Metrics**: Track successful vs failed generations
- **Provider Performance**: Monitor response times and error rates
- **Popular Prompts**: Identify trending content and styles
- **User Behavior**: Understand usage patterns and preferences

### 2. **Performance Monitoring**
- **Response Times**: Track API response times and percentiles
- **Error Rates**: Monitor error frequency and types
- **Resource Usage**: Track CPU, memory, and storage utilization
- **Uptime**: Monitor service availability and reliability

### 3. **Business Intelligence**
- **Cost Analysis**: Track usage costs across different providers
- **Feature Adoption**: Monitor usage of different features
- **Quality Metrics**: Assess generation quality and user satisfaction
- **Growth Metrics**: Track user acquisition and retention

## Implementation Status

### ✅ Phase 1: Core Intelligence Platform (COMPLETED)
- [x] Multi-provider LLM integration (OpenAI GPT-4o, Anthropic Sonnet 4, Google Gemini 2.5)
- [x] Vision/multimodal support for image analysis across all providers
- [x] Template-based prompt management with file system (no KV dependency)
- [x] Algolia article integration with posts-v2 index
- [x] Wanx-compatible video script generation with structured JSON output
- [x] Scene planning service with timing extraction
- [x] Langfuse tracing and comprehensive observability
- [x] Authentication and rate limiting
- [x] Storage and download functionality

### 🚧 Phase 2: Video Production Pipeline (60% Complete)
- [x] Article-to-script generation (direct input + Algolia fetching)
- [x] Scene planning and timing breakdown
- [x] Argil avatar workflow endpoints
- [ ] Asset orchestration integration with new script system
- [ ] Audio/TTS generation integration
- [ ] Video assembly workflow updates

### 📋 Phase 3: Testing & Production Readiness (40% Complete)
- [ ] Comprehensive unit tests for LLM and Algolia services
- [ ] Integration tests for full article-to-video pipeline
- [ ] Performance optimization and caching strategies
- [ ] Enhanced error handling and recovery mechanisms

### 🔮 Phase 4: Advanced Features (Planned)
- [ ] Ken Burns effects and advanced video composition
- [ ] Multi-workflow orchestration system
- [ ] Real-time configuration updates
- [ ] Advanced analytics dashboard and insights

## Key Implemented Services & Endpoints

### 🤖 Multi-Provider LLM Service (`src/services/multi-provider-llm.ts`)
- **Providers**: OpenAI GPT-4o, Anthropic Claude Sonnet 4, Google Gemini 2.5 Flash
- **Features**: Text generation, vision/multimodal support, structured JSON output
- **Capabilities**: Provider fallback, cost estimation, model validation

### 📚 Algolia Integration (`src/services/algolia.ts` + `src/handlers/articles.ts`)
- **Index**: posts-v2 (Tech in Asia articles)
- **Endpoints**: 
  - `GET /api/articles/search` - Search with filters
  - `GET /api/articles/:objectId` - Get specific article
  - `POST /api/articles/search/title` - Title-based search
  - `GET /api/articles/video-candidates` - Articles suitable for video generation

### 📝 Video Script Generation (`src/handlers/scripts.ts`)
- **Endpoint**: `POST /api/scripts/generate-video-script`
- **Input**: Direct content OR Algolia object ID (auto-fetch)
- **Features**: Multi-provider LLM, optional image analysis, custom instructions
- **Output**: Wanx-compatible structured JSON with hook, conflict, body, conclusion

### 🎬 Scene Planning Service (`src/services/scene-planning.ts`)
- **Endpoint**: `POST /api/scripts/plan-scenes`
- **Features**: Automatic timing extraction, scene breakdown, asset suggestions
- **Input**: Video script + transcription data
- **Output**: Timed scenes with visual directions and B-roll keywords

### 📊 Langfuse Tracing (`src/services/llm-tracing.ts`)
- **Features**: Comprehensive LLM operation tracking, performance metrics
- **Traces**: Script generation, image analysis, template processing, provider usage
- **Analytics**: Token usage, response times, success rates, error tracking

### 📋 Template System (`src/templates/prompts/`)
- **Approach**: File-based templates (no KV storage dependency)
- **Engine**: Handlebars-style template rendering
- **Templates**: Gen-Z Tech in Asia video script generation prompt
- **Features**: Conditional blocks, variable substitution, custom instructions

## Best Practices

### 1. **Code Quality**
- **Consistent Formatting**: Use Prettier for consistent code style
- **Type Safety**: Leverage TypeScript's strict mode
- **Error Handling**: Implement comprehensive error handling
- **Documentation**: Write clear JSDoc comments for all public APIs

### 2. **Testing**
- **Test Coverage**: Maintain >95% test coverage
- **Test Pyramid**: Balance unit, integration, and e2e tests
- **Mock Strategies**: Use appropriate mocking for external dependencies
- **Performance Testing**: Include performance benchmarks in test suite

### 3. **Security**
- **Input Validation**: Validate all inputs at the boundary
- **Least Privilege**: Grant minimal necessary permissions
- **Secure Defaults**: Use secure configurations by default
- **Regular Updates**: Keep dependencies updated and secure

### 4. **Operations**
- **Monitoring**: Implement comprehensive monitoring and alerting
- **Logging**: Use structured logging for better observability
- **Deployment**: Automate deployment processes
- **Backup & Recovery**: Implement robust backup and recovery procedures

## Integration with Existing Systems

### wanx Legacy Integration
- **Asset Migration**: Tools for migrating existing media assets
- **Workflow Compatibility**: Support for existing video generation workflows
- **API Compatibility**: Backward-compatible API endpoints where possible
- **Data Migration**: Scripts for migrating user data and configurations

### gimme_ai Orchestration
- **Workflow Integration**: Support for gimme_ai workflow orchestration
- **Configuration Management**: Shared configuration management
- **Monitoring Integration**: Unified monitoring and alerting
- **Deployment Coordination**: Coordinated deployment processes

This documentation provides a comprehensive foundation for the aidobe project, incorporating lessons learned from the wanx implementation while establishing modern, scalable patterns for the future.