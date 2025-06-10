#!/usr/bin/env ts-node

/**
 * Validate Single Service
 * Test a specific service in detail
 */

import { TestingService } from '../../../packages/shared/services/testing-service';

async function validateSingleService() {
  const serviceName = process.argv[2];
  
  if (!serviceName) {
    console.error('❌ Error: Service name required');
    console.error('Usage: ts-node validate-single-service.ts <service-name>');
    console.error('Example: ts-node validate-single-service.ts SupabaseClientService');
    process.exit(1);
  }

  console.log(`🔍 Validating Service: ${serviceName}\n`);

  try {
    const testingService = TestingService.getInstance();

    // Get all services to find the one we want
    const allServices = await testingService.getServicesForTesting();
    const targetService = allServices.find(s => 
      s.serviceName === serviceName ||
      s.serviceName.toLowerCase() === serviceName.toLowerCase() ||
      s.serviceName.includes(serviceName)
    );

    if (!targetService) {
      console.log(`⚠️  Service '${serviceName}' not found in registry`);
      console.log('\nAvailable services:');
      allServices.forEach(service => {
        console.log(`  - ${service.serviceName} (${service.priority})`);
      });
      
      console.log('\nTrying direct validation anyway...\n');
      
      // Try direct validation
      const directResult = await validateServiceDirectly(serviceName);
      if (directResult.success) {
        console.log(`✅ Direct validation passed: ${directResult.message}`);
      } else {
        console.log(`❌ Direct validation failed: ${directResult.message}`);
      }
      return;
    }

    console.log(`📋 Service Configuration:`);
    console.log(`  Name: ${targetService.serviceName}`);
    console.log(`  Priority: ${targetService.priority}`);
    console.log(`  Test Types: ${targetService.testTypes.join(', ')}`);
    console.log(`  Timeout: ${targetService.timeoutMs}ms`);
    console.log(`  Dependencies: ${targetService.dependencies.length > 0 ? targetService.dependencies.join(', ') : 'None'}`);
    console.log(`  Mock Requirements: ${targetService.mockRequirements.length > 0 ? targetService.mockRequirements.join(', ') : 'None'}\n`);

    // Run the test
    console.log(`🧪 Running tests for ${targetService.serviceName}...\n`);
    
    const startTime = Date.now();
    const result = await testingService.runServiceTests(targetService);
    const endTime = Date.now();

    // Display detailed results
    console.log(`📊 Test Results:`);
    console.log(`  Overall Status: ${result.overallStatus}`);
    console.log(`  Execution Time: ${result.executionTimeMs}ms`);
    console.log(`  Total Duration: ${endTime - startTime}ms\n`);

    console.log(`📝 Individual Test Results:`);
    result.results.forEach((testResult, index) => {
      const status = testResult.status === 'passed' ? '✅' : 
                    testResult.status === 'skipped' ? '⏭️' : '❌';
      
      console.log(`  ${index + 1}. ${status} ${testResult.testType.toUpperCase()} Test`);
      console.log(`     Status: ${testResult.status}`);
      console.log(`     Time: ${testResult.executionTimeMs}ms`);
      
      if (testResult.errorMessage) {
        console.log(`     Error: ${testResult.errorMessage}`);
      }
      
      if (testResult.testDetails && Object.keys(testResult.testDetails).length > 0) {
        console.log(`     Details:`);
        Object.entries(testResult.testDetails).forEach(([key, value]) => {
          console.log(`       ${key}: ${value}`);
        });
      }
      console.log('');
    });

    // Performance analysis
    if (result.executionTimeMs > 2000) {
      console.log(`⚠️  Performance Warning: Test took ${result.executionTimeMs}ms (>2000ms threshold)`);
      console.log(`   Consider optimizing service or test implementation\n`);
    } else {
      console.log(`✅ Performance: Test completed within acceptable time\n`);
    }

    // Coverage information
    if (result.coverage) {
      console.log(`📈 Coverage Information:`);
      console.log(`  Lines: ${result.coverage.lines}%`);
      console.log(`  Functions: ${result.coverage.functions}%`);
      console.log(`  Branches: ${result.coverage.branches}%\n`);
    }

    // Summary and recommendations
    console.log(`🎯 Summary:`);
    if (result.overallStatus === 'passed') {
      console.log(`  ✅ ${targetService.serviceName} is working correctly`);
      console.log(`  🎉 All tests passed successfully`);
    } else if (result.overallStatus === 'partial') {
      console.log(`  ⚠️  ${targetService.serviceName} has some issues`);
      console.log(`  📝 Some tests passed, others failed or were skipped`);
    } else {
      console.log(`  ❌ ${targetService.serviceName} has significant issues`);
      console.log(`  🔧 Requires attention and fixes`);
    }

    const failedTests = result.results.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      console.log(`\n🔧 Failed Tests to Address:`);
      failedTests.forEach(test => {
        console.log(`  - ${test.testType}: ${test.errorMessage || 'Unknown error'}`);
      });
    }

    const skippedTests = result.results.filter(r => r.status === 'skipped');
    if (skippedTests.length > 0) {
      console.log(`\n⏭️  Skipped Tests (for future implementation):`);
      skippedTests.forEach(test => {
        console.log(`  - ${test.testType}: ${test.testDetails?.reason || 'Not implemented'}`);
      });
    }

  } catch (error) {
    console.error(`❌ Service validation failed: ${error}`);
    process.exit(1);
  }
}

/**
 * Validate a service directly without registry
 */
async function validateServiceDirectly(serviceName: string): Promise<{ success: boolean; message: string }> {
  try {
    // Map common service names to paths
    const servicePaths: Record<string, string> = {
      'SupabaseClientService': '../../../packages/shared/services/supabase-client/universal',
      'supabase-client': '../../../packages/shared/services/supabase-client/universal',
      'FileService': '../../../packages/shared/services/file-service',
      'file-service': '../../../packages/shared/services/file-service',
      'FilterService': '../../../packages/shared/services/filter-service',
      'filter-service': '../../../packages/shared/services/filter-service',
      'GoogleDriveService': '../../../packages/shared/services/google-drive',
      'google-drive': '../../../packages/shared/services/google-drive',
      'ClaudeService': '../../../packages/shared/services/claude-service',
      'claude-service': '../../../packages/shared/services/claude-service'
    };

    let servicePath = servicePaths[serviceName] || servicePaths[serviceName.toLowerCase()];
    
    if (!servicePath) {
      // Try to construct path from service name
      const pathName = serviceName.toLowerCase()
        .replace(/service$/, '')
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
      servicePath = `../../../packages/shared/services/${pathName}`;
    }

    const serviceModule = await import(servicePath);
    
    // Run basic validation
    let checks = 0;
    let passed = 0;

    // Check 1: Module exports
    checks++;
    if (serviceModule && typeof serviceModule === 'object') {
      passed++;
    }

    // Check 2: Singleton pattern (if applicable)
    if (typeof serviceModule.getInstance === 'function') {
      checks++;
      try {
        const instance1 = serviceModule.getInstance();
        const instance2 = serviceModule.getInstance();
        if (instance1 === instance2) {
          passed++;
        }
      } catch (err) {
        // Singleton test failed
      }
    }

    return {
      success: passed >= checks * 0.8,
      message: `Direct validation: ${passed}/${checks} checks passed`
    };

  } catch (error) {
    return {
      success: false,
      message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

if (require.main === module) {
  validateSingleService();
}