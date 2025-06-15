#!/usr/bin/env ts-node
/**
 * Simple inventory discovery for Phase 1 Continuous Improvement
 * Finds all services, pipelines, tables, tests, apps, and proxies
 */

import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client.js';

interface InventoryItem {
  item_type: 'service' | 'pipeline' | 'table' | 'test' | 'app' | 'proxy';
  item_name: string;
  item_path?: string;
  metadata?: Record<string, any>;
}

async function ensureTablesExist(supabase: any): Promise<boolean> {
  // Check if continuous_inventory table exists
  const { error } = await supabase
    .from('continuous_inventory')
    .select('id')
    .limit(1);
  
  if (error?.code === '42P01' || error?.message?.includes('relation')) {
    console.log('⚠️  Tables do not exist yet.');
    console.log('\nTo create the Phase 1 tables, please run this SQL in Supabase:');
    console.log('https://supabase.com/dashboard/project/jdksnfkupzywjdfefkyj/sql\n');
    console.log('Then copy and paste the migration file:');
    console.log('supabase/migrations/20250615_phase1_continuous_improvement_simplification.sql\n');
    return false;
  }
  
  return true;
}

async function discoverInventory(): Promise<void> {
  console.log('🔍 Starting inventory discovery...\n');
  
  const items: InventoryItem[] = [];
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Check if tables exist first
  const tablesExist = await ensureTablesExist(supabase);
  if (!tablesExist) {
    console.log('❌ Cannot proceed without tables. Please create them first.');
    return;
  }

  // 1. Discover services
  console.log('📦 Discovering services...');
  const serviceFiles = await glob('packages/shared/services/*/index.ts');
  for (const file of serviceFiles) {
    const serviceName = path.basename(path.dirname(file));
    items.push({
      item_type: 'service',
      item_name: serviceName,
      item_path: file,
      metadata: { location: 'shared' }
    });
  }
  console.log(`  Found ${serviceFiles.length} shared services`);

  // 2. Discover CLI pipelines
  console.log('\n🚀 Discovering CLI pipelines...');
  const pipelineFiles = await glob('scripts/cli-pipeline/*/*.ts', {
    ignore: ['**/node_modules/**', '**/*.test.ts', '**/*.spec.ts']
  });
  const pipelines = new Set<string>();
  for (const file of pipelineFiles) {
    const pipelineName = path.basename(path.dirname(file));
    if (!pipelines.has(pipelineName)) {
      pipelines.add(pipelineName);
      items.push({
        item_type: 'pipeline',
        item_name: pipelineName,
        item_path: path.dirname(file),
        metadata: { 
          fileCount: pipelineFiles.filter(f => f.includes(`/${pipelineName}/`)).length 
        }
      });
    }
  }
  console.log(`  Found ${pipelines.size} CLI pipelines`);

  // 3. Discover apps
  console.log('\n🎨 Discovering apps...');
  const appDirs = await glob('apps/*/package.json');
  for (const packageFile of appDirs) {
    const appName = path.basename(path.dirname(packageFile));
    const packageJson = JSON.parse(await fs.readFile(packageFile, 'utf-8'));
    items.push({
      item_type: 'app',
      item_name: appName,
      item_path: path.dirname(packageFile),
      metadata: {
        version: packageJson.version,
        hasVite: !!packageJson.devDependencies?.vite,
        scripts: Object.keys(packageJson.scripts || {})
      }
    });
  }
  console.log(`  Found ${appDirs.length} apps`);

  // 4. Discover proxy servers
  console.log('\n🔌 Discovering proxy servers...');
  const proxyFiles = await glob('scripts/cli-pipeline/proxy/start-*-proxy.ts');
  for (const file of proxyFiles) {
    const match = path.basename(file).match(/start-(.+)-proxy\.ts/);
    if (match) {
      items.push({
        item_type: 'proxy',
        item_name: match[1],
        item_path: file,
        metadata: { 
          // Could extract port from file content if needed
        }
      });
    }
  }
  console.log(`  Found ${proxyFiles.length} proxy servers`);

  // 5. Discover tests
  console.log('\n🧪 Discovering test files...');
  const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', {
    ignore: ['**/node_modules/**', '**/dist/**', '**/.archive*/**']
  });
  const testsByLocation = new Map<string, number>();
  for (const file of testFiles) {
    const parts = file.split('/');
    const location = parts[0] === 'packages' ? `${parts[0]}/${parts[1]}` : parts[0];
    testsByLocation.set(location, (testsByLocation.get(location) || 0) + 1);
  }
  
  for (const [location, count] of testsByLocation.entries()) {
    items.push({
      item_type: 'test',
      item_name: location,
      item_path: location,
      metadata: { testFileCount: count }
    });
  }
  console.log(`  Found ${testFiles.length} test files in ${testsByLocation.size} locations`);

  // 6. Discover database tables
  console.log('\n💾 Discovering database tables...');
  const { data: tableInfo, error: tableError } = await supabase
    .from('sys_table_info_functions')
    .select('table_name')
    .order('table_name');
  
  if (!tableError && tableInfo) {
    for (const table of tableInfo) {
      items.push({
        item_type: 'table',
        item_name: table.table_name,
        metadata: { source: 'database' }
      });
    }
    console.log(`  Found ${tableInfo.length} database tables`);
  } else {
    // Fallback: parse from types.ts
    console.log('  Falling back to types.ts parsing...');
    const typesContent = await fs.readFile('supabase/types.ts', 'utf-8');
    const tableMatches = typesContent.matchAll(/(\w+): {\s*Row: {/g);
    const tables = new Set<string>();
    for (const match of tableMatches) {
      tables.add(match[1]);
    }
    for (const tableName of tables) {
      items.push({
        item_type: 'table',
        item_name: tableName,
        metadata: { source: 'types.ts' }
      });
    }
    console.log(`  Found ${tables.size} tables from types.ts`);
  }

  // Save to database
  console.log('\n💾 Saving inventory to database...');
  
  // Clear existing inventory
  const { error: deleteError } = await supabase
    .from('continuous_inventory')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
  
  if (deleteError) {
    console.error('Error clearing inventory:', deleteError);
    return;
  }

  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .from('continuous_inventory')
      .upsert(batch, { onConflict: 'item_type,item_name' });
    
    if (insertError) {
      console.error('Error inserting batch:', insertError);
    } else {
      console.log(`  Saved batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
    }
  }

  // Show summary
  console.log('\n📊 Inventory Summary:');
  console.log('====================');
  const summary = items.reduce((acc, item) => {
    acc[item.item_type] = (acc[item.item_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(summary).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log(`  Total items: ${items.length}`);
  
  console.log('\n✅ Inventory discovery complete!');
}

// Run if called directly
if (require.main === module) {
  discoverInventory().catch(console.error);
}