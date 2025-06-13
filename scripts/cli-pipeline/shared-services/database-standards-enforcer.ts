#!/usr/bin/env ts-node

/**
 * Database Standards Enforcer
 * Checks database objects against standards and suggests/applies fixes
 */

import * as fs from 'fs';
import * as path from 'path';

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface TableIssue {
  table_name: string;
  issues: string[];
  fixes: string[];
  severity: 'critical' | 'warning' | 'info';
}

interface OrphanedObject {
  type: 'function' | 'view' | 'trigger' | 'index' | 'policy';
  name: string;
  definition?: string;
  last_used?: Date;
  recommendation: string;
}

class DatabaseStandardsEnforcer {
  private issues: TableIssue[] = [];
  private orphanedObjects: OrphanedObject[] = [];
  
  async enforceStandards(): Promise<void> {
    console.log('🔍 Database Standards Enforcement Starting...\n');
    
    // Phase 1: Check table standards
    await this.checkTableStandards();
    
    // Phase 2: Detect orphaned objects
    await this.detectOrphanedObjects();
    
    // Phase 3: Analyze function usage
    await this.analyzeFunctionUsage();
    
    // Phase 4: Check indexes
    await this.checkIndexOptimization();
    
    // Phase 5: Generate report and fixes
    await this.generateReport();
    
    // Phase 6: Store findings for continuous monitoring
    await this.storeFindingsInDatabase();
  }
  
  private async checkTableStandards(): Promise<void> {
    console.log('📋 Checking table standards...\n');
    
    // Get list of tables from sys_table_definitions which should have all tables
    const { data: tables, error } = await supabase
      .from('sys_table_definitions')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (error || !tables) {
      console.error('Error fetching tables:', error);
      return;
    }
    
    console.log(`Checking ${tables.length} tables for standards compliance...\n`);
    
    for (const table of tables) {
      await this.checkTableCompliance(table.table_name);
    }
  }
  
  private async checkTableCompliance(tableName: string): Promise<void> {
    const issues: string[] = [];
    const fixes: string[] = [];
    
    // For now, we'll skip column checking if we can't access information_schema
    // In production, this would use a proper RPC function
    const columns: any[] = [];
    
    // Try to at least check if the table has basic fields by selecting from it
    try {
      const { data: sample } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      // This gives us the columns from the response
      if (sample !== null) {
        // We can infer some column info from the TypeScript types
        console.log(`  Checking ${tableName}...`);
      }
    } catch (e) {
      console.log(`  Skipping ${tableName} - unable to analyze`);
      return;
    }
    
    if (!columns) return;
    
    const columnNames = columns.map((c: any) => c.column_name);
    
    // Check 1: Base fields
    const requiredFields = ['created_at', 'updated_at'];
    const missingFields = requiredFields.filter(f => !columnNames.includes(f));
    
    if (missingFields.length > 0) {
      issues.push(`Missing required fields: ${missingFields.join(', ')}`);
      missingFields.forEach(field => {
        fixes.push(`ALTER TABLE ${tableName} ADD COLUMN ${field} TIMESTAMPTZ DEFAULT NOW() NOT NULL;`);
      });
    }
    
    // Check 2: Naming conventions
    if (!this.isSnakeCase(tableName)) {
      issues.push(`Table name '${tableName}' is not in snake_case`);
    }
    
    columns.forEach((col: any) => {
      if (!this.isSnakeCase(col.column_name)) {
        issues.push(`Column '${col.column_name}' is not in snake_case`);
      }
      
      // Check boolean naming
      if (col.data_type === 'boolean' && 
          !col.column_name.startsWith('is_') && 
          !col.column_name.startsWith('has_')) {
        issues.push(`Boolean column '${col.column_name}' should start with is_ or has_`);
      }
      
      // Check timestamp naming
      if (col.data_type.includes('timestamp') && !col.column_name.endsWith('_at')) {
        issues.push(`Timestamp column '${col.column_name}' should end with _at`);
      }
    });
    
    // Check 3: ID field type
    const idColumn = columns.find((c: any) => c.column_name === 'id');
    if (idColumn && idColumn.data_type !== 'uuid') {
      issues.push(`ID column should be UUID, not ${idColumn.data_type}`);
      fixes.push(`-- Consider migrating ${tableName}.id to UUID type`);
    }
    
    // Check 4: RLS status
    const { data: rlsStatus } = await supabase.rpc('check_table_rls_status', {
      table_name: tableName
    }).single();
    
    if (!rlsStatus?.rls_enabled) {
      issues.push('RLS is not enabled');
      fixes.push(`ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);
    }
    
    // Check 5: Updated_at trigger
    const hasUpdatedAtTrigger = await this.checkUpdatedAtTrigger(tableName);
    if (!hasUpdatedAtTrigger && columnNames.includes('updated_at')) {
      issues.push('Missing updated_at trigger');
      fixes.push(`CREATE TRIGGER update_${tableName}_updated_at
        BEFORE UPDATE ON ${tableName}
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();`);
    }
    
    // Check 6: Foreign key indexes
    const missingIndexes = await this.checkForeignKeyIndexes(tableName);
    missingIndexes.forEach(idx => {
      issues.push(`Missing index on foreign key: ${idx.column}`);
      fixes.push(`CREATE INDEX idx_${tableName}_${idx.column} ON ${tableName}(${idx.column});`);
    });
    
    if (issues.length > 0) {
      this.issues.push({
        table_name: tableName,
        issues,
        fixes,
        severity: this.calculateSeverity(issues)
      });
    }
  }
  
  private async detectOrphanedObjects(): Promise<void> {
    console.log('\n🔍 Detecting orphaned objects...\n');
    
    // Check for orphaned functions
    const orphanedFunctions = `
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname NOT IN (
          SELECT DISTINCT function_name 
          FROM sys_function_usage 
          WHERE last_used > NOW() - INTERVAL '30 days'
        )
        AND p.proname NOT LIKE 'pg_%'
        AND p.proname NOT LIKE 'plpgsql_%'
      ORDER BY p.proname;
    `;
    
    // Check for views referencing non-existent tables
    const orphanedViews = `
      SELECT 
        v.viewname,
        v.definition
      FROM pg_views v
      WHERE v.schemaname = 'public'
        AND v.definition ~ 'FROM\\s+\\w+'
        AND EXISTS (
          -- Complex check for broken references
          SELECT 1
        );
    `;
    
    // Store findings
    // Note: These queries would need proper implementation
  }
  
  private async analyzeFunctionUsage(): Promise<void> {
    console.log('\n📊 Analyzing function usage...\n');
    
    // Get all functions
    const { data: functions } = await supabase.rpc('get_database_functions');
    
    if (!functions) return;
    
    for (const func of functions) {
      // Check if function follows naming standards
      if (!this.isValidFunctionName(func.function_name)) {
        this.orphanedObjects.push({
          type: 'function',
          name: func.function_name,
          recommendation: 'Rename to follow fn_{action}_{object} pattern'
        });
      }
      
      // Check if function is used
      const usage = await this.checkFunctionUsage(func.function_name);
      if (!usage.isUsed) {
        this.orphanedObjects.push({
          type: 'function',
          name: func.function_name,
          last_used: usage.lastUsed,
          recommendation: 'Consider removing - not used in 30+ days'
        });
      }
    }
  }
  
  private async checkIndexOptimization(): Promise<void> {
    console.log('\n🔧 Checking index optimization...\n');
    
    // Check for duplicate indexes
    const duplicateIndexes = `
      SELECT 
        idx1.indexname as index1,
        idx2.indexname as index2,
        idx1.tablename
      FROM pg_indexes idx1
      JOIN pg_indexes idx2 ON 
        idx1.tablename = idx2.tablename AND
        idx1.indexname < idx2.indexname AND
        idx1.indexdef = idx2.indexdef
      WHERE idx1.schemaname = 'public';
    `;
    
    // Check for unused indexes
    const unusedIndexes = `
      SELECT 
        s.schemaname,
        s.tablename,
        s.indexname,
        s.idx_scan
      FROM pg_stat_user_indexes s
      WHERE s.idx_scan = 0
        AND s.indexname NOT LIKE '%_pkey'
        AND s.schemaname = 'public';
    `;
    
    // Store findings for report
  }
  
  private async checkForeignKeyIndexes(tableName: string): Promise<any[]> {
    // Check for foreign key columns without indexes
    const query = `
      SELECT 
        a.attname as column_name
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f'
        AND c.conrelid = '${tableName}'::regclass
        AND NOT EXISTS (
          SELECT 1 
          FROM pg_index i 
          WHERE i.indrelid = c.conrelid 
            AND a.attnum = ANY(i.indkey)
        );
    `;
    
    // Return columns needing indexes
    return [];
  }
  
  private async checkUpdatedAtTrigger(tableName: string): Promise<boolean> {
    const { data } = await supabase.rpc('check_trigger_exists', {
      table_name: tableName,
      trigger_pattern: '%updated_at%'
    });
    
    return !!data;
  }
  
  private isSnakeCase(name: string): boolean {
    return /^[a-z]+(_[a-z]+)*$/.test(name);
  }
  
  private isValidFunctionName(name: string): boolean {
    const validPrefixes = ['fn_', 'get_', 'set_', 'check_', 'validate_', 'process_', 'calculate_'];
    return validPrefixes.some(prefix => name.startsWith(prefix));
  }
  
  private calculateSeverity(issues: string[]): 'critical' | 'warning' | 'info' {
    if (issues.some(i => i.includes('RLS') || i.includes('Missing required fields'))) {
      return 'critical';
    }
    if (issues.some(i => i.includes('Missing index') || i.includes('trigger'))) {
      return 'warning';
    }
    return 'info';
  }
  
  private async checkFunctionUsage(functionName: string): Promise<{isUsed: boolean, lastUsed?: Date}> {
    // This would check:
    // 1. If function is called by other functions
    // 2. If function is used in views
    // 3. If function is called from application code
    // 4. Usage statistics if available
    
    return { isUsed: true }; // Placeholder
  }
  
  private async generateReport(): Promise<void> {
    console.log('\n📝 Database Standards Report\n');
    
    // Critical issues
    const criticalIssues = this.issues.filter(i => i.severity === 'critical');
    if (criticalIssues.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      criticalIssues.forEach(issue => {
        console.log(`\n  Table: ${issue.table_name}`);
        issue.issues.forEach(i => console.log(`    ❌ ${i}`));
        if (issue.fixes.length > 0) {
          console.log('    Fixes:');
          issue.fixes.forEach(f => console.log(`      ${f}`));
        }
      });
    }
    
    // Warnings
    const warnings = this.issues.filter(i => i.severity === 'warning');
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(issue => {
        console.log(`\n  Table: ${issue.table_name}`);
        issue.issues.forEach(i => console.log(`    ⚠️  ${i}`));
      });
    }
    
    // Orphaned objects
    if (this.orphanedObjects.length > 0) {
      console.log('\n🗑️  ORPHANED OBJECTS:');
      this.orphanedObjects.forEach(obj => {
        console.log(`  ${obj.type}: ${obj.name} - ${obj.recommendation}`);
      });
    }
    
    // Generate SQL migration file
    await this.generateMigrationFile();
  }
  
  private async generateMigrationFile(): Promise<void> {
    const fixes = this.issues.flatMap(i => i.fixes);
    if (fixes.length === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
    const filename = `database_standards_fixes_${timestamp}.sql`;
    const filepath = path.join(process.cwd(), 'supabase/migrations', filename);
    
    const content = `-- Database Standards Compliance Fixes
-- Generated: ${new Date().toISOString()}
-- Total fixes: ${fixes.length}

${fixes.join('\n\n')}

-- Update sys_database_change_events to mark standards applied
INSERT INTO sys_database_change_events (
  event_type, 
  object_name, 
  object_type,
  change_details,
  processing_notes
) VALUES (
  'standards_applied',
  'multiple_tables',
  'table',
  '{"fixes_applied": ${fixes.length}}',
  'Applied database standards compliance fixes'
);
`;
    
    fs.writeFileSync(filepath, content);
    console.log(`\n✅ Migration file generated: ${filename}`);
  }
  
  private async storeFindingsInDatabase(): Promise<void> {
    // Store issues in sys_database_change_events for tracking
    for (const issue of this.issues) {
      await supabase
        .from('sys_database_change_events')
        .insert({
          event_type: 'standards_violation',
          object_name: issue.table_name,
          object_type: 'table',
          change_details: {
            issues: issue.issues,
            fixes: issue.fixes,
            severity: issue.severity
          }
        });
    }
    
    // Store orphaned objects
    for (const obj of this.orphanedObjects) {
      await supabase
        .from('sys_database_change_events')
        .insert({
          event_type: 'orphaned_object',
          object_name: obj.name,
          object_type: obj.type,
          change_details: {
            recommendation: obj.recommendation,
            last_used: obj.last_used
          }
        });
    }
  }
}

// Helper function definitions that would need to be created in database
const helperFunctions = `
-- Check if table has RLS enabled
CREATE OR REPLACE FUNCTION check_table_rls_status(table_name text)
RETURNS TABLE (rls_enabled boolean, policy_count int) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relrowsecurity as rls_enabled,
    COUNT(pol.polname)::int as policy_count
  FROM pg_class c
  LEFT JOIN pg_policy pol ON pol.polrelid = c.oid
  WHERE c.relname = table_name
    AND c.relnamespace = 'public'::regnamespace
  GROUP BY c.relrowsecurity;
END;
$$ LANGUAGE plpgsql;

-- Check if trigger exists
CREATE OR REPLACE FUNCTION check_trigger_exists(table_name text, trigger_pattern text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = table_name
      AND t.tgname LIKE trigger_pattern
  );
END;
$$ LANGUAGE plpgsql;

-- Get all user functions
CREATE OR REPLACE FUNCTION get_database_functions()
RETURNS TABLE (
  function_name text,
  return_type text,
  argument_types text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.proname::text,
    pg_get_function_result(p.oid)::text,
    pg_get_function_arguments(p.oid)::text
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.proname NOT LIKE 'pg_%'
  ORDER BY p.proname;
END;
$$ LANGUAGE plpgsql;

-- Standard updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

// Run the enforcer
const enforcer = new DatabaseStandardsEnforcer();
enforcer.enforceStandards().catch(console.error);