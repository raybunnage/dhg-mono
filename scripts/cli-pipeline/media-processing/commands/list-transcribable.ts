#!/usr/bin/env ts-node
/**
 * List Transcribable Documents
 * 
 * Lists expert_documents associated with presentations that are ready for transcription.
 * The command checks presentations, their associated presentation_assets, and expert_documents
 * to find records that need to be processed.
 * 
 * Usage:
 *   list-transcribable.ts [options]
 * 
 * Options:
 *   --limit [number]           Limit the number of records to return (default: 10)
 *   --format [format]          Output format: json, csv, or table (default: table)
 *   --show-processed           Show already processed files as well
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
  limit: 10,
  format: 'table',
  showProcessed: args.includes('--show-processed')
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
  const format = args[formatIndex + 1].toLowerCase();
  if (['json', 'csv', 'table'].includes(format)) {
    options.format = format;
  }
}

/**
 * Get transcribable documents
 */
async function getTranscribableDocuments(supabase: any, limit: number): Promise<any[]> {
  try {
    // First, use a simplified query to avoid schema compatibility issues
    const query = `
      SELECT 
        p.id as presentation_id,
        p.title,
        p.filename,
        pa.id as asset_id,
        pa.expert_document_id,
        ed.id as document_id,
        ed.processing_status,
        ed.raw_content,
        sg.name as source_name
      FROM 
        presentations p
      JOIN 
        presentation_assets pa ON p.id = pa.presentation_id
      JOIN 
        expert_documents ed ON pa.expert_document_id = ed.id
      JOIN 
        sources_google sg ON ed.source_id = sg.id
      WHERE 
        pa.expert_document_id IS NOT NULL
      ORDER BY 
        ed.created_at DESC
      LIMIT 
        ${limit}
    `;

    const { data, error } = await supabase.rpc('execute_sql', { query_sql: query });
    
    if (error) {
      Logger.error(`❌ Error executing query: ${error.message}`);
      
      // Fallback to more standard queries if custom SQL fails
      Logger.info('Falling back to standard query...');
      
      // Get expert_documents associated with presentation_assets
      const { data: assets, error: assetsError } = await supabase
        .from('presentation_assets')
        .select(`
          id, 
          expert_document_id,
          metadata,
          presentations!inner(id, title, filename),
          expert_documents!inner(
            id, 
            processing_status, 
            raw_content, 
            source_id
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (assetsError) {
        Logger.error(`❌ Error fetching presentation assets: ${assetsError.message}`);
        return [];
      }
      
      // Format the results to match our expected format
      return assets.map((asset: any) => {
        const doc = asset.expert_documents;
        const presentation = asset.presentations;
        
        // Check if audio file is available
        const hasMp4File = fs.existsSync(path.join(process.cwd(), 'file_types', 'mp4', presentation.filename));
        const hasM4aFile = fs.existsSync(path.join(process.cwd(), 'file_types', 'm4a', 
          presentation.filename.replace(/\.mp4$/, '.m4a')));
        const hasIngestedFile = fs.existsSync(path.join(process.cwd(), 'file_types', 'm4a', 
          `INGESTED_${presentation.filename.replace(/\.mp4$/, '.m4a')}`));
        
        return {
          presentation_id: presentation.id,
          title: presentation.title,
          filename: presentation.filename,
          asset_id: asset.id,
          expert_document_id: doc.id,
          metadata: asset.metadata,
          document_id: doc.id,
          processing_status: doc.processing_status,
          raw_content: doc.raw_content,
          summary: null, // Not available in schema
          transcription_complete: false, // Not available in schema
          summary_complete: false, // Not available in schema
          source_id: doc.source_id,
          audio_available: hasM4aFile || hasIngestedFile || hasMp4File
        };
      });
    }
    
    return data.rows || [];
  } catch (error: any) {
    Logger.error(`❌ Exception in getTranscribableDocuments: ${error.message}`);
    return [];
  }
}

/**
 * Format results for display
 */
function formatResults(documents: any[], format: string): string {
  if (documents.length === 0) {
    return 'No transcribable documents found.';
  }
  
  // Prepare data with status information
  const formattedDocs = documents.map(doc => {
    const needsTranscription = !doc.raw_content || doc.raw_content.length === 0;
    // Since we don't have 'summary' field in schema, assume we need it if we need transcription
    const needsSummary = needsTranscription; 
    const audioStatus = doc.audio_available ? 'Available' : 'Missing';
    
    let status = 'Ready for processing';
    if (!doc.audio_available) status = 'Missing audio file';
    else if (!needsTranscription) status = 'Already transcribed';
    else status = 'Needs transcription';
    
    return {
      ...doc,
      status,
      audioStatus,
      needsTranscription,
      needsSummary
    };
  });
  
  // Format as JSON
  if (format === 'json') {
    return JSON.stringify(formattedDocs, null, 2);
  }
  
  // Format as CSV
  if (format === 'csv') {
    const headers = [
      'document_id', 
      'title', 
      'filename', 
      'status', 
      'audioStatus',
      'transcription_complete',
      'summary_complete'
    ].join(',');
    
    const rows = formattedDocs.map(doc => [
      doc.document_id,
      `"${doc.title.replace(/"/g, '""')}"`,
      `"${doc.filename.replace(/"/g, '""')}"`,
      `"${doc.status}"`,
      doc.audioStatus,
      doc.transcription_complete ? 'Yes' : 'No',
      doc.summary_complete ? 'Yes' : 'No'
    ].join(','));
    
    return [headers, ...rows].join('\n');
  }
  
  // Default: table format
  // Create table headers
  const headers = [
    'Document ID', 
    'Title', 
    'Status',
    'Audio', 
    'Transcription',
    'Summary',
    'Recommended Command'
  ];
  
  // Calculate column widths
  const columnWidths = [
    Math.max(headers[0].length, ...formattedDocs.map(doc => doc.document_id.length)),
    Math.max(headers[1].length, ...formattedDocs.map(doc => doc.title.length > 30 ? 30 : doc.title.length)),
    Math.max(headers[2].length, ...formattedDocs.map(doc => doc.status.length)),
    Math.max(headers[3].length, ...formattedDocs.map(doc => doc.audioStatus.length)),
    Math.max(headers[4].length, 11), // "Transcription" column
    Math.max(headers[5].length, 7),  // "Summary" column
    Math.max(headers[6].length, 40)  // "Recommended Command" column
  ];
  
  // Create header row
  let output = headers.map((header, i) => header.padEnd(columnWidths[i])).join(' | ') + '\n';
  
  // Create separator row
  output += columnWidths.map(width => '-'.repeat(width)).join('-+-') + '\n';
  
  // Create data rows
  formattedDocs.forEach(doc => {
    // Truncate title if too long
    const title = doc.title.length > 30 ? doc.title.substring(0, 27) + '...' : doc.title;
    
    // Determine recommended command
    let command = '';
    if (!doc.audio_available) {
      command = 'Convert MP4 to audio first';
    } else if (doc.needsTranscription && doc.needsSummary) {
      command = `transcribe-with-summary ${doc.document_id}`;
    } else if (doc.needsTranscription) {
      command = `transcribe ${doc.document_id}`;
    } else if (doc.needsSummary) {
      command = `transcribe-with-summary ${doc.document_id}`;
    } else {
      command = 'Already fully processed';
    }
    
    output += [
      doc.document_id.padEnd(columnWidths[0]),
      title.padEnd(columnWidths[1]),
      doc.status.padEnd(columnWidths[2]),
      doc.audioStatus.padEnd(columnWidths[3]),
      (doc.transcription_complete ? 'Complete' : 'Needed').padEnd(columnWidths[4]),
      (doc.summary_complete ? 'Complete' : 'Needed').padEnd(columnWidths[5]),
      command.padEnd(columnWidths[6])
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
    Logger.info('🔍 Listing Transcribable Documents');
    Logger.info(`Limit: ${options.limit}`);
    Logger.info(`Format: ${options.format}`);
    Logger.info(`Show processed: ${options.showProcessed ? 'Yes' : 'No'}`);
    
    // Get the documents
    const documents = await getTranscribableDocuments(supabase, options.limit);
    
    // Format and display the results
    const output = formatResults(documents, options.format);
    console.log(output);
    
    // Also output document IDs in an easily copyable format
    if (documents.length > 0) {
      const needsProcessing = documents.filter(doc => 
        doc.audio_available && (!doc.raw_content)
      );
      
      if (needsProcessing.length > 0) {
        console.log('\nDocument IDs ready for processing (copy & paste):');
        needsProcessing.forEach(doc => {
          const command = !doc.raw_content ? 'transcribe-with-summary' : 'transcribe-with-summary';
          console.log(`./scripts/cli-pipeline/media-processing/media-processing-cli.sh ${command} ${doc.document_id}`);
        });
      }
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