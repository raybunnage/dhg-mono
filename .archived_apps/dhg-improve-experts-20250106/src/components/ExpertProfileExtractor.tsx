import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { processWithAI } from '@/utils/ai-processing';
import { loadPromptFromMarkdown } from '@/utils/prompt-loader';
import { ProcessedProfileViewer } from './ProcessedProfileViewer';
import { ProcessingControls } from '@/components/ProcessingControls';

interface FileTypeFilter {
  type: string;
  label: string;
  mimeTypes: string[];
}

interface ExpertDocument {
  id: string;
  raw_content: string;
  processed_content?: any;
  processing_status?: string;
  processed_at?: string;
  source: {
    id: string;
    name: string;
    mime_type: string;
  };
}

interface ExpertProfile {
  name: string;
  title: string;
  current_position: string;
  institution: string;
  credentials: string[];
  specialty_areas: string[];
  research_summary: string;
  notable_achievements: string[];
  website_urls: string[];
  expertise_keywords: string[];
}

interface ProcessingCleanup {
  abortedAt: string;
  processedCount: number;
  remainingDocs: string[];
}

const ProfileViewer = ({ profile }: { profile: ExpertProfile }) => {
  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
        {JSON.stringify(profile, null, 2)}
      </pre>
    </div>
  );
};

const ANNOUNCEMENT_SIZE_LIMIT = 20 * 1024; // 20KB in bytes

export function ExpertProfileExtractor() {
  const [documents, setDocuments] = useState<ExpertDocument[]>([]);
  const [currentDoc, setCurrentDoc] = useState<ExpertDocument | null>(null);
  const [extractedProfile, setExtractedProfile] = useState<ExpertProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expertPrompt, setExpertPrompt] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    currentDoc: ''
  });
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [processAll, setProcessAll] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const fileTypeFilters: FileTypeFilter[] = [
    {
      type: 'pdf',
      label: 'PDF Files',
      mimeTypes: ['application/pdf']
    },
    {
      type: 'document',
      label: 'Documents',
      mimeTypes: [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.google-apps.document'
      ]
    },
    {
      type: 'presentation',
      label: 'Presentations',
      mimeTypes: [
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ]
    },
    {
      type: 'video',
      label: 'Videos',
      mimeTypes: ['video/mp4', 'video/mpeg']
    },
    {
      type: 'audio',
      label: 'Audio',
      mimeTypes: ['audio/mpeg', 'audio/wav']
    },
    {
      type: 'text',
      label: 'Text',
      mimeTypes: ['text/plain', 'text/csv']
    }
  ];

  const toggleFilter = (filterType: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(filterType)) {
        next.delete(filterType);
      } else {
        next.add(filterType);
      }
      return next;
    });
  };

  const filteredDocuments = useMemo(() => {
    if (activeFilters.size === 0) return documents;
    
    return documents.filter(doc => {
      const docMimeType = doc.source.mime_type;
      return Array.from(activeFilters).some(filterType => {
        const filter = fileTypeFilters.find(f => f.type === filterType);
        return filter?.mimeTypes.includes(docMimeType);
      });
    });
  }, [documents, activeFilters]);

  useEffect(() => {
    loadDocuments();
    loadExpertPrompt();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('google_expert_documents')
        .select(`
          id,
          raw_content,
          processed_content,
          processing_status,
          processed_at,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name,
            mime_type
          )
        `)
        .not('raw_content', 'is', null)
        .order('id');

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const loadExpertPrompt = async () => {
    console.log('Starting to load expert prompt...');
    try {
      const prompt = await loadPromptFromMarkdown('/docs/prompts/expert-extraction-prompt.md');
      console.log('Successfully loaded prompt:', {
        length: prompt.length,
        preview: prompt.slice(0, 100)
      });
      setExpertPrompt(prompt);
    } catch (error) {
      console.error('Failed to load expert prompt:', error);
      toast.error('Failed to load extraction prompt');
    }
  };

  const extractProfile = async (doc: ExpertDocument) => {
    if (!expertPrompt) {
      toast.error('Expert extraction prompt not loaded');
      return;
    }

    // Check document size
    const contentSizeBytes = new TextEncoder().encode(doc.raw_content).length;
    if (contentSizeBytes > ANNOUNCEMENT_SIZE_LIMIT) {
      toast.success(`Skipping "${doc.source.name}" - Document size (${(contentSizeBytes/1024).toFixed(1)}KB) exceeds announcement limit (20KB)`);
      console.log('Skipped large document:', {
        name: doc.source.name,
        size: `${(contentSizeBytes/1024).toFixed(1)}KB`,
        limit: '20KB',
        preview: doc.raw_content.slice(0, 100) + '...'
      });
      return;
    }

    setIsLoading(true);
    setCurrentDoc(doc);
    setExtractedProfile(null);

    try {
      const result = await processWithAI({
        systemPrompt: expertPrompt,
        userMessage: `Analyze this document and extract a professional profile according to the above structure. Return ONLY a JSON object with no additional text.

Document content:
${doc.raw_content}`,
        temperature: 0.0,
        requireJsonOutput: true
      });

      setExtractedProfile(result);
      toast.success('Profile extracted successfully');

    } catch (error) {
      console.error('Extraction error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to extract profile');
    } finally {
      setIsLoading(false);
    }
  };

  const cleanupPartialProcessing = async (cleanup: ProcessingCleanup) => {
    const toastId = toast.loading('Cleaning up interrupted processing...');
    
    try {
      // Update all remaining documents to show they were part of an aborted batch
      const { error } = await supabase
        .from('google_expert_documents')
        .update({
          processing_status: 'pending',  // Reset to pending
          processing_error: `Part of aborted batch at ${cleanup.abortedAt}. Will retry in next run.`,
          metadata: {
            last_abort: {
              timestamp: cleanup.abortedAt,
              processed_in_batch: cleanup.processedCount,
              batch_position: cleanup.remainingDocs
            }
          }
        })
        .in('id', cleanup.remainingDocs);

      if (error) throw error;
      
      toast.success('Cleanup completed', { id: toastId });
      
      // Refresh document list to show updated statuses
      await loadDocuments();
      
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast.error('Failed to cleanup aborted processing', { id: toastId });
    }
  };

  const processAllDocuments = async () => {
    const controller = new AbortController();
    setAbortController(controller);
    setIsBatchProcessing(true);
    const toastId = toast.loading('Processing all documents...');
    let processed = 0;
    
    try {
      // Filter documents based on size and processing status
      const eligibleDocs = documents.filter(doc => {
        const contentSize = new TextEncoder().encode(doc.raw_content).length;
        const sizeOk = contentSize <= 30 * 1024;
        // Only include completed docs if processAll is true
        const statusOk = processAll || doc.processing_status !== 'completed';
        return sizeOk && statusOk;
      });

      // Update UI to show what we're doing
      toast.loading(
        `Processing ${eligibleDocs.length} documents (${processAll ? 'including completed' : 'skipping completed'})`, 
        { id: toastId }
      );

      // Keep track of remaining docs for cleanup
      let remainingDocs = eligibleDocs.map(doc => doc.id);

      setProgress({
        current: 0,
        total: eligibleDocs.length,
        currentDoc: ''
      });

      for (const doc of eligibleDocs) {
        if (controller.signal.aborted) {
          const abortTime = new Date().toISOString();
          
          // Remove processed docs from remaining list
          remainingDocs = remainingDocs.slice(processed);
          
          // Perform cleanup
          await cleanupPartialProcessing({
            abortedAt: abortTime,
            processedCount: processed,
            remainingDocs
          });
          
          toast.success('Processing aborted and cleaned up', { id: toastId });
          return;
        }

        setProgress(prev => ({
          ...prev,
          current: processed,
          currentDoc: doc.source.name
        }));

        try {
          // Pass abort signal to AI processing
          const profile = await processWithAI({
            systemPrompt: expertPrompt!,
            userMessage: `Analyze this document and extract a professional profile according to the above structure. Return ONLY a JSON object with no additional text.

Document content:
${doc.raw_content}`,
            temperature: 0.0,
            requireJsonOutput: true,
            signal: controller.signal // Pass abort signal
          });

          // Update document status
          const { error: updateError } = await supabase
            .from('google_expert_documents')
            .update({
              processed_content: profile,
              processing_status: 'completed',
              processed_at: new Date().toISOString(),
              processing_error: null
            })
            .eq('id', doc.id);

          if (updateError) throw updateError;

          // Remove this doc from remaining list after successful processing
          remainingDocs = remainingDocs.filter(id => id !== doc.id);
          processed++;
          
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            // Update document to show processing was aborted
            await supabase
              .from('google_expert_documents')
              .update({
                processing_status: 'aborted',
                processed_at: new Date().toISOString(),
                processing_error: 'Processing aborted by user'
              })
              .eq('id', doc.id);
            break; // Exit the loop
          }

          console.error('AI processing failed:', {
            id: doc.id,
            name: doc.source.name,
            error
          });

          // Update document to mark processing failure
          await supabase
            .from('google_expert_documents')
            .update({
              processing_status: 'failed',
              processed_at: new Date().toISOString(),
              processing_error: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', doc.id);
        }

        toast.loading(
          `Processed ${processed} of ${eligibleDocs.length} documents...`, 
          { id: toastId }
        );
      }

      toast.success(
        `Completed: ${processed} processed, ${documents.length - eligibleDocs.length} skipped`, 
        { id: toastId }
      );

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const abortTime = new Date().toISOString();
        const remainingDocs = documents
          .filter(doc => doc.processing_status === 'pending')
          .map(doc => doc.id);
        
        await cleanupPartialProcessing({
          abortedAt: abortTime,
          processedCount: processed,
          remainingDocs
        });
      }
      console.error('Batch processing error:', error);
      toast.error('Error during batch processing', { id: toastId });
    } finally {
      setIsBatchProcessing(false);
      setAbortController(null);
      setProgress({ current: 0, total: 0, currentDoc: '' });
    }
  };

  const handleAbort = async () => {
    if (abortController) {
      abortController.abort();
      toast.loading('Aborting and cleaning up...');
      // Cleanup will be handled in the processAllDocuments catch block
    }
  };

  // Add a function to retry aborted documents
  const retryAbortedDocuments = async () => {
    const toastId = toast.loading('Finding aborted documents...');
    
    try {
      const { data: abortedDocs, error } = await supabase
        .from('google_expert_documents')
        .select('id')
        .eq('processing_status', 'aborted');

      if (error) throw error;

      if (!abortedDocs || abortedDocs.length === 0) {
        toast.success('No aborted documents found', { id: toastId });
        return;
      }

      // Reset their status to pending
      await supabase
        .from('google_expert_documents')
        .update({
          processing_status: 'pending',
          processing_error: null,
          metadata: {
            retry_after_abort: new Date().toISOString()
          }
        })
        .in('id', abortedDocs.map(doc => doc.id));

      toast.success(`Reset ${abortedDocs.length} documents for retry`, { id: toastId });
      await loadDocuments(); // Refresh the list

    } catch (error) {
      console.error('Failed to retry aborted documents:', error);
      toast.error('Failed to reset aborted documents', { id: toastId });
    }
  };

  // Add clearFilters function
  const clearFilters = () => {
    setActiveFilters(new Set());
  };

  // Add state debugging
  console.log('Processing state:', {
    isBatchProcessing,
    hasAbortController: !!abortController,
    progress,
    nodeEnv: process.env.NODE_ENV  // Add this to check the value
  });

  return (
    <div className="flex flex-col gap-6 p-4" data-testid="expert-extractor-v1">
      {/* Add version info at the top */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-gray-400 mb-2">
          ExpertProfileExtractor v1.0 [DEBUG-ID: EXT-2024-04-17]
        </div>
      )}
      
      <h2 className="text-xl font-semibold">Expert Profile Extraction</h2>
      
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h3 className="text-lg">Documents ({documents.length})</h3>
            <div className="text-sm text-gray-600 flex gap-3">
              <span className="text-green-600">
                Completed: {documents.filter(d => d.processing_status === 'completed').length}
              </span>
              <span className="text-blue-600">
                Pending: {documents.filter(d => !d.processing_status || d.processing_status === 'pending').length}
              </span>
              {documents.some(d => d.processing_status === 'failed') && (
                <span className="text-red-600">
                  Failed: {documents.filter(d => d.processing_status === 'failed').length}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={processAll}
                onChange={(e) => setProcessAll(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Reprocess completed documents
            </label>
            <ProcessingControls 
              onProcess={processAllDocuments}
              onAbort={handleAbort}
              isProcessing={isBatchProcessing}
              showPrompt={true}
              systemPrompt={expertPrompt}
              userPrompt={`Analyze this document and extract a professional profile according to the above structure. Return ONLY a JSON object with no additional text.

Document content:
[Document content will be inserted here]`}
            />
          </div>
        </div>

        {/* Progress Bar */}
        {isBatchProcessing && progress.total > 0 && (
          <div className="w-full space-y-2">
            <div className="bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <div className="text-sm text-gray-600 flex justify-between">
              <span>
                Processing: {progress.current} of {progress.total}
              </span>
              <span>
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            {progress.currentDoc && (
              <div className="text-sm text-gray-500 truncate">
                Current: {progress.currentDoc}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Pills with Clear Button */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {fileTypeFilters.map(filter => (
              <button
                key={filter.type}
                onClick={() => toggleFilter(filter.type)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors
                  ${activeFilters.has(filter.type)
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {filter.label}
                <span className="ml-1 text-xs">
                  ({documents.filter(doc => filter.mimeTypes.includes(doc.source.mime_type)).length})
                </span>
              </button>
            ))}
          </div>
          
          {/* Clear Filters button - only shows when filters are active */}
          {activeFilters.size > 0 && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>✕</span>
              Clear Filters
            </button>
          )}
        </div>

        {/* Show active filter count */}
        {activeFilters.size > 0 && (
          <div className="text-sm text-gray-600">
            Showing {filteredDocuments.length} of {documents.length} documents
          </div>
        )}
      </div>

      {/* Split view for documents and JSON */}
      <div className="flex gap-6">
        {/* Left side: Documents list */}
        <div className="w-1/2 flex flex-col gap-2">
          {filteredDocuments.map(doc => {
            const sizeKB = (new TextEncoder().encode(doc.raw_content).length / 1024).toFixed(1);
            const isLarge = new TextEncoder().encode(doc.raw_content).length > 30 * 1024;
            
            return (
              <button
                key={doc.id}
                onClick={() => setCurrentDoc(doc)}
                disabled={isBatchProcessing}
                className={`text-left p-3 rounded border hover:bg-gray-50 
                  ${currentDoc?.id === doc.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'}
                  ${isBatchProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="font-medium">{doc.source.name}</div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Size: {sizeKB}KB</span>
                  <span className={`
                    ${doc.processing_status === 'completed' ? 'text-green-600' : ''}
                    ${doc.processing_status === 'failed' ? 'text-red-600' : ''}
                    ${doc.processing_status === 'aborted' ? 'text-amber-600' : ''}
                  `}>
                    {doc.processing_status || 'pending'}
                  </span>
                </div>
                {isLarge && (
                  <div className="text-sm text-amber-600 mt-1">
                    Too large for processing
                  </div>
                )}
                {doc.processed_at && (
                  <div className="text-xs text-gray-500 mt-1">
                    Processed: {new Date(doc.processed_at).toLocaleDateString()}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right side: JSON viewer */}
        <div className="w-1/2">
          <h3 className="text-lg mb-3">Processed Content</h3>
          {currentDoc ? (
            currentDoc.processed_content ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
                  {JSON.stringify(currentDoc.processed_content, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="text-gray-500 italic">
                No processed content available
              </div>
            )
          ) : (
            <div className="text-gray-500">
              Select a document to view its content
            </div>
          )}
        </div>
      </div>

      {/* Retry button at the bottom */}
      {documents.some(doc => doc.processing_status === 'aborted') && (
        <button
          onClick={retryAbortedDocuments}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md"
        >
          <span>⟳</span>
          Retry Documents That Were Stopped
        </button>
      )}
    </div>
  );
} 