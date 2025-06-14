/**
 * FileSystemService Benchmark
 * 
 * Performance testing for file system operations
 */

import { FileSystemService } from './FileSystemService';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

async function benchmark() {
  console.log('🚀 Starting FileSystemService benchmark...\n');
  
  const service = FileSystemService.getInstance({
    defaultMaxDepth: 3,
    defaultParallelism: 5
  });
  
  // Create test directory structure
  const testDir = path.join(os.tmpdir(), `fs-benchmark-${Date.now()}`);
  
  try {
    // Setup test environment
    console.log('📁 Setting up test environment...');
    await setupTestEnvironment(testDir);
    
    // Health check
    console.log('\n🏥 Running health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    console.log(`✓ Health check: ${Date.now() - healthStart}ms (healthy: ${health.healthy})\n`);

    // Benchmark file hashing
    console.log('🔐 Benchmarking file hashing...');
    const testFile = path.join(testDir, 'test-file-1mb.dat');
    
    const hashAlgorithms: Array<'sha256' | 'md5' | 'sha1'> = ['sha256', 'md5', 'sha1'];
    for (const algorithm of hashAlgorithms) {
      const hashResults = [];
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        const hash = await service.calculateFileHash(testFile, { algorithm });
        const duration = Date.now() - start;
        hashResults.push(duration);
      }
      const avgHash = hashResults.reduce((a, b) => a + b, 0) / hashResults.length;
      console.log(`  ${algorithm}: ${avgHash.toFixed(2)}ms average (10 runs)`);
    }

    // Benchmark directory walking
    console.log('\n📂 Benchmarking directory walking...');
    
    // Warm up
    await service.walkDir(testDir);
    
    // Test different configurations
    const walkConfigs = [
      { label: 'Files only', options: { includeDirectories: false } },
      { label: 'With directories', options: { includeDirectories: true } },
      { label: 'With exclusions', options: { excludePatterns: [/temp/, /cache/] } },
      { label: 'Limited depth', options: { maxDepth: 2 } },
      { label: 'With progress', options: { onProgress: () => {} } }
    ];
    
    for (const config of walkConfigs) {
      const walkResults = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        const files = await service.walkDir(testDir, config.options);
        const duration = Date.now() - start;
        walkResults.push({ duration, count: files.length });
      }
      const avgWalk = walkResults.reduce((a, b) => a + b.duration, 0) / walkResults.length;
      const avgCount = walkResults.reduce((a, b) => a + b.count, 0) / walkResults.length;
      console.log(`  ${config.label}: ${avgWalk.toFixed(2)}ms, ${avgCount} items average`);
    }

    // Benchmark file operations
    console.log('\n📄 Benchmarking file operations...');
    const fileOps = [
      { name: 'fileExists', fn: () => service.fileExists(testFile) },
      { name: 'directoryExists', fn: () => service.directoryExists(testDir) },
      { name: 'getFileSize', fn: () => service.getFileSize(testFile) },
      { name: 'getFileMetadata', fn: () => service.getFileMetadata(testFile) }
    ];
    
    for (const op of fileOps) {
      const opResults = [];
      for (let i = 0; i < 100; i++) {
        const start = Date.now();
        await op.fn();
        const duration = Date.now() - start;
        opResults.push(duration);
      }
      const avgOp = opResults.reduce((a, b) => a + b, 0) / opResults.length;
      console.log(`  ${op.name}: ${avgOp.toFixed(3)}ms average (100 runs)`);
    }

    // Benchmark convenience methods
    console.log('\n🔍 Benchmarking find methods...');
    
    const findStart = Date.now();
    const docFiles = await service.findDocumentationFiles(false);
    console.log(`  findDocumentationFiles: ${Date.now() - findStart}ms (${docFiles.length} files)`);
    
    const scriptStart = Date.now();
    const scriptFiles = await service.findScriptFiles(false);
    console.log(`  findScriptFiles: ${Date.now() - scriptStart}ms (${scriptFiles.length} files)`);

    // Test parallel processing
    console.log('\n⚡ Testing parallel processing...');
    const parallelismTests = [1, 3, 5, 10];
    
    for (const parallelism of parallelismTests) {
      const start = Date.now();
      await service.walkDir(testDir, { parallelism });
      const duration = Date.now() - start;
      console.log(`  Parallelism ${parallelism}: ${duration}ms`);
    }

    // Final metrics
    console.log('\n📊 Final Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  Total Operations: ${metrics.totalOperations}`);
    console.log(`  Files Hashed: ${metrics.filesHashed}`);
    console.log(`  Directories Walked: ${metrics.directoriesWalked}`);
    console.log(`  Files Found: ${metrics.filesFound}`);
    console.log(`  Errors: ${metrics.errors}`);
    console.log(`  Average Hash Time: ${metrics.averageHashTime?.toFixed(2)}ms`);
    console.log(`  Average Walk Time: ${metrics.averageWalkTime?.toFixed(2)}ms`);
    
    console.log('\n✅ Benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test environment...');
    await cleanup(testDir);
    await service.shutdown();
  }
}

// Helper functions

async function setupTestEnvironment(baseDir: string): Promise<void> {
  // Create directory structure
  const dirs = [
    '',
    'docs',
    'docs/api',
    'docs/guides',
    'scripts',
    'scripts/utils',
    'temp',
    'cache',
    'nested/deep/structure/test'
  ];
  
  for (const dir of dirs) {
    await fs.promises.mkdir(path.join(baseDir, dir), { recursive: true });
  }
  
  // Create test files
  const files = [
    { path: 'test-file-1mb.dat', size: 1024 * 1024 },
    { path: 'docs/readme.md', size: 1024 },
    { path: 'docs/api/reference.md', size: 2048 },
    { path: 'docs/guides/tutorial.txt', size: 512 },
    { path: 'scripts/build.js', size: 4096 },
    { path: 'scripts/utils/helper.ts', size: 1024 },
    { path: 'temp/cache.tmp', size: 256 },
    { path: 'nested/deep/structure/test/file.txt', size: 128 }
  ];
  
  for (const file of files) {
    const filePath = path.join(baseDir, file.path);
    const buffer = Buffer.alloc(file.size, 'test data ');
    await fs.promises.writeFile(filePath, buffer);
  }
  
  console.log(`✓ Created test environment with ${dirs.length} directories and ${files.length} files`);
}

async function cleanup(dir: string): Promise<void> {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
    console.log('✓ Test environment cleaned up');
  } catch (error) {
    console.warn('⚠️  Failed to cleanup test directory:', error);
  }
}

// Run benchmark if called directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };