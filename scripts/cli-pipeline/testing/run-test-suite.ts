#!/usr/bin/env ts-node

/**
 * Run Test Suite (Phase 2)
 * Orchestrates comprehensive testing with priority filtering
 */

import { TestingService } from '../../../packages/shared/services/testing-service';

async function runTestSuite() {
  const priority = process.argv[2] as 'critical' | 'important' | 'standard' | undefined;
  
  console.log(`🏃 Running Test Suite${priority ? ` (${priority} priority)` : ' (all services)'}`);
  console.log('⚠️  This is a Phase 2 feature - enhanced implementation coming soon\n');

  try {
    const testingService = TestingService.getInstance();

    // Run the test suite
    console.log('🚀 Executing test suite...\n');
    
    const startTime = Date.now();
    const results = await testingService.runTestSuite(priority);
    const endTime = Date.now();

    // Display comprehensive results
    console.log(`📊 Test Suite Results:`);
    console.log(`  Services Tested: ${results.totalServices}`);
    console.log(`  ✅ Passed: ${results.passedServices}`);
    console.log(`  ❌ Failed: ${results.failedServices}`);
    console.log(`  ⏱️  Total Time: ${results.totalExecutionTimeMs}ms (${Math.round(results.totalExecutionTimeMs/1000)}s)`);
    console.log(`  🎯 Average Time: ${results.totalServices > 0 ? Math.round(results.totalExecutionTimeMs / results.totalServices) : 0}ms per service\n`);

    // Critical services health
    console.log(`🔴 Critical Services Health:`);
    console.log(`  Passed: ${results.summary.criticalServicesPassed}/${results.summary.criticalServicesTotal}`);
    console.log(`  Status: ${results.summary.overallHealthStatus}\n`);

    // Performance analysis
    if (results.totalExecutionTimeMs < 30000) {
      console.log(`⚡ Performance: EXCELLENT - Under 30s target`);
    } else if (results.totalExecutionTimeMs < 60000) {
      console.log(`⚠️  Performance: ACCEPTABLE - Over 30s but under 60s`);
    } else {
      console.log(`❌ Performance: POOR - Over 60s, optimization required`);
    }

    // Service breakdown
    if (results.serviceResults.length > 0) {
      console.log(`\n📋 Service Results Breakdown:`);
      
      // Group by status
      const passed = results.serviceResults.filter(r => r.overallStatus === 'passed');
      const partial = results.serviceResults.filter(r => r.overallStatus === 'partial');
      const failed = results.serviceResults.filter(r => r.overallStatus === 'failed');

      if (passed.length > 0) {
        console.log(`\n✅ Passed Services (${passed.length}):`);
        passed.forEach(result => {
          console.log(`  - ${result.serviceName} (${result.executionTimeMs}ms)`);
        });
      }

      if (partial.length > 0) {
        console.log(`\n⚠️  Partial Services (${partial.length}):`);
        partial.forEach(result => {
          console.log(`  - ${result.serviceName} (${result.executionTimeMs}ms)`);
          result.results.filter(r => r.status === 'failed').forEach(test => {
            console.log(`    ❌ ${test.testType}: ${test.errorMessage || 'Unknown error'}`);
          });
        });
      }

      if (failed.length > 0) {
        console.log(`\n❌ Failed Services (${failed.length}):`);
        failed.forEach(result => {
          console.log(`  - ${result.serviceName} (${result.executionTimeMs}ms)`);
          result.results.forEach(test => {
            if (test.status === 'failed') {
              console.log(`    ❌ ${test.testType}: ${test.errorMessage || 'Unknown error'}`);
            }
          });
        });
      }
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    
    if (results.summary.overallHealthStatus === 'healthy') {
      console.log(`  🎉 All critical services are healthy!`);
      console.log(`  - Consider implementing Phase 3 features (UI integration)`);
      console.log(`  - Set up automated testing in CI/CD pipeline`);
    } else if (results.summary.overallHealthStatus === 'warning') {
      console.log(`  ⚠️  Some critical services need attention`);
      console.log(`  - Fix failing critical services immediately`);
      console.log(`  - Review and improve test coverage`);
    } else {
      console.log(`  🚨 Critical services are failing - immediate action required`);
      console.log(`  - Stop deploying until critical services are fixed`);
      console.log(`  - Review service implementations and dependencies`);
    }

    if (results.totalExecutionTimeMs > 30000) {
      console.log(`  ⚡ Optimize test performance to meet 30s target`);
    }

    console.log(`\n🚀 Phase 2 Features Coming Soon:`);
    console.log(`  - Integration tests between services`);
    console.log(`  - Contract testing for API stability`);
    console.log(`  - Performance benchmarking and trends`);
    console.log(`  - Automated regression detection`);
    console.log(`  - Test result history and analytics`);

    // Exit with appropriate code
    const exitCode = results.summary.overallHealthStatus === 'critical' ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ Test suite execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite();
}