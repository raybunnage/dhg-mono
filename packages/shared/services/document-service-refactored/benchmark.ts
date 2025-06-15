/**
 * DocumentService Benchmark
 * 
 * Performance testing for DocumentService operations
 */

import { DocumentService } from './DocumentService';
import { SupabaseClientService } from '../supabase-client';
import { nodeLogger } from '../logger/logger-node';

async function benchmark() {
  console.log('🚀 Starting DocumentService benchmark...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  const service = new DocumentService(supabase, undefined, nodeLogger);
  
  try {
    // Initialize service
    console.log('📦 Initializing service...');
    const initStart = Date.now();
    await service['initialize']();
    console.log(`✓ Initialization: ${Date.now() - initStart}ms\n`);

    // Health check
    console.log('🏥 Running health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    console.log(`✓ Health check: ${Date.now() - healthStart}ms (healthy: ${health.healthy})\n`);

    // Get recent documents benchmark
    console.log('📄 Benchmarking getRecentDocuments...');
    const recentDocsResults = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const docs = await service.getRecentDocuments(20);
      const duration = Date.now() - start;
      recentDocsResults.push(duration);
      console.log(`  Run ${i + 1}: ${duration}ms (${docs.length} documents)`);
    }
    const avgRecentDocs = recentDocsResults.reduce((a, b) => a + b, 0) / recentDocsResults.length;
    console.log(`✓ Average getRecentDocuments: ${avgRecentDocs.toFixed(2)}ms\n`);

    // Get untyped documents benchmark
    console.log('📋 Benchmarking getUntypedDocuments...');
    const untypedDocsResults = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      const docs = await service.getUntypedDocuments(10);
      const duration = Date.now() - start;
      untypedDocsResults.push(duration);
      console.log(`  Run ${i + 1}: ${duration}ms (${docs.length} documents)`);
    }
    const avgUntypedDocs = untypedDocsResults.reduce((a, b) => a + b, 0) / untypedDocsResults.length;
    console.log(`✓ Average getUntypedDocuments: ${avgUntypedDocs.toFixed(2)}ms\n`);

    // Update document type benchmark (if documents exist)
    console.log('✏️  Benchmarking updateDocumentType...');
    const untypedDocs = await service.getUntypedDocuments(1);
    if (untypedDocs.length > 0) {
      const updateResults = [];
      const testDoc = untypedDocs[0];
      
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        await service.updateDocumentType(testDoc.id, 'test-type-id', { benchmark: true });
        const duration = Date.now() - start;
        updateResults.push(duration);
        console.log(`  Run ${i + 1}: ${duration}ms`);
        
        // Reset document type for next test
        await service.updateDocumentType(testDoc.id, '', {});
      }
      const avgUpdate = updateResults.reduce((a, b) => a + b, 0) / updateResults.length;
      console.log(`✓ Average updateDocumentType: ${avgUpdate.toFixed(2)}ms\n`);
    } else {
      console.log('  ⚠️  No untyped documents available for update benchmark\n');
    }

    // Final metrics
    console.log('📊 Final Service Metrics:');
    const metrics = service.getMetrics();
    console.log(`  Total Queries: ${metrics.totalQueries}`);
    console.log(`  Total Updates: ${metrics.totalUpdates}`);
    console.log(`  Error Count: ${metrics.errorCount}`);
    console.log(`  Last Query: ${metrics.lastQueryTime?.toISOString() || 'N/A'}`);
    console.log(`  Last Update: ${metrics.lastUpdateTime?.toISOString() || 'N/A'}`);
    
    console.log('\n✅ Benchmark completed successfully');
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