/**
 * AuthService Performance Benchmark
 */

import { AuthService } from './AuthService.js';

async function benchmark() {
  console.log('Starting AuthService benchmark...');
  
  const authService = AuthService.getInstance({
    environment: 'cli',
    enableAuditLogging: false
  });

  try {
    // Test health check (this will trigger initialization)
    const healthStart = Date.now();
    const health = await authService.healthCheck();
    const healthTime = Date.now() - healthStart;
    console.log(`✓ Health check: ${healthTime}ms (healthy: ${health.healthy})`);

    // Test metrics
    const metrics = authService.getMetrics();
    console.log(`✓ Metrics retrieved:`, metrics);

    // Test session operations (without actual auth)
    const sessionStart = Date.now();
    const session = await authService.getSession();
    const sessionTime = Date.now() - sessionStart;
    console.log(`✓ Get session: ${sessionTime}ms (session: ${!!session})`);

    console.log('\n✅ AuthService benchmark completed successfully');
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
  } finally {
    // Cleanup
    await authService.shutdown();
  }
}

// Run benchmark if this file is executed directly
if (require.main === module) {
  benchmark().catch(console.error);
}

export { benchmark };