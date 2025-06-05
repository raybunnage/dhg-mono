/**
 * find-duplicates.ts
 * 
 * Script to find duplicate file_path entries in documentation_files table
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function findDuplicates() {
  console.log('Checking for duplicate file paths in documentation_files table...');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // First get a count of all records
  const { count, error: countError } = await supabase
    .from('documentation_files')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error getting count:', countError);
    return;
  }
  
  console.log(`Total records in documentation_files: ${count}`);
  
  // Get all file paths
  const { data: allData, error: allError } = await supabase
    .from('documentation_files')
    .select('id, file_path');
  
  if (allError) {
    console.error('Error fetching file paths:', allError);
    return;
  }
  
  // Find duplicates manually
  const pathMap: Record<string, string[]> = {};
  
  // Group by file_path
  allData?.forEach(item => {
    if (!pathMap[item.file_path]) {
      pathMap[item.file_path] = [];
    }
    pathMap[item.file_path].push(item.id);
  });
  
  // Filter for only paths with more than one entry
  const duplicatePaths = Object.entries(pathMap)
    .filter(([_, ids]) => ids.length > 1)
    .map(([path, ids]) => ({ 
      file_path: path, 
      count: ids.length,
      ids: ids
    }));
  
  console.log(`Found ${duplicatePaths.length} file paths with duplicates`);
  
  if (duplicatePaths.length > 0) {
    // Show top 10 duplicates
    const top10 = duplicatePaths.slice(0, 10);
    console.log('\nTop 10 duplicate paths:');
    top10.forEach(dup => {
      console.log(`- ${dup.file_path} (${dup.count} duplicates)`);
    });
    
    // Calculate total duplicate records
    let totalDuplicateRecords = 0;
    duplicatePaths.forEach(dup => {
      totalDuplicateRecords += dup.count - 1; // Count all except one record
    });
    
    console.log(`\nTotal duplicate records that could be removed: ${totalDuplicateRecords}`);
    
    // Show a sample of duplicates with details
    if (duplicatePaths.length > 0) {
      const samplePath = duplicatePaths[0].file_path;
      const sampleIds = duplicatePaths[0].ids;
      
      console.log(`\nSample duplicates for path: ${samplePath}`);
      
      // Get detailed info for the duplicates
      const { data: sampleData, error: sampleError } = await supabase
        .from('documentation_files')
        .select('id, file_path, title, created_at, updated_at')
        .in('id', sampleIds);
      
      if (sampleError) {
        console.error('Error getting sample details:', sampleError);
      } else {
        console.log(JSON.stringify(sampleData, null, 2));
      }
      
      // Create a SQL command to delete duplicates
      if (duplicatePaths.length > 0) {
        console.log('\nTo remove duplicates, you could run the following operations:');
        console.log('WARNING: This is destructive and will delete data. Make a backup first!');
        
        const sampleDupe = duplicatePaths[0];
        const keepId = sampleDupe.ids[0]; // Keep the first record
        const deleteIds = sampleDupe.ids.slice(1); // Delete the rest
        
        console.log(`\nExample for path "${sampleDupe.file_path}":`);
        console.log(`1. Keep record with ID: ${keepId}`);
        console.log(`2. Delete ${deleteIds.length} duplicate(s) with IDs: ${deleteIds.join(', ')}`);
        
        console.log('\nSQL command example (for one file path):');
        console.log(`DELETE FROM documentation_files WHERE id IN ('${deleteIds.join("','")}');`);
      }
    }
  } else {
    console.log('No duplicates found! Your database is clean.');
  }
}

// Run the function
findDuplicates()
  .catch(console.error)
  .finally(() => console.log('Done.'));