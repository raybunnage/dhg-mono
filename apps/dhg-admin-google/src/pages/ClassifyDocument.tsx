import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { claudeService } from '@shared/services/claude-service/claude-service';
import { processWithAI, processDocumentWithAI, validateExpertProfile } from '../utils/ai-processing';
import { getDocxContent } from '../utils/google-drive';
import { ClassificationResponseSchema } from '../schemas/classification.schema';
import { DashboardLayout } from '../components/DashboardLayout';

// Interface for document types
interface DocumentType {
  id: string;
  name: string;
  category: string;
  keywords?: string[];
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Interface for google sources
interface SourceGoogle {
  id: string;
  name: string;
  mime_type: string;
  extracted_content: any;
  document_type_id: string | null;
  metadata: {
    classification?: {
      confidence: number;
      reasoning: string;
      classified_at: string;
    }
  } | null;
}

// Valid status values
const EXPERT_DOCUMENT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  PENDING: 'pending'
} as const;

const PROCESSING_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  RETRYING: 'retrying'
} as const;

const DOCUMENT_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
} as const;

// Workflow stages
type WorkflowStage = 'sync' | 'extract' | 'classify' | 'process' | 'analyze';

export function ClassifyDocument() {
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [classificationResults, setClassificationResults] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const extractionRef = useRef<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sampleDocuments, setSampleDocuments] = useState<any[]>([]);
  const [extractedCount, setExtractedCount] = useState(0);
  const [classifiedCount, setClassifiedCount] = useState(0);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<WorkflowStage | null>(null);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [pendingCreations, setPendingCreations] = useState<{
    [id: string]: {
      data: any;
      status: 'pending' | 'success' | 'error';
      error?: string;
    }
  }>({});
  const [showOnlyAssignedDocType, setShowOnlyAssignedDocType] = useState(false);
  const [showOnlyUnprocessed, setShowOnlyUnprocessed] = useState(false);
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const [documentStats, setDocumentStats] = useState({
    totalDocuments: 0,
    withContent: 0,
    withDocumentType: 0,
    processedToday: 0,
    documentTypes: [] as Array<{
      id: string;
      name: string;
      category: string;
      count: number;
    }>
  });

  // Get unique categories from document types
  const categories = useMemo(() => {
    const categoryList = documentStats.documentTypes.map(dt => dt.category);
    return ['all', ...Array.from(new Set(categoryList))];
  }, [documentStats.documentTypes]);

  const filteredDocumentTypes = useMemo(() => {
    if (selectedCategory === 'all') {
      return documentStats.documentTypes;
    }
    return documentStats.documentTypes.filter(dt => dt.category === selectedCategory);
  }, [documentStats.documentTypes, selectedCategory]);

  const loadDocumentTypes = async () => {
    setLoading(true);
    try {
      console.log('Starting document types query...');
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*');

      console.log('Query complete:', {
        success: !error,
        recordCount: data?.length,
        error,
        timestamp: new Date().toISOString()
      });

      if (error) throw error;

      const documentTypes = data as DocumentType[];
      setDocumentTypes(documentTypes);
      toast.success(`Loaded ${documentTypes.length} document types`);
      return documentTypes;
    } catch (error) {
      console.error('Error loading document types:', error);
      toast.error('Failed to load document types');
    } finally {
      setLoading(false);
    }
  };

  // Check if file type is supported
  const isSupportedFileType = (mimeType: string): boolean => {
    const supportedTypes = {
      'text/plain': true,
      'application/pdf': true,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
      'application/json': true,
      'application/jsonb': true,
      'text/markdown': true
    };

    console.log('Checking file type support:', {
      mimeType,
      isSupported: Object.keys(supportedTypes).some(type => mimeType.includes(type)),
      matchedType: Object.keys(supportedTypes).find(type => mimeType.includes(type))
    });

    return Object.keys(supportedTypes).some(type => mimeType.includes(type));
  };

  const loadClassificationPrompt = async () => {
    try {
      const response = await fetch('/docs/prompts/document-classification-prompt.md');
      const prompt = await response.text();
      return prompt;
    } catch (error) {
      console.error('Error loading classification prompt:', error);
      return null;
    }
  };

  // UUID validation helper
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  // Clean content helper
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
        .replace(/\n{3}/g, '\n\n');
    }

    // Clean for PostgreSQL text compatibility
    cleaned = cleaned
      .replace(/\u0000/g, '')  // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove non-printable chars
      .replace(/\r\n/g, '\n')  // Normalize newlines
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();

    return cleaned;
  };

  // Load document statistics
  const loadDocumentStats = async () => {
    try {
      console.log('Loading document statistics...');
      
      // Get total documents count
      const { count: totalCount } = await supabase
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .is('mime_type', false);

      // Get documents with content
      const { count: withContentCount } = await supabase
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .not('extracted_content', 'is', null);

      // Get documents with document type assigned
      const { count: withDocTypeCount } = await supabase
        .from('google_sources')
        .select('*', { count: 'exact', head: true })
        .not('document_type_id', 'is', null);

      // Get documents processed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayCount } = await supabase
        .from('google_expert_documents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Get document type distribution
      const { data: docTypeData } = await supabase
        .from('google_expert_documents')
        .select('document_type_id')
        .not('document_type_id', 'is', null);

      const docTypeCounts = (docTypeData || []).reduce((acc, doc) => {
        acc[doc.document_type_id] = (acc[doc.document_type_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Load document types with counts
      const { data: docTypes } = await supabase
        .from('document_types')
        .select('id, name, category');

      const documentTypesWithCounts = (docTypes || []).map(dt => ({
        ...dt,
        count: docTypeCounts[dt.id] || 0
      }));

      setDocumentStats({
        totalDocuments: totalCount || 0,
        withContent: withContentCount || 0,
        withDocumentType: withDocTypeCount || 0,
        processedToday: todayCount || 0,
        documentTypes: documentTypesWithCounts
      });

    } catch (error) {
      console.error('Error loading document stats:', error);
      toast.error('Failed to load document statistics');
    }
  };

  // Load sample documents
  const loadSampleDocuments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('google_sources')
        .select('id, name, mime_type, extracted_content, document_type_id, metadata')
        .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (showOnlyAssignedDocType) {
        query = query.not('document_type_id', 'is', null);
      }

      if (showOnlyUnprocessed) {
        query = query.is('document_type_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;

      setSampleDocuments(data || []);
      console.log(`Loaded ${data?.length || 0} sample documents`);
    } catch (error) {
      console.error('Error loading sample documents:', error);
      toast.error('Failed to load sample documents');
    } finally {
      setLoading(false);
    }
  };

  // Process single document
  const processSingleDocument = async (doc: SourceGoogle) => {
    try {
      setProcessingDocId(doc.id);
      setCurrentStage('classify');

      // Load classification prompt
      const prompt = await loadClassificationPrompt();
      if (!prompt) {
        throw new Error('Failed to load classification prompt');
      }

      // Get document types for classification
      const { data: docTypes } = await supabase
        .from('document_types')
        .select('*');

      if (!docTypes || docTypes.length === 0) {
        throw new Error('No document types available for classification');
      }

      // Prepare content for classification
      const content = doc.extracted_content?.text || doc.extracted_content || '';
      if (!content) {
        throw new Error('No content available for classification');
      }

      // Build the classification prompt
      const classificationPrompt = prompt
        .replace('{{document_types}}', JSON.stringify(docTypes, null, 2))
        .replace('{{content}}', content.substring(0, 4000)); // Limit content length

      // Send to Claude for classification
      const response = await claudeService.getJsonResponse(classificationPrompt);
      
      // Validate response
      const validatedResponse = ClassificationResponseSchema.parse(response);

      // Update the document with classification results
      const { error: updateError } = await supabase
        .from('google_sources')
        .update({
          document_type_id: validatedResponse.document_type_id,
          metadata: {
            ...doc.metadata,
            classification: {
              confidence: validatedResponse.confidence,
              reasoning: validatedResponse.reasoning,
              classified_at: new Date().toISOString()
            }
          }
        })
        .eq('id', doc.id);

      if (updateError) throw updateError;

      setClassifiedCount(prev => prev + 1);
      toast.success(`Classified "${doc.name}" as ${validatedResponse.document_type_name}`);

      // Create expert document if high confidence
      if (validatedResponse.confidence >= 0.8 && validatedResponse.document_type_id) {
        await createExpertDocument(doc, validatedResponse.document_type_id);
      }

    } catch (error) {
      console.error('Error processing document:', error);
      toast.error(`Failed to process ${doc.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessingDocId(null);
      setCurrentStage(null);
    }
  };

  // Create expert document
  const createExpertDocument = async (doc: SourceGoogle, documentTypeId: string) => {
    try {
      const { data, error } = await supabase
        .from('google_expert_documents')
        .insert({
          google_source_id: doc.id,
          document_type_id: documentTypeId,
          status: EXPERT_DOCUMENT_STATUS.ACTIVE,
          title: doc.name,
          content: doc.extracted_content,
          metadata: {
            mime_type: doc.mime_type,
            classification: doc.metadata?.classification
          }
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Created expert document for "${doc.name}"`);
      return data;
    } catch (error) {
      console.error('Error creating expert document:', error);
      toast.error(`Failed to create expert document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Process selected documents
  const processSelectedDocuments = async () => {
    if (selectedDocuments.size === 0) {
      toast.error('Please select documents to process');
      return;
    }

    const docsToProcess = sampleDocuments.filter(doc => 
      selectedDocuments.has(doc.id)
    );

    for (const doc of docsToProcess) {
      await processSingleDocument(doc);
    }

    // Reload documents
    await loadSampleDocuments();
    setSelectedDocuments(new Set());
  };

  // Extract content for unprocessed documents
  const extractContentForUnprocessed = async () => {
    try {
      setIsExtracting(true);
      extractionRef.current = true;

      const { data: unprocessedDocs, error } = await supabase
        .from('google_sources')
        .select('id, name, mime_type, drive_id')
        .is('extracted_content', null)
        .not('mime_type', 'eq', 'application/vnd.google-apps.folder')
        .limit(50);

      if (error) throw error;

      console.log(`Found ${unprocessedDocs?.length || 0} documents without extracted content`);

      for (const doc of unprocessedDocs || []) {
        if (!extractionRef.current) break;

        if (isSupportedFileType(doc.mime_type)) {
          try {
            let content = '';

            // Extract content based on file type
            if (doc.mime_type.includes('wordprocessingml.document')) {
              content = await getDocxContent(doc.drive_id);
            } else if (doc.mime_type === 'text/plain') {
              // For text files, we'd need to implement Google Drive API access
              // For now, skip these
              console.log(`Skipping text file extraction for ${doc.name}`);
              continue;
            }

            if (content) {
              const cleanedContent = cleanContent(content);
              
              const { error: updateError } = await supabase
                .from('google_sources')
                .update({
                  extracted_content: { text: cleanedContent },
                  updated_at: new Date().toISOString()
                })
                .eq('id', doc.id);

              if (updateError) throw updateError;

              setExtractedCount(prev => prev + 1);
              console.log(`✅ Extracted content for ${doc.name}`);
            }
          } catch (error) {
            console.error(`Failed to extract ${doc.name}:`, error);
          }
        }
      }

      toast.success(`Content extraction complete. Extracted ${extractedCount} documents.`);
    } catch (error) {
      console.error('Error during content extraction:', error);
      toast.error('Content extraction failed');
    } finally {
      setIsExtracting(false);
    }
  };

  // Toggle document selection
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  // Select all visible documents
  const selectAllDocuments = () => {
    const allIds = sampleDocuments.map(doc => doc.id);
    setSelectedDocuments(new Set(allIds));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };

  // Create new document type
  const createNewDocumentType = async () => {
    const name = prompt('Enter document type name:');
    if (!name) return;

    const category = prompt('Enter category (e.g., Research, Clinical, Administrative):');
    if (!category) return;

    const description = prompt('Enter description (optional):') || '';

    try {
      const { data, error } = await supabase
        .from('document_types')
        .insert({
          name,
          category,
          description,
          keywords: []
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Created document type: ${name}`);
      await loadDocumentTypes();
      await loadDocumentStats();
    } catch (error) {
      console.error('Error creating document type:', error);
      toast.error('Failed to create document type');
    }
  };

  // Initialize
  useEffect(() => {
    loadDocumentTypes();
    loadDocumentStats();
    loadSampleDocuments();
  }, []);

  // Reload when filters change
  useEffect(() => {
    loadSampleDocuments();
  }, [showOnlyAssignedDocType, showOnlyUnprocessed]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Classification</h1>
        <p className="text-gray-600">Classify documents from Google Drive into appropriate document types</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">{documentStats.totalDocuments}</div>
          <div className="text-sm text-gray-600">Total Documents</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">{documentStats.withContent}</div>
          <div className="text-sm text-gray-600">With Content</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-green-600">{documentStats.withDocumentType}</div>
          <div className="text-sm text-gray-600">Classified</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-purple-600">{documentStats.processedToday}</div>
          <div className="text-sm text-gray-600">Processed Today</div>
        </div>
      </div>

      {/* Document Types Overview */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Document Types</h2>
            <button
              onClick={createNewDocumentType}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <PlusCircle className="w-4 h-4" />
              Add Type
            </button>
          </div>
        </div>
        <div className="p-6">
          {/* Category Filter */}
          <div className="mb-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border rounded-md"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Document Types Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredDocumentTypes.map(dt => (
              <div key={dt.id} className="border rounded-lg p-4">
                <div className="font-medium">{dt.name}</div>
                <div className="text-sm text-gray-600">{dt.category}</div>
                <div className="text-lg font-semibold text-blue-600 mt-2">{dt.count} documents</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <button
            onClick={extractContentForUnprocessed}
            disabled={isExtracting}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {isExtracting ? 'Extracting...' : 'Extract Content'}
          </button>
          
          <button
            onClick={processSelectedDocuments}
            disabled={selectedDocuments.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Process Selected ({selectedDocuments.size})
          </button>

          <button
            onClick={selectAllDocuments}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Select All
          </button>

          <button
            onClick={clearSelection}
            disabled={selectedDocuments.size === 0}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Clear Selection
          </button>

          <div className="flex gap-4 ml-auto">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnlyAssignedDocType}
                onChange={(e) => setShowOnlyAssignedDocType(e.target.checked)}
              />
              <span className="text-sm">Classified Only</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnlyUnprocessed}
                onChange={(e) => setShowOnlyUnprocessed(e.target.checked)}
              />
              <span className="text-sm">Unprocessed Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Sample Documents */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Sample Documents</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedDocuments.size === sampleDocuments.length && sampleDocuments.length > 0}
                    onChange={(e) => e.target.checked ? selectAllDocuments() : clearSelection()}
                  />
                </th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Document Type</th>
                <th className="px-4 py-3 text-left">Content</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sampleDocuments.map(doc => (
                <tr key={doc.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.has(doc.id)}
                      onChange={() => toggleDocumentSelection(doc.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium truncate max-w-xs" title={doc.name}>
                      {doc.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600">
                      {doc.mime_type.split('/').pop()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {doc.document_type_id ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {documentTypes.find(dt => dt.id === doc.document_type_id)?.name || 'Unknown'}
                      </span>
                    ) : (
                      <span className="text-gray-400">Not classified</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {doc.extracted_content ? (
                      <span className="text-green-600">✓ Available</span>
                    ) : (
                      <span className="text-gray-400">No content</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => processSingleDocument(doc)}
                      disabled={processingDocId === doc.id || !doc.extracted_content}
                      className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {processingDocId === doc.id ? 'Processing...' : 'Classify'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debug Info */}
      {debugInfo && (
        <div className="mt-8 bg-gray-100 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Debug Information</h3>
          <pre className="text-sm whitespace-pre-wrap">{debugInfo}</pre>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}