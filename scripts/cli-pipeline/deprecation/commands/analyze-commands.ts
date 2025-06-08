#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface CommandUsageStat {
  command_name: string;
  pipeline_name: string | null;
  total_uses: number;
  successful_uses: number;
  failed_uses: number;
  avg_duration_ms: number | null;
  last_used: string | null;
  first_used: string | null;
  unique_users: number;
  error_rate: number;
  days_since_last_use: number | null;
}

interface CommandAnalysisReport {
  total_commands: number;
  low_usage_commands: number;
  high_error_commands: number;
  inactive_commands: number;
  commands_by_pipeline: Record<string, number>;
  recommendations: CommandRecommendation[];
  generated_at: string;
}

interface CommandRecommendation {
  command_name: string;
  pipeline_name: string | null;
  recommendation: 'deprecate' | 'review' | 'monitor' | 'keep';
  reason: string;
  usage_stats: {
    total_uses: number;
    error_rate: number;
    days_since_last_use: number | null;
  };
}

async function analyzeCommands() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Analyzing command usage patterns...\n');
  
  try {
    // Get command usage stats for the last 90 days
    const { data: commandStats, error: statsError } = await supabase
      .rpc('get_command_usage_stats', {
        days_back: 90
      });
      
    if (statsError) {
      console.warn('⚠️  Command usage stats not available, using direct query...');
      
      // Fallback to direct query
      const { data: tracking, error: trackingError } = await supabase
        .from('command_tracking')
        .select('command_name, pipeline_name, success, created_at')
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });
        
      if (trackingError) throw trackingError;
      
      // Process into stats format
      const statsMap = new Map<string, CommandUsageStat>();
      
      (tracking || []).forEach(record => {
        const key = `${record.pipeline_name || 'unknown'}:${record.command_name}`;
        if (!statsMap.has(key)) {
          statsMap.set(key, {
            command_name: record.command_name,
            pipeline_name: record.pipeline_name,
            total_uses: 0,
            successful_uses: 0,
            failed_uses: 0,
            avg_duration_ms: null,
            last_used: record.created_at,
            first_used: record.created_at,
            unique_users: 1,
            error_rate: 0,
            days_since_last_use: null
          });
        }
        
        const stat = statsMap.get(key)!;
        stat.total_uses++;
        if (record.success) {
          stat.successful_uses++;
        } else {
          stat.failed_uses++;
        }
        stat.error_rate = stat.failed_uses / stat.total_uses;
        
        // Update dates
        if (new Date(record.created_at) > new Date(stat.last_used!)) {
          stat.last_used = record.created_at;
        }
        if (new Date(record.created_at) < new Date(stat.first_used!)) {
          stat.first_used = record.created_at;
        }
      });
      
      // Calculate days since last use
      statsMap.forEach(stat => {
        if (stat.last_used) {
          stat.days_since_last_use = Math.floor(
            (Date.now() - new Date(stat.last_used).getTime()) / (1000 * 60 * 60 * 24)
          );
        }
      });
      
      // Convert to array
      const processedStats = Array.from(statsMap.values());
      return analyzeCommandStats(processedStats);
    }
    
    return analyzeCommandStats(commandStats || []);
    
  } catch (error) {
    console.error('❌ Error analyzing commands:', error);
    process.exit(1);
  }
}

function analyzeCommandStats(commandStats: CommandUsageStat[]) {
  // Define thresholds
  const LOW_USAGE_THRESHOLD = 5;
  const HIGH_ERROR_THRESHOLD = 0.3; // 30% error rate
  const INACTIVE_DAYS_THRESHOLD = 60;
  
  const recommendations: CommandRecommendation[] = [];
  let lowUsageCount = 0;
  let highErrorCount = 0;
  let inactiveCount = 0;
  const pipelineCounts: Record<string, number> = {};
  
  for (const stat of commandStats) {
    // Count by pipeline
    const pipeline = stat.pipeline_name || 'unknown';
    pipelineCounts[pipeline] = (pipelineCounts[pipeline] || 0) + 1;
    
    let recommendation: 'deprecate' | 'review' | 'monitor' | 'keep' = 'keep';
    let reason = '';
    
    // Check usage patterns
    if (stat.total_uses < LOW_USAGE_THRESHOLD) {
      lowUsageCount++;
      
      if (stat.days_since_last_use && stat.days_since_last_use > INACTIVE_DAYS_THRESHOLD) {
        inactiveCount++;
        recommendation = 'deprecate';
        reason = `Only ${stat.total_uses} uses and inactive for ${stat.days_since_last_use} days`;
      } else {
        recommendation = 'monitor';
        reason = `Low usage (${stat.total_uses} uses) but recently active`;
      }
    }
    
    // Check error rate
    if (stat.error_rate > HIGH_ERROR_THRESHOLD) {
      highErrorCount++;
      
      if (recommendation === 'deprecate') {
        reason += ` + high error rate (${(stat.error_rate * 100).toFixed(1)}%)`;
      } else {
        recommendation = 'review';
        reason = `High error rate (${(stat.error_rate * 100).toFixed(1)}%) - may need fixing or deprecation`;
      }
    }
    
    // Check for deprecated patterns in name
    if (stat.command_name.includes('deprecated') || 
        stat.command_name.includes('old') ||
        stat.command_name.includes('legacy')) {
      recommendation = 'deprecate';
      reason = 'Command name indicates deprecated functionality';
    }
    
    if (recommendation !== 'keep') {
      recommendations.push({
        command_name: stat.command_name,
        pipeline_name: stat.pipeline_name,
        recommendation,
        reason,
        usage_stats: {
          total_uses: stat.total_uses,
          error_rate: stat.error_rate,
          days_since_last_use: stat.days_since_last_use
        }
      });
    }
  }
  
  // Generate report
  const report: CommandAnalysisReport = {
    total_commands: commandStats.length,
    low_usage_commands: lowUsageCount,
    high_error_commands: highErrorCount,
    inactive_commands: inactiveCount,
    commands_by_pipeline: pipelineCounts,
    recommendations,
    generated_at: new Date().toISOString()
  };
  
  // Display report
  console.log('📊 Command Usage Analysis Report');
  console.log('================================\n');
  console.log(`Total Commands Analyzed: ${report.total_commands}`);
  console.log(`Low Usage Commands (<${LOW_USAGE_THRESHOLD} uses): ${report.low_usage_commands}`);
  console.log(`High Error Commands (>${HIGH_ERROR_THRESHOLD * 100}% errors): ${report.high_error_commands}`);
  console.log(`Inactive Commands (>${INACTIVE_DAYS_THRESHOLD} days): ${report.inactive_commands}\n`);
  
  console.log('Commands by Pipeline:');
  Object.entries(report.commands_by_pipeline)
    .sort(([, a], [, b]) => b - a)
    .forEach(([pipeline, count]) => {
      console.log(`  ${pipeline}: ${count} commands`);
    });
  
  console.log('\n🎯 Deprecation Recommendations:');
  console.log('-------------------------------\n');
  
  const deprecateCount = recommendations.filter(r => r.recommendation === 'deprecate').length;
  const reviewCount = recommendations.filter(r => r.recommendation === 'review').length;
  const monitorCount = recommendations.filter(r => r.recommendation === 'monitor').length;
  
  console.log(`  🗑️  Deprecate: ${deprecateCount} commands`);
  console.log(`  🔍 Review: ${reviewCount} commands`);
  console.log(`  📊 Monitor: ${monitorCount} commands\n`);
  
  // Group by pipeline
  const byPipeline: Record<string, CommandRecommendation[]> = {};
  recommendations.forEach(r => {
    const pipeline = r.pipeline_name || 'unknown';
    if (!byPipeline[pipeline]) byPipeline[pipeline] = [];
    byPipeline[pipeline].push(r);
  });
  
  // Show by pipeline
  Object.entries(byPipeline).forEach(([pipeline, commands]) => {
    console.log(`\n🔧 Pipeline: ${pipeline}`);
    commands.forEach(c => {
      const icon = c.recommendation === 'deprecate' ? '🗑️' : 
                   c.recommendation === 'review' ? '🔍' : '📊';
      console.log(`  ${icon} ${c.command_name}`);
      console.log(`     Reason: ${c.reason}`);
      console.log(`     Usage: ${c.usage_stats.total_uses} total, ${(c.usage_stats.error_rate * 100).toFixed(1)}% errors`);
      if (c.usage_stats.days_since_last_use) {
        console.log(`     Last used: ${c.usage_stats.days_since_last_use} days ago`);
      }
    });
  });
  
  // Save report
  const outputPath = join(process.cwd(), `command-deprecation-report-${new Date().toISOString().split('T')[0]}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Full report saved to: ${outputPath}`);
  
  return report;
}

// Run the analysis
analyzeCommands();