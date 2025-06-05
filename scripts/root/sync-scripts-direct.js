// Direct script to run the sync functionality
// This uses the updated ScriptManagementService that properly normalizes paths

try {
  // Import the service using absolute path resolution
  const path = require('path');
  // Get the actual project root directory (where package.json is)
  const fs = require('fs');
  let rootDir = path.resolve(__dirname, '../');

  // Traverse up to find the real project root by looking for package.json
  function findProjectRoot(startDir) {
    let currentDir = startDir;
    while (currentDir !== '/') {
      if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    // If we couldn't find it, just return the starting directory
    return startDir;
  }

  rootDir = findProjectRoot(rootDir);
  const servicePath = path.resolve(rootDir, 'packages/cli/src/services/script-management-service.ts');
  
  console.log('Root directory:', rootDir);
  console.log('Loading service from:', servicePath);
  
  // We already have fs required above
  
  // Try to find the correct path to the service
  let serviceModule;
  let actualServicePath;
  
  // First try the compiled JavaScript version (most reliable)
  const jsServicePath = path.resolve(rootDir, 'packages/cli/dist/services/script-management-service.js');
  if (fs.existsSync(jsServicePath)) {
    console.log('Found compiled JavaScript version at:', jsServicePath);
    actualServicePath = jsServicePath;
    serviceModule = require(jsServicePath);
  } 
  // Then try the TypeScript file with ts-node
  else if (fs.existsSync(servicePath)) {
    console.log('Found TypeScript version, using ts-node to load it');
    try {
      require('ts-node/register');
      actualServicePath = servicePath;
      serviceModule = require(servicePath);
    } catch (tsNodeError) {
      console.error('Error loading with ts-node:', tsNodeError.message);
      throw new Error('Failed to load TypeScript file with ts-node. Make sure ts-node is installed.');
    }
  }
  // Try another common location pattern
  else {
    const alternativePath = path.resolve(rootDir, '../packages/cli/src/services/script-management-service.ts');
    if (fs.existsSync(alternativePath)) {
      console.log('Found service at alternative location:', alternativePath);
      try {
        require('ts-node/register');
        actualServicePath = alternativePath;
        serviceModule = require(alternativePath);
      } catch (tsNodeError) {
        console.error('Error loading with ts-node:', tsNodeError.message);
        throw new Error('Failed to load TypeScript file with ts-node. Make sure ts-node is installed.');
      }
    } else {
      throw new Error(`Could not find ScriptManagementService at any expected location`);
    }
  }
  
  console.log('Successfully loaded service from:', actualServicePath);
  const { ScriptManagementService } = serviceModule;
  
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