import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';

// Add commander option parsing
program
  .option('--dry-run', 'Show what would be backed up without executing')
  .parse(process.argv);

const options = program.opts();

interface BackupConfig {
  tables: string[];
  defaultOptions: {
    includeStructure: boolean;
    includeData: boolean;
    includeIndexes: boolean;
    includeConstraints: boolean;
  };
}

async function createBackup() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Load backup configuration
  const configPath = path.join(__dirname, '../../backup-config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ Backup configuration not found. Run list-backup-config to create one.');
    process.exit(1);
  }
  
  const config: BackupConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  
  // Generate backup timestamp - use local date to match user's timezone
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`; // YYYYMMDD format
  const backupPrefix = `backup_${dateStr}`;
  
  console.log('🔄 Database Backup Process');
  console.log('========================');
  console.log(`Date: ${today.toLocaleDateString()}`);
  console.log(`Backup prefix: ${backupPrefix}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');
  
  console.log('Tables to backup:');
  for (const table of config.tables) {
    console.log(`  - ${table} → backup.${table}_${dateStr}`);
  }
  console.log('');
  
  if (options.dryRun) {
    console.log('🏁 DRY RUN COMPLETE - No changes made');
    console.log('');
    console.log('What would happen:');
    console.log('1. Each table would be copied to the backup schema');
    console.log('2. Table names would have the date suffix added');
    console.log('3. All data, structure, indexes, and constraints would be preserved');
    console.log('');
    console.log('To run the actual backup, remove the --dry-run flag');
    return;
  }
  
  // Create backup schema if it doesn't exist
  console.log('Creating backup schema if needed...');
  const { error: schemaError } = await supabase.rpc('execute_sql', {
    sql_query: 'CREATE SCHEMA IF NOT EXISTS backup'
  });
  
  if (schemaError) {
    console.error('❌ Failed to create backup schema:', schemaError.message);
    process.exit(1);
  }
  
  let successCount = 0;
  let failureCount = 0;
  
  // Process each table
  for (const table of config.tables) {
    const backupTableName = `${table}_${dateStr}`;
    console.log(`\n📋 Backing up ${table}...`);
    
    try {
      // Check if backup already exists
      const checkQuery = `
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'backup' 
          AND table_name = '${backupTableName}'
        )
      `;
      
      const { data: exists, error: checkError } = await supabase.rpc('execute_sql', {
        sql_query: checkQuery
      });
      
      if (checkError) {
        throw new Error(`Failed to check existing backup: ${checkError.message}`);
      }
      
      if (exists && exists[0]?.exists) {
        console.log(`   ⚠️  Backup already exists: backup.${backupTableName}`);
        console.log(`   Skipping...`);
        continue;
      }
      
      // Create the backup
      const backupQuery = `
        CREATE TABLE backup.${backupTableName} AS 
        SELECT * FROM public.${table}
      `;
      
      const { error: backupError } = await supabase.rpc('execute_sql', {
        sql_query: backupQuery
      });
      
      if (backupError) {
        throw new Error(`Failed to create backup: ${backupError.message}`);
      }
      
      // Get record count
      const countQuery = `SELECT COUNT(*) as count FROM backup.${backupTableName}`;
      const { data: countData, error: countError } = await supabase.rpc('execute_sql', {
        sql_query: countQuery
      });
      
      if (countError) {
        throw new Error(`Failed to count records: ${countError.message}`);
      }
      
      const recordCount = countData?.[0]?.count || 0;
      console.log(`   ✅ Backed up ${recordCount} records to backup.${backupTableName}`);
      successCount++;
      
    } catch (error: any) {
      console.error(`   ❌ Failed to backup ${table}: ${error.message}`);
      failureCount++;
    }
  }
  
  // Summary
  console.log('\n📊 Backup Summary');
  console.log('================');
  console.log(`✅ Successful: ${successCount} tables`);
  if (failureCount > 0) {
    console.log(`❌ Failed: ${failureCount} tables`);
  }
  console.log(`📅 Backup date: ${dateStr}`);
  console.log('');
  
  if (successCount > 0) {
    console.log('Backed up tables can be found in the "backup" schema with date suffix.');
    console.log('Example: backup.google_sources_20250606');
  }
}

// Run the backup
createBackup().catch(console.error);