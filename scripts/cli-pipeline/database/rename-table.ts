#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface RenameTableOptions {
  oldName: string;
  newName: string;
  createView?: boolean;
  notes?: string;
  dryRun?: boolean;
}

interface DependencyInfo {
  foreign_keys: any[];
  indexes: any[];
  triggers: any[];
  functions: any[];
  policies: any[];
  views: any[];
}

class TableRenameUtility {
  private supabase: any;

  constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  async renameTable(options: RenameTableOptions): Promise<void> {
    const { oldName, newName, createView = true, notes, dryRun = false } = options;

    console.log(`🔄 Renaming table: ${oldName} → ${newName}`);
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No changes will be made\n');
    }

    try {
      // 1. Pre-flight checks
      await this.performPreflightChecks(oldName, newName);

      // 2. Analyze dependencies
      const dependencies = await this.analyzeDependencies(oldName);
      console.log('\n📊 Dependencies found:');
      console.log(`   Foreign Keys: ${dependencies.foreign_keys.length}`);
      console.log(`   Indexes: ${dependencies.indexes.length}`);
      console.log(`   Triggers: ${dependencies.triggers.length}`);
      console.log(`   Functions: ${dependencies.functions.length}`);
      console.log(`   RLS Policies: ${dependencies.policies.length}`);
      console.log(`   Views: ${dependencies.views.length}`);

      if (dryRun) {
        console.log('\n✅ Dry run complete. The following SQL would be executed:\n');
        this.generateMigrationSQL(oldName, newName, createView, dependencies);
        return;
      }

      // 3. Execute migration
      await this.executeMigration(oldName, newName, createView, dependencies, notes);

      // 4. Post-migration validation
      await this.validateMigration(oldName, newName, createView);

      console.log('\n✅ Table renamed successfully!');
      console.log(`   Old: ${oldName}`);
      console.log(`   New: ${newName}`);
      if (createView) {
        console.log(`   Compatibility view created: ${oldName} → ${newName}`);
      }

    } catch (error) {
      console.error('\n❌ Error during table rename:', error);
      throw error;
    }
  }

  private async performPreflightChecks(oldName: string, newName: string): Promise<void> {
    console.log('\n🔍 Performing pre-flight checks...');

    // Check if old table exists
    const { data: oldTableExists, error: oldTableError } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${oldName}'
      )`
    });

    if (oldTableError || !oldTableExists[0]?.exists) {
      throw new Error(`Table '${oldName}' does not exist`);
    }
    console.log(`   ✓ Source table '${oldName}' exists`);

    // Check if new table name already exists
    const { data: newTableExists, error: newTableError } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${newName}'
      )`
    });

    if (newTableError || newTableExists[0]?.exists) {
      throw new Error(`Table '${newName}' already exists`);
    }
    console.log(`   ✓ Target table name '${newName}' is available`);

    // Check if already migrated
    const { data: migrationExists, error: migrationError } = await this.supabase
      .from('sys_table_migrations')
      .select('id, status')
      .eq('old_name', oldName)
      .eq('status', 'active')
      .single();

    if (migrationExists) {
      throw new Error(`Table '${oldName}' has already been migrated (status: active)`);
    }
    console.log(`   ✓ No active migration found for '${oldName}'`);
  }

  private async analyzeDependencies(tableName: string): Promise<DependencyInfo> {
    console.log('\n🔎 Analyzing table dependencies...');

    const dependencies: DependencyInfo = {
      foreign_keys: [],
      indexes: [],
      triggers: [],
      functions: [],
      policies: [],
      views: []
    };

    // Get foreign keys
    const { data: fks } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          conname as constraint_name,
          conrelid::regclass as table_name,
          confrelid::regclass as referenced_table
        FROM pg_constraint
        WHERE confrelid = '${tableName}'::regclass::oid
          AND contype = 'f'
      `
    });
    dependencies.foreign_keys = fks || [];

    // Get indexes
    const { data: indexes } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes
        WHERE tablename = '${tableName}'
          AND schemaname = 'public'
      `
    });
    dependencies.indexes = indexes || [];

    // Get RLS policies
    const { data: policies } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        SELECT 
          pol.polname as policy_name,
          CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            ELSE 'ALL'
          END as command,
          pg_get_expr(pol.polqual, pol.polrelid) as using_expression,
          pg_get_expr(pol.polwithcheck, pol.polrelid) as check_expression
        FROM pg_policy pol
        JOIN pg_class pc ON pol.polrelid = pc.oid
        WHERE pc.relname = '${tableName}'
          AND pc.relnamespace = 'public'::regnamespace
      `
    });
    dependencies.policies = policies || [];

    // Get views depending on this table
    const { data: views } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        SELECT DISTINCT 
          dependent_view.relname as view_name
        FROM pg_depend 
        JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid 
        JOIN pg_class as dependent_view ON pg_rewrite.ev_class = dependent_view.oid 
        JOIN pg_class as source_table ON pg_depend.refobjid = source_table.oid 
        WHERE source_table.relname = '${tableName}'
          AND source_table.relnamespace = 'public'::regnamespace
          AND dependent_view.relkind = 'v'
      `
    });
    dependencies.views = views || [];

    return dependencies;
  }

  private generateMigrationSQL(
    oldName: string, 
    newName: string, 
    createView: boolean,
    dependencies: DependencyInfo
  ): string {
    const sqlStatements: string[] = [];

    // Start transaction
    sqlStatements.push('BEGIN;');

    // Rename table
    sqlStatements.push(`ALTER TABLE ${oldName} RENAME TO ${newName};`);

    // Create compatibility view
    if (createView) {
      sqlStatements.push(`
-- Create compatibility view
CREATE VIEW ${oldName} AS SELECT * FROM ${newName};

-- Grant same permissions as original table
GRANT SELECT, INSERT, UPDATE, DELETE ON ${oldName} TO authenticated;
GRANT ALL ON ${oldName} TO service_role;
      `);
    }

    // Update sequences if any
    sqlStatements.push(`
-- Update sequences
DO $$
DECLARE
  seq RECORD;
BEGIN
  FOR seq IN 
    SELECT 
      sequence_name,
      REPLACE(sequence_name, '${oldName}', '${newName}') as new_sequence_name
    FROM information_schema.sequences 
    WHERE sequence_name LIKE '${oldName}%'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I RENAME TO %I', seq.sequence_name, seq.new_sequence_name);
  END LOOP;
END $$;
    `);

    // Commit transaction
    sqlStatements.push('COMMIT;');

    const sql = sqlStatements.join('\n\n');
    console.log(sql);
    return sql;
  }

  private async executeMigration(
    oldName: string,
    newName: string,
    createView: boolean,
    dependencies: DependencyInfo,
    notes?: string
  ): Promise<void> {
    console.log('\n🚀 Executing migration...');

    // Record migration start
    const { data: migration, error: recordError } = await this.supabase
      .from('sys_table_migrations')
      .insert({
        old_name: oldName,
        new_name: newName,
        status: 'pending',
        compatibility_view_created: createView,
        dependencies,
        notes
      })
      .select()
      .single();

    if (recordError) {
      throw new Error(`Failed to record migration: ${recordError.message}`);
    }

    try {
      // Execute the rename
      const { error: renameError } = await this.supabase.rpc('execute_sql', {
        sql_query: `ALTER TABLE ${oldName} RENAME TO ${newName}`
      });

      if (renameError) {
        throw new Error(`Failed to rename table: ${renameError.message}`);
      }
      console.log(`   ✓ Table renamed: ${oldName} → ${newName}`);

      // Create compatibility view if requested
      if (createView) {
        const { error: viewError } = await this.supabase.rpc('execute_sql', {
          sql_query: `
            CREATE VIEW ${oldName} AS SELECT * FROM ${newName};
            GRANT SELECT, INSERT, UPDATE, DELETE ON ${oldName} TO authenticated;
            GRANT ALL ON ${oldName} TO service_role;
          `
        });

        if (viewError) {
          throw new Error(`Failed to create compatibility view: ${viewError.message}`);
        }
        console.log(`   ✓ Compatibility view created: ${oldName}`);
      }

      // Update migration status to active
      const { error: updateError } = await this.supabase
        .from('sys_table_migrations')
        .update({ status: 'active' })
        .eq('id', migration.id);

      if (updateError) {
        console.warn('Warning: Failed to update migration status');
      }

    } catch (error) {
      // Attempt to rollback on error
      console.error('Migration failed, attempting rollback...');
      
      await this.supabase
        .from('sys_table_migrations')
        .update({ 
          status: 'rolled_back',
          rollback_at: new Date().toISOString(),
          notes: `Rollback due to error: ${error}`
        })
        .eq('id', migration.id);

      throw error;
    }
  }

  private async validateMigration(oldName: string, newName: string, createView: boolean): Promise<void> {
    console.log('\n🔍 Validating migration...');

    // Check new table exists
    const { data: newTableCheck } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${newName}'
      )`
    });

    if (!newTableCheck[0]?.exists) {
      throw new Error('Validation failed: New table not found');
    }
    console.log(`   ✓ New table '${newName}' exists`);

    // Check compatibility view if created
    if (createView) {
      const { data: viewCheck } = await this.supabase.rpc('execute_sql', {
        sql_query: `SELECT EXISTS (
          SELECT 1 FROM information_schema.views 
          WHERE table_schema = 'public' AND table_name = '${oldName}'
        )`
      });

      if (!viewCheck[0]?.exists) {
        throw new Error('Validation failed: Compatibility view not found');
      }
      console.log(`   ✓ Compatibility view '${oldName}' exists`);

      // Test view functionality
      const { error: viewTestError } = await this.supabase.rpc('execute_sql', {
        sql_query: `SELECT COUNT(*) FROM ${oldName} LIMIT 1`
      });

      if (viewTestError) {
        throw new Error(`Validation failed: View is not functional - ${viewTestError.message}`);
      }
      console.log(`   ✓ Compatibility view is functional`);
    }

    console.log('   ✓ All validations passed');
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: ts-node rename-table.ts <old-name> <new-name> [options]');
    console.log('Options:');
    console.log('  --no-view     Skip creating compatibility view');
    console.log('  --dry-run     Show what would be done without making changes');
    console.log('  --notes       Add notes to migration record');
    process.exit(1);
  }

  const [oldName, newName] = args;
  const options: RenameTableOptions = {
    oldName,
    newName,
    createView: !args.includes('--no-view'),
    dryRun: args.includes('--dry-run'),
    notes: args.find(arg => arg.startsWith('--notes='))?.split('=')[1]
  };

  const utility = new TableRenameUtility();
  utility.renameTable(options)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed:', error.message);
      process.exit(1);
    });
}

export { TableRenameUtility, RenameTableOptions };