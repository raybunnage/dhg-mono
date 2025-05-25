#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function findMissingTables() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const targetTables = [
    'prompt_output_templates',
    'prompt_template_associations',
    'user_profiles_v2'
  ];

  console.log('🔍 Searching for tables in the database...\n');

  // Method 1: Try to query each table directly
  console.log('📊 Direct table access check:');
  console.log('─'.repeat(50));
  
  for (const tableName of targetTables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
        
      if (!error) {
        console.log(`✅ ${tableName}: EXISTS (${count} rows)`);
      } else {
        console.log(`❌ ${tableName}: NOT FOUND - ${error.message}`);
      }
    } catch (e) {
      console.log(`❌ ${tableName}: ERROR - ${e}`);
    }
  }

  // Method 2: List all tables we can see
  console.log('\n\n📋 All accessible tables:');
  console.log('─'.repeat(50));
  
  // Check common table names that might be related
  const checkTables = [
    'experts',
    'expert_documents',
    'documents',
    'document_types',
    'sources_google',
    'scripts',
    'prompts',
    'prompt_templates',
    'prompt_outputs',
    'templates',
    'user_profiles',
    'profiles',
    'allowed_emails',
    'command_history'
  ];

  const foundTables: string[] = [];
  
  for (const table of checkTables) {
    try {
      const { error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (!error) {
        foundTables.push(table);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }

  console.log('Found these tables:');
  foundTables.sort().forEach(t => console.log(`  - ${t}`));

  // Method 3: Look for prompt-related tables specifically
  console.log('\n\n🔍 Checking for prompt-related tables:');
  console.log('─'.repeat(50));
  
  const promptRelatedTables = foundTables.filter(t => 
    t.includes('prompt') || 
    t.includes('template') ||
    t.includes('output')
  );
  
  if (promptRelatedTables.length > 0) {
    console.log('Found these prompt-related tables:');
    for (const table of promptRelatedTables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`  - ${table} (${count} rows)`);
    }
  } else {
    console.log('No prompt-related tables found');
  }

  // Method 4: Check for user/profile related tables
  console.log('\n\n👤 Checking for user/profile tables:');
  console.log('─'.repeat(50));
  
  const userRelatedTables = foundTables.filter(t => 
    t.includes('user') || 
    t.includes('profile')
  );
  
  if (userRelatedTables.length > 0) {
    console.log('Found these user-related tables:');
    for (const table of userRelatedTables) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      console.log(`  - ${table} (${count} rows)`);
    }
  } else {
    console.log('No user/profile tables found');
  }

  // Summary
  console.log('\n\n📝 SUMMARY:');
  console.log('─'.repeat(50));
  console.log('Missing tables:');
  for (const table of targetTables) {
    console.log(`  ❌ ${table}`);
  }
  console.log('\nThese tables do not exist in the public schema or are not accessible.');
  console.log('They may have been:');
  console.log('  1. Never created (migration not run)');
  console.log('  2. Created in a different schema');
  console.log('  3. Dropped or renamed');
  console.log('  4. Created with different names');
}

// Run the script
findMissingTables()
  .then(() => {
    console.log('\n✅ Search complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });