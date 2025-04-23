#!/usr/bin/env ts-node
import { Command } from 'commander';
import { config } from 'dotenv';
import { resolve } from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

// Load environment variables from different locations
const rootDir = resolve(__dirname, '../../..');

// Try to load from various .env files
const envFiles = ['.env', '.env.local', '.env.development'];
for (const file of envFiles) {
  const envPath = resolve(rootDir, file);
  try {
    const result = config({ path: envPath });
    if (result.parsed) {
      console.log(`Loaded environment from ${envPath}`);
    }
  } catch (e) {
    console.error(`Error loading ${envPath}:`, e);
  }
}

// Initialize Supabase client
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

// List of unsupported document type IDs from list-unsupported-document-types.ts
const unsupportedDocumentTypeIds = [
  // Specifically requested IDs
  '6ece37e7-840d-4a0c-864d-9f1f971b1d7e', // m4a audio
  'e9d3e473-5315-4837-9f5f-61f150cbd137', // Code Documentation Markdown
  
  // Category: Audio
  '4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af', // mp3 audio
  'd2206940-e4f3-476e-9245-0e1eb12fd195', // aac audio
  '8ce8fbbc-b397-4061-a80f-81402515503b', // m3u file
  'fe697fc5-933c-41c9-9b11-85e0defa86ed', // wav audio
  
  // Category: Image
  'db6518ad-765c-4a02-a684-9c2e49d77cf5', // png image
  '68b95822-2746-4ce1-ad35-34e5b0297177', // jpg image
  
  // Category: Video (except mp4 video)
  '3e7c880c-d821-4d01-8cc5-3547bdd2e347', // video mpeg
  'd70a258e-262b-4bb3-95e3-f826ee9b918b', // video quicktime
  '91fa92a3-d606-493b-832d-9ba1fa83dc9f', // video microsoft avi
  '28ab55b9-b408-486f-b1c3-8f0f0a174ad4', // m4v
  '2c1d3bdc-b429-4194-bec2-7e4bbb165dbf', // conf file (in video category)
  // Not included: 'ba1d7662-0168-4756-a2ea-6d964fd02ba8' (mp4 video) as requested
  
  // Category: Operations
  '53f42e7d-78bd-4bde-8106-dc12a4835695', // Document Processing Script
  '4fdbd8be-fe5a-4341-934d-2b6bd43be7be', // CI CD Pipeline Script
  'a1dddf8e-1264-4ec0-a5af-52eafb536ee3', // Deployment Script
  '561a86b0-7064-4c20-a40e-2ec6905c4a42', // Database Management Script
  'f7e83857-8bb8-4b18-9d8f-16d5cb783650', // Environment Setup Script
  
  // Category: Spreadsheet
  'b26a68ed-a0d1-415d-8271-cba875bfe3ce', // xlsx document
  '920893fc-f0be-4211-85b4-fc29882ade97', // google sheet
  
  // Other existing types
  'e29b5194-7ba0-4a3c-a7db-92b0d8adca6a', // Unknown Document Type
  '9dbe32ff-5e82-4586-be63-1445e5bcc548'  // Password Protected Document
];

// Unsupported MIME types
const unsupportedMimeTypes = [
  'application/vnd.google-apps.audio',
  'application/vnd.google-apps.video',
  'application/vnd.google-apps.drawing',
  'application/vnd.google-apps.form',
  'application/vnd.google-apps.map',
  'application/vnd.google-apps.presentation', // Google Slides
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  // 'video/mp4' - Removed as requested, this is now supported
  'video/mpeg',
  'video/quicktime',
  'video/x-msvideo',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml'
];

/**
 * Finds expert_documents that have been marked with "needs_reprocessing" status
 * where their associated sources_google entry has an unsupported document type
 */
export async function findNeedsReprocessingUnsupportedDocuments(options: {
  limit?: number;
  verbose?: boolean;
  format?: 'json' | 'table' | 'csv';
  outputPath?: string;
  dryRun?: boolean;
}) {
  const limit = options.limit || 500;
  const verbose = options.verbose || false;
  const format = options.format || 'table';
  const dryRun = options.dryRun || false;
  
  console.log(`Finding expert_documents marked as "needs_reprocessing" with unsupported document types (limit: ${limit})...`);

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'needs-reprocessing');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    // Test Supabase connection first
    console.log('Testing Supabase connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    // Test a specific query to verify document_types table is accessible
    try {
      const { data, error } = await supabaseClient
        .from('document_types')
        .select('id')
        .limit(1);
      
      if (error) {
        throw new Error(`Error querying document_types: ${error.message}`);
      }
      // Connection successful - no need to log again as it's already logged above
    } catch (error) {
      throw new Error(`Database connectivity test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    console.log('✅ Supabase connection test successful');

    // First, get document type information for display
    console.log('Fetching document type information...');
    const { data: documentTypes, error: documentTypesError } = await supabaseClient
      .from('document_types')
      .select('id, document_type');

    if (documentTypesError) {
      console.error('Error fetching document types:', documentTypesError.message);
      throw new Error(`Failed to fetch document types: ${documentTypesError.message}`);
    }

    const documentTypeMap = new Map();
    if (documentTypes) {
      documentTypes.forEach(dt => {
        documentTypeMap.set(dt.id, dt.document_type);
      });
    }

    // Find expert_documents with "needs_reprocessing" status
    console.log('Finding expert documents marked as "needs_reprocessing"...');
    const { data: needsReprocessingDocs, error: reprocessingError } = await supabaseClient
      .from('expert_documents')
      .select('id, source_id, document_type_id, document_processing_status')
      .eq('document_processing_status', 'needs_reprocessing')
      .limit(limit);

    if (reprocessingError) {
      console.error('Error fetching expert documents:', reprocessingError.message);
      throw new Error(`Failed to fetch expert documents: ${reprocessingError.message}`);
    }

    if (!needsReprocessingDocs || needsReprocessingDocs.length === 0) {
      console.log('No expert documents found with "needs_reprocessing" status.');
      return;
    }

    console.log(`Found ${needsReprocessingDocs.length} expert documents with "needs_reprocessing" status. Checking for unsupported document types...`);

    // Get the associated sources_google records
    const sourceIds = needsReprocessingDocs.map(doc => doc.source_id);
    
    // Process in batches to avoid "fetch failed" error with large IN clauses
    const batchSize = 100;
    let allSources: any[] = [];
    let sourcesError = null;
    
    for (let i = 0; i < sourceIds.length; i += batchSize) {
      const batchIds = sourceIds.slice(i, i + batchSize);
      const { data: batchSources, error: batchError } = await supabaseClient
        .from('sources_google')
        .select('id, name, document_type_id, mime_type')
        .in('id', batchIds);
      
      if (batchError) {
        console.error(`Error fetching batch of sources_google records (batch ${i/batchSize + 1}):`, batchError.message);
        sourcesError = batchError;
        break;
      }
      
      if (batchSources && batchSources.length > 0) {
        allSources = [...allSources, ...batchSources];
      }
      
      // Add a small delay between batches to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (sourcesError) {
      console.error('Error fetching sources_google records:', sourcesError.message);
      throw new Error(`Failed to fetch sources_google records: ${sourcesError.message}`);
    }
    
    const sources = allSources;

    if (!sources || sources.length === 0) {
      console.log('No sources_google records found for the expert documents.');
      return;
    }

    // Create a map for quick lookups
    const sourceMap = new Map(sources.map(source => [source.id, source]));

    // Find documents that match our criteria
    const unsupportedDocs = needsReprocessingDocs.filter(doc => {
      const source = sourceMap.get(doc.source_id);
      if (!source) return false;

      // Check if source has an unsupported document type ID
      if (source.document_type_id && unsupportedDocumentTypeIds.includes(source.document_type_id)) {
        return true;
      }

      // Check if source has an unsupported MIME type
      if (source.mime_type && unsupportedMimeTypes.includes(source.mime_type)) {
        return true;
      }

      return false;
    });

    console.log(`Found ${unsupportedDocs.length} expert documents that need reprocessing and have unsupported document types.`);

    // Prepare detailed results
    const results = unsupportedDocs.map(doc => {
      const source = sourceMap.get(doc.source_id);
      return {
        expertDocId: doc.id,
        sourceId: doc.source_id,
        sourceName: source ? source.name : 'Unknown',
        sourceDocumentTypeId: source ? source.document_type_id : null,
        sourceDocumentType: source?.document_type_id ? documentTypeMap.get(source.document_type_id) : null,
        expertDocumentTypeId: doc.document_type_id,
        expertDocumentType: doc.document_type_id ? documentTypeMap.get(doc.document_type_id) : null,
        mimeType: source ? source.mime_type : null,
        reason: source?.document_type_id && unsupportedDocumentTypeIds.includes(source.document_type_id) 
          ? 'Unsupported document type' 
          : source?.mime_type && unsupportedMimeTypes.includes(source.mime_type)
            ? 'Unsupported MIME type'
            : 'Unknown'
      };
    });

    // Output the results in the requested format
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else if (format === 'csv') {
      let csvOutput = 'Expert Doc ID,Source ID,Source Name,Source Document Type,Expert Document Type,MIME Type,Reason\n';
      results.forEach(result => {
        csvOutput += `${result.expertDocId},${result.sourceId},${result.sourceName.replace(/,/g, ' ')},${result.sourceDocumentType || 'N/A'},${result.expertDocumentType || 'N/A'},${result.mimeType || 'N/A'},${result.reason}\n`;
      });
      console.log(csvOutput);
    } else { // table format
      console.table(results.map(r => ({
        'Source Name': r.sourceName,
        'Source Document Type': r.sourceDocumentType || 'None',
        'Expert Document Type': r.expertDocumentType || 'None',
        'MIME Type': r.mimeType || 'None',
        'Reason': r.reason
      })));
    }

    // Write to output file if specified
    if (options.outputPath) {
      const fs = require('fs');
      const path = require('path');
      
      try {
        let output: string;
        if (format === 'json') {
          output = JSON.stringify(results, null, 2);
        } else if (format === 'csv') {
          let csvOutput = 'Expert Doc ID,Source ID,Source Name,Source Document Type,Expert Document Type,MIME Type,Reason\n';
          results.forEach(result => {
            csvOutput += `${result.expertDocId},${result.sourceId},${result.sourceName.replace(/,/g, ' ')},${result.sourceDocumentType || 'N/A'},${result.expertDocumentType || 'N/A'},${result.mimeType || 'N/A'},${result.reason}\n`;
          });
          output = csvOutput;
        } else {
          // Create a simple table format for text output
          output = 'Expert Doc ID\tSource ID\tSource Name\tSource Document Type\tExpert Document Type\tMIME Type\tReason\n';
          results.forEach(result => {
            output += `${result.expertDocId}\t${result.sourceId}\t${result.sourceName}\t${result.sourceDocumentType || 'N/A'}\t${result.expertDocumentType || 'N/A'}\t${result.mimeType || 'N/A'}\t${result.reason}\n`;
          });
        }

        if (!dryRun) {
          fs.writeFileSync(path.resolve(options.outputPath), output);
          console.log(`\nDetailed results written to: ${options.outputPath}`);
        } else {
          console.log(`\n[DRY RUN] Would write detailed results to: ${options.outputPath}`);
        }
      } catch (error) {
        console.error(`Error writing output file: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: unsupportedDocs.length,
          summary: `Found ${unsupportedDocs.length} expert documents with needs_reprocessing status and unsupported document types`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  } catch (error) {
    console.error(`Error finding needs_reprocessing documents: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${error instanceof Error ? error.message : String(error)}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
  }
}

// Set up CLI
if (require.main === module) {
  const program = new Command();

  program
    .name('needs-reprocessing')
    .description('Find expert_documents marked as "needs_reprocessing" with unsupported document types')
    .option('-l, --limit <number>', 'Maximum number of expert documents to check', '500')
    .option('-v, --verbose', 'Show detailed output')
    .option('--format <format>', 'Output format (json, table, csv)', 'table')
    .option('-o, --output <path>', 'Output file path for the report')
    .option('--dry-run', 'Show what would be done without writing output file')
    .action((options) => {
      findNeedsReprocessingUnsupportedDocuments({
        limit: parseInt(options.limit),
        verbose: options.verbose,
        format: options.format,
        outputPath: options.output,
        dryRun: options.dryRun
      });
    });

  program.parse(process.argv);
}