/**
 * Migration Types
 * 
 * Type definitions for database migration system
 */

export interface MigrationMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: string[];
}

export interface MigrationSection {
  name: string;
  type: MigrationSectionType;
  sql: string;
  dependencies?: string[];
  order: number;
}

export type MigrationSectionType = 
  | 'extensions'
  | 'tables' 
  | 'indexes'
  | 'functions'
  | 'triggers'
  | 'rls'
  | 'grants'
  | 'views'
  | 'custom';

export interface ParsedMigration {
  metadata: MigrationMetadata;
  sections: MigrationSection[];
  filePath: string;
  rawContent: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  sections: SectionValidation[];
}

export interface ValidationError {
  section?: string;
  line?: number;
  message: string;
  type: 'syntax' | 'dependency' | 'conflict' | 'security';
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  section?: string;
  line?: number;
  message: string;
  type: 'performance' | 'best-practice' | 'compatibility';
}

export interface SectionValidation {
  sectionName: string;
  sectionType: MigrationSectionType;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  estimatedExecutionTime?: number;
}

export interface ExecutionResult {
  success: boolean;
  sectionsExecuted: string[];
  sectionsSkipped: string[];
  sectionResults: SectionExecutionResult[];
  totalTime: number;
  error?: string;
}

export interface SectionExecutionResult {
  sectionName: string;
  sectionType: MigrationSectionType;
  success: boolean;
  executionTime: number;
  rowsAffected?: number;
  objectsCreated?: string[];
  error?: string;
  warnings?: string[];
}

export interface SchemaSnapshot {
  timestamp: string;
  migrationName: string;
  migrationVersion: string;
  tables: TableSnapshot[];
  functions: FunctionSnapshot[];
  indexes: IndexSnapshot[];
  policies: PolicySnapshot[];
  views: ViewSnapshot[];
  extensions: string[];
}

export interface TableSnapshot {
  name: string;
  schema: string;
  columns: ColumnSnapshot[];
  constraints: ConstraintSnapshot[];
  hasRLS: boolean;
  rowCount?: number;
}

export interface ColumnSnapshot {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyReferences?: string;
}

export interface ConstraintSnapshot {
  name: string;
  type: 'PRIMARY KEY' | 'FOREIGN KEY' | 'UNIQUE' | 'CHECK';
  definition: string;
}

export interface FunctionSnapshot {
  name: string;
  schema: string;
  language: string;
  returnType: string;
  parameters: string[];
  definition?: string;
}

export interface IndexSnapshot {
  name: string;
  tableName: string;
  columns: string[];
  isUnique: boolean;
  definition: string;
}

export interface PolicySnapshot {
  name: string;
  tableName: string;
  command: string;
  roles: string[];
  definition: string;
}

export interface ViewSnapshot {
  name: string;
  schema: string;
  definition: string;
}

export interface MigrationHistory {
  timestamp: string;
  migrationName: string;
  migrationVersion: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  executionTime?: number;
  error?: string;
  schemaSnapshot?: SchemaSnapshot;
}

export interface RollbackPlan {
  migrationName: string;
  targetSnapshot: SchemaSnapshot;
  currentSnapshot: SchemaSnapshot;
  rollbackSections: RollbackSection[];
  estimatedTime: number;
  risks: RollbackRisk[];
}

export interface RollbackSection {
  type: 'drop_table' | 'drop_function' | 'drop_index' | 'drop_policy' | 'alter_table' | 'custom';
  name: string;
  sql: string;
  order: number;
  risks: string[];
}

export interface RollbackRisk {
  type: 'data_loss' | 'downtime' | 'dependency_break' | 'permission_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedObjects: string[];
  mitigation?: string;
}

export interface MigrationConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  migrationDirectory: string;
  backupDirectory: string;
  maxExecutionTime: number;
  enableValidation: boolean;
  enableBackups: boolean;
  dryRunByDefault: boolean;
}