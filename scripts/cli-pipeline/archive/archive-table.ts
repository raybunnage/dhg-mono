#!/usr/bin/env ts-node

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { ArchiveService } from '../../../packages/shared/services/archive-service';

interface Options {
  reason?: string;
  by?: string;
}

async function archiveTable(tableName: string, options: Options) {
  try {
    if (!options.reason) {
      console.error('❌ Error: --reason is required');
      process.exit(1);
    }

    const supabase = SupabaseClientService.getInstance().getClient();
    const archiveService = new ArchiveService(supabase);

    console.log(`📦 Archiving table: ${tableName}`);
    console.log(`📝 Reason: ${options.reason}`);
    console.log(`👤 Archived by: ${options.by || 'system'}`);

    const result = await archiveService.archiveTable(
      tableName,
      options.reason,
      options.by || 'system'
    );

    console.log(`✅ Table archived successfully!`);
    console.log(`📋 Archive ID: ${result.id}`);
    console.log(`📊 Row count: ${result.row_count}`);
    console.log(`🔗 Foreign keys: ${result.foreign_keys.length}`);
    console.log(`📑 Indexes: ${result.indexes.length}`);

  } catch (error) {
    console.error('❌ Error archiving table:', error);
    process.exit(1);
  }
}

program
  .argument('<table_name>', 'Name of the table to archive')
  .option('--reason <text>', 'Reason for archiving (required)')
  .option('--by <user>', 'Who is archiving', 'system')
  .action(archiveTable);

program.parse(process.argv);