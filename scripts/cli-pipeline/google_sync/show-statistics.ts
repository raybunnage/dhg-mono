#!/usr/bin/env ts-node

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface ShowStatisticsOptions {
  limit?: number;
  rootDriveId?: string;
  format?: 'table' | 'json' | 'summary';
}

async function showStatistics(options: ShowStatisticsOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();
  const limit = options.limit || 20;
  const format = options.format || 'table';
  
  console.log('Fetching sync statistics...\n');
  
  try {
    // Build query
    let query = supabase
      .from('google_sync_statistics')
      .select('*')
      .order('google_drive_count', { ascending: false })
      .limit(limit);
    
    if (options.rootDriveId) {
      query = query.eq('root_drive_id', options.rootDriveId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching statistics:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No statistics found.');
      return;
    }
    
    // Format output based on option
    if (format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (format === 'summary') {
      // Calculate summary statistics
      const summary = data.reduce((acc, stat) => {
        acc.totalFolders += 1;
        acc.totalFiles += stat.google_drive_count;
        acc.totalDocuments += stat.google_drive_documents;
        acc.totalSubfolders += stat.google_drive_folders;
        acc.totalMp4Files += stat.mp4_files;
        acc.totalMp4Size += BigInt(stat.mp4_total_size || '0');
        acc.totalNewFiles += stat.new_files;
        return acc;
      }, {
        totalFolders: 0,
        totalFiles: 0,
        totalDocuments: 0,
        totalSubfolders: 0,
        totalMp4Files: 0,
        totalMp4Size: BigInt(0),
        totalNewFiles: 0
      });
      
      console.log('=== GOOGLE DRIVE SYNC STATISTICS SUMMARY ===\n');
      
      // Show which root drive this is for (if all records have the same one)
      const rootDriveIds = [...new Set(data.map(d => d.root_drive_id).filter(Boolean))];
      if (rootDriveIds.length === 1) {
        console.log(`Root Drive ID: ${rootDriveIds[0]}`);
      } else if (rootDriveIds.length > 1) {
        console.log(`Multiple Root Drives: ${rootDriveIds.length} different drives`);
      }
      
      console.log(`Total Folders Analyzed: ${summary.totalFolders}`);
      console.log(`Total Files: ${summary.totalFiles.toLocaleString()}`);
      console.log(`Total Documents: ${summary.totalDocuments.toLocaleString()}`);
      console.log(`Total Subfolders: ${summary.totalSubfolders.toLocaleString()}`);
      console.log(`Total MP4 Files: ${summary.totalMp4Files.toLocaleString()}`);
      console.log(`Total MP4 Size: ${(Number(summary.totalMp4Size) / (1024 * 1024 * 1024)).toFixed(2)} GB`);
      console.log(`New Files (last 7 days): ${summary.totalNewFiles.toLocaleString()}`);
      
      // Show last update time
      const lastUpdate = data.reduce((latest, stat) => {
        if (!stat.updated_at) return latest;
        const statDate = new Date(stat.updated_at);
        return !latest || statDate > latest ? statDate : latest;
      }, null as Date | null);
      
      console.log(`\nLast Updated: ${lastUpdate ? lastUpdate.toLocaleString() : 'Never'}`);
      
    } else {
      // Table format
      console.log('=== TOP FOLDERS BY FILE COUNT ===\n');
      console.log('Folder Name                                      | Total | Docs  | Dirs | MP4s | MP4 Size  | New');
      console.log('------------------------------------------------|-------|-------|------|------|-----------|-----');
      
      data.forEach(stat => {
        const folderName = stat.folder_name.substring(0, 47).padEnd(47);
        const total = stat.google_drive_count.toString().padStart(5);
        const docs = stat.google_drive_documents.toString().padStart(5);
        const dirs = stat.google_drive_folders.toString().padStart(4);
        const mp4s = stat.mp4_files.toString().padStart(4);
        const mp4Size = `${(Number(stat.mp4_total_size || '0') / (1024 * 1024 * 1024)).toFixed(1)} GB`.padStart(9);
        const newFiles = stat.new_files.toString().padStart(3);
        
        console.log(`${folderName} | ${total} | ${docs} | ${dirs} | ${mp4s} | ${mp4Size} | ${newFiles}`);
      });
      
      console.log('\n' + '='.repeat(96));
      
      // Show totals
      const totals = data.reduce((acc, stat) => {
        acc.files += stat.google_drive_count;
        acc.docs += stat.google_drive_documents;
        acc.dirs += stat.google_drive_folders;
        acc.mp4s += stat.mp4_files;
        acc.mp4Size += BigInt(stat.mp4_total_size || '0');
        acc.newFiles += stat.new_files;
        return acc;
      }, {
        files: 0,
        docs: 0,
        dirs: 0,
        mp4s: 0,
        mp4Size: BigInt(0),
        newFiles: 0
      });
      
      const totalLabel = `TOTALS (${data.length} folders shown)`.padEnd(47);
      const totalFiles = totals.files.toString().padStart(5);
      const totalDocs = totals.docs.toString().padStart(5);
      const totalDirs = totals.dirs.toString().padStart(4);
      const totalMp4s = totals.mp4s.toString().padStart(4);
      const totalMp4Size = `${(Number(totals.mp4Size) / (1024 * 1024 * 1024)).toFixed(1)} GB`.padStart(9);
      const totalNew = totals.newFiles.toString().padStart(3);
      
      console.log(`${totalLabel} | ${totalFiles} | ${totalDocs} | ${totalDirs} | ${totalMp4s} | ${totalMp4Size} | ${totalNew}`);
    }
    
  } catch (error) {
    console.error('Error showing statistics:', error);
  }
}

// Set up the CLI
program
  .name('show-statistics')
  .description('Display Google Drive sync statistics from the database')
  .option('-l, --limit <number>', 'Number of folders to show', '20')
  .option('-r, --root-drive-id <id>', 'Filter by specific root drive ID')
  .option('-f, --format <format>', 'Output format: table, json, or summary', 'table')
  .action(async (options: ShowStatisticsOptions) => {
    await showStatistics(options);
  });

program.parse(process.argv);