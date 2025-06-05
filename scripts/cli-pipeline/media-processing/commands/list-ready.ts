#!/usr/bin/env ts-node
/**
 * List Ready Files Command
 * 
 * This command lists expert documents that have completed processing
 * and are ready for content generation.
 * 
 * Usage:
 *   list-ready.ts [options]
 * 
 * Options:
 *   --limit [number]           Limit the number of files to list (default: 200)
 *   --format [format]          Output format (table, json, simple)
 */

import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 200,
  format: 'table'
};

// Get limit if specified
const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  const limitArg = parseInt(args[limitIndex + 1]);
  if (!isNaN(limitArg)) {
    options.limit = limitArg;
  }
}

// Get format if specified
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) {
  const formatArg = args[formatIndex + 1].toLowerCase();
  if (['table', 'json', 'simple'].includes(formatArg)) {
    options.format = formatArg;
  }
}

/**
 * Format list of documents for display
 */
function formatDocuments(documents: any[], format: string): string {
  if (format === 'json') {
    return JSON.stringify(documents, null, 2);
  }
  
  if (format === 'simple') {
    return documents.map(doc => doc.id).join('\n');
  }
  
  // Default: table format
  if (documents.length === 0) {
    return 'No documents found.';
  }
  
  // Create a nice table
  const headers = [
    'ID', 
    'Content Type', 
    'Word Count', 
    'Updated At',
    'Source Name'
  ];
  
  // Calculate column widths
  const columnWidths = [
    Math.max(36, ...documents.map(doc => doc.id.length)),
    Math.max(headers[1].length, ...documents.map(doc => (doc.content_type || '').length)),
    Math.max(headers[2].length, ...documents.map(doc => (doc.word_count?.toString() || '').length)),
    Math.max(headers[3].length, ...documents.map(doc => (doc.updated_at || '').length)),
    Math.max(headers[4].length, ...documents.map(doc => (doc.source_name || '').length))
  ];
  
  // Create header row
  let output = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ') + '\n';
  
  // Create separator row
  output += columnWidths.map(width => '-'.repeat(width)).join('-+-') + '\n';
  
  // Create data rows
  documents.forEach(doc => {
    output += [
      (doc.id || '').padEnd(columnWidths[0]),
      (doc.content_type || '').padEnd(columnWidths[1]),
      (doc.word_count?.toString() || '').padEnd(columnWidths[2]),
      (doc.updated_at || '').padEnd(columnWidths[3]),
      (doc.source_name || '').padEnd(columnWidths[4])
    ].join(' | ') + '\n';
  });
  
  return output;
}

async function main() {
  try {
    // Get the Supabase client using singleton pattern
    const supabaseClientService = SupabaseClientService.getInstance();
    let supabase: any;
    
    try {
      supabase = supabaseClientService.getClient();
      Logger.info('✅ Successfully connected to Supabase');
    } catch (error: any) {
      Logger.error('❌ Error getting Supabase client', error);
      process.exit(1);
    }
    
    // Display configuration
    Logger.info('📋 Listing Ready Files');
    Logger.info(`Limit: ${options.limit}`);
    Logger.info(`Format: ${options.format}`);
    
    // Query for ready documents
    const { data: documents, error: queryError } = await supabase
      .from('google_expert_documents')
      .select(`
        id, 
        content_type, 
        processing_status,
        word_count,
        updated_at,
        source_id, 
        sources_google!inner(name)
      `)
      .eq('content_type', 'presentation')
      .eq('processing_status', 'completed')
      .not('raw_content', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(options.limit);
    
    if (queryError) {
      Logger.error(`❌ Error fetching documents: ${queryError.message}`);
      process.exit(1);
    }
    
    if (!documents || documents.length === 0) {
      Logger.info('ℹ️ No ready documents found');
      process.exit(0);
    }
    
    // Process and format the results
    const formattedDocs = documents.map((doc: any) => ({
      id: doc.id,
      content_type: doc.content_type,
      word_count: doc.word_count || 0,
      updated_at: doc.updated_at ? new Date(doc.updated_at).toLocaleString() : '',
      source_name: doc.sources_google.name
    }));
    
    // Output the results
    const output = formatDocuments(formattedDocs, options.format);
    console.log(output);
    
    Logger.info(`ℹ️ Found ${documents.length} ready documents`);
  } catch (error: any) {
    Logger.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch((error: any) => {
  Logger.error('Unhandled error:', error);
  process.exit(1);
});