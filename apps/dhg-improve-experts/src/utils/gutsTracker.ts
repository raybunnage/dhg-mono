import { supabase } from '../integrations/supabase/client';

/**
 * Utility to track Supabase table usage, function usage, and dependencies for the Guts dashboard
 * Implements a hybrid approach with batching and debouncing for efficient database operations
 */
export class GutsTracker {
  private static pageId: string | null = null;
  private static pagePath: string | null = null;
  private static appName: string | null = null;
  private static isInitialized = false;
  
  // Batching queues
  private static tableBatch: Array<{
    table_name: string;
    operations: string[];
    is_primary: boolean;
  }> = [];
  
  private static functionBatch: Array<{
    function_id: string;
    usage_type: string;
  }> = [];
  
  private static dependencyBatch: Array<{
    dependency_type: string;
    dependency_name: string;
    details: any;
  }> = [];
  
  // Batch size before sending to database
  private static BATCH_SIZE = 10;
  
  // Debounce timer for flushing batches
  private static flushTimer: ReturnType<typeof setTimeout> | null = null;
  private static FLUSH_INTERVAL = 5000; // 5 seconds
  
  /**
   * Initialize the tracker for a specific page
   * @param pagePath The path of the page
   * @param appName The name of the app
   */
  static async initialize(pagePath: string, appName: string): Promise<void> {
    if (this.isInitialized && this.pagePath === pagePath && this.appName === appName) {
      return; // Already initialized for this page
    }
    
    this.pagePath = pagePath;
    this.appName = appName;
    this.clearBatches();
    
    try {
      // Register the page and get its ID
      const { data, error } = await supabase
        .rpc('get_or_create_page', {
          p_app_name: appName,
          p_page_name: pagePath.split('/').pop() || pagePath,
          p_page_path: pagePath
        });
      
      if (error) {
        console.error('Error initializing GutsTracker:', error);
        return;
      }
      
      this.pageId = data;
      this.isInitialized = true;
      console.log(`GutsTracker initialized for ${pagePath} in ${appName}`);
      
      // Set up flush timer
      this.setupFlushTimer();
    } catch (err) {
      console.error('Unexpected error initializing GutsTracker:', err);
    }
  }
  
  /**
   * Track usage of a Supabase table
   * @param tableName The name of the table
   * @param operations Array of operations performed on the table (select, insert, update, delete)
   * @param isPrimary Whether this is a primary table for the page
   */
  static trackTableUsage(
    tableName: string, 
    operations: string[] = ['select'], 
    isPrimary: boolean = false
  ): void {
    if (!this.isInitialized || !this.pageId) {
      console.warn('GutsTracker not initialized. Call initialize() first.');
      return;
    }
    
    // Check if this table is already in the batch with the same operations
    const existingIndex = this.tableBatch.findIndex(
      item => item.table_name === tableName
    );
    
    if (existingIndex >= 0) {
      // Update existing entry
      const existing = this.tableBatch[existingIndex];
      const mergedOperations = [...new Set([...existing.operations, ...operations])];
      this.tableBatch[existingIndex] = {
        ...existing,
        operations: mergedOperations,
        is_primary: existing.is_primary || isPrimary
      };
    } else {
      // Add to batch
      this.tableBatch.push({
        table_name: tableName,
        operations,
        is_primary: isPrimary
      });
    }
    
    // Flush if batch is full
    if (this.tableBatch.length >= this.BATCH_SIZE) {
      this.flushTableBatch();
    }
  }
  
  /**
   * Track usage of a function
   * @param functionId The ID of the function in the function_registry
   * @param usageType How the function is used (direct, imported, referenced)
   */
  static trackFunctionUsage(
    functionId: string,
    usageType: string = 'direct'
  ): void {
    if (!this.isInitialized || !this.pageId) {
      console.warn('GutsTracker not initialized. Call initialize() first.');
      return;
    }
    
    // Check if this function is already in the batch
    const existingIndex = this.functionBatch.findIndex(
      item => item.function_id === functionId
    );
    
    if (existingIndex >= 0) {
      // Update existing entry if the usage type is different
      if (this.functionBatch[existingIndex].usage_type !== usageType) {
        this.functionBatch[existingIndex].usage_type = usageType;
      }
    } else {
      // Add to batch
      this.functionBatch.push({
        function_id: functionId,
        usage_type: usageType
      });
    }
    
    // Flush if batch is full
    if (this.functionBatch.length >= this.BATCH_SIZE) {
      this.flushFunctionBatch();
    }
  }
  
  /**
   * Track an external dependency
   * @param dependencyType The type of dependency (google_drive, ai_service, external_api, etc.)
   * @param dependencyName The name of the dependency
   * @param details Additional details about the dependency
   */
  static trackDependency(
    dependencyType: string,
    dependencyName: string,
    details: any = null
  ): void {
    if (!this.isInitialized || !this.pageId) {
      console.warn('GutsTracker not initialized. Call initialize() first.');
      return;
    }
    
    // Check if this dependency is already in the batch
    const existingIndex = this.dependencyBatch.findIndex(
      item => item.dependency_type === dependencyType && 
             item.dependency_name === dependencyName
    );
    
    if (existingIndex >= 0) {
      // Update existing entry if details are different
      if (JSON.stringify(this.dependencyBatch[existingIndex].details) !== JSON.stringify(details)) {
        this.dependencyBatch[existingIndex].details = details;
      }
    } else {
      // Add to batch
      this.dependencyBatch.push({
        dependency_type: dependencyType,
        dependency_name: dependencyName,
        details
      });
    }
    
    // Flush if batch is full
    if (this.dependencyBatch.length >= this.BATCH_SIZE) {
      this.flushDependencyBatch();
    }
  }
  
  /**
   * Flush all batches to the database
   */
  static async flushAllBatches(): Promise<void> {
    if (!this.isInitialized || !this.pageId) {
      return;
    }
    
    // Process tables
    await this.flushTableBatch();
    
    // Process functions
    await this.flushFunctionBatch();
    
    // Process dependencies
    await this.flushDependencyBatch();
  }
  
  /**
   * Flush table batch to the database
   */
  private static async flushTableBatch(): Promise<void> {
    if (!this.isInitialized || !this.pageId || this.tableBatch.length === 0) {
      return;
    }
    
    const batchToProcess = [...this.tableBatch];
    this.tableBatch = [];
    
    try {
      // Process each table usage in sequence
      for (const item of batchToProcess) {
        // Insert directly into the page_table_usage table
        const { error } = await supabase
          .from('page_table_usage')
          .insert({
            page_id: this.pageId,
            table_name: item.table_name,
            operations: item.operations, // This should be an array of operations
            success: true,
            is_primary: item.is_primary
          });
        
        if (error) {
          console.error(`Error tracking table usage for ${item.table_name}:`, error);
        }
      }
    } catch (err) {
      console.error('Error flushing table batch:', err);
    }
  }
  
  /**
   * Flush function batch to the database
   */
  private static async flushFunctionBatch(): Promise<void> {
    if (!this.isInitialized || !this.pageId || this.functionBatch.length === 0) {
      return;
    }
    
    const batchToProcess = [...this.functionBatch];
    this.functionBatch = [];
    
    try {
      // Process each function usage in sequence
      for (const item of batchToProcess) {
        // Insert directly into the page_function_usage table
        const { error } = await supabase
          .from('page_function_usage')
          .insert({
            page_id: this.pageId,
            function_name: item.function_id,
            call_type: item.usage_type,
            success: true
          });
        
        if (error) {
          console.error(`Error tracking function usage for ${item.function_id}:`, error);
        }
      }
    } catch (err) {
      console.error('Error flushing function batch:', err);
    }
  }
  
  /**
   * Flush dependency batch to the database
   */
  private static async flushDependencyBatch(): Promise<void> {
    if (!this.isInitialized || !this.pageId || this.dependencyBatch.length === 0) {
      return;
    }
    
    const batchToProcess = [...this.dependencyBatch];
    this.dependencyBatch = [];
    
    try {
      // Process each dependency in sequence
      for (const item of batchToProcess) {
        // Insert directly into the page_dependencies table
        const { error } = await supabase
          .from('page_dependencies')
          .insert({
            page_id: this.pageId,
            dependency_type: item.dependency_type,
            dependency_name: item.dependency_name,
            details: item.details
          });
        
        if (error) {
          console.error(`Error tracking dependency ${item.dependency_name}:`, error);
        }
      }
    } catch (err) {
      console.error('Error flushing dependency batch:', err);
    }
  }
  
  /**
   * Clear all batches
   */
  private static clearBatches(): void {
    this.tableBatch = [];
    this.functionBatch = [];
    this.dependencyBatch = [];
  }
  
  /**
   * Set up flush timer
   */
  private static setupFlushTimer(): void {
    // Clear existing timer if any
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    
    // Set up new timer
    this.flushTimer = setTimeout(() => {
      this.flushAllBatches();
      this.setupFlushTimer(); // Set up next timer
    }, this.FLUSH_INTERVAL);
  }
  
  /**
   * Create a wrapped Supabase client that automatically tracks table usage
   * @returns A wrapped Supabase client that tracks table usage
   */
  static getTrackedSupabaseClient() {
    if (!this.isInitialized) {
      console.warn('GutsTracker not initialized. Call initialize() first.');
      return supabase;
    }
    
    // Create a proxy to intercept Supabase client calls
    const handler = {
      get: (target: any, prop: string) => {
        // If accessing a table method
        if (prop === 'from') {
          return (tableName: string) => {
            const originalFrom = target.from(tableName);
            
            // Create proxies for each query method
            const methodHandler = {
              get: (methodTarget: any, methodProp: string) => {
                const originalMethod = methodTarget[methodProp];
                
                // If it's a query method we want to track
                if (['select', 'insert', 'update', 'delete', 'upsert'].includes(methodProp)) {
                  return (...args: any[]) => {
                    // Track the table usage - Make sure the operation is in an array format
                    this.trackTableUsage(tableName, [methodProp], false);
                    
                    // Call the original method
                    return originalMethod.apply(methodTarget, args);
                  };
                }
                
                return originalMethod;
              }
            };
            
            return new Proxy(originalFrom, methodHandler);
          };
        }
        
        // If accessing RPC method
        if (prop === 'rpc') {
          return (functionName: string, params?: any) => {
            // We could potentially track RPC calls here
            // But we'd need to map function names to function_registry IDs
            
            return target.rpc(functionName, params);
          };
        }
        
        return target[prop];
      }
    };
    
    return new Proxy(supabase, handler);
  }
  
  /**
   * Clean up resources when component unmounts
   */
  static cleanup(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining items
    this.flushAllBatches();
  }
}

/**
 * Decorator to track function usage
 * @param functionId The ID of the function in the function_registry
 * @param usageType How the function is used
 */
export function trackFunction(functionId: string, usageType: string = 'direct') {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      GutsTracker.trackFunctionUsage(functionId, usageType);
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Decorator to track external dependency usage
 * @param dependencyType The type of dependency
 * @param dependencyName The name of the dependency
 * @param details Additional details about the dependency
 */
export function trackDependency(
  dependencyType: string,
  dependencyName: string,
  details: any = null
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      GutsTracker.trackDependency(dependencyType, dependencyName, details);
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Hook to use the tracked Supabase client
 * @returns A Supabase client that automatically tracks table usage
 */
export function useTrackedSupabase() {
  return GutsTracker.getTrackedSupabaseClient();
} 