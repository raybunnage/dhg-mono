#!/usr/bin/env ts-node
/**
 * Script to remove expert_documents records for PDF files with null document_type_id
 * 
 * This script identifies expert_documents records that reference sources_google entries
 * with mime_type = 'application/pdf' and null document_type_id, then deletes those expert_documents.
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Database } from '../../../supabase/types';

// Define types from the Supabase types file
type SourcesGoogle = Database['public']['Tables']['sources_google']['Row'];
type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];

// Create the program
const program = new Command();

program
  .name('remove-expert-docs-pdf-records')
  .description('Remove expert_documents records for PDF files with null document_type_id')
  .option('-d, --debug', 'Enable debug output', false)
  .option('--dry-run', 'Run in dry-run mode (no database changes)', false)
  .option('-l, --limit <number>', 'Limit the number of records to process', '100')
  .action(async (options) => {
    try {
      const debug = options.debug;
      const dryRun = options.dryRun;
      const limit = parseInt(options.limit, 10);

      console.log('='.repeat(60));
      console.log('📂 Expert Documents PDF Records Cleanup Tool');
      console.log('='.repeat(60));
      console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '🔧 LIVE (will update database)'}`);
      console.log(`Debug: ${debug ? 'Enabled' : 'Disabled'}`);
      console.log(`Processing limit: ${limit} records`);
      console.log('-'.repeat(60));

      // Initialize Supabase client
      if (debug) console.log('Initializing Supabase client...');
      const supabase = SupabaseClientService.getInstance().getClient();
      if (debug) console.log('✅ Supabase client initialized');

      // 1. Find PDF files in sources_google with mime_type = 'application/pdf' and null document_type_id
      if (debug) console.log('Querying for PDF files with application/pdf mime_type and null document_type_id...');
      
      const { data: pdfFiles, error: pdfError } = await supabase
        .from('sources_google')
        .select('id, name, drive_id, mime_type, document_type_id')
        .eq('mime_type', 'application/pdf')
        .is('document_type_id', null)
        .is('is_deleted', false)
        .limit(limit);

      if (pdfError) {
        throw new Error(`Failed to fetch PDF files: ${pdfError.message}`);
      }

      if (debug) console.log(`Found ${pdfFiles.length} PDF files with mime_type = 'application/pdf' and null document_type_id`);
      if (pdfFiles.length === 0) {
        console.log('No PDF files with mime_type = application/pdf and null document_type_id found. Exiting.');
        return;
      }

      // Create a map of source_id to file for easy lookup
      const pdfFilesMap: Record<string, any> = {};
      pdfFiles.forEach(file => {
        pdfFilesMap[file.id] = file;
      });

      // 2. Find expert_documents that reference these sources_google records
      if (debug) console.log('Querying for expert_documents referencing these sources...');
      
      const sourceIds = pdfFiles.map(file => file.id);
      const { data: expertDocs, error: expertsError } = await supabase
        .from('expert_documents')
        .select('id, source_id')
        .in('source_id', sourceIds);

      if (expertsError) {
        throw new Error(`Failed to fetch expert_documents: ${expertsError.message}`);
      }

      if (debug) console.log(`Found ${expertDocs.length} corresponding expert_documents to remove`);

      if (expertDocs.length === 0) {
        console.log('\n✅ No expert_documents found for PDF files with null document_type_id. Nothing to remove.');
        return;
      }

      // Display the expert_documents to be removed
      console.log('\n📊 Results:');
      console.log(`- Total PDF files with null document_type_id: ${pdfFiles.length}`);
      console.log(`- Expert documents to be removed: ${expertDocs.length}`);

      console.log('\n📄 Expert documents to be removed:');
      console.log('-'.repeat(120));
      console.log('| Expert Doc ID                            | Source ID                                | PDF Name                                |');
      console.log('-'.repeat(120));
      
      expertDocs.forEach(doc => {
        const id = doc.id.padEnd(36);
        const sourceId = doc.source_id ? doc.source_id.padEnd(36) : 'Unknown'.padEnd(36);
        const pdfFile = doc.source_id ? pdfFilesMap[doc.source_id] : null;
        const name = pdfFile?.name ? pdfFile.name.substring(0, 40).padEnd(40) : 'Unknown'.padEnd(40);
        console.log(`| ${id} | ${sourceId} | ${name} |`);
      });
      
      console.log('-'.repeat(120));

      // 3. Remove the identified expert_documents
      if (dryRun) {
        console.log('\n🔍 DRY RUN: Would remove the following expert_documents (no changes made)');
        expertDocs.forEach(doc => {
          const pdfFile = doc.source_id ? pdfFilesMap[doc.source_id] : null;
          console.log(`  - Expert doc ${doc.id} for PDF: ${pdfFile?.name || 'Unknown'}`);
        });
      } else {
        console.log('\n🔧 Removing expert_documents...');
        
        // Delete in batches to avoid overwhelming the database
        const batchSize = 20;
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < expertDocs.length; i += batchSize) {
          const batch = expertDocs.slice(i, i + batchSize);
          const batchIds = batch.map(doc => doc.id);
          
          try {
            const { data, error } = await supabase
              .from('expert_documents')
              .delete()
              .in('id', batchIds)
              .select('id');
            
            if (error) {
              console.error(`❌ Error removing batch ${i/batchSize + 1}: ${error.message}`);
              failureCount += batch.length;
            } else {
              if (debug) console.log(`✅ Removed batch ${i/batchSize + 1} (${batch.length} records)`);
              successCount += data?.length || 0;
            }
          } catch (err) {
            console.error(`❌ Exception in batch ${i/batchSize + 1}: ${(err as Error).message}`);
            failureCount += batch.length;
          }
          
          // Add a small delay between batches
          if (i + batchSize < expertDocs.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        console.log('\n✅ Completed with the following results:');
        console.log(`- Successfully removed: ${successCount} expert_documents records`);
        if (failureCount > 0) {
          console.log(`- Failed to remove: ${failureCount} records`);
        }
      }
      
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Parse command line arguments and execute
program.parse(process.argv);