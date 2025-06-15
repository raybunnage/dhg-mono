/**
 * BatchDatabaseService Benchmark
 * 
 * Performance testing for batch database operations
 */

import { BatchDatabaseService } from './BatchDatabaseService';
import { SupabaseClientService } from '../supabase-client';

async function benchmark() {
  console.log('🚀 Starting BatchDatabaseService benchmark...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = BatchDatabaseService.getInstance(supabase);
  
  try {
    // Health check
    console.log('🏥 Running health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    console.log(`✓ Health check: ${Date.now() - healthStart}ms (healthy: ${health.healthy})\n`);

    // Generate test data
    const testSizes = [100, 500, 1000, 5000];
    
    for (const size of testSizes) {
      console.log(`\n📊 Benchmarking with ${size} items:\n`);
      
      // Generate test data
      const insertData = Array.from({ length: size }, (_, i) => ({
        id: `bench-${Date.now()}-${i}`,
        name: `Benchmark Item ${i}`,
        value: Math.random() * 1000,
        created_at: new Date().toISOString()
      }));

      // Benchmark INSERT
      console.log('📥 Testing batch INSERT...');
      const insertStart = Date.now();
      const insertResult = await service.batchInsert('benchmark_test', insertData, {
        batchSize: 100,
        onProgress: service.createConsoleProgress('Insert')
      });
      const insertDuration = Date.now() - insertStart;
      console.log(`✓ Insert completed: ${insertResult.successful} items in ${insertDuration}ms`);
      console.log(`  Rate: ${(size / (insertDuration / 1000)).toFixed(2)} items/sec\n`);

      // Benchmark UPDATE
      console.log('✏️  Testing batch UPDATE...');
      const updateData = insertData.slice(0, Math.min(100, size)).map(item => ({
        id: item.id,
        data: { value: Math.random() * 2000, updated_at: new Date().toISOString() }
      }));
      
      const updateStart = Date.now();
      const updateResult = await service.batchUpdate('benchmark_test', updateData, {
        batchSize: 50,
        onProgress: service.createConsoleProgress('Update')
      });
      const updateDuration = Date.now() - updateStart;
      console.log(`✓ Update completed: ${updateResult.successful} items in ${updateDuration}ms`);
      console.log(`  Rate: ${(updateData.length / (updateDuration / 1000)).toFixed(2)} items/sec\n`);

      // Benchmark UPSERT
      console.log('🔄 Testing batch UPSERT...');
      const upsertData = [
        ...insertData.slice(0, 50).map(item => ({ ...item, value: 9999 })), // Update existing
        ...Array.from({ length: 50 }, (_, i) => ({ // Insert new
          id: `bench-new-${Date.now()}-${i}`,
          name: `New Item ${i}`,
          value: Math.random() * 500
        }))
      ];
      
      const upsertStart = Date.now();
      const upsertResult = await service.batchUpsert('benchmark_test', upsertData, {
        batchSize: 100,
        onConflict: 'id',
        onProgress: service.createConsoleProgress('Upsert')
      });
      const upsertDuration = Date.now() - upsertStart;
      console.log(`✓ Upsert completed: ${upsertResult.successful} items in ${upsertDuration}ms`);
      console.log(`  Rate: ${(100 / (upsertDuration / 1000)).toFixed(2)} items/sec\n`);

      // Benchmark DELETE
      console.log('🗑️  Testing batch DELETE...');
      const deleteIds = insertData.map(item => item.id);
      
      const deleteStart = Date.now();
      const deleteResult = await service.batchDelete('benchmark_test', deleteIds, {
        batchSize: 100,
        onProgress: service.createConsoleProgress('Delete')
      });
      const deleteDuration = Date.now() - deleteStart;
      console.log(`✓ Delete completed: ${deleteResult.successful} items in ${deleteDuration}ms`);
      console.log(`  Rate: ${(size / (deleteDuration / 1000)).toFixed(2)} items/sec`);
    }

    // Final metrics
    console.log('\n📊 Final Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  Total Batches: ${metrics.totalBatches}`);
    console.log(`  Total Operations: ${metrics.totalOperations}`);
    console.log(`  Total Inserts: ${metrics.totalInserts}`);
    console.log(`  Total Updates: ${metrics.totalUpdates}`);
    console.log(`  Total Deletes: ${metrics.totalDeletes}`);
    console.log(`  Total Upserts: ${metrics.totalUpserts}`);
    console.log(`  Total Errors: ${metrics.totalErrors}`);
    console.log(`  Average Rate: ${metrics.averageRate.toFixed(2)} items/sec`);
    
    // Test error handling
    console.log('\n🔥 Testing error handling...');
    const errorResult = await service.batchInsert('nonexistent_table', [{ id: 1 }], {
      continueOnError: true,
      retryAttempts: 2,
      retryDelay: 100
    });
    console.log(`✓ Error handling test: ${errorResult.failed} failed (expected)\n`);
    
    console.log('✅ Benchmark completed successfully');
    
    // Clean up benchmark data
    console.log('\n🧹 Cleaning up benchmark data...');
    await supabase.from('benchmark_test').delete().neq('id', '');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    await service.shutdown();
  }
}

// Run benchmark if called directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };