#\!/usr/bin/env ts-node

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';

interface DeleteOptions {
  input: string;
  verbose: boolean;
}

interface OrphanedRecord {
  id: string;
  source_id: string | null;
  document_type_id: string | null;
  document_processing_status: string | null;
  created_at: string | null;
}

interface PresentationAsset {
  id: string;
  presentation_id: string;
  expert_document_id: string;
  created_at: string | null;
}

interface IdentifyResult {
  orphanedRecordsFound: number;
  presentationAssetsFound: number;
  orphanedRecords: OrphanedRecord[];
  presentationAssets: PresentationAsset[];
}

async function deleteOrphanedRecords(options: DeleteOptions): Promise<void> {
  try {
    // Start command tracking
    const trackingId = await commandTrackingService.startTracking(
      'google_sync', 
      'delete-orphaned-records'
    );
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Step 1: Read input file
    console.log(`Reading input file: ${options.input}`);
    const inputData = fs.readFileSync(options.input, 'utf-8');
    const result: IdentifyResult = JSON.parse(inputData);
    
    console.log(`Loaded data for ${result.orphanedRecordsFound} orphaned expert_documents`);
    console.log(`Loaded data for ${result.presentationAssetsFound} related presentation_assets`);
    
    if (result.orphanedRecordsFound === 0) {
      console.log('No orphaned records to delete');
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 0,
        summary: 'No orphaned records to delete'
      });
      return;
    }
    
    // Step 2: Delete presentation_assets first
    if (result.presentationAssets.length > 0) {
      console.log(`Deleting ${result.presentationAssets.length} presentation_assets...`);
      
      const presentationAssetIds = result.presentationAssets.map(asset => asset.id);
      
      const { error: deleteAssetsError } = await supabase
        .from('presentation_assets')
        .delete()
        .in('id', presentationAssetIds);
        
      if (deleteAssetsError) {
        throw new Error(`Failed to delete presentation_assets: ${deleteAssetsError.message}`);
      }
      
      console.log(`✅ Successfully deleted ${result.presentationAssets.length} presentation_assets`);
    } else {
      console.log('No presentation_assets to delete');
    }
    
    // Step 3: Delete orphaned expert_documents
    console.log(`Deleting ${result.orphanedRecords.length} orphaned expert_documents...`);
    
    const orphanedIds = result.orphanedRecords.map(doc => doc.id);
    
    const { error: deleteDocsError } = await supabase
      .from('expert_documents')
      .delete()
      .in('id', orphanedIds);
      
    if (deleteDocsError) {
      throw new Error(`Failed to delete expert_documents: ${deleteDocsError.message}`);
    }
    
    console.log(`✅ Successfully deleted ${result.orphanedRecords.length} orphaned expert_documents`);
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: result.orphanedRecords.length + result.presentationAssets.length,
      summary: `Cleaned up ${result.orphanedRecords.length} orphaned expert_documents and ${result.presentationAssets.length} related presentation_assets`
    });
    
    console.log('\nOrphaned records cleanup complete\!');
    
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Log tracking failure
    try {
      const trackingId = await commandTrackingService.startTracking(
        'google_sync', 
        'delete-orphaned-records'
      );
      await commandTrackingService.failTracking(
        trackingId,
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } catch (trackingError) {
      console.warn(`Failed to track command error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
    }
    
    process.exit(1);
  }
}

// Set up command line interface
const program = new Command();

program
  .name('delete-orphaned-records')
  .description('Delete orphaned expert_documents records and related presentation_assets')
  .option('--input <path>', 'Input file path with orphaned records data', '/tmp/orphaned-records.json')
  .option('--verbose', 'Show detailed information during processing', false)
  .action(async (options) => {
    await deleteOrphanedRecords({
      input: options.input,
      verbose: options.verbose
    });
  });

if (require.main === module) {
  program.parse(process.argv);
}
