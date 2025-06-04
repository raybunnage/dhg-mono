import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Database } from '../../../../supabase/types';

interface PromptStatsOptions {
  limit?: number;
  sortBy?: 'executions' | 'avg-time' | 'avg-tokens' | 'last-used';
  showRecent?: boolean;
  format?: 'table' | 'json';
}

interface PromptStats {
  name: string;
  executionCount: number;
  avgExecutionTime?: number;
  avgTokens?: number;
  lastExecutedAt?: string;
  successRate?: number;
  totalCost?: number;
}

export async function promptStatsCommand(options: PromptStatsOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient() as SupabaseClient<Database>;

  try {
    // Fetch prompts with execution stats
    const { data: prompts, error: promptError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('status', 'active')
      .gt('execution_count', 0)
      .order('execution_count', { ascending: false });

    if (promptError) {
      console.error('❌ Error fetching prompts:', promptError.message);
      process.exit(1);
    }

    if (!prompts || prompts.length === 0) {
      console.log('⚠️  No prompts with execution history found');
      return;
    }

    // Get recent execution details if requested
    let recentExecutions: any[] = [];
    if (options.showRecent) {
      const { data, error } = await supabase
        .from('ai_prompt_executions_simple')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        recentExecutions = data;
      }
    }

    // Calculate stats
    const stats: PromptStats[] = prompts.map(prompt => {
      // Calculate success rate from recent executions
      let successRate = 100;
      if (recentExecutions.length > 0) {
        const promptExecutions = recentExecutions.filter(e => e.prompt_id === prompt.id);
        if (promptExecutions.length > 0) {
          const successCount = promptExecutions.filter(e => e.success).length;
          successRate = Math.round((successCount / promptExecutions.length) * 100);
        }
      }

      // Estimate total cost (rough estimation based on Claude pricing)
      const totalTokens = (prompt.avg_tokens || 0) * (prompt.execution_count || 0);
      const totalCost = totalTokens * 0.00001; // Example rate

      return {
        name: prompt.name,
        executionCount: prompt.execution_count || 0,
        avgExecutionTime: prompt.avg_execution_time_ms,
        avgTokens: prompt.avg_tokens,
        lastExecutedAt: prompt.last_executed_at,
        successRate,
        totalCost: Math.round(totalCost * 100) / 100,
      };
    });

    // Sort based on option
    switch (options.sortBy) {
      case 'avg-time':
        stats.sort((a, b) => (a.avgExecutionTime || 0) - (b.avgExecutionTime || 0));
        break;
      case 'avg-tokens':
        stats.sort((a, b) => (b.avgTokens || 0) - (a.avgTokens || 0));
        break;
      case 'last-used':
        stats.sort((a, b) => {
          const aTime = a.lastExecutedAt ? new Date(a.lastExecutedAt).getTime() : 0;
          const bTime = b.lastExecutedAt ? new Date(b.lastExecutedAt).getTime() : 0;
          return bTime - aTime;
        });
        break;
      default: // executions
        stats.sort((a, b) => b.executionCount - a.executionCount);
    }

    // Apply limit
    const displayStats = options.limit ? stats.slice(0, options.limit) : stats;

    // Display results
    if (options.format === 'json') {
      console.log(JSON.stringify(displayStats, null, 2));
    } else {
      console.log('\n📊 Prompt Execution Statistics');
      console.log('═'.repeat(120));
      console.log(
        'Prompt Name'.padEnd(40) +
        'Executions'.padEnd(12) +
        'Avg Time'.padEnd(12) +
        'Avg Tokens'.padEnd(12) +
        'Success %'.padEnd(10) +
        'Est. Cost'.padEnd(10) +
        'Last Used'
      );
      console.log('─'.repeat(120));

      displayStats.forEach(stat => {
        const avgTime = stat.avgExecutionTime 
          ? `${stat.avgExecutionTime}ms` 
          : 'N/A';
        const avgTokens = stat.avgTokens?.toString() || 'N/A';
        const lastUsed = stat.lastExecutedAt 
          ? new Date(stat.lastExecutedAt).toLocaleString()
          : 'Never';
        const cost = stat.totalCost ? `$${stat.totalCost.toFixed(2)}` : '$0.00';

        console.log(
          stat.name.substring(0, 39).padEnd(40) +
          stat.executionCount.toString().padEnd(12) +
          avgTime.padEnd(12) +
          avgTokens.padEnd(12) +
          `${stat.successRate}%`.padEnd(10) +
          cost.padEnd(10) +
          lastUsed
        );
      });
      console.log('═'.repeat(120));

      // Summary stats
      const totalExecutions = stats.reduce((sum, s) => sum + s.executionCount, 0);
      const totalCost = stats.reduce((sum, s) => sum + s.totalCost, 0);
      const avgSuccessRate = Math.round(
        stats.reduce((sum, s) => sum + s.successRate, 0) / stats.length
      );

      console.log('\n📈 Summary:');
      console.log(`   Total Prompts: ${stats.length}`);
      console.log(`   Total Executions: ${totalExecutions}`);
      console.log(`   Average Success Rate: ${avgSuccessRate}%`);
      console.log(`   Estimated Total Cost: $${totalCost.toFixed(2)}`);
    }

    // Show recent failures if requested
    if (options.showRecent && recentExecutions.length > 0) {
      const recentFailures = recentExecutions
        .filter(e => !e.success)
        .slice(0, 5);

      if (recentFailures.length > 0) {
        console.log('\n⚠️  Recent Failures:');
        console.log('─'.repeat(80));
        recentFailures.forEach(failure => {
          const prompt = prompts.find(p => p.id === failure.prompt_id);
          console.log(`   ${new Date(failure.created_at).toLocaleString()}`);
          console.log(`   Prompt: ${prompt?.name || 'Unknown'}`);
          console.log(`   Error: ${failure.error_message || 'No error message'}`);
          console.log('─'.repeat(80));
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}