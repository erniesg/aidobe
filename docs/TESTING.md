# Testing Strategy for aidobe

## Overview

We follow Test-Driven Development (TDD) for critical features, focusing on:
- Input validation
- Output data types
- Error handling
- Security boundaries

## Test Structure

```
tests/
├── unit/              # Fast, isolated tests
│   ├── auth.test.ts   # Authentication middleware
│   ├── schemas.test.ts # Input validation schemas
│   ├── openai.test.ts # OpenAI service
│   └── replicate.test.ts # Replicate service
├── integration/       # API endpoint tests
└── e2e/              # End-to-end workflows
```

## Running Tests

```bash
# Run all tests in watch mode
npm test

# Run tests once (for CI/pre-commit)
npm run test:run

# Run only critical unit tests
npm run test:critical

# Generate coverage report
npm run test:coverage

# Interactive UI
npm run test:ui
```

## Pre-commit Hooks

Tests run automatically before each commit:
1. Type checking (`npm run typecheck`)
2. Unit tests (`npm test`)
3. Linting and formatting (`lint-staged`)

## Critical Test Areas

### 1. Authentication (auth.test.ts)
- Bearer token validation
- Password verification
- Environment configuration
- Error responses

### 2. Input Validation (schemas.test.ts)
- Zod schema validation
- Parameter boundaries
- Type coercion
- Error messages

### 3. OpenAI Service (openai.test.ts)
- API request formatting
- Response parsing
- Error handling
- Rate limiting

### 4. Replicate Service (replicate.test.ts)
- Model validation
- Prediction polling
- Timeout handling
- Output formats

## Test Coverage Goals

- **Unit Tests**: >90% coverage for services and utilities
- **Integration Tests**: All API endpoints covered
- **Critical Paths**: 100% coverage for auth and validation

## Writing New Tests

### Test Template
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Feature Name', () => {
  describe('Input validation', () => {
    it('should validate required fields', () => {
      // Test implementation
    })
  })

  describe('Output types', () => {
    it('should return correct data structure', () => {
      // Test implementation
    })
  })

  describe('Error handling', () => {
    it('should handle API errors gracefully', () => {
      // Test implementation
    })
  })
})
```

### Mocking External Services
```typescript
const mockFetch = vi.fn()
global.fetch = mockFetch

mockFetch.mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'mocked' })
})
```

## Best Practices

1. **Test behavior, not implementation**
   - Focus on inputs and outputs
   - Don't test internal implementation details

2. **Use descriptive test names**
   - `should reject empty authorization header`
   - `should handle malformed API response`

3. **Keep tests isolated**
   - Clear mocks in `beforeEach`/`afterEach`
   - No shared state between tests

4. **Test edge cases**
   - Empty inputs
   - Special characters
   - Boundary values
   - Network failures

5. **Mock external dependencies**
   - API calls
   - Database operations
   - File system access

## Continuous Integration

Tests run automatically on:
- Pre-commit hooks
- Pull request checks
- Deployment pipeline

Failed tests block commits and deployments to maintain code quality.