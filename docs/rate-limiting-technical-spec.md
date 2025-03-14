# Technical Specification: Rate Limiting for Claude API Calls

## Overview

This document outlines the technical specifications for implementing rate limiting in the documentation analysis pipeline to prevent exceeding Anthropic's API rate limits while preserving the multi-threaded architecture.

## Problem Statement

The current implementation processes multiple files in parallel, which efficiently utilizes system resources but quickly exceeds Anthropic's Claude API rate limits. This causes API requests to fail with rate limit errors, preventing the successful processing of large batches of files.

Anthropic typically enforces the following limits:
- Requests per minute (RPM) limits (typically 5-15 RPM for most tiers)
- Tokens per minute (TPM) limits
- Concurrent request limits

## Requirements

1. **Preserve Multi-threading**: Maintain the existing multi-threaded architecture
2. **Comply with Rate Limits**: Ensure API calls don't exceed Anthropic's limits
3. **Minimal Changes**: Implement with minimal modifications to the existing codebase
4. **Transparency**: Provide visibility into rate limiting status
5. **Configurability**: Allow easy adjustment of rate limiting parameters

## Proposed Solution

Implement a token bucket rate limiter that will control the flow of requests to the Claude API while allowing the rest of the processing pipeline to continue operating in parallel.

### 1. Rate Limiter Implementation

Create a `RateLimiter` class that implements the token bucket algorithm:

```typescript
// src/utils/rate-limiter.ts
export class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second
  private lastRefillTimestamp: number;
  private queue: Array<() => void> = [];
  private processing = false;

  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefillTimestamp = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTimestamp) / 1000; // in seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }

  async acquire(cost = 1): Promise<void> {
    this.refillTokens();
    
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return Promise.resolve();
    }
    
    // If not enough tokens, wait in queue
    return new Promise<void>(resolve => {
      this.queue.push(() => {
        this.tokens -= cost;
        resolve();
      });
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    
    this.processing = true;
    
    // Wait until we have at least one token
    while (this.tokens < 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
      this.refillTokens();
    }
    
    // Process next item in queue
    const next = this.queue.shift();
    if (next) {
      next();
    }
    
    // Continue processing queue
    setTimeout(() => this.processQueue(), 50);
  }
}

// Create a singleton instance for Claude API
export const claudeRateLimiter = new RateLimiter(
  3,     // max tokens (requests) - allow bursts of up to 3 requests
  0.167  // refill rate (requests per second) - 10 requests per minute
);
```

### 2. Integration with Claude Service

Modify the Claude service to use the rate limiter before making API calls:

```typescript
// src/services/claude-service.ts
import { claudeRateLimiter } from '../utils/rate-limiter';
import { logger } from '../utils/logger';

export class ClaudeService {
  // ... existing code ...
  
  async callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse> {
    try {
      // Wait for rate limiter to allow the request
      await claudeRateLimiter.acquire(1);
      
      logger.debug(`Calling Claude API with model: ${request.model}`);
      
      // ... existing API call code ...
      
    } catch (error) {
      // ... existing error handling ...
    }
  }
}
```

### 3. Configuration

Add rate limiting configuration to the application settings:

```typescript
// src/utils/config.ts
export default {
  // ... existing config ...
  
  rateLimits: {
    claude: {
      maxTokens: 3,           // Maximum burst capacity
      refillRate: 0.167,      // Tokens per second (10 per minute)
      enabled: true           // Enable/disable rate limiting
    }
  }
};
```

Update the rate limiter initialization to use these settings:

```typescript
// src/utils/rate-limiter.ts
import config from './config';

// Create a singleton instance for Claude API
export const claudeRateLimiter = new RateLimiter(
  config.rateLimits.claude.maxTokens,
  config.rateLimits.claude.refillRate
);
```

## Implementation Plan

### Phase 1: Core Rate Limiter

1. Create the `RateLimiter` class in `src/utils/rate-limiter.ts`
2. Add rate limiting configuration to `src/utils/config.ts`
3. Create the singleton `claudeRateLimiter` instance

### Phase 2: Claude Service Integration

1. Modify the `callClaudeApi` method in `ClaudeService` to use the rate limiter
2. Add appropriate logging for rate limiting events

### Phase 3: Testing

1. Test with small batches to verify rate limiting works
2. Monitor API responses for rate limit errors
3. Adjust rate limiting parameters if needed

## Usage

The rate limiter is transparent to the rest of the application. The only change in usage is that API calls may take longer to complete due to rate limiting.

Example of how the rate limiter affects the code flow:

```typescript
// Before rate limiting
async function processFile(file) {
  const result = await claudeService.classifyDocument(file.content);
  // Process result...
}

// After rate limiting (no change to this function)
async function processFile(file) {
  const result = await claudeService.classifyDocument(file.content);
  // Process result...
}

// The rate limiting happens inside the claudeService.classifyDocument method
```

## Rate Limit Parameter Calculation

To calculate appropriate rate limiting parameters:

1. **For RPM limits**:
   - If limit is 10 RPM: `refillRate = 10/60 = 0.167` tokens per second
   - `maxTokens` should be set to allow reasonable bursts (2-3 is typical)

2. **For TPM limits**:
   - Calculate average tokens per request
   - Adjust `cost` parameter in `acquire()` based on estimated token usage

## Pros and Cons

### Pros

1. **Preserves Multi-threading**: The architecture remains multi-threaded, only the Claude API calls are throttled
2. **Minimal Changes**: Only requires adding a rate limiter and modifying the API call function
3. **Adaptive**: Automatically adjusts to different rate limits by changing parameters
4. **Efficient**: Uses a token bucket algorithm that allows for bursts while maintaining average limits

### Cons

1. **Increased Processing Time**: Overall processing will take longer due to rate limiting
2. **Memory Usage**: Queued requests remain in memory while waiting
3. **Complexity**: Adds another layer to the architecture

## Future Enhancements

The following enhancements are not part of the initial implementation but could be added in the future:

### 1. Enhanced Status Reporting

Add methods to the `RateLimiter` class to report on its status:

```typescript
// Add to RateLimiter class
private waitingCount = 0;

async acquire(cost = 1): Promise<void> {
  this.waitingCount++;
  
  try {
    // Existing code...
  } finally {
    this.waitingCount--;
  }
}

getStatus(): { tokens: number, queueLength: number, waitingCount: number } {
  this.refillTokens();
  return {
    tokens: this.tokens,
    queueLength: this.queue.length,
    waitingCount: this.waitingCount
  };
}
```

### 2. Cost-Based Rate Limiting

Implement token-based cost calculation for more precise control:

```typescript
async callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse> {
  try {
    // Estimate token cost (input + expected output)
    const estimatedInputTokens = this.estimateTokenCount(request.messages);
    const totalEstimatedTokens = estimatedInputTokens + (request.max_tokens || 4000);
    
    // Calculate cost factor (1 unit per 1000 tokens)
    const costFactor = Math.max(1, Math.ceil(totalEstimatedTokens / 1000));
    
    // Wait for rate limiter to allow the request
    await claudeRateLimiter.acquire(costFactor);
    
    // Existing code...
  } catch (error) {
    // Existing error handling...
  }
}
```

### 3. Progress Reporting Enhancements

Add rate limiter status to progress reports:

```typescript
async processAllFiles(options): Promise<void> {
  // Existing code...
  
  const reportProgress = () => {
    // Existing progress reporting...
    
    const limiterStatus = claudeRateLimiter.getStatus();
    console.log(`Rate limiter: ${limiterStatus.tokens.toFixed(1)} tokens available, ${limiterStatus.queueLength} in queue`);
  };
  
  const progressInterval = setInterval(reportProgress, 30000);
  
  try {
    // Processing code...
  } finally {
    clearInterval(progressInterval);
  }
}
```

### 4. Adaptive Rate Limiting

Implement adaptive rate limiting that adjusts based on API responses:

```typescript
async callClaudeApi(request: ClaudeRequest): Promise<ClaudeResponse> {
  try {
    await claudeRateLimiter.acquire(1);
    
    const response = await makeApiCall();
    
    if (response.headers['x-ratelimit-remaining']) {
      // Adjust rate limiter based on headers
      const remaining = parseInt(response.headers['x-ratelimit-remaining']);
      const reset = parseInt(response.headers['x-ratelimit-reset']);
      
      // Update rate limiter parameters
      // Implementation details...
    }
    
    return response;
  } catch (error) {
    // Existing error handling...
  }
}
```

## Conclusion

This rate limiting implementation provides a solution that:

1. Preserves the multi-threaded architecture of the existing pipeline
2. Ensures compliance with Anthropic's API rate limits
3. Requires minimal changes to the existing codebase
4. Can be easily configured to adapt to different rate limit requirements

By implementing this solution, the documentation analysis pipeline will be able to process large batches of files without encountering rate limit errors, while still maintaining the efficiency benefits of parallel processing for other operations. 