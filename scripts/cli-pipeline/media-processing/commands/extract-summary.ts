#!/usr/bin/env ts-node
/**
 * Extract Summary Command
 * 
 * This command extracts and displays the summary from a document's processed_content.
 * 
 * Usage:
 *   extract-summary.ts <documentId> [options]
 * 
 * Options:
 *   --format [text|json|markdown]  Output format (default: text)
 *   --output [path]               Save to file instead of displaying
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { LogLevel } from '../../../../packages/shared/utils/logger';

// Initialize logger
Logger.setLevel(LogLevel.INFO);

// Process command line arguments
const args = process.argv.slice(2);
const options = {
  format: 'text',
  output: '',
  documentId: ''
};

// Get document ID (first non-option argument)
const documentIdArg = args.find(arg => !arg.startsWith('--'));
if (documentIdArg) {
  options.documentId = documentIdArg;
}

// Get format if specified
const formatIndex = args.indexOf('--format');
if (formatIndex !== -1 && args[formatIndex + 1]) {
  const format = args[formatIndex + 1].toLowerCase();
  if (['text', 'json', 'markdown'].includes(format)) {
    options.format = format;
  }
}

// Get output path if specified
const outputIndex = args.indexOf('--output');
if (outputIndex !== -1 && args[outputIndex + 1]) {
  options.output = args[outputIndex + 1];
}

/**
 * Extract summary from a document
 */
async function extractSummary(documentId: string, supabase: any): Promise<any> {
  try {
    // Get the document
    const { data, error } = await supabase
      .from('expert_documents')
      .select('id, raw_content, processed_content, word_count')
      .eq('id', documentId)
      .single();
    
    if (error) {
      return { success: false, error: `Error fetching document: ${error.message}` };
    }
    
    if (!data) {
      return { success: false, error: `Document with ID ${documentId} not found` };
    }
    
    // Extract summary from processed_content
    const summary = data.processed_content?.summary?.text;
    
    if (!summary) {
      return { 
        success: false, 
        error: 'No summary found in document',
        document: data 
      };
    }
    
    return {
      success: true,
      summary,
      title: data.processed_content?.title || 'Untitled Document',
      word_count: data.word_count || 0,
      document: data
    };
  } catch (error: any) {
    return { success: false, error: `Exception in extractSummary: ${error.message}` };
  }
}

/**
 * Format summary as text
 */
function formatAsText(result: any): string {
  if (!result.success) {
    return `Error: ${result.error}`;
  }
  
  return `
========== DOCUMENT SUMMARY ==========
Title: ${result.title}
Word Count: ${result.word_count}
----------------------------------
${result.summary}
==================================
`;
}

/**
 * Format summary as JSON
 */
function formatAsJSON(result: any): string {
  return JSON.stringify({
    title: result.title,
    summary: result.summary,
    word_count: result.word_count,
    document_id: result.document.id
  }, null, 2);
}

/**
 * Format summary as Markdown
 */
function formatAsMarkdown(result: any): string {
  if (!result.success) {
    return `# Error\n\n${result.error}`;
  }
  
  return `# ${result.title}

## Summary
${result.summary}

---
*Word Count: ${result.word_count}*
*Document ID: ${result.document.id}*
`;
}

async function main() {
  try {
    // Validate document ID
    if (!options.documentId) {
      console.error('Error: Document ID is required');
      console.log('Usage: extract-summary.ts <documentId> [options]');
      process.exit(1);
    }
    
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
    
    // Get the summary
    const result = await extractSummary(options.documentId, supabase);
    
    // Format the result
    let output: string;
    if (options.format === 'json') {
      output = formatAsJSON(result);
    } else if (options.format === 'markdown') {
      output = formatAsMarkdown(result);
    } else {
      output = formatAsText(result);
    }
    
    // Output the result
    if (options.output) {
      // Ensure directory exists
      const dir = path.dirname(options.output);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write to file
      fs.writeFileSync(options.output, output);
      Logger.info(`✅ Summary saved to: ${options.output}`);
    } else {
      // Print to console
      console.log(output);
    }
    
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