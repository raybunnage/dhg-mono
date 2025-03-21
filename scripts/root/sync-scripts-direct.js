// Direct script to run the sync functionality
const path = require('path');

// Mock some services that might be needed
const Logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

// Import the actual service we need
try {
  const { ScriptManagementService } = require(path.join(__dirname, '../packages/cli/src/services/script-management-service'));
  
  async function runSync() {
    try {
      // Check that we have the required environment variables
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
        console.error('ERROR: SUPABASE_URL and SUPABASE_KEY environment variables must be set.');
        console.error('Please set these variables and try again.');
        process.exit(1);
      }
      
      console.log('Creating script management service...');
      const scriptService = new ScriptManagementService();
      
      console.log('Discovering scripts...');
      const scripts = await scriptService.discoverScripts(process.cwd());
      console.log(`Discovered ${scripts.length} scripts`);
      
      if (scripts.length > 0) {
        console.log('Syncing with database...');
        const result = await scriptService.syncWithDatabase(scripts);
        console.log('Sync complete!');
        console.log(`Added: ${result.added}, Updated: ${result.updated}, Deleted: ${result.deleted}, Errors: ${result.errors}`);
      } else {
        console.log('No scripts found to sync.');
      }
    } catch (error) {
      console.error('Error during sync:', error);
      process.exit(1);
    }
  }
  
  // Run the sync function
  runSync();
} catch (importError) {
  console.error('Failed to import required modules:', importError);
  process.exit(1);
}