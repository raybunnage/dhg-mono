#!/usr/bin/env ts-node

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const fs = require('fs');
const path = require('path');

interface TableDefinition {
  table_schema: string;
  table_name: string;
  description: string;
  purpose: string;
  created_date: string;
  created_by?: string;
  notes?: string;
}

class TableDefinitionsUpdater {
  private supabase = SupabaseClientService.getInstance().getClient();
  private migrationsPath = path.join(__dirname, '../../../supabase/migrations');

  async update() {
    console.log('🔍 Checking sys_table_definitions for missing tables...\n');

    try {
      // Get all current tables in database
      const { data: allTables, error: tablesError } = await this.supabase
        .rpc('get_all_tables_with_metadata');

      if (tablesError) throw tablesError;

      // Get all registered tables in sys_table_definitions
      const { data: registeredTables, error: regError } = await this.supabase
        .from('sys_table_definitions')
        .select('table_name');

      if (regError) throw regError;

      const registeredTableNames = new Set(registeredTables?.map((t: any) => t.table_name) || []);
      
      // Find unregistered tables
      const unregisteredTables = allTables?.filter((t: any) => 
        t.table_schema === 'public' && !registeredTableNames.has(t.table_name)
      ) || [];

      console.log(`Found ${unregisteredTables.length} unregistered tables\n`);

      if (unregisteredTables.length === 0) {
        console.log('✅ All tables are already registered!');
        return;
      }

      // Scan migration files to find creation dates and descriptions
      const tableInfo = await this.scanMigrationsForTableInfo();

      // Prepare new entries
      const newEntries: TableDefinition[] = [];

      for (const table of unregisteredTables) {
        const info = tableInfo.get(table.table_name) || this.inferTableInfo(table.table_name);
        
        newEntries.push({
          table_schema: 'public',
          table_name: table.table_name,
          description: info.description,
          purpose: info.purpose,
          created_date: info.created_date,
          created_by: 'System',
          notes: info.notes
        });

        console.log(`📝 Registering: ${table.table_name}`);
        console.log(`   Description: ${info.description}`);
        console.log(`   Purpose: ${info.purpose}`);
        console.log(`   Created: ${info.created_date}\n`);
      }

      // Insert new entries
      const { error: insertError } = await this.supabase
        .from('sys_table_definitions')
        .insert(newEntries);

      if (insertError) {
        throw insertError;
      }

      console.log(`✅ Successfully registered ${newEntries.length} tables!`);

    } catch (error) {
      console.error('❌ Error updating table definitions:', error);
      process.exit(1);
    }
  }

  private async scanMigrationsForTableInfo(): Promise<Map<string, any>> {
    const tableInfo = new Map<string, any>();
    const files = fs.readdirSync(this.migrationsPath)
      .filter((f: string) => f.endsWith('.sql'))
      .sort(); // Sort to process in chronological order

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.migrationsPath, file), 'utf-8');
      const dateMatch = file.match(/^(\d{8})/);
      const migrationDate = dateMatch ? 
        `${dateMatch[1].slice(0,4)}-${dateMatch[1].slice(4,6)}-${dateMatch[1].slice(6,8)}` : 
        new Date().toISOString().split('T')[0];

      // Extract CREATE TABLE statements
      const createTablePattern = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(/gi;
      let match;

      while ((match = createTablePattern.exec(content)) !== null) {
        const tableName = match[1];
        
        // Try to extract comments or descriptions
        const descPattern = new RegExp(`-- .*${tableName}.*\\n`, 'i');
        const descMatch = content.match(descPattern);
        
        if (!tableInfo.has(tableName)) {
          tableInfo.set(tableName, {
            description: this.extractDescription(tableName, content, descMatch),
            purpose: this.extractPurpose(tableName, content),
            created_date: migrationDate,
            notes: `Created in migration: ${file}`
          });
        }
      }
    }

    // Add specific information for known tables
    this.addKnownTableInfo(tableInfo);

    return tableInfo;
  }

  private extractDescription(tableName: string, content: string, commentMatch: RegExpMatchArray | null): string {
    if (commentMatch) {
      return commentMatch[0].replace(/^--\s*/, '').trim();
    }

    // Look for table-specific patterns
    const patterns = [
      { table: 'worktree_definitions', desc: 'Git worktree definitions and metadata' },
      { table: 'worktree_app_mappings', desc: 'Mapping of applications to worktrees' },
      { table: 'worktree_pipeline_mappings', desc: 'Mapping of CLI pipelines to worktrees' },
      { table: 'clipboard_snippets', desc: 'Reusable code snippets and clipboard history' },
      { table: 'sys_shared_services', desc: 'Registry of shared services in packages/shared/services' },
      { table: 'sys_applications', desc: 'Registry of applications in the monorepo' },
      { table: 'sys_cli_pipelines', desc: 'Registry of CLI pipeline scripts' },
      { table: 'sys_app_service_dependencies', desc: 'Mapping of application to service dependencies' },
      { table: 'sys_pipeline_service_dependencies', desc: 'Mapping of CLI pipeline to service dependencies' },
      { table: 'sys_service_dependencies', desc: 'Service-to-service dependency mapping' }
    ];

    const pattern = patterns.find(p => p.table === tableName);
    if (pattern) return pattern.desc;

    // Default based on prefix
    return this.getDefaultDescription(tableName);
  }

  private extractPurpose(tableName: string, content: string): string {
    const purposes: Record<string, string> = {
      'worktree_definitions': 'Manage git worktrees and their configurations',
      'worktree_app_mappings': 'Track which apps belong to which worktrees',
      'worktree_pipeline_mappings': 'Track which CLI pipelines belong to which worktrees',
      'clipboard_snippets': 'Store and manage reusable code snippets',
      'sys_shared_services': 'Track and manage shared service definitions',
      'sys_applications': 'Track applications and their configurations',
      'sys_cli_pipelines': 'Track CLI pipelines and their commands',
      'sys_app_service_dependencies': 'Track which services each app depends on',
      'sys_pipeline_service_dependencies': 'Track which services each pipeline uses',
      'sys_service_dependencies': 'Track internal dependencies between services'
    };

    return purposes[tableName] || this.getDefaultPurpose(tableName);
  }

  private getDefaultDescription(tableName: string): string {
    const prefix = tableName.split('_')[0] + '_';
    const prefixDescriptions: Record<string, string> = {
      'ai_': 'AI and prompt management table',
      'auth_': 'Authentication and authorization table',
      'batch_': 'Batch processing table',
      'clipboard_': 'Clipboard management table',
      'command_': 'Command tracking and analytics table',
      'dev_': 'Development workflow table',
      'doc_': 'Document management table',
      'email_': 'Email system table',
      'expert_': 'Expert system table',
      'filter_': 'User filtering table',
      'google_': 'Google Drive integration table',
      'learn_': 'Learning platform table',
      'media_': 'Media management table',
      'scripts_': 'Script management table',
      'sys_': 'System infrastructure table',
      'worktree_': 'Git worktree management table'
    };

    return prefixDescriptions[prefix] || `${tableName} table`;
  }

  private getDefaultPurpose(tableName: string): string {
    const prefix = tableName.split('_')[0] + '_';
    const prefixPurposes: Record<string, string> = {
      'ai_': 'Manage AI-related functionality',
      'auth_': 'Handle authentication and user access',
      'batch_': 'Process data in batches',
      'clipboard_': 'Manage clipboard and snippet functionality',
      'command_': 'Track command usage and performance',
      'dev_': 'Support development workflows',
      'doc_': 'Manage documents and content',
      'email_': 'Handle email operations',
      'expert_': 'Manage expert information',
      'filter_': 'Handle user preferences and filtering',
      'google_': 'Integrate with Google services',
      'learn_': 'Support learning features',
      'media_': 'Handle media files and content',
      'scripts_': 'Manage system scripts',
      'sys_': 'Support system operations',
      'worktree_': 'Manage git worktrees'
    };

    return prefixPurposes[prefix] || `Manage ${tableName} data`;
  }

  private inferTableInfo(tableName: string): any {
    return {
      description: this.getDefaultDescription(tableName),
      purpose: this.getDefaultPurpose(tableName),
      created_date: new Date().toISOString().split('T')[0],
      notes: 'Auto-detected by table definitions updater'
    };
  }

  private addKnownTableInfo(tableInfo: Map<string, any>) {
    // Add any specific information for tables we know about
    const knownTables = [
      {
        name: 'sys_service_dependency_summary',
        description: 'View summarizing service dependencies and usage counts',
        purpose: 'Provide quick overview of service usage patterns',
        created_date: '2025-06-06'
      },
      {
        name: 'sys_app_dependencies_view',
        description: 'View showing application service dependencies',
        purpose: 'Easy querying of which services each app uses',
        created_date: '2025-06-06'
      },
      {
        name: 'sys_pipeline_dependencies_view',
        description: 'View showing pipeline service dependencies',
        purpose: 'Easy querying of which services each pipeline uses',
        created_date: '2025-06-06'
      }
    ];

    for (const table of knownTables) {
      if (!tableInfo.has(table.name)) {
        tableInfo.set(table.name, {
          description: table.description,
          purpose: table.purpose,
          created_date: table.created_date,
          notes: 'System view'
        });
      }
    }
  }
}

// Run the updater
const updater = new TableDefinitionsUpdater();
updater.update();