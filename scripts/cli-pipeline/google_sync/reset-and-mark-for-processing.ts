#!/usr/bin/env ts-node
/**
 * Script to find PDF files and mark them for reprocessing
 * This script identifies PDF files that should be processed by classify-pdfs-with-service
 * and explicitly sets their document_processing_status to 'needs_reprocessing'.
 */

import { Command } from 'commander';
import { config } from 'dotenv';
import { resolve } from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables from different locations
const rootDir = resolve(__dirname, '../../..');

// Try to load from various .env files
const envFiles = ['.env', '.env.local', '.env.development'];
for (const file of envFiles) {
  const envPath = resolve(rootDir, file);
  try {
    const result = config({ path: envPath });
    if (result.parsed) {
      console.log(`Loading environment variables from ${envPath}`);
    }
  } catch (e) {
    console.error(`Error loading ${envPath}:`, e);
  }
}

// Initialize Supabase client
const supabaseService = SupabaseClientService.getInstance();
const supabase = supabaseService.getClient();

/**
 * Mark PDF files for reprocessing by setting their document_processing_status to 'needs_reprocessing'
 */
async function markPdfsForReprocessing(options: {
  limit?: number;
  verbose?: boolean;
  dryRun?: boolean;
  createMissingRecords?: boolean;
  filter?: string;
}) {
  const limit = options.limit || 40;
  const verbose = options.verbose || false;
  const dryRun = options.dryRun || false;
  const createMissingRecords = options.createMissingRecords || false;
  const filter = options.filter || '';

  console.log('=== Mark PDF Files for Reprocessing ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (updating database)'}`);
  console.log(`Limit: ${limit} files`);
  console.log(`Create missing expert_documents records: ${createMissingRecords ? 'YES' : 'NO'}`);
  if (filter) {
    console.log(`Filter: ${filter}`);
  }
  console.log('======================================');

  let trackingId: string | undefined;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'mark-pdfs-for-reprocessing');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    // First, test Supabase connection
    console.log('Testing Supabase connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Supabase connection test successful');

    // Step 1: Get PDF files from sources_google
    console.log('\nFinding PDF files in sources_google...');
    
    let query = supabase
      .from('google_sources')
      .select('id, name, document_type_id, drive_id, mime_type, modified_at')
      .eq('mime_type', 'application/pdf')
      .is('is_deleted', false)
      .order('modified_at', { ascending: false })
      .limit(limit * 2); // Get more than we need as we'll filter further
    
    // Apply filter if provided
    if (filter) {
      query = query.ilike('name', `%${filter}%`);
    }
    
    const { data: pdfFiles, error: pdfError } = await query;
    
    if (pdfError) {
      throw new Error(`Error fetching PDF files: ${pdfError.message}`);
    }
    
    if (!pdfFiles || pdfFiles.length === 0) {
      console.log('No PDF files found in sources_google.');
      return;
    }
    
    console.log(`Found ${pdfFiles.length} PDF files in sources_google.`);
    
    // Step 2: Find expert_documents for these files
    const sourceIds = pdfFiles.map(file => file.id);
    
    const { data: expertDocs, error: expertError } = await supabase
      .from('expert_documents')
      .select('id, source_id, document_processing_status')
      .in('source_id', sourceIds);
      
    if (expertError) {
      console.error(`Error fetching expert documents: ${expertError.message}`);
    }
    
    // Create a map for quick lookup
    const expertDocMap = new Map();
    if (expertDocs && expertDocs.length > 0) {
      expertDocs.forEach(doc => {
        expertDocMap.set(doc.source_id, doc);
      });
      console.log(`Found ${expertDocs.length} expert documents for these PDF files.`);
    } else {
      console.log('No expert documents found for these PDF files.');
    }
    
    // Step 3: Process each PDF file
    const filesToProcess: {
      id: string;
      name: string;
      driveId: string;
      expertDocId?: string;
      action: 'update' | 'create';
    }[] = [];
    
    for (const file of pdfFiles) {
      const expertDoc = expertDocMap.get(file.id);
      
      if (expertDoc) {
        // Check if this document already needs reprocessing
        if (expertDoc.document_processing_status === 'needs_reprocessing') {
          if (verbose) {
            console.log(`PDF file already marked for reprocessing: ${file.name}`);
          }
          continue;
        }
        
        // Add to the list of files to update
        filesToProcess.push({
          id: file.id,
          name: file.name,
          driveId: file.drive_id,
          expertDocId: expertDoc.id,
          action: 'update'
        });
      } else if (createMissingRecords) {
        // No expert document found, create one if requested
        filesToProcess.push({
          id: file.id,
          name: file.name,
          driveId: file.drive_id,
          action: 'create'
        });
      }
      
      // Limit to the requested number of files
      if (filesToProcess.length >= limit) {
        break;
      }
    }
    
    console.log(`Found ${filesToProcess.length} PDF files to process.`);
    
    // Step 4: Update or create expert documents
    if (filesToProcess.length === 0) {
      console.log('No files need to be marked for reprocessing.');
      return;
    }
    
    let updatedCount = 0;
    let createdCount = 0;
    const now = new Date().toISOString();
    
    // Process them in batches to avoid overwhelming the database
    const batchSize = 20;
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      
      console.log(`Processing batch ${i+1}-${Math.min(i+batchSize, filesToProcess.length)} of ${filesToProcess.length} files...`);
      
      if (!dryRun) {
        // Process each file individually
        for (const file of batch) {
          if (file.action === 'update' && file.expertDocId) {
            // Update existing expert document
            const { error } = await supabase
              .from('expert_documents')
              .update({
                document_processing_status: 'needs_reprocessing',
                document_processing_status_updated_at: now
              })
              .eq('id', file.expertDocId);
              
            if (error) {
              console.error(`Error updating expert document for ${file.name}: ${error.message}`);
            } else {
              updatedCount++;
              console.log(`Marked for reprocessing: ${file.name}`);
            }
          } else if (file.action === 'create') {
            // Create new expert document
            const { error } = await supabase
              .from('expert_documents')
              .insert({
                id: uuidv4(),
                source_id: file.id,
                document_processing_status: 'needs_reprocessing',
                document_processing_status_updated_at: now,
                created_at: now,
                updated_at: now
              });
              
            if (error) {
              console.error(`Error creating expert document for ${file.name}: ${error.message}`);
            } else {
              createdCount++;
              console.log(`Created expert document for: ${file.name}`);
            }
          }
        }
      } else {
        // In dry-run mode, just report what would be done
        for (const file of batch) {
          if (file.action === 'update') {
            console.log(`[DRY RUN] Would mark for reprocessing: ${file.name}`);
          } else if (file.action === 'create') {
            console.log(`[DRY RUN] Would create expert document for: ${file.name}`);
          }
        }
      }
    }
    
    // Summary
    console.log('\n=== Summary ===');
    if (!dryRun) {
      console.log(`Files marked for reprocessing: ${updatedCount}`);
      console.log(`New expert document records created: ${createdCount}`);
      console.log(`Total files processed: ${updatedCount + createdCount}`);
    } else {
      console.log(`Would mark ${filesToProcess.filter(f => f.action === 'update').length} files for reprocessing`);
      console.log(`Would create ${filesToProcess.filter(f => f.action === 'create').length} new expert document records`);
      console.log(`Total files that would be processed: ${filesToProcess.length}`);
    }
    console.log('Run classify-pdfs command to process these files.');
    
    // Complete tracking
    if (trackingId) {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: dryRun ? 0 : (updatedCount + createdCount),
        summary: dryRun 
          ? `Dry run: Would mark ${filesToProcess.length} PDF files for reprocessing`
          : `Marked ${updatedCount} PDF files for reprocessing and created ${createdCount} new expert document records`
      });
    }
    
    return {
      updatedCount,
      createdCount,
      totalProcessed: updatedCount + createdCount
    };
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Mark tracking as failed
    if (trackingId) {
      await commandTrackingService.failTracking(
        trackingId,
        `Command failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    
    throw error;
  }
}

// Set up CLI program
if (require.main === module) {
  const program = new Command();
  
  program
    .name('reset-and-mark-for-processing')
    .description('Find PDF files and mark them for reprocessing')
    .option('-l, --limit <number>', 'Maximum number of PDF files to process', '40')
    .option('-v, --verbose', 'Show detailed output')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--create-missing-records', 'Create expert_documents records for PDFs that don\'t have them')
    .option('--filter <string>', 'Filter PDF files by name')
    .action(async (options) => {
      await markPdfsForReprocessing({
        limit: parseInt(options.limit, 10),
        verbose: options.verbose,
        dryRun: options.dryRun,
        createMissingRecords: options.createMissingRecords,
        filter: options.filter
      });
    });
    
  program.parse(process.argv);
}

export { markPdfsForReprocessing };