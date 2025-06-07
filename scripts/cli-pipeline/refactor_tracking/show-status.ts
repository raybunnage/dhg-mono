#!/usr/bin/env ts-node
/**
 * Show overall refactoring status
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

// Parse command line arguments
const args = process.argv.slice(2);
const pipelineIndex = args.indexOf('--pipeline');
const pipelineFilter = pipelineIndex !== -1 && args[pipelineIndex + 1] ? args[pipelineIndex + 1] : null;

async function showStatus() {
  // First, get available pipelines if no filter specified
  if (!pipelineFilter) {
    const { data: pipelines } = await supabase
      .from('command_refactor_tracking')
      .select('pipeline')
      .not('pipeline', 'is', null)
      .order('pipeline');
    
    const uniquePipelines = Array.from(new Set(pipelines?.map(p => p.pipeline) || []));
    
    console.log('\n📂 Available pipelines:');
    console.log('   all (default)');
    uniquePipelines.forEach(p => console.log(`   ${p}`));
    console.log('\nUse --pipeline <name> to filter by specific pipeline\n');
  }
  
  const title = pipelineFilter 
    ? `=== ${pipelineFilter.toUpperCase()} Pipeline Refactoring Status ===\n`
    : '=== Command Refactoring Status ===\n';
  console.log(title);
  
  try {
    // Get summary by pipeline, type and status
    let query = supabase
      .from('command_refactor_status_summary_view')
      .select('*')
      .order('pipeline')
      .order('command_type')
      .order('current_status');
    
    // Apply pipeline filter if specified
    if (pipelineFilter && pipelineFilter !== 'all') {
      query = query.eq('pipeline', pipelineFilter);
    }
    
    const { data: summary, error } = await query;
    
    if (error) throw error;
    
    // Calculate totals
    const totals = {
      existing: { total: 0, signed_off: 0 },
      new: { total: 0, signed_off: 0 },
      to_archive: { total: 0, archived: 0 }
    };
    
    summary?.forEach(row => {
      const type = row.command_type as keyof typeof totals;
      if (type in totals) {
        totals[type].total += row.count;
        if (row.current_status === 'signed_off') {
          if (type === 'existing' || type === 'new') {
            totals[type].signed_off += row.count;
          }
        } else if (row.current_status === 'archived' && type === 'to_archive') {
          totals.to_archive.archived += row.count;
        }
      }
    });
    
    // Display overview
    console.log('📊 Overview:');
    console.log(`   Existing Commands: ${totals.existing.signed_off}/${totals.existing.total} signed off`);
    console.log(`   New Commands: ${totals.new.signed_off}/${totals.new.total} signed off`);
    console.log(`   To Archive: ${totals.to_archive.archived}/${totals.to_archive.total} archived`);
    
    // Calculate overall progress
    const totalCommands = totals.existing.total + totals.new.total + totals.to_archive.total;
    const completedCommands = totals.existing.signed_off + totals.new.signed_off + totals.to_archive.archived;
    const progressPercent = totalCommands > 0 ? Math.round((completedCommands / totalCommands) * 100) : 0;
    
    console.log(`\n📈 Overall Progress: ${completedCommands}/${totalCommands} (${progressPercent}%)`);
    
    // Show breakdown by pipeline or status
    if (pipelineFilter && pipelineFilter !== 'all') {
      // If filtering by specific pipeline, show breakdown by command type and status
      console.log('\n📋 Command Type Breakdown:\n');
      
      const typeGroups: Record<string, any[]> = {};
      summary?.forEach(row => {
        if (!typeGroups[row.command_type]) {
          typeGroups[row.command_type] = [];
        }
        typeGroups[row.command_type].push(row);
      });
      
      Object.keys(typeGroups).sort().forEach(type => {
        console.log(`📁 ${type.toUpperCase()}:`);
        
        // Group by status within type
        const statusGroups: Record<string, number> = {};
        typeGroups[type].forEach(row => {
          if (!statusGroups[row.current_status]) {
            statusGroups[row.current_status] = 0;
          }
          statusGroups[row.current_status] += row.count;
        });
        
        const statusOrder = ['not_started', 'in_progress', 'needs_testing', 'tested', 'signed_off', 'archived'];
        statusOrder.forEach(status => {
          if (statusGroups[status]) {
            const emoji = getStatusEmoji(status);
            console.log(`   ${emoji} ${status}: ${statusGroups[status]}`);
          }
        });
        console.log('');
      });
    } else {
      // Show breakdown by all pipelines
      console.log('\n📋 Pipeline Breakdown:\n');
      
      const pipelineGroups: Record<string, any[]> = {};
      summary?.forEach(row => {
        const pipeline = row.pipeline || 'unassigned';
        if (!pipelineGroups[pipeline]) {
          pipelineGroups[pipeline] = [];
        }
        pipelineGroups[pipeline].push(row);
      });
      
      Object.keys(pipelineGroups).sort().forEach(pipeline => {
        console.log(`🚀 ${pipeline.toUpperCase()}:`);
        
        // Group by status within pipeline
        const statusGroups: Record<string, number> = {};
        pipelineGroups[pipeline].forEach(row => {
          if (!statusGroups[row.current_status]) {
            statusGroups[row.current_status] = 0;
          }
          statusGroups[row.current_status] += row.count;
        });
        
        const statusOrder = ['not_started', 'in_progress', 'needs_testing', 'tested', 'signed_off', 'archived'];
        statusOrder.forEach(status => {
          if (statusGroups[status]) {
            const emoji = getStatusEmoji(status);
            console.log(`   ${emoji} ${status}: ${statusGroups[status]}`);
          }
        });
        console.log('');
      });
    }
    
    // Get recently updated commands
    let recentQuery = supabase
      .from('command_refactor_tracking')
      .select('command_name, current_status, updated_at')
      .order('updated_at', { ascending: false })
      .limit(5);
    
    if (pipelineFilter && pipelineFilter !== 'all') {
      recentQuery = recentQuery.eq('pipeline', pipelineFilter);
    }
    
    const { data: recentUpdates } = await recentQuery;
    
    if (recentUpdates && recentUpdates.length > 0) {
      console.log('🕐 Recently Updated:');
      recentUpdates.forEach(cmd => {
        const date = new Date(cmd.updated_at).toLocaleDateString();
        console.log(`   - ${cmd.command_name}: ${cmd.current_status} (${date})`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    'not_started': '⏳',
    'in_progress': '🔄',
    'needs_testing': '🧪',
    'tested': '✅',
    'signed_off': '🎉',
    'archived': '📦'
  };
  return emojis[status] || '❓';
}

showStatus();