// Direct script to run the sync functionality
// This uses the updated ScriptManagementService that properly normalizes paths

try {
  // Import the service using absolute path resolution
  const path = require('path');
  const rootDir = path.resolve(__dirname, '../');
  const servicePath = path.resolve(rootDir, 'packages/cli/src/services/script-management-service');
  
  console.log('Root directory:', rootDir);
  console.log('Loading service from:', servicePath);
  
  // Load the ScriptManagementService
  const { ScriptManagementService } = require(servicePath);
  
  async function runSync() {
    try {
      console.log('Creating script management service...');
      // Create new instance (will load config automatically)
      const scriptService = new ScriptManagementService();
      
      console.log('Discovering scripts...');
      // Discover scripts from current directory
      const scripts = await scriptService.discoverScripts(rootDir);
      console.log(`Discovered ${scripts.length} scripts`);
      
      if (scripts.length > 0) {
        // Actual sync operation
        console.log('Syncing with database...');
        const result = await scriptService.syncWithDatabase(scripts);
        console.log('Sync complete!');
        console.log(`Added: ${result.added}, Updated: ${result.updated}, Deleted: ${result.deleted}, Errors: ${result.errors}`);
      } else {
        console.log('No scripts found to sync.');
      }
    } catch (error) {
      console.error('Error during sync operation:', error);
      process.exit(1);
    }
  }
  
  // Run the sync function and handle any errors
  runSync().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
} catch (importError) {
  console.error('Failed to import required modules:', importError);
  console.error('Error details:', importError);
  process.exit(1);
}