#!/usr/bin/env ts-node

/**
 * Priority Pipeline Test Runner
 * 
 * Tests the most critical and frequently used CLI pipelines.
 * Start with these before expanding to all pipelines.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface PipelineTestResult {
  pipeline: string;
  priority: number;
  testsRun: string[];
  passed: number;
  failed: number;
  duration: number;
  status: 'passed' | 'failed' | 'partial';
}

// Priority pipelines based on criticality and usage
const PRIORITY_PIPELINES = [
  { name: 'database', priority: 1, description: 'Core database operations' },
  { name: 'dev_tasks', priority: 1, description: 'Development workflow management' },
  { name: 'google_sync', priority: 1, description: 'Google Drive synchronization' },
  { name: 'document', priority: 1, description: 'Document processing and classification' },
  { name: 'ai', priority: 1, description: 'AI processing and Claude integration' },
  { name: 'auth', priority: 2, description: 'Authentication and user management' },
  { name: 'monitoring', priority: 2, description: 'System monitoring and health checks' },
  { name: 'deployment', priority: 2, description: 'Build and deployment operations' },
  { name: 'servers', priority: 2, description: 'Server management' },
  { name: 'work_summaries', priority: 2, description: 'Work tracking and summaries' },
  { name: 'docs', priority: 3, description: 'Documentation management' },
  { name: 'scripts', priority: 3, description: 'Script execution and management' },
  { name: 'media_processing', priority: 3, description: 'Audio/video processing' },
  { name: 'email', priority: 3, description: 'Email processing and extraction' },
  { name: 'presentations', priority: 3, description: 'Presentation processing' }
];

class PriorityPipelineTester {
  private supabase = SupabaseClientService.getInstance().getClient();
  private testingRoot = path.join(__dirname, '../');
  
  /**
   * Test all priority pipelines
   */
  async testAllPriority(maxPriority: number = 1): Promise<PipelineTestResult[]> {
    console.log('🚀 DHG CLI Pipeline Priority Testing');
    console.log('=' . repeat(60));
    console.log(`Testing pipelines with priority <= ${maxPriority}\n`);
    
    const results: PipelineTestResult[] = [];
    const pipelinesToTest = PRIORITY_PIPELINES.filter(p => p.priority <= maxPriority);
    
    for (const pipeline of pipelinesToTest) {
      try {
        const result = await this.testPipeline(pipeline);
        results.push(result);
        this.printPipelineResult(result);
      } catch (error) {
        console.error(`❌ Failed to test ${pipeline.name}:`, error);
        results.push({
          pipeline: pipeline.name,
          priority: pipeline.priority,
          testsRun: [],
          passed: 0,
          failed: 1,
          duration: 0,
          status: 'failed'
        });
      }
    }
    
    this.printOverallSummary(results);
    await this.saveResults(results);
    
    return results;
  }
  
  /**
   * Test a single pipeline
   */
  private async testPipeline(pipeline: {name: string, priority: number}): Promise<PipelineTestResult> {
    console.log(`\n🧪 Testing ${pipeline.name} pipeline...`);
    const startTime = Date.now();
    
    const testsRun: string[] = [];
    let passed = 0;
    let failed = 0;
    
    // Test 1: Command existence
    try {
      console.log('  📋 Running command existence test...');
      const existenceResult = await this.runCommandExistenceTest(pipeline.name);
      testsRun.push('command-existence');
      if (existenceResult.success) passed++; else failed++;
    } catch (error) {
      console.error('    ❌ Command existence test failed:', error);
      testsRun.push('command-existence');
      failed++;
    }
    
    // Test 2: Help output
    try {
      console.log('  📋 Running help output test...');
      const helpResult = await this.runHelpTest(pipeline.name);
      testsRun.push('help-output');
      if (helpResult.success) passed++; else failed++;
    } catch (error) {
      console.error('    ❌ Help output test failed:', error);
      testsRun.push('help-output');
      failed++;
    }
    
    // Test 3: Basic command execution (top 3 commands)
    try {
      console.log('  📋 Running basic command tests...');
      const commandResults = await this.runBasicCommandTests(pipeline.name);
      testsRun.push('basic-commands');
      passed += commandResults.passed;
      failed += commandResults.failed;
    } catch (error) {
      console.error('    ❌ Basic command tests failed:', error);
      testsRun.push('basic-commands');
      failed++;
    }
    
    const duration = Date.now() - startTime;
    const status = failed === 0 ? 'passed' : passed > 0 ? 'partial' : 'failed';
    
    return {
      pipeline: pipeline.name,
      priority: pipeline.priority,
      testsRun,
      passed,
      failed,
      duration,
      status
    };
  }
  
  /**
   * Run command existence test
   */
  private async runCommandExistenceTest(pipelineName: string): Promise<{success: boolean}> {
    const testScript = path.join(this.testingRoot, 'commands/test-command-existence.ts');
    
    try {
      execSync(`ts-node ${testScript} ${pipelineName}`, {
        cwd: this.testingRoot,
        stdio: 'pipe'
      });
      console.log('    ✅ Command existence test passed');
      return { success: true };
    } catch (error: any) {
      if (error.status === 1) {
        console.log('    ⚠️  Command existence test had issues');
      } else {
        console.log('    ❌ Command existence test failed');
      }
      return { success: false };
    }
  }
  
  /**
   * Run help output test
   */
  private async runHelpTest(pipelineName: string): Promise<{success: boolean}> {
    const cliPath = path.join(__dirname, '../../../', pipelineName, `${pipelineName}-cli.sh`);
    
    try {
      const output = execSync(`${cliPath} --help`, {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      // Validate help output
      if (output.includes('Usage:') || output.includes('USAGE:')) {
        console.log('    ✅ Help output test passed');
        return { success: true };
      } else {
        console.log('    ⚠️  Help output missing usage section');
        return { success: false };
      }
    } catch (error: any) {
      // Some CLIs exit with non-zero on help
      if (error.stdout && (error.stdout.includes('Usage:') || error.stdout.includes('USAGE:'))) {
        console.log('    ✅ Help output test passed (non-zero exit)');
        return { success: true };
      }
      console.log('    ❌ Help output test failed');
      return { success: false };
    }
  }
  
  /**
   * Run basic command tests
   */
  private async runBasicCommandTests(pipelineName: string): Promise<{passed: number, failed: number}> {
    // Get most used commands for this pipeline from database
    const { data: commands } = await this.supabase
      .from('command_definitions')
      .select('command_name, usage_count')
      .eq('pipeline_name', pipelineName)
      .order('usage_count', { ascending: false })
      .limit(3);
    
    if (!commands || commands.length === 0) {
      console.log('    ℹ️  No usage data available, skipping basic command tests');
      return { passed: 0, failed: 0 };
    }
    
    let passed = 0;
    let failed = 0;
    
    for (const cmd of commands) {
      try {
        console.log(`    🔍 Testing command: ${cmd.command_name}`);
        // For now, just test if command has help
        const cliPath = path.join(__dirname, '../../../', pipelineName, `${pipelineName}-cli.sh`);
        execSync(`${cliPath} ${cmd.command_name} --help`, {
          stdio: 'pipe'
        });
        console.log(`      ✅ ${cmd.command_name} help works`);
        passed++;
      } catch (error) {
        console.log(`      ❌ ${cmd.command_name} help failed`);
        failed++;
      }
    }
    
    return { passed, failed };
  }
  
  /**
   * Print pipeline test result
   */
  private printPipelineResult(result: PipelineTestResult): void {
    const icon = result.status === 'passed' ? '✅' : 
                 result.status === 'partial' ? '⚠️' : '❌';
    
    console.log(`\n${icon} ${result.pipeline} - ${result.status.toUpperCase()}`);
    console.log(`   Tests: ${result.passed} passed, ${result.failed} failed`);
    console.log(`   Duration: ${result.duration}ms`);
  }
  
  /**
   * Print overall summary
   */
  private printOverallSummary(results: PipelineTestResult[]): void {
    console.log('\n' + '=' . repeat(60));
    console.log('📊 Overall Test Summary');
    console.log('=' . repeat(60));
    
    const totalPipelines = results.length;
    const passed = results.filter(r => r.status === 'passed').length;
    const partial = results.filter(r => r.status === 'partial').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`Total Pipelines Tested: ${totalPipelines}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`⚠️  Partial: ${partial}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / totalPipelines) * 100).toFixed(1)}%`);
    
    // Priority breakdown
    for (let priority = 1; priority <= 3; priority++) {
      const priorityResults = results.filter(r => r.priority === priority);
      if (priorityResults.length > 0) {
        const priorityPassed = priorityResults.filter(r => r.status === 'passed').length;
        console.log(`\nPriority ${priority}: ${priorityPassed}/${priorityResults.length} passed`);
      }
    }
  }
  
  /**
   * Save results to database
   */
  private async saveResults(results: PipelineTestResult[]): Promise<void> {
    console.log('\n💾 Saving results to database...');
    
    try {
      for (const result of results) {
        // Get pipeline ID
        const { data: pipeline } = await this.supabase
          .from('command_pipelines')
          .select('id')
          .eq('name', result.pipeline)
          .single();
        
        if (pipeline) {
          // Update pipeline test status
          await this.supabase
            .from('command_pipelines')
            .update({
              test_status: result.status,
              last_test_run: new Date().toISOString(),
              metadata: {
                ...(pipeline.metadata || {}),
                last_test_summary: {
                  passed: result.passed,
                  failed: result.failed,
                  duration: result.duration,
                  tests_run: result.testsRun
                }
              }
            })
            .eq('id', pipeline.id);
        }
      }
      
      console.log('✅ Results saved successfully');
    } catch (error) {
      console.error('❌ Failed to save results:', error);
    }
  }
}

// Main execution
async function main() {
  const tester = new PriorityPipelineTester();
  const maxPriority = process.argv[2] ? parseInt(process.argv[2]) : 1;
  
  console.log('🏁 Starting priority pipeline tests...\n');
  
  try {
    const results = await tester.testAllPriority(maxPriority);
    const allPassed = results.every(r => r.status === 'passed');
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('Test runner failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}