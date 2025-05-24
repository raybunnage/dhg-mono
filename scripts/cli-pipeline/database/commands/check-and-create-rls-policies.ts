#!/usr/bin/env ts-node
/**
 * Check and Create RLS Policies Command
 * 
 * This command checks all non-backup tables for RLS policies and creates
 * permissive CRUD policies for tables that don't have them.
 * 
 * Features:
 * - Lists all tables and their RLS status
 * - Identifies tables without policies
 * - Creates permissive CRUD policies (SELECT, INSERT, UPDATE, DELETE)
 * - Skips backup tables and system tables
 * - Provides dry-run option to preview changes
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';

interface TableInfo {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  policies: PolicyInfo[];
}

interface PolicyInfo {
  policyname: string;
  cmd: string;
  permissive: string;
  roles: string[];
}

class RLSPolicyManager {
  private supabase;

  constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  /**
   * Check if an object is a view
   */
  async isView(objectName: string): Promise<boolean> {
    const query = `SELECT table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = '${objectName}'`;

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      sql_query: query
    });

    if (error) {
      console.error(`Error checking if ${objectName} is a view:`, error);
      return false;
    }

    const result = Array.isArray(data) ? data[0] : null;
    return result?.table_type === 'VIEW';
  }

  /**
   * Get all tables excluding system and backup tables
   */
  async getAllTables(): Promise<string[]> {
    const query = `SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '%_backup%'
        AND table_name NOT LIKE 'pg_%'
        AND table_name NOT IN ('schema_migrations', 'supabase_migrations')
      ORDER BY table_name`;

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      sql_query: query
    });

    if (error) {
      throw new Error(`Failed to get tables: ${error.message}`);
    }

    // The execute_sql function returns JSONB, which might need to be parsed
    const tables = Array.isArray(data) ? data : [];
    return tables.map((row: any) => row.table_name);
  }

  /**
   * Check if RLS is enabled for a table
   */
  async checkRLSEnabled(tableName: string): Promise<boolean> {
    const query = `SELECT relrowsecurity 
      FROM pg_class 
      WHERE relname = '${tableName}' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`;

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      sql_query: query
    });

    if (error) {
      console.error(`Error checking RLS for ${tableName}:`, error);
      return false;
    }

    const result = Array.isArray(data) ? data[0] : null;
    return result?.relrowsecurity || false;
  }

  /**
   * Get existing policies for a table
   */
  async getTablePolicies(tableName: string): Promise<PolicyInfo[]> {
    const query = `SELECT 
        pol.polname as policyname,
        CASE pol.polcmd
          WHEN 'r' THEN 'SELECT'
          WHEN 'a' THEN 'INSERT'
          WHEN 'w' THEN 'UPDATE'
          WHEN 'd' THEN 'DELETE'
          ELSE 'ALL'
        END as cmd,
        CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as permissive,
        ARRAY(
          SELECT rolname 
          FROM pg_roles 
          WHERE oid = ANY(pol.polroles)
        ) as roles
      FROM pg_policy pol
      JOIN pg_class c ON pol.polrelid = c.oid
      WHERE c.relname = '${tableName}'
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`;

    const { data, error } = await this.supabase.rpc('execute_sql', { 
      sql_query: query
    });

    if (error) {
      console.error(`Error getting policies for ${tableName}:`, error);
      return [];
    }

    return Array.isArray(data) ? data : [];
  }

  /**
   * Get comprehensive table information including RLS and policies
   */
  async getTableInfo(tableName: string): Promise<TableInfo> {
    const rlsEnabled = await this.checkRLSEnabled(tableName);
    const policies = await this.getTablePolicies(tableName);

    return {
      table_name: tableName,
      rls_enabled: rlsEnabled,
      policy_count: policies.length,
      policies
    };
  }

  /**
   * Enable RLS on a table
   */
  async enableRLS(tableName: string): Promise<void> {
    const query = `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY`;
    
    const { error } = await this.supabase.rpc('execute_sql', { 
      sql_query: query
    });

    if (error) {
      throw new Error(`Failed to enable RLS on ${tableName}: ${error.message}`);
    }
  }

  /**
   * Create permissive CRUD policies for a table
   */
  async createPermissivePolicies(tableName: string): Promise<void> {
    const policies = [
      {
        name: `${tableName}_select_policy`,
        operation: 'SELECT',
        sql: `CREATE POLICY "${tableName}_select_policy" ON public.${tableName}
          FOR SELECT TO authenticated, anon
          USING (true)`
      },
      {
        name: `${tableName}_insert_policy`,
        operation: 'INSERT',
        sql: `CREATE POLICY "${tableName}_insert_policy" ON public.${tableName}
          FOR INSERT TO authenticated
          WITH CHECK (true)`
      },
      {
        name: `${tableName}_update_policy`,
        operation: 'UPDATE',
        sql: `CREATE POLICY "${tableName}_update_policy" ON public.${tableName}
          FOR UPDATE TO authenticated
          USING (true)
          WITH CHECK (true)`
      },
      {
        name: `${tableName}_delete_policy`,
        operation: 'DELETE',
        sql: `CREATE POLICY "${tableName}_delete_policy" ON public.${tableName}
          FOR DELETE TO authenticated
          USING (true)`
      }
    ];

    for (const policy of policies) {
      try {
        const { error } = await this.supabase.rpc('execute_sql', { 
          sql_query: policy.sql
        });

        if (error) {
          console.error(`Failed to create ${policy.operation} policy for ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ Created ${policy.operation} policy for ${tableName}`);
        }
      } catch (err) {
        console.error(`Error creating ${policy.operation} policy for ${tableName}:`, err);
      }
    }
  }

  /**
   * Generate SQL for creating policies (for dry run)
   */
  generatePolicySQL(tableName: string): string[] {
    return [
      `-- Enable RLS for ${tableName}`,
      `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`,
      '',
      `-- Create permissive SELECT policy`,
      `CREATE POLICY "${tableName}_select_policy" ON public.${tableName}`,
      `FOR SELECT TO authenticated, anon`,
      `USING (true);`,
      '',
      `-- Create permissive INSERT policy`,
      `CREATE POLICY "${tableName}_insert_policy" ON public.${tableName}`,
      `FOR INSERT TO authenticated`,
      `WITH CHECK (true);`,
      '',
      `-- Create permissive UPDATE policy`,
      `CREATE POLICY "${tableName}_update_policy" ON public.${tableName}`,
      `FOR UPDATE TO authenticated`,
      `USING (true)`,
      `WITH CHECK (true);`,
      '',
      `-- Create permissive DELETE policy`,
      `CREATE POLICY "${tableName}_delete_policy" ON public.${tableName}`,
      `FOR DELETE TO authenticated`,
      `USING (true);`,
      ''
    ];
  }
}

/**
 * Main execution function
 */
async function main(options: { dryRun: boolean; table?: string }) {
  console.log('🔒 RLS Policy Checker and Creator');
  console.log('================================\n');

  const manager = new RLSPolicyManager();

  try {
    // Get tables to check
    let tables: string[];
    if (options.table) {
      // Check if the specified object is a view
      const isView = await manager.isView(options.table);
      if (isView) {
        console.log(`❌ Error: ${options.table} is a VIEW, not a TABLE.`);
        console.log('\nRow Level Security (RLS) can only be applied to tables, not views.');
        console.log('Views inherit the security policies from their underlying tables.');
        
        // Try to find the base table
        if (options.table === 'pending_access_requests') {
          console.log('\n💡 Tip: The pending_access_requests view is based on the access_requests table.');
          console.log('Try running: check-rls-policies --table access_requests');
        }
        
        process.exit(1);
      }
      
      tables = [options.table];
      console.log(`Checking single table: ${options.table}\n`);
    } else {
      console.log('Fetching all non-backup tables...');
      tables = await manager.getAllTables();
      console.log(`Found ${tables.length} tables to check\n`);
    }

    // Check each table
    const tablesNeedingPolicies: TableInfo[] = [];
    
    for (const tableName of tables) {
      const tableInfo = await manager.getTableInfo(tableName);
      
      console.log(`📊 ${tableName}:`);
      console.log(`   RLS Enabled: ${tableInfo.rls_enabled ? '✅' : '❌'}`);
      console.log(`   Policies: ${tableInfo.policy_count}`);
      
      if (tableInfo.policies.length > 0) {
        tableInfo.policies.forEach(policy => {
          console.log(`     - ${policy.policyname} (${policy.cmd}, ${policy.permissive})`);
        });
      }
      
      // Check if table needs policies
      if (!tableInfo.rls_enabled || tableInfo.policy_count === 0) {
        tablesNeedingPolicies.push(tableInfo);
      }
      
      console.log('');
    }

    // Report findings
    if (tablesNeedingPolicies.length === 0) {
      console.log('✅ All tables have RLS enabled with policies!');
      return;
    }

    console.log('\n⚠️  Tables needing RLS policies:');
    console.log('================================');
    tablesNeedingPolicies.forEach(table => {
      console.log(`- ${table.table_name} (RLS: ${table.rls_enabled ? 'Enabled' : 'Disabled'}, Policies: ${table.policy_count})`);
    });

    if (options.dryRun) {
      console.log('\n📝 DRY RUN - SQL that would be executed:');
      console.log('========================================\n');
      
      for (const table of tablesNeedingPolicies) {
        const sql = manager.generatePolicySQL(table.table_name);
        console.log(sql.join('\n'));
      }
      
      console.log('\n💡 To apply these changes, run without --dry-run flag');
    } else {
      console.log('\n🚀 Creating RLS policies...');
      console.log('=========================\n');
      
      for (const table of tablesNeedingPolicies) {
        console.log(`\n📋 Processing ${table.table_name}...`);
        
        // Enable RLS if needed
        if (!table.rls_enabled) {
          console.log(`   Enabling RLS...`);
          await manager.enableRLS(table.table_name);
          console.log(`   ✅ RLS enabled`);
        }
        
        // Create policies
        console.log(`   Creating permissive CRUD policies...`);
        await manager.createPermissivePolicies(table.table_name);
      }
      
      console.log('\n✅ RLS policy creation complete!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// CLI setup
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tableIndex = args.indexOf('--table');
  const table = tableIndex !== -1 ? args[tableIndex + 1] : undefined;
  const startTime = new Date();

  // Show help if requested
  if (args.includes('--help')) {
    console.log(`
RLS Policy Checker and Creator

Usage: check-and-create-rls-policies [options]

Options:
  --dry-run       Preview what policies would be created without making changes
  --table <name>  Check and create policies for a specific table only
  --help          Show this help message

Examples:
  # Check all tables and show what would be done
  check-and-create-rls-policies --dry-run
  
  # Create policies for all tables that need them
  check-and-create-rls-policies
  
  # Check and create policies for a specific table
  check-and-create-rls-policies --table allowed_emails

This command will:
1. Find all non-backup tables in the public schema
2. Check if RLS is enabled and what policies exist
3. Create permissive CRUD policies for tables without them
4. Skip system tables and backup tables
    `);
    process.exit(0);
  }

  main({ dryRun, table })
    .then(async () => {
      // Track successful command execution
      await commandTrackingService.trackCommand({
        pipelineName: 'database',
        commandName: 'check-and-create-rls-policies',
        startTime,
        status: 'success',
        affectedEntity: table || 'all tables',
        summary: dryRun ? 'Dry run completed' : 'RLS policies checked/created'
      });
    })
    .catch(async (error) => {
      console.error('Error:', error);
      // Track failed command execution
      await commandTrackingService.trackCommand({
        pipelineName: 'database',
        commandName: 'check-and-create-rls-policies',
        startTime,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      process.exit(1);
    });
}