#!/usr/bin/env ts-node

/**
 * Track scenario execution in the database
 * This utility is called by scenario scripts to record their execution
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface ExecutionTracker {
  scenarioId: string;
  parameters?: Record<string, any>;
  executedBy?: string;
  startTime: Date;
}

class ScenarioExecutionTracker {
  private supabase = SupabaseClientService.getInstance().getClient();
  private execution: ExecutionTracker | null = null;
  private executionId: string | null = null;

  async startExecution(scenarioId: string, parameters?: Record<string, any>): Promise<string> {
    this.execution = {
      scenarioId,
      parameters,
      executedBy: process.env.USER || 'unknown',
      startTime: new Date()
    };

    // Insert initial execution record
    const { data, error } = await this.supabase
      .from('sys_continuous_improvement_executions')
      .insert({
        scenario_id: scenarioId,
        executed_by: this.execution.executedBy,
        parameters: parameters || {},
        success: false // Will be updated on completion
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to track execution start:', error);
      throw error;
    }

    this.executionId = data.id;
    console.log(`📊 Tracking execution: ${this.executionId}`);
    
    return this.executionId;
  }

  async completeExecution(
    success: boolean, 
    outputSummary?: string, 
    changesMade?: Record<string, any>,
    errorMessage?: string
  ): Promise<void> {
    if (!this.execution || !this.executionId) {
      console.error('No active execution to complete');
      return;
    }

    const duration = Math.round((Date.now() - this.execution.startTime.getTime()) / 1000);

    const { error } = await this.supabase
      .from('sys_continuous_improvement_executions')
      .update({
        success,
        duration_seconds: duration,
        output_summary: outputSummary,
        changes_made: changesMade,
        error_message: errorMessage
      })
      .eq('id', this.executionId);

    if (error) {
      console.error('Failed to update execution status:', error);
    } else {
      console.log(`✅ Execution completed: ${success ? 'SUCCESS' : 'FAILED'} (${duration}s)`);
    }
  }

  async trackStepCompletion(stepNumber: number, success: boolean, details?: string): Promise<void> {
    // This could be extended to track individual step completions
    console.log(`  Step ${stepNumber}: ${success ? '✅' : '❌'} ${details || ''}`);
  }
}

// CLI interface for manual tracking
async function main() {
  const [command, ...args] = process.argv.slice(2);
  const tracker = new ScenarioExecutionTracker();

  try {
    switch (command) {
      case 'start':
        const [scenarioId, ...paramPairs] = args;
        const params: Record<string, any> = {};
        
        // Parse key=value pairs
        paramPairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) params[key] = value;
        });

        const id = await tracker.startExecution(scenarioId, params);
        console.log(id); // Output just the ID for script capture
        break;

      case 'complete':
        const [executionId, successStr, summary] = args;
        // This would need to be refactored to accept executionId
        console.log('Manual completion tracking not yet implemented');
        break;

      default:
        console.log('Usage:');
        console.log('  track-scenario-execution.ts start <scenario-id> [key=value ...]');
        console.log('  track-scenario-execution.ts complete <execution-id> <success> [summary]');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Export for use in scenario scripts
export { ScenarioExecutionTracker };

if (require.main === module) {
  main();
}