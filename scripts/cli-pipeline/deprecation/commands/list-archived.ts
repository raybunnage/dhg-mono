#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

interface ArchivedScript {
  id: string;
  archive_id: string;
  archive_date: string;
  original_path: string;
  archived_path: string;
  file_name: string;
  file_size_bytes: number;
  script_type: string;
  pipeline_name?: string;
  command_name?: string;
  last_used?: string;
  usage_count: number;
  archive_reason?: string;
  replacement_command?: string;
  restored: boolean;
  restored_date?: string;
}

class ArchivedScriptLister {
  private supabase = SupabaseClientService.getInstance().getClient();

  async list(options: {
    showRestored?: boolean;
    type?: string;
    pipeline?: string;
    days?: number;
    format?: 'table' | 'json' | 'csv';
  } = {}) {
    const { 
      showRestored = false, 
      type, 
      pipeline, 
      days,
      format = 'table' 
    } = options;
    
    console.log('📋 Archived Scripts Listing\n');
    
    // Build query
    let query = this.supabase
      .from('sys_archived_scripts_files')
      .select('*');
    
    // Apply filters
    if (!showRestored) {
      query = query.eq('restored', false);
    }
    
    if (type) {
      query = query.eq('script_type', type);
    }
    
    if (pipeline) {
      query = query.eq('pipeline_name', pipeline);
    }
    
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query = query.gte('archive_date', cutoffDate.toISOString());
    }
    
    // Execute query
    const { data, error } = await query.order('archive_date', { ascending: false });
    
    if (error) {
      console.error('Database error:', error);
      process.exit(1);
    }
    
    if (!data || data.length === 0) {
      console.log('No archived scripts found matching criteria.');
      return;
    }
    
    // Display results based on format
    switch (format) {
      case 'json':
        this.displayJson(data);
        break;
      case 'csv':
        this.displayCsv(data);
        break;
      default:
        this.displayTable(data);
    }
    
    // Summary statistics
    this.displaySummary(data);
  }

  private displayTable(scripts: ArchivedScript[]) {
    // Group by archive ID
    const archiveGroups = new Map<string, ArchivedScript[]>();
    
    for (const script of scripts) {
      if (!archiveGroups.has(script.archive_id)) {
        archiveGroups.set(script.archive_id, []);
      }
      archiveGroups.get(script.archive_id)!.push(script);
    }
    
    // Display each archive group
    for (const [archiveId, groupScripts] of archiveGroups) {
      const archiveDate = new Date(groupScripts[0].archive_date);
      const totalSize = groupScripts.reduce((sum, s) => sum + (s.file_size_bytes || 0), 0);
      
      console.log(`\n📦 Archive: ${archiveId}`);
      console.log(`   Date: ${archiveDate.toLocaleDateString()} ${archiveDate.toLocaleTimeString()}`);
      console.log(`   Files: ${groupScripts.length}`);
      console.log(`   Total Size: ${this.formatBytes(totalSize)}`);
      console.log('   ' + '─'.repeat(76));
      
      for (const script of groupScripts.sort((a, b) => a.original_path.localeCompare(b.original_path))) {
        const restored = script.restored ? '✓' : ' ';
        const type = this.getTypeEmoji(script.script_type);
        const size = this.formatBytes(script.file_size_bytes || 0);
        
        console.log(`   ${restored} ${type} ${script.original_path}`);
        
        if (script.pipeline_name) {
          console.log(`      Pipeline: ${script.pipeline_name}`);
        }
        
        if (script.last_used) {
          const lastUsed = new Date(script.last_used);
          console.log(`      Last used: ${lastUsed.toLocaleDateString()} (${script.usage_count} times)`);
        }
        
        if (script.archive_reason) {
          console.log(`      Reason: ${script.archive_reason}`);
        }
        
        if (script.replacement_command) {
          console.log(`      Replacement: ${script.replacement_command}`);
        }
        
        if (script.restored && script.restored_date) {
          console.log(`      Restored: ${new Date(script.restored_date).toLocaleDateString()}`);
        }
      }
    }
  }

  private displayJson(scripts: ArchivedScript[]) {
    console.log(JSON.stringify(scripts, null, 2));
  }

  private displayCsv(scripts: ArchivedScript[]) {
    // CSV header
    console.log('archive_id,archive_date,original_path,file_name,script_type,pipeline_name,file_size_bytes,last_used,usage_count,restored,archive_reason');
    
    // CSV rows
    for (const script of scripts) {
      const row = [
        script.archive_id,
        script.archive_date,
        script.original_path,
        script.file_name,
        script.script_type,
        script.pipeline_name || '',
        script.file_size_bytes || 0,
        script.last_used || '',
        script.usage_count || 0,
        script.restored ? 'true' : 'false',
        `"${(script.archive_reason || '').replace(/"/g, '""')}"`
      ].join(',');
      
      console.log(row);
    }
  }

  private displaySummary(scripts: ArchivedScript[]) {
    const totalSize = scripts.reduce((sum, s) => sum + (s.file_size_bytes || 0), 0);
    const restoredCount = scripts.filter(s => s.restored).length;
    const activeCount = scripts.filter(s => !s.restored).length;
    
    // Count by type
    const typeCount = new Map<string, number>();
    for (const script of scripts) {
      typeCount.set(script.script_type, (typeCount.get(script.script_type) || 0) + 1);
    }
    
    console.log('\n=== SUMMARY ===\n');
    console.log(`Total archived scripts: ${scripts.length}`);
    console.log(`Active archives: ${activeCount}`);
    console.log(`Restored: ${restoredCount}`);
    console.log(`Total size: ${this.formatBytes(totalSize)}`);
    
    console.log('\nBy Type:');
    for (const [type, count] of typeCount) {
      console.log(`  ${this.getTypeEmoji(type)} ${type}: ${count}`);
    }
    
    // Recent archives
    const recentArchives = scripts
      .filter(s => !s.restored)
      .slice(0, 5);
    
    if (recentArchives.length > 0) {
      console.log('\nMost Recent Archives:');
      for (const script of recentArchives) {
        const date = new Date(script.archive_date);
        console.log(`  ${date.toLocaleDateString()} - ${script.original_path}`);
      }
    }
    
    // Restore tip
    if (activeCount > 0) {
      console.log('\n💡 To restore a script, use:');
      console.log('   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-script --path <original-path>');
    }
  }

  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'cli_pipeline': '🔧',
      'root_script': '📜',
      'python': '🐍',
      'app_script': '📱',
      'other': '📄'
    };
    return emojis[type] || '📄';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    showRestored: args.includes('--show-restored'),
    type: args.find((a, i) => args[i - 1] === '--type')?.toString(),
    pipeline: args.find((a, i) => args[i - 1] === '--pipeline')?.toString(),
    days: parseInt(args.find((a, i) => args[i - 1] === '--days')?.toString() || '0'),
    format: (args.find((a, i) => args[i - 1] === '--format')?.toString() || 'table') as 'table' | 'json' | 'csv'
  };
  
  if (args.includes('--help')) {
    console.log('Usage: list-archived [options]');
    console.log('\nOptions:');
    console.log('  --show-restored     Include restored scripts');
    console.log('  --type <type>       Filter by script type (cli_pipeline, root_script, python, app_script)');
    console.log('  --pipeline <name>   Filter by pipeline name');
    console.log('  --days <n>          Show archives from last n days');
    console.log('  --format <fmt>      Output format: table (default), json, csv');
    console.log('  --help              Show this help');
    console.log('\nExamples:');
    console.log('  list-archived');
    console.log('  list-archived --type cli_pipeline');
    console.log('  list-archived --pipeline google_sync --show-restored');
    console.log('  list-archived --days 7 --format json');
    process.exit(0);
  }
  
  const lister = new ArchivedScriptLister();
  lister.list(options).catch(console.error);
}