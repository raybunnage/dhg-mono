/**
 * Database Metadata Service
 * Provides comprehensive database introspection and metadata management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../supabase-client';
import type {
  TableInfo,
  ViewInfo,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  TableRelationship,
  DatabaseStatistics,
  PrefixInfo,
  TableFilters,
  SchemaInfo
} from './types';

export class DatabaseMetadataService {
  private static instances = new Map<SupabaseClient, DatabaseMetadataService>();
  private supabase: SupabaseClient;
  private tableCache = new Map<string, TableInfo>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes
  private lastCacheTime = 0;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get instance for browser environments (requires Supabase client)
   * For CLI/server environments, pass no parameter to use singleton
   */
  static getInstance(supabaseClient?: SupabaseClient): DatabaseMetadataService {
    // If no client provided, try to use the singleton (CLI/server only)
    if (!supabaseClient) {
      if (typeof window !== 'undefined') {
        throw new Error('Browser environment requires a Supabase client to be passed to getInstance()');
      }
      // CLI/server environment - use singleton
      supabaseClient = SupabaseClientService.getInstance().getClient();
    }

    // Check if we already have an instance for this client
    if (!DatabaseMetadataService.instances.has(supabaseClient)) {
      DatabaseMetadataService.instances.set(supabaseClient, new DatabaseMetadataService(supabaseClient));
    }
    
    return DatabaseMetadataService.instances.get(supabaseClient)!;
  }

  /**
   * Get all tables with metadata
   */
  async getTables(filters?: TableFilters): Promise<TableInfo[]> {
    // Check cache first
    if (this.isCacheValid() && !filters) {
      return Array.from(this.tableCache.values());
    }

    try {
      // Try the enhanced function first
      const { data: tablesData, error } = await this.supabase.rpc('get_table_info_with_definitions');
      
      if (error?.code === '42883') { // Function does not exist
        // Fall back to the basic function
        const { data: fallbackData, error: fallbackError } = await this.supabase.rpc('get_all_tables_with_metadata');
        if (fallbackError) throw fallbackError;
        return this.processTableData(fallbackData || [], filters);
      }

      if (error) throw error;
      return this.processTableData(tablesData || [], filters);
    } catch (error) {
      console.error('Error loading tables:', error);
      throw error;
    }
  }

  /**
   * Get all views with metadata
   */
  async getViews(filters?: TableFilters): Promise<ViewInfo[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_all_views_with_info');
      if (error) throw error;

      let views = data || [];

      // Apply filters
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        views = views.filter(view => 
          view.view_name.toLowerCase().includes(searchLower) ||
          view.description?.toLowerCase().includes(searchLower)
        );
      }

      if (filters?.prefix) {
        views = views.filter(view => view.view_name.startsWith(filters.prefix));
      }

      return views;
    } catch (error) {
      console.error('Error loading views:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific table
   */
  async getTableDetails(tableName: string, schema: string = 'public'): Promise<TableInfo | null> {
    // Check cache first
    const cacheKey = `${schema}.${tableName}`;
    if (this.tableCache.has(cacheKey) && this.isCacheValid()) {
      return this.tableCache.get(cacheKey)!;
    }

    try {
      const tables = await this.getTables();
      return tables.find(t => t.table_name === tableName && t.table_schema === schema) || null;
    } catch (error) {
      console.error('Error getting table details:', error);
      return null;
    }
  }

  /**
   * Get columns for a specific table
   */
  async getTableColumns(tableName: string, schema: string = 'public'): Promise<ColumnInfo[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_columns', { 
        p_table_name: tableName,
        p_schema_name: schema 
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting table columns:', error);
      return [];
    }
  }

  /**
   * Get indexes for a specific table
   */
  async getTableIndexes(tableName: string, schema: string = 'public'): Promise<IndexInfo[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_indexes', { 
        p_table_name: tableName,
        p_schema_name: schema 
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting table indexes:', error);
      return [];
    }
  }

  /**
   * Get foreign keys for a specific table
   */
  async getTableForeignKeys(tableName: string, schema: string = 'public'): Promise<ForeignKeyInfo[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_foreign_keys', { 
        p_table_name: tableName,
        p_schema_name: schema 
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting foreign keys:', error);
      return [];
    }
  }

  /**
   * Get table relationships (both incoming and outgoing)
   */
  async getTableRelationships(tableName: string, schema: string = 'public'): Promise<TableRelationship[]> {
    try {
      const foreignKeys = await this.getTableForeignKeys(tableName, schema);
      const relationships: TableRelationship[] = [];

      // Outgoing relationships
      foreignKeys.forEach(fk => {
        relationships.push({
          source_table: tableName,
          source_column: fk.column_name,
          target_table: fk.foreign_table_name,
          target_column: fk.foreign_column_name,
          relationship_type: 'one-to-many', // Default, could be refined
          constraint_name: fk.constraint_name
        });
      });

      // TODO: Add incoming relationships by querying foreign keys that reference this table

      return relationships;
    } catch (error) {
      console.error('Error getting table relationships:', error);
      return [];
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStatistics(): Promise<DatabaseStatistics> {
    try {
      const tables = await this.getTables();
      
      let totalRows = 0;
      let totalSizeBytes = 0;
      let tablesWithRLS = 0;
      let emptyTables = 0;

      tables.forEach(table => {
        totalRows += table.row_count;
        totalSizeBytes += table.size_bytes || 0;
        if (table.has_rls) tablesWithRLS++;
        if (table.row_count === 0) emptyTables++;
      });

      // Get views count
      const views = await this.getViews();

      // Find largest tables
      const largestTables = [...tables]
        .sort((a, b) => (b.size_bytes || 0) - (a.size_bytes || 0))
        .slice(0, 10);

      return {
        total_tables: tables.length,
        total_views: views.length,
        total_rows: totalRows,
        total_size_pretty: this.formatBytes(totalSizeBytes),
        total_size_bytes: totalSizeBytes,
        tables_with_rls: tablesWithRLS,
        tables_without_rls: tables.length - tablesWithRLS,
        empty_tables: emptyTables,
        largest_tables: largestTables
      };
    } catch (error) {
      console.error('Error getting database statistics:', error);
      throw error;
    }
  }

  /**
   * Get prefix information for table organization
   */
  async getTablePrefixes(): Promise<PrefixInfo[]> {
    const tables = await this.getTables();
    const prefixMap = new Map<string, number>();
    
    // Define known prefixes and their descriptions
    const prefixDescriptions: Record<string, { label: string; description: string }> = {
      'ai_': { label: 'AI', description: 'AI & prompt management' },
      'app_': { label: 'App', description: 'Application-specific tables' },
      'auth_': { label: 'Auth', description: 'Authentication & users' },
      'batch_': { label: 'Batch', description: 'Batch operations' },
      'clipboard_': { label: 'Clipboard', description: 'Clipboard snippets management' },
      'command_': { label: 'Command', description: 'Command & analytics' },
      'dev_': { label: 'Dev', description: 'Development tasks & workflow' },
      'doc_': { label: 'Docs', description: 'Document management' },
      'document_': { label: 'Document Types', description: 'Document type definitions' },
      'element_': { label: 'Element', description: 'Element catalog system' },
      'email_': { label: 'Email', description: 'Email system' },
      'expert_': { label: 'Expert', description: 'Expert system' },
      'filter_': { label: 'Filter', description: 'User filters & preferences' },
      'google_': { label: 'Google', description: 'Google Drive integration' },
      'import_': { label: 'Import', description: 'Data import & migration' },
      'learn_': { label: 'Learning', description: 'Learning platform' },
      'media_': { label: 'Media', description: 'Media & presentations' },
      'registry_': { label: 'Registry', description: 'System registries' },
      'scripts_': { label: 'Scripts', description: 'Script management' },
      'service_': { label: 'Service', description: 'Service configurations' },
      'sys_': { label: 'System', description: 'System & infrastructure' },
      'worktree_': { label: 'Worktree', description: 'Git worktree management' },
      '_other': { label: 'Other', description: 'Other tables' }
    };
    
    // Count tables by prefix
    tables.forEach(table => {
      // Special handling for auth.users
      if (table.table_schema === 'auth' && table.table_name === 'users') {
        prefixMap.set('auth_', (prefixMap.get('auth_') || 0) + 1);
      } else {
        const prefix = Object.keys(prefixDescriptions).find(p => 
          p !== '_other' && table.table_name.startsWith(p)
        ) || '_other';
        
        prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
      }
    });
    
    // Convert to array and sort
    return Array.from(prefixMap.entries())
      .map(([prefix, count]) => ({
        prefix,
        label: prefixDescriptions[prefix]?.label || 'Other',
        count,
        description: prefixDescriptions[prefix]?.description || 'Other tables'
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get schema information
   */
  async getSchemas(): Promise<SchemaInfo[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_schema_info');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting schemas:', error);
      return [];
    }
  }

  /**
   * Get table row count (with special handling for auth tables)
   */
  async getTableRowCount(tableName: string, schema: string = 'public'): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_row_count', { 
        p_table_name: tableName,
        p_schema_name: schema 
      });
      
      if (error) throw error;
      return data || 0;
    } catch (error) {
      console.error('Error getting row count:', error);
      return 0;
    }
  }

  /**
   * Export table data to CSV
   */
  async exportTableToCSV(tableName: string, schema: string = 'public'): Promise<string> {
    try {
      // Get columns
      const columns = await this.getTableColumns(tableName, schema);
      const columnNames = columns.map(col => col.column_name);

      // Get data
      const { data, error } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(1000); // Limit for safety

      if (error) throw error;

      // Convert to CSV
      const csvHeader = columnNames.join(',');
      const csvRows = (data || []).map(row => 
        columnNames.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && value.includes(',')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      );

      return [csvHeader, ...csvRows].join('\n');
    } catch (error) {
      console.error('Error exporting table:', error);
      throw error;
    }
  }

  /**
   * Export table schema to SQL
   */
  async exportTableSchema(tableName: string, schema: string = 'public'): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('get_table_ddl', { 
        p_table_name: tableName,
        p_schema_name: schema 
      });

      if (error) throw error;
      return data || '';
    } catch (error) {
      console.error('Error exporting schema:', error);
      // Fallback to basic CREATE TABLE statement
      return this.generateBasicCreateTable(tableName, schema);
    }
  }

  // Private helper methods

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheTime < this.cacheTimeout;
  }

  private async processTableData(tablesData: any[], filters?: TableFilters): Promise<TableInfo[]> {
    const tableInfoList: TableInfo[] = [];

    // Filter tables
    let filteredTables = tablesData.filter((table: any) => {
      // Include all public schema tables
      if (table.table_schema === 'public') return true;
      
      // Only include auth.users from auth schema
      if (table.table_schema === 'auth' && table.table_name === 'users') return true;
      
      // Include specified schema if filter provided
      if (filters?.schema && table.table_schema === filters.schema) return true;
      
      return false;
    });

    // Apply additional filters
    if (filters?.prefix) {
      filteredTables = filteredTables.filter(table => 
        table.table_name.startsWith(filters.prefix)
      );
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredTables = filteredTables.filter(table => 
        table.table_name.toLowerCase().includes(searchLower) ||
        table.description?.toLowerCase().includes(searchLower) ||
        table.purpose?.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.hasData !== undefined) {
      filteredTables = filteredTables.filter(table => 
        filters.hasData ? table.row_count > 0 : table.row_count === 0
      );
    }

    if (filters?.hasRLS !== undefined) {
      filteredTables = filteredTables.filter(table => 
        table.has_rls === filters.hasRLS
      );
    }

    // Process each table
    for (const table of filteredTables) {
      try {
        // Get column information
        const columns = await this.getTableColumns(table.table_name, table.table_schema);
        const columnNames = columns.map(col => col.column_name);

        const tableInfo: TableInfo = {
          table_name: table.table_name,
          table_schema: table.table_schema || 'public',
          table_type: table.table_type || 'BASE TABLE',
          row_count: table.row_count || 0,
          size_pretty: table.size_pretty,
          size_bytes: table.size_bytes,
          column_count: columnNames.length || table.column_count,
          has_primary_key: table.has_primary_key,
          has_rls: table.has_rls,
          created_at: table.created_at,
          updated_at: table.updated_at,
          description: table.description,
          purpose: table.purpose,
          created_date: table.created_date,
          created_by: table.created_by,
          notes: table.notes,
          columns: columnNames
        };

        tableInfoList.push(tableInfo);
        
        // Update cache
        const cacheKey = `${tableInfo.table_schema}.${tableInfo.table_name}`;
        this.tableCache.set(cacheKey, tableInfo);
      } catch (err) {
        console.error(`Error processing table ${table.table_name}:`, err);
      }
    }

    this.lastCacheTime = Date.now();
    return tableInfoList;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async generateBasicCreateTable(tableName: string, schema: string): Promise<string> {
    const columns = await this.getTableColumns(tableName, schema);
    
    if (columns.length === 0) return '';

    const columnDefs = columns.map(col => {
      let def = `  "${col.column_name}" ${col.data_type}`;
      if (col.character_maximum_length) {
        def += `(${col.character_maximum_length})`;
      }
      if (!col.is_nullable) {
        def += ' NOT NULL';
      }
      if (col.column_default) {
        def += ` DEFAULT ${col.column_default}`;
      }
      return def;
    });

    return `CREATE TABLE "${schema}"."${tableName}" (\n${columnDefs.join(',\n')}\n);`;
  }
}