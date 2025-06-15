#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
const glob = require('glob');

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
  git_history: {
    last_commit_date?: Date;
    commits_last_90_days: number;
    commits_last_year: number;
  };
  content_analysis: {
    has_todo_fixme: boolean;
    has_hardcoded_paths: boolean;
    has_deprecated_apis: boolean;
    has_error_handling: boolean;
    appears_experimental: boolean;
  };
  classification: 'definitely_obsolete' | 'likely_obsolete' | 'needs_review' | 'active';
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
    
    // Step 5: Analyze git history
    await this.analyzeGitHistory();
    
    // Step 6: Analyze content patterns
    await this.analyzeContent();
    
    // Step 7: Classify scripts with enhanced logic
    this.classifyScripts();
    
    // Step 8: Generate report
    await this.generateReport();
  }

  private async findAllScripts() {
    console.log('📂 Finding all script files...');
    
    const patterns = [
      'scripts/**/*.{sh,ts,js,py}',
      '!scripts/**/node_modules/**',
      '!scripts/**/.archived_scripts/**'
    ];
    
    const files = await new Promise<string[]>((resolve, reject) => {
      glob(patterns[0], {
        cwd: this.projectRoot,
        ignore: patterns.slice(1).map(p => p.substring(1))
      }, (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
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
        git_history: {
          last_commit_date: undefined,
          commits_last_90_days: 0,
          commits_last_year: 0
        },
        content_analysis: {
          has_todo_fixme: false,
          has_hardcoded_paths: false,
          has_deprecated_apis: false,
          has_error_handling: false,
          appears_experimental: false
        },
        classification: 'active',
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
      .from('sys_cli_pipelines')
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
    const packageJsonFiles = await new Promise<string[]>((resolve, reject) => {
      glob('**/package.json', {
        cwd: this.projectRoot,
        ignore: ['**/node_modules/**']
      }, (err: any, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
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

  private async analyzeGitHistory() {
    console.log('📚 Analyzing git history...');
    
    let gitAnalyzed = 0;
    
    for (const script of this.scriptFiles) {
      try {
        // Get last commit date for this file
        const lastCommitCmd = `git log -1 --format="%ai" -- "${script.file_path}"`;
        const lastCommitOutput = execSync(lastCommitCmd, { 
          cwd: this.projectRoot, 
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        
        if (lastCommitOutput) {
          script.git_history.last_commit_date = new Date(lastCommitOutput);
        }
        
        // Count commits in last 90 days
        const since90Days = new Date();
        since90Days.setDate(since90Days.getDate() - 90);
        const commits90Cmd = `git log --oneline --since="${since90Days.toISOString()}" -- "${script.file_path}"`;
        const commits90Output = execSync(commits90Cmd, { 
          cwd: this.projectRoot, 
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        
        script.git_history.commits_last_90_days = commits90Output ? commits90Output.split('\n').length : 0;
        
        // Count commits in last year
        const sinceYear = new Date();
        sinceYear.setFullYear(sinceYear.getFullYear() - 1);
        const commitsYearCmd = `git log --oneline --since="${sinceYear.toISOString()}" -- "${script.file_path}"`;
        const commitsYearOutput = execSync(commitsYearCmd, { 
          cwd: this.projectRoot, 
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
        
        script.git_history.commits_last_year = commitsYearOutput ? commitsYearOutput.split('\n').length : 0;
        
        gitAnalyzed++;
      } catch (error) {
        // Git command failed - file might not be tracked
        console.error(`Git analysis failed for ${script.file_path}:`, error);
      }
    }
    
    console.log(`  Analyzed git history for ${gitAnalyzed} scripts\n`);
  }

  private async analyzeContent() {
    console.log('🔍 Analyzing script content...');
    
    let contentAnalyzed = 0;
    
    for (const script of this.scriptFiles) {
      try {
        const content = fs.readFileSync(
          path.join(this.projectRoot, script.file_path), 
          'utf-8'
        );
        
        // Check for TODO/FIXME comments
        script.content_analysis.has_todo_fixme = /\b(TODO|FIXME|XXX|HACK)\b/i.test(content);
        
        // Check for hardcoded paths (absolute paths)
        script.content_analysis.has_hardcoded_paths = /\/Users\/|\/home\/|C:\\|\/tmp\/|\/var\/tmp/i.test(content);
        
        // Check for deprecated APIs and patterns
        const deprecatedPatterns = [
          /createClient\(/,  // Direct Supabase client creation
          /require\(['"]supabase['"]\)/,  // Old supabase import
          /process\.env\.SUPABASE_URL/,  // Direct env access instead of service
          /npm install --save/,  // Deprecated npm flag
          /node_modules\/\.bin\//,  // Direct bin access
          /DEPRECATED|deprecated/i  // Explicit deprecation markers
        ];
        script.content_analysis.has_deprecated_apis = deprecatedPatterns.some(pattern => pattern.test(content));
        
        // Check for error handling patterns
        script.content_analysis.has_error_handling = /try\s*\{|catch\s*\(|\.catch\(|if.*error|throw\s+/.test(content);
        
        // Check if appears experimental
        const experimentalMarkers = [
          /\btest\b/i,
          /\bexperiment/i,
          /\bdebug\b/i,
          /\btemp\b/i,
          /\btmp\b/i,
          /console\.log/,
          /console\.debug/,
          /\bWIP\b/,
          /work.in.progress/i
        ];
        script.content_analysis.appears_experimental = experimentalMarkers.some(pattern => pattern.test(content));
        
        contentAnalyzed++;
      } catch (error) {
        console.error(`Content analysis failed for ${script.file_path}:`, error);
      }
    }
    
    console.log(`  Analyzed content for ${contentAnalyzed} scripts\n`);
  }

  private classifyScripts() {
    console.log('🏷️  Classifying scripts with enhanced logic...');
    
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    let definitelyObsolete = 0, likelyObsolete = 0, needsReview = 0, active = 0;
    
    for (const script of this.scriptFiles) {
      script.classification = this.determineClassification(script, ninetyDaysAgo, oneYearAgo);
      script.safe_to_archive = this.isSafeToArchive(script);
      
      switch (script.classification) {
        case 'definitely_obsolete':
          definitelyObsolete++;
          break;
        case 'likely_obsolete':
          likelyObsolete++;
          break;
        case 'needs_review':
          needsReview++;
          break;
        case 'active':
          active++;
          break;
      }
    }
    
    console.log(`  Enhanced Classifications:`);
    console.log(`    🔴 Definitely Obsolete: ${definitelyObsolete}`);
    console.log(`    🟡 Likely Obsolete: ${likelyObsolete}`);
    console.log(`    🟠 Needs Review: ${needsReview}`);
    console.log(`    🟢 Active: ${active}\n`);
  }

  private determineClassification(
    script: ScriptUsageData, 
    ninetyDaysAgo: Date, 
    oneYearAgo: Date
  ): 'definitely_obsolete' | 'likely_obsolete' | 'needs_review' | 'active' {
    
    // Critical files are always active
    if (this.isCriticalFile(script)) {
      script.reason = 'Critical infrastructure file';
      return 'active';
    }
    
    // Files with recent git activity are active
    if (script.git_history.commits_last_90_days > 0) {
      script.reason = `${script.git_history.commits_last_90_days} commits in last 90 days`;
      return 'active';
    }
    
    // Files referenced by other scripts are active
    if (script.dependencies.referenced_by_scripts.length > 0 || 
        script.dependencies.referenced_in_package_json) {
      script.reason = 'Referenced by other scripts or package.json';
      return 'active';
    }
    
    // Files in active CLI pipelines with recent usage are active
    if (script.in_cli_pipeline && script.usage_data && script.usage_data.usage_count > 0) {
      script.reason = 'Part of CLI pipeline with usage history';
      return 'active';
    }
    
    // DEFINITELY OBSOLETE: Multiple red flags
    const obsoleteScore = this.calculateObsoleteScore(script, oneYearAgo);
    if (obsoleteScore >= 4) {
      script.reason = `High obsolete score (${obsoleteScore}): ${this.getObsoleteReasons(script)}`;
      return 'definitely_obsolete';
    }
    
    // LIKELY OBSOLETE: Some red flags
    if (obsoleteScore >= 2) {
      script.reason = `Moderate obsolete score (${obsoleteScore}): ${this.getObsoleteReasons(script)}`;
      return 'likely_obsolete';
    }
    
    // Files with no git history but exist might need review
    if (!script.git_history.last_commit_date) {
      script.reason = 'No git history found - might be untracked';
      return 'needs_review';
    }
    
    // Files with old git history but good error handling might need review
    if (script.git_history.last_commit_date && 
        script.git_history.last_commit_date < oneYearAgo &&
        script.content_analysis.has_error_handling) {
      script.reason = 'Old but has proper error handling - needs manual review';
      return 'needs_review';
    }
    
    // Default to needs review for unclear cases
    script.reason = 'Mixed signals - requires manual assessment';
    return 'needs_review';
  }

  private calculateObsoleteScore(script: ScriptUsageData, oneYearAgo: Date): number {
    let score = 0;
    
    // No git commits in a year (+2 points)
    if (script.git_history.commits_last_year === 0) score += 2;
    
    // Very old last commit (+1 point)
    if (script.git_history.last_commit_date && script.git_history.last_commit_date < oneYearAgo) score += 1;
    
    // Has TODO/FIXME comments (+1 point)
    if (script.content_analysis.has_todo_fixme) score += 1;
    
    // Has deprecated APIs (+2 points)
    if (script.content_analysis.has_deprecated_apis) score += 2;
    
    // Appears experimental (+1 point)
    if (script.content_analysis.appears_experimental) score += 1;
    
    // Has hardcoded paths (+1 point)
    if (script.content_analysis.has_hardcoded_paths) score += 1;
    
    // No error handling (-1 point - reduces obsolete score)
    if (!script.content_analysis.has_error_handling) score += 1;
    
    // Not in CLI pipeline (+1 point)
    if (!script.in_cli_pipeline) score += 1;
    
    return score;
  }

  private getObsoleteReasons(script: ScriptUsageData): string {
    const reasons = [];
    
    if (script.git_history.commits_last_year === 0) reasons.push('no commits this year');
    if (script.content_analysis.has_todo_fixme) reasons.push('has TODO/FIXME');
    if (script.content_analysis.has_deprecated_apis) reasons.push('deprecated APIs');
    if (script.content_analysis.appears_experimental) reasons.push('experimental code');
    if (script.content_analysis.has_hardcoded_paths) reasons.push('hardcoded paths');
    if (!script.content_analysis.has_error_handling) reasons.push('no error handling');
    if (!script.in_cli_pipeline) reasons.push('not in CLI pipeline');
    
    return reasons.join(', ');
  }

  private isCriticalFile(script: ScriptUsageData): boolean {
    const criticalPatterns = [
      /cli\.sh$/,           // Main CLI entry points
      /health-check\.sh$/,  // Health checks
      /package\.json$/,     // Package files
      /start-all-servers/,  // Infrastructure
      /kill-all-servers/,   // Infrastructure
      /tsconfig/,           // TypeScript configs
      /vite\.config/,       // Vite configs
      /tailwind\.config/,   // Tailwind configs
      /eslint\.config/      // ESLint configs
    ];
    
    return criticalPatterns.some(pattern => pattern.test(script.file_name));
  }

  private isSafeToArchive(script: ScriptUsageData): boolean {
    // Critical files are never safe to archive
    if (this.isCriticalFile(script)) {
      return false;
    }
    
    // Active files are not safe to archive
    if (script.classification === 'active') {
      return false;
    }
    
    // Files referenced by others are not safe to archive
    if (script.dependencies.referenced_in_package_json || 
        script.dependencies.referenced_by_scripts.length > 0) {
      return false;
    }
    
    // Only definitely obsolete files are immediately safe to archive
    if (script.classification === 'definitely_obsolete') {
      return true;
    }
    
    // Likely obsolete files might be safe, but need confirmation
    // Needs review files should not be auto-archived
    return false;
  }

  private async generateReport() {
    console.log('📝 Generating report...\n');
    
    const archivable = this.scriptFiles.filter(s => s.safe_to_archive);
    const byClassification = {
      definitely_obsolete: this.scriptFiles.filter(s => s.classification === 'definitely_obsolete'),
      likely_obsolete: this.scriptFiles.filter(s => s.classification === 'likely_obsolete'),
      needs_review: this.scriptFiles.filter(s => s.classification === 'needs_review'),
      active: this.scriptFiles.filter(s => s.classification === 'active')
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
          definitely_obsolete: byClassification.definitely_obsolete.length,
          likely_obsolete: byClassification.likely_obsolete.length,
          needs_review: byClassification.needs_review.length,
          active: byClassification.active.length
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