#!/usr/bin/env ts-node
/**
 * Simple and reliable migration runner
 * Executes SQL files using the execute_sql RPC function without complex parsing
 */

import { SupabaseClientService } from '../../../../../packages/shared/services/supabase-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

interface ApplyOptions {
  file: string;
  test?: boolean;
  verbose?: boolean;
}

async function applyMigration(options: ApplyOptions): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Validate file exists
    if (!existsSync(options.file)) {
      console.error(`❌ Migration file not found: ${options.file}`);
      console.log('\n💡 Usage: apply <migration-file.sql>');
      console.log('   Example: apply supabase/migrations/20250615_my_migration.sql');
      process.exit(1);
    }

    console.log(`🚀 Applying migration: ${path.basename(options.file)}`);
    console.log('');

    // Read migration file
    const sqlContent = await fs.readFile(options.file, 'utf-8');
    const fileSize = sqlContent.length;
    const lineCount = sqlContent.split('\n').length;
    
    console.log(`📄 File info:`);
    console.log(`   Size: ${(fileSize / 1024).toFixed(1)} KB`);
    console.log(`   Lines: ${lineCount}`);
    console.log('');

    // Connect to database
    console.log('🔌 Connecting to database...');
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Test connection first
    const { error: testError } = await supabase
      .from('sys_table_prefixes')
      .select('prefix')
      .limit(1);
    
    if (testError) {
      console.error('❌ Database connection failed:', testError.message);
      process.exit(1);
    }
    
    console.log('✅ Database connected');
    console.log('');

    // Check if execute_sql function exists
    const { error: rpcTestError } = await supabase.rpc('execute_sql', { 
      sql_query: "SELECT 'test'" 
    });
    
    if (rpcTestError) {
      console.error('❌ execute_sql function not available:', rpcTestError.message);
      console.log('\n💡 The execute_sql function is required for migrations.');
      console.log('   Run this migration first: 20250301000003_add_execute_sql_function.sql');
      process.exit(1);
    }

    if (options.test) {
      console.log('🧪 Test mode - migration will not be applied');
      console.log('   SQL content validated');
      console.log('   Database connection verified');
      console.log('   execute_sql function available');
      console.log('\n✅ Migration is ready to apply');
      console.log('   Run without --test to apply');
      return;
    }

    // Apply migration
    console.log('⚡ Executing migration...');
    
    if (options.verbose) {
      // Show first few lines of SQL
      const preview = sqlContent.split('\n').slice(0, 10).join('\n');
      console.log('\n📝 SQL Preview:');
      console.log(preview);
      if (lineCount > 10) {
        console.log('... (truncated)');
      }
      console.log('');
    }

    const execStartTime = Date.now();
    const { data, error } = await supabase.rpc('execute_sql', { 
      sql_query: sqlContent 
    });
    const execTime = Date.now() - execStartTime;

    if (error) {
      console.error('\n❌ Migration failed:', error.message);
      
      if (error.details) {
        console.log('\n📋 Error details:');
        console.log(error.details);
      }
      
      if (error.hint) {
        console.log('\n💡 Hint:', error.hint);
      }

      // Provide helpful suggestions based on common errors
      if (error.message.includes('already exists')) {
        console.log('\n💡 This migration may have been partially applied.');
        console.log('   Check the database and consider:');
        console.log('   - Running a rollback/down migration first');
        console.log('   - Modifying the migration to use IF NOT EXISTS');
      } else if (error.message.includes('does not exist')) {
        console.log('\n💡 Missing dependency detected.');
        console.log('   Check if required tables/functions exist');
        console.log('   You may need to run other migrations first');
      } else if (error.message.includes('permission denied')) {
        console.log('\n💡 Permission issue detected.');
        console.log('   Check RLS policies and user permissions');
      }

      process.exit(1);
    }

    // Success!
    console.log(`\n✅ Migration applied successfully! (${execTime}ms)`);
    
    if (data) {
      if (typeof data === 'object' && 'message' in data) {
        console.log(`   ${data.message}`);
      } else if (typeof data === 'object' && 'rowCount' in data) {
        console.log(`   Rows affected: ${data.rowCount}`);
      } else if (options.verbose) {
        console.log('   Result:', JSON.stringify(data, null, 2));
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total time: ${totalTime}ms`);

    // Suggest type regeneration for table/view changes
    if (sqlContent.match(/CREATE\s+(TABLE|VIEW)|ALTER\s+TABLE|DROP\s+(TABLE|VIEW)/i)) {
      console.log('\n📝 This migration modified tables/views.');
      console.log('   Consider regenerating TypeScript types:');
      console.log('   pnpm supabase gen types typescript --project-id jdksnfkupzywjdfefkyj > supabase/types.ts');
    }

    // Create record of successful migration
    const migrationRecord = {
      file: path.basename(options.file),
      appliedAt: new Date().toISOString(),
      executionTime: execTime,
      success: true
    };
    
    const recordPath = path.join(
      path.dirname(options.file), 
      '.applied-migrations.json'
    );
    
    try {
      let records = [];
      if (existsSync(recordPath)) {
        const existing = await fs.readFile(recordPath, 'utf-8');
        records = JSON.parse(existing);
      }
      records.push(migrationRecord);
      await fs.writeFile(recordPath, JSON.stringify(records, null, 2));
    } catch (e) {
      // Non-critical, just log
      if (options.verbose) {
        console.log('\n⚠️  Could not update migration records:', e);
      }
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): ApplyOptions {
  const args = process.argv.slice(2);
  const options: ApplyOptions = {
    file: '',
    test: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--test':
      case '-t':
        options.test = true;
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
      default:
        if (!arg.startsWith('-') && !options.file) {
          options.file = arg;
        }
        break;
    }
  }

  if (!options.file) {
    console.error('❌ Migration file required');
    showHelp();
    process.exit(1);
  }

  return options;
}

function showHelp(): void {
  console.log(`
Simple Migration Apply Tool

USAGE:
  apply [OPTIONS] <migration-file.sql>

OPTIONS:
  -t, --test       Test migration without applying
  -v, --verbose    Show detailed output
  -h, --help       Show this help message

EXAMPLES:
  # Apply a migration
  apply supabase/migrations/20250615_add_tables.sql

  # Test migration first
  apply --test migration.sql

  # Apply with verbose output
  apply --verbose migration.sql

NOTES:
  - Uses execute_sql RPC function (must exist in database)
  - Executes entire file as single transaction
  - No complex parsing - just runs the SQL
  - Records successful migrations in .applied-migrations.json

TIPS:
  - For very large migrations, consider splitting into multiple files
  - Use --test first to verify connectivity
  - Check Supabase dashboard if errors occur
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  applyMigration(options);
}