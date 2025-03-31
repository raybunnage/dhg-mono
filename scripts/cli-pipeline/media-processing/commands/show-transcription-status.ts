#!/usr/bin/env ts-node
/**
 * Show Transcription Status Command
 * 
 * This command shows the status of transcriptions for presentations and expert documents.
 * It helps track which files have been processed and which still need processing.
 * 
 * Usage:
 *   show-transcription-status.ts [options]
 * 
 * Options:
 *   --limit [n]                 Maximum number of records to show (default: 20)
 *   --format [format]           Output format: table, json, csv (default: table)
 *   --sort [column]             Sort by: date, title, status (default: date)
 *   --filter [status]           Filter by status: all, pending, completed, error (default: all)
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
  limit: 20,
  format: 'table',
  sort: 'date',
  filter: 'all'
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
  if (['table', 'json', 'csv'].includes(format)) {
    options.format = format;
  }
}

// Get sort if specified
const sortIndex = args.indexOf('--sort');
if (sortIndex !== -1 && args[sortIndex + 1]) {
  const sort = args[sortIndex + 1].toLowerCase();
  if (['date', 'title', 'status'].includes(sort)) {
    options.sort = sort;
  }
}

// Get filter if specified
const filterIndex = args.indexOf('--filter');
if (filterIndex !== -1 && args[filterIndex + 1]) {
  const filter = args[filterIndex + 1].toLowerCase();
  if (['all', 'pending', 'completed', 'error'].includes(filter)) {
    options.filter = filter;
  }
}

/**
 * Get document statuses from the database
 */
async function getDocumentStatuses(supabase: any): Promise<any[]> {
  try {
    // Build the query with joins to related tables
    const query = supabase
      .from('presentation_assets')
      .select(`
        id,
        expert_document_id,
        presentations!inner(id, title, filename, created_at),
        expert_documents!inner(
          id,
          processing_status,
          raw_content,
          processed_content,
          word_count,
          last_processed_at,
          whisper_model_used
        )
      `)
      .order('created_at', { ascending: false })
      .limit(options.limit);
    
    // Apply status filter if needed
    if (options.filter !== 'all') {
      if (options.filter === 'pending') {
        query.eq('expert_documents.processing_status', 'pending');
      } else if (options.filter === 'completed') {
        query.eq('expert_documents.processing_status', 'completed');
      } else if (options.filter === 'error') {
        query.eq('expert_documents.processing_status', 'error');
      }
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      Logger.error(`❌ Error fetching documents: ${error.message}`);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Process the data to get relevant details
    return data.map((item: any) => {
      const doc = item.expert_documents;
      const presentation = item.presentations;
      
      // Check transcription and summary status
      const hasTranscription = doc.raw_content && doc.raw_content.length > 0;
      const hasSummary = doc.processed_content?.summary?.text && doc.processed_content.summary.text.length > 0;
      const transcriptionComplete = doc.processed_content?.transcription_complete || false;
      const summaryComplete = doc.processed_content?.summary_complete || false;
      
      // Calculate processing times
      const transcriptionTime = doc.processed_content?.transcription?.processing_time_seconds || 0;
      const summaryTime = doc.processed_content?.summary?.processing_time_seconds || 0;
      const totalTime = transcriptionTime + summaryTime;
      
      // Determine processing date
      const processedDate = doc.last_processed_at ? new Date(doc.last_processed_at) : null;
      const formattedDate = processedDate ? 
        processedDate.toISOString().replace('T', ' ').substring(0, 19) : 'Not processed';
      
      // Check if audio file exists
      const audioPath = path.join(
        process.cwd(), 
        'file_types', 
        'm4a', 
        `INGESTED_${presentation.filename.replace(/\.mp4$/, '.m4a')}`
      );
      const audioExists = fs.existsSync(audioPath);
      
      // Determine overall status
      let status;
      if (doc.processing_status === 'error') {
        status = 'Error';
      } else if (!audioExists) {
        status = 'Missing Audio';
      } else if (doc.processing_status === 'processing') {
        status = 'Processing';
      } else if (hasTranscription && hasSummary) {
        status = 'Completed';
      } else if (hasTranscription) {
        status = 'Transcribed';
      } else {
        status = 'Pending';
      }
      
      return {
        id: doc.id,
        title: presentation.title,
        filename: presentation.filename,
        created: presentation.created_at,
        status,
        processing_status: doc.processing_status,
        word_count: doc.word_count || 0,
        has_transcription: hasTranscription,
        has_summary: hasSummary,
        model: doc.whisper_model_used || 'unknown',
        transcription_time: transcriptionTime.toFixed(1),
        summary_time: summaryTime.toFixed(1),
        total_time: totalTime.toFixed(1),
        processed_date: formattedDate,
        audio_exists: audioExists
      };
    });
  } catch (error: any) {
    Logger.error(`❌ Exception in getDocumentStatuses: ${error.message}`);
    return [];
  }
}

/**
 * Format results as a table
 */
function formatAsTable(documents: any[]): string {
  if (documents.length === 0) {
    return 'No documents found matching the criteria.';
  }
  
  // Define columns and headers
  const columns = [
    { key: 'title', header: 'Title', width: 30 },
    { key: 'status', header: 'Status', width: 12 },
    { key: 'word_count', header: 'Words', width: 7 },
    { key: 'model', header: 'Model', width: 8 },
    { key: 'total_time', header: 'Time(s)', width: 8 },
    { key: 'processed_date', header: 'Processed', width: 19 },
    { key: 'id', header: 'Document ID', width: 36 }
  ];
  
  // Create header row
  let output = columns.map(col => col.header.padEnd(col.width)).join(' | ') + '\n';
  
  // Create separator row
  output += columns.map(col => '-'.repeat(col.width)).join('-+-') + '\n';
  
  // Create data rows
  documents.forEach(doc => {
    // Truncate title if too long
    const title = doc.title.length > columns[0].width ? 
      doc.title.substring(0, columns[0].width - 3) + '...' : 
      doc.title;
    
    // Format the row
    output += [
      title.padEnd(columns[0].width),
      doc.status.padEnd(columns[1].width),
      doc.word_count.toString().padStart(columns[2].width),
      doc.model.padEnd(columns[3].width),
      doc.total_time.toString().padStart(columns[4].width),
      doc.processed_date.padEnd(columns[5].width),
      doc.id.padEnd(columns[6].width)
    ].join(' | ') + '\n';
  });
  
  // Add summary
  const completed = documents.filter(d => d.status === 'Completed').length;
  const transcribed = documents.filter(d => d.status === 'Transcribed').length;
  const pending = documents.filter(d => d.status === 'Pending').length;
  const errors = documents.filter(d => d.status === 'Error').length;
  
  output += '\nSummary:\n';
  output += `Completed: ${completed}  |  Transcribed only: ${transcribed}  |  Pending: ${pending}  |  Errors: ${errors}\n`;
  
  // Calculate average processing times
  const completedDocs = documents.filter(d => d.has_transcription);
  if (completedDocs.length > 0) {
    const avgTransTime = completedDocs.reduce((sum, d) => sum + parseFloat(d.transcription_time), 0) / completedDocs.length;
    const avgWords = completedDocs.reduce((sum, d) => sum + d.word_count, 0) / completedDocs.length;
    
    output += `Average: ${avgWords.toFixed(0)} words, ${avgTransTime.toFixed(1)}s transcription time\n`;
  }
  
  return output;
}

/**
 * Format results as CSV
 */
function formatAsCSV(documents: any[]): string {
  if (documents.length === 0) {
    return 'No documents found matching the criteria.';
  }
  
  // Define CSV headers
  const headers = [
    'Document ID', 
    'Title', 
    'Status', 
    'Word Count', 
    'Model',
    'Has Transcription', 
    'Has Summary',
    'Transcription Time (s)',
    'Summary Time (s)',
    'Total Time (s)',
    'Processed Date'
  ].join(',');
  
  // Create data rows
  const rows = documents.map(doc => [
    doc.id,
    `"${doc.title.replace(/"/g, '""')}"`,
    doc.status,
    doc.word_count,
    doc.model,
    doc.has_transcription,
    doc.has_summary,
    doc.transcription_time,
    doc.summary_time,
    doc.total_time,
    doc.processed_date
  ].join(','));
  
  return [headers, ...rows].join('\n');
}

/**
 * Format results as JSON
 */
function formatAsJSON(documents: any[]): string {
  return JSON.stringify(documents, null, 2);
}

/**
 * Format the results based on the specified format
 */
function formatResults(documents: any[], format: string): string {
  if (format === 'json') {
    return formatAsJSON(documents);
  } else if (format === 'csv') {
    return formatAsCSV(documents);
  } else {
    return formatAsTable(documents);
  }
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
    Logger.info('📊 Showing Transcription Status');
    Logger.info(`Limit: ${options.limit}`);
    Logger.info(`Format: ${options.format}`);
    Logger.info(`Sort: ${options.sort}`);
    Logger.info(`Filter: ${options.filter}`);
    
    // Get the document statuses
    let documents = await getDocumentStatuses(supabase);
    
    // Sort the documents based on the specified sort option
    if (options.sort === 'title') {
      documents.sort((a, b) => a.title.localeCompare(b.title));
    } else if (options.sort === 'status') {
      documents.sort((a, b) => a.status.localeCompare(b.status));
    } else { // Default: sort by date
      documents.sort((a, b) => {
        const dateA = a.processed_date === 'Not processed' ? new Date(0) : new Date(a.processed_date);
        const dateB = b.processed_date === 'Not processed' ? new Date(0) : new Date(b.processed_date);
        return dateB.getTime() - dateA.getTime();
      });
    }
    
    // Format and display the results
    const output = formatResults(documents, options.format);
    console.log(output);
    
    // Generate some command suggestions
    if (documents.length > 0 && options.format === 'table') {
      const pendingDocs = documents.filter(d => 
        d.status === 'Pending' && d.audio_exists
      );
      
      if (pendingDocs.length > 0) {
        console.log('\nSuggested commands for pending documents:');
        pendingDocs.slice(0, 3).forEach(doc => {
          console.log(`./scripts/cli-pipeline/media-processing/media-processing-cli.sh transcribe-with-summary ${doc.id}`);
        });
        
        if (pendingDocs.length > 3) {
          console.log(`...and ${pendingDocs.length - 3} more pending documents`);
        }
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