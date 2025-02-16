import { supabase } from '@/integrations/supabase/client'
import { getGoogleDocContent, getPdfContent } from './google-drive'
import { toast } from 'react-hot-toast'
import { EXPERT_EXTRACTION_PROMPT } from '@/config/ai-prompts'
import { EXPERT_PROFILER_PROMPT } from '@/app/experts/profiler/prompts'

interface ProcessingResult {
  success: boolean
  message: string
  processedCount: number
  errors?: string[]
}

// Add abort controller
let abortController: AbortController | null = null;

export function abortProcessing() {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}

export async function processUnextractedDocuments(batchSize = 10): Promise<ProcessingResult> {
  const toastId = toast.loading('Starting document processing...');
  const MAX_FILE_SIZE = 1000000; // 1MB
  
  // Create new abort controller
  abortController = new AbortController();
  
  try {
    // Double-check we're only getting unprocessed documents
    const { data: documents, error } = await supabase
      .from('expert_documents')
      .select('*')
      .eq('processing_status', 'pending')
      .is('processed_content', null)
      .is('content_extracted', false)  // Additional check
      .limit(batchSize)
      .order('created_at', { ascending: true });
      
    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
    
    if (!documents || documents.length === 0) {
      toast.success('No pending documents to process', { id: toastId });
      return {
        success: true,
        message: 'No documents to process',
        processedCount: 0
      };
    }

    toast.loading(
      `Processing batch of ${documents.length} documents (max size: ${batchSize})...`, 
      { id: toastId }
    );

    const results = {
      processed: 0,
      skipped: 0,
      errors: 0,
      errorDetails: [] as string[]
    };

    for (const doc of documents) {
      // Check if processing was aborted
      if (abortController.signal.aborted) {
        throw new Error('Processing aborted by user');
      }

      try {
        // Detailed size check with error message
        if (doc.raw_content && doc.raw_content.length > MAX_FILE_SIZE) {
          const sizeMB = (doc.raw_content.length / 1000000).toFixed(2);
          const errorMsg = `Skipped: ${doc.id} (${sizeMB}MB exceeds ${MAX_FILE_SIZE/1000000}MB limit)`;
          results.errorDetails.push(errorMsg);
          results.skipped++;
          
          // Update document status for skipped files
          await supabase
            .from('expert_documents')
            .update({ 
              processing_status: 'skipped',
              error_message: `File too large: ${sizeMB}MB`
            })
            .eq('id', doc.id);
            
          continue;
        }

        // Process the document with timeout
        await Promise.race([
          processDocumentWithAI(doc.id),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Processing timeout')), 300000) // 5 min timeout
          )
        ]);

        results.processed++;

        // Update progress with detailed stats
        toast.loading(
          `Progress: ${results.processed}/${documents.length}\n` +
          `Completed: ${results.processed}\n` +
          `Skipped: ${results.skipped}\n` +
          `Errors: ${results.errors}`, 
          { id: toastId }
        );

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors++;
        results.errorDetails.push(`Error processing ${doc.id}: ${errorMessage}`);
        
        // Categorize error type
        const errorType = categorizeError(error);
        
        // Update document with detailed error info
        await supabase
          .from('expert_documents')
          .update({ 
            processing_status: 'failed',
            error_message: errorMessage,
            error_metadata: {
              error_type: errorType,
              timestamp: new Date().toISOString(),
              details: error instanceof Error ? {
                name: error.name,
                stack: error.stack,
                message: error.message
              } : 'Unknown error structure'
            },
            retry_count: (doc.retry_count || 0) + 1
          })
          .eq('id', doc.id);
      }
    }

    // Detailed final status update
    const statusMessage = [
      `Processing complete!`,
      `Batch size: ${documents.length}`,
      `Processed: ${results.processed}`,
      `Skipped: ${results.skipped}`,
      `Errors: ${results.errors}`,
      results.errorDetails.length > 0 ? '\nError Details:' : '',
      ...results.errorDetails.slice(0, 3), // Show first 3 errors
      results.errorDetails.length > 3 ? `...and ${results.errorDetails.length - 3} more errors` : ''
    ].join('\n');

    toast.success(statusMessage, { id: toastId, duration: 5000 });

    return {
      success: results.errors === 0,
      message: statusMessage,
      processedCount: results.processed,
      errors: results.errorDetails.length > 0 ? results.errorDetails : undefined
    };

  } catch (error) {
    if (error instanceof Error && error.message === 'Processing aborted by user') {
      toast.success('Processing aborted by user', { id: toastId });
      return {
        success: true,
        message: 'Processing aborted by user',
        processedCount: results.processed
      };
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Document processing failed:', error);
    toast.error(`Processing failed: ${errorMessage}`, { id: toastId });
    
    return {
      success: false,
      message: 'Batch processing failed',
      processedCount: 0,
      errors: [errorMessage]
    };
  } finally {
    abortController = null;
  }
}

// Helper function to categorize errors
function categorizeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) return 'TIMEOUT';
    if (error.message.includes('network')) return 'NETWORK';
    if (error.message.includes('permission')) return 'PERMISSION';
    if (error.message.includes('AI')) return 'AI_PROCESSING';
    if (error.message.includes('token')) return 'TOKEN';
    return 'UNKNOWN';
  }
  return 'UNCATEGORIZED';
}

export async function testSingleDocument(documentId: string): Promise<void> {
  try {
    // Get document from sources_google
    const { data: doc, error: fetchError } = await supabase
      .from('sources_google')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;
    if (!doc) throw new Error('Document not found');

    console.log('Testing document:', doc);

    let extractedContent: string;
    
    // Extract content based on mime type
    if (doc.mime_type === 'application/pdf') {
      const pdfBuffer = await getPdfContent(doc.drive_id);
      extractedContent = `PDF content length: ${pdfBuffer.byteLength} bytes`;
      // TODO: Add PDF text extraction
    } else if (doc.mime_type === 'application/vnd.google-apps.document') {
      extractedContent = await getGoogleDocContent(doc.drive_id);
    } else {
      throw new Error(`Unsupported mime type: ${doc.mime_type}`);
    }

    console.log('Extracted content:', extractedContent.substring(0, 200) + '...');

    // Create expert_documents record
    const { error: insertError } = await supabase
      .from('expert_documents')
      .insert({
        expert_id: doc.expert_id,
        source_id: doc.id,
        document_type_id: doc.document_type_id,
        raw_content: extractedContent,
        processed_content: { text: extractedContent },
        processing_status: 'pending',
        word_count: extractedContent.split(/\s+/).length,
        language: 'en',
        version: 1,
        is_latest: true,
        classification_metadata: {
          is_test_record: true,
          test_created_at: new Date().toISOString(),
          original_mime_type: doc.mime_type
        }
      });

    if (insertError) throw insertError;

    // Update sources_google record
    const { error: updateError } = await supabase
      .from('sources_google')
      .update({
        content_extracted: true,
        extracted_content: { text: extractedContent },
        updated_at: new Date().toISOString()
      })
      .eq('id', doc.id);

    if (updateError) throw updateError;

    console.log('Successfully created expert_documents record and updated source');

  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Add this function to expose the current prompt
export function getCurrentPrompt(): string {
  return EXPERT_EXTRACTION_PROMPT;
}

// Update the processDocumentWithAI function
async function processDocumentWithAI(documentId: string) {
  const { data: document, error } = await supabase
    .from('expert_documents')
    .select('raw_content')
    .eq('id', documentId)
    .single();

  if (error || !document) {
    throw new Error('Failed to fetch document content');
  }

  console.log('Using Expert Profiler prompt...');
  
  const response = await anthropic.messages.create({
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4096,
    system: EXPERT_PROFILER_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this document and create a detailed expert profile: ${document.raw_content}`
    }]
  });

  // Parse and validate the response
  try {
    const extractedData = JSON.parse(response.content[0].text);
    
    // Update the document with processed content
    await supabase
      .from('expert_documents')
      .update({
        processed_content: extractedData,
        processing_status: 'completed',
        processed_at: new Date().toISOString(),
        metadata: {
          prompt_version: 'expert_profiler_v1',
          model: 'claude-3-sonnet-20240229',
          confidence_scores: extractedData.metadata?.confidenceScores
        }
      })
      .eq('id', documentId);

    return extractedData;
  } catch (error) {
    throw new Error(`Failed to parse AI response: ${error.message}`);
  }
} 