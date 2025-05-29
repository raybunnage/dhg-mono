#!/usr/bin/env tsx

import { Command } from 'commander';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
// import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const program = new Command();

interface MonitoringResult {
  folder: string;
  timestamp: Date;
  findings: {
    newFiles: string[];
    potentialRefactoring: Array<{
      file: string;
      reason: string;
      suggestion: string;
    }>;
    missingTests: string[];
    sharedServiceOpportunities: Array<{
      file: string;
      functionality: string;
      suggestion: string;
    }>;
  };
  metrics: {
    totalFiles: number;
    filesWithoutTests: number;
    duplicatePatterns: number;
  };
}

async function checkForNewFiles(folderPath: string, since: Date): Promise<string[]> {
  const files = await glob(`${folderPath}/**/*.{ts,tsx,js,jsx}`, {
    ignore: ['**/node_modules/**', '**/.archived_scripts/**']
  });
  
  const newFiles: string[] = [];
  for (const file of files) {
    const stats = await fs.stat(file);
    if (stats.mtime > since) {
      newFiles.push(file);
    }
  }
  
  return newFiles;
}

async function checkForRefactoringOpportunities(folderPath: string): Promise<Array<{file: string; reason: string; suggestion: string}>> {
  const opportunities = [];
  const files = await glob(`${folderPath}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**']
  });
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    // Check for large files
    const lineCount = content.split('\n').length;
    if (lineCount > 300) {
      opportunities.push({
        file: path.relative(process.cwd(), file),
        reason: `File has ${lineCount} lines`,
        suggestion: 'Consider breaking into smaller modules'
      });
    }
    
    // Check for multiple exports (potential for service extraction)
    const exportMatches = content.match(/export\s+(function|const|class)/g);
    if (exportMatches && exportMatches.length > 5) {
      opportunities.push({
        file: path.relative(process.cwd(), file),
        reason: `File has ${exportMatches.length} exports`,
        suggestion: 'Consider extracting to shared services'
      });
    }
    
    // Check for direct Supabase client creation
    if (content.includes('createClient') && !file.includes('supabase-adapter')) {
      opportunities.push({
        file: path.relative(process.cwd(), file),
        reason: 'Direct Supabase client creation detected',
        suggestion: 'Use SupabaseClientService.getInstance().getClient() or createSupabaseAdapter()'
      });
    }
    
    // Check for console.log statements
    const consoleCount = (content.match(/console\.log/g) || []).length;
    if (consoleCount > 3) {
      opportunities.push({
        file: path.relative(process.cwd(), file),
        reason: `File has ${consoleCount} console.log statements`,
        suggestion: 'Consider using proper logging service'
      });
    }
  }
  
  return opportunities;
}

async function checkForMissingTests(folderPath: string): Promise<string[]> {
  const sourceFiles = await glob(`${folderPath}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
  });
  
  const missingTests: string[] = [];
  
  for (const file of sourceFiles) {
    const testFile = file.replace(/\.(ts|tsx)$/, '.test.$1');
    const specFile = file.replace(/\.(ts|tsx)$/, '.spec.$1');
    
    try {
      await fs.access(testFile);
    } catch {
      try {
        await fs.access(specFile);
      } catch {
        missingTests.push(path.relative(process.cwd(), file));
      }
    }
  }
  
  return missingTests;
}

async function checkForSharedServiceOpportunities(folderPath: string): Promise<Array<{file: string; functionality: string; suggestion: string}>> {
  const opportunities = [];
  const files = await glob(`${folderPath}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**']
  });
  
  const functionPatterns = {
    'API calls': /fetch\(|axios\./,
    'Date formatting': /new Date\(.*\)\.(toLocaleDateString|toISOString)/,
    'Error handling': /try\s*{[\s\S]*?}\s*catch/,
    'Validation': /if\s*\(.*\.(length|match|test|includes)/,
    'Data transformation': /\.map\(|\.reduce\(|\.filter\(/
  };
  
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    
    for (const [functionality, pattern] of Object.entries(functionPatterns)) {
      const matches = content.match(pattern);
      if (matches && matches.length > 2) {
        opportunities.push({
          file: path.relative(process.cwd(), file),
          functionality,
          suggestion: `Extract ${functionality} logic to shared service (${matches.length} occurrences)`
        });
      }
    }
  }
  
  return opportunities;
}

async function generateReport(result: MonitoringResult): Promise<void> {
  console.log(chalk.blue.bold(`\n📊 Monitoring Report for ${result.folder}`));
  console.log(chalk.gray(`Generated at: ${result.timestamp.toLocaleString()}`));
  console.log(chalk.gray('═'.repeat(60)));
  
  // New Files
  if (result.findings.newFiles.length > 0) {
    console.log(chalk.yellow.bold('\n🆕 New Files:'));
    result.findings.newFiles.forEach(file => {
      console.log(`  • ${file}`);
    });
  }
  
  // Refactoring Opportunities
  if (result.findings.potentialRefactoring.length > 0) {
    console.log(chalk.magenta.bold('\n🔧 Refactoring Opportunities:'));
    result.findings.potentialRefactoring.forEach(item => {
      console.log(`  • ${chalk.cyan(item.file)}`);
      console.log(`    Reason: ${item.reason}`);
      console.log(`    Suggestion: ${chalk.green(item.suggestion)}`);
    });
  }
  
  // Missing Tests
  if (result.findings.missingTests.length > 0) {
    console.log(chalk.red.bold('\n🧪 Files Missing Tests:'));
    result.findings.missingTests.slice(0, 10).forEach(file => {
      console.log(`  • ${file}`);
    });
    if (result.findings.missingTests.length > 10) {
      console.log(`  ... and ${result.findings.missingTests.length - 10} more`);
    }
  }
  
  // Shared Service Opportunities
  if (result.findings.sharedServiceOpportunities.length > 0) {
    console.log(chalk.blue.bold('\n🔄 Shared Service Opportunities:'));
    result.findings.sharedServiceOpportunities.forEach(item => {
      console.log(`  • ${chalk.cyan(item.file)}`);
      console.log(`    Functionality: ${item.functionality}`);
      console.log(`    ${chalk.green(item.suggestion)}`);
    });
  }
  
  // Summary Metrics
  console.log(chalk.gray.bold('\n📈 Summary Metrics:'));
  console.log(`  Total files analyzed: ${result.metrics.totalFiles}`);
  console.log(`  Files without tests: ${result.metrics.filesWithoutTests}`);
  console.log(`  Test coverage: ${Math.round((1 - result.metrics.filesWithoutTests / result.metrics.totalFiles) * 100)}%`);
  
  console.log(chalk.gray('\n═'.repeat(60)));
}

async function saveResultToDatabase(result: MonitoringResult): Promise<void> {
  // TODO: Re-enable database saving once supabase-adapter is available
  console.log(chalk.gray('(Database logging will be available in next iteration)'));
  
  // try {
  //   const supabase = SupabaseClientService.getInstance().getClient();
  //   const { error } = await supabase
  //     .from('monitoring_runs')
  //     .insert({
  //       folder_path: result.folder,
  //       run_type: 'full_scan',
  //       status: 'completed',
  //       findings: result.findings,
  //       completed_at: new Date().toISOString()
  //     });
  //   
  //   if (error) {
  //     console.error('Failed to save monitoring results:', error);
  //   }
  // } catch (err) {
  //   // Table might not exist yet, that's okay
  //   console.log(chalk.gray('(Database logging not available)'));
  // }
}

// Commands
program
  .name('folder-monitor')
  .description('Monitor folders for code quality and improvement opportunities');

program
  .command('scan <folder>')
  .description('Scan a folder for monitoring insights')
  .option('-s, --since <date>', 'Check for files modified since date', '7d')
  .option('--save', 'Save results to database')
  .action(async (folder: string, options: any) => {
    const folderPath = path.resolve(folder);
    
    // Calculate since date
    const since = new Date();
    if (options.since.endsWith('d')) {
      const days = parseInt(options.since);
      since.setDate(since.getDate() - days);
    }
    
    console.log(chalk.blue(`🔍 Scanning ${folderPath}...`));
    
    const result: MonitoringResult = {
      folder: folderPath,
      timestamp: new Date(),
      findings: {
        newFiles: await checkForNewFiles(folderPath, since),
        potentialRefactoring: await checkForRefactoringOpportunities(folderPath),
        missingTests: await checkForMissingTests(folderPath),
        sharedServiceOpportunities: await checkForSharedServiceOpportunities(folderPath)
      },
      metrics: {
        totalFiles: 0,
        filesWithoutTests: 0,
        duplicatePatterns: 0
      }
    };
    
    // Calculate metrics
    const allFiles = await glob(`${folderPath}/**/*.{ts,tsx}`, {
      ignore: ['**/node_modules/**']
    });
    result.metrics.totalFiles = allFiles.length;
    result.metrics.filesWithoutTests = result.findings.missingTests.length;
    
    await generateReport(result);
    
    if (options.save) {
      await saveResultToDatabase(result);
    }
  });

program
  .command('watch <folder>')
  .description('Continuously monitor a folder')
  .option('-i, --interval <minutes>', 'Check interval in minutes', '30')
  .action(async (folder: string, options: any) => {
    console.log(chalk.green(`👁️  Starting continuous monitoring of ${folder}`));
    console.log(chalk.gray(`Checking every ${options.interval} minutes...`));
    
    // Initial scan
    await program.parse(['', '', 'scan', folder]);
    
    // Set up interval
    setInterval(async () => {
      console.log(chalk.gray(`\n⏰ Running scheduled check at ${new Date().toLocaleTimeString()}`));
      await program.parse(['', '', 'scan', folder]);
    }, parseInt(options.interval) * 60 * 1000);
  });

program.parse(process.argv);