#!/usr/bin/env ts-node
/**
 * Script to fix orphaned document_type_id fields for DOCX files without expert document records
 * 
 * This script identifies .docx files in sources_google that have a document_type_id
 * but no corresponding entry in expert_documents (orphaned records).
 * It then nullifies their document_type_id to allow proper re-classification.
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Database } from '../../../supabase/types';

// Define types from the Supabase types file
type SourcesGoogle = Database['public']['Tables']['google_sources']['Row'];
type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];

// Create the program
const program = new Command();

program
  .name('fix-orphaned-docx')
  .description('Identify and fix DOCX files with document_type_id but no expert_document records')
  .option('-d, --debug', 'Enable debug output', false)
  .option('--dry-run', 'Run in dry-run mode (no database changes)', false)
  .option('-l, --limit <number>', 'Limit the number of records to process', '100')
  .action(async (options) => {
    try {
      const debug = options.debug;
      const dryRun = options.dryRun;
      const limit = parseInt(options.limit, 10);

      console.log('='.repeat(60));
      console.log('📂 DOCX Orphaned Records Repair Tool');
      console.log('='.repeat(60));
      console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '🔧 LIVE (will update database)'}`);
      console.log(`Debug: ${debug ? 'Enabled' : 'Disabled'}`);
      console.log(`Processing limit: ${limit} records`);
      console.log('-'.repeat(60));

      // Initialize Supabase client
      if (debug) console.log('Initializing Supabase client...');
      const supabase = SupabaseClientService.getInstance().getClient();
      if (debug) console.log('✅ Supabase client initialized');

      // 1. Find DOCX files in sources_google that have document_type_id 
      if (debug) console.log('Querying for DOCX files with document_type_id...');
      
      const { data: docxFiles, error: docxError } = await supabase
        .from('google_sources')
        .select('id, name, drive_id, document_type_id, mime_type')
        .like('mime_type', '%wordprocessingml.document%')
        .not('document_type_id', 'is', null)
        .is('is_deleted', false)
        .limit(limit);

      if (docxError) {
        throw new Error(`Failed to fetch DOCX files: ${docxError.message}`);
      }

      if (debug) console.log(`Found ${docxFiles.length} DOCX files with document_type_id`);
      if (docxFiles.length === 0) {
        console.log('No DOCX files with document_type_id found. Exiting.');
        return;
      }

      // Create a map of source_id to file for easy lookup
      const docxFilesMap: Record<string, any> = {};
      docxFiles.forEach(file => {
        docxFilesMap[file.id] = file;
      });

      // 2. Find expert_documents that reference these sources_google records
      if (debug) console.log('Querying for expert_documents referencing these sources...');
      
      const sourceIds = docxFiles.map(file => file.id);
      const { data: expertDocs, error: expertsError } = await supabase
        .from('expert_documents')
        .select('id, source_id')
        .in('source_id', sourceIds);

      if (expertsError) {
        throw new Error(`Failed to fetch expert_documents: ${expertsError.message}`);
      }

      if (debug) console.log(`Found ${expertDocs.length} corresponding expert_documents`);

      // Create a set of source_ids that have expert_documents
      const sourcesWithExpertDocs = new Set<string>();
      expertDocs.forEach(doc => {
        if (doc.source_id) {
          sourcesWithExpertDocs.add(doc.source_id);
        }
      });

      // 3. Identify the orphaned DOCX files (those without expert_documents)
      const orphanedFiles = docxFiles.filter(file => !sourcesWithExpertDocs.has(file.id));
      
      console.log(`\n📊 Results:`);
      console.log(`- Total DOCX files with document_type_id: ${docxFiles.length}`);
      console.log(`- Files with expert_documents: ${expertDocs.length}`);
      console.log(`- Orphaned files (to be fixed): ${orphanedFiles.length}`);

      if (orphanedFiles.length === 0) {
        console.log('\n✅ No orphaned DOCX files found. All files have corresponding expert_documents.');
        return;
      }

      // Display the orphaned files
      console.log('\n📄 Orphaned DOCX files:');
      console.log('-'.repeat(120));
      console.log('| ID                                     | Name                                     | Document Type ID                       |');
      console.log('-'.repeat(120));
      
      orphanedFiles.forEach(file => {
        const id = file.id.padEnd(36);
        const name = file.name ? file.name.substring(0, 40).padEnd(40) : 'Unknown'.padEnd(40);
        const typeId = file.document_type_id ? file.document_type_id.padEnd(36) : 'null'.padEnd(36);
        console.log(`| ${id} | ${name} | ${typeId} |`);
      });
      
      console.log('-'.repeat(120));

      // 4. Fix the orphaned files by setting document_type_id to null
      if (dryRun) {
        console.log('\n🔍 DRY RUN: Would update the following files (no changes made):');
        orphanedFiles.forEach(file => {
          console.log(`  - ${file.name || 'Unnamed file'} (${file.id})`);
        });
      } else {
        console.log('\n🔧 Updating orphaned files...');
        
        // Update in batches of 20 to avoid overwhelming the database
        const batchSize = 20;
        let successCount = 0;
        let failureCount = 0;
        
        for (let i = 0; i < orphanedFiles.length; i += batchSize) {
          const batch = orphanedFiles.slice(i, i + batchSize);
          const batchIds = batch.map(file => file.id);
          
          try {
            const { data, error } = await supabase
              .from('google_sources')
              .update({ document_type_id: null })
              .in('id', batchIds)
              .select('id');
            
            if (error) {
              console.error(`❌ Error updating batch ${i/batchSize + 1}: ${error.message}`);
              failureCount += batch.length;
            } else {
              if (debug) console.log(`✅ Updated batch ${i/batchSize + 1} (${batch.length} files)`);
              successCount += data?.length || 0;
            }
          } catch (err) {
            console.error(`❌ Exception in batch ${i/batchSize + 1}: ${(err as Error).message}`);
            failureCount += batch.length;
          }
          
          // Add a small delay between batches
          if (i + batchSize < orphanedFiles.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        console.log('\n✅ Completed with the following results:');
        console.log(`- Successfully updated: ${successCount} files`);
        if (failureCount > 0) {
          console.log(`- Failed to update: ${failureCount} files`);
        }
      }
      
      console.log('\n🎯 Next steps:');
      console.log('- Run the classification command to re-classify these files:');
      console.log('  ./scripts/cli-pipeline/google_sync/google-sync-cli.sh classify-docs-service');

    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// Parse command line arguments and execute
program.parse(process.argv);