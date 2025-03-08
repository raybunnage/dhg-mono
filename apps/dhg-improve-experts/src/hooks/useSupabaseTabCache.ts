import { useState, useEffect } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

type CacheMap<T> = Record<string, CacheItem<T>>;

interface UseSupabaseTabCacheResult<T> {
  cachedData: T | null;
  setCachedData: (key: string, data: T) => void;
  clearCache: (key?: string) => void;
  isCached: (key: string) => boolean;
  loading: boolean;
}

/**
 * Custom hook for caching Supabase tab data to prevent unnecessary refetching
 * @param cacheKey A unique key for this particular cache (e.g., 'schema', 'tableData')
 * @param expirationTime Expiration time in milliseconds (default: 5 minutes)
 */
export function useSupabaseTabCache<T>(
  cacheKey: string,
  expirationTime: number = 5 * 60 * 1000
): UseSupabaseTabCacheResult<T> {
  // Use different storage keys for different cache types
  const storageKey = `supabase_${cacheKey}_cache`;
  
  // Initialize state from localStorage if it exists
  const [cache, setCache] = useState<CacheMap<T>>(() => {
    try {
      const storedCache = localStorage.getItem(storageKey);
      return storedCache ? JSON.parse(storedCache) : {};
    } catch (error) {
      console.error("Error loading cache from localStorage:", error);
      return {};
    }
  });
  
  const [cachedData, setCachedDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  // Save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cache));
    } catch (error) {
      console.error("Error saving cache to localStorage:", error);
    }
  }, [cache, storageKey]);

  // Function to check if a key is cached and not expired
  const isCached = (key: string): boolean => {
    if (!cache[key]) return false;
    
    const now = Date.now();
    return now - cache[key].timestamp < expirationTime;
  };

  // Function to set cached data
  const setCachedData = (key: string, data: T) => {
    setLoading(true);
    const cacheItem: CacheItem<T> = {
      data,
      timestamp: Date.now()
    };
    
    setCache(prev => ({
      ...prev,
      [key]: cacheItem
    }));
    
    setCachedDataState(data);
    setLoading(false);
  };

  // Function to clear specific cache or all cache
  const clearCache = (key?: string) => {
    if (key) {
      setCache(prev => {
        const newCache = { ...prev };
        delete newCache[key];
        return newCache;
      });
      
      if (cachedData) {
        setCachedDataState(null);
      }
    } else {
      // Clear entire cache
      setCache({});
      setCachedDataState(null);
    }
  };

  return {
    cachedData,
    setCachedData,
    clearCache,
    isCached,
    loading
  };
}