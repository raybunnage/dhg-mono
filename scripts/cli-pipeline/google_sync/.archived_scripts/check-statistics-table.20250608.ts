#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkStatisticsTable() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get all entries for the active drive
    const { data: stats, error } = await supabase
      .from('google_sync_statistics')
      .select('*')
      .eq('root_drive_id', '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV')
      .order('google_drive_count', { ascending: false });
    
    if (error) {
      console.error('Error fetching statistics:', error);
      return;
    }
    
    console.log(`Total entries in table: ${stats?.length || 0}`);
    console.log('\nTop 10 entries by count:');
    console.log('================================================');
    
    const top10 = stats?.slice(0, 10) || [];
    for (const stat of top10) {
      console.log(`${stat.folder_name}: ${stat.google_drive_count} items`);
    }
    
    // Find the TOTAL entry
    const totalEntry = stats?.find(s => s.folder_id.startsWith('TOTAL-'));
    if (totalEntry) {
      console.log('\n================================================');
      console.log('TOTAL ENTRY:');
      console.log(`  Files: ${totalEntry.google_drive_count}`);
      console.log(`  Documents: ${totalEntry.google_drive_documents}`);
      console.log(`  Folders: ${totalEntry.google_drive_folders}`);
    }
    
    // Sum all non-TOTAL entries
    const nonTotalStats = stats?.filter(s => !s.folder_id.startsWith('TOTAL-')) || [];
    const sumOfFolders = nonTotalStats.reduce((sum, stat) => sum + stat.google_drive_count, 0);
    
    console.log('\n================================================');
    console.log('ANALYSIS:');
    console.log(`Sum of all folder counts (excluding TOTAL): ${sumOfFolders}`);
    console.log(`TOTAL entry count: ${totalEntry?.google_drive_count || 0}`);
    console.log(`Difference: ${sumOfFolders - (totalEntry?.google_drive_count || 0)}`);
    
    // Check what the Statistics page is likely seeing
    console.log('\n================================================');
    console.log('What the Statistics page sees:');
    const aggregated = stats?.reduce((acc, stat) => {
      if (!stat.folder_id.startsWith('TOTAL-')) {
        acc.totalFolders += 1;
        acc.totalFiles += stat.google_drive_count;
        acc.totalDocuments += stat.google_drive_documents;
        acc.totalSubfolders += stat.google_drive_folders;
      }
      return acc;
    }, {
      totalFolders: 0,
      totalFiles: 0,
      totalDocuments: 0,
      totalSubfolders: 0
    });
    
    console.log(`Total Folders: ${aggregated?.totalFolders}`);
    console.log(`Total Files (sum of all folders): ${aggregated?.totalFiles}`);
    console.log(`Total Documents: ${aggregated?.totalDocuments}`);
    console.log(`Total Subfolders: ${aggregated?.totalSubfolders}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkStatisticsTable();