#!/usr/bin/env ts-node
/**
 * Script: list-scripts.ts
 * Purpose: List scripts with filtering by pipeline, type, and recency
 * Pipeline: scripts
 * Tags: list, filter, query
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { format } from 'date-fns';

interface ListOptions {
  pipeline?: string;
  type?: string;
  recent?: number;
  archived?: boolean;
  limit?: number;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ListOptions {
  const args = process.argv.slice(2);
  const options: ListOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--pipeline':
      case '-p':
        options.pipeline = args[++i];
        break;
      case '--type':
      case '-t':
        options.type = args[++i];
        break;
      case '--recent':
      case '-r':
        options.recent = parseInt(args[++i]);
        break;
      case '--archived':
      case '-a':
        options.archived = true;
        break;
      case '--limit':
      case '-l':
        options.limit = parseInt(args[++i]);
        break;
      case '--help':
      case '-h':
        console.log(`List Scripts - Display scripts with filtering options

Usage: ./scripts-cli.sh list [options]

Options:
  -p, --pipeline <name>    Filter by CLI pipeline
  -t, --type <type>        Filter by document type
  -r, --recent <days>      Show scripts modified in last N days
  -a, --archived           Include archived scripts
  -l, --limit <count>      Limit number of results (default: 100)
  -h, --help               Show this help message

Examples:
  ./scripts-cli.sh list --pipeline google_sync
  ./scripts-cli.sh list --type deployment-script
  ./scripts-cli.sh list --recent 7 --limit 20`);
        process.exit(0);
    }
  }
  
  return options;
}

/**
 * Main list function
 */
async function listScripts(options: ListOptions = {}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Build query
  let query = supabase
    .from('registry_scripts')
    .select(`
      file_path,
      title,
      language,
      metadata,
      document_type_id,
      ai_assessment,
      ai_generated_tags,
      created_at,
      updated_at,
      last_modified_at
    `)
    .order('last_modified_at', { ascending: false })
    .limit(options.limit || 100);
  
  // Apply filters
  if (options.pipeline) {
    query = query.eq('metadata->>cli_pipeline', options.pipeline);
  }
  
  if (options.type) {
    query = query.eq('document_type_id', options.type);
  }
  
  if (options.recent) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.recent);
    query = query.gte('last_modified_at', cutoffDate.toISOString());
  }
  
  if (!options.archived) {
    // By default, exclude archived scripts
    query = query.not('metadata->>is_archived', 'eq', 'true');
  }
  
  const { data: scripts, error } = await query;
  
  if (error) {
    console.error('❌ Error fetching scripts:', error);
    return;
  }
  
  if (!scripts || scripts.length === 0) {
    console.log('No scripts found matching criteria');
    return;
  }
  
  // Group by pipeline
  const byPipeline = scripts.reduce((acc, script) => {
    const pipeline = script.metadata?.cli_pipeline || 'root';
    if (!acc[pipeline]) acc[pipeline] = [];
    acc[pipeline].push(script);
    return acc;
  }, {} as Record<string, typeof scripts>);
  
  // Display results
  console.log(`\n📋 Script Registry (${scripts.length} scripts)\n`);
  
  Object.entries(byPipeline)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([pipeline, pipelineScripts]) => {
      console.log(`📁 ${pipeline}/ (${pipelineScripts.length} scripts)`);
      console.log('─'.repeat(60));
      
      pipelineScripts.forEach(script => {
        const size = script.metadata?.file_size 
          ? formatFileSize(script.metadata.file_size)
          : 'unknown';
        const modified = script.last_modified_at
          ? format(new Date(script.last_modified_at), 'MMM dd, yyyy HH:mm')
          : 'unknown';
        const isArchived = script.metadata?.is_archived || false;
        
        console.log(`\n  📄 ${script.title}${isArchived ? ' [ARCHIVED]' : ''}`);
        console.log(`     Path: ${script.file_path}`);
        console.log(`     Language: ${script.language} | Size: ${size} | Modified: ${modified}`);
        
        if (script.document_type_id) {
          const confidence = script.ai_assessment?.confidence 
            ? `(${(script.ai_assessment.confidence * 100).toFixed(0)}% confidence)`
            : '';
          console.log(`     Type: ${script.document_type_id} ${confidence}`);
        }
        
        if (script.ai_assessment?.purpose) {
          console.log(`     Purpose: ${script.ai_assessment.purpose}`);
        }
        
        if (script.ai_generated_tags && script.ai_generated_tags.length > 0) {
          console.log(`     Tags: ${script.ai_generated_tags.join(', ')}`);
        }
      });
      
      console.log(''); // Empty line between pipelines
    });
  
  // Summary statistics
  const stats = {
    total: scripts.length,
    byType: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    archived: scripts.filter(s => s.metadata?.is_archived).length,
    classified: scripts.filter(s => s.document_type_id).length
  };
  
  scripts.forEach(script => {
    if (script.document_type_id) {
      stats.byType[script.document_type_id] = (stats.byType[script.document_type_id] || 0) + 1;
    }
    stats.byLanguage[script.language] = (stats.byLanguage[script.language] || 0) + 1;
  });
  
  console.log('📊 Summary Statistics:');
  console.log(`Total scripts: ${stats.total}`);
  console.log(`Classified: ${stats.classified} (${((stats.classified / stats.total) * 100).toFixed(1)}%)`);
  if (options.archived) {
    console.log(`Archived: ${stats.archived}`);
  }
  
  if (Object.keys(stats.byType).length > 0) {
    console.log('\nBy Document Type:');
    Object.entries(stats.byType)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
  }
  
  console.log('\nBy Language:');
  Object.entries(stats.byLanguage)
    .sort(([,a], [,b]) => b - a)
    .forEach(([lang, count]) => {
      console.log(`  ${lang}: ${count}`);
    });
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  listScripts(options).catch(console.error);
}

export { listScripts };