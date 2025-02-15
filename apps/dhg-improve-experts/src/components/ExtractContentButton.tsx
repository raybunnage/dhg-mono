import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../types/supabase';
import { toast } from 'react-hot-toast';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getGoogleDocContent, getDocxContent } from '@/utils/google-drive';
import mammoth from 'mammoth';

interface ExtractContentButtonProps {
  onSuccess?: (docId: string) => void;
  onError?: (error: Error, docId?: string) => void;
}

function ExtractContentButton({ onSuccess, onError }: ExtractContentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [documents, setDocuments] = useState<{ id: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Find documents that need content extraction
  const initializeDocuments = async () => {
    setIsLoading(true);
    setProgress({ current: 0, total: 0 });
    const toastId = toast.loading('Finding documents that need extraction...');

    try {
      // First get the list of expert_documents that need content
      const { data: docs, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name,
            drive_id,
            mime_type,
            content_extracted,
            extraction_error
          )
        `)
        .is('raw_content', null)  // No content yet
        .not('source_id', 'is', null)  // Has a source document
        .order('id');

      if (error) throw error;

      if (!docs || docs.length === 0) {
        toast.success('No documents need content extraction', { id: toastId });
        return;
      }

      // Filter to only include documents with valid sources
      const docsNeedingExtraction = docs.filter(doc => 
        doc.source && 
        !doc.source.content_extracted && 
        doc.source.mime_type.includes('wordprocessingml.document')  // docx files
      );

      console.log('Documents needing extraction:', {
        total: docsNeedingExtraction.length,
        documents: docsNeedingExtraction.map(d => ({
          expertDocId: d.id,
          sourceId: d.source?.id,
          name: d.source?.name,
          mimeType: d.source?.mime_type
        }))
      });
      
      setProgress({ current: 0, total: docsNeedingExtraction.length });
      setDocuments(docsNeedingExtraction);
      setCurrentIndex(0);
      setInitialized(true);
      toast.success(`Ready to extract ${docsNeedingExtraction.length} documents`, { id: toastId });

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      console.error('Initialization error:', error);
      toast.error(error.message, { id: toastId });
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add Google Drive content extraction
  const extractGoogleDriveContent = async (driveId: string, mimeType: string) => {
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;

      console.log('Starting Drive content extraction:', {
        driveId,
        mimeType,
        hasAccessToken: !!accessToken,
        tokenLength: accessToken?.length,
        tokenStart: accessToken?.substring(0, 10) + '...'
      });

      if (mimeType.includes('officedocument')) {
        const url = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;
        console.log('Fetching document:', { url });

        const downloadResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });

        console.log('Download response:', {
          ok: downloadResponse.ok,
          status: downloadResponse.status,
          statusText: downloadResponse.statusText,
          headers: Object.fromEntries(downloadResponse.headers.entries()),
          contentType: downloadResponse.headers.get('content-type'),
          contentLength: downloadResponse.headers.get('content-length')
        });

        if (!downloadResponse.ok) {
          const errorText = await downloadResponse.text();
          console.error('Download failed:', {
            status: downloadResponse.status,
            statusText: downloadResponse.statusText,
            errorText,
            headers: Object.fromEntries(downloadResponse.headers.entries())
          });
          throw new Error(`Could not download Office document: ${downloadResponse.status} - ${errorText}`);
        }

        const buffer = await downloadResponse.arrayBuffer();
        
        // Use convertToHtml with error handling
        const result = await mammoth.convertToHtml({ 
          arrayBuffer: buffer,
          // Add options to control conversion
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read().then(function(imageBuffer) {
              // Skip images - just extract text
              return { src: "" };
            });
          })
        });
        
        // Check for conversion errors/warnings
        if (result.messages.length > 0) {
          console.warn('Mammoth conversion messages:', {
            messages: result.messages,
            driveId
          });
        }

        if (!result.value) {
          throw new Error('Mammoth conversion produced no content');
        }

        console.log('Mammoth conversion result:', {
          textLength: result.value.length,
          hasMessages: result.messages.length > 0,
          preview: result.value.slice(0, 100)
        });

        // Strip HTML but preserve structure
        const cleanText = result.value
          .replace(/<p>/g, '')
          .replace(/<\/p>/g, '\n\n')
          .replace(/<li>/g, '• ')
          .replace(/<\/li>/g, '\n')
          .replace(/<[^>]*>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        // Validate cleaned content
        if (!cleanText || cleanText.length < 10) {
          throw new Error('Cleaned content appears invalid');
        }

        return cleanText;
      }

      throw new Error(`Unsupported mime type: ${mimeType}`);
    } catch (error) {
      console.error('DOCX extraction failed:', {
        error,
        driveId,
        mimeType,
        stage: error.message.includes('Mammoth') ? 'conversion' : 'download'
      });
      throw error;
    }
  };

  // Modify the cleanContent function to ensure PostgreSQL text compatibility
  const cleanContent = (content: string): string => {
    if (!content) return '';
    
    // First clean HTML if present
    let cleaned = content;
    if (content.includes('<')) {
      cleaned = content
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n\n')
        .replace(/<li>/g, '• ')
        .replace(/<\/li>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\n{3,}/g, '\n\n');
    }

    // Clean for PostgreSQL text compatibility
    cleaned = cleaned
      // Remove null bytes (PostgreSQL text cannot contain null bytes)
      .replace(/\u0000/g, '')
      // Remove non-printable characters except newlines and tabs
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Normalize newlines
      .replace(/\r\n/g, '\n')
      // Normalize spaces
      .replace(/\s+/g, ' ')
      .trim();

    // Validate for PostgreSQL
    if (!cleaned || cleaned.length < 1) {
      throw new Error('Empty content after cleaning');
    }

    // Test if the content is valid JSON to avoid accidental JSON strings
    try {
      JSON.parse(cleaned);
      // If we get here, it's valid JSON, which we don't want
      throw new Error('Content appears to be JSON');
    } catch (e) {
      // This is good - we want it to NOT be valid JSON
    }

    return cleaned;
  };

  // Extract content from current document
  const extractCurrentDocument = async () => {
    if (currentIndex < 0 || currentIndex >= documents.length) return;

    setIsLoading(true);
    const doc = documents[currentIndex];
    const toastId = toast.loading(`Extracting content from ${doc.source?.name}`);

    try {
      // Update progress
      setProgress(prev => ({
        current: prev.current + 1,
        total: documents.length
      }));

      if (!doc.source?.drive_id) {
        const error = `Document ${doc.source?.name} has no Drive ID`;
        console.error('Missing drive_id:', { doc });
        toast.error(error, { id: toastId });
        return;
      }

      // Get content from Google Drive
      console.log('Requesting content from Drive:', {
        driveId: doc.source.drive_id,
        mimeType: doc.source.mime_type
      });

      const content = await extractGoogleDriveContent(
        doc.source.drive_id,
        doc.source.mime_type
      );

      if (!content) {
        throw new Error('No content returned from Google Drive');
      }

      // Clean the content
      const cleanedContent = cleanContent(content);

      // Create a JSON object for the content
      const contentObject = {
        text: cleanedContent,
        extractedAt: new Date().toISOString(),
        source: 'mammoth',
        version: '1.0'
      };

      console.log('Saving content object:', {
        length: cleanedContent.length,
        preview: cleanedContent.slice(0, 100),
        object: contentObject
      });

      // Update sources_google with JSON object
      const { error: updateError } = await supabase
        .from('sources_google')
        .update({
          content_extracted: true,
          extracted_content: contentObject,  // This must be a JSON object
          updated_at: new Date().toISOString()
        })
        .eq('id', doc.source.id);

      if (updateError) {
        console.error('sources_google update failed:', {
          error: updateError,
          sourceId: doc.source.id
        });
        throw updateError;
      }

      // Update expert_documents with raw text
      const { error: docUpdateError } = await supabase
        .from('expert_documents')
        .update({
          raw_content: cleanedContent,  // This can be plain text
          processing_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', doc.id);

      if (docUpdateError) {
        toast.error(`Failed to update document: ${docUpdateError.message}`, { id: toastId });
        throw docUpdateError;
      }

      toast.success(`Extracted content from ${doc.source?.name}`, { id: toastId });
      onSuccess?.(doc.id);

      // Move to next document
      if (currentIndex < documents.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        // All documents processed
        toast.success('All documents processed successfully!', { id: toastId });
        setProgress({ current: 0, total: 0 });
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error(JSON.stringify(err));
      console.error('Document extraction failed:', {
        document: {
          id: doc.id,
          name: doc.source?.name,
          driveId: doc.source?.drive_id,
          mimeType: doc.source?.mime_type
        },
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          raw: err
        }
      });
      toast.error(error.message, { id: toastId });
      onError?.(error, doc.id);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle button click
  const handleClick = async () => {
    if (!initialized) {
      await initializeDocuments();
    } else {
      await extractCurrentDocument();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      {isLoading && progress.total > 0 && (
        <div className="w-full">
          <div className="bg-gray-200 rounded-full h-2.5 mb-2">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <div className="text-sm text-gray-600">
            Processing document {progress.current} of {progress.total}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 items-center">
        <button 
          onClick={handleClick}
          disabled={isLoading}
          className="bg-blue-600 text-white rounded-md px-4 py-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              {initialized ? 'Extracting...' : 'Finding Documents...'}
            </>
          ) : !initialized ? (
            'Start Content Extraction'
          ) : (
            'Extract Current'
          )}
        </button>

        {initialized && (
          <span className="text-sm text-gray-600">
            {progress.current} of {progress.total} documents processed
          </span>
        )}
      </div>
    </div>
  );
}

export { ExtractContentButton }; 