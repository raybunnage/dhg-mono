#!/usr/bin/env ts-node

/**
 * Apply RLS policies to tables that need them
 * This is a focused script for applying standard RLS patterns
 */

const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
const supabase = SupabaseClientService.getInstance().getClient();

interface RLSPolicyResult {
  tableName: string;
  rlsEnabled: boolean;
  policies: string[];
  errors: string[];
}

class RLSPolicyApplicator {
  async applyStandardPolicies(): Promise<void> {
    console.log('🔐 Applying standard RLS policies to tables...\n');
    
    // Get all tables without RLS
    const tablesNeedingRLS = await this.getTablesWithoutRLS();
    
    if (tablesNeedingRLS.length === 0) {
      console.log('✅ All tables have RLS enabled!');
      return;
    }
    
    console.log(`Found ${tablesNeedingRLS.length} tables without RLS:\n`);
    
    for (const table of tablesNeedingRLS) {
      await this.applyRLSToTable(table);
    }
    
    console.log('\n✅ RLS policy application complete!');
  }
  
  private async getTablesWithoutRLS(): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_tables_without_rls');
    
    if (error) {
      // Function might not exist, let's create it
      await this.createHelperFunction();
      
      // Try again
      const { data: retryData, error: retryError } = await supabase.rpc('get_tables_without_rls');
      if (retryError) {
        console.error('Error getting tables without RLS:', retryError);
        return [];
      }
      return retryData || [];
    }
    
    return data || [];
  }
  
  private async createHelperFunction(): Promise<void> {
    const createFunction = `
      CREATE OR REPLACE FUNCTION get_tables_without_rls()
      RETURNS TABLE (table_name text) AS $$
      BEGIN
        RETURN QUERY
        SELECT c.relname::text
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity
          AND c.relname NOT LIKE 'pg_%'
          AND c.relname NOT LIKE '_prisma%'
        ORDER BY c.relname;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql: createFunction });
    if (error) console.error('Error creating helper function:', error);
  }
  
  private async applyRLSToTable(tableName: string): Promise<void> {
    console.log(`\n📋 Processing ${tableName}...`);
    
    const result: RLSPolicyResult = {
      tableName,
      rlsEnabled: false,
      policies: [],
      errors: []
    };
    
    try {
      // Step 1: Enable RLS
      const enableRLS = `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`;
      const { error: enableError } = await supabase.rpc('exec_sql', { sql: enableRLS });
      
      if (enableError) {
        result.errors.push(`Failed to enable RLS: ${enableError.message}`);
      } else {
        result.rlsEnabled = true;
        console.log(`  ✅ RLS enabled`);
      }
      
      // Step 2: Check existing policies
      const checkPolicies = `
        SELECT pol.polname 
        FROM pg_policy pol 
        JOIN pg_class c ON c.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = '${tableName}';
      `;
      
      const { data: existingPolicies } = await supabase.rpc('exec_sql_with_result', { 
        sql: checkPolicies 
      });
      
      const hasPublicRead = existingPolicies?.some((p: any) => 
        p.polname?.includes('read') || p.polname?.includes('select')
      );
      
      // Step 3: Apply standard policies if missing
      if (!hasPublicRead) {
        await this.createPublicReadPolicy(tableName, result);
      }
      
      // For system tables, we might want authenticated write
      if (tableName.startsWith('sys_') || tableName.startsWith('command_')) {
        await this.createAuthenticatedWritePolicy(tableName, result);
      }
      
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
    }
    
    // Report results
    if (result.errors.length > 0) {
      console.log(`  ❌ Errors: ${result.errors.join(', ')}`);
    }
    if (result.policies.length > 0) {
      console.log(`  📝 Created policies: ${result.policies.join(', ')}`);
    }
  }
  
  private async createPublicReadPolicy(tableName: string, result: RLSPolicyResult): Promise<void> {
    const policyName = `${tableName}_public_read`;
    const createPolicy = `
      CREATE POLICY "${policyName}" ON ${tableName}
      FOR SELECT USING (true);
    `;
    
    const { error } = await supabase.rpc('exec_sql', { sql: createPolicy });
    
    if (error) {
      if (error.message.includes('already exists')) {
        // Policy already exists, that's fine
      } else {
        result.errors.push(`Public read policy: ${error.message}`);
      }
    } else {
      result.policies.push('public_read');
      console.log(`  ✅ Public read policy created`);
    }
  }
  
  private async createAuthenticatedWritePolicy(tableName: string, result: RLSPolicyResult): Promise<void> {
    const policies = [
      {
        name: `${tableName}_auth_insert`,
        sql: `CREATE POLICY "${tableName}_auth_insert" ON ${tableName} 
              FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);`
      },
      {
        name: `${tableName}_auth_update`,
        sql: `CREATE POLICY "${tableName}_auth_update" ON ${tableName} 
              FOR UPDATE USING (auth.uid() IS NOT NULL);`
      },
      {
        name: `${tableName}_auth_delete`,
        sql: `CREATE POLICY "${tableName}_auth_delete" ON ${tableName} 
              FOR DELETE USING (auth.uid() IS NOT NULL);`
      }
    ];
    
    for (const policy of policies) {
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });
      
      if (error) {
        if (!error.message.includes('already exists')) {
          result.errors.push(`${policy.name}: ${error.message}`);
        }
      } else {
        result.policies.push(policy.name);
      }
    }
    
    if (result.policies.some(p => p.includes('auth_'))) {
      console.log(`  ✅ Authenticated write policies created`);
    }
  }
}

// Also create the exec_sql function if it doesn't exist
async function ensureExecSqlFunction() {
  const createExecSql = `
    CREATE OR REPLACE FUNCTION exec_sql(sql text)
    RETURNS void AS $$
    BEGIN
      EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    CREATE OR REPLACE FUNCTION exec_sql_with_result(sql text)
    RETURNS json AS $$
    DECLARE
      result json;
    BEGIN
      EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || sql || ') t' INTO result;
      RETURN result;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  // Try to create these functions through a migration
  console.log('Note: You may need to create exec_sql functions through a migration for this to work properly.');
}

// Run the applicator
const applicator = new RLSPolicyApplicator();
applicator.applyStandardPolicies().catch(console.error);