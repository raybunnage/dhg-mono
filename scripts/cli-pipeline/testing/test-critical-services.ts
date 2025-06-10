#!/usr/bin/env ts-node

/**
 * Test Critical Services (Phase 1)
 * Tests the 5 most critical services: SupabaseClient, File, Filter, GoogleDrive, Claude
 */

import { TestingService } from '../../../packages/shared/services/testing-service';

async function testCriticalServices() {
  console.log('🧪 Testing Critical Services (Phase 1)');
  console.log('Target services: SupabaseClient, File, Filter, GoogleDrive, Claude');
  console.log('Test types: Unit tests only\n');

  try {
    const testingService = TestingService.getInstance();

    // Get critical services
    const criticalServices = await testingService.getServicesForTesting('critical');
    
    if (criticalServices.length === 0) {
      console.log('⚠️  No critical services found in registry');
      console.log('This might mean the service registry needs to be populated');
      console.log('\nTrying to test the 5 expected critical services directly...\n');
      
      // Test the expected critical services directly
      const expectedServices = [
        'SupabaseClientService',
        'FileService', 
        'FilterService',
        'GoogleDriveService',
        'ClaudeService'
      ];

      let testedCount = 0;
      let passedCount = 0;

      for (const serviceName of expectedServices) {
        console.log(`\n🔍 Testing ${serviceName}...`);
        
        try {
          // Try to import and test the service
          const result = await testServiceDirectly(serviceName);
          testedCount++;
          
          if (result.success) {
            passedCount++;
            console.log(`  ✅ ${serviceName}: ${result.message}`);
          } else {
            console.log(`  ❌ ${serviceName}: ${result.message}`);
          }
        } catch (error) {
          testedCount++;
          console.log(`  ❌ ${serviceName}: Failed to test - ${error}`);
        }
      }

      console.log(`\n📊 Direct Testing Summary:`);
      console.log(`  Tested: ${testedCount}/5 services`);
      console.log(`  Passed: ${passedCount}/${testedCount}`);
      console.log(`  Success Rate: ${testedCount > 0 ? Math.round((passedCount / testedCount) * 100) : 0}%`);

      return;
    }

    console.log(`📋 Found ${criticalServices.length} critical services in registry\n`);

    // Run tests for critical services
    const results = [];
    let totalTime = 0;

    for (const serviceConfig of criticalServices) {
      console.log(`\n🧪 Testing ${serviceConfig.serviceName}...`);
      
      const startTime = Date.now();
      const result = await testingService.runServiceTests(serviceConfig);
      const endTime = Date.now();
      
      results.push(result);
      totalTime += (endTime - startTime);
      
      // Display result
      const status = result.overallStatus === 'passed' ? '✅' : 
                    result.overallStatus === 'partial' ? '⚠️' : '❌';
      
      console.log(`  ${status} ${result.serviceName}: ${result.overallStatus} (${result.executionTimeMs}ms)`);
      
      // Show individual test results
      if (result.results.length > 0) {
        result.results.forEach(testResult => {
          const testStatus = testResult.status === 'passed' ? '✅' : 
                           testResult.status === 'skipped' ? '⏭️' : '❌';
          console.log(`    ${testStatus} ${testResult.testType}: ${testResult.status}`);
          if (testResult.errorMessage) {
            console.log(`      Error: ${testResult.errorMessage}`);
          }
        });
      }
    }

    // Summary
    console.log(`\n📊 Critical Services Testing Summary:`);
    console.log(`  Total Services: ${results.length}`);
    console.log(`  Passed: ${results.filter(r => r.overallStatus === 'passed').length}`);
    console.log(`  Partial: ${results.filter(r => r.overallStatus === 'partial').length}`);
    console.log(`  Failed: ${results.filter(r => r.overallStatus === 'failed').length}`);
    console.log(`  Total Time: ${totalTime}ms`);
    console.log(`  Average Time: ${results.length > 0 ? Math.round(totalTime / results.length) : 0}ms per service`);

    const allPassed = results.every(r => r.overallStatus === 'passed');
    if (allPassed) {
      console.log('\n🎉 All critical services passed testing!');
    } else {
      console.log('\n⚠️  Some critical services need attention');
    }

    console.log('\nNext steps:');
    console.log('  1. Run: ./scripts/cli-pipeline/testing/testing-cli.sh health-report');
    console.log('  2. Review any failed tests and improve service implementations');

  } catch (error) {
    console.error('❌ Critical services testing failed:', error);
    process.exit(1);
  }
}

/**
 * Test a service directly by attempting to import and validate it
 */
async function testServiceDirectly(serviceName: string): Promise<{ success: boolean; message: string }> {
  try {
    // Map service names to their actual paths
    const servicePaths: Record<string, string> = {
      'SupabaseClientService': '../../../packages/shared/services/supabase-client/universal',
      'FileService': '../../../packages/shared/services/file-service',
      'FilterService': '../../../packages/shared/services/filter-service',
      'GoogleDriveService': '../../../packages/shared/services/google-drive',
      'ClaudeService': '../../../packages/shared/services/claude-service'
    };

    const servicePath = servicePaths[serviceName];
    if (!servicePath) {
      return { success: false, message: 'Unknown service path' };
    }

    // Try to import the service
    const serviceModule = await import(servicePath);
    
    if (!serviceModule) {
      return { success: false, message: 'Failed to import service module' };
    }

    // Basic validation tests
    let validationCount = 0;
    let validationPassed = 0;

    // Test 1: Module exports something
    validationCount++;
    if (typeof serviceModule === 'object' && serviceModule !== null) {
      validationPassed++;
    }

    // Test 2: For services with getInstance, test singleton pattern
    if (typeof serviceModule.getInstance === 'function') {
      validationCount++;
      try {
        const instance1 = serviceModule.getInstance();
        const instance2 = serviceModule.getInstance();
        if (instance1 === instance2) {
          validationPassed++;
        }
      } catch (err) {
        // Singleton test failed
      }
    }

    // Test 3: Check for expected exports
    const expectedExports = {
      'SupabaseClientService': ['supabase', 'getSupabaseClient'],
      'FileService': ['FileService'],
      'FilterService': ['FilterService'], 
      'GoogleDriveService': ['GoogleDriveService'],
      'ClaudeService': ['claudeService']
    };

    const expected = expectedExports[serviceName];
    if (expected) {
      validationCount++;
      const hasExpectedExports = expected.some(exportName => 
        serviceModule[exportName] !== undefined
      );
      if (hasExpectedExports) {
        validationPassed++;
      }
    }

    const successRate = validationCount > 0 ? (validationPassed / validationCount) : 0;
    
    if (successRate >= 0.8) {
      return { 
        success: true, 
        message: `Passed ${validationPassed}/${validationCount} validation tests` 
      };
    } else {
      return { 
        success: false, 
        message: `Only passed ${validationPassed}/${validationCount} validation tests` 
      };
    }

  } catch (error) {
    return { 
      success: false, 
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

if (require.main === module) {
  testCriticalServices();
}