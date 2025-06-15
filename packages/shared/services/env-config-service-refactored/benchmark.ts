/**
 * EnvConfigService Benchmark
 * 
 * Performance testing for EnvConfigService operations
 */

import { EnvConfigService } from './EnvConfigService';

async function benchmark() {
  console.log('🚀 Starting EnvConfigService benchmark...\n');
  
  const service = EnvConfigService.getInstance();
  
  try {
    // Health check
    console.log('🏥 Running health check...');
    const healthStart = Date.now();
    const health = await service.healthCheck();
    console.log(`✓ Health check: ${Date.now() - healthStart}ms (healthy: ${health.healthy})\n`);

    // Get operations benchmark
    console.log('📖 Benchmarking get operations...');
    const getResults = [];
    const testKeys = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY', 
      'CLAUDE_API_KEY',
      'APP_ENV',
      'MISSING_KEY'
    ] as const;
    
    for (let i = 0; i < 1000; i++) {
      const start = Date.now();
      for (const key of testKeys) {
        service.get(key);
      }
      const duration = Date.now() - start;
      getResults.push(duration);
    }
    const avgGet = getResults.reduce((a, b) => a + b, 0) / getResults.length;
    console.log(`✓ Average get (5 keys x 1000 iterations): ${avgGet.toFixed(3)}ms\n`);

    // GetAll benchmark
    console.log('📚 Benchmarking getAll...');
    const getAllResults = [];
    for (let i = 0; i < 1000; i++) {
      const start = Date.now();
      service.getAll();
      const duration = Date.now() - start;
      getAllResults.push(duration);
    }
    const avgGetAll = getAllResults.reduce((a, b) => a + b, 0) / getAllResults.length;
    console.log(`✓ Average getAll (1000 iterations): ${avgGetAll.toFixed(3)}ms\n`);

    // Feature flag checking benchmark
    console.log('🚩 Benchmarking feature flag operations...');
    const flagResults = [];
    const testFlags = ['feature1', 'feature2', 'nonexistent'];
    
    for (let i = 0; i < 1000; i++) {
      const start = Date.now();
      service.getFeatureFlags();
      for (const flag of testFlags) {
        service.hasFeatureFlag(flag);
      }
      const duration = Date.now() - start;
      flagResults.push(duration);
    }
    const avgFlag = flagResults.reduce((a, b) => a + b, 0) / flagResults.length;
    console.log(`✓ Average feature flag check (1000 iterations): ${avgFlag.toFixed(3)}ms\n`);

    // API key validation benchmark
    console.log('🔑 Benchmarking API key validation...');
    const validationResults = [];
    const testKeys = [
      'valid_api_key_1234567890',
      'short',
      undefined,
      'your-api-key-here-12345',
      'another_valid_key_with_longer_content'
    ];
    
    for (let i = 0; i < 1000; i++) {
      const start = Date.now();
      for (const key of testKeys) {
        service.validateApiKey(key);
      }
      const duration = Date.now() - start;
      validationResults.push(duration);
    }
    const avgValidation = validationResults.reduce((a, b) => a + b, 0) / validationResults.length;
    console.log(`✓ Average validation (5 keys x 1000 iterations): ${avgValidation.toFixed(3)}ms\n`);

    // Diagnostics benchmark
    console.log('🔍 Benchmarking diagnostics...');
    const diagResults = [];
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      service.getDiagnostics();
      const duration = Date.now() - start;
      diagResults.push(duration);
    }
    const avgDiag = diagResults.reduce((a, b) => a + b, 0) / diagResults.length;
    console.log(`✓ Average diagnostics (100 iterations): ${avgDiag.toFixed(3)}ms\n`);

    // Memory usage
    console.log('💾 Memory usage:');
    const metrics = service.getMetrics();
    const configSize = JSON.stringify(service.getAll()).length;
    console.log(`  Config size: ~${(configSize / 1024).toFixed(2)}KB`);
    console.log(`  Missing keys tracked: ${metrics.missingKeys.length}`);
    console.log(`  Total gets: ${metrics.totalGets}`);
    console.log(`  Total validations: ${metrics.totalValidations}\n`);

    // Summary
    console.log('📊 Performance Summary:');
    console.log(`  Single get operation: ~${(avgGet / 5000).toFixed(6)}ms`);
    console.log(`  GetAll operation: ~${(avgGetAll / 1000).toFixed(6)}ms`);
    console.log(`  Feature flag check: ~${(avgFlag / 1000).toFixed(6)}ms`);
    console.log(`  API key validation: ~${(avgValidation / 5000).toFixed(6)}ms`);
    console.log(`  Full diagnostics: ~${(avgDiag / 100).toFixed(4)}ms`);
    
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