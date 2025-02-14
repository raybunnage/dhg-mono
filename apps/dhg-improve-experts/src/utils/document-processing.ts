import { supabase } from '@/integrations/supabase/client'
import { getGoogleDocContent, getPdfContent } from './google-drive'

interface ProcessingResult {
  success: boolean
  message: string
  processedCount: number
  errors?: string[]
}

export async function processUnextractedDocuments(): Promise<ProcessingResult> {
  try {
    console.log('Starting document processing')
    
    // Test Supabase connection first
    const { data: testData, error: testError } = await supabase
      .from('sources_google')
      .select('count')
      .single()
    
    console.log('Test connection:', { testData, testError })

    // Get unprocessed documents
    const { data: documents, error: fetchError } = await supabase
      .from('sources_google')
      .select('*')
      .eq('content_extracted', false)
      .is('extraction_error', null)
      .in('mime_type', [
        'application/pdf',
        'application/vnd.google-apps.document'
      ])
      .limit(10)

    console.log('Found documents:', documents)
    console.log('Fetch error:', fetchError)
    if (fetchError) throw fetchError

    if (!documents?.length) {
      return {
        success: true,
        message: 'No documents to process',
        processedCount: 0
      }
    }

    const errors: string[] = []
    let processedCount = 0

    // Process each document
    for (const doc of documents) {
      try {
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
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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

        processedCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Error processing document ${doc.id}: ${errorMessage}`)

        // Log error in sources_google
        await supabase
          .from('sources_google')
          .update({
            extraction_error: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.id)
      }
    }

    return {
      success: true,
      message: `Processed ${processedCount} documents`,
      processedCount,
      errors: errors.length > 0 ? errors : undefined
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: `Processing failed: ${errorMessage}`,
      processedCount: 0,
      errors: [errorMessage]
    }
  }
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