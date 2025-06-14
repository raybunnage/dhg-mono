# ClaudeService Migration

## Overview
Migrated ClaudeService from flawed singleton pattern to SingletonService base class for proper lifecycle management and enhanced API interaction capabilities.

## Migration Details

### Service Type
- **Name**: ClaudeService
- **Pattern**: SingletonService (critical infrastructure service managing Claude AI API)
- **Location**: `packages/shared/services/claude-service-refactored/`

### Changes Made

#### 1. Pattern Migration
- **From**: Flawed singleton with getInstance() and private constructor
- **To**: SingletonService base class
- **Breaking Changes**: None - 100% backwards compatible

#### 2. New Features Added
- **Retry Logic**: Exponential backoff for failed requests
- **Request Queuing**: Queue requests when at capacity
- **Rate Limiting**: Max concurrent requests (default: 5)
- **Token Tracking**: Track input/output token usage
- **Cost Estimation**: Estimate API costs based on usage
- **Connection Testing**: Validate API connection on initialization
- **Configurable Options**: Support runtime configuration updates
- **Request Timeout**: Configurable timeout with AbortController
- **Health Check**: Monitor service health and API status

#### 3. Performance Improvements
- Prevents API overload with concurrent request limits
- Retry logic improves reliability (3 retries by default)
- Request queuing ensures no requests are dropped
- Connection pooling for better throughput

### API Changes
All existing methods maintained for backwards compatibility:
- `sendPrompt(prompt, options?)` - Enhanced with retry, queuing, timeout
- `getJsonResponse<T>(prompt, options?)` - Enhanced JSON parsing

New methods added:
- `ensureInitialized()` - Public initialization method
- `healthCheck()` - Service health monitoring
- `updateConfig(config)` - Runtime configuration updates
- `getStatistics()` - Usage statistics and cost estimation
- `resetStatistics()` - Reset usage counters
- `streamPrompt()` - Placeholder for future streaming support

### Enhanced Options

```typescript
interface ClaudeOptions {
  model?: string;        // Override default model
  maxTokens?: number;    // Max response tokens
  temperature?: number;  // Response creativity
  system?: string;       // System prompt
  timeout?: number;      // Request timeout (ms)
  retries?: number;      // Number of retries
}

interface ClaudeServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
  defaultModel?: string;
  maxRetries?: number;
  retryDelay?: number;
  requestTimeout?: number;
  maxConcurrentRequests?: number;
}
```

### Usage Example

```typescript
// Old usage (still works)
import { claudeService } from '@shared/services/claude-service';
const response = await claudeService.sendPrompt('Hello Claude');

// New usage (recommended)
import { ClaudeService } from '@shared/services/claude-service';
const claude = ClaudeService.getInstance({
  maxConcurrentRequests: 10,
  requestTimeout: 60000
});
await claude.ensureInitialized();

// Send prompt with options
const response = await claude.sendPrompt('Complex task', {
  maxTokens: 8000,
  temperature: 0.7,
  timeout: 45000,
  retries: 5
});

// Get statistics
const stats = claude.getStatistics();
console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Estimated cost: $${stats.estimatedCost.total.toFixed(2)}`);
```

### Error Handling

The service now provides better error handling:
- Automatic retry for transient errors (5xx status codes)
- No retry for client errors (4xx status codes)
- Timeout errors with clear messages
- Queue overflow protection

### Migration Impact
- **No breaking changes** - Drop-in replacement
- **Better reliability** - Retry logic and error handling
- **Resource protection** - Request limits and queuing
- **Cost visibility** - Token tracking and estimation

### Files Changed
1. Created `packages/shared/services/claude-service-refactored/`
2. Archived original to `.archived_services/claude-service.20250113/`
3. Updated `packages/shared/services/claude-service/index.ts` to re-export
4. Fixed import path in `CLAUDE.md` documentation
5. Updated database entries in `sys_shared_services` and `sys_service_migration_log`

### Lessons Learned
1. Critical API services need robust error handling and retry logic
2. Request queuing essential for rate-limited APIs
3. Token tracking helps monitor costs
4. SingletonService pattern perfect for API client services
5. Configuration flexibility important for different environments