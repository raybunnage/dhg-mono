#!/usr/bin/env ts-node
/**
 * Cache Statistics Command
 * 
 * Shows statistics about the local media cache including size, file counts, and cleanup candidates.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { MediaFileManager } from '../../../../packages/shared/services/media-file-manager';
import { Logger } from '../../../../packages/shared/utils';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

interface CacheStatsOptions {
  cleanup?: boolean;
  verbose?: boolean;
}

async function showCacheStats(options: CacheStatsOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Load config
  const configPath = path.join(process.cwd(), 'config', 'media-processing.yaml');
  let config: any = {
    processing: { temp_dir: './file_types' },
    storage: {
      auto_cleanup: true,
      max_cache_size: '50GB',
      retention_days: 7
    }
  };

  if (fs.existsSync(configPath)) {
    try {
      config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;
    } catch (error) {
      Logger.warn('Failed to load config, using defaults');
    }
  }

  const fileManager = new MediaFileManager(supabase, {
    tempDir: config.processing.temp_dir,
    maxCacheSize: config.storage.max_cache_size,
    retentionDays: config.storage.retention_days,
    autoCleanup: config.storage.auto_cleanup
  });

  try {
    Logger.info('📊 Analyzing media cache...\n');

    const stats = await fileManager.getCacheStats();

    console.log('Cache Statistics:');
    console.log('─'.repeat(50));
    console.log(`Total Files:      ${stats.totalFiles}`);
    console.log(`Total Size:       ${formatBytes(stats.totalSize)}`);
    console.log(`Old Files:        ${stats.oldFiles} (older than ${config.storage.retention_days} days)`);
    console.log(`Processed Files:  ${stats.processedFiles}`);
    console.log('─'.repeat(50));

    // Show directory breakdown if verbose
    if (options.verbose) {
      console.log('\nDirectory Breakdown:');
      const dirs = ['mp4', 'm4a', 'transcripts', 'symlinks'];
      
      for (const dir of dirs) {
        const dirPath = path.join(config.processing.temp_dir, dir);
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);
          let dirSize = 0;
          
          for (const file of files) {
            try {
              const stat = fs.statSync(path.join(dirPath, file));
              dirSize += stat.size;
            } catch (error) {
              // Ignore
            }
          }
          
          console.log(`  ${dir.padEnd(15)} ${files.length} files (${formatBytes(dirSize)})`);
        }
      }
    }

    // Show cleanup preview
    if (stats.oldFiles > 0) {
      console.log('\n🧹 Cleanup Preview:');
      console.log(`  ${stats.oldFiles} files can be cleaned up`);
      console.log(`  Run with --cleanup to remove old processed files`);
    }

    // Perform cleanup if requested
    if (options.cleanup) {
      console.log('\n🧹 Starting cleanup...');
      await fileManager.cleanup();
      console.log('✅ Cleanup complete');
    }

  } catch (error: any) {
    Logger.error(`Failed to get cache statistics: ${error.message}`);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: CacheStatsOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--cleanup':
      options.cleanup = true;
      break;
    case '--verbose':
    case '-v':
      options.verbose = true;
      break;
    case '--help':
      console.log(`
Cache Statistics Command - Show media cache statistics

Usage:
  cache-stats.ts [options]

Options:
  --cleanup        Perform cleanup of old processed files
  --verbose, -v    Show detailed directory breakdown

Examples:
  # Show basic cache statistics
  cache-stats.ts
  
  # Show detailed breakdown
  cache-stats.ts --verbose
  
  # Clean up old files
  cache-stats.ts --cleanup
      `);
      process.exit(0);
  }
}

// Run the command
showCacheStats(options).catch(error => {
  Logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});