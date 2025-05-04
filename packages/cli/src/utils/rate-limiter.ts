/**
 * Simple rate limiter for API calls
 */
export class RateLimiter {
  private queue: Array<{
    task: () => Promise<any>,
    resolve: (value: any) => void,
    reject: (reason: any) => void
  }> = [];
  private running = 0;
  private maxRequests: number;
  private intervalMs: number;
  private lastRequestTime: number = 0;

  /**
   * Create a new RateLimiter
   * @param options Configuration options
   * @param options.maxRequests Maximum number of concurrent requests
   * @param options.intervalMs Minimum time between requests in milliseconds
   */
  constructor(options: { maxRequests: number; intervalMs: number }) {
    this.maxRequests = options.maxRequests;
    this.intervalMs = options.intervalMs;
  }

  /**
   * Schedule a task to be executed with rate limiting
   * @param task Function to execute
   * @returns Promise that resolves with the result of the task
   */
  public schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve: resolve as (value: any) => void,
        reject
      });

      this.processQueue();
    });
  }

  /**
   * Process the queue of tasks
   */
  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.maxRequests) {
      return;
    }

    const now = Date.now();
    const timeToWait = Math.max(0, this.lastRequestTime + this.intervalMs - now);

    setTimeout(() => {
      if (this.queue.length === 0 || this.running >= this.maxRequests) {
        return;
      }

      const { task, resolve, reject } = this.queue.shift()!;
      this.running++;
      this.lastRequestTime = Date.now();

      task()
        .then(result => {
          resolve(result);
          this.running--;
          this.processQueue();
        })
        .catch(error => {
          reject(error);
          this.running--;
          this.processQueue();
        });
    }, timeToWait);
  }
}