#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function verifyBackupSchema() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Verifying Backup Schema Migration...\n');
  
  // 1. Check if backup schema exists
  console.log('1. Checking if backup schema exists...');
  const { data: schemaData, error: schemaError } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name = 'backup'
    `
  });
  
  if (schemaError) {
    console.error('❌ Error checking schema:', schemaError);
    return;
  }
  
  if (schemaData && schemaData.length > 0) {
    console.log('✅ Backup schema exists\n');
  } else {
    console.log('❌ Backup schema not found\n');
    return;
  }
  
  // 2. List all tables in backup schema
  console.log('2. Listing all tables in backup schema...');
  const { data: tablesData, error: tablesError } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT table_name, 
             pg_size_pretty(pg_total_relation_size('backup.'||table_name)) as size
      FROM information_schema.tables 
      WHERE table_schema = 'backup' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  });
  
  if (tablesError) {
    console.error('❌ Error listing tables:', tablesError);
  } else if (tablesData && tablesData.length > 0) {
    console.log(`✅ Found ${tablesData.length} tables in backup schema:`);
    tablesData.forEach((table: any) => {
      console.log(`   - ${table.table_name} (${table.size})`);
    });
  } else {
    console.log('⚠️  No tables found in backup schema');
  }
  console.log();
  
  // 3. Check backup_metadata table
  console.log('3. Checking backup_metadata table...');
  const { data: metadataData, error: metadataError } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT COUNT(*) as count,
             MIN(backed_up_at) as oldest_backup,
             MAX(backed_up_at) as newest_backup
      FROM backup.backup_metadata
    `
  });
  
  if (metadataError) {
    console.error('❌ Error checking backup_metadata:', metadataError);
  } else if (metadataData && metadataData.length > 0) {
    const metadata = metadataData[0];
    console.log(`✅ backup_metadata table exists with ${metadata.count} records`);
    if (metadata.count > 0) {
      console.log(`   - Oldest backup: ${metadata.oldest_backup}`);
      console.log(`   - Newest backup: ${metadata.newest_backup}`);
    }
  }
  console.log();
  
  // 4. Query backup_inventory view
  console.log('4. Checking backup_inventory view...');
  const { data: inventoryData, error: inventoryError } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT original_table, 
             backup_table, 
             backed_up_at,
             record_count
      FROM backup.backup_inventory
      ORDER BY backed_up_at DESC
      LIMIT 10
    `
  });
  
  if (inventoryError) {
    console.error('❌ Error checking backup_inventory:', inventoryError);
  } else if (inventoryData && inventoryData.length > 0) {
    console.log(`✅ backup_inventory view works, showing latest ${inventoryData.length} backups:`);
    inventoryData.forEach((backup: any) => {
      console.log(`   - ${backup.original_table} → ${backup.backup_table} (${backup.record_count} records) at ${backup.backed_up_at}`);
    });
  } else {
    console.log('⚠️  No data in backup_inventory view');
  }
  console.log();
  
  // 5. Check for backup tables in public schema
  console.log('5. Checking for remaining backup tables in public schema...');
  const { data: publicBackupsData, error: publicBackupsError } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name LIKE '%_backup_%'
      ORDER BY table_name
    `
  });
  
  if (publicBackupsError) {
    console.error('❌ Error checking public schema:', publicBackupsError);
  } else if (publicBackupsData && publicBackupsData.length > 0) {
    console.log(`⚠️  Found ${publicBackupsData.length} backup tables still in public schema:`);
    publicBackupsData.forEach((table: any) => {
      console.log(`   - ${table.table_name}`);
    });
  } else {
    console.log('✅ No backup tables found in public schema');
  }
  console.log();
  
  // 6. Test backup function
  console.log('6. Testing backup.create_table_backup function...');
  const { data: testData, error: testError } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT backup.create_table_backup('document_types') as result
    `
  });
  
  if (testError) {
    console.error('❌ Error testing backup function:', testError);
  } else if (testData && testData.length > 0) {
    console.log(`✅ Backup function works: ${testData[0].result}`);
  }
  console.log();
  
  // Summary
  console.log('📊 Summary:');
  console.log('- Backup schema exists: ' + (schemaData && schemaData.length > 0 ? '✅' : '❌'));
  console.log('- Tables in backup schema: ' + (tablesData && tablesData.length > 0 ? `✅ (${tablesData.length})` : '❌'));
  console.log('- backup_metadata table: ' + (metadataData && !metadataError ? '✅' : '❌'));
  console.log('- backup_inventory view: ' + (inventoryData && !inventoryError ? '✅' : '❌'));
  console.log('- Public schema cleaned: ' + (publicBackupsData && publicBackupsData.length === 0 ? '✅' : '⚠️'));
  console.log('- Backup function works: ' + (testData && !testError ? '✅' : '❌'));
}

// Run verification
verifyBackupSchema().catch(console.error);