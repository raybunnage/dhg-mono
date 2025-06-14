import { performance } from 'perf_hooks';
import { DatabaseService as OldDatabaseService } from '../../database-service-original/database-service';
import { DatabaseService as NewDatabaseService } from '../DatabaseService';

interface BenchmarkResult {
  operation: string;
  oldTime: number;
  newTime: number;
  improvement: string;
}

async function runBenchmark() {
  console.log('DatabaseService Performance Benchmark\n');
  console.log('=====================================\n');
  
  const results: BenchmarkResult[] = [];
  
  // Initialize services
  console.log('Initializing services...');
  const oldService = OldDatabaseService.getInstance();
  const newService = NewDatabaseService.getInstance();
  await newService.ensureInitialized();
  
  // Warm up both services
  console.log('Warming up services...\n');
  await oldService.getTablesWithRecordCounts();
  await newService.getTablesWithRecordCounts();
  
  // Test 1: getTablesWithRecordCounts
  console.log('Testing getTablesWithRecordCounts...');
  const tableCountIterations = 3;
  
  let oldTableTime = 0;
  for (let i = 0; i < tableCountIterations; i++) {
    const start = performance.now();
    await oldService.getTablesWithRecordCounts();
    oldTableTime += performance.now() - start;
  }
  oldTableTime /= tableCountIterations;
  
  let newTableTime = 0;
  for (let i = 0; i < tableCountIterations; i++) {
    const start = performance.now();
    await newService.getTablesWithRecordCounts(true); // Force refresh to test actual performance
    newTableTime += performance.now() - start;
  }
  newTableTime /= tableCountIterations;
  
  results.push({
    operation: 'getTablesWithRecordCounts',
    oldTime: oldTableTime,
    newTime: newTableTime,
    improvement: `${((oldTableTime - newTableTime) / oldTableTime * 100).toFixed(1)}%`
  });
  
  // Test 2: Cache Performance (new feature)
  console.log('Testing cache performance...');
  const cacheStart = performance.now();
  for (let i = 0; i < 10; i++) {
    await newService.getTablesWithRecordCounts(); // Should use cache
  }
  const cacheTime = (performance.now() - cacheStart) / 10;
  
  results.push({
    operation: 'getTablesWithRecordCounts (cached)',
    oldTime: oldTableTime,
    newTime: cacheTime,
    improvement: `${((oldTableTime - cacheTime) / oldTableTime * 100).toFixed(1)}%`
  });
  
  // Test 3: getDatabaseFunctions
  console.log('Testing getDatabaseFunctions...');
  const functionIterations = 3;
  
  let oldFunctionTime = 0;
  for (let i = 0; i < functionIterations; i++) {
    const start = performance.now();
    await oldService.getDatabaseFunctions();
    oldFunctionTime += performance.now() - start;
  }
  oldFunctionTime /= functionIterations;
  
  let newFunctionTime = 0;
  for (let i = 0; i < functionIterations; i++) {
    const start = performance.now();
    await newService.getDatabaseFunctions();
    newFunctionTime += performance.now() - start;
  }
  newFunctionTime /= functionIterations;
  
  results.push({
    operation: 'getDatabaseFunctions',
    oldTime: oldFunctionTime,
    newTime: newFunctionTime,
    improvement: `${((oldFunctionTime - newFunctionTime) / oldFunctionTime * 100).toFixed(1)}%`
  });
  
  // Test 4: analyzeSchemaHealth
  console.log('Testing analyzeSchemaHealth...');
  const healthIterations = 2;
  
  let oldHealthTime = 0;
  for (let i = 0; i < healthIterations; i++) {
    const start = performance.now();
    await oldService.analyzeSchemaHealth();
    oldHealthTime += performance.now() - start;
  }
  oldHealthTime /= healthIterations;
  
  let newHealthTime = 0;
  for (let i = 0; i < healthIterations; i++) {
    const start = performance.now();
    await newService.analyzeSchemaHealth();
    newHealthTime += performance.now() - start;
  }
  newHealthTime /= healthIterations;
  
  results.push({
    operation: 'analyzeSchemaHealth',
    oldTime: oldHealthTime,
    newTime: newHealthTime,
    improvement: `${((oldHealthTime - newHealthTime) / oldHealthTime * 100).toFixed(1)}%`
  });
  
  // Test 5: Concurrent operations
  console.log('Testing concurrent operations...');
  
  const oldConcurrentStart = performance.now();
  await Promise.all([
    oldService.getEmptyTables(),
    oldService.getInaccessibleTables(),
    oldService.getDatabaseFunctions()
  ]);
  const oldConcurrentTime = performance.now() - oldConcurrentStart;
  
  const newConcurrentStart = performance.now();
  await Promise.all([
    newService.getEmptyTables(),
    newService.getInaccessibleTables(),
    newService.getDatabaseFunctions()
  ]);
  const newConcurrentTime = performance.now() - newConcurrentStart;
  
  results.push({
    operation: 'Concurrent operations',
    oldTime: oldConcurrentTime,
    newTime: newConcurrentTime,
    improvement: `${((oldConcurrentTime - newConcurrentTime) / oldConcurrentTime * 100).toFixed(1)}%`
  });
  
  // Print results
  console.log('\n\nBenchmark Results:');
  console.log('==================\n');
  console.log('| Operation | Old Time (ms) | New Time (ms) | Improvement |');
  console.log('|-----------|---------------|---------------|-------------|');
  
  results.forEach(result => {
    console.log(
      `| ${result.operation.padEnd(40)} | ${result.oldTime.toFixed(2).padStart(13)} | ${result.newTime.toFixed(2).padStart(13)} | ${result.improvement.padStart(11)} |`
    );
  });
  
  console.log('\n\nKey Improvements:');
  console.log('=================');
  console.log('1. ✅ Proper singleton pattern with lifecycle management');
  console.log('2. ✅ Caching for frequently accessed data (5-minute TTL)');
  console.log('3. ✅ Batch processing for table counts');
  console.log('4. ✅ Enhanced error handling and logging');
  console.log('5. ✅ Type safety improvements');
  console.log('6. ✅ New features: executeQuery, getTableSizes, cache management');
  console.log('7. ✅ Health check capabilities');
  
  // Cleanup
  await newService.shutdown();
}

// Run the benchmark
runBenchmark().catch(console.error);