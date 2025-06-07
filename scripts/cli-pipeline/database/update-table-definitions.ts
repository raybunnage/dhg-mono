#!/usr/bin/env ts-node
/**
 * Update sys_table_definitions for tables that are missing entries
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface TableDefinition {
  table_schema: string;
  table_name: string;
  description: string;
  purpose: string;
  created_date: string;
}

// Define the tables that need definitions
const tableDefinitions: TableDefinition[] = [
  // Worktree tables
  {
    table_schema: 'public',
    table_name: 'worktree_definitions',
    description: 'Git worktree definitions for managing multiple development branches',
    purpose: 'Store worktree configurations for development workflow management',
    created_date: '2025-01-06'
  },
  {
    table_schema: 'public',
    table_name: 'worktree_app_mappings',
    description: 'Maps applications to their assigned git worktrees',
    purpose: 'Track which apps are developed in which worktrees for proper isolation',
    created_date: '2025-01-06'
  },
  
  // Registry tables
  {
    table_schema: 'public',
    table_name: 'registry_scripts',
    description: 'Registry of all scripts in the codebase',
    purpose: 'Catalog and track script files for analysis and management',
    created_date: '2025-06-06'
  },
  {
    table_schema: 'public',
    table_name: 'registry_services',
    description: 'Registry of shared services across the monorepo',
    purpose: 'Track service modules and their exports for dependency analysis',
    created_date: '2025-06-06'
  },
  {
    table_schema: 'public',
    table_name: 'registry_apps',
    description: 'Registry of applications in the monorepo',
    purpose: 'Catalog all apps for service dependency tracking',
    created_date: '2025-06-06'
  },
  {
    table_schema: 'public',
    table_name: 'registry_cli_pipelines',
    description: 'Registry of CLI pipeline scripts',
    purpose: 'Track CLI commands and pipelines for command management',
    created_date: '2025-06-06'
  },
  
  // Service dependency tables
  {
    table_schema: 'public',
    table_name: 'service_dependencies',
    description: 'Service dependency relationships',
    purpose: 'Track which apps and scripts depend on which services',
    created_date: '2025-06-06'
  },
  {
    table_schema: 'public',
    table_name: 'service_dependency_analysis_runs',
    description: 'History of dependency analysis runs',
    purpose: 'Track when dependency scans were performed',
    created_date: '2025-06-06'
  },
  {
    table_schema: 'public',
    table_name: 'service_exports',
    description: 'Exported functions and classes from services',
    purpose: 'Track what each service exports for dependency analysis',
    created_date: '2025-06-06'
  },
  {
    table_schema: 'public',
    table_name: 'service_command_dependencies',
    description: 'Maps CLI commands to their service dependencies',
    purpose: 'Track which services are used by which CLI commands',
    created_date: '2025-06-06'
  },
  
  // Import tables (from SQLite migration)
  {
    table_schema: 'public',
    table_name: 'import_emails',
    description: 'Imported email data from SQLite database',
    purpose: 'Store emails migrated from legacy SQLite system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_attachments',
    description: 'Imported email attachments from SQLite database',
    purpose: 'Store email attachment metadata from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_email_contents',
    description: 'Imported email content bodies from SQLite database',
    purpose: 'Store full email content from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_email_concepts',
    description: 'Imported email concept mappings from SQLite database',
    purpose: 'Store email-to-concept relationships from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_urls',
    description: 'Imported URLs extracted from emails in SQLite database',
    purpose: 'Store URLs found in emails from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_all_email_urls',
    description: 'Imported comprehensive email-URL mappings from SQLite',
    purpose: 'Store all email-to-URL relationships from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_web_concepts',
    description: 'Imported web concept definitions from SQLite database',
    purpose: 'Store concept taxonomy from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_experts',
    description: 'Imported expert profiles from SQLite database',
    purpose: 'Store expert information from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_expert_profile_aliases',
    description: 'Imported expert name aliases from SQLite database',
    purpose: 'Store alternative names for experts from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_all_authors',
    description: 'Imported author information from SQLite database',
    purpose: 'Store all document/email authors from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_important_email_addresses',
    description: 'Imported list of important email addresses from SQLite',
    purpose: 'Store prioritized email contacts from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_rolled_up_emails',
    description: 'Imported aggregated email threads from SQLite database',
    purpose: 'Store email thread summaries from legacy system',
    created_date: '2024-06-04'
  },
  {
    table_schema: 'public',
    table_name: 'import_hncs_file_names',
    description: 'Imported HNCS-related filenames from SQLite database',
    purpose: 'Store healthcare network computer science file references',
    created_date: '2024-06-04'
  }
];

async function updateTableDefinitions() {
  console.log('🔍 Checking existing table definitions...\n');
  
  // First, check which tables already have definitions
  const { data: existingDefs, error: checkError } = await supabase
    .from('sys_table_definitions')
    .select('table_name')
    .in('table_name', tableDefinitions.map(t => t.table_name));
    
  if (checkError) {
    console.error('❌ Error checking existing definitions:', checkError);
    return;
  }
  
  const existingTableNames = new Set(existingDefs?.map(d => d.table_name) || []);
  
  // Filter out tables that already have definitions
  const tablesToAdd = tableDefinitions.filter(t => !existingTableNames.has(t.table_name));
  
  if (tablesToAdd.length === 0) {
    console.log('✅ All specified tables already have definitions!');
    return;
  }
  
  console.log(`📝 Adding definitions for ${tablesToAdd.length} tables:\n`);
  tablesToAdd.forEach(t => console.log(`   - ${t.table_name}`));
  console.log('');
  
  // Insert missing definitions
  const { data, error } = await supabase
    .from('sys_table_definitions')
    .insert(tablesToAdd)
    .select();
    
  if (error) {
    console.error('❌ Error inserting definitions:', error);
    return;
  }
  
  console.log(`✅ Successfully added ${data?.length || 0} table definitions!\n`);
  
  // Show summary
  console.log('📊 Summary by prefix:');
  const prefixCounts: Record<string, number> = {};
  tablesToAdd.forEach(t => {
    const prefix = t.table_name.split('_')[0];
    prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
  });
  
  Object.entries(prefixCounts).forEach(([prefix, count]) => {
    console.log(`   ${prefix}_*: ${count} tables`);
  });
  
  // Check if sys_table_definitions table exists and has the right structure
  console.log('\n🔍 Verifying sys_table_definitions structure...');
  const { data: tableInfo, error: infoError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'sys_table_definitions'
      ORDER BY ordinal_position;
    `
  });
  
  if (infoError) {
    console.log('⚠️  Could not verify table structure (execute_sql may not be available)');
  } else {
    console.log('✅ sys_table_definitions columns:', tableInfo);
  }
}

// Run the update
updateTableDefinitions().catch(console.error);