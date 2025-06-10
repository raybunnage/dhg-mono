#!/usr/bin/env node

/**
 * Test runner for all active shared services
 * Tests all 33 active services from sys_shared_services
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env.development') });

console.log('🧪 Running Tests for All Active Shared Services\n');

// All active services from sys_shared_services
const allActiveServices = [
  { name: 'AIProcessingService', dir: 'ai-processing-service' },
  { name: 'AudioService', dir: 'audio-service' },
  { name: 'AuthService', dir: 'auth-service' },
  { name: 'BatchDatabaseService', file: 'batch-database-service.ts' },
  { name: 'BatchProcessingService', file: 'batch-processing-service.ts' },
  { name: 'ClassifyService', file: 'classify-service.ts' },
  { name: 'ClaudeService', dir: 'claude-service' },
  { name: 'CLIRegistryService', dir: 'cli-registry-service' },
  { name: 'ClipboardService', dir: 'clipboard-service' },
  { name: 'CommandExecutionService', dir: 'command-execution-service' },
  { name: 'DatabaseMetadataService', dir: 'database-metadata-service' },
  { name: 'DatabaseService', dir: 'database-service' },
  { name: 'DevTaskService', dir: 'dev-task-service' },
  { name: 'DocumentTypeService', dir: 'document-type-service' },
  { name: 'ElementCatalogService', file: 'element-catalog-service.ts' },
  { name: 'ElementCriteriaService', file: 'element-criteria-service.ts' },
  { name: 'EnvConfigService', dir: 'env-config-service' },
  { name: 'FileService', dir: 'file-service' },
  { name: 'FileSystemService', file: 'file-system-service.ts' },
  { name: 'FilterService', dir: 'filter-service' },
  { name: 'FolderHierarchyService', file: 'folder-hierarchy-service.ts' },
  { name: 'FormatterService', dir: 'formatter-service' },
  { name: 'GoogleDriveExplorerService', dir: 'google-drive-explorer' },
  { name: 'GoogleDriveService', dir: 'google-drive' },
  { name: 'LightAuthEnhancedService', dir: 'light-auth-enhanced-service' },
  { name: 'MediaAnalyticsService', dir: 'media-analytics-service' },
  { name: 'MediaTrackingService', dir: 'media-tracking-service' },
  { name: 'PromptService', dir: 'prompt-service' },
  { name: 'SupabaseClientService', dir: 'supabase-client' },
  { name: 'SupabaseService', dir: 'supabase-service' },
  { name: 'TestingService', dir: 'testing-service' },
  { name: 'UserProfileService', dir: 'user-profile-service' },
  { name: 'WorkSummaryService', dir: 'work-summary-service' }
];

console.log(`Total services to test: ${allActiveServices.length}\n`);

// Track results
let passed = 0;
let failed = 0;
const results = [];
const categories = {
  critical: { total: 0, passed: 0 },
  important: { total: 0, passed: 0 },
  standard: { total: 0, passed: 0 }
};

// Critical services list
const criticalServices = ['SupabaseClientService', 'FileService', 'FilterService', 'GoogleDriveService', 'ClaudeService'];
const importantServices = ['AuthService', 'DatabaseService', 'DocumentTypeService', 'PromptService', 'BatchProcessingService'];

// Test each service
for (const service of allActiveServices) {
  const serviceName = service.name;
  console.log(`\n📋 Testing ${serviceName}...`);
  
  // Determine priority
  let priority = 'standard';
  if (criticalServices.includes(serviceName)) {
    priority = 'critical';
  } else if (importantServices.includes(serviceName)) {
    priority = 'important';
  }
  categories[priority].total++;
  
  try {
    let testsPassed = 0;
    let testsFailed = 0;
    const issues = [];
    
    // Test 1: Check if service exists
    let servicePath;
    if (service.dir) {
      servicePath = path.join(__dirname, '../../../packages/shared/services', service.dir);
    } else if (service.file) {
      servicePath = path.join(__dirname, '../../../packages/shared/services', service.file);
    }
    
    let exists = false;
    try {
      fs.accessSync(servicePath);
      exists = true;
      console.log('  ✅ Service location exists');
      testsPassed++;
    } catch {
      console.log('  ❌ Service location not found at:', servicePath);
      issues.push('Service location not found');
      testsFailed++;
    }
    
    // Test 2: Check for index file (for directories)
    if (exists && service.dir) {
      let hasIndex = false;
      const indexPath = path.join(servicePath, 'index.ts');
      const indexJsPath = path.join(servicePath, 'index.js');
      
      try {
        fs.accessSync(indexPath);
        hasIndex = true;
        console.log('  ✅ Index file exists');
        testsPassed++;
      } catch {
        try {
          fs.accessSync(indexJsPath);
          hasIndex = true;
          console.log('  ✅ JavaScript index file exists');
          testsPassed++;
        } catch {
          console.log('  ❌ No index file found');
          issues.push('Missing index file');
          testsFailed++;
        }
      }
    }
    
    // Test 3: Check main service file
    if (exists && service.dir) {
      const serviceFileName = service.dir + '.ts';
      const mainServicePath = path.join(servicePath, serviceFileName);
      
      try {
        fs.accessSync(mainServicePath);
        console.log('  ✅ Main service file exists');
        testsPassed++;
      } catch {
        console.log('  ⚠️  Main service file not found (may use different naming)');
        // Not a failure, just a warning
      }
    }
    
    // Overall result
    const serviceResult = {
      service: serviceName,
      priority,
      testsRun: testsPassed + testsFailed,
      testsPassed,
      testsFailed,
      issues
    };
    
    if (testsFailed === 0 && testsPassed > 0) {
      passed++;
      categories[priority].passed++;
      serviceResult.status = 'passed';
      console.log(`  ✅ ${serviceName} all tests passed (${testsPassed}/${testsPassed + testsFailed})`);
    } else {
      failed++;
      serviceResult.status = 'failed';
      console.log(`  ❌ ${serviceName} has issues (${testsPassed}/${testsPassed + testsFailed} tests passed)`);
    }
    
    results.push(serviceResult);
    
  } catch (error) {
    failed++;
    results.push({ 
      service: serviceName, 
      priority,
      status: 'error', 
      error: error.message 
    });
    console.log(`  ❌ Error testing ${serviceName}:`, error.message);
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary:');
console.log('='.repeat(60));
console.log(`Total services tested: ${allActiveServices.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success rate: ${((passed / allActiveServices.length) * 100).toFixed(1)}%`);

console.log('\n📈 By Priority:');
Object.entries(categories).forEach(([priority, stats]) => {
  const rate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0.0';
  console.log(`  ${priority.charAt(0).toUpperCase() + priority.slice(1)}: ${stats.passed}/${stats.total} (${rate}%)`);
});

console.log('\n🔍 Failed Services:');
results.filter(r => r.status === 'failed' || r.status === 'error').forEach(result => {
  console.log(`  ❌ ${result.service} (${result.priority})`);
  if (result.issues && result.issues.length > 0) {
    result.issues.forEach(issue => console.log(`     - ${issue}`));
  }
  if (result.error) {
    console.log(`     - Error: ${result.error}`);
  }
});

console.log('\n✅ Passed Services:');
results.filter(r => r.status === 'passed').forEach(result => {
  console.log(`  ✅ ${result.service} (${result.priority}) - ${result.testsPassed} tests passed`);
});

// Generate health report
console.log('\n📝 Health Report Summary:');
const healthStatus = passed / allActiveServices.length >= 0.8 ? 'healthy' : 
                    passed / allActiveServices.length >= 0.6 ? 'warning' : 'critical';
console.log(`Overall Health Status: ${healthStatus.toUpperCase()}`);

if (healthStatus === 'critical') {
  console.log('\n⚠️  CRITICAL: Less than 60% of services are passing tests');
  console.log('Immediate action required on failing services');
} else if (healthStatus === 'warning') {
  console.log('\n⚠️  WARNING: Between 60-80% of services are passing tests');
  console.log('Several services need attention');
} else {
  console.log('\n✅ HEALTHY: Over 80% of services are passing tests');
  console.log('System is in good health');
}

console.log('\n🏁 All services test run complete!');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);