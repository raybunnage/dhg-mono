/**
 * Dry run script for Dynamic Healing Discussion Group folder sync
 */
import { searchSpecificFolder, insertGoogleFiles } from '../apps/dhg-improve-experts/src/services/googleDriveService';

const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

async function main() {
  console.log('Starting dry run for Dynamic Healing Discussion Group...');
  
  try {
    // Step 1: Search for files in the Dynamic Healing folder
    console.log(`Searching for files in folder: ${DYNAMIC_HEALING_FOLDER_ID}`);
    const searchResults = await searchSpecificFolder(DYNAMIC_HEALING_FOLDER_ID);
    
    console.log(`Found ${searchResults.totalCount} files in the folder`);
    
    if (searchResults.totalCount === 0) {
      console.log('No files found. Exiting...');
      return;
    }
    
    // Step 2: Run a dry run of the insert operation
    console.log('Performing dry run of insertion (will not actually insert any files)');
    
    // Create a mock function to simulate the insert
    const mockFiles = searchResults.files.map(file => {
      // Filter fields for cleaner output
      return {
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size
      };
    });
    
    console.log(`First 5 files that would be synced:`);
    mockFiles.slice(0, 5).forEach((file, index) => {
      console.log(`${index + 1}. ${file.name} (${file.mimeType})`);
    });
    
    console.log(`\nFile type breakdown:`);
    const fileTypes: Record<string, number> = {};
    searchResults.files.forEach(file => {
      const type = file.mimeType || 'unknown';
      fileTypes[type] = (fileTypes[type] || 0) + 1;
    });
    
    Object.entries(fileTypes).forEach(([type, count]) => {
      console.log(`${type}: ${count} files`);
    });
    
    console.log('\nDry run completed. Run the actual insertion process to perform the sync.');
    
  } catch (error) {
    console.error('Error during dry run:', error);
  }
}

main().catch(console.error);