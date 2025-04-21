#!/usr/bin/env ts-node
/**
 * Helper functions for the reclassify_docs command
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

/**
 * Updates the processing_status field in the expert_documents table
 * to indicate successful reprocessing
 * 
 * @param documentId ID of the expert_document to update
 * @param sourceId ID of the source (required for upsert operation)
 * @returns true if successful, false if there was an error
 */
export async function markReprocessingDone(documentId: string, sourceId: string): Promise<boolean> {
  try {
    // Get Supabase client 
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Update the expert_document record with processing_status = 'reprocessing_done'
    const { error } = await supabase
      .from('expert_documents')
      .upsert({
        id: documentId,
        source_id: sourceId, // Required for upsert operation
        processing_status: 'reprocessing_done',
        processing_skip_reason: null, // Clear any previous skip reason
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    
    if (error) {
      console.error(`Error updating processing_status for document ${documentId}: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Updated document ${documentId} with processing_status = 'reprocessing_done'`);
    return true;
  } catch (error) {
    console.error(`Failed to mark document ${documentId} as reprocessing_done: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}