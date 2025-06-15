/**
 * Performance benchmark for FileService
 */

import { FileService } from './FileService';
import { SupabaseClientService } from '../supabase-client';
import * as fs from 'fs';
import * as path from 'path';

async function benchmark() {
  console.log('Starting FileService benchmark...\n');
  
  const service = FileService.getInstance();
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Create test directory
  const testDir = path.join(process.cwd(), '.benchmark-test');
  const testFile = path.join(testDir, 'test-file.txt');
  
  try {
    // Ensure test directory exists
    service.ensureDirectoryExists(testDir);
    
    // Benchmark 1: Health Check
    console.log('1. Health Check Performance:');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    const healthDuration = Date.now() - healthStart;
    console.log(`   ✓ Health check: ${healthDuration}ms (healthy: ${health.healthy})`);
    
    // Benchmark 2: File Write Operations
    console.log('\n2. File Write Operations:');
    const writeContent = 'This is a benchmark test file.\n'.repeat(1000);
    
    const writeStart = Date.now();
    const writeResult = service.writeFile(testFile, writeContent);
    const writeDuration = Date.now() - writeStart;
    console.log(`   ✓ Write file (${writeContent.length} bytes): ${writeDuration}ms`);
    
    // Benchmark 3: File Read Operations
    console.log('\n3. File Read Operations:');
    const readStart = Date.now();
    const readResult = service.readFile(testFile);
    const readDuration = Date.now() - readStart;
    console.log(`   ✓ Read file: ${readDuration}ms (${readResult.stats?.size} bytes)`);
    
    // Benchmark 4: File Existence Check
    console.log('\n4. File Existence Check:');
    const existsStart = Date.now();
    const exists = service.fileExists(testFile);
    const existsDuration = Date.now() - existsStart;
    console.log(`   ✓ Check file exists: ${existsDuration}ms (exists: ${exists})`);
    
    // Benchmark 5: Directory Operations
    console.log('\n5. Directory Operations:');
    const subdirs = 10;
    const dirStart = Date.now();
    for (let i = 0; i < subdirs; i++) {
      service.ensureDirectoryExists(path.join(testDir, `subdir-${i}`));
    }
    const dirDuration = Date.now() - dirStart;
    console.log(`   ✓ Create ${subdirs} directories: ${dirDuration}ms`);
    
    // Benchmark 6: File Search
    console.log('\n6. File Search Operations:');
    // Create test files
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(testDir, `test-${i}.txt`), 'test');
      fs.writeFileSync(path.join(testDir, `test-${i}.js`), 'test');
    }
    
    const searchStart = Date.now();
    const foundFiles = service.findFilesLegacy(testDir, /\.txt$/, { recursive: true });
    const searchDuration = Date.now() - searchStart;
    console.log(`   ✓ Find files (*.txt): ${searchDuration}ms (found: ${foundFiles.length} files)`);
    
    // Benchmark 7: Google Drive Operations (mock data)
    console.log('\n7. Google Drive Operations:');
    
    // Test high-level folders fetch
    const foldersStart = Date.now();
    const folders = await service.getHighLevelFolders(supabase);
    const foldersDuration = Date.now() - foldersStart;
    console.log(`   ✓ Get high-level folders: ${foldersDuration}ms (found: ${folders.length} folders)`);
    
    // Test folder traversal (if folders exist)
    if (folders.length > 0) {
      const traverseStart = Date.now();
      const traverseResult = await service.traverseGoogleDriveFolder(
        supabase,
        folders[0].drive_id,
        { maxDepth: 2 }
      );
      const traverseDuration = Date.now() - traverseStart;
      console.log(`   ✓ Traverse folder (depth 2): ${traverseDuration}ms (${traverseResult.totalItems} items)`);
    }
    
    // Benchmark 8: Bulk Operations
    console.log('\n8. Bulk File Operations:');
    const bulkFiles = 100;
    const bulkStart = Date.now();
    
    for (let i = 0; i < bulkFiles; i++) {
      const filePath = path.join(testDir, `bulk-${i}.txt`);
      service.writeFile(filePath, `Bulk file ${i}`);
    }
    
    const bulkWriteDuration = Date.now() - bulkStart;
    console.log(`   ✓ Write ${bulkFiles} files: ${bulkWriteDuration}ms`);
    
    const bulkReadStart = Date.now();
    let totalBytesRead = 0;
    
    for (let i = 0; i < bulkFiles; i++) {
      const filePath = path.join(testDir, `bulk-${i}.txt`);
      const result = service.readFile(filePath);
      if (result.stats) {
        totalBytesRead += result.stats.size;
      }
    }
    
    const bulkReadDuration = Date.now() - bulkReadStart;
    console.log(`   ✓ Read ${bulkFiles} files: ${bulkReadDuration}ms (${totalBytesRead} bytes total)`);
    
    // Get final metrics
    console.log('\n9. Service Metrics:');
    const metrics = service.getMetrics();
    console.log('   ✓ Total Files Read:', metrics.totalFilesRead);
    console.log('   ✓ Total Files Written:', metrics.totalFilesWritten);
    console.log('   ✓ Total Directories Created:', metrics.totalDirectoriesCreated);
    console.log('   ✓ Total Bytes Read:', metrics.totalBytesRead);
    console.log('   ✓ Total Bytes Written:', metrics.totalBytesWritten);
    console.log('   ✓ Total Google Drive Traversals:', metrics.totalGoogleDriveTraversals);
    console.log('   ✓ Total Errors:', metrics.totalErrors);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    // Cleanup test files
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
        console.log('\n🧹 Test files cleaned up');
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup test files:', cleanupError);
    }
    
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };