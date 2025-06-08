#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ScriptUsageData {
  file_path: string;
  file_name: string;
  last_modified: Date;
  size_bytes: number;
  is_executable: boolean;
  in_cli_pipeline: boolean;
  pipeline_name?: string;
  usage_data?: {
    last_used?: Date;
    usage_count: number;
    last_command?: string;
  };
  dependencies: {
    referenced_in_package_json: boolean;
    referenced_by_scripts: string[];
    has_imports: boolean;
  };
  classification: 'active' | 'inactive' | 'dormant' | 'unknown';
  safe_to_archive: boolean;
  reason?: string;
}

class ScriptUsageAnalyzer {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private scriptFiles: ScriptUsageData[] = [];

  async analyze() {
    console.log('🔍 Analyzing script usage across the monorepo...\n');
    
    // Step 1: Find all script files
    await this.findAllScripts();
    
    // Step 2: Check CLI pipeline membership
    await this.checkCliPipelineMembership();
    
    // Step 3: Check usage from command tracking
    await this.checkCommandUsage();
    
    // Step 4: Check dependencies
    await this.checkDependencies();
    
    // Step 5: Classify scripts
    this.classifyScripts();
    
    // Step 6: Generate report
    await this.generateReport();
  }

  private async findAllScripts() {
    console.log('📂 Finding all script files...');
    
    const patterns = [
      'scripts/**/*.{sh,ts,js,py}',
      '!scripts/**/node_modules/**',
      '!scripts/**/.archived_scripts/**'
    ];
    
    const files = await glob(patterns[0], {
      cwd: this.projectRoot,
      ignore: patterns.slice(1).map(p => p.substring(1))
    });
    
    for (const file of files) {
      const fullPath = path.join(this.projectRoot, file);
      const stats = fs.statSync(fullPath);
      
      this.scriptFiles.push({
        file_path: file,
        file_name: path.basename(file),
        last_modified: stats.mtime,
        size_bytes: stats.size,
        is_executable: (stats.mode & 0o111) !== 0,
        in_cli_pipeline: file.includes('cli-pipeline/'),
        pipeline_name: this.extractPipelineName(file),
        dependencies: {
          referenced_in_package_json: false,
          referenced_by_scripts: [],
          has_imports: false
        },
        classification: 'unknown',
        safe_to_archive: false
      });
    }
    
    console.log(`  Found ${this.scriptFiles.length} script files\n`);
  }

  private extractPipelineName(filePath: string): string | undefined {
    const match = filePath.match(/cli-pipeline\/([^\/]+)\//);
    return match ? match[1] : undefined;
  }

  private async checkCliPipelineMembership() {
    console.log('🔗 Checking CLI pipeline membership...');
    
    // Get registered pipelines
    const { data: pipelines } = await this.supabase
      .from('registry_cli_pipelines')
      .select('*');
    
    const pipelineMap = new Map(
      pipelines?.map(p => [p.name, p]) || []
    );
    
    let inPipeline = 0;
    for (const script of this.scriptFiles) {
      if (script.pipeline_name && pipelineMap.has(script.pipeline_name)) {
        script.in_cli_pipeline = true;
        inPipeline++;
      }
    }
    
    console.log(`  ${inPipeline} scripts are part of registered CLI pipelines\n`);
  }

  private async checkCommandUsage() {
    console.log('📊 Checking command usage from tracking data...');
    
    // Get recent command usage
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const { data: recentUsage } = await this.supabase
      .from('command_tracking')
      .select('command_name, pipeline_name, executed_at')
      .gte('executed_at', ninetyDaysAgo.toISOString())
      .order('executed_at', { ascending: false });
    
    // Map usage to scripts
    const usageMap = new Map<string, any>();
    
    for (const usage of recentUsage || []) {
      const key = `${usage.pipeline_name}/${usage.command_name}`;
      if (!usageMap.has(key)) {
        usageMap.set(key, {
          last_used: new Date(usage.executed_at),
          usage_count: 0
        });
      }
      usageMap.get(key).usage_count++;
    }
    
    // Apply usage data to scripts
    let withUsage = 0;
    for (const script of this.scriptFiles) {
      if (script.pipeline_name) {
        // Try to match based on pipeline and command name
        const commandName = path.basename(script.file_name, path.extname(script.file_name));
        const key = `${script.pipeline_name}/${commandName}`;
        
        if (usageMap.has(key)) {
          script.usage_data = usageMap.get(key);
          withUsage++;
        }
      }
    }
    
    console.log(`  Found usage data for ${withUsage} scripts\n`);
  }

  private async checkDependencies() {
    console.log('🔍 Checking script dependencies...');
    
    // Check package.json files
    const packageJsonFiles = await glob('**/package.json', {
      cwd: this.projectRoot,
      ignore: ['**/node_modules/**']
    });
    
    let referencedCount = 0;
    
    for (const pkgFile of packageJsonFiles) {
      const pkgPath = path.join(this.projectRoot, pkgFile);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      
      if (pkg.scripts) {
        const scriptContent = JSON.stringify(pkg.scripts);
        
        for (const script of this.scriptFiles) {
          if (scriptContent.includes(script.file_name) || 
              scriptContent.includes(script.file_path)) {
            script.dependencies.referenced_in_package_json = true;
            referencedCount++;
          }
        }
      }
    }
    
    // Check for cross-references in shell scripts
    for (const script of this.scriptFiles) {
      if (script.file_name.endsWith('.sh')) {
        const content = fs.readFileSync(
          path.join(this.projectRoot, script.file_path), 
          'utf-8'
        );
        
        for (const other of this.scriptFiles) {
          if (other.file_path !== script.file_path && 
              content.includes(other.file_name)) {
            other.dependencies.referenced_by_scripts.push(script.file_path);
          }
        }
      }
    }
    
    console.log(`  ${referencedCount} scripts referenced in package.json files\n`);
  }

  private classifyScripts() {
    console.log('🏷️  Classifying scripts...');
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    let active = 0, inactive = 0, dormant = 0, unknown = 0;
    
    for (const script of this.scriptFiles) {
      const lastUsed = script.usage_data?.last_used || script.last_modified;
      
      if (lastUsed > thirtyDaysAgo) {
        script.classification = 'active';
        active++;
      } else if (lastUsed > ninetyDaysAgo) {
        script.classification = 'inactive';
        inactive++;
      } else if (lastUsed) {
        script.classification = 'dormant';
        dormant++;
      } else {
        script.classification = 'unknown';
        unknown++;
      }
      
      // Determine if safe to archive
      script.safe_to_archive = this.isSafeToArchive(script);
    }
    
    console.log(`  Classifications:`);
    console.log(`    Active (< 30 days): ${active}`);
    console.log(`    Inactive (30-90 days): ${inactive}`);
    console.log(`    Dormant (> 90 days): ${dormant}`);
    console.log(`    Unknown: ${unknown}\n`);
  }

  private isSafeToArchive(script: ScriptUsageData): boolean {
    // Never archive certain critical files
    const criticalPatterns = [
      /cli\.sh$/,           // Main CLI entry points
      /health-check\.sh$/,  // Health checks
      /package\.json$/,     // Package files
      /start-all-servers/,  // Infrastructure
      /kill-all-servers/    // Infrastructure
    ];
    
    if (criticalPatterns.some(pattern => pattern.test(script.file_name))) {
      script.reason = 'Critical infrastructure file';
      return false;
    }
    
    // Don't archive if actively used
    if (script.classification === 'active') {
      script.reason = 'Recently used (within 30 days)';
      return false;
    }
    
    // Don't archive if referenced
    if (script.dependencies.referenced_in_package_json) {
      script.reason = 'Referenced in package.json';
      return false;
    }
    
    if (script.dependencies.referenced_by_scripts.length > 0) {
      script.reason = `Referenced by ${script.dependencies.referenced_by_scripts.length} other scripts`;
      return false;
    }
    
    // Don't archive active CLI pipeline scripts
    if (script.in_cli_pipeline && script.classification !== 'dormant') {
      script.reason = 'Part of active CLI pipeline';
      return false;
    }
    
    // Safe to archive if dormant and not referenced
    if (script.classification === 'dormant') {
      script.reason = 'Dormant script with no dependencies';
      return true;
    }
    
    script.reason = 'Insufficient data to determine safety';
    return false;
  }

  private async generateReport() {
    console.log('📝 Generating report...\n');
    
    const archivable = this.scriptFiles.filter(s => s.safe_to_archive);
    const byClassification = {
      active: this.scriptFiles.filter(s => s.classification === 'active'),
      inactive: this.scriptFiles.filter(s => s.classification === 'inactive'),
      dormant: this.scriptFiles.filter(s => s.classification === 'dormant'),
      unknown: this.scriptFiles.filter(s => s.classification === 'unknown')
    };
    
    console.log('=== SCRIPT USAGE ANALYSIS REPORT ===\n');
    
    console.log(`Total scripts analyzed: ${this.scriptFiles.length}`);
    console.log(`Safe to archive: ${archivable.length}\n`);
    
    console.log('Scripts by Location:');
    console.log(`  CLI Pipeline: ${this.scriptFiles.filter(s => s.in_cli_pipeline).length}`);
    console.log(`  Root Scripts: ${this.scriptFiles.filter(s => !s.in_cli_pipeline).length}\n`);
    
    console.log('Archivable Scripts:');
    console.log('─'.repeat(80));
    
    for (const script of archivable.sort((a, b) => a.file_path.localeCompare(b.file_path))) {
      console.log(`\n📄 ${script.file_path}`);
      console.log(`   Last Modified: ${script.last_modified.toLocaleDateString()}`);
      console.log(`   Size: ${(script.size_bytes / 1024).toFixed(1)} KB`);
      console.log(`   Classification: ${script.classification}`);
      console.log(`   Reason: ${script.reason}`);
      
      if (script.usage_data) {
        console.log(`   Last Used: ${script.usage_data.last_used?.toLocaleDateString()}`);
        console.log(`   Usage Count: ${script.usage_data.usage_count}`);
      }
    }
    
    // Save detailed report
    const reportPath = path.join(
      this.projectRoot, 
      'docs/script-reports',
      `script-usage-analysis-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      analysis_date: new Date().toISOString(),
      summary: {
        total_scripts: this.scriptFiles.length,
        archivable: archivable.length,
        by_classification: {
          active: byClassification.active.length,
          inactive: byClassification.inactive.length,
          dormant: byClassification.dormant.length,
          unknown: byClassification.unknown.length
        }
      },
      archivable_scripts: archivable,
      all_scripts: this.scriptFiles
    }, null, 2));
    
    console.log(`\n\n✅ Detailed report saved to: ${reportPath}`);
  }
}

// Run the analyzer
if (require.main === module) {
  const analyzer = new ScriptUsageAnalyzer();
  analyzer.analyze().catch(console.error);
}