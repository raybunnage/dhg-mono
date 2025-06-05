#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface CommandStats {
  command_name: string;
  total_count: number;
  success_count: number;
  error_count: number;
  success_rate: number;
  avg_duration_ms: number;
  min_duration_ms: number;
  max_duration_ms: number;
  last_execution: string;
  common_entities: string[];
  common_errors: string[];
}

interface CommandPattern {
  command_sequence: string[];
  occurrence_count: number;
}

async function analyzeGoogleSyncCommandUsage() {
  const supabase = SupabaseClientService.getInstance().getClient();

  console.log('🔍 Analyzing Google Sync Command Usage Patterns\n');

  try {
    // 1. Get overall statistics for all google_sync commands
    const { data: commandStats, error: statsError } = await supabase
      .from('command_tracking')
      .select('*')
      .eq('pipeline_name', 'google_sync')
      .order('created_at', { ascending: false });

    if (statsError) {
      console.error('Error fetching command stats:', statsError);
      throw statsError;
    }

    if (!commandStats || commandStats.length === 0) {
      console.log('No google_sync commands found in tracking data.');
      return;
    }

    // Process command statistics
    const commandMap = new Map<string, any[]>();
    
    commandStats.forEach(cmd => {
      const cmdList = commandMap.get(cmd.command_name) || [];
      cmdList.push(cmd);
      commandMap.set(cmd.command_name, cmdList);
    });

    // Calculate statistics for each command
    const statistics: CommandStats[] = [];
    
    for (const [cmdName, cmdData] of commandMap.entries()) {
      const successCount = cmdData.filter(c => c.status === 'success').length;
      const errorCount = cmdData.filter(c => c.status === 'error').length;
      const durations = cmdData.filter(c => c.duration_ms !== null).map(c => c.duration_ms);
      
      // Get unique entities and errors
      const entities = cmdData
        .filter(c => c.affected_entity)
        .map(c => c.affected_entity)
        .reduce((acc: { [key: string]: number }, entity) => {
          acc[entity] = (acc[entity] || 0) + 1;
          return acc;
        }, {});
      
      const errors = cmdData
        .filter(c => c.error_message)
        .map(c => c.error_message)
        .reduce((acc: { [key: string]: number }, error) => {
          acc[error] = (acc[error] || 0) + 1;
          return acc;
        }, {});
      
      const topEntities = Object.entries(entities)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([entity]) => entity);
      
      const topErrors = Object.entries(errors)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([error]) => error);

      statistics.push({
        command_name: cmdName,
        total_count: cmdData.length,
        success_count: successCount,
        error_count: errorCount,
        success_rate: cmdData.length > 0 ? (successCount / cmdData.length) * 100 : 0,
        avg_duration_ms: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        min_duration_ms: durations.length > 0 ? Math.min(...durations) : 0,
        max_duration_ms: durations.length > 0 ? Math.max(...durations) : 0,
        last_execution: cmdData[0]?.execution_time || '',
        common_entities: topEntities,
        common_errors: topErrors
      });
    }

    // Sort by usage count
    statistics.sort((a, b) => b.total_count - a.total_count);

    // Display overall summary
    console.log('📊 Overall Google Sync Command Usage Summary');
    console.log('=' .repeat(80));
    console.log(`Total Commands Tracked: ${commandStats.length}`);
    console.log(`Unique Commands: ${statistics.length}`);
    console.log(`Date Range: ${commandStats[commandStats.length - 1]?.execution_time} to ${commandStats[0]?.execution_time}`);
    console.log();

    // Display command statistics table
    console.log('📈 Command Usage Statistics (Ordered by Usage Count)');
    console.log('=' .repeat(120));
    console.log('Command'.padEnd(30) + 
                'Uses'.padEnd(8) + 
                'Success'.padEnd(10) + 
                'Errors'.padEnd(8) + 
                'Success%'.padEnd(10) + 
                'Avg Time'.padEnd(12) + 
                'Last Used');
    console.log('-'.repeat(120));

    statistics.forEach(stat => {
      const avgTime = stat.avg_duration_ms > 0 ? `${(stat.avg_duration_ms / 1000).toFixed(2)}s` : 'N/A';
      const lastUsed = new Date(stat.last_execution).toLocaleString();
      
      console.log(
        stat.command_name.padEnd(30) +
        stat.total_count.toString().padEnd(8) +
        stat.success_count.toString().padEnd(10) +
        stat.error_count.toString().padEnd(8) +
        `${stat.success_rate.toFixed(1)}%`.padEnd(10) +
        avgTime.padEnd(12) +
        lastUsed
      );
    });

    // Display commonly used commands (marked with * in help)
    const commonCommands = ['sync', 'find-folder', 'check-duplicates', 'analyze-folders', 'validate-structure'];
    const commonStats = statistics.filter(s => commonCommands.includes(s.command_name));
    
    if (commonStats.length > 0) {
      console.log('\n🌟 Commonly Used Commands (marked with * in help)');
      console.log('=' .repeat(80));
      
      commonStats.forEach(stat => {
        console.log(`\n📌 ${stat.command_name}`);
        console.log(`   Total Uses: ${stat.total_count}`);
        console.log(`   Success Rate: ${stat.success_rate.toFixed(1)}%`);
        console.log(`   Average Duration: ${(stat.avg_duration_ms / 1000).toFixed(2)}s`);
        
        if (stat.common_entities.length > 0) {
          console.log(`   Common Entities: ${stat.common_entities.join(', ')}`);
        }
        
        if (stat.common_errors.length > 0) {
          console.log(`   Common Errors:`);
          stat.common_errors.forEach(err => {
            console.log(`     - ${err.substring(0, 80)}${err.length > 80 ? '...' : ''}`);
          });
        }
      });
    }

    // Analyze command sequences/patterns
    console.log('\n🔄 Command Usage Patterns');
    console.log('=' .repeat(80));
    
    // Group commands by user sessions (commands within 30 minutes of each other)
    const sessions: string[][] = [];
    let currentSession: string[] = [];
    let lastTime = new Date(commandStats[0].execution_time);
    
    for (let i = 0; i < commandStats.length; i++) {
      const cmd = commandStats[i];
      const cmdTime = new Date(cmd.execution_time);
      const timeDiff = Math.abs(lastTime.getTime() - cmdTime.getTime()) / 1000 / 60; // minutes
      
      if (timeDiff > 30 && currentSession.length > 0) {
        sessions.push([...currentSession]);
        currentSession = [];
      }
      
      currentSession.push(cmd.command_name);
      lastTime = cmdTime;
    }
    
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }
    
    // Find common command sequences
    const sequenceMap = new Map<string, number>();
    
    sessions.forEach(session => {
      for (let i = 0; i < session.length - 1; i++) {
        const sequence = `${session[i]} → ${session[i + 1]}`;
        sequenceMap.set(sequence, (sequenceMap.get(sequence) || 0) + 1);
      }
    });
    
    const commonSequences = Array.from(sequenceMap.entries())
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    if (commonSequences.length > 0) {
      console.log('Common Command Sequences:');
      commonSequences.forEach(([sequence, count]) => {
        console.log(`  ${sequence} (${count} times)`);
      });
    }

    // Performance insights
    console.log('\n⚡ Performance Insights');
    console.log('=' .repeat(80));
    
    const slowCommands = statistics
      .filter(s => s.avg_duration_ms > 10000) // > 10 seconds
      .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms);
    
    if (slowCommands.length > 0) {
      console.log('Slowest Commands (avg > 10s):');
      slowCommands.forEach(cmd => {
        console.log(`  ${cmd.command_name}: ${(cmd.avg_duration_ms / 1000).toFixed(2)}s average`);
      });
    }

    // Error analysis
    const errorProneCommands = statistics
      .filter(s => s.error_count > 0 && s.error_count / s.total_count > 0.1) // > 10% error rate
      .sort((a, b) => (b.error_count / b.total_count) - (a.error_count / a.total_count));
    
    if (errorProneCommands.length > 0) {
      console.log('\n❌ Commands with High Error Rates (>10%):');
      errorProneCommands.forEach(cmd => {
        const errorRate = (cmd.error_count / cmd.total_count * 100).toFixed(1);
        console.log(`  ${cmd.command_name}: ${errorRate}% error rate (${cmd.error_count} errors)`);
      });
    }

  } catch (error) {
    console.error('Error analyzing command usage:', error);
    process.exit(1);
  }
}

// Run the analysis
analyzeGoogleSyncCommandUsage();