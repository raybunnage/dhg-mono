#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface DeprecationReport {
  generated_at: string;
  summary: {
    total_candidates: number;
    by_type: {
      services: number;
      scripts: number;
      commands: number;
      pipelines: number;
    };
    by_recommendation: {
      immediate: number;
      review: number;
      monitor: number;
    };
  };
  services: any[];
  scripts: any[];
  commands: any[];
  pipelines: any[];
  action_plan: ActionPlan;
}

interface ActionPlan {
  immediate_actions: string[];
  review_required: string[];
  monitoring_setup: string[];
  migration_steps: string[];
}

async function generateReport() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📝 Generating comprehensive deprecation report...\n');
  
  try {
    // Collect all deprecation data
    console.log('1️⃣ Analyzing services...');
    const servicesData = await analyzeServicesData(supabase);
    
    console.log('2️⃣ Analyzing scripts...');
    const scriptsData = await analyzeScriptsData(supabase);
    
    console.log('3️⃣ Analyzing commands...');
    const commandsData = await analyzeCommandsData(supabase);
    
    console.log('4️⃣ Analyzing pipelines...');
    const pipelinesData = await analyzePipelinesData(supabase);
    
    // Build comprehensive report
    const report: DeprecationReport = {
      generated_at: new Date().toISOString(),
      summary: {
        total_candidates: 0,
        by_type: {
          services: servicesData.length,
          scripts: scriptsData.length,
          commands: commandsData.length,
          pipelines: pipelinesData.length
        },
        by_recommendation: {
          immediate: 0,
          review: 0,
          monitor: 0
        }
      },
      services: servicesData,
      scripts: scriptsData,
      commands: commandsData,
      pipelines: pipelinesData,
      action_plan: {
        immediate_actions: [],
        review_required: [],
        monitoring_setup: [],
        migration_steps: []
      }
    };
    
    // Calculate totals
    report.summary.total_candidates = 
      report.summary.by_type.services +
      report.summary.by_type.scripts +
      report.summary.by_type.commands +
      report.summary.by_type.pipelines;
    
    // Count by recommendation
    [...servicesData, ...scriptsData, ...commandsData, ...pipelinesData].forEach(item => {
      if (item.recommendation === 'archive' || item.recommendation === 'deprecate') {
        report.summary.by_recommendation.immediate++;
      } else if (item.recommendation === 'review') {
        report.summary.by_recommendation.review++;
      } else if (item.recommendation === 'monitor') {
        report.summary.by_recommendation.monitor++;
      }
    });
    
    // Build action plan
    report.action_plan = buildActionPlan(report);
    
    // Generate markdown report
    const markdown = generateMarkdown(report);
    
    // Save reports
    const jsonPath = join(process.cwd(), `deprecation-report-${new Date().toISOString().split('T')[0]}.json`);
    const mdPath = join(process.cwd(), `deprecation-report-${new Date().toISOString().split('T')[0]}.md`);
    
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    writeFileSync(mdPath, markdown);
    
    console.log('\n✅ Report generation complete!');
    console.log(`📄 JSON report: ${jsonPath}`);
    console.log(`📄 Markdown report: ${mdPath}`);
    
    // Display summary
    console.log('\n📊 Deprecation Summary');
    console.log('=====================\n');
    console.log(`Total Candidates: ${report.summary.total_candidates}`);
    console.log(`  Services: ${report.summary.by_type.services}`);
    console.log(`  Scripts: ${report.summary.by_type.scripts}`);
    console.log(`  Commands: ${report.summary.by_type.commands}`);
    console.log(`  Pipelines: ${report.summary.by_type.pipelines}\n`);
    
    console.log('Recommendations:');
    console.log(`  🗑️  Immediate Action: ${report.summary.by_recommendation.immediate}`);
    console.log(`  🔍 Review Required: ${report.summary.by_recommendation.review}`);
    console.log(`  📊 Monitor: ${report.summary.by_recommendation.monitor}\n`);
    
    if (report.action_plan.immediate_actions.length > 0) {
      console.log('⚡ Immediate Actions Required:');
      report.action_plan.immediate_actions.slice(0, 5).forEach(action => {
        console.log(`  - ${action}`);
      });
      if (report.action_plan.immediate_actions.length > 5) {
        console.log(`  ... and ${report.action_plan.immediate_actions.length - 5} more`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error generating report:', error);
    process.exit(1);
  }
}

async function analyzeServicesData(supabase: any) {
  const { data: unusedServices } = await supabase
    .from('registry_unused_services_view')
    .select('*')
    .eq('is_unused', true);
    
  return (unusedServices || []).map((service: any) => ({
    type: 'service',
    name: service.service_name,
    path: service.service_path,
    recommendation: service.category === 'utility' ? 'review' : 'archive',
    reason: 'No dependencies found',
    metadata: {
      category: service.category,
      created_at: service.created_at
    }
  }));
}

async function analyzeScriptsData(supabase: any) {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  
  const { data: inactiveScripts } = await supabase
    .from('scripts_registry')
    .select('*')
    .or(`last_run.is.null,last_run.lt.${cutoffDate}`)
    .eq('status', 'active');
    
  return (inactiveScripts || []).map((script: any) => ({
    type: 'script',
    name: script.file_name,
    path: script.file_path,
    recommendation: script.run_count === 0 ? 'archive' : 'review',
    reason: script.last_run ? 'Inactive for 90+ days' : 'Never run',
    metadata: {
      last_run: script.last_run,
      run_count: script.run_count
    }
  }));
}

async function analyzeCommandsData(supabase: any) {
  const { data: commandStats } = await supabase
    .rpc('get_command_usage_stats', { days_back: 90 });
    
  if (!commandStats) return [];
  
  return commandStats
    .filter((stat: any) => stat.total_uses < 5 || stat.error_rate > 0.3)
    .map((stat: any) => ({
      type: 'command',
      name: stat.command_name,
      path: stat.pipeline_name,
      recommendation: stat.total_uses < 3 ? 'deprecate' : 'monitor',
      reason: `Low usage (${stat.total_uses}) or high errors (${(stat.error_rate * 100).toFixed(1)}%)`,
      metadata: {
        total_uses: stat.total_uses,
        error_rate: stat.error_rate,
        last_used: stat.last_used
      }
    }));
}

async function analyzePipelinesData(supabase: any) {
  const { data: pipelines } = await supabase
    .from('command_pipelines')
    .select('*, command_definitions(count)')
    .eq('status', 'active');
    
  if (!pipelines) return [];
  
  return pipelines
    .filter((pipeline: any) => pipeline.command_definitions?.length === 0)
    .map((pipeline: any) => ({
      type: 'pipeline',
      name: pipeline.name,
      path: pipeline.script_path,
      recommendation: 'review',
      reason: 'No commands defined',
      metadata: {
        display_name: pipeline.display_name,
        created_at: pipeline.created_at
      }
    }));
}

function buildActionPlan(report: DeprecationReport): ActionPlan {
  const plan: ActionPlan = {
    immediate_actions: [],
    review_required: [],
    monitoring_setup: [],
    migration_steps: []
  };
  
  // Build immediate actions
  report.services
    .filter(s => s.recommendation === 'archive')
    .forEach(s => {
      plan.immediate_actions.push(`Archive service: ${s.name} at ${s.path}`);
      plan.migration_steps.push(`mv ${s.path} ${s.path}.archived_$(date +%Y%m%d)`);
    });
    
  report.scripts
    .filter(s => s.recommendation === 'archive')
    .forEach(s => {
      plan.immediate_actions.push(`Archive script: ${s.name}`);
      const dir = s.path.substring(0, s.path.lastIndexOf('/'));
      plan.migration_steps.push(`mkdir -p ${dir}/.archived_scripts && mv ${s.path} ${dir}/.archived_scripts/`);
    });
    
  // Build review items
  report.services
    .filter(s => s.recommendation === 'review')
    .forEach(s => {
      plan.review_required.push(`Review service ${s.name} - ${s.reason}`);
    });
    
  // Build monitoring items
  report.commands
    .filter(c => c.recommendation === 'monitor')
    .forEach(c => {
      plan.monitoring_setup.push(`Set up monitoring for command: ${c.name} in ${c.path}`);
    });
  
  return plan;
}

function generateMarkdown(report: DeprecationReport): string {
  const md: string[] = [];
  
  md.push('# Deprecation Analysis Report');
  md.push(`Generated: ${new Date(report.generated_at).toLocaleString()}\n`);
  
  md.push('## Executive Summary\n');
  md.push(`Total deprecation candidates: **${report.summary.total_candidates}**\n`);
  md.push('| Type | Count |');
  md.push('|------|-------|');
  md.push(`| Services | ${report.summary.by_type.services} |`);
  md.push(`| Scripts | ${report.summary.by_type.scripts} |`);
  md.push(`| Commands | ${report.summary.by_type.commands} |`);
  md.push(`| Pipelines | ${report.summary.by_type.pipelines} |`);
  md.push('');
  
  md.push('## Recommendations Summary\n');
  md.push(`- 🗑️ **Immediate Action Required**: ${report.summary.by_recommendation.immediate} items`);
  md.push(`- 🔍 **Review Required**: ${report.summary.by_recommendation.review} items`);
  md.push(`- 📊 **Monitor**: ${report.summary.by_recommendation.monitor} items\n`);
  
  // Services section
  if (report.services.length > 0) {
    md.push('## Unused Services\n');
    md.push('| Service | Path | Recommendation | Reason |');
    md.push('|---------|------|----------------|--------|');
    report.services.forEach(s => {
      md.push(`| ${s.name} | ${s.path} | ${s.recommendation} | ${s.reason} |`);
    });
    md.push('');
  }
  
  // Scripts section
  if (report.scripts.length > 0) {
    md.push('## Inactive Scripts\n');
    md.push('| Script | Path | Last Run | Recommendation |');
    md.push('|--------|------|----------|----------------|');
    report.scripts.forEach(s => {
      const lastRun = s.metadata.last_run ? new Date(s.metadata.last_run).toLocaleDateString() : 'Never';
      md.push(`| ${s.name} | ${s.path} | ${lastRun} | ${s.recommendation} |`);
    });
    md.push('');
  }
  
  // Action plan
  md.push('## Action Plan\n');
  
  if (report.action_plan.immediate_actions.length > 0) {
    md.push('### Immediate Actions\n');
    report.action_plan.immediate_actions.forEach(action => {
      md.push(`- ${action}`);
    });
    md.push('');
  }
  
  if (report.action_plan.migration_steps.length > 0) {
    md.push('### Migration Commands\n');
    md.push('```bash');
    md.push('#!/bin/bash');
    md.push('# Deprecation migration script');
    md.push(`# Generated: ${new Date().toISOString()}\n`);
    report.action_plan.migration_steps.forEach(step => {
      md.push(step);
    });
    md.push('```');
  }
  
  return md.join('\n');
}

// Run the report generation
generateReport();