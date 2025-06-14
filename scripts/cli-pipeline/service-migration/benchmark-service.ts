#!/usr/bin/env ts-node

import { performance } from 'perf_hooks';

interface BenchmarkResult {
  serviceName: string;
  initTimeMs: number;
  memoryUsageMB: number;
  operationTimeMs: number;
  healthCheckTimeMs: number;
}

export async function benchmarkService(
  serviceName: string,
  getService: () => any,
  testOperation?: () => Promise<any>
): Promise<BenchmarkResult> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const memBefore = process.memoryUsage();
  const initStart = performance.now();

  // Initialize service
  const service = getService();
  
  // If service has async initialization, wait for it
  if (service.getClient || service.ensureInitialized) {
    await (service.getClient ? service.getClient() : service.ensureInitialized());
  }

  const initEnd = performance.now();
  const memAfter = process.memoryUsage();

  // Measure operation time
  let operationTimeMs = 0;
  if (testOperation) {
    const opStart = performance.now();
    await testOperation();
    operationTimeMs = performance.now() - opStart;
  }

  // Measure health check time if available
  let healthCheckTimeMs = 0;
  if (service.healthCheck || service.testConnection) {
    const healthStart = performance.now();
    await (service.healthCheck ? service.healthCheck() : service.testConnection());
    healthCheckTimeMs = performance.now() - healthStart;
  }

  const memoryUsageMB = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  const initTimeMs = initEnd - initStart;

  return {
    serviceName,
    initTimeMs: Math.round(initTimeMs * 100) / 100,
    memoryUsageMB: Math.round(memoryUsageMB * 100) / 100,
    operationTimeMs: Math.round(operationTimeMs * 100) / 100,
    healthCheckTimeMs: Math.round(healthCheckTimeMs * 100) / 100
  };
}

// Benchmark current SupabaseClientService
async function benchmarkCurrentSupabase() {
  console.log('🔬 Benchmarking current SupabaseClientService...\n');

  // Clear any cached instances
  const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
  
  const result = await benchmarkService(
    'SupabaseClientService (Current)',
    () => SupabaseClientService.getInstance(),
    async () => {
      const client = SupabaseClientService.getInstance().getClient();
      // Simple operation
      await client.from('sys_shared_services').select('service_name').limit(1);
    }
  );

  console.log('📊 Benchmark Results:');
  console.log(`   Service: ${result.serviceName}`);
  console.log(`   Initialization Time: ${result.initTimeMs}ms`);
  console.log(`   Memory Usage: ${result.memoryUsageMB}MB`);
  console.log(`   Operation Time: ${result.operationTimeMs}ms`);
  console.log(`   Health Check Time: ${result.healthCheckTimeMs}ms`);

  return result;
}

// Run if called directly
if (require.main === module) {
  benchmarkCurrentSupabase().catch(console.error);
}

export { benchmarkCurrentSupabase };