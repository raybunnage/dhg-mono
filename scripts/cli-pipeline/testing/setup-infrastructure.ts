#!/usr/bin/env ts-node

/**
 * Setup Testing Infrastructure
 * Creates database tables and views needed for testing
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../supabase/types';
import { config } from 'dotenv';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Load environment variables
const envPath = join(process.cwd(), '.env.development');
console.log('🔧 Loading environment from:', envPath);

// Load .env.development file
config({ path: envPath });

// Create Supabase client for CLI use
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

console.log('🔍 Environment check:');
console.log('  SUPABASE_URL:', supabaseUrl ? 'found' : 'missing');
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'found' : 'missing');
console.log('  SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'found' : 'missing');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Check if .env.development has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  
  // Try to help diagnose the issue
  if (existsSync(envPath)) {
    console.log('✅ .env.development file exists');
    const envContent = readFileSync(envPath, 'utf-8');
    const hasUrl = envContent.includes('SUPABASE_URL=');
    const hasKey = envContent.includes('SUPABASE_SERVICE_ROLE_KEY=') || envContent.includes('SUPABASE_ANON_KEY=');
    console.log(`  Contains SUPABASE_URL: ${hasUrl}`);
    console.log(`  Contains keys: ${hasKey}`);
  } else {
    console.error('❌ .env.development file not found at:', envPath);
  }
  
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

async function setupInfrastructure() {
  console.log('🚀 Setting up testing infrastructure...');

  try {
    // Read and execute the migration
    const migrationPath = join(process.cwd(), 'supabase/migrations/20250610_create_service_testing_tables.sql');
    
    if (!existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Applying testing database migration...');

    // Split SQL into statements and execute each one
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('execute_sql', { sql_query: statement });
          
          if (error) {
            if (error.message.includes('already exists') || (error.message.includes('relation') && error.message.includes('already exists'))) {
              console.log(`  ⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`);
              skipCount++;
            } else {
              console.error(`  ❌ Error: ${error.message}`);
              console.error(`  Statement: ${statement.substring(0, 100)}...`);
            }
          } else {
            console.log(`  ✅ Success: ${statement.substring(0, 50)}...`);
            successCount++;
          }
        } catch (err) {
          console.error(`  ❌ Exception: ${err}`);
        }
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ⏭️  Skipped: ${skipCount}`);

    // Verify the tables were created
    console.log('\n🔍 Verifying infrastructure...');
    
    const { data: testTables, error: tablesError } = await supabase
      .from('sys_table_definitions')
      .select('table_name, description')
      .in('table_name', ['sys_service_test_runs', 'sys_service_test_health_view', 'sys_service_testing_view']);

    if (tablesError) {
      console.warn(`⚠️  Could not verify tables: ${tablesError.message}`);
    } else if (testTables && testTables.length > 0) {
      console.log('✅ Testing infrastructure verified:');
      testTables.forEach(table => {
        console.log(`  - ${table.table_name}: ${table.description}`);
      });
    }

    // Test querying the service registry directly
    console.log('\n🧪 Testing service registry query...');
    try {
      const { data: services, error } = await supabase
        .from('sys_shared_services')
        .select('service_name, category, used_by_apps, used_by_pipelines')
        .eq('status', 'active')
        .limit(5);

      if (error) {
        console.warn(`⚠️  Could not query service registry: ${error.message}`);
      } else if (services && services.length > 0) {
        console.log(`✅ Found ${services.length} active services in registry`);
        services.forEach(service => {
          const usageCount = (service.used_by_apps?.length || 0) + (service.used_by_pipelines?.length || 0);
          const priority = usageCount >= 5 ? 'critical' : usageCount >= 2 ? 'important' : 'standard';
          console.log(`  - ${service.service_name} (${priority})`);
        });
      } else {
        console.log('📋 No services found in registry - you may need to populate it first');
      }
    } catch (err) {
      console.warn(`⚠️  Could not test service registry: ${err}`);
    }

    console.log('\n🎉 Testing infrastructure setup complete!');
    console.log('\nNext steps:');
    console.log('  1. Run: ./scripts/cli-pipeline/testing/testing-cli.sh test-critical');
    console.log('  2. Run: ./scripts/cli-pipeline/testing/testing-cli.sh health-report');

  } catch (error) {
    console.error('❌ Infrastructure setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupInfrastructure();
}