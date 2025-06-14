/**
 * Database Metadata Service Types
 * Types for database introspection and metadata management
 */

export interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
  object_type?: string; // 'table' | 'view' | 'materialized_view'
  row_count: number;
  size_pretty?: string;
  size_bytes?: number;
  column_count?: number;
  has_primary_key?: boolean;
  has_rls?: boolean;
  created_at?: string;
  updated_at?: string;
  description?: string;
  purpose?: string;
  created_date?: string;
  created_by?: string;
  notes?: string;
  error?: string;
  columns?: string[];
  is_updatable?: boolean;
  is_insertable?: boolean;
  depends_on?: string[];
  dependency_count?: number;
}

export interface ViewInfo {
  view_name: string;
  view_schema: string;
  is_updatable: boolean;
  is_insertable: boolean;
  has_rls: boolean;
  table_dependencies: string[];
  suggested_prefix: string;
  description?: string;
  purpose?: string;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  is_identity: boolean;
  is_generated: boolean;
  generation_expression?: string;
  ordinal_position: number;
  is_primary_key?: boolean;
  foreign_key_table?: string;
  foreign_key_column?: string;
}

export interface IndexInfo {
  index_name: string;
  table_name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[];
  index_type?: string;
  size_pretty?: string;
}

export interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
  update_rule: string;
  delete_rule: string;
}

export interface TableRelationship {
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
  relationship_type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  constraint_name: string;
}

export interface DatabaseStatistics {
  total_tables: number;
  total_views: number;
  total_rows: number;
  total_size_pretty: string;
  total_size_bytes: number;
  tables_with_rls: number;
  tables_without_rls: number;
  empty_tables: number;
  largest_tables: TableInfo[];
}

export interface PrefixInfo {
  prefix: string;
  label: string;
  count: number;
  description: string;
}

export interface TableFilters {
  schema?: string;
  prefix?: string;
  search?: string;
  hasData?: boolean;
  hasRLS?: boolean;
  objectType?: 'table' | 'view' | 'all';
  dateFilter?: 'all' | 'week' | 'month' | 'year';
}

export interface SchemaInfo {
  schema_name: string;
  table_count: number;
  view_count: number;
  function_count: number;
  owner: string;
  description?: string;
}