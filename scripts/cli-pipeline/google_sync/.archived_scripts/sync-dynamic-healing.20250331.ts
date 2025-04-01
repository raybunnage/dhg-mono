/**
 * Script to sync the Dynamic Healing Discussion Group folder
 * Can be run with a dry run flag to only report what would be done
 * 
 * Usage:
 * - For dry run: ts-node sync-dynamic-healing.ts --dry-run
 * - For actual sync: ts-node sync-dynamic-healing.ts
 */

// Using dynamic imports to handle ES modules
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Parse command line arguments
const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`Starting ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'} for Dynamic Healing Discussion Group...`);
  
  try {
    // Dynamically import the services
    const { searchSpecificFolder, insertGoogleFiles } = await import('../apps/dhg-improve-experts/src/services/googleDriveService');
    
    // Step 1: Search for files in the Dynamic Healing folder
    console.log(`Searching for files in folder: ${DYNAMIC_HEALING_FOLDER_ID}`);
    const searchResults = await searchSpecificFolder(DYNAMIC_HEALING_FOLDER_ID);
    
    console.log(`Found ${searchResults.totalCount} files in the folder`);
    
    if (searchResults.totalCount === 0) {
      console.log('No files found. Exiting...');
      return;
    }
    
    // Log file stats
    console.log(`\nFile type breakdown:`);
    const fileTypes = {};
    searchResults.files.forEach(file => {
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    
    Object.entries(fileTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} files`);
    });
    
    // Step 2: Either show what would be inserted or actually insert
    if (isDryRun) {
      console.log('\nDRY RUN - The following files would be synced:');
      
      // Show sample of files that would be synced
      const displayLimit = Math.min(searchResults.totalCount, 10);
      searchResults.files.slice(0, displayLimit).forEach((file, index) => {
        console.log(`${index + 1}. ${file.name} (${file.mimeType})`);
      });
      
      if (searchResults.totalCount > displayLimit) {
        console.log(`... and ${searchResults.totalCount - displayLimit} more files`);
      }
      
      console.log('\nDry run completed. Run without --dry-run to perform the actual sync.');
    } else {
      // Actual sync operation - this WILL modify the database
      console.log('\nSTARTING ACTUAL SYNC OPERATION - This will insert/update files in the database');
      console.log('Press Ctrl+C within 5 seconds to cancel...');
      
      // Give user a chance to cancel
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      console.log('Starting insertion with extended timeout (10 minutes)...');
      const result = await insertGoogleFiles(searchResults.files, 600000);
      
      console.log('\nSync operation completed:');
      console.log(`- Successfully processed: ${result.success} files`);
      console.log(`- Errors: ${result.errors} files`);
      console.log(`- New files: ${result.details.newFiles.length}`);
      console.log(`- Updated files: ${result.details.updatedFiles.length}`);
      
      if (result.errors > 0) {
        console.log('\nThere were errors during sync. See above logs for details.');
      }
    }
  } catch (error) {
    console.error('Error during sync operation:', error);
  }
}

main().catch(console.error);