#!/usr/bin/env tsx

import { Command } from 'commander';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
// import { SupabaseClientService } from '../../../packages/shared/services/supabase-client.ts';

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
  console.log(chalk.yellow('⚠️ Database functionality temporarily disabled - working on import issues'));
  console.log(chalk.gray('Results shown above but not saved to database'));
  return;
  
  /* TODO: Fix SupabaseClient import issues and re-enable
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Create the monitoring run record
    const { data: runData, error: runError } = await supabase
      .from('sys_monitoring_runs')
      .insert({
        folder_path: result.folder,
        run_type: 'manual',
        status: 'completed',
        findings: result.findings,
        metrics: result.metrics,
        completed_at: new Date().toISOString(),
        created_by: process.env.USER || 'cli'
      })
      .select()
      .single();
    
    if (runError) {
      console.error(chalk.red('Failed to save monitoring run:'), runError);
      return;
    }
    
    console.log(chalk.green('✅ Results saved to database'));
    
    // Save individual findings for easier querying
    if (runData && runData.id) {
      const findingsToInsert = [];
      
      // Process each finding type
      for (const [findingType, items] of Object.entries(result.findings)) {
        if (Array.isArray(items)) {
          for (const item of items) {
            if (typeof item === 'string') {
              // Simple string findings (like newFiles, missingTests)
              findingsToInsert.push({
                run_id: runData.id,
                finding_type: findingType,
                severity: 'info',
                file_path: item,
                description: `${findingType}: ${item}`
              });
            } else if (typeof item === 'object') {
              // Complex findings with more details
              findingsToInsert.push({
                run_id: runData.id,
                finding_type: findingType,
                severity: 'warning',
                file_path: item.file,
                description: (item as any).reason || (item as any).functionality || (item as any).suggestion,
                suggestion: item.suggestion
              });
            }
          }
        }
      }
      
      if (findingsToInsert.length > 0) {
        const { error: findingsError } = await supabase
          .from('sys_monitoring_findings')
          .insert(findingsToInsert);
          
        if (findingsError) {
          console.error(chalk.yellow('Warning: Could not save individual findings:'), findingsError);
        }
      }
    }
    
    // Save metrics
    const metricsToInsert = Object.entries(result.metrics).map(([metric_type, metric_value]) => ({
      folder_path: result.folder,
      metric_type,
      metric_value: Number(metric_value),
      metadata: { timestamp: result.timestamp }
    }));
    
    const { error: metricsError } = await supabase
      .from('sys_monitoring_metrics')
      .insert(metricsToInsert);
      
    if (metricsError) {
      console.error(chalk.yellow('Warning: Could not save metrics:'), metricsError);
    }
    
  } catch (err) {
    console.error(chalk.red('Database error:'), err);
    console.log(chalk.yellow('⚠️  Results displayed but not saved to database'));
  }
  */
}

// Historical reporting functions
async function getHistoricalReport(folderPath: string, days: number = 7): Promise<void> {
  console.log(chalk.yellow('⚠️ Historical reporting temporarily disabled - working on import issues'));
  console.log(chalk.gray(`Would show history for ${folderPath} over last ${days} days`));
  return;
  
  /* TODO: Fix SupabaseClient import issues and re-enable
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get monitoring runs from the last N days
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const { data: runs, error: runsError } = await supabase
      .from('sys_monitoring_runs')
      .select('*')
      .eq('folder_path', folderPath)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });
      
    if (runsError) {
      console.error(chalk.red('Failed to fetch historical data:'), runsError);
      return;
    }
    
    if (!runs || runs.length === 0) {
      console.log(chalk.yellow('No historical data found for this folder'));
      return;
    }
    
    console.log(chalk.blue.bold(`\n📈 Historical Report for ${folderPath}`));
    console.log(chalk.gray(`Last ${days} days (${runs.length} runs)`));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Aggregate metrics over time
    const { data: metrics, error: metricsError } = await supabase
      .from('sys_monitoring_metrics')
      .select('metric_type, metric_value, recorded_at')
      .eq('folder_path', folderPath)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true });
      
    if (!metricsError && metrics) {
      // Group metrics by type
      const metricsByType: Record<string, number[]> = {};
      metrics.forEach(m => {
        if (!metricsByType[m.metric_type]) metricsByType[m.metric_type] = [];
        metricsByType[m.metric_type].push(Number(m.metric_value));
      });
      
      console.log(chalk.bold('\n📊 Metrics Summary:'));
      for (const [type, values] of Object.entries(metricsByType)) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        console.log(`  ${type}:`);
        console.log(`    Average: ${chalk.yellow(avg.toFixed(1))}`);
        console.log(`    Range: ${chalk.green(min)} - ${chalk.red(max)}`);
      }
    }
    
    // Get top finding types
    const { data: findings, error: findingsError } = await supabase
      .from('sys_monitoring_findings')
      .select('finding_type, severity')
      .in('run_id', runs.map(r => r.id));
      
    if (!findingsError && findings) {
      const findingCounts: Record<string, number> = {};
      findings.forEach(f => {
        findingCounts[f.finding_type] = (findingCounts[f.finding_type] || 0) + 1;
      });
      
      console.log(chalk.bold('\n🔍 Top Issues:'));
      Object.entries(findingCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${chalk.yellow(count)} occurrences`);
        });
    }
    
    console.log(chalk.gray('\n═'.repeat(60)));
    
  } catch (err) {
    console.error(chalk.red('Error generating historical report:'), err);
  }
  */
}

async function getTrendReport(folderPath: string): Promise<void> {
  console.log(chalk.yellow('⚠️ Trend reporting temporarily disabled - working on import issues'));
  console.log(chalk.gray(`Would show trends for ${folderPath} over last 30 days`));
  return;
  
  /* TODO: Fix SupabaseClient import issues and re-enable
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get metrics over the last 30 days grouped by day
    const { data: metrics, error } = await supabase
      .from('sys_monitoring_metrics')
      .select('*')
      .eq('folder_path', folderPath)
      .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('recorded_at', { ascending: true });
      
    if (error) {
      console.error(chalk.red('Failed to fetch trend data:'), error);
      return;
    }
    
    if (!metrics || metrics.length === 0) {
      console.log(chalk.yellow('No trend data available'));
      return;
    }
    
    console.log(chalk.blue.bold(`\n📊 Trend Report for ${folderPath}`));
    console.log(chalk.gray('Last 30 days'));
    console.log(chalk.gray('═'.repeat(60)));
    
    // Group by metric type and show trend
    const metricsByType: Record<string, Array<{date: string; value: number}>> = {};
    
    metrics.forEach(m => {
      const date = new Date(m.recorded_at).toLocaleDateString();
      if (!metricsByType[m.metric_type]) metricsByType[m.metric_type] = [];
      metricsByType[m.metric_type].push({ date, value: Number(m.metric_value) });
    });
    
    for (const [type, values] of Object.entries(metricsByType)) {
      console.log(chalk.bold(`\n${type}:`));
      
      // Calculate trend
      if (values.length >= 2) {
        const firstValue = values[0].value;
        const lastValue = values[values.length - 1].value;
        const change = lastValue - firstValue;
        const percentChange = (change / firstValue) * 100;
        
        const trendIcon = change > 0 ? '📈' : change < 0 ? '📉' : '➡️';
        const trendColor = type.includes('filesWithoutTests') ? 
          (change < 0 ? chalk.green : chalk.red) : 
          (change > 0 ? chalk.green : chalk.red);
          
        console.log(`  ${trendIcon} Trend: ${trendColor(percentChange.toFixed(1) + '%')}`);
        console.log(`  First: ${firstValue}, Latest: ${lastValue}`);
      }
    }
    
    console.log(chalk.gray('\n═'.repeat(60)));
    
  } catch (err) {
    console.error(chalk.red('Error generating trend report:'), err);
  }
  */
}

// Commands
program
  .name('folder-monitor')
  .description('Monitor folders for code quality and improvement opportunities');

program
  .command('quick <folder>')
  .description('Quick scan for last 24 hours')
  .action(async (folder: string) => {
    // Run scan with 24h default
    await program.parse(['', '', 'scan', folder, '--since', '1d']);
  });

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
  .command('report <folder>')
  .description('Generate detailed report with database save')
  .option('-s, --since <date>', 'Check for files modified since date', '7d')
  .option('--save', 'Save results to database', true)
  .action(async (folder: string, options: any) => {
    // Run scan with save option
    await program.parse(['', '', 'scan', folder, '--since', options.since || '7d', '--save']);
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

program
  .command('history <folder>')
  .description('Show historical monitoring data')
  .option('-d, --days <number>', 'Number of days to show', '7')
  .action(async (folder: string, options: any) => {
    const folderPath = path.resolve(folder);
    await getHistoricalReport(folderPath, parseInt(options.days));
  });

program
  .command('trends <folder>')
  .description('Show monitoring trends over time')
  .action(async (folder: string) => {
    const folderPath = path.resolve(folder);
    await getTrendReport(folderPath);
  });

program.parse(process.argv);