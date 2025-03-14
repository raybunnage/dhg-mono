/**
 * Token Bucket Rate Limiter
 * Implements a token bucket algorithm to control request rates
 */
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

  getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

// Create a singleton instance for Claude API with default settings
// 10 requests per minute = 1 request per 6 seconds = 0.167 requests per second
export const claudeRateLimiter = new RateLimiter(
  3,     // max tokens (requests) - allow bursts of up to 3 requests
  0.167  // refill rate (requests per second) - 10 requests per minute
);