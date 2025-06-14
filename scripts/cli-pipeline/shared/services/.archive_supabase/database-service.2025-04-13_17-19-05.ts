/**
 * Database Service
 * 
 * Provides database interaction through Supabase, with transaction support,
 * error handling, and query optimization.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DatabaseConfig } from '../interfaces/types';
import { environmentService } from './environment-service';
import { nodeLogger as logger } from '@shared/services/logger/logger-node';

/**
 * Query options for the query method
 */
interface QueryOptions {
  select: string;
  filter?: Record<string, any>;
  order?: {
    column: string;
    ascending: boolean;
  };
  limit?: number;
  offset?: number;
}

/**
 * Database Service implementation
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private client: SupabaseClient | null = null;
  private url: string;
  private key: string;
  private connected: boolean = false;
  
  /**
   * Create a database service
   * Private constructor to enforce singleton pattern
   */
  private constructor(config?: DatabaseConfig) {
    // First try direct config, then try environment service
    this.url = config?.url || environmentService.get('supabaseUrl');
    
    // For the key, first try the provided config, then try service role key, then fall back to regular key
    this.key = config?.key || 
               process.env.SUPABASE_SERVICE_ROLE_KEY || 
               environmentService.get('supabaseKey');
    
    // Log connection parameters (with sensitive data masked)
    const maskedKey = this.key ? `${this.key.substring(0, 5)}...${this.key.substring(this.key.length - 4)}` : 'Not set';
    logger.debug('Database configuration', { 
      url: this.url,
      keyPreview: maskedKey,
      keyLength: this.key?.length || 0
    });
    
    if (!this.url || !this.key) {
      logger.error('Missing Supabase URL or key. Please check your environment variables.');
      throw new Error('Missing Supabase URL or key. Please check your environment variables.');
    }
    
    // Automatically connect if specified
    if (config?.autoConnect !== false) {
      this.connect();
    }
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: DatabaseConfig): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService(config);
    }
    return DatabaseService.instance;
  }
  
  /**
   * Connect to Supabase
   */
  public connect(): SupabaseClient {
    if (!this.client) {
      logger.debug('Connecting to Supabase', { url: this.url });
      this.client = createClient(this.url, this.key);
      this.connected = true;
    }
    return this.client;
  }
  
  /**
   * Get Supabase client
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      return this.connect();
    }
    return this.client;
  }
  
  /**
   * Ensure connection is established
   */
  public async ensureConnection(): Promise<boolean> {
    if (this.connected) {
      return true;
    }
    
    const result = await this.testConnection();
    return result.success;
  }
  
  /**
   * Test connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      logger.info('Testing connection to Supabase...');
      const client = this.getClient();
      
      // First test the auth connection
      try {
        const { data: authData, error: authError } = await client.auth.getSession();
        if (authError) {
          logger.warn('Auth connection test failed, but continuing with other tests', { authError });
        } else {
          logger.debug('Auth connection test successful');
        }
      } catch (authErr) {
        logger.warn('Auth connection threw an exception, but continuing with other tests', { authErr });
      }
      
      // Try a simple query to verify connection to documentation_files table
      const { data, error, count } = await client
        .from('documentation_files')
        .select('*', { count: 'exact' })
        .limit(1);
      
      if (error) {
        logger.error('Failed to connect to documentation_files table', { error });
        
        // Try RLS bypass query to check if it's a permissions issue
        try {
          const { data: rlsData, error: rlsError } = await client
            .rpc('get_documentation_files_count');
          
          if (rlsError) {
            logger.error('RLS bypass query also failed', { rlsError });
          } else {
            logger.info('RLS bypass query successful - likely a permissions issue');
            return { 
              success: false, 
              error: 'Permission issue with documentation_files table. Service role key may not have proper permissions.', 
              details: { original: error, rlsBypass: 'successful' } 
            };
          }
        } catch (rlsErr) {
          logger.error('RLS bypass query threw an exception', { rlsErr });
        }
        
        return { success: false, error: 'Failed to connect to documentation_files table', details: error };
      }
      
      logger.info(`Successfully connected to Supabase. Found ${count} records in documentation_files table.`);
      this.connected = true;
      return { success: true };
    } catch (error) {
      logger.error('Error connecting to Supabase', { error });
      return { success: false, error: 'Error connecting to Supabase', details: error };
    }
  }
  
  /**
   * Execute a query with error handling
   */
  public async executeQuery<T>(
    query: () => Promise<any>
  ): Promise<{ data: T | null; error: any | null }> {
    try {
      const result = await query();
      
      if (result.error) {
        logger.error('Query execution error', { error: result.error });
        return { data: null, error: result.error };
      }
      
      return { data: result.data as T, error: null };
    } catch (error) {
      logger.error('Unexpected query error', { error });
      return { data: null, error };
    }
  }
  
  /**
   * Execute a stored procedure/function with error handling
   */
  public async executeRpc<T>(
    functionName: string,
    params: Record<string, any> = {}
  ): Promise<{ data: T | null; error: any | null }> {
    try {
      logger.debug(`Executing RPC: ${functionName}`, { params });
      
      const client = this.getClient();
      const result = await client.rpc(functionName, params);
      
      if (result.error) {
        logger.error(`Error executing RPC ${functionName}:`, { error: result.error });
        return { data: null, error: result.error };
      }
      
      return { data: result.data as T, error: null };
    } catch (error) {
      logger.error(`Unexpected error executing RPC ${functionName}:`, { error });
      return { data: null, error };
    }
  }
  
  /**
   * Query a table with options
   */
  public async query<T>(
    table: string,
    options: QueryOptions
  ): Promise<{ data: T[] | null; error: any | null }> {
    return this.executeQuery<T[]>(async () => {
      let queryBuilder = this.getClient().from(table).select(options.select);
      
      // Apply filters
      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          if (value === 'is.null') {
            queryBuilder = queryBuilder.is(key, null);
          } else if (value === 'is.not.null') {
            queryBuilder = queryBuilder.not(key, 'is', null);
          } else {
            queryBuilder = queryBuilder.eq(key, value);
          }
        });
      }
      
      // Apply ordering
      if (options.order) {
        queryBuilder = queryBuilder.order(
          options.order.column,
          { ascending: options.order.ascending }
        );
      }
      
      // Apply limit and offset
      if (options.limit !== undefined) {
        queryBuilder = queryBuilder.limit(options.limit);
      }
      
      if (options.offset !== undefined) {
        queryBuilder = queryBuilder.range(
          options.offset,
          options.offset + (options.limit || 10) - 1
        );
      }
      
      return queryBuilder;
    });
  }
  
  /**
   * Get records from a table
   */
  public async getRecords<T>(
    table: string,
    select: string = '*',
    query?: (q: any) => any
  ): Promise<{ data: T[] | null; error: any | null }> {
    return this.executeQuery<T[]>(async () => {
      let queryBuilder = this.getClient().from(table).select(select);
      
      if (query) {
        queryBuilder = query(queryBuilder);
      }
      
      return queryBuilder;
    });
  }
  
  /**
   * Insert records into a table
   */
  public async insertRecords<T>(
    table: string,
    records: Partial<T>[]
  ): Promise<{ data: T[] | null; error: any | null }> {
    if (records.length === 0) {
      return { data: [], error: null };
    }
    
    return this.executeQuery<T[]>(async () => {
      return this.getClient().from(table).insert(records).select();
    });
  }
  
  /**
   * Update records in a table
   */
  public async updateRecords<T>(
    table: string,
    updates: Partial<T>,
    query: (q: any) => any
  ): Promise<{ data: T[] | null; error: any | null }> {
    return this.executeQuery<T[]>(async () => {
      let queryBuilder = this.getClient().from(table).update(updates);
      queryBuilder = query(queryBuilder);
      return queryBuilder.select();
    });
  }
  
  /**
   * Update a record by ID
   */
  public async update<T>(
    table: string,
    id: string,
    updates: Partial<T>
  ): Promise<{ data: T | null; error: any | null }> {
    return this.executeQuery<T>(async () => {
      return this.getClient()
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    });
  }
  
  /**
   * Delete records from a table
   */
  public async deleteRecords<T>(
    table: string,
    query: (q: any) => any
  ): Promise<{ data: T[] | null; error: any | null }> {
    return this.executeQuery<T[]>(async () => {
      let queryBuilder = this.getClient().from(table).delete();
      queryBuilder = query(queryBuilder);
      return queryBuilder.select();
    });
  }
  
  /**
   * Count records in a table
   */
  public async countRecords(
    table: string,
    query?: (q: any) => any
  ): Promise<{ count: number | null; error: any | null }> {
    const result = await this.executeQuery<any>(async () => {
      let queryBuilder = this.getClient().from(table).select('*', { count: 'exact', head: true });
      
      if (query) {
        queryBuilder = query(queryBuilder);
      }
      
      return queryBuilder;
    });
    
    if (result.error) {
      return { count: null, error: result.error };
    }
    
    return { count: result.data?.count || 0, error: null };
  }
  
  /**
   * Get Supabase URL
   */
  public getUrl(): string {
    return this.url;
  }
  
  /**
   * Get Supabase key
   */
  public getKey(): string {
    return this.key;
  }
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();