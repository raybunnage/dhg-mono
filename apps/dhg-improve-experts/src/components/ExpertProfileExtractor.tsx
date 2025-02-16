import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { processWithAI } from '@/utils/ai-processing';
import { loadPromptFromMarkdown } from '@/utils/prompt-loader';
import { ProcessedProfileViewer } from './ProcessedProfileViewer';

interface ExpertDocument {
  id: string;
  raw_content: string;
  processed_content?: any;
  processing_status?: string;
  processed_at?: string;
  source: {
    id: string;
    name: string;
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

const ProfileViewer = ({ profile }: { profile: ExpertProfile }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('basic');

  const sections = {
    basic: {
      title: 'Basic Information',
      fields: ['name', 'title', 'current_position', 'institution']
    },
    expertise: {
      title: 'Expertise & Specialties',
      fields: ['credentials', 'specialty_areas', 'expertise_keywords']
    },
    research: {
      title: 'Research & Achievements',
      fields: ['research_summary', 'notable_achievements']
    },
    links: {
      title: 'Professional Links',
      fields: ['website_urls']
    }
  };

  const formatValue = (key: string, value: any) => {
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc pl-4">
          {value.map((item, i) => (
            <li key={i} className="mb-1">{item}</li>
          ))}
        </ul>
      );
    }
    if (key === 'research_summary') {
      return <p className="whitespace-pre-wrap">{value}</p>;
    }
    return <span>{value}</span>;
  };

  return (
    <div className="space-y-4">
      {Object.entries(sections).map(([key, section]) => (
        <div key={key} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedSection(expandedSection === key ? null : key)}
            className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
          >
            <span className="font-medium">{section.title}</span>
            <span>{expandedSection === key ? '−' : '+'}</span>
          </button>
          {expandedSection === key && (
            <div className="p-4 space-y-4">
              {section.fields.map(field => (
                <div key={field} className="space-y-1">
                  <div className="text-sm font-medium text-gray-500 capitalize">
                    {field.replace(/_/g, ' ')}
                  </div>
                  <div className="text-gray-900">
                    {formatValue(field, profile[field as keyof ExpertProfile])}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Raw JSON View */}
      <div className="border rounded-lg overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'raw' ? null : 'raw')}
          className="w-full px-4 py-2 text-left bg-gray-50 hover:bg-gray-100 flex justify-between items-center"
        >
          <span className="font-medium">Raw JSON</span>
          <span>{expandedSection === 'raw' ? '−' : '+'}</span>
        </button>
        {expandedSection === 'raw' && (
          <div className="p-4">
            <pre className="bg-gray-50 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

const ANNOUNCEMENT_SIZE_LIMIT = 20 * 1024; // 20KB in bytes

export const ExpertProfileExtractor = () => {
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

  useEffect(() => {
    loadDocuments();
    loadExpertPrompt();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          processed_content,
          processing_status,
          processed_at,
          source:sources_google!expert_documents_source_id_fkey (
            id,
            name
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
    try {
      const prompt = await loadPromptFromMarkdown('/docs/prompts/expert-extraction-prompt.md');
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
      toast.info(`Skipping "${doc.source.name}" - Document size (${(contentSizeBytes/1024).toFixed(1)}KB) exceeds announcement limit (20KB)`);
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

  const processAllDocuments = async () => {
    setIsBatchProcessing(true);
    const toastId = toast.loading('Processing all documents...');
    let processed = 0;
    
    try {
      const eligibleDocs = documents.filter(doc => {
        const contentSize = new TextEncoder().encode(doc.raw_content).length;
        return contentSize <= 30 * 1024;
      });

      // Initialize progress
      setProgress({
        current: 0,
        total: eligibleDocs.length,
        currentDoc: ''
      });

      for (const doc of eligibleDocs) {
        // Update progress with current document
        setProgress(prev => ({
          ...prev,
          current: processed,
          currentDoc: doc.source.name
        }));

        try {
          // Extract profile using AI
          const profile = await processWithAI({
            systemPrompt: expertPrompt!,
            userMessage: `Analyze this document and extract a professional profile according to the above structure. Return ONLY a JSON object with no additional text.

Document content:
${doc.raw_content}`,
            temperature: 0.0,
            requireJsonOutput: true
          });

          // Update only the AI processing related fields
          const { error: updateError } = await supabase
            .from('expert_documents')
            .update({
              processed_content: profile,        // Store AI-extracted JSON
              processing_status: 'completed',    // Mark as processed
              processed_at: new Date().toISOString(),
              processing_error: null            // Clear any previous errors
            })
            .eq('id', doc.id);

          if (updateError) {
            console.error('Failed to save AI processing results:', {
              docId: doc.id,
              error: updateError
            });
            continue;
          }

          processed++;
          console.log('AI processing complete:', {
            id: doc.id,
            name: doc.source.name,
            extractedFields: Object.keys(profile)
          });

        } catch (error) {
          console.error('AI processing failed:', {
            id: doc.id,
            name: doc.source.name,
            error
          });

          // Update document to mark processing failure
          await supabase
            .from('expert_documents')
            .update({
              processing_status: 'failed',
              processed_at: new Date().toISOString(),
              processing_error: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', doc.id);
        }

        // Update progress toast
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
      console.error('Batch processing error:', error);
      toast.error('Error during batch processing', { id: toastId });
    } finally {
      setIsBatchProcessing(false);
      // Reset progress
      setProgress({ current: 0, total: 0, currentDoc: '' });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <h2 className="text-xl font-semibold">Expert Profile Extraction</h2>
      
      {/* Document List */}
      <div className="flex gap-4">
        <div className="w-1/3">
          <div className="mb-4 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h3 className="text-lg">Documents ({documents.length})</h3>
              <button
                onClick={processAllDocuments}
                disabled={isBatchProcessing || !expertPrompt}
                className={`px-4 py-2 rounded text-white
                  ${isBatchProcessing || !expertPrompt 
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'}
                `}
              >
                {isBatchProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Processing...
                  </span>
                ) : (
                  'Process All Documents'
                )}
              </button>
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
          <div className="flex flex-col gap-2">
            {documents.map(doc => {
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
        </div>

        {/* Extracted Profile Display */}
        <div className="w-2/3">
          <h3 className="text-lg mb-3">Expert Profile</h3>
          {currentDoc ? (
            currentDoc.processed_content ? (
              <ProcessedProfileViewer profile={currentDoc.processed_content} />
            ) : (
              <div className="text-gray-500 italic">
                No processed content available for this document
              </div>
            )
          ) : (
            <div className="text-gray-500">
              Select a document to view its profile
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 