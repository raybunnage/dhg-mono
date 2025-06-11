/**
 * Simple in-memory cache for Supabase queries
 * Reduces bandwidth usage by caching frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class SupabaseCache {
  private static instance: SupabaseCache;
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): SupabaseCache {
    if (!SupabaseCache.instance) {
      SupabaseCache.instance = new SupabaseCache();
    }
    return SupabaseCache.instance;
  }

  /**
   * Get cached data or null if expired/not found
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache entry with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  /**
   * Clear specific key or entire cache
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.entries());
    const totalSize = entries.reduce((acc, [key, entry]) => {
      return acc + JSON.stringify(entry.data).length;
    }, 0);

    return {
      entries: this.cache.size,
      approximateSizeKB: Math.round(totalSize / 1024),
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Cached query wrapper
 * Use this to wrap Supabase queries and reduce bandwidth
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cache = SupabaseCache.getInstance();
  
  // Check cache first
  const cached = cache.get<T>(key);
  if (cached !== null) {
    console.debug(`Cache hit for: ${key}`);
    return cached;
  }

  // Execute query and cache result
  console.debug(`Cache miss for: ${key}`);
  const result = await queryFn();
  cache.set(key, result, ttl);
  
  return result;
}

/**
 * Example usage:
 * 
 * const experts = await cachedQuery(
 *   'experts-list',
 *   async () => {
 *     const { data } = await supabase.from('expert_profiles').select('id, name');
 *     return data;
 *   },
 *   10 * 60 * 1000 // 10 minutes
 * );
 */