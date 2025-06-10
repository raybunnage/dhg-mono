#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface PipelineHealth {
  name: string;
  has_cli_script: boolean;
  total_commands: number;
  implemented_commands: number;
  unimplemented_commands: number;
  health_score: number;
  recommendation: string;
}

class PipelineHealthAnalyzer {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private pipelineHealth: Map<string, PipelineHealth> = new Map();

  async analyze() {
    console.log('🏥 Pipeline Health Analysis\n');
    
    // Step 1: Get all pipelines
    const pipelines = await this.getAllPipelines();
    
    // Step 2: Analyze each pipeline
    for (const pipeline of pipelines) {
      await this.analyzePipeline(pipeline);
    }
    
    // Step 3: Generate recommendations
    this.generateRecommendations();
    
    // Step 4: Save report
    this.saveReport();
  }

  private async getAllPipelines(): Promise<string[]> {
    console.log('📦 Loading pipelines...');
    
    const { data, error } = await this.supabase
      .from('command_pipelines')
      .select('name')
      .eq('status', 'active')
      .order('name');
    
    if (error || !data) {
      console.error('Error loading pipelines:', error);
      return [];
    }
    
    const pipelines = data.map(p => p.name);
    console.log(`  Found ${pipelines.length} active pipelines\n`);
    
    return pipelines;
  }

  private async analyzePipeline(pipelineName: string) {
    console.log(`📊 Analyzing ${pipelineName}...`);
    
    const pipelineDir = path.join(this.projectRoot, 'scripts/cli-pipeline', pipelineName);
    const cliScript = path.join(pipelineDir, `${pipelineName}-cli.sh`);
    const commandsDir = path.join(pipelineDir, 'commands');
    
    // Check if CLI script exists
    const has_cli_script = fs.existsSync(cliScript);
    
    // Get registered commands
    const { data: commands } = await this.supabase
      .from('command_definitions')
      .select('command_name')
      .eq('pipeline_id', 
        this.supabase.from('command_pipelines')
          .select('id')
          .eq('name', pipelineName)
          .single()
      );
    
    const total_commands = commands?.length || 0;
    
    // Count implemented commands
    let implemented_commands = 0;
    if (fs.existsSync(commandsDir)) {
      try {
        const files = fs.readdirSync(commandsDir);
        implemented_commands = files.filter(f => 
          f.endsWith('.ts') || f.endsWith('.js')
        ).length;
      } catch (e) {
        // Commands directory might not exist
      }
    }
    
    // Count actual working commands (from validation report)
    const validationReport = this.loadValidationReport();
    const unimplementedInReport = validationReport.broken_commands
      .filter((cmd: any) => cmd.pipeline_name === pipelineName)
      .length;
    
    const unimplemented_commands = unimplementedInReport;
    
    // Calculate health score (0-100)
    let health_score = 0;
    if (has_cli_script) health_score += 30;
    if (total_commands > 0) {
      const implementationRate = (total_commands - unimplemented_commands) / total_commands;
      health_score += implementationRate * 50;
    }
    if (implemented_commands > 5) health_score += 20;
    else if (implemented_commands > 0) health_score += 10;
    
    const health: PipelineHealth = {
      name: pipelineName,
      has_cli_script,
      total_commands,
      implemented_commands,
      unimplemented_commands,
      health_score: Math.round(health_score),
      recommendation: ''
    };
    
    this.pipelineHealth.set(pipelineName, health);
    
    console.log(`  CLI Script: ${has_cli_script ? '✅' : '❌'}`);
    console.log(`  Commands: ${implemented_commands} implemented, ${unimplemented_commands} missing`);
    console.log(`  Health Score: ${health.health_score}/100\n`);
  }

  private loadValidationReport(): any {
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports/cli-command-validation-2025-06-08.json'
    );
    
    if (fs.existsSync(reportPath)) {
      return JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    }
    
    return { broken_commands: [] };
  }

  private generateRecommendations() {
    console.log('💡 Generating Recommendations...\n');
    
    this.pipelineHealth.forEach((health, name) => {
      if (health.health_score < 20) {
        health.recommendation = 'REMOVE - Pipeline is essentially dead';
      } else if (health.health_score < 40) {
        health.recommendation = 'CONSOLIDATE - Merge with related pipeline';
      } else if (health.health_score < 60) {
        health.recommendation = 'CLEANUP - Remove unimplemented commands';
      } else if (health.health_score < 80) {
        health.recommendation = 'MAINTAIN - Minor cleanup needed';
      } else {
        health.recommendation = 'HEALTHY - Keep as is';
      }
    });
  }

  private saveReport() {
    console.log('📝 Pipeline Health Report');
    console.log('=' .repeat(80));
    
    // Sort by health score
    const sorted = Array.from(this.pipelineHealth.values())
      .sort((a, b) => a.health_score - b.health_score);
    
    // Group by recommendation
    const byRecommendation = new Map<string, PipelineHealth[]>();
    sorted.forEach(health => {
      const rec = health.recommendation.split(' - ')[0];
      const existing = byRecommendation.get(rec) || [];
      existing.push(health);
      byRecommendation.set(rec, existing);
    });
    
    // Display by recommendation
    ['REMOVE', 'CONSOLIDATE', 'CLEANUP', 'MAINTAIN', 'HEALTHY'].forEach(rec => {
      const pipelines = byRecommendation.get(rec) || [];
      if (pipelines.length > 0) {
        console.log(`\n🔴 ${rec} (${pipelines.length} pipelines)`);
        console.log('─'.repeat(60));
        
        pipelines.forEach(p => {
          console.log(`📦 ${p.name} (Score: ${p.health_score}/100)`);
          console.log(`   CLI Script: ${p.has_cli_script ? '✅' : '❌'}`);
          console.log(`   Commands: ${p.implemented_commands}/${p.total_commands} implemented`);
          console.log(`   ${p.recommendation}`);
          console.log('');
        });
      }
    });
    
    // Save JSON report
    const reportPath = path.join(
      this.projectRoot,
      'docs/script-reports',
      `pipeline-health-analysis-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(reportPath, JSON.stringify({
      analysis_date: new Date().toISOString(),
      total_pipelines: this.pipelineHealth.size,
      health_summary: {
        remove: sorted.filter(p => p.recommendation.startsWith('REMOVE')).length,
        consolidate: sorted.filter(p => p.recommendation.startsWith('CONSOLIDATE')).length,
        cleanup: sorted.filter(p => p.recommendation.startsWith('CLEANUP')).length,
        maintain: sorted.filter(p => p.recommendation.startsWith('MAINTAIN')).length,
        healthy: sorted.filter(p => p.recommendation.startsWith('HEALTHY')).length
      },
      pipelines: sorted
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the analyzer
if (require.main === module) {
  const analyzer = new PipelineHealthAnalyzer();
  analyzer.analyze().catch(console.error);
}