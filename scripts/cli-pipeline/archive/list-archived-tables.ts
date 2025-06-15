#!/usr/bin/env ts-node

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { ArchiveService } from '../../../packages/shared/services/archive-service';

interface Options {
  limit?: string;
}

async function listArchivedTables(options: Options) {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    const archiveService = new ArchiveService(supabase);
    
    const limit = parseInt(options.limit || '20');
    
    console.log('📋 Archived Tables:');
    console.log('═'.repeat(80));
    
    const archives = await archiveService.listArchivedTables();
    const displayArchives = limit > 0 ? archives.slice(0, limit) : archives;
    
    if (displayArchives.length === 0) {
      console.log('No archived tables found.');
    } else {
      displayArchives.forEach((archive, index) => {
        console.log(`\n${index + 1}. ${archive.table_name}`);
        console.log(`   ID: ${archive.id}`);
        console.log(`   Rows: ${archive.row_count}`);
        console.log(`   Archived: ${new Date(archive.archived_at).toLocaleString()}`);
        console.log(`   By: ${archive.archived_by}`);
        console.log(`   Reason: ${archive.reason}`);
        console.log(`   FK Count: ${archive.foreign_keys.length}`);
        console.log(`   Index Count: ${archive.indexes.length}`);
      });
    }
    
    console.log('\n' + '═'.repeat(80));
    console.log(`Total archived tables: ${archives.length}`);
    
  } catch (error) {
    console.error('❌ Error listing archived tables:', error);
    process.exit(1);
  }
}

program
  .option('--limit <n>', 'Limit number of results', '20')
  .action(listArchivedTables);

program.parse(process.argv);