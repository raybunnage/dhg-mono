#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

interface PipelineAnalysis {
  name: string;
  hasMainCLI: boolean;
  hasCommands: boolean;
  hasValidation: boolean;
  commandCount: number;
  recommendation: 'KEEP' | 'ARCHIVE' | 'CONSOLIDATE';
  reason: string;
}

class DeadPipelineAnalyzer {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private pipelineDir = path.join(this.projectRoot, 'scripts/cli-pipeline');

  async analyze() {
    console.log('🔍 Analyzing Pipeline Health for Removal Decisions\n');
    
    const pipelines = this.getCliPipelineDirectories();
    const analyses: PipelineAnalysis[] = [];
    
    for (const pipeline of pipelines) {
      const analysis = await this.analyzePipeline(pipeline);
      analyses.push(analysis);
    }
    
    this.showAnalysis(analyses);
    this.showRecommendations(analyses);
  }

  private getCliPipelineDirectories(): string[] {
    return fs.readdirSync(this.pipelineDir)
      .filter(item => {
        const fullPath = path.join(this.pipelineDir, item);
        return fs.statSync(fullPath).isDirectory() && !item.startsWith('.');
      })
      .sort();
  }

  private async analyzePipeline(pipelineName: string): Promise<PipelineAnalysis> {
    const pipelinePath = path.join(this.pipelineDir, pipelineName);
    
    // Check for main CLI script
    const hasMainCLI = this.hasMainCliScript(pipelinePath, pipelineName);
    
    // Check for command files
    const hasCommands = this.hasCommandFiles(pipelinePath);
    
    // Check database command count
    const commandCount = await this.getDatabaseCommandCount(pipelineName);
    
    // Check validation status (health check, etc.)
    const hasValidation = this.hasValidationScript(pipelinePath);
    
    // Determine recommendation
    const recommendation = this.getRecommendation(hasMainCLI, hasCommands, commandCount, pipelineName);
    
    return {
      name: pipelineName,
      hasMainCLI,
      hasCommands,
      hasValidation,
      commandCount,
      recommendation: recommendation.decision,
      reason: recommendation.reason
    };
  }

  private hasMainCliScript(pipelinePath: string, pipelineName: string): boolean {
    const possibleNames = [
      `${pipelineName}-cli.sh`,
      `${pipelineName.replace('_', '-')}-cli.sh`,
      `${pipelineName}.sh`,
      'cli.sh'
    ];
    
    return possibleNames.some(name => 
      fs.existsSync(path.join(pipelinePath, name))
    );
  }

  private hasCommandFiles(pipelinePath: string): boolean {
    const commandsDir = path.join(pipelinePath, 'commands');
    if (!fs.existsSync(commandsDir)) return false;
    
    const files = fs.readdirSync(commandsDir);
    return files.some(file => file.endsWith('.ts') || file.endsWith('.js'));
  }

  private hasValidationScript(pipelinePath: string): boolean {
    const files = fs.readdirSync(pipelinePath);
    return files.some(file => 
      file.includes('health') || 
      file.includes('validate') || 
      file.includes('check')
    );
  }

  private async getDatabaseCommandCount(pipelineName: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('command_definitions')
      .select('id', { count: 'exact' })
      .eq('pipeline_id', (await this.getPipelineId(pipelineName)));
    
    if (error) return 0;
    return data?.length || 0;
  }

  private async getPipelineId(pipelineName: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('command_pipelines')
      .select('id')
      .eq('name', pipelineName)
      .single();
    
    return data?.id || null;
  }

  private getRecommendation(hasMainCLI: boolean, hasCommands: boolean, commandCount: number, pipelineName: string): { decision: 'KEEP' | 'ARCHIVE' | 'CONSOLIDATE', reason: string } {
    // High-value pipelines to always keep
    const corePipelines = ['database', 'ai', 'media-processing', 'presentations', 'deprecation'];
    if (corePipelines.includes(pipelineName)) {
      return { decision: 'KEEP', reason: 'Core pipeline with critical functionality' };
    }
    
    // Pipelines with working CLI and commands
    if (hasMainCLI && hasCommands && commandCount > 0) {
      return { decision: 'KEEP', reason: 'Functional pipeline with CLI and commands' };
    }
    
    // Pipelines with working CLI but no database commands
    if (hasMainCLI && commandCount === 0) {
      return { decision: 'CONSOLIDATE', reason: 'Has CLI but no database commands - merge into related pipeline' };
    }
    
    // Empty or broken pipelines
    if (!hasMainCLI && commandCount === 0) {
      return { decision: 'ARCHIVE', reason: 'No functional CLI or commands' };
    }
    
    // Default to consolidate
    return { decision: 'CONSOLIDATE', reason: 'Mixed state - evaluate for consolidation' };
  }

  private showAnalysis(analyses: PipelineAnalysis[]) {
    console.log('📊 Pipeline Analysis Results');
    console.log('=' .repeat(100));
    console.log('Pipeline'.padEnd(20) + 'CLI'.padEnd(8) + 'Cmds'.padEnd(8) + 'DB'.padEnd(6) + 'Valid'.padEnd(8) + 'Recommendation'.padEnd(15) + 'Reason');
    console.log('-'.repeat(100));
    
    analyses.forEach(analysis => {
      const line = [
        analysis.name.padEnd(20),
        (analysis.hasMainCLI ? '✅' : '❌').padEnd(8),
        (analysis.hasCommands ? '✅' : '❌').padEnd(8),
        analysis.commandCount.toString().padEnd(6),
        (analysis.hasValidation ? '✅' : '❌').padEnd(8),
        analysis.recommendation.padEnd(15),
        analysis.reason
      ].join('');
      
      console.log(line);
    });
  }

  private showRecommendations(analyses: PipelineAnalysis[]) {
    console.log('\n\n🎯 Action Recommendations');
    console.log('=' .repeat(80));
    
    const toArchive = analyses.filter(a => a.recommendation === 'ARCHIVE');
    const toConsolidate = analyses.filter(a => a.recommendation === 'CONSOLIDATE');
    const toKeep = analyses.filter(a => a.recommendation === 'KEEP');
    
    if (toArchive.length > 0) {
      console.log('\n📦 ARCHIVE (Safe to remove):');
      toArchive.forEach(a => {
        console.log(`   - ${a.name}: ${a.reason}`);
      });
    }
    
    if (toConsolidate.length > 0) {
      console.log('\n🔄 CONSOLIDATE (Merge into related pipelines):');
      toConsolidate.forEach(a => {
        console.log(`   - ${a.name}: ${a.reason}`);
      });
    }
    
    console.log('\n✅ KEEP (Functional pipelines):');
    toKeep.forEach(a => {
      console.log(`   - ${a.name}: ${a.reason}`);
    });
    
    console.log('\n📊 Summary:');
    console.log(`   Archive: ${toArchive.length} pipelines`);
    console.log(`   Consolidate: ${toConsolidate.length} pipelines`);
    console.log(`   Keep: ${toKeep.length} pipelines`);
    console.log(`   Total: ${analyses.length} pipelines`);
  }
}

// Run the analysis
if (require.main === module) {
  const analyzer = new DeadPipelineAnalyzer();
  analyzer.analyze().catch(console.error);
}