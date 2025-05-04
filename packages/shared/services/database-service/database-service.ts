import { SupabaseClientService } from '../supabase-client';

/**
 * DatabaseService provides tools for monitoring and managing the Supabase database
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private supabase;

  private constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
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
   * Get a list of all tables and their record counts
   */
  public async getTablesWithRecordCounts(): Promise<{ tableName: string; count: number }[]> {
    try {
      // Query the information_schema directly with RPC since we can't query information_schema directly
      let { data: tables, error: tablesError } = await this.supabase
        .rpc('execute_sql', {
          sql: `SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'`
        });

      if (tablesError) {
        throw new Error(`Failed to get tables: ${tablesError.message}`);
      }
      
      // If no tables were returned, try a fallback approach
      if (!tables || tables.length === 0) {
        // Fallback: Hardcode a list of known tables 
        console.log("Using fallback approach for table listing");
        const { data: fallbackTables, error: fallbackError } = await this.supabase
          .rpc('execute_sql', {
            sql: `SELECT tablename as table_name FROM pg_tables WHERE schemaname = 'public' LIMIT 50`
          });
          
        if (fallbackError) {
          throw new Error(`Fallback tables query failed: ${fallbackError.message}`);
        }
        
        if (fallbackTables && fallbackTables.length > 0) {
          tables = fallbackTables;
        }
      }

      // Get record counts for each table
      const result = await Promise.all(
        tables.map(async (table: { table_name: string }) => {
          const { count, error: countError } = await this.supabase
            .from(table.table_name)
            .select('*', { count: 'exact', head: true });

          if (countError) {
            console.error(`Error getting count for ${table.table_name}: ${countError.message}`);
            return {
              tableName: table.table_name,
              count: -1, // Indicates error
            };
          }

          return {
            tableName: table.table_name,
            count: count || 0,
          };
        })
      );

      return result;
    } catch (error) {
      console.error('Error in getTablesWithRecordCounts:', error);
      throw error;
    }
  }

  /**
   * Get a list of empty tables (tables with 0 records)
   */
  public async getEmptyTables(): Promise<string[]> {
    try {
      const tablesWithCounts = await this.getTablesWithRecordCounts();
      return tablesWithCounts
        .filter((table) => table.count === 0)
        .map((table) => table.tableName);
    } catch (error) {
      console.error('Error in getEmptyTables:', error);
      throw error;
    }
  }

  /**
   * Get a list of database functions
   */
  public async getDatabaseFunctions(): Promise<{ name: string; type: string; usage: string | null }[]> {
    try {
      // Try to get functions using direct SQL execution which is more reliable
      const { data: directData, error: directError } = await this.supabase.rpc('execute_sql', {
        sql: `
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
      console.error('Error in getDatabaseFunctions:', error);
      
      // Last resort fallback: limited information
      console.log('Attempting final fallback method');
      try {
        const { data: backupData, error: backupError } = await this.supabase.rpc('execute_sql', {
          sql: `
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
        console.error('All fallback attempts failed:', fallbackError);
        // Return empty array to avoid crashes
        return [];
      }
    }
  }

  /**
   * Get detailed information about table structure including constraints and indexes
   */
  public async getTableStructure(tableName: string): Promise<any> {
    try {
      // First, check if we have a get_table_columns_plus RPC function
      try {
        const { data: columnsPlus, error: columnsError } = await this.supabase
          .rpc('get_table_columns_plus', { p_table_name: tableName });
        
        if (!columnsError) {
          return columnsPlus;
        }
      } catch (rpcError) {
        console.log('RPC function not available, using direct query method');
      }
      
      // Fallback method: query information_schema directly
      // Get columns
      const { data: columns, error: columnsError } = await this.supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .order('ordinal_position');
      
      if (columnsError) {
        throw new Error(`Failed to get columns for ${tableName}: ${columnsError.message}`);
      }
      
      // Get constraints
      const { data: constraints, error: constraintsError } = await this.supabase
        .from('information_schema.table_constraints')
        .select(`
          constraint_name,
          constraint_type,
          information_schema.key_column_usage!inner(column_name)
        `)
        .eq('table_schema', 'public')
        .eq('table_name', tableName);
      
      if (constraintsError) {
        throw new Error(`Failed to get constraints for ${tableName}: ${constraintsError.message}`);
      }
      
      // Get indexes
      const { data: indexes, error: indexesError } = await this.supabase
        .rpc('execute_sql', { 
          sql: `SELECT 
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
        columns,
        constraints,
        indexes: indexes || []
      };
    } catch (error) {
      console.error(`Error in getTableStructure for ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Analyze database health by checking for common issues
   */
  public async analyzeSchemaHealth(): Promise<any> {
    try {
      const issues = [];
      
      // 1. Check for tables without primary keys
      const { data: tablesWithoutPK, error: pkError } = await this.supabase
        .rpc('execute_sql', {
          sql: `
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
          sql: `
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
          sql: `
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
      console.error('Error in analyzeSchemaHealth:', error);
      throw error;
    }
  }
}

export const databaseService = DatabaseService.getInstance();