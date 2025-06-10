#!/usr/bin/env ts-node

/**
 * Coverage test for shared services
 * Run with: c8 ts-node packages/shared/services/coverage-test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import critical services to test
async function testCriticalServices() {
  console.log('🧪 Testing Critical Services with Coverage\n');
  
  const criticalTests = [
    {
      name: 'SupabaseClientService',
      test: async () => {
        const { SupabaseClientService } = await import('./supabase-client');
        const instance = SupabaseClientService.getInstance();
        console.log('✅ SupabaseClientService singleton works');
        
        // Test getClient method
        const client = instance.getClient();
        console.log('✅ SupabaseClientService.getClient() works');
        
        return true;
      }
    },
    {
      name: 'ClaudeService',
      test: async () => {
        const { claudeService } = await import('./claude-service/claude-service');
        console.log('✅ ClaudeService imported successfully');
        
        // Test that it's a singleton
        if (claudeService && typeof claudeService === 'object') {
          console.log('✅ ClaudeService singleton exists');
        }
        
        return true;
      }
    },
    {
      name: 'FileService',
      test: async () => {
        const { FileService } = await import('./file-service');
        const instance = FileService.getInstance();
        console.log('✅ FileService singleton works');
        
        // Test a simple method
        const testPath = './test-file.txt';
        const exists = await instance.exists(testPath);
        console.log(`✅ FileService.exists() works (test file exists: ${exists})`);
        
        return true;
      }
    },
    {
      name: 'FilterService',
      test: async () => {
        const { FilterService } = await import('./filter-service');
        console.log('✅ FilterService imported successfully');
        
        // Test instantiation (requires supabase client)
        const { SupabaseClientService } = await import('./supabase-client');
        const supabase = SupabaseClientService.getInstance().getClient();
        const filterService = new FilterService(supabase);
        console.log('✅ FilterService instantiation works');
        
        return true;
      }
    },
    {
      name: 'DatabaseService',
      test: async () => {
        const { DatabaseService } = await import('./database-service');
        const instance = DatabaseService.getInstance();
        console.log('✅ DatabaseService singleton works');
        
        // Test connection check
        const isConnected = await instance.checkConnection();
        console.log(`✅ DatabaseService.checkConnection() works (connected: ${isConnected})`);
        
        return true;
      }
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of criticalTests) {
    console.log(`\n📋 Testing ${name}...`);
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ ${name} failed:`, error.message);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log('='.repeat(60));
  console.log(`Total tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
testCriticalServices().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});