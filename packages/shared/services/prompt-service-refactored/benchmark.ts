/**
 * PromptService Performance Benchmark
 */

import { PromptService } from './PromptService';

async function benchmark() {
  console.log('Starting PromptService benchmark...');
  
  const promptService = PromptService.getInstance({
    environment: 'node',
    enableCaching: true,
    cacheTimeout: 60000
  });

  try {
    // Test initialization
    const initStart = Date.now();
    await promptService.initialize();
    const initTime = Date.now() - initStart;
    console.log(`✓ Initialization: ${initTime}ms`);

    // Test health check
    const healthStart = Date.now();
    const health = await promptService.healthCheck();
    const healthTime = Date.now() - healthStart;
    console.log(`✓ Health check: ${healthTime}ms (healthy: ${health.healthy})`);

    // Test prompt retrieval (uncached)
    const getStart = Date.now();
    const prompt = await promptService.getPromptByName('test-prompt');
    const getTime = Date.now() - getStart;
    console.log(`✓ Get prompt (uncached): ${getTime}ms (found: ${!!prompt})`);

    // Test prompt retrieval (cached)
    const getCachedStart = Date.now();
    const cachedPrompt = await promptService.getPromptByName('test-prompt');
    const getCachedTime = Date.now() - getCachedStart;
    console.log(`✓ Get prompt (cached): ${getCachedTime}ms (found: ${!!cachedPrompt})`);

    // Test loading prompt with relationships
    const loadStart = Date.now();
    const loadResult = await promptService.loadPrompt('test-prompt', {
      includeRelationships: true,
      includeRelatedFiles: true,
      includeOutputTemplates: true
    });
    const loadTime = Date.now() - loadStart;
    console.log(`✓ Load prompt with relationships: ${loadTime}ms`);

    // Test metrics
    const metrics = promptService.getMetrics();
    console.log('\n📊 Service Metrics:');
    console.log(`  Total prompts loaded: ${metrics.totalPromptsLoaded}`);
    console.log(`  Cache hits: ${metrics.cacheHits}`);
    console.log(`  Cache misses: ${metrics.cacheMisses}`);
    console.log(`  Average load time: ${metrics.averageLoadTime.toFixed(2)}ms`);
    console.log(`  Total relationships: ${metrics.totalRelationshipsLoaded}`);
    console.log(`  Total queries executed: ${metrics.totalQueriesExecuted}`);

    console.log('\n✅ PromptService benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    // Cleanup
    await promptService.shutdown();
  }
}

// Run benchmark if this file is executed directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };