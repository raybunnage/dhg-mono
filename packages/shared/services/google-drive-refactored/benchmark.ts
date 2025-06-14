import { GoogleDriveService } from './GoogleDriveService';
import { SupabaseClientService } from '../supabase-client';
import GoogleAuthService from '../google-drive/google-auth-service';

/**
 * Benchmark GoogleDriveService performance
 */
async function benchmark() {
  console.log('🚀 Starting GoogleDriveService benchmark...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const authService = GoogleAuthService.getInstance(supabase);
  
  const service = GoogleDriveService.getInstance({
    authService,
    supabaseClient: supabase
  });
  
  try {
    // Health Check
    console.log('📊 Testing health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    console.log(`  Auth: ${health.details.authService}`);
    console.log(`  API: ${health.details.apiConnection}`);
    console.log(`  Database: ${health.details.database}`);
    
    // Check if we have valid auth
    if (health.details.authService !== 'healthy') {
      console.log('\n⚠️  No valid authentication - skipping API benchmarks');
      console.log('  Run google-sync-cli.sh authenticate first');
    } else {
      // Root Folders
      console.log('\n📊 Testing root folders retrieval...');
      const rootStart = Date.now();
      const rootFolders = await service.getRootFolders();
      const rootDuration = Date.now() - rootStart;
      console.log(`✓ Get root folders: ${rootDuration}ms (found ${rootFolders.length} folders)`);
      
      if (rootFolders.length > 0) {
        const testFolderId = rootFolders[0].folder_id;
        
        // List Files
        console.log('\n📊 Testing file listing...');
        const listStart = Date.now();
        const listResult = await service.listFiles(testFolderId, { pageSize: 10 });
        const listDuration = Date.now() - listStart;
        console.log(`✓ List files: ${listDuration}ms (found ${listResult.files.length} files)`);
        
        // List Folders
        console.log('\n📊 Testing folder listing...');
        const foldersStart = Date.now();
        const folders = await service.listFolders(testFolderId, { pageSize: 10 });
        const foldersDuration = Date.now() - foldersStart;
        console.log(`✓ List folders: ${foldersDuration}ms (found ${folders.length} folders)`);
        
        // Get File Metadata (if files exist)
        if (listResult.files.length > 0) {
          console.log('\n📊 Testing file metadata retrieval...');
          const fileId = listResult.files[0].id;
          
          // First call (no cache)
          const metaStart1 = Date.now();
          const file1 = await service.getFile(fileId);
          const metaDuration1 = Date.now() - metaStart1;
          console.log(`✓ Get file metadata (cold): ${metaDuration1}ms`);
          
          // Second call (cached)
          const metaStart2 = Date.now();
          const file2 = await service.getFile(fileId);
          const metaDuration2 = Date.now() - metaStart2;
          console.log(`✓ Get file metadata (cached): ${metaDuration2}ms`);
          console.log(`  Cache speedup: ${Math.round((metaDuration1 - metaDuration2) / metaDuration1 * 100)}%`);
        }
      }
    }
    
    // Display metrics
    console.log('\n📈 Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  API calls: ${metrics.apiCalls}`);
    console.log(`  Files listed: ${metrics.filesListed}`);
    console.log(`  Folders processed: ${metrics.foldersProcessed}`);
    console.log(`  Cache hits: ${metrics.cacheHits}`);
    console.log(`  Cache misses: ${metrics.cacheMisses}`);
    console.log(`  Bytes processed: ${metrics.bytesProcessed}`);
    console.log(`  Errors: ${metrics.errorsEncountered}`);
    
    // Test cache clearing
    console.log('\n📊 Testing cache management...');
    const cacheStart = Date.now();
    service.clearCache();
    const cacheDuration = Date.now() - cacheStart;
    console.log(`✓ Clear cache: ${cacheDuration}ms`);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  benchmark().catch(console.error);
}

export { benchmark };