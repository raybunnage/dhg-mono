import { SingletonService } from '../base-classes/SingletonService';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../supabase-client';
import { Database } from '../../../../supabase/types';

interface TableInfo {
  tableName: string;
  count: number;
  type: string;
}

interface EmptyTableInfo {
  tableName: string;
  type: string;
}

interface FunctionInfo {
  name: string;
  type: string;
  usage: string | null;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  information_schema: {
    key_column_usage: Array<{ column_name: string }>;
  };
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
}

interface TableStructure {
  columns: ColumnInfo[];
  constraints: ConstraintInfo[];
  indexes: IndexInfo[];
}

interface SchemaIssue {
  type: 'missing_primary_key' | 'nullable_foreign_keys' | 'missing_indexes';
  tables?: Array<{ table_name: string }>;
  entries?: Array<{ table_name: string; column_name: string }>;
  severity: 'high' | 'medium' | 'low';
}

interface SchemaHealth {
  issues: SchemaIssue[];
}

/**
 * DatabaseService provides tools for monitoring and managing the Supabase database
 * 
 * Refactored to extend SingletonService for proper singleton pattern and lifecycle management.
 * 
 * @example
 * ```typescript
 * const databaseService = DatabaseService.getInstance();
 * await databaseService.ensureInitialized();
 * 
 * const tables = await databaseService.getTablesWithRecordCounts();
 * const health = await databaseService.analyzeSchemaHealth();
 * ```
 */
export class DatabaseService extends SingletonService {
  private static instance: DatabaseService;
  private supabase!: SupabaseClient<Database>;
  private tableCache: Map<string, TableInfo[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  protected constructor() {
    super('DatabaseService', {
      info: (msg: string) => console.log(`[DatabaseService] ${msg}`),
      error: (msg: string, error?: any) => console.error(`[DatabaseService] ${msg}`, error || ''),
      debug: (msg: string) => console.debug(`[DatabaseService] ${msg}`),
      warn: (msg: string) => console.warn(`[DatabaseService] ${msg}`)
    });
  }

  /**
   * Get the singleton instance of DatabaseService
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Ensure the service is initialized (public wrapper for protected method)
   */
  public async ensureInitialized(): Promise<void> {
    await super.ensureInitialized();
  }

  /**
   * Initialize the service with Supabase client
   */
  protected async initialize(): Promise<void> {
    try {
      this.supabase = SupabaseClientService.getInstance().getClient();
      
      // Test connection with a simple query
      const { error } = await this.supabase
        .from('sys_table_prefixes')
        .select('prefix')
        .limit(1);
      
      if (error) {
        throw new Error(`Database connection test failed: ${error.message}`);
      }
      
      this.logger?.info('DatabaseService initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize DatabaseService', error);
      throw error;
    }
  }

  /**
   * Release resources managed by this service
   */
  protected async releaseResources(): Promise<void> {
    this.tableCache.clear();
    this.cacheExpiry.clear();
    this.logger?.info('DatabaseService shutdown complete');
  }

  /**
   * Clean up resources (required by BaseService)
   */
  protected async cleanup(): Promise<void> {
    await this.releaseResources();
  }

  /**
   * Health check for the service
   */
  public async healthCheck(): Promise<{ healthy: boolean; details: any }> {
    try {
      const { data, error } = await this.supabase
        .from('sys_table_prefixes')
        .select('count', { count: 'exact', head: true });
      
      return {
        healthy: !error,
        details: {
          connection: !error ? 'active' : 'failed',
          error: error?.message,
          cacheSize: this.tableCache.size
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          connection: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Clear cache for a specific operation or all caches
   */
  public clearCache(operation?: string): void {
    if (operation) {
      this.tableCache.delete(operation);
      this.cacheExpiry.delete(operation);
    } else {
      this.tableCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Check if cache is valid for an operation
   */
  private isCacheValid(operation: string): boolean {
    const expiry = this.cacheExpiry.get(operation);
    return expiry ? Date.now() < expiry : false;
  }

  /**
   * Get a list of all tables and views with their record counts
   */
  public async getTablesWithRecordCounts(forceRefresh = false): Promise<TableInfo[]> {
    await this.ensureInitialized();
    
    const cacheKey = 'tablesWithCounts';
    
    // Check cache unless force refresh
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      const cached = this.tableCache.get(cacheKey);
      if (cached) {
        this.logger?.debug('Returning cached table counts');
        return cached;
      }
    }
    
    try {
      // Query the information_schema directly with RPC to get both tables and views
      let { data: tables, error: tablesError } = await this.supabase
        .rpc('execute_sql', {
          sql_query: `SELECT table_name, table_type
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type IN ('BASE TABLE', 'VIEW')
                ORDER BY table_type, table_name`
        });

      if (tablesError) {
        throw new Error(`Failed to get tables: ${tablesError.message}`);
      }
      
      // If no tables were returned, try a fallback approach
      if (!tables || tables.length === 0) {
        // Fallback: Get tables and views separately and combine
        this.logger?.warn("Using fallback approach for table listing");
        const { data: fallbackTables, error: fallbackError } = await this.supabase
          .rpc('execute_sql', {
            sql_query: `
              SELECT tablename as table_name, 'BASE TABLE' as table_type 
              FROM pg_tables WHERE schemaname = 'public'
              UNION ALL
              SELECT viewname as table_name, 'VIEW' as table_type 
              FROM pg_views WHERE schemaname = 'public'
              ORDER BY table_type, table_name
              LIMIT 150`
          });
          
        if (fallbackError) {
          throw new Error(`Fallback tables query failed: ${fallbackError.message}`);
        }
        
        if (fallbackTables && fallbackTables.length > 0) {
          tables = fallbackTables;
        }
      }

      // Get record counts for each table and view with batching
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < tables.length; i += batchSize) {
        const batch = tables.slice(i, i + batchSize);
        batches.push(batch);
      }
      
      const results: TableInfo[] = [];
      
      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(async (table: { table_name: string; table_type: string }) => {
            const { count, error: countError } = await this.supabase
              .from(table.table_name)
              .select('*', { count: 'exact', head: true });

            if (countError) {
              // Some views might have permission issues or complex queries, log but don't fail
              this.logger?.warn(`Warning getting count for ${table.table_type} ${table.table_name}: ${countError.message}`);
              return {
                tableName: table.table_name,
                count: -1, // Indicates error
                type: table.table_type,
              };
            }

            return {
              tableName: table.table_name,
              count: count || 0,
              type: table.table_type,
            };
          })
        );
        
        results.push(...batchResults);
      }

      // Cache the results
      this.tableCache.set(cacheKey, results);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_DURATION);

      return results;
    } catch (error) {
      this.logger?.error('Error in getTablesWithRecordCounts:', error);
      throw error;
    }
  }

  /**
   * Get a list of empty tables and views (with 0 records)
   */
  public async getEmptyTables(): Promise<EmptyTableInfo[]> {
    await this.ensureInitialized();
    
    try {
      const tablesWithCounts = await this.getTablesWithRecordCounts();
      return tablesWithCounts
        .filter((table) => table.count === 0) // Only include tables/views with exactly 0 records
        .map((table) => ({ tableName: table.tableName, type: table.type }));
    } catch (error) {
      this.logger?.error('Error in getEmptyTables:', error);
      throw error;
    }
  }

  /**
   * Get a list of tables and views that couldn't be queried (permission/access issues)
   */
  public async getInaccessibleTables(): Promise<EmptyTableInfo[]> {
    await this.ensureInitialized();
    
    try {
      const tablesWithCounts = await this.getTablesWithRecordCounts();
      return tablesWithCounts
        .filter((table) => table.count === -1) // Tables/views that had query errors
        .map((table) => ({ tableName: table.tableName, type: table.type }));
    } catch (error) {
      this.logger?.error('Error in getInaccessibleTables:', error);
      throw error;
    }
  }

  /**
   * Get a list of database functions
   */
  public async getDatabaseFunctions(): Promise<FunctionInfo[]> {
    await this.ensureInitialized();
    
    try {
      // Try to get functions using direct SQL execution which is more reliable
      const { data: directData, error: directError } = await this.supabase.rpc('execute_sql', {
        sql_query: `
          SELECT 
            routine_name as name, 
            routine_type as type,
            CASE routine_type
              WHEN 'FUNCTION' THEN data_type
              ELSE NULL
            END as usage
          FROM information_schema.routines 
          WHERE routine_schema = 'public'
          ORDER BY routine_name
        `
      });
      
      if (directError) {
        throw new Error(`Failed to get database functions: ${directError.message}`);
      }
      
      if (directData && directData.length > 0) {
        return directData;
      }
      
      // If direct SQL didn't work, fall back to RPC
      const { data, error } = await this.supabase.rpc('get_functions', { schema_name: 'public' });
      
      if (error) {
        throw new Error(`Failed to get database functions: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      this.logger?.error('Error in getDatabaseFunctions:', error);
      
      // Last resort fallback: limited information
      this.logger?.warn('Attempting final fallback method');
      try {
        const { data: backupData, error: backupError } = await this.supabase.rpc('execute_sql', {
          sql_query: `
            SELECT 
              p.proname as name,
              'FUNCTION' as type,
              pg_catalog.pg_get_function_result(p.oid) as usage
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
          `
        });
        
        if (backupError) {
          throw backupError;
        }
        
        return backupData || [];
      } catch (fallbackError) {
        this.logger?.error('All fallback attempts failed:', fallbackError);
        // Return empty array to avoid crashes
        return [];
      }
    }
  }

  /**
   * Get detailed information about table structure including constraints and indexes
   */
  public async getTableStructure(tableName: string): Promise<TableStructure> {
    await this.ensureInitialized();
    
    try {
      // First, check if we have a get_table_columns_plus RPC function
      try {
        const { data: columnsPlus, error: columnsError } = await this.supabase
          .rpc('get_table_columns_plus', { p_table_name: tableName });
        
        if (!columnsError && columnsPlus) {
          return columnsPlus;
        }
      } catch (rpcError) {
        this.logger?.debug('RPC function not available, using direct query method');
      }
      
      // Fallback method: query information_schema directly
      // Get columns
      // Use RPC to query information_schema since it's not directly accessible
      const { data: columns, error: columnsError } = await this.supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
            ORDER BY ordinal_position
          `
        });
      
      if (columnsError) {
        throw new Error(`Failed to get columns for ${tableName}: ${columnsError.message}`);
      }
      
      // Get constraints
      const { data: constraints, error: constraintsError } = await this.supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT 
              tc.constraint_name,
              tc.constraint_type,
              kcu.column_name
            FROM information_schema.table_constraints tc
            LEFT JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
              AND tc.table_name = kcu.table_name
            WHERE tc.table_schema = 'public' 
            AND tc.table_name = '${tableName}'
          `
        });
      
      if (constraintsError) {
        throw new Error(`Failed to get constraints for ${tableName}: ${constraintsError.message}`);
      }
      
      // Get indexes
      const { data: indexes, error: indexesError } = await this.supabase
        .rpc('execute_sql', { 
          sql_query: `SELECT 
                 indexname, 
                 indexdef 
               FROM 
                 pg_indexes 
               WHERE 
                 schemaname = 'public' 
                 AND tablename = '${tableName}'`
        });
      
      if (indexesError) {
        throw new Error(`Failed to get indexes for ${tableName}: ${indexesError.message}`);
      }
      
      // Merge all information
      return {
        columns: columns || [],
        constraints: constraints || [],
        indexes: indexes || []
      };
    } catch (error) {
      this.logger?.error(`Error in getTableStructure for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Analyze database health by checking for common issues
   */
  public async analyzeSchemaHealth(): Promise<SchemaHealth> {
    await this.ensureInitialized();
    
    try {
      const issues: SchemaIssue[] = [];
      
      // 1. Check for tables without primary keys
      const { data: tablesWithoutPK, error: pkError } = await this.supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT 
              t.table_name 
            FROM 
              information_schema.tables t 
            LEFT JOIN 
              information_schema.table_constraints tc 
              ON tc.table_name = t.table_name 
              AND tc.constraint_type = 'PRIMARY KEY' 
              AND tc.table_schema = 'public'
            WHERE 
              t.table_schema = 'public' 
              AND t.table_type = 'BASE TABLE' 
              AND tc.constraint_name IS NULL
          `
        });
      
      if (pkError) {
        throw new Error(`Failed to check tables without primary keys: ${pkError.message}`);
      }
      
      if (tablesWithoutPK?.length > 0) {
        issues.push({
          type: 'missing_primary_key',
          tables: tablesWithoutPK,
          severity: 'high'
        });
      }
      
      // 2. Check for nullable foreign keys
      const { data: nullableFKs, error: fkError } = await this.supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT 
              tc.table_name,
              kcu.column_name
            FROM 
              information_schema.table_constraints tc
            JOIN 
              information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN 
              information_schema.columns c
              ON c.table_name = tc.table_name
              AND c.column_name = kcu.column_name
            WHERE 
              tc.constraint_type = 'FOREIGN KEY'
              AND c.is_nullable = 'YES'
              AND tc.table_schema = 'public'
          `
        });
      
      if (fkError) {
        throw new Error(`Failed to check nullable foreign keys: ${fkError.message}`);
      }
      
      if (nullableFKs?.length > 0) {
        issues.push({
          type: 'nullable_foreign_keys',
          entries: nullableFKs,
          severity: 'medium'
        });
      }
      
      // 3. Check for tables without indexes
      const { data: tablesWithoutIndexes, error: indexError } = await this.supabase
        .rpc('execute_sql', {
          sql_query: `
            SELECT 
              t.table_name
            FROM 
              information_schema.tables t
            LEFT JOIN 
              pg_indexes i
              ON i.tablename = t.table_name
              AND i.schemaname = 'public'
            WHERE 
              t.table_schema = 'public'
              AND t.table_type = 'BASE TABLE'
              AND i.indexname IS NULL
              AND t.table_name NOT LIKE '%backup%'
          `
        });
      
      if (indexError) {
        throw new Error(`Failed to check tables without indexes: ${indexError.message}`);
      }
      
      if (tablesWithoutIndexes?.length > 0) {
        issues.push({
          type: 'missing_indexes',
          tables: tablesWithoutIndexes,
          severity: 'medium'
        });
      }
      
      return { issues };
    } catch (error) {
      this.logger?.error('Error in analyzeSchemaHealth:', error);
      throw error;
    }
  }

  /**
   * Execute custom SQL query (admin only)
   * @param query SQL query to execute
   * @returns Query results
   */
  public async executeQuery(query: string): Promise<any> {
    await this.ensureInitialized();
    
    try {
      // Validate query is safe (basic validation)
      const lowerQuery = query.toLowerCase().trim();
      const dangerousKeywords = ['drop', 'truncate', 'delete', 'update', 'insert', 'alter'];
      
      for (const keyword of dangerousKeywords) {
        if (lowerQuery.startsWith(keyword)) {
          throw new Error(`Dangerous query detected. Only SELECT queries are allowed.`);
        }
      }
      
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql_query: query
      });
      
      if (error) {
        throw new Error(`Query execution failed: ${error.message}`);
      }
      
      return data;
    } catch (error) {
      this.logger?.error('Error executing query:', error);
      throw error;
    }
  }

  /**
   * Get table size information
   */
  public async getTableSizes(): Promise<Array<{ table_name: string; size: string; rows: number }>> {
    await this.ensureInitialized();
    
    try {
      const { data, error } = await this.supabase.rpc('execute_sql', {
        sql_query: `
          SELECT 
            schemaname,
            tablename as table_name,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
            n_tup_ins - n_tup_del as rows
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        `
      });
      
      if (error) {
        throw new Error(`Failed to get table sizes: ${error.message}`);
      }
      
      return data || [];
    } catch (error) {
      this.logger?.error('Error getting table sizes:', error);
      throw error;
    }
  }
}

// Export singleton instance for backwards compatibility
export const databaseService = DatabaseService.getInstance();