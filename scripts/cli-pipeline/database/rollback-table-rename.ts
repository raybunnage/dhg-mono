#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface RollbackOptions {
  tableName: string;  // Current name (after rename)
  migrationId?: string;  // Optional specific migration ID
  force?: boolean;  // Skip confirmation
  dryRun?: boolean;  // Show what would be done
}

class TableRenameRollback {
  private supabase: any;

  constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  async rollbackRename(options: RollbackOptions): Promise<void> {
    const { tableName, migrationId, force = false, dryRun = false } = options;

    console.log(`🔄 Rolling back table rename for: ${tableName}`);
    if (dryRun) {
      console.log('🧪 DRY RUN MODE - No changes will be made\n');
    }

    try {
      // 1. Find the migration record
      const migration = await this.findMigration(tableName, migrationId);
      if (!migration) {
        throw new Error(`No active migration found for table '${tableName}'`);
      }

      console.log('\n📋 Migration details:');
      console.log(`   ID: ${migration.id}`);
      console.log(`   Original name: ${migration.old_name}`);
      console.log(`   Current name: ${migration.new_name}`);
      console.log(`   Migrated at: ${new Date(migration.migrated_at).toLocaleString()}`);
      console.log(`   Migrated by: ${migration.migrated_by}`);
      console.log(`   Compatibility view: ${migration.compatibility_view_created ? 'Yes' : 'No'}`);

      // 2. Confirm rollback (unless forced)
      if (!force && !dryRun) {
        const confirmation = await this.confirmRollback(migration);
        if (!confirmation) {
          console.log('\n❌ Rollback cancelled by user');
          return;
        }
      }

      // 3. Perform pre-rollback checks
      await this.performPreRollbackChecks(migration);

      if (dryRun) {
        console.log('\n✅ Dry run complete. The following actions would be performed:');
        this.showRollbackPlan(migration);
        return;
      }

      // 4. Execute rollback
      await this.executeRollback(migration);

      // 5. Validate rollback
      await this.validateRollback(migration);

      console.log('\n✅ Rollback completed successfully!');
      console.log(`   Table restored: ${migration.new_name} → ${migration.old_name}`);

    } catch (error) {
      console.error('\n❌ Error during rollback:', error);
      throw error;
    }
  }

  private async findMigration(tableName: string, migrationId?: string): Promise<any> {
    console.log('\n🔍 Finding migration record...');

    let query = this.supabase
      .from('sys_table_migrations')
      .select('*')
      .eq('status', 'active');

    if (migrationId) {
      query = query.eq('id', migrationId);
    } else {
      // Look for migration by current table name
      query = query.eq('new_name', tableName);
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Failed to find migration:', error);
      return null;
    }

    return data;
  }

  private async confirmRollback(migration: any): Promise<boolean> {
    console.log('\n⚠️  WARNING: This will rollback the table rename operation.');
    console.log('This action will:');
    console.log(`  1. Remove compatibility view '${migration.old_name}' (if it exists)`);
    console.log(`  2. Rename table '${migration.new_name}' back to '${migration.old_name}'`);
    console.log(`  3. Update migration tracking to mark as rolled back`);
    
    // In a real implementation, you'd use a proper CLI prompt library
    console.log('\nType "yes" to confirm rollback (or press Ctrl+C to cancel): ');
    
    return new Promise((resolve) => {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      readline.question('', (answer: string) => {
        readline.close();
        resolve(answer.toLowerCase() === 'yes');
      });
    });
  }

  private async performPreRollbackChecks(migration: any): Promise<void> {
    console.log('\n🔍 Performing pre-rollback checks...');

    // Check if current table exists
    const { data: currentTableExists } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${migration.new_name}'
      )`
    });

    if (!currentTableExists[0]?.exists) {
      throw new Error(`Current table '${migration.new_name}' does not exist`);
    }
    console.log(`   ✓ Current table '${migration.new_name}' exists`);

    // Check if old name is available
    const { data: oldNameAvailable } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${migration.old_name}'
      )`
    });

    // If old name exists, check if it's a view (our compatibility view)
    if (oldNameAvailable[0]?.exists) {
      const { data: isView } = await this.supabase.rpc('execute_sql', {
        sql_query: `SELECT EXISTS (
          SELECT 1 FROM information_schema.views 
          WHERE table_schema = 'public' AND table_name = '${migration.old_name}'
        )`
      });

      if (!isView[0]?.exists) {
        throw new Error(`Object '${migration.old_name}' exists but is not a view - cannot proceed`);
      }
      console.log(`   ✓ Compatibility view '${migration.old_name}' found`);
    } else {
      console.log(`   ✓ Original table name '${migration.old_name}' is available`);
    }

    // Check for any new dependencies since migration
    const { data: newDependencies } = await this.supabase.rpc('execute_sql', {
      sql_query: `
        SELECT COUNT(*) as count
        FROM pg_depend d
        JOIN pg_class c ON d.refobjid = c.oid
        WHERE c.relname = '${migration.new_name}'
          AND d.deptype = 'n'
          AND d.objid > (
            SELECT MAX(oid) FROM pg_class 
            WHERE relname = '${migration.new_name}'
          )
      `
    });

    if (newDependencies[0]?.count > 0) {
      console.warn(`   ⚠️  Warning: ${newDependencies[0].count} new dependencies found since migration`);
    }
  }

  private showRollbackPlan(migration: any): void {
    console.log('\n📋 Rollback plan:');
    console.log('   1. Drop compatibility view (if exists):');
    console.log(`      DROP VIEW IF EXISTS ${migration.old_name};`);
    console.log('\n   2. Rename table back to original name:');
    console.log(`      ALTER TABLE ${migration.new_name} RENAME TO ${migration.old_name};`);
    console.log('\n   3. Update migration record:');
    console.log(`      UPDATE sys_table_migrations SET status = 'rolled_back' WHERE id = '${migration.id}';`);
  }

  private async executeRollback(migration: any): Promise<void> {
    console.log('\n🚀 Executing rollback...');

    try {
      // Start transaction
      await this.supabase.rpc('execute_sql', { sql_query: 'BEGIN;' });

      // 1. Drop compatibility view if it exists
      if (migration.compatibility_view_created) {
        const { error: dropViewError } = await this.supabase.rpc('execute_sql', {
          sql_query: `DROP VIEW IF EXISTS ${migration.old_name} CASCADE`
        });

        if (dropViewError) {
          throw new Error(`Failed to drop compatibility view: ${dropViewError.message}`);
        }
        console.log(`   ✓ Compatibility view dropped: ${migration.old_name}`);
      }

      // 2. Rename table back to original name
      const { error: renameError } = await this.supabase.rpc('execute_sql', {
        sql_query: `ALTER TABLE ${migration.new_name} RENAME TO ${migration.old_name}`
      });

      if (renameError) {
        throw new Error(`Failed to rename table: ${renameError.message}`);
      }
      console.log(`   ✓ Table renamed: ${migration.new_name} → ${migration.old_name}`);

      // 3. Update migration record
      const { error: updateError } = await this.supabase
        .from('sys_table_migrations')
        .update({
          status: 'rolled_back',
          rollback_at: new Date().toISOString(),
          rollback_by: 'database-cli'
        })
        .eq('id', migration.id);

      if (updateError) {
        throw new Error(`Failed to update migration record: ${updateError.message}`);
      }
      console.log(`   ✓ Migration record updated`);

      // Commit transaction
      await this.supabase.rpc('execute_sql', { sql_query: 'COMMIT;' });

    } catch (error) {
      // Rollback transaction on error
      await this.supabase.rpc('execute_sql', { sql_query: 'ROLLBACK;' });
      throw error;
    }
  }

  private async validateRollback(migration: any): Promise<void> {
    console.log('\n🔍 Validating rollback...');

    // Check original table exists
    const { data: tableRestored } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${migration.old_name}'
      )`
    });

    if (!tableRestored[0]?.exists) {
      throw new Error('Validation failed: Original table not restored');
    }
    console.log(`   ✓ Original table '${migration.old_name}' restored`);

    // Check new table name no longer exists
    const { data: newNameGone } = await this.supabase.rpc('execute_sql', {
      sql_query: `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = '${migration.new_name}'
      )`
    });

    if (newNameGone[0]?.exists) {
      throw new Error('Validation failed: New table name still exists');
    }
    console.log(`   ✓ New table name '${migration.new_name}' removed`);

    // Verify migration status
    const { data: migrationStatus } = await this.supabase
      .from('sys_table_migrations')
      .select('status')
      .eq('id', migration.id)
      .single();

    if (migrationStatus?.status !== 'rolled_back') {
      throw new Error('Validation failed: Migration status not updated');
    }
    console.log(`   ✓ Migration status updated to 'rolled_back'`);

    console.log('   ✓ All validations passed');
  }

  async listMigrations(status?: string): Promise<void> {
    console.log('\n📋 Table Migration History:\n');

    let query = this.supabase
      .from('sys_table_migrations')
      .select('*')
      .order('migrated_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch migrations:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No migrations found');
      return;
    }

    // Display migrations in a table format
    console.log('ID                                   | Old Name        | New Name        | Status      | Date');
    console.log('-------------------------------------|-----------------|-----------------|-------------|---------------------');
    
    data.forEach((migration: any) => {
      const date = new Date(migration.migrated_at).toLocaleString();
      console.log(
        `${migration.id} | ${migration.old_name.padEnd(15)} | ${migration.new_name.padEnd(15)} | ${migration.status.padEnd(11)} | ${date}`
      );
    });

    console.log(`\nTotal: ${data.length} migration(s)`);
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const rollback = new TableRenameRollback();

  if (command === 'list') {
    // List migrations
    const status = args[1]; // Optional status filter
    rollback.listMigrations(status)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Failed:', error.message);
        process.exit(1);
      });
  } else if (args.length < 1) {
    console.log('Usage:');
    console.log('  Rollback: ts-node rollback-table-rename.ts <table-name> [options]');
    console.log('  List:     ts-node rollback-table-rename.ts list [status]');
    console.log('\nOptions:');
    console.log('  --id=<migration-id>   Rollback specific migration by ID');
    console.log('  --force               Skip confirmation prompt');
    console.log('  --dry-run             Show what would be done without making changes');
    console.log('\nStatus values: active, rolled_back, pending');
    process.exit(1);
  } else {
    // Rollback command
    const tableName = args[0];
    const options: RollbackOptions = {
      tableName,
      migrationId: args.find(arg => arg.startsWith('--id='))?.split('=')[1],
      force: args.includes('--force'),
      dryRun: args.includes('--dry-run')
    };

    rollback.rollbackRename(options)
      .then(() => process.exit(0))
      .catch((error) => {
        console.error('Failed:', error.message);
        process.exit(1);
      });
  }
}

export { TableRenameRollback, RollbackOptions };