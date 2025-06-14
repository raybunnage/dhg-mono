#!/usr/bin/env node

/**
 * Simple coverage test for shared services
 * Run with: c8 node packages/shared/services/simple-coverage-test.js
 */

const path = require('path');

async function testServices() {
  console.log('🧪 Testing Shared Services for Coverage\n');
  
  const tests = [];
  
  // Test SupabaseClientService
  try {
    console.log('📋 Testing SupabaseClientService...');
    const { SupabaseClientService } = require('./supabase-client/universal/index.js');
    const instance = SupabaseClientService.getInstance();
    console.log('  ✅ SupabaseClientService loaded and getInstance() works');
    tests.push({ name: 'SupabaseClientService', passed: true });
  } catch (error) {
    console.log('  ❌ SupabaseClientService failed:', error.message);
    tests.push({ name: 'SupabaseClientService', passed: false, error: error.message });
  }
  
  // Test EnvConfigService
  try {
    console.log('\n📋 Testing EnvConfigService...');
    const { EnvConfigService } = require('./env-config-service/env-config-service.js');
    const config = EnvConfigService.getInstance();
    console.log('  ✅ EnvConfigService loaded and getInstance() works');
    tests.push({ name: 'EnvConfigService', passed: true });
  } catch (error) {
    console.log('  ❌ EnvConfigService failed:', error.message);
    tests.push({ name: 'EnvConfigService', passed: false, error: error.message });
  }
  
  // Test FormatterService
  try {
    console.log('\n📋 Testing FormatterService...');
    const { FormatterService } = require('./formatter-service/formatter-service.js');
    const formatter = new FormatterService();
    const formatted = formatter.formatJSON({ test: true });
    console.log('  ✅ FormatterService loaded and formatJSON() works');
    tests.push({ name: 'FormatterService', passed: true });
  } catch (error) {
    console.log('  ❌ FormatterService failed:', error.message);
    tests.push({ name: 'FormatterService', passed: false, error: error.message });
  }
  
  // Summary
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Coverage Test Summary:');
  console.log('='.repeat(60));
  console.log(`Total services tested: ${tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }
  
  console.log('\n💡 Note: This test only covers JavaScript services.');
  console.log('   TypeScript services require compilation for full coverage.');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Check if any JS files exist
const fs = require('fs');
const servicesDir = __dirname;
const jsFiles = [];

fs.readdirSync(servicesDir).forEach(dir => {
  const dirPath = path.join(servicesDir, dir);
  if (fs.statSync(dirPath).isDirectory() && !dir.startsWith('.')) {
    fs.readdirSync(dirPath).forEach(file => {
      if (file.endsWith('.js') && !file.includes('test')) {
        jsFiles.push(path.join(dir, file));
      }
    });
  }
});

console.log(`Found ${jsFiles.length} JavaScript files in services\n`);

if (jsFiles.length === 0) {
  console.log('⚠️  No JavaScript files found. All services are TypeScript.');
  console.log('   For TypeScript coverage, use: c8 npm test');
  process.exit(0);
}

// Run tests
testServices().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});