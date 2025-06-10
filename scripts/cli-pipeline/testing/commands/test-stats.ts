#!/usr/bin/env ts-node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { glob } from 'glob';

const program = new Command();

program
  .name('test-stats')
  .description('Show test statistics across the monorepo')
  .option('--app <name>', 'Filter by specific app')
  .option('--json', 'Output as JSON')
  .parse(process.argv);

const options = program.opts();

interface TestStats {
  app: string;
  testFiles: number;
  testSuites: number;
  tests: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
  };
}

async function getTestFiles(appPath: string): Promise<string[]> {
  const patterns = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
  ];
  
  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { 
      cwd: appPath,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });
    files.push(...matches);
  }
  
  return files;
}

async function countTestsInFile(filePath: string): Promise<{ suites: number; tests: number }> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Count describe blocks (test suites)
    const describeMatches = content.match(/describe\s*\(/g) || [];
    const suites = describeMatches.length;
    
    // Count it/test blocks
    const itMatches = content.match(/(?:it|test)\s*\(/g) || [];
    const tests = itMatches.length;
    
    return { suites, tests };
  } catch {
    return { suites: 0, tests: 0 };
  }
}

async function getAppStats(appName: string, appPath: string): Promise<TestStats> {
  const testFiles = await getTestFiles(appPath);
  
  let totalSuites = 0;
  let totalTests = 0;
  
  for (const file of testFiles) {
    const filePath = path.join(appPath, file);
    const { suites, tests } = await countTestsInFile(filePath);
    totalSuites += suites;
    totalTests += tests;
  }
  
  // Try to read coverage data if available
  const coveragePath = path.join(appPath, 'coverage', 'coverage-summary.json');
  let coverage;
  
  try {
    const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf-8'));
    coverage = {
      lines: coverageData.total.lines.pct,
      functions: coverageData.total.functions.pct,
      branches: coverageData.total.branches.pct,
    };
  } catch {
    // No coverage data available
  }
  
  return {
    app: appName,
    testFiles: testFiles.length,
    testSuites: totalSuites,
    tests: totalTests,
    coverage,
  };
}

async function collectStats() {
  const appsDir = path.join(process.cwd(), 'apps');
  const apps = await fs.readdir(appsDir);
  
  const stats: TestStats[] = [];
  
  for (const app of apps) {
    // Skip hidden directories and archives
    if (app.startsWith('.')) continue;
    
    // Filter by app if specified
    if (options.app && app !== options.app) continue;
    
    const appPath = path.join(appsDir, app);
    const stat = await fs.stat(appPath);
    
    if (stat.isDirectory()) {
      const appStats = await getAppStats(app, appPath);
      stats.push(appStats);
    }
  }
  
  return stats;
}

function displayStats(stats: TestStats[]) {
  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }
  
  console.log(chalk.bold('\n📊 Test Statistics\n'));
  
  // Summary
  const totalFiles = stats.reduce((sum, s) => sum + s.testFiles, 0);
  const totalSuites = stats.reduce((sum, s) => sum + s.testSuites, 0);
  const totalTests = stats.reduce((sum, s) => sum + s.tests, 0);
  
  console.log(chalk.cyan('Overall Summary:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`Total Apps with Tests: ${chalk.white(stats.filter(s => s.testFiles > 0).length)}`);
  console.log(`Total Test Files: ${chalk.white(totalFiles)}`);
  console.log(`Total Test Suites: ${chalk.white(totalSuites)}`);
  console.log(`Total Tests: ${chalk.white(totalTests)}`);
  console.log();
  
  // Per-app stats
  console.log(chalk.cyan('Per-App Breakdown:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  // Sort by number of tests
  const sortedStats = [...stats].sort((a, b) => b.tests - a.tests);
  
  for (const stat of sortedStats) {
    const hasTests = stat.testFiles > 0;
    const color = hasTests ? chalk.green : chalk.red;
    
    console.log(color(`\n${stat.app}:`));
    
    if (hasTests) {
      console.log(`  Test Files: ${stat.testFiles}`);
      console.log(`  Test Suites: ${stat.testSuites}`);
      console.log(`  Tests: ${stat.tests}`);
      
      if (stat.coverage) {
        console.log(chalk.yellow('  Coverage:'));
        console.log(`    Lines: ${formatCoverage(stat.coverage.lines)}%`);
        console.log(`    Functions: ${formatCoverage(stat.coverage.functions)}%`);
        console.log(`    Branches: ${formatCoverage(stat.coverage.branches)}%`);
      } else {
        console.log(chalk.gray('  Coverage: No data available'));
      }
    } else {
      console.log(chalk.gray('  No tests found'));
    }
  }
  
  // Recommendations
  console.log(chalk.cyan('\n\n💡 Recommendations:'));
  console.log(chalk.gray('─'.repeat(50)));
  
  const appsWithoutTests = stats.filter(s => s.testFiles === 0);
  if (appsWithoutTests.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Apps without tests (${appsWithoutTests.length}):`));
    appsWithoutTests.forEach(app => {
      console.log(`   - ${app.app}`);
    });
    console.log(chalk.gray(`   Run: ./testing-cli.sh init --app <name>`));
  }
  
  const appsWithLowTests = stats.filter(s => s.testFiles > 0 && s.tests < 10);
  if (appsWithLowTests.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Apps with few tests (<10):`));
    appsWithLowTests.forEach(app => {
      console.log(`   - ${app.app} (${app.tests} tests)`);
    });
  }
  
  const appsWithoutCoverage = stats.filter(s => s.testFiles > 0 && !s.coverage);
  if (appsWithoutCoverage.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Apps without coverage data:`));
    appsWithoutCoverage.forEach(app => {
      console.log(`   - ${app.app}`);
    });
    console.log(chalk.gray(`   Run: pnpm test:coverage in each app`));
  }
}

function formatCoverage(value: number): string {
  if (value >= 80) return chalk.green(value.toFixed(1));
  if (value >= 60) return chalk.yellow(value.toFixed(1));
  return chalk.red(value.toFixed(1));
}

// Run stats collection
collectStats()
  .then(displayStats)
  .catch(console.error);