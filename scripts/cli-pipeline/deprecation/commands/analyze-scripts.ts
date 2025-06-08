#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface Script {
  id: string;
  file_path: string;
  file_name: string;
  status: string;
  last_run: string | null;
  run_count: number;
  created_at: string;
  updated_at: string | null;
}

interface ScriptAnalysisReport {
  total_scripts: number;
  inactive_scripts: number;
  never_run_scripts: number;
  scripts_by_status: Record<string, number>;
  recommendations: ScriptRecommendation[];
  generated_at: string;
}

interface ScriptRecommendation {
  file_name: string;
  file_path: string;
  recommendation: 'archive' | 'review' | 'keep';
  reason: string;
  last_run: string | null;
  run_count: number;
}

async function analyzeScripts() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Analyzing script usage patterns...\n');
  
  try {
    // Get all scripts
    const { data: allScripts, error: allError } = await supabase
      .from('scripts_registry')
      .select('*')
      .order('file_path');
      
    if (allError) throw allError;
    
    // Define thresholds
    const DAYS_THRESHOLD = 90;
    const RUN_COUNT_THRESHOLD = 5;
    const cutoffDate = new Date(Date.now() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000);
    
    const recommendations: ScriptRecommendation[] = [];
    let inactiveCount = 0;
    let neverRunCount = 0;
    const statusCounts: Record<string, number> = {};
    
    for (const script of allScripts || []) {
      // Count by status
      statusCounts[script.status] = (statusCounts[script.status] || 0) + 1;
      
      let recommendation: 'archive' | 'review' | 'keep' = 'keep';
      let reason = '';
      
      // Check if script has ever been run
      if (!script.last_run) {
        neverRunCount++;
        recommendation = 'archive';
        reason = 'Never been executed';
      } else {
        const lastRunDate = new Date(script.last_run);
        const daysSinceRun = Math.floor((Date.now() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (lastRunDate < cutoffDate) {
          inactiveCount++;
          
          if (script.run_count < RUN_COUNT_THRESHOLD) {
            recommendation = 'archive';
            reason = `Not run in ${daysSinceRun} days and only ${script.run_count} total runs`;
          } else {
            recommendation = 'review';
            reason = `Not run in ${daysSinceRun} days but has ${script.run_count} historical runs`;
          }
        }
      }
      
      // Check for deprecated patterns in path
      if (script.file_path.includes('.archived_scripts') || 
          script.file_path.includes('deprecated') ||
          script.file_path.includes('old')) {
        recommendation = 'archive';
        reason = 'Path indicates deprecated/archived script';
      }
      
      // Check status
      if (script.status === 'deprecated' || script.status === 'archived') {
        recommendation = 'archive';
        reason = `Status is ${script.status}`;
      }
      
      if (recommendation !== 'keep') {
        recommendations.push({
          file_name: script.file_name,
          file_path: script.file_path,
          recommendation,
          reason,
          last_run: script.last_run,
          run_count: script.run_count || 0
        });
      }
    }
    
    // Generate report
    const report: ScriptAnalysisReport = {
      total_scripts: allScripts?.length || 0,
      inactive_scripts: inactiveCount,
      never_run_scripts: neverRunCount,
      scripts_by_status: statusCounts,
      recommendations,
      generated_at: new Date().toISOString()
    };
    
    // Display report
    console.log('📊 Script Usage Analysis Report');
    console.log('===============================\n');
    console.log(`Total Scripts: ${report.total_scripts}`);
    console.log(`Inactive Scripts (>${DAYS_THRESHOLD} days): ${report.inactive_scripts}`);
    console.log(`Never Run Scripts: ${report.never_run_scripts}\n`);
    
    console.log('Scripts by Status:');
    Object.entries(report.scripts_by_status).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    console.log('\n🎯 Deprecation Recommendations:');
    console.log('-------------------------------\n');
    
    const archiveCount = recommendations.filter(r => r.recommendation === 'archive').length;
    const reviewCount = recommendations.filter(r => r.recommendation === 'review').length;
    
    console.log(`  🗑️  Archive: ${archiveCount} scripts`);
    console.log(`  🔍 Review: ${reviewCount} scripts\n`);
    
    // Group by directory for better overview
    const byDirectory: Record<string, ScriptRecommendation[]> = {};
    recommendations.forEach(r => {
      const dir = r.file_path.substring(0, r.file_path.lastIndexOf('/'));
      if (!byDirectory[dir]) byDirectory[dir] = [];
      byDirectory[dir].push(r);
    });
    
    // Show by directory
    Object.entries(byDirectory).forEach(([dir, scripts]) => {
      console.log(`\n📁 ${dir}:`);
      scripts.forEach(s => {
        const icon = s.recommendation === 'archive' ? '🗑️' : '🔍';
        console.log(`  ${icon} ${s.file_name}`);
        console.log(`     Reason: ${s.reason}`);
        if (s.last_run) {
          console.log(`     Last run: ${new Date(s.last_run).toLocaleDateString()}`);
        }
        console.log(`     Total runs: ${s.run_count}`);
      });
    });
    
    // Save report
    const outputPath = join(process.cwd(), `script-deprecation-report-${new Date().toISOString().split('T')[0]}.json`);
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Full report saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error analyzing scripts:', error);
    process.exit(1);
  }
}

// Run the analysis
analyzeScripts();