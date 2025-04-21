#!/usr/bin/env ts-node
/**
 * Helper functions for the reclassify-docs command
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

/**
 * Updates the document_processing_status field in the expert_documents table
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
    
    // First, check the current status of the document to aid in debugging
    const { data: currentDoc, error: checkError } = await supabase
      .from('expert_documents')
      .select('document_processing_status, processing_status')
      .eq('id', documentId)
      .single();
    
    if (checkError) {
      console.error(`Error checking current document status for ${documentId}: ${checkError.message}`);
    } else if (currentDoc) {
      console.log(`Current status of document ${documentId}:`);
      console.log(`- document_processing_status: ${currentDoc.document_processing_status}`);
      console.log(`- processing_status: ${currentDoc.processing_status}`);
    }
    
    // Update the expert_document record with document_processing_status = 'reprocessing_done'
    const { error } = await supabase
      .from('expert_documents')
      .update({ // Changed from upsert to update since we know the document exists
        document_processing_status: 'reprocessing_done',
        document_processing_status_updated_at: new Date().toISOString(),
        processing_status: 'completed', // Keep the original processing_status field as completed
        processing_skip_reason: null, // Clear any previous skip reason
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId); // Use eq instead of onConflict for more reliable updates
    
    if (error) {
      console.error(`Error updating document_processing_status for document ${documentId}: ${error.message}`);
      return false;
    }
    
    // Verify the update worked
    const { data: updatedDoc, error: verifyError } = await supabase
      .from('expert_documents')
      .select('document_processing_status')
      .eq('id', documentId)
      .single();
      
    if (verifyError) {
      console.error(`Error verifying update for document ${documentId}: ${verifyError.message}`);
    } else if (updatedDoc) {
      console.log(`Verified document ${documentId} status is now: ${updatedDoc.document_processing_status}`);
    }
    
    console.log(`✅ Updated document ${documentId} with document_processing_status = 'reprocessing_done'`);
    return true;
  } catch (error) {
    console.error(`Failed to mark document ${documentId} as reprocessing_done: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Helper function to mark documents that need reprocessing
 * 
 * @param documentId ID of the expert_document to update
 * @param sourceId ID of the source
 * @returns true if successful, false if there was an error
 */
export async function markNeedsReprocessing(documentId: string, sourceId: string): Promise<boolean> {
  try {
    // Get Supabase client 
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Update the expert_document record with document_processing_status = 'needs_reprocessing'
    const { error } = await supabase
      .from('expert_documents')
      .update({
        document_processing_status: 'needs_reprocessing',
        document_processing_status_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (error) {
      console.error(`Error updating document_processing_status for document ${documentId}: ${error.message}`);
      return false;
    }
    
    console.log(`✅ Updated document ${documentId} with document_processing_status = 'needs_reprocessing'`);
    return true;
  } catch (error) {
    console.error(`Failed to mark document ${documentId} as needs_reprocessing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}