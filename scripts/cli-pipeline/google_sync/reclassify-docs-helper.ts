#!/usr/bin/env ts-node
/**
 * Helper functions for the reclassify-docs command
 * 
 * This file contains helper functions used by the reclassify-docs command, including:
 * - markReprocessingDone: Mark a document as done with reprocessing
 * - markNeedsReprocessing: Mark a document as needing reprocessing
 * - markSkipProcessing: Mark a document to skip processing (for unsupported types)
 * - checkDocumentSummary: Check and display a document's summary
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { promptService } from '../../../packages/shared/services/prompt-service';
import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import { GoogleDriveService } from '../../../packages/shared/services/google-drive';

// The prompt to use for classification
const CLASSIFICATION_PROMPT = 'document-classification-prompt-new';

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

/**
 * Mark a document to skip processing (for unsupported file types like videos)
 * 
 * @param documentId ID of the expert_document to mark
 * @param sourceId ID of the source
 * @param skipReason Reason why processing should be skipped
 * @returns true if successful, false if there was an error
 */
export async function markSkipProcessing(
  documentId: string, 
  sourceId: string,
  skipReason: string = "Unsupported file type for content extraction"
): Promise<boolean> {
  try {
    // Get Supabase client 
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First, check the current status of the document
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
    
    // Update the expert_document record with document_processing_status = 'skip_processing'
    const { error } = await supabase
      .from('expert_documents')
      .update({
        document_processing_status: 'skip_processing',
        document_processing_status_updated_at: new Date().toISOString(),
        processing_status: 'completed', // Set processing_status to completed
        processing_skip_reason: skipReason,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);
    
    if (error) {
      console.error(`Error updating document_processing_status for document ${documentId}: ${error.message}`);
      return false;
    }
    
    // Verify the update worked
    const { data: updatedDoc, error: verifyError } = await supabase
      .from('expert_documents')
      .select('document_processing_status, processing_skip_reason')
      .eq('id', documentId)
      .single();
      
    if (verifyError) {
      console.error(`Error verifying update for document ${documentId}: ${verifyError.message}`);
    } else if (updatedDoc) {
      console.log(`Verified document ${documentId} status is now: ${updatedDoc.document_processing_status}`);
      console.log(`Skip reason: ${updatedDoc.processing_skip_reason}`);
    }
    
    console.log(`✅ Updated document ${documentId} to skip processing`);
    return true;
  } catch (error) {
    console.error(`Failed to mark document ${documentId} to skip processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Check and display document summary after reprocessing
 * 
 * @param documentId ID of the expert_document to check
 * @returns Promise resolving to void
 */
export async function checkDocumentSummary(documentId: string): Promise<void> {
  try {
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get the document details
    const { data: document, error } = await supabase
      .from('expert_documents')
      .select('id, processed_content')
      .eq('id', documentId)
      .single();
    
    if (error || !document) {
      console.error(`Error getting document ${documentId}: ${error?.message || 'Document not found'}`);
      return;
    }
    
    // Check if processed_content exists and has document_summary
    if (!document.processed_content) {
      console.log(`❌ No processed_content found for document ${documentId}`);
      return;
    }
    
    try {
      // If processed_content is a string, parse it
      const content = typeof document.processed_content === 'string' 
        ? JSON.parse(document.processed_content) 
        : document.processed_content;
      
      // Look for document_summary field
      if (content.document_summary && typeof content.document_summary === 'string') {
        console.log(`\n📝 DOCUMENT SUMMARY PREVIEW:`);
        console.log(`----------------------------------------------------------------------------------`);
        // Display first 400 chars of summary with ellipsis if longer
        const summary = content.document_summary.substring(0, 400) + 
          (content.document_summary.length > 400 ? '...' : '');
        console.log(summary);
        console.log(`----------------------------------------------------------------------------------`);
        
        // Show classification confidence if available
        if (content.classification_confidence) {
          const confidence = typeof content.classification_confidence === 'number' 
            ? content.classification_confidence 
            : parseFloat(content.classification_confidence);
          console.log(`📊 Classification confidence: ${(confidence * 100).toFixed(1)}%`);
        }
        
        // Show document type if available
        if (content.document_type) {
          console.log(`📄 Document type: ${content.document_type}`);
        }
        
        console.log(`✅ Summary successfully extracted`);
        return;
      }
      
      // Check for AI classification analysis (for PDF/DOCX)
      if (content.ai_analysis && content.ai_analysis.document_summary) {
        console.log(`\n📝 DOCUMENT SUMMARY PREVIEW:`);
        console.log(`----------------------------------------------------------------------------------`);
        const summary = content.ai_analysis.document_summary.substring(0, 400) + 
          (content.ai_analysis.document_summary.length > 400 ? '...' : '');
        console.log(summary);
        console.log(`----------------------------------------------------------------------------------`);
        
        // Show classification confidence if available
        if (content.ai_analysis.classification_confidence) {
          const confidence = typeof content.ai_analysis.classification_confidence === 'number' 
            ? content.ai_analysis.classification_confidence 
            : parseFloat(content.ai_analysis.classification_confidence);
          console.log(`📊 Classification confidence: ${(confidence * 100).toFixed(1)}%`);
        }
        
        // Show document type if available
        if (content.ai_analysis.document_type) {
          console.log(`📄 Document type: ${content.ai_analysis.document_type}`);
        }
        
        console.log(`✅ Summary successfully extracted from AI analysis`);
        return;
      }
      
      // Check for alternative summary fields
      const summaryFields = ['summary', 'content_summary', 'executive_summary'];
      for (const field of summaryFields) {
        if (content[field] && typeof content[field] === 'string') {
          console.log(`\n📝 DOCUMENT SUMMARY PREVIEW (${field}):`);
          console.log(`----------------------------------------------------------------------------------`);
          const summary = content[field].substring(0, 400) + 
            (content[field].length > 400 ? '...' : '');
          console.log(summary);
          console.log(`----------------------------------------------------------------------------------`);
          console.log(`✅ Alternative summary (${field}) successfully extracted`);
          return;
        }
      }
      
      console.log(`❓ No document_summary found in processed_content. Available fields:`, 
        Object.keys(content).join(', '));
    } catch (error) {
      console.error(`Error extracting summary from processed_content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`Error in checkDocumentSummary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}