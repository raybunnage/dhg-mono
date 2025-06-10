#!/usr/bin/env ts-node
import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

interface ScriptAnalysis {
  path: string;
  filename: string;
  extension: string;
  directory: string;
  size: number;
  lastModified: Date;
  isExecutable: boolean;
  category: string;
  usage: 'active' | 'deprecated' | 'unknown';
  reason: string;
  shouldMigrate: boolean;
  targetPipeline?: string;
}

async function analyzeRootScripts(): Promise<void> {
  console.log('🔍 Analyzing Root Scripts Directory\n');
  
  const scriptsDir = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts';
  const analyses: ScriptAnalysis[] = [];
  
  // Get all script files recursively (excluding cli-pipeline)
  const scriptFiles = await findScripts(scriptsDir);
  
  console.log(`📊 Found ${scriptFiles.length} scripts to analyze\n`);
  
  for (const filePath of scriptFiles) {
    const analysis = await analyzeScript(filePath);
    analyses.push(analysis);
  }
  
  // Generate report
  await generateReport(analyses);
}

async function findScripts(dir: string): Promise<string[]> {
  const scripts: string[] = [];
  const scriptExtensions = ['.sh', '.ts', '.js', '.py', '.sql', '.mjs'];
  
  async function walkDir(currentDir: string): Promise<void> {
    // Skip cli-pipeline directory and archived directories
    if (currentDir.includes('cli-pipeline') || currentDir.includes('.archived')) {
      return;
    }
    
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && scriptExtensions.some(ext => entry.name.endsWith(ext))) {
        scripts.push(fullPath);
      }
    }
  }
  
  await walkDir(dir);
  return scripts;
}

async function analyzeScript(filePath: string): Promise<ScriptAnalysis> {
  const stats = await fs.stat(filePath);
  const filename = basename(filePath);
  const extension = extname(filePath);
  const directory = dirname(filePath).replace('/Users/raybunnage/Documents/github/dhg-mono-admin-code/scripts/', '');
  
  // Check if file is executable
  const isExecutable = !!(stats.mode & parseInt('111', 8));
  
  // Read file content for analysis (first 1000 chars)
  let content = '';
  try {
    const fullContent = await fs.readFile(filePath, 'utf-8');
    content = fullContent.slice(0, 1000).toLowerCase();
  } catch (error) {
    // Binary file or permission issue
  }
  
  // Categorize script
  const category = categorizeScript(filePath, filename, content);
  
  // Determine usage pattern
  const { usage, reason, shouldMigrate, targetPipeline } = determineUsage(filePath, filename, content, stats.mtime);
  
  return {
    path: filePath,
    filename,
    extension,
    directory,
    size: stats.size,
    lastModified: stats.mtime,
    isExecutable,
    category,
    usage,
    reason,
    shouldMigrate,
    targetPipeline
  };
}

function categorizeScript(filePath: string, filename: string, content: string): string {
  // Database scripts
  if (filename.includes('.sql') || content.includes('supabase') || content.includes('create table')) {
    return 'database';
  }
  
  // Server/API scripts
  if (content.includes('server') || content.includes('express') || content.includes('listen') || filename.includes('server')) {
    return 'server';
  }
  
  // Media processing
  if (content.includes('ffmpeg') || content.includes('audio') || content.includes('video') || filename.includes('whisper')) {
    return 'media';
  }
  
  // Google/Drive integration
  if (content.includes('google') || content.includes('drive') || content.includes('gmail')) {
    return 'google';
  }
  
  // Build/deployment
  if (content.includes('build') || content.includes('deploy') || filename.includes('build') || filename.includes('deploy')) {
    return 'deployment';
  }
  
  // Testing
  if (content.includes('test') || filename.includes('test') || content.includes('jest') || content.includes('spec')) {
    return 'testing';
  }
  
  // Utilities
  if (content.includes('util') || filename.includes('util') || content.includes('helper')) {
    return 'utility';
  }
  
  // Migration scripts
  if (content.includes('migrat') || filename.includes('migrat')) {
    return 'migration';
  }
  
  // Backup/restore
  if (content.includes('backup') || content.includes('restore') || filename.includes('backup')) {
    return 'backup';
  }
  
  // Python AI/ML scripts
  if (filePath.includes('python') && (content.includes('import') || content.includes('def '))) {
    return 'python-ai';
  }
  
  return 'uncategorized';
}

function determineUsage(filePath: string, filename: string, content: string, lastModified: Date): {
  usage: 'active' | 'deprecated' | 'unknown';
  reason: string;
  shouldMigrate: boolean;
  targetPipeline?: string;
} {
  const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
  
  // Definitely deprecated patterns
  if (filename.includes('old') || filename.includes('backup') || filename.includes('deprecated') || 
      filename.includes('legacy') || filename.includes('temp') || filename.includes('test-')) {
    return {
      usage: 'deprecated',
      reason: 'Contains deprecated naming patterns',
      shouldMigrate: false
    };
  }
  
  // Very old files (>30 days) with small size might be deprecated
  if (daysSinceModified > 30 && content.length < 500) {
    return {
      usage: 'deprecated',
      reason: 'Old file with minimal content',
      shouldMigrate: false
    };
  }
  
  // Recently modified files are likely active
  if (daysSinceModified < 7) {
    const targetPipeline = suggestTargetPipeline(filename, content);
    return {
      usage: 'active',
      reason: 'Recently modified',
      shouldMigrate: !!targetPipeline,
      targetPipeline
    };
  }
  
  // Files with substantial content and executable permissions
  if (content.length > 1000 && filename.includes('cli')) {
    const targetPipeline = suggestTargetPipeline(filename, content);
    return {
      usage: 'active',
      reason: 'Substantial CLI script',
      shouldMigrate: true,
      targetPipeline
    };
  }
  
  // SQL files might be migration scripts
  if (filename.endsWith('.sql')) {
    return {
      usage: 'active',
      reason: 'Database script - needs review',
      shouldMigrate: true,
      targetPipeline: 'database'
    };
  }
  
  return {
    usage: 'unknown',
    reason: `Modified ${Math.round(daysSinceModified)} days ago - needs manual review`,
    shouldMigrate: false
  };
}

function suggestTargetPipeline(filename: string, content: string): string | undefined {
  if (content.includes('supabase') || filename.includes('db') || filename.includes('database')) {
    return 'database';
  }
  if (content.includes('google') || content.includes('drive')) {
    return 'google_sync';
  }
  if (content.includes('media') || content.includes('audio') || content.includes('video')) {
    return 'media-processing';
  }
  if (content.includes('doc') || content.includes('markdown')) {
    return 'documentation';
  }
  if (content.includes('expert') || content.includes('profile')) {
    return 'experts';
  }
  if (content.includes('auth') || content.includes('user') || content.includes('login')) {
    return 'auth';
  }
  if (content.includes('server') || content.includes('api')) {
    return 'system';
  }
  
  return undefined;
}

async function generateReport(analyses: ScriptAnalysis[]): Promise<void> {
  console.log('📈 Root Scripts Analysis Report');
  console.log('='.repeat(80));
  
  // Summary stats
  const totalScripts = analyses.length;
  const activeScripts = analyses.filter(a => a.usage === 'active').length;
  const deprecatedScripts = analyses.filter(a => a.usage === 'deprecated').length;
  const unknownScripts = analyses.filter(a => a.usage === 'unknown').length;
  const shouldMigrate = analyses.filter(a => a.shouldMigrate).length;
  
  console.log(`📊 Summary:`);
  console.log(`   Total Scripts: ${totalScripts}`);
  console.log(`   Active: ${activeScripts}`);
  console.log(`   Deprecated: ${deprecatedScripts}`);
  console.log(`   Unknown: ${unknownScripts}`);
  console.log(`   Should Migrate: ${shouldMigrate}`);
  
  // Category breakdown
  console.log('\n📁 By Category:');
  const categories = new Map<string, number>();
  for (const analysis of analyses) {
    categories.set(analysis.category, (categories.get(analysis.category) || 0) + 1);
  }
  for (const [category, count] of Array.from(categories.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${category}: ${count}`);
  }
  
  // Directory breakdown
  console.log('\n📂 By Directory:');
  const directories = new Map<string, number>();
  for (const analysis of analyses) {
    const dir = analysis.directory || 'root';
    directories.set(dir, (directories.get(dir) || 0) + 1);
  }
  for (const [dir, count] of Array.from(directories.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${dir}: ${count}`);
  }
  
  // Migration candidates
  console.log('\n🔄 Migration Candidates:');
  const migrationCandidates = analyses.filter(a => a.shouldMigrate);
  const pipelineTargets = new Map<string, ScriptAnalysis[]>();
  
  for (const candidate of migrationCandidates) {
    const target = candidate.targetPipeline || 'unknown';
    if (!pipelineTargets.has(target)) {
      pipelineTargets.set(target, []);
    }
    pipelineTargets.get(target)!.push(candidate);
  }
  
  for (const [pipeline, scripts] of pipelineTargets) {
    console.log(`   → ${pipeline}: ${scripts.length} scripts`);
    for (const script of scripts.slice(0, 3)) {
      console.log(`     - ${script.filename}`);
    }
    if (scripts.length > 3) {
      console.log(`     ... and ${scripts.length - 3} more`);
    }
  }
  
  // Deprecation candidates
  console.log('\n🗑️  Deprecation Candidates:');
  const deprecationCandidates = analyses.filter(a => a.usage === 'deprecated');
  console.log(`   ${deprecationCandidates.length} scripts ready for archival:`);
  for (const script of deprecationCandidates.slice(0, 10)) {
    console.log(`   - ${script.filename} (${script.reason})`);
  }
  if (deprecationCandidates.length > 10) {
    console.log(`   ... and ${deprecationCandidates.length - 10} more`);
  }
  
  // Save detailed report
  const reportPath = '/Users/raybunnage/Documents/github/dhg-mono-admin-code/docs/script-reports/root-scripts-analysis-2025-06-08.json';
  await fs.writeFile(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    total_scripts: totalScripts,
    summary: {
      active: activeScripts,
      deprecated: deprecatedScripts,
      unknown: unknownScripts,
      migration_candidates: shouldMigrate
    },
    analyses: analyses.map(a => ({
      path: a.path.replace('/Users/raybunnage/Documents/github/dhg-mono-admin-code/', ''),
      filename: a.filename,
      category: a.category,
      usage: a.usage,
      reason: a.reason,
      shouldMigrate: a.shouldMigrate,
      targetPipeline: a.targetPipeline,
      size: a.size,
      lastModified: a.lastModified.toISOString(),
      directory: a.directory
    }))
  }, null, 2));
  
  console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  
  console.log('\n🎯 Recommended Actions:');
  console.log('1. Archive deprecated scripts to reduce clutter');
  console.log('2. Migrate active scripts to appropriate pipelines');
  console.log('3. Review unknown scripts for usage patterns');
  console.log('4. Update CLI pipeline registry with migrated scripts');
}

// Main execution
analyzeRootScripts().catch(console.error);