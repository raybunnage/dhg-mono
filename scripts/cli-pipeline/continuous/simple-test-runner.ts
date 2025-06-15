#!/usr/bin/env ts-node

/**
 * Simple Test Runner - Phase 1
 * Philosophy: Just run what exists, measure what matters
 */

import { execSync } from 'child_process';
import * as glob from 'glob';
import * as path from 'path';

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  timestamp: Date;
}

class SimpleTestRunner {
  private summary: TestSummary = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    timestamp: new Date()
  };
  
  async run(): Promise<void> {
    const start = Date.now();
    
    console.log('🧪 Simple Test Runner - Phase 1\n');
    console.log('Philosophy: Measure what exists, learn what matters\n');
    
    // 1. Find test files
    const tests = this.findTests();
    console.log(`Found ${tests.total} test files:\n`);
    console.log(`  📦 Services: ${tests.services.length}`);
    console.log(`  🔧 Pipelines: ${tests.pipelines.length}`);
    console.log(`  🎯 Apps: ${tests.apps.length}\n`);
    
    // 2. Run pnpm test (simplest approach)
    await this.runPnpmTest();
    
    // 3. Do basic smoke tests on CLIs
    await this.smokeTestCLIs();
    
    // 4. Simple report
    this.summary.duration = Date.now() - start;
    this.generateReport();
  }
  
  private findTests() {
    return {
      services: glob.sync('packages/shared/services/**/*.test.{ts,js}'),
      pipelines: glob.sync('scripts/cli-pipeline/**/*.test.{ts,js}'),
      apps: glob.sync('apps/**/src/**/*.test.{ts,tsx,js,jsx}'),
      get total() { 
        return this.services.length + this.pipelines.length + this.apps.length;
      }
    };
  }
  
  private async runPnpmTest(): Promise<void> {
    console.log('Running pnpm test...\n');
    
    try {
      const output = execSync('pnpm run test', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      try {
        const results = JSON.parse(output);
        if (results.numTotalTests) {
          this.summary.total += results.numTotalTests;
          this.summary.passed += results.numPassedTests || 0;
          this.summary.failed += results.numFailedTests || 0;
          this.summary.skipped += results.numPendingTests || 0;
        }
      } catch (parseError) {
        // If JSON parse fails, just count as success
        console.log('✅ Tests passed (could not parse detailed results)');
        this.summary.passed += 1;
        this.summary.total += 1;
      }
    } catch (error: any) {
      // Check if it's a package manager conflict
      if (error.message?.includes('multiple package managers') || error.stdout?.includes('multiple package managers')) {
        console.log('⚠️ pnpm test skipped (package manager conflict)');
        console.log('Note: Remove package-lock.json to fix this issue');
        this.summary.skipped += 1;
        this.summary.total += 1;
      } else {
        console.log('❌ pnpm test failed');
        console.log(error.stdout?.substring(0, 500) || error.message);
        this.summary.failed += 1;
        this.summary.total += 1;
      }
    }
  }
  
  private async smokeTestCLIs(): Promise<void> {
    console.log('\n🔧 Smoke testing CLI scripts...\n');
    
    const cliScripts = glob.sync('scripts/cli-pipeline/**/*-cli.sh', {
      ignore: ['**/.*/**', '**/.archived_*/**', '**/tests/**']
    });
    console.log(`Found ${cliScripts.length} CLI scripts\n`);
    
    // Test first 5 to keep it quick
    const testScripts = cliScripts.slice(0, 5);
    
    for (const script of testScripts) {
      const name = path.basename(path.dirname(script));
      this.summary.total += 1;
      
      try {
        execSync(`${script} --help`, {
          timeout: 3000,
          stdio: 'pipe'
        });
        console.log(`  ✅ ${name}`);
        this.summary.passed += 1;
      } catch (error) {
        // Try "help" without dashes as fallback
        try {
          execSync(`${script} help`, {
            timeout: 3000,
            stdio: 'pipe'
          });
          console.log(`  ✅ ${name}`);
          this.summary.passed += 1;
        } catch (error2) {
          console.log(`  ❌ ${name} (help failed)`);
          this.summary.failed += 1;
        }
      }
    }
    
    if (cliScripts.length > 5) {
      console.log(`  ... and ${cliScripts.length - 5} more (skipped for speed)`);
    }
  }
  
  private generateReport(): void {
    const passRate = this.summary.total > 0 
      ? Math.round((this.summary.passed / this.summary.total) * 100)
      : 0;
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total:   ${this.summary.total}`);
    console.log(`✅ Pass: ${this.summary.passed} (${passRate}%)`);
    console.log(`❌ Fail: ${this.summary.failed}`);
    console.log(`⏭️  Skip: ${this.summary.skipped}`);
    console.log(`⏱️  Time: ${Math.round(this.summary.duration / 1000)}s`);
    console.log('='.repeat(50));
    
    // Simple health indicator
    if (passRate >= 90) {
      console.log('\n🟢 System Health: GOOD');
    } else if (passRate >= 70) {
      console.log('\n🟡 System Health: FAIR (needs attention)');
    } else {
      console.log('\n🔴 System Health: POOR (immediate action needed)');
    }
    
    // What we learned
    console.log('\n💡 Key Insights:');
    if (this.summary.failed > 0) {
      console.log(`- ${this.summary.failed} failing tests need investigation`);
    }
    if (this.summary.skipped > 10) {
      console.log(`- ${this.summary.skipped} skipped tests might be obsolete`);
    }
    if (this.summary.total < 50) {
      console.log('- Test coverage seems low, consider adding more tests');
    }
    
    // Save to simple JSON for trends
    this.saveResults();
  }
  
  private saveResults(): void {
    const fs = require('fs');
    const resultsFile = '.continuous/test-results.json';
    
    // Ensure directory exists
    if (!fs.existsSync('.continuous')) {
      fs.mkdirSync('.continuous');
    }
    
    // Load existing results
    let history: TestSummary[] = [];
    if (fs.existsSync(resultsFile)) {
      try {
        history = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
      } catch (e) {
        // Start fresh if corrupt
      }
    }
    
    // Add current results
    history.push(this.summary);
    
    // Keep last 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    history = history.filter(r => 
      new Date(r.timestamp).getTime() > thirtyDaysAgo
    );
    
    // Save
    fs.writeFileSync(resultsFile, JSON.stringify(history, null, 2));
    console.log(`\n📁 Results saved to ${resultsFile}`);
  }
}

// Run it
const runner = new SimpleTestRunner();
runner.run().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});