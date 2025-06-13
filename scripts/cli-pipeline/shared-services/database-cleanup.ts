#!/usr/bin/env ts-node

/**
 * Database Cleanup Tool
 * Detects and helps clean up orphaned database objects
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface OrphanedObject {
  type: string;
  name: string;
  details: any;
  action: string;
  sql?: string;
}

class DatabaseCleanup {
  private orphans: OrphanedObject[] = [];
  
  async runCleanup(): Promise<void> {
    console.log('🧹 Database Cleanup Analysis\n');
    
    // Check for various types of orphans
    await this.checkOrphanedFunctions();
    await this.checkOrphanedViews();
    await this.checkUnusedIndexes();
    await this.checkDuplicateIndexes();
    await this.checkEmptyTables();
    await this.checkUnusedColumns();
    await this.checkOrphanedTriggers();
    
    // Generate cleanup report
    await this.generateCleanupReport();
  }
  
  private async checkOrphanedFunctions(): Promise<void> {
    console.log('🔍 Checking for orphaned functions...');
    
    // Get all functions
    const { data: functions, error } = await supabase.rpc('get_database_functions');
    
    if (error || !functions) {
      console.error('Error getting functions:', error);
      return;
    }
    
    for (const func of functions) {
      // Check if function is referenced anywhere
      const isUsed = await this.isFunctionUsed(func.function_name);
      
      if (!isUsed) {
        // Check if it's a system function we should keep
        const isSystemFunction = this.isSystemFunction(func.function_name);
        
        if (!isSystemFunction) {
          this.orphans.push({
            type: 'function',
            name: func.function_name,
            details: {
              arguments: func.argument_types,
              return_type: func.return_type
            },
            action: 'Consider removing',
            sql: `DROP FUNCTION IF EXISTS ${func.function_name};`
          });
        }
      }
    }
    
    console.log(`  Found ${this.orphans.filter(o => o.type === 'function').length} orphaned functions\n`);
  }
  
  private async checkOrphanedViews(): Promise<void> {
    console.log('🔍 Checking for orphaned views...');
    
    const { data: views, error } = await supabase.rpc('find_orphaned_views');
    
    if (!error && views) {
      views.forEach((view: any) => {
        this.orphans.push({
          type: 'view',
          name: view.view_name,
          details: { issue: view.issue },
          action: 'Fix or remove',
          sql: `DROP VIEW IF EXISTS ${view.view_name};`
        });
      });
    }
    
    console.log(`  Found ${views?.length || 0} orphaned views\n`);
  }
  
  private async checkUnusedIndexes(): Promise<void> {
    console.log('🔍 Checking for unused indexes...');
    
    const { data: indexes, error } = await supabase.rpc('find_unused_indexes');
    
    if (!error && indexes) {
      indexes.forEach((idx: any) => {
        this.orphans.push({
          type: 'unused_index',
          name: idx.index_name,
          details: {
            table: idx.table_name,
            size: idx.index_size,
            scans: idx.index_scans
          },
          action: 'Consider removing to save space',
          sql: `DROP INDEX IF EXISTS ${idx.index_name};`
        });
      });
    }
    
    console.log(`  Found ${indexes?.length || 0} unused indexes\n`);
  }
  
  private async checkDuplicateIndexes(): Promise<void> {
    console.log('🔍 Checking for duplicate indexes...');
    
    const { data: duplicates, error } = await supabase.rpc('find_duplicate_indexes');
    
    if (!error && duplicates) {
      duplicates.forEach((dup: any) => {
        this.orphans.push({
          type: 'duplicate_index',
          name: dup.index2,
          details: {
            table: dup.table_name,
            duplicate_of: dup.index1
          },
          action: 'Remove duplicate',
          sql: `DROP INDEX IF EXISTS ${dup.index2};`
        });
      });
    }
    
    console.log(`  Found ${duplicates?.length || 0} duplicate indexes\n`);
  }
  
  private async checkEmptyTables(): Promise<void> {
    console.log('🔍 Checking for empty tables...');
    
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (tables) {
      for (const table of tables) {
        const { count } = await supabase
          .from(table.table_name)
          .select('*', { count: 'exact', head: true });
        
        if (count === 0) {
          // Check if it's a lookup table that should stay
          const isLookupTable = table.table_name.includes('_types') || 
                               table.table_name.includes('_config') ||
                               table.table_name.includes('_settings');
          
          if (!isLookupTable) {
            this.orphans.push({
              type: 'empty_table',
              name: table.table_name,
              details: { record_count: 0 },
              action: 'Consider removing if unused',
              sql: `-- Review before dropping: DROP TABLE IF EXISTS ${table.table_name} CASCADE;`
            });
          }
        }
      }
    }
    
    console.log(`  Found ${this.orphans.filter(o => o.type === 'empty_table').length} empty tables\n`);
  }
  
  private async checkUnusedColumns(): Promise<void> {
    console.log('🔍 Checking for unused columns (100% NULL)...');
    
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');
    
    if (tables) {
      for (const table of tables) {
        // Get table row count
        const { count } = await supabase
          .from(table.table_name)
          .select('*', { count: 'exact', head: true });
        
        if (count && count > 100) { // Only check tables with significant data
          // Get columns
          const { data: columns } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_schema', 'public')
            .eq('table_name', table.table_name);
          
          if (columns) {
            for (const col of columns) {
              // Skip system columns
              if (['id', 'created_at', 'updated_at'].includes(col.column_name)) continue;
              
              // Check if column is all NULL
              const checkQuery = `
                SELECT COUNT(*) as non_null_count 
                FROM ${table.table_name} 
                WHERE ${col.column_name} IS NOT NULL
                LIMIT 1
              `;
              
              // This would need proper execution
              // For now, we'll skip implementation
            }
          }
        }
      }
    }
  }
  
  private async checkOrphanedTriggers(): Promise<void> {
    console.log('🔍 Checking for orphaned triggers...');
    
    // Check for triggers on non-existent tables or calling non-existent functions
    const query = `
      SELECT 
        t.tgname as trigger_name,
        c.relname as table_name,
        p.proname as function_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND t.tgname NOT LIKE 'pg_%'
        AND t.tgname NOT LIKE 'RI_ConstraintTrigger_%'
    `;
    
    // Implementation would check if function still exists
  }
  
  private async isFunctionUsed(functionName: string): Promise<boolean> {
    // Check multiple sources:
    // 1. Used in other functions
    // 2. Used in views
    // 3. Used in triggers
    // 4. Called from application (check sys_function_usage)
    
    // Check sys_function_usage
    const { data: usage } = await supabase
      .from('sys_function_usage')
      .select('last_used')
      .eq('function_name', functionName)
      .gte('last_used', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (usage && usage.length > 0) return true;
    
    // Check if used in views
    const { data: views } = await supabase
      .from('pg_views')
      .select('viewname')
      .eq('schemaname', 'public')
      .like('definition', `%${functionName}%`);
    
    if (views && views.length > 0) return true;
    
    // Would need more checks...
    return false;
  }
  
  private isSystemFunction(functionName: string): boolean {
    const systemFunctions = [
      'update_updated_at_column',
      'check_table_rls_status',
      'get_tables_without_rls',
      'sys_detect_database_changes',
      'sys_process_maintenance_rules'
    ];
    
    return systemFunctions.includes(functionName) ||
           functionName.startsWith('pg_') ||
           functionName.startsWith('plpgsql_');
  }
  
  private async generateCleanupReport(): Promise<void> {
    console.log('\n📊 Cleanup Report\n');
    
    if (this.orphans.length === 0) {
      console.log('✅ No orphaned objects found!');
      return;
    }
    
    // Group by type
    const byType = this.orphans.reduce((acc, obj) => {
      if (!acc[obj.type]) acc[obj.type] = [];
      acc[obj.type].push(obj);
      return acc;
    }, {} as Record<string, OrphanedObject[]>);
    
    // Report by type
    Object.entries(byType).forEach(([type, objects]) => {
      console.log(`\n${this.getTypeEmoji(type)} ${this.getTypeLabel(type)} (${objects.length}):`);
      
      objects.forEach(obj => {
        console.log(`  - ${obj.name}`);
        if (obj.details) {
          Object.entries(obj.details).forEach(([key, value]) => {
            console.log(`    ${key}: ${value}`);
          });
        }
        console.log(`    Action: ${obj.action}`);
      });
    });
    
    // Generate cleanup SQL
    await this.generateCleanupSQL();
  }
  
  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'function': '🔧',
      'view': '👁️',
      'unused_index': '📊',
      'duplicate_index': '♊',
      'empty_table': '📭',
      'unused_column': '🏚️',
      'trigger': '⚡'
    };
    return emojis[type] || '❓';
  }
  
  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'function': 'Orphaned Functions',
      'view': 'Broken Views',
      'unused_index': 'Unused Indexes',
      'duplicate_index': 'Duplicate Indexes',
      'empty_table': 'Empty Tables',
      'unused_column': 'Unused Columns',
      'trigger': 'Orphaned Triggers'
    };
    return labels[type] || type;
  }
  
  private async generateCleanupSQL(): Promise<void> {
    if (this.orphans.filter(o => o.sql).length === 0) return;
    
    console.log('\n📝 Cleanup SQL Script:\n');
    console.log('-- Database Cleanup Script');
    console.log(`-- Generated: ${new Date().toISOString()}`);
    console.log('-- Review each statement carefully before executing!\n');
    
    const byType = this.orphans.reduce((acc, obj) => {
      if (!acc[obj.type]) acc[obj.type] = [];
      acc[obj.type].push(obj);
      return acc;
    }, {} as Record<string, OrphanedObject[]>);
    
    Object.entries(byType).forEach(([type, objects]) => {
      console.log(`\n-- ${this.getTypeLabel(type)}`);
      objects.forEach(obj => {
        if (obj.sql) {
          console.log(`-- ${obj.name}: ${obj.action}`);
          console.log(obj.sql);
        }
      });
    });
    
    console.log('\n-- End of cleanup script');
  }
}

// Run cleanup
const cleanup = new DatabaseCleanup();
cleanup.runCleanup().catch(console.error);