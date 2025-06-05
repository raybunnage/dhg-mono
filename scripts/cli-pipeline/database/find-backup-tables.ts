#!/usr/bin/env node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface BackupTable {
  table_name: string;
  table_schema: string;
  size: string;
  row_count: number;
  creation_date?: string;
  last_modified?: string;
  original_table?: string;
}

interface TableStats {
  table_name: string;
  size: string;
  row_count: number;
  last_modified?: string;
}

async function getTableStats(supabase: any, schema: string, tableName: string): Promise<TableStats | null> {
  try {
    // Get table size and stats
    const { data: statsData, error: statsError } = await supabase.rpc('execute_sql', {
      sql_query: `SELECT pg_size_pretty(pg_total_relation_size('"${schema}"."${tableName}"')) as size, (SELECT COUNT(*) FROM "${schema}"."${tableName}") as row_count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = '${schema}' AND c.relname = '${tableName}' AND c.relkind = 'r'`
    });

    if (statsError) {
      console.error(`Error getting stats for ${schema}.${tableName}:`, statsError);
      return null;
    }

    // The execute_sql function returns data as an array
    const stats = Array.isArray(statsData) && statsData.length > 0 ? statsData[0] : null;
    return stats;
  } catch (error) {
    console.error(`Error getting stats for ${schema}.${tableName}:`, error);
    return null;
  }
}

async function findBackupTables() {
  const supabase = SupabaseClientService.getInstance().getClient();

  console.log('🔍 Searching for backup tables in the database...\n');

  try {
    // Query information_schema for all tables
    const { data: tablesData, error: tablesError } = await supabase.rpc('execute_sql', {
      sql_query: `SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'cron', 'extensions') AND table_type = 'BASE TABLE' ORDER BY table_schema, table_name`
    });

    if (tablesError) {
      console.error('Error querying tables:', tablesError);
      return;
    }

    // Debug the response
    console.log('Response type:', typeof tablesData);
    console.log('Is array:', Array.isArray(tablesData));
    
    // The execute_sql function returns data as an array for SELECT queries
    if (!tablesData || !Array.isArray(tablesData)) {
      console.log('Unexpected response format from execute_sql');
      console.log('Response:', tablesData);
      return;
    }
    
    const tables = tablesData;
    
    if (tables.length === 0) {
      console.log('No tables found in the database.');
      return;
    }

    console.log(`Found ${tables.length} tables total in the database\n`);

    // Patterns that indicate a backup table
    const backupPatterns = [
      /backup/i,
      /bak/i,
      /archive/i,
      /old/i,
      /_copy/i,
      /_tmp/i,
      /_temp/i,
      /\d{4}_\d{2}_\d{2}/, // Date patterns like 2025_05_02
      /\d{8}/, // Date patterns like 20250502
      /_v\d+/, // Version patterns like _v1, _v2
      /_\d+$/, // Ending with numbers
    ];

    const backupTables: BackupTable[] = [];

    // Check each table against backup patterns
    for (const table of tables) {
      const fullTableName = `${table.table_schema}.${table.table_name}`;
      
      // Check if table name matches any backup pattern
      const isBackup = backupPatterns.some(pattern => pattern.test(table.table_name));
      
      if (isBackup) {
        // Get table statistics
        const stats = await getTableStats(supabase, table.table_schema, table.table_name);
        
        // Try to determine the original table name
        let originalTable = table.table_name;
        
        // Remove common backup suffixes
        originalTable = originalTable.replace(/_(backup|bak|archive|old|copy|tmp|temp).*$/i, '');
        originalTable = originalTable.replace(/_\d{4}_\d{2}_\d{2}.*$/, ''); // Remove date suffixes
        originalTable = originalTable.replace(/_\d{8}.*$/, ''); // Remove date suffixes
        originalTable = originalTable.replace(/_v\d+$/, ''); // Remove version suffixes
        originalTable = originalTable.replace(/_\d+$/, ''); // Remove number suffixes
        
        backupTables.push({
          table_name: table.table_name,
          table_schema: table.table_schema,
          size: stats?.size || 'Unknown',
          row_count: stats?.row_count || 0,
          original_table: originalTable !== table.table_name ? originalTable : undefined,
        });
      }
    }

    // Group by original table
    const groupedByOriginal = backupTables.reduce((acc, backup) => {
      const key = backup.original_table || backup.table_name;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(backup);
      return acc;
    }, {} as Record<string, BackupTable[]>);

    // Display results
    console.log(`📊 Found ${backupTables.length} backup tables\n`);

    if (backupTables.length === 0) {
      console.log('No backup tables found.');
      return;
    }

    // Display grouped results
    Object.entries(groupedByOriginal).forEach(([originalTable, backups]) => {
      console.log(`\n📁 Original table: ${originalTable}`);
      console.log('─'.repeat(50));
      
      backups.forEach(backup => {
        console.log(`  🗃️  ${backup.table_schema}.${backup.table_name}`);
        console.log(`      Size: ${backup.size} | Rows: ${backup.row_count.toLocaleString()}`);
      });
    });

    // Summary statistics
    console.log('\n' + '═'.repeat(50));
    console.log('📈 Summary:');
    console.log(`   Total backup tables: ${backupTables.length}`);
    console.log(`   Schemas involved: ${new Set(backupTables.map(t => t.table_schema)).size}`);
    
    // Calculate total size if possible
    const totalRows = backupTables.reduce((sum, t) => sum + t.row_count, 0);
    console.log(`   Total rows in backups: ${totalRows.toLocaleString()}`);

    // List all unique patterns found
    console.log('\n🔍 Backup patterns found:');
    const patterns = new Set<string>();
    backupTables.forEach(t => {
      if (t.table_name.match(/backup/i)) patterns.add('*backup*');
      if (t.table_name.match(/bak/i)) patterns.add('*bak*');
      if (t.table_name.match(/archive/i)) patterns.add('*archive*');
      if (t.table_name.match(/old/i)) patterns.add('*old*');
      if (t.table_name.match(/_copy/i)) patterns.add('*_copy*');
      if (t.table_name.match(/_tmp/i)) patterns.add('*_tmp*');
      if (t.table_name.match(/_temp/i)) patterns.add('*_temp*');
      if (t.table_name.match(/\d{4}_\d{2}_\d{2}/)) patterns.add('*YYYY_MM_DD*');
      if (t.table_name.match(/\d{8}/)) patterns.add('*YYYYMMDD*');
      if (t.table_name.match(/_v\d+/)) patterns.add('*_vN*');
    });
    
    patterns.forEach(p => console.log(`   - ${p}`));

  } catch (error) {
    console.error('Error finding backup tables:', error);
  }
}

// Run the script
findBackupTables().catch(console.error);