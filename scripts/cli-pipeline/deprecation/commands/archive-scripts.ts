#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface ArchiveManifest {
  archive_date: string;
  archive_id: string;
  total_files: number;
  total_size_bytes: number;
  scripts: ArchiveEntry[];
}

interface ArchiveEntry {
  original_path: string;
  archived_path: string;
  file_size: number;
  last_modified: string;
  last_used?: string;
  usage_count?: number;
  reason: string;
  replacement?: string;
}

class ScriptArchiver {
  private supabase = SupabaseClientService.getInstance().getClient();
  private projectRoot = path.join(__dirname, '../../../../');
  private archiveDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
  private archiveId = `${this.archiveDate}-${Date.now()}`;
  private manifest: ArchiveManifest = {
    archive_date: new Date().toISOString(),
    archive_id: this.archiveId,
    total_files: 0,
    total_size_bytes: 0,
    scripts: []
  };

  async archive(options: {
    dryRun?: boolean;
    inputFile?: string;
    limit?: number;
    interactive?: boolean;
  } = {}) {
    const { dryRun = true, inputFile, limit, interactive = false } = options;
    
    console.log('📦 Script Archiving Tool\n');
    console.log(`Archive Date: ${this.archiveDate}`);
    console.log(`Archive ID: ${this.archiveId}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);
    
    // Step 1: Load archivable scripts
    const scripts = await this.loadArchivableScripts(inputFile);
    
    if (scripts.length === 0) {
      console.log('No scripts to archive.');
      return;
    }
    
    // Apply limit if specified
    const scriptsToArchive = limit ? scripts.slice(0, limit) : scripts;
    
    console.log(`Found ${scriptsToArchive.length} scripts to archive\n`);
    
    // Step 2: Interactive confirmation if requested
    if (interactive && !dryRun) {
      const confirmed = await this.confirmArchive(scriptsToArchive);
      if (!confirmed) {
        console.log('Archive cancelled.');
        return;
      }
    }
    
    // Step 3: Create archive structure
    if (!dryRun) {
      await this.createArchiveDirectories();
    }
    
    // Step 4: Archive each script
    for (const script of scriptsToArchive) {
      await this.archiveScript(script, dryRun);
    }
    
    // Step 5: Save manifest and update database
    if (!dryRun) {
      await this.saveManifest();
      await this.updateDatabase();
      await this.commitToGit();
    }
    
    // Step 6: Generate summary
    this.generateSummary(dryRun);
  }

  private async loadArchivableScripts(inputFile?: string): Promise<any[]> {
    if (inputFile) {
      // Load from specified file
      const filePath = path.join(this.projectRoot, inputFile);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.archivable_scripts || [];
    } else {
      // Load from latest analysis
      const reportsDir = path.join(this.projectRoot, 'docs/script-reports');
      const files = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('script-usage-analysis-'))
        .sort()
        .reverse();
      
      if (files.length === 0) {
        console.error('No analysis reports found. Run analyze-script-usage first.');
        process.exit(1);
      }
      
      const latestReport = path.join(reportsDir, files[0]);
      console.log(`Loading from: ${files[0]}\n`);
      
      const data = JSON.parse(fs.readFileSync(latestReport, 'utf-8'));
      return data.archivable_scripts || [];
    }
  }

  private async confirmArchive(scripts: any[]): Promise<boolean> {
    console.log('Scripts to be archived:');
    console.log('─'.repeat(80));
    
    for (const script of scripts) {
      console.log(`  ${script.file_path}`);
    }
    
    console.log('\n⚠️  This will move the above files to archive directories.');
    console.log('You can restore them later using the restore-script command.\n');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      readline.question('Continue with archive? (yes/no): ', (answer: string) => {
        readline.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  private async createArchiveDirectories() {
    const archiveDirs = [
      'scripts/.archived_root_scripts/' + this.archiveDate,
      'scripts/cli-pipeline/.archived_pipeline_scripts/' + this.archiveDate
    ];
    
    for (const dir of archiveDirs) {
      const fullPath = path.join(this.projectRoot, dir);
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  private async archiveScript(script: any, dryRun: boolean) {
    const originalPath = path.join(this.projectRoot, script.file_path);
    
    // Determine archive location
    let archiveDir: string;
    if (script.in_cli_pipeline) {
      const pipelineName = script.pipeline_name || 'unknown';
      archiveDir = `scripts/cli-pipeline/${pipelineName}/.archived_scripts`;
    } else if (script.file_path.startsWith('scripts/')) {
      // For root scripts, maintain directory structure in archive
      const relPath = path.dirname(script.file_path.replace('scripts/', ''));
      archiveDir = `scripts/.archived_root_scripts/${this.archiveDate}/${relPath}`;
    } else {
      archiveDir = `scripts/.archived_root_scripts/${this.archiveDate}/misc`;
    }
    
    const archiveFileName = `${path.basename(script.file_name, path.extname(script.file_name))}.${this.archiveDate}${path.extname(script.file_name)}`;
    const archivePath = path.join(archiveDir, archiveFileName);
    const fullArchivePath = path.join(this.projectRoot, archivePath);
    
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Archiving: ${script.file_path}`);
    console.log(`  → ${archivePath}`);
    
    if (!dryRun) {
      // Create archive directory
      fs.mkdirSync(path.dirname(fullArchivePath), { recursive: true });
      
      // Move file
      fs.renameSync(originalPath, fullArchivePath);
      
      // Add to manifest
      const stats = fs.statSync(fullArchivePath);
      this.manifest.scripts.push({
        original_path: script.file_path,
        archived_path: archivePath,
        file_size: stats.size,
        last_modified: script.last_modified,
        last_used: script.usage_data?.last_used?.toISOString(),
        usage_count: script.usage_data?.usage_count,
        reason: script.reason || 'Dormant script with no dependencies',
        replacement: script.replacement
      });
      
      this.manifest.total_files++;
      this.manifest.total_size_bytes += stats.size;
    }
    
    console.log('');
  }

  private async saveManifest() {
    const manifestPath = path.join(
      this.projectRoot,
      `scripts/.archived_root_scripts/${this.archiveDate}/manifest.json`
    );
    
    fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));
    console.log(`✅ Manifest saved to: ${manifestPath}\n`);
  }

  private async updateDatabase() {
    console.log('📊 Updating database tracking...');
    
    for (const entry of this.manifest.scripts) {
      // Determine script type
      let scriptType: string;
      if (entry.original_path.includes('cli-pipeline/')) {
        scriptType = 'cli_pipeline';
      } else if (entry.original_path.includes('scripts/python/')) {
        scriptType = 'python';
      } else if (entry.original_path.startsWith('apps/')) {
        scriptType = 'app_script';
      } else if (entry.original_path.startsWith('scripts/')) {
        scriptType = 'root_script';
      } else {
        scriptType = 'other';
      }
      
      // Extract pipeline name if applicable
      const pipelineName = entry.original_path.includes('cli-pipeline/') 
        ? entry.original_path.split('/')[2] 
        : undefined;
      
      const { error } = await this.supabase
        .from('sys_archived_scripts_files')
        .insert({
          archive_id: this.archiveId,
          archive_date: new Date().toISOString(),
          original_path: entry.original_path,
          archived_path: entry.archived_path,
          file_name: path.basename(entry.original_path),
          file_extension: path.extname(entry.original_path),
          file_size_bytes: entry.file_size,
          script_type: scriptType,
          pipeline_name: pipelineName,
          command_name: path.basename(entry.original_path, path.extname(entry.original_path)),
          last_modified: entry.last_modified,
          last_used: entry.last_used,
          usage_count: entry.usage_count || 0,
          archive_reason: entry.reason,
          replacement_command: entry.replacement
        });
      
      if (error) {
        console.error(`Error tracking ${entry.original_path}:`, error);
      }
    }
    
    console.log(`✅ Updated tracking for ${this.manifest.scripts.length} files\n`);
  }

  private async commitToGit() {
    console.log('📝 Committing to git...');
    
    try {
      // Stage all changes
      execSync('git add -A', { cwd: this.projectRoot });
      
      // Create commit message
      const message = `chore: archive ${this.manifest.total_files} unused scripts

Archive ID: ${this.archiveId}
Total files: ${this.manifest.total_files}
Total size: ${(this.manifest.total_size_bytes / 1024).toFixed(1)} KB

Scripts archived to maintain clean codebase.
All scripts can be restored using deprecation-cli.sh restore-script`;
      
      execSync(`git commit -m "${message}"`, { cwd: this.projectRoot });
      console.log('✅ Changes committed to git\n');
    } catch (error) {
      console.error('Git commit failed:', error);
    }
  }

  private generateSummary(dryRun: boolean) {
    console.log('=== ARCHIVE SUMMARY ===\n');
    
    if (dryRun) {
      console.log('🔍 DRY RUN COMPLETE - No files were actually moved\n');
    }
    
    console.log(`Archive ID: ${this.archiveId}`);
    console.log(`Total files: ${this.manifest.total_files}`);
    console.log(`Total size: ${(this.manifest.total_size_bytes / 1024).toFixed(1)} KB`);
    
    if (!dryRun) {
      console.log('\n✅ Archive complete!');
      console.log('\nTo restore a script, use:');
      console.log('  ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-script --path <original-path>');
      console.log('\nTo restore all scripts from this archive:');
      console.log(`  ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id ${this.archiveId}`);
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: !args.includes('--execute'),
    inputFile: args.find((a, i) => args[i - 1] === '--input')?.toString(),
    limit: parseInt(args.find((a, i) => args[i - 1] === '--limit')?.toString() || '0'),
    interactive: args.includes('--interactive')
  };
  
  if (args.includes('--help')) {
    console.log('Usage: archive-scripts [options]');
    console.log('\nOptions:');
    console.log('  --execute       Actually move files (default is dry run)');
    console.log('  --input <file>  Use specific analysis file');
    console.log('  --limit <n>     Archive only first n scripts');
    console.log('  --interactive   Confirm before archiving');
    console.log('  --help          Show this help');
    process.exit(0);
  }
  
  const archiver = new ScriptArchiver();
  archiver.archive(options).catch(console.error);
}