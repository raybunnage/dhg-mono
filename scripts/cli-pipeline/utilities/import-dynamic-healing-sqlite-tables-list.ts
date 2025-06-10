#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import Database from 'better-sqlite3';

/**
 * Import complete table list from SQLite system tables (sqlite_master)
 * Creates a comprehensive tracking table for import management
 * 
 * Source: sqlite_master table in /Users/raybunnage/Documents/github/dhg-mono/file_types/db/dynamichealing.db
 * Target: import_dynamic_healing_sqlite table in Supabase
 * 
 * SAFETY: Only reads from sqlite_master, no risk to existing data
 */

const SQLITE_DB_PATH = '/Users/raybunnage/Documents/github/dhg-mono/file_types/db/dynamichealing.db';
const TARGET_TABLE = 'import_dynamic_healing_sqlite';

interface SQLiteTableInfo {
  table_name: string;
  record_count: number;
  column_count: number;
  primary_key: string;
  sample_columns: string;
  has_autoincrement: boolean;
  table_size_category: string;
  // Import tracking fields
  import_status: string;
  supabase_table_name: string | null;
  import_priority: string;
  import_notes: string | null;
  last_checked: string;
}

async function importDynamicHealingSQLiteTablesList() {
  console.log('🔍 Creating SQLite tables inventory from sqlite_master...');
  console.log(`Source: ${SQLITE_DB_PATH} (sqlite_master table)`);
  console.log(`Target: ${TARGET_TABLE}`);
  console.log(`⚠️  SAFETY: Only reading sqlite_master - no risk to existing data`);
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // 1. Open SQLite database in read-only mode
    console.log('\n📂 Opening SQLite database (read-only)...');
    const db = new Database(SQLITE_DB_PATH, { readonly: true });
    
    // 2. Get all user tables from sqlite_master (the authoritative source)
    console.log('\n📋 Querying sqlite_master for all user tables...');
    const tablesQuery = db.prepare(`
      SELECT 
        name as table_name,
        sql as create_sql
      FROM sqlite_master 
      WHERE type = 'table' 
      AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    const systemTables = tablesQuery.all() as { table_name: string; create_sql: string }[];
    
    console.log(`📊 Found ${systemTables.length} user tables in sqlite_master`);
    
    // 3. Create comprehensive tracking table in Supabase
    console.log('\n🔧 Creating import tracking table in Supabase...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${TARGET_TABLE} (
        id BIGSERIAL PRIMARY KEY,
        table_name TEXT NOT NULL UNIQUE,
        record_count BIGINT NOT NULL,
        column_count INTEGER NOT NULL,
        primary_key TEXT,
        sample_columns TEXT,
        has_autoincrement BOOLEAN DEFAULT FALSE,
        table_size_category TEXT NOT NULL,
        -- Import tracking fields
        import_status TEXT DEFAULT 'pending' CHECK (import_status IN ('pending', 'in_progress', 'completed', 'skipped', 'error')),
        supabase_table_name TEXT,
        import_priority TEXT DEFAULT 'medium' CHECK (import_priority IN ('high', 'medium', 'low')),
        import_notes TEXT,
        last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Add helpful indexes
      CREATE INDEX IF NOT EXISTS idx_sqlite_tables_status ON ${TARGET_TABLE}(import_status);
      CREATE INDEX IF NOT EXISTS idx_sqlite_tables_priority ON ${TARGET_TABLE}(import_priority);
      CREATE INDEX IF NOT EXISTS idx_sqlite_tables_size ON ${TARGET_TABLE}(table_size_category);
    `;
    
    const { error: createError } = await supabase.rpc('execute_sql', { 
      sql_query: createTableSQL 
    });
    
    if (createError) {
      throw new Error(`Failed to create table: ${createError.message}`);
    }
    console.log(`✅ Table ${TARGET_TABLE} created with import tracking fields`);
    
    // 4. Clear existing data (fresh start)
    console.log('\n🗑️ Clearing existing data for fresh import...');
    const { error: clearError } = await supabase.rpc('execute_sql', {
      sql_query: `DELETE FROM ${TARGET_TABLE};`
    });
    
    if (clearError) {
      console.warn('Warning clearing data:', clearError.message);
    }
    
    // 5. Analyze each table and build comprehensive info
    console.log('\n🔍 Analyzing each table structure and data...');
    const tableInfos: SQLiteTableInfo[] = [];
    
    for (let i = 0; i < systemTables.length; i++) {
      const tableName = systemTables[i].table_name;
      const createSQL = systemTables[i].create_sql;
      
      console.log(`  📊 [${i + 1}/${systemTables.length}] Analyzing: ${tableName}`);
      
      try {
        // Get table schema
        const schemaQuery = db.prepare(`PRAGMA table_info("${tableName}")`);
        const columns = schemaQuery.all() as any[];
        
        // Get record count
        const countQuery = db.prepare(`SELECT COUNT(*) as count FROM "${tableName}"`);
        const countResult = countQuery.get() as { count: number };
        
        // Extract metadata
        const primaryKeyColumns = columns.filter(col => col.pk).map(col => col.name);
        const sampleColumns = columns.slice(0, 4).map(col => `${col.name}:${col.type}`).join(', ');
        const hasAutoincrement = createSQL?.toLowerCase().includes('autoincrement') || false;
        
        // Categorize by size for priority
        let sizeCategory: string;
        let priority: string;
        if (countResult.count === 0) {
          sizeCategory = 'empty';
          priority = 'low';
        } else if (countResult.count < 100) {
          sizeCategory = 'small';
          priority = 'medium';
        } else if (countResult.count < 1000) {
          sizeCategory = 'medium';
          priority = 'medium';
        } else if (countResult.count < 10000) {
          sizeCategory = 'large';
          priority = 'high';
        } else {
          sizeCategory = 'very_large';
          priority = 'high';
        }
        
        // Generate suggested Supabase table name
        const suggestedName = `import_${tableName}`;
        
        // Determine initial import notes
        let notes = null;
        if (countResult.count === 0) {
          notes = 'Empty table - low priority for import';
        } else if (countResult.count > 10000) {
          notes = 'Large table - consider batch import strategy';
        } else if (tableName.includes('backup')) {
          notes = 'Backup table - evaluate if current version exists';
        }
        
        const tableInfo: SQLiteTableInfo = {
          table_name: tableName,
          record_count: countResult.count,
          column_count: columns.length,
          primary_key: primaryKeyColumns.join(', ') || 'none',
          sample_columns: sampleColumns,
          has_autoincrement: hasAutoincrement,
          table_size_category: sizeCategory,
          import_status: 'pending',
          supabase_table_name: suggestedName,
          import_priority: priority,
          import_notes: notes,
          last_checked: new Date().toISOString()
        };
        
        tableInfos.push(tableInfo);
        
        console.log(`    ✅ ${tableName}: ${columns.length} cols, ${countResult.count.toLocaleString()} records [${sizeCategory}]`);
        
      } catch (tableError) {
        console.warn(`    ⚠️ Error analyzing ${tableName}:`, tableError);
      }
    }
    
    // 6. Insert comprehensive table info
    console.log('\n📥 Inserting table inventory into Supabase...');
    
    // Use direct SQL insert to avoid schema cache issues
    const insertValues = tableInfos.map(table => 
      `('${table.table_name}', ${table.record_count}, ${table.column_count}, '${table.primary_key}', '${table.sample_columns.replace(/'/g, "''")}', ${table.has_autoincrement}, '${table.table_size_category}', '${table.import_status}', '${table.supabase_table_name}', '${table.import_priority}', ${table.import_notes ? `'${table.import_notes.replace(/'/g, "''")}'` : 'NULL'}, '${table.last_checked}')`
    ).join(',\n    ');
    
    const insertSQL = `
      INSERT INTO ${TARGET_TABLE} (
        table_name, record_count, column_count, primary_key, sample_columns, 
        has_autoincrement, table_size_category, import_status, supabase_table_name, 
        import_priority, import_notes, last_checked
      ) VALUES 
        ${insertValues};
    `;
    
    const { error: insertError } = await supabase.rpc('execute_sql', {
      sql_query: insertSQL
    });
    
    if (insertError) {
      throw new Error(`Failed to insert data: ${insertError.message}`);
    }
    
    console.log(`✅ Inserted ${tableInfos.length} table records`);
    
    // 7. Verify and show summary
    console.log('\n🔍 Verifying import...');
    const { data: verifyData, error: verifyError } = await supabase.rpc('execute_sql', {
      sql_query: `SELECT COUNT(*) as count FROM ${TARGET_TABLE};`
    });
    
    if (verifyError) {
      console.warn('Could not verify count:', verifyError.message);
    } else {
      console.log(`📊 Verified: ${verifyData[0]?.count || 0} tables in tracking system`);
    }
    
    // 8. Show summary statistics
    const totalRecords = tableInfos.reduce((sum, table) => sum + table.record_count, 0);
    const tablesWithData = tableInfos.filter(table => table.record_count > 0).length;
    const highPriorityTables = tableInfos.filter(table => table.import_priority === 'high').length;
    
    // 9. Close SQLite database
    db.close();
    
    console.log('\n🎉 SQLite table inventory completed!');
    console.log(`📋 Summary:`);
    console.log(`   Source: sqlite_master in ${SQLITE_DB_PATH}`);
    console.log(`   Target: ${TARGET_TABLE} table in Supabase`);
    console.log(`   Tables cataloged: ${tableInfos.length}`);
    console.log(`   Total records across all tables: ${totalRecords.toLocaleString()}`);
    console.log(`   Tables with data: ${tablesWithData}/${tableInfos.length}`);
    console.log(`   High priority tables: ${highPriorityTables}`);
    
    // Show priority breakdown
    console.log('\n📊 Import Priority Breakdown:');
    const priorityBreakdown = tableInfos.reduce((acc, table) => {
      acc[table.import_priority] = (acc[table.import_priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(priorityBreakdown).forEach(([priority, count]) => {
      console.log(`   ${priority}: ${count} tables`);
    });
    
    // Show size category breakdown
    console.log('\n📏 Size Category Breakdown:');
    const sizeBreakdown = tableInfos.reduce((acc, table) => {
      acc[table.table_size_category] = (acc[table.table_size_category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(sizeBreakdown).forEach(([size, count]) => {
      console.log(`   ${size}: ${count} tables`);
    });
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  importDynamicHealingSQLiteTablesList();
}

export { importDynamicHealingSQLiteTablesList };