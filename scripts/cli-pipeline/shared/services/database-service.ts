/**
 * Database Service
 * 
 * Provides database interaction through Supabase, with transaction support,
 * error handling, and query optimization.
 */
import { createClient, SupabaseClient, PostgrestFilterBuilder } from '@supabase/supabase-js';
import { DatabaseConfig } from '../interfaces/types';
import { environmentService } from './environment-service';
import { logger } from './logger-service';

/**
 * Database Service implementation
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private client: SupabaseClient | null = null;
  private url: string;
  private key: string;
  
  /**
   * Create a database service
   * Private constructor to enforce singleton pattern
   */
  private constructor(config?: DatabaseConfig) {
    this.url = config?.url || environmentService.get('supabaseUrl');
    this.key = config?.key || environmentService.get('supabaseKey');
    
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
   * Test connection to Supabase
   */
  public async testConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      logger.info('Testing connection to Supabase...');
      const client = this.getClient();
      
      // Try a simple query to verify connection
      const { data, error } = await client
        .from('documentation_files')
        .select('count(*)', { count: 'exact', head: true });
      
      if (error) {
        logger.error('Failed to connect to documentation_files table', { error });
        return { success: false, error: 'Failed to connect to documentation_files table', details: error };
      }
      
      logger.info('Successfully connected to Supabase');
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
    query: () => PostgrestFilterBuilder<any, any, any> | Promise<any>
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
}

// Export singleton instance
export const databaseService = DatabaseService.getInstance();