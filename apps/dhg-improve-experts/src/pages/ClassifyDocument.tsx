import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import type { Database } from '../../../../supabase/types';
import { processWithAI, processDocumentWithAI, validateExpertProfile } from '@/utils/ai-processing';
import { getDocxContent } from '@/utils/google-drive';
import { ClassificationResponseSchema } from '@/schemas/classification.schema';

// Update interface to match the actual table structure
type DocumentType = Database['public']['Tables']['document_types']['Row'];

// Add this near the top of the file after the imports
const DEBUG_QUERIES = {
  count: () => supabase
    .from('document_types')
    .select('*', { count: 'exact', head: true }),
  sample: () => supabase.from('document_types').select('*').limit(5),
  all: () => supabase.from('document_types').select('*')
};

// Add type for sources_google
type SourceGoogle = Database['public']['Tables']['sources_google']['Row'];

// Add type for the select query
type SourceGoogleSelect = {
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

const ensureAuth = async () => {
  try {
    // Check if we're already authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('Already authenticated as:', session.user.email);
      return true;
    }

    console.log('Attempting login with test credentials...');
    
    // If not, try to login with test credentials
    const { data, error } = await supabase.auth.signInWithPassword({
      email: import.meta.env.VITE_TEST_USER_EMAIL,
      password: import.meta.env.VITE_TEST_USER_PASSWORD,
    });

    if (error) {
      console.error('Auth error:', error);
      toast.error('Authentication failed');
      return false;
    }

    console.log('Successfully authenticated as:', data.user?.email);
    toast.success(`Logged in as ${data.user?.email}`);
    return true;
  } catch (error) {
    console.error('Auth error:', error);
    toast.error('Authentication failed');
    return false;
  }
};

// Export the main component directly without AuthRequired wrapper
export function ClassifyDocument() {
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [classificationResults, setClassificationResults] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState(false);
  const extractionRef = useRef<boolean>(true);
  const [todaysClassifications, setTodaysClassifications] = useState<{
    name: string;
    documentType: string;
    confidence: number;
    reasoning: string;
  }[]>([]);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      const authSuccess = await ensureAuth();
      setIsAuthenticated(authSuccess);
      if (authSuccess) {
        initialCheck();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const initialCheck = async () => {
    const { data, error } = await supabase
      .from('document_types')
      .select('count(*)', { count: 'exact' });
    
    console.log('Initial table check:', {
      data,
      error,
      timestamp: new Date().toISOString()
    });
  };

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
      toast.success(`Loaded ${documentTypes.length} document types`);
      return documentTypes;
    } catch (error) {
      console.error('Error loading document types:', error);
      toast.error('Failed to load document types');
    } finally {
      setLoading(false);
    }
  };

  const runDebugQueries = async () => {
    setDebugInfo('Running diagnostics...');
    
    try {
      // Check auth status
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Auth status:', {
        hasSession: !!session,
        user: session?.user?.email
      });

      // Run count query with more error handling
      const { count, error: countError } = await DEBUG_QUERIES.count();
      console.log('Count query:', { 
        count, 
        error: countError,
        errorMessage: countError?.message,
        errorCode: countError?.code 
      });

      if (countError) {
        setDebugInfo(`Error getting count: ${countError.message}`);
        return;
      }

      // Get sample records to verify data structure
      const { data: sampleData, error: sampleError } = await DEBUG_QUERIES.sample();
      
      setDebugInfo(`
Document Types Count: ${count}
Sample Record Types: ${sampleData?.map(d => d.document_type).join(', ')}

Check console for full details.
      `.trim());

      // Detailed console logging
      console.log('Document Types Debug:', {
        totalCount: count,
        sampleRecords: sampleData?.map(d => ({
          id: d.id,
          type: d.document_type,
          category: d.category
        }))
      });

    } catch (error) {
      console.error('Debug query error:', error);
      setDebugInfo(`Error running diagnostics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add more detailed mime type checking
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

  const extractDocumentContent = async (doc: any) => {
    console.log('Starting content extraction for:', {
      fileName: doc.name,
      mimeType: doc.mime_type,
      hasProcessedContent: !!doc.processed_content,
      hasWebViewLink: !!doc.web_view_link,
      documentId: doc.id
    });

    try {
      // Check for existing processed content
      if (doc.processed_content) {
        console.log('Found existing processed content:', {
          fileName: doc.name,
          contentLength: doc.processed_content.length,
          preview: doc.processed_content.slice(0, 100)
        });
        return doc.processed_content;
      }

      // Handle each file type
      if (doc.mime_type.includes('text/plain')) {
        console.log('Extracting plain text content...');
        // TODO: Implement text extraction
        return null;
      }

      if (doc.mime_type.includes('application/pdf')) {
        console.log('Extracting PDF content...');
        // TODO: Implement PDF extraction
        return null;
      }

      if (doc.mime_type.includes('wordprocessingml.document')) {
        console.log('Extracting DOCX content...', {
          webViewLink: doc.web_view_link
        });
        try {
          const content = await getDocxContent(doc.web_view_link);
          console.log('DOCX content extracted:', {
            success: !!content,
            contentLength: content?.length,
            preview: content?.slice(0, 100)
          });
          return content;
        } catch (docxError) {
          console.error('DOCX extraction error:', {
            error: docxError,
            fileName: doc.name,
            webViewLink: doc.web_view_link
          });
          return null;
        }
      }

      if (doc.mime_type.includes('json') || doc.mime_type.includes('jsonb')) {
        console.log('Extracting JSON content...');
        // TODO: Implement JSON extraction
        return null;
      }

      console.log(`No extraction method implemented for mime type: ${doc.mime_type}`);
      return null;

    } catch (error) {
      console.error('Content extraction error:', {
        fileName: doc.name,
        mimeType: doc.mime_type,
        error: {
          message: error.message,
          stack: error.stack,
          cause: error.cause
        }
      });
      return null;
    }
  };

  const loadSourceDocuments = async () => {
    try {
      const { data: fullData, error: fullError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          mime_type,
          extracted_content
        `)
        .not('extracted_content', 'is', null)  // Only get documents with content
        .order('created_at', { ascending: false })
        .limit(10);

      console.log('Source documents with content:', {
        success: !fullError,
        count: fullData?.length,
        documents: fullData?.map(d => ({
          name: d.name,
          mimeType: d.mime_type,
          hasContent: !!d.extracted_content
        }))
      });

      return fullData;
    } catch (error) {
      console.error('Source documents error:', error);
      return null;
    }
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

  // Add UUID validation helper
  const isValidUUID = (uuid: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  const classifyDocuments = async () => {
    setLoading(true);
    try {
      console.log('Starting classification process...');

      // Load document types for reference
      const documentTypes = await loadDocumentTypes();
      if (!documentTypes) throw new Error('Failed to load document types');

      // Load the classification prompt
      const prompt = await loadClassificationPrompt();
      if (!prompt) throw new Error('Failed to load classification prompt');

      // Load all documents with extracted content
      const { data: sourceDocuments, error: sourceError } = await supabase
        .from('sources_google')
        .select<string, SourceGoogleSelect>(`
          id,
          name,
          mime_type,
          extracted_content,
          document_type_id
        `)
        .not('extracted_content', 'is', null)
        .order('created_at', { ascending: false });

      if (sourceError) throw sourceError;
      if (!sourceDocuments?.length) {
        toast.success('No documents with extracted content found');
        return;
      }

      // Filter out already classified documents
      const unclassifiedDocs = sourceDocuments.filter(doc => doc.document_type_id === null);
      const classifiedDocs = sourceDocuments.filter(doc => doc.document_type_id !== null);

      console.log(`📊 Document Status:`, {
        total: sourceDocuments.length,
        alreadyClassified: classifiedDocs.length,
        needingClassification: unclassifiedDocs.length
      });

      if (unclassifiedDocs.length === 0) {
        toast.success('All documents are already classified!');
        return;
      }

      const results = [];
      let presentationCount = 0;
      let successfulUpdates = 0;

      for (const doc of unclassifiedDocs) {
        console.log(`\n🔍 Processing document: ${doc.name}`, {
          id: doc.id,
          mimeType: doc.mime_type,
          contentPreview: typeof doc.extracted_content === 'string' 
            ? doc.extracted_content.slice(0, 100) + '...'
            : 'JSON content'
        });

        // Prepare content for AI processing
        const content = typeof doc.extracted_content === 'string' ? 
          doc.extracted_content : 
          JSON.stringify(doc.extracted_content);

        // Process with AI
        const result = await processWithAI({
          systemPrompt: prompt,
          userMessage: JSON.stringify({
            documentTypes: documentTypes.map(dt => ({
              id: dt.id,
              type: dt.document_type,
              category: dt.category,
              description: dt.description
            })),
            documentToClassify: {
              name: doc.name,
              content: content.slice(0, 15000)
            }
          }),
          temperature: 0.1,
          requireJsonOutput: true,
          validateResponse: (response) => {
            const parsed = ClassificationResponseSchema.safeParse(response);
            if (!parsed.success) {
              throw new Error(`Invalid response format: ${parsed.error.message}`);
            }
            
            // Verify typeId exists in document types
            const validTypeId = documentTypes.some(dt => dt.id === parsed.data.typeId);
            if (!validTypeId) {
              throw new Error('Invalid typeId: does not match any provided document type');
            }

            if (parsed.data.documentType === 'Presentation Announcement') {
              presentationCount++;
            }

            return parsed.data;
          }
        });

        // Update the document
        const updateData: Database['public']['Tables']['sources_google']['Update'] = {
          document_type_id: result.typeId,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(doc.metadata || {}), // Add null check with default empty object
            classification: {
              confidence: result.confidence,
              reasoning: result.reasoning,
              classified_at: new Date().toISOString()
            }
          }
        };

        console.log('Updating document with classification:', {
          docId: doc.id,
          typeId: result.typeId,
          confidence: result.confidence,
          metadata: updateData.metadata
        });

        const { error: updateError } = await supabase
          .from('sources_google')
          .update(updateData)
          .eq('id', doc.id);

        if (updateError) {
          console.error('Failed to update document:', {
            error: updateError,
            docId: doc.id,
            typeId: result.typeId
          });
          continue;
        }

        successfulUpdates++;
        console.log(`✅ Updated document ${doc.id} with type ${result.typeId}`);

        results.push({
          fileName: doc.name,
          documentId: doc.id,
          classification: {
            ...result,
            isPresentationAnnouncement: result.documentType === 'Presentation Announcement',
            confidenceScore: result.confidence,
            classificationReasoning: result.reasoning,
            assignedTypeId: result.typeId
          }
        });
      }

      // Log final summary
      console.log('\n📊 Classification Summary:', {
        totalDocuments: sourceDocuments.length,
        previouslyClassified: classifiedDocs.length,
        processedDocuments: unclassifiedDocs.length,
        successfulUpdates,
        presentationAnnouncements: presentationCount,
        presentationPercentage: `${(presentationCount / unclassifiedDocs.length * 100).toFixed(1)}%`
      });

      // Generate and display report
      const markdown = generateMarkdownReport(results, classifiedDocs.length);
      setClassificationResults(markdown);
      
      toast.success(`Classified and updated ${successfulUpdates} documents. ${classifiedDocs.length} were already classified.`);
      return results;
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Failed to classify documents');
    } finally {
      setLoading(false);
    }
  };

  const generateMarkdownReport = (results: any[], previouslyClassifiedCount: number) => {
    return `# Document Classification Results
${new Date().toISOString()}

## Summary
- Previously Classified: ${previouslyClassifiedCount}
- Newly Processed: ${results.length}
- Presentation Announcements Found: ${results.filter(r => r.classification.isPresentationAnnouncement).length}

## Detailed Results

${results.map(result => `
### ${result.fileName}
- Document ID: ${result.documentId}
- Assigned Type: ${result.classification.documentType}
- Document Type ID: \`${result.classification.assignedTypeId}\`
- Confidence: ${(result.classification.confidenceScore * 100).toFixed(1)}%
- Is Presentation Announcement: ${result.classification.isPresentationAnnouncement ? '✅' : '❌'}
- Reasoning: ${result.classification.classificationReasoning}
`).join('\n')}
`;
  };

  // Add download helper
  const downloadResults = () => {
    if (!classificationResults) return;
    
    const blob = new Blob([classificationResults], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classification-results-${new Date().toISOString()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Add this function near your other handlers
  const addPresentationAnnouncementType = async () => {
    try {
      // Get current user ID
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (!userId) {
        throw new Error('No authenticated user found');
      }

      console.log('Creating document type with user:', userId);

      const { data, error } = await supabase
        .from('document_types')
        .insert({
          id: crypto.randomUUID(),
          document_type: 'Presentation Announcement',
          category: 'Announcements',
          description: 'Documents announcing upcoming presentations, talks, or speaking engagements',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_ai_generated: false,
          required_fields: {
            title: 'string',
            presenter: 'string',
            date: 'date',
            location: 'string',
            description: 'string'
          },
          validation_rules: {
            title: { required: true, minLength: 3 },
            presenter: { required: true },
            date: { required: true, futureDate: true },
            location: { required: true }
          },
          ai_processing_rules: {
            extractFields: ['title', 'presenter', 'date', 'location'],
            dateFormat: 'YYYY-MM-DD',
            confidenceThreshold: 0.7
          }
        })
        .select();

      if (error) {
        console.error('Insert error:', {
          error,
          userId,
          timestamp: new Date().toISOString()
        });
        throw error;
      }

      toast.success('Added Presentation Announcement document type');
      console.log('New document type:', data[0]);

      await loadDocumentTypes();
    } catch (error) {
      console.error('Error adding document type:', error);
      toast.error('Failed to add document type');
    }
  };

  // Add this debug function
  const checkAuthAndTableAccess = async () => {
    try {
      // Check current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', {
        exists: !!session,
        userId: session?.user?.id,
        email: session?.user?.email
      });

      if (sessionError) throw sessionError;

      // Try to read document_types
      const { data: types, error: readError } = await supabase
        .from('document_types')
        .select('id, document_type')
        .limit(1);

      console.log('Document types read test:', {
        success: !readError,
        data: types,
        error: readError
      });

      // Try a test update
      if (session?.user?.id) {
        const { data: updateTest, error: updateError } = await supabase
          .from('document_types')
          .update({ 
            updated_at: new Date().toISOString()
          })
          .eq('id', types?.[0]?.id)
          .select();

        console.log('Update test:', {
          success: !updateError,
          error: updateError,
          data: updateTest
        });
      }

      return {
        session,
        types,
        message: 'Auth and table access check complete'
      };
    } catch (error) {
      console.error('Auth/Table check error:', error);
      return {
        error,
        message: 'Auth and table access check failed'
      };
    }
  };

  // Add this debug function
  const checkTableStructure = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_table_columns', {
          p_table_name: 'document_types'
        });

      console.log('Table structure:', {
        success: !error,
        columns: data,
        error
      });

      // Also check a sample record
      const { data: sampleRecord, error: sampleError } = await supabase
        .from('document_types')
        .select('*')
        .limit(1)
        .single();

      console.log('Sample record:', {
        success: !sampleError,
        record: sampleRecord,
        error: sampleError
      });

      return data;
    } catch (error) {
      console.error('Failed to get table structure:', error);
      return null;
    }
  };

  // Add new function to update metadata for already classified documents
  const updateClassificationMetadata = async () => {
    setLoading(true);
    try {
      // Get all documents that have a document_type_id but might not have metadata
      const { data: classifiedDocs, error: fetchError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          extracted_content,
          document_type_id,
          metadata,
          mime_type
        `)
        .not('document_type_id', 'is', null)
        .not('extracted_content', 'is', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      if (!classifiedDocs?.length) {
        toast.success('No classified documents found to update');
        return;
      }

      console.log(`Found ${classifiedDocs.length} classified documents to update metadata`);

      // Load document types for reference
      const documentTypes = await loadDocumentTypes();
      if (!documentTypes) throw new Error('Failed to load document types');

      // Load the classification prompt
      const prompt = await loadClassificationPrompt();
      if (!prompt) throw new Error('Failed to load classification prompt');

      let updatedCount = 0;
      const results = [];

      for (const doc of classifiedDocs) {
        // Skip if already has classification metadata
        if (doc.metadata?.classification?.confidence) {
          console.log(`Skipping ${doc.name} - already has classification metadata`);
          continue;
        }

        console.log(`\n🔍 Re-processing ${doc.name} for confidence/reasoning`);

        // Prepare content for AI processing
        const content = typeof doc.extracted_content === 'string' ? 
          doc.extracted_content : 
          JSON.stringify(doc.extracted_content);

        // Process with AI, but this time we know the target type
        const result = await processWithAI({
          systemPrompt: prompt,
          userMessage: JSON.stringify({
            documentTypes: documentTypes.map(dt => ({
              id: dt.id,
              type: dt.document_type,
              category: dt.category,
              description: dt.description
            })),
            documentToClassify: {
              name: doc.name,
              content: content.slice(0, 15000)
            },
            currentTypeId: doc.document_type_id // Tell AI which type it's already classified as
          }),
          temperature: 0.1,
          requireJsonOutput: true,
          validateResponse: (response) => {
            const parsed = ClassificationResponseSchema.safeParse(response);
            if (!parsed.success) {
              throw new Error(`Invalid response format: ${parsed.error.message}`);
            }
            return parsed.data;
          }
        });

        // Update only the metadata
        const updateData: Database['public']['Tables']['sources_google']['Update'] = {
          metadata: {
            ...(doc.metadata || {}), // Add null check with default empty object
            classification: {
              confidence: result.confidence,
              reasoning: result.reasoning,
              classified_at: new Date().toISOString()
            }
          }
        };

        const { error: updateError } = await supabase
          .from('sources_google')
          .update(updateData)
          .eq('id', doc.id);

        if (updateError) {
          console.error('Failed to update metadata:', {
            error: updateError,
            docId: doc.id
          });
          continue;
        }

        updatedCount++;
        results.push({
          fileName: doc.name,
          documentId: doc.id,
          confidence: result.confidence,
          reasoning: result.reasoning
        });
      }

      // Log summary
      console.log('\n📊 Metadata Update Summary:', {
        totalClassifiedDocs: classifiedDocs.length,
        updatedWithMetadata: updatedCount,
        skipped: classifiedDocs.length - updatedCount
      });

      toast.success(`Updated metadata for ${updatedCount} documents`);

      // Show results
      setClassificationResults(
        `# Classification Metadata Update Results
${new Date().toISOString()}

## Summary
- Total Classified Documents: ${classifiedDocs.length}
- Updated with Metadata: ${updatedCount}
- Skipped (already had metadata): ${classifiedDocs.length - updatedCount}

## Updated Documents
${results.map(r => `
### ${r.fileName}
- Document ID: ${r.documentId}
- Confidence: ${(r.confidence * 100).toFixed(1)}%
- Reasoning: ${r.reasoning}
`).join('\n')}
`
      );

    } catch (error) {
      console.error('Metadata update error:', error);
      toast.error('Failed to update classification metadata');
    } finally {
      setLoading(false);
    }
  };

  // Add function to check DOCX count
  const checkDocxCount = async () => {
    try {
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('mime_type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .is('extracted_content', null);

      if (error) throw error;

      console.log('DOCX files needing extraction:', {
        count,
        query: 'mime_type=docx AND extracted_content IS NULL'
      });

      toast.success(`Found ${count} DOCX files needing content extraction`);
      return count;
    } catch (error) {
      console.error('Error checking DOCX count:', error);
      toast.error('Failed to check DOCX count');
      return null;
    }
  };

  // Add new function to extract DOCX content
  const extractDocxContent = async () => {
    setLoading(true);
    setIsExtracting(true);
    extractionRef.current = true;

    try {
      console.log('🚀 Starting DOCX content extraction process...');

      // Check auth first
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Auth check:', {
        isAuthenticated: !!session,
        userId: session?.user?.id
      });

      // Get all DOCX files without extracted content
      const { data: docxFiles, error: fetchError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          mime_type,
          extracted_content,
          drive_id,
          content_extracted,
          updated_at
        `)
        .eq('mime_type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .is('extracted_content', null)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching DOCX files:', {
          error: fetchError,
          message: fetchError.message,
          details: fetchError.details
        });
        throw fetchError;
      }

      console.log('Query results:', {
        totalFiles: docxFiles?.length,
        fileList: docxFiles?.map(f => ({
          name: f.name,
          id: f.id,
          driveId: f.drive_id,
          hasContent: !!f.extracted_content,
          contentExtracted: f.content_extracted,
          lastUpdated: f.updated_at
        }))
      });

      if (!docxFiles?.length) {
        toast.success('No unprocessed DOCX files found');
        return;
      }

      let successCount = 0;
      let failureCount = 0;
      const results = [];
      const errors = [];

      const updateFile = async (file: any, content: string) => {
        try {
          // Format content as a JSON object
          const contentObject = {
            text: content,
            metadata: {
              extractedAt: new Date().toISOString(),
              contentLength: content.length,
              extractionMethod: 'mammoth'
            }
          };

          console.log('Attempting database update:', {
            fileId: file.id,
            fileName: file.name,
            contentType: typeof contentObject,
            isValidJson: true
          });

          const { error: updateError } = await supabase
            .from('sources_google')
            .update({
              extracted_content: contentObject,  // Send as JSON object
              content_extracted: true,
              updated_at: new Date().toISOString()
            })
            .match({ id: file.id })
            .single();

          if (updateError) {
            console.error('Update error:', updateError);
            throw updateError;
          }

          return true;
        } catch (error) {
          console.error('Update failed:', error);
          return false;
        }
      };

      for (const file of docxFiles) {
        // Check if extraction was stopped
        if (!extractionRef.current) {
          console.log('Extraction process stopped by user');
          toast.success('Extraction process stopped');
          break;
        }

        try {
          console.log(`\n📄 Processing file:`, {
            name: file.name,
            id: file.id,
            driveId: file.drive_id
          });

          const content = await getDocxContent(file.drive_id);
          
          if (!content) {
            console.warn(`No content extracted from ${file.name}`);
            failureCount++;
            errors.push({
              file: file.name,
              error: 'No content extracted',
              stage: 'content extraction'
            });
            continue;
          }

          // Use the new update function
          const updateSuccess = await updateFile(file, content);
          
          if (!updateSuccess) {
            failureCount++;
            errors.push({
              file: file.name,
              error: 'Database update failed',
              stage: 'database update'
            });
            continue;
          }

          successCount++;
          results.push({
            fileName: file.name,
            fileId: file.id,
            contentLength: content.length
          });

        } catch (error) {
          console.error(`Failed to process ${file.name}:`, {
            error,
            stack: error.stack,
            fileId: file.id,
            driveId: file.drive_id
          });
          failureCount++;
          errors.push({
            file: file.name,
            error: error.message,
            stage: 'processing'
          });
        }
      }

      // Log detailed summary
      console.log('\n📊 Content Extraction Summary:', {
        totalFiles: docxFiles.length,
        successful: successCount,
        failed: failureCount,
        errors: errors,
        successRate: `${((successCount / docxFiles.length) * 100).toFixed(1)}%`
      });

      toast.success(`Processed ${successCount} files (${failureCount} failed)`);

      // Show detailed results including errors
      setClassificationResults(
        `# Content Extraction Results
${new Date().toISOString()}

## Summary
- Total DOCX Files: ${docxFiles.length}
- Successfully Processed: ${successCount}
- Failed: ${failureCount}
- Success Rate: ${((successCount / docxFiles.length) * 100).toFixed(1)}%

## Successfully Processed Files
${results.map(r => `
### ${r.fileName}
- File ID: ${r.fileId}
- Content Length: ${r.contentLength} characters
`).join('\n')}

## Errors
${errors.map(e => `
### ${e.file}
- Stage: ${e.stage}
- Error: ${e.error}
`).join('\n')}
`
      );

    } catch (error) {
      console.error('Content extraction error:', error);
      toast.error('Failed to extract content: ' + error.message);
    } finally {
      setLoading(false);
      setIsExtracting(false);
    }
  };

  // Add this debug function
  const checkExtractedContent = async () => {
    try {
      const { data, error } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          extracted_content,
          content_extracted,
          updated_at
        `)
        .in('id', [
          '0434507-8429-4386-abeb-b4f3d46c7220',
          '906654bd-4742-4ac5-a420-4f7ec11dd19c'
        ])
        .order('updated_at', { ascending: false });

      console.log('Extraction check:', {
        success: !error,
        files: data?.map(f => ({
          name: f.name,
          hasContent: !!f.extracted_content,
          contentLength: f.extracted_content?.length,
          contentExtracted: f.content_extracted,
          lastUpdated: f.updated_at
        })),
        error
      });

      return data;
    } catch (error) {
      console.error('Failed to check extracted content:', error);
      return null;
    }
  };

  // Add stop function
  const stopExtraction = () => {
    extractionRef.current = false;
    toast.success('Stopping extraction process...');
  };

  // Add this function near other similar functions
  const classifyNewContent = async () => {
    setLoading(true);
    try {
      console.log('Starting classification of new content...');
      
      // Get today's date at midnight UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Load document types for reference
      const documentTypes = await loadDocumentTypes();
      if (!documentTypes) throw new Error('Failed to load document types');

      // Load the classification prompt
      const prompt = await loadClassificationPrompt();
      if (!prompt) throw new Error('Failed to load classification prompt');

      // Find documents extracted today without document_type_id
      const { data: newDocuments, error: queryError } = await supabase
        .from('sources_google')
        .select('*')
        .gte('updated_at', today.toISOString())
        .is('document_type_id', null)
        .not('extracted_content', 'is', null);

      if (queryError) throw queryError;

      if (!newDocuments?.length) {
        toast.success('No new unclassified documents found from today');
        return;
      }

      console.log(`Found ${newDocuments.length} new documents to classify`);
      let successCount = 0;
      let failureCount = 0;
      const results = [];

      for (const doc of newDocuments) {
        try {
          console.log(`Processing: ${doc.name}`);

          // Get content from JSON object
          const content = doc.extracted_content?.text || 
            (typeof doc.extracted_content === 'string' ? doc.extracted_content : '');

          if (!content) {
            console.warn(`No content found for ${doc.name}`);
            continue;
          }

          // Process with AI
          const result = await processWithAI({
            systemPrompt: prompt,
            userMessage: JSON.stringify({
              documentTypes: documentTypes.map(dt => ({
                id: dt.id,
                type: dt.document_type,
                category: dt.category,
                description: dt.description
              })),
              documentToClassify: {
                name: doc.name,
                content: content.slice(0, 15000) // Limit content length
              }
            }),
            temperature: 0.1,
            requireJsonOutput: true,
            validateResponse: (response) => {
              const parsed = ClassificationResponseSchema.safeParse(response);
              if (!parsed.success) {
                throw new Error(`Invalid response format: ${parsed.error.message}`);
              }
              return parsed.data;
            }
          });

          // Update the document with classification results
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({
              document_type_id: result.typeId,
              metadata: {
                ...doc.metadata,
                classification: {
                  confidence: result.confidence,
                  reasoning: result.reasoning,
                  classified_at: new Date().toISOString()
                }
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', doc.id);

          if (updateError) {
            throw updateError;
          }

          successCount++;
          results.push({
            name: doc.name,
            typeId: result.typeId,
            confidence: result.confidence
          });

        } catch (error) {
          console.error(`Failed to classify ${doc.name}:`, error);
          failureCount++;
        }
      }

      // Show results
      toast.success(`Classified ${successCount} documents (${failureCount} failed)`);
      console.log('Classification complete:', {
        total: newDocuments.length,
        success: successCount,
        failed: failureCount,
        results
      });

    } catch (error) {
      console.error('Classification failed:', error);
      toast.error('Failed to classify new content');
    } finally {
      setLoading(false);
    }
  };

  // Add function to fetch and display today's classifications
  const showTodaysClassifications = async () => {
    setLoading(true);
    try {
      // Get today's date at midnight UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // Get documents updated today with their document types
      const { data: documents, error } = await supabase
        .from('sources_google')
        .select(`
          name,
          document_type_id,
          metadata,
          document_types (
            document_type
          )
        `)
        .gte('updated_at', today.toISOString())
        .not('document_type_id', 'is', null);

      if (error) throw error;

      if (!documents?.length) {
        toast.success('No documents classified today');
        return;
      }

      // Format the results
      const classifications = documents.map(doc => ({
        name: doc.name,
        documentType: doc.document_types?.document_type || 'Unknown',
        confidence: doc.metadata?.classification?.confidence || 0,
        reasoning: doc.metadata?.classification?.reasoning || 'No reasoning provided'
      }));

      setTodaysClassifications(classifications);
      console.log('Today\'s classifications:', classifications);

    } catch (error) {
      console.error('Failed to fetch classifications:', error);
      toast.error('Failed to load today\'s classifications');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to validate Google Drive access token
  const validateGoogleToken = async (): Promise<string> => {
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      
      if (!accessToken) {
        throw new Error('No Google access token found in environment variables');
      }
      
      // Log token (first few chars only for security)
      console.log('Using access token:', accessToken.substring(0, 10) + '...');
      console.log('Token length:', accessToken.length);
      
      // Verify token has expected format (rough check)
      if (accessToken.length < 20) {
        throw new Error('Access token appears invalid (too short)');
      }
      
      // Test the token with a simple metadata request
      const response = await fetch(
        'https://www.googleapis.com/drive/v3/files?pageSize=1',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (!response.ok) {
        // Log the error response if not ok
        const errorText = await response.text();
        console.error('Token validation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        
        // Provide more helpful error messages based on status code
        if (response.status === 401) {
          throw new Error('Google Drive token is invalid or expired (401 Unauthorized)');
        } else if (response.status === 403) {
          throw new Error('Google Drive token lacks required permissions (403 Forbidden)');
        } else {
          throw new Error(`Token validation failed: ${response.status} - ${response.statusText}`);
        }
      }
      
      console.log('✅ Google Drive token validated successfully');
      return accessToken;
    } catch (error) {
      console.error('Google Drive token validation error:', error);
      // Add user-friendly toast
      toast.error(`Google Drive authentication error: ${error.message}`);
      throw error;
    }
  };
  
  // Helper function to fetch text content from Google Drive
  const getTextFileContent = async (fileId: string): Promise<string> => {
    try {
      console.log(`🔄 Fetching text file content for ID: ${fileId}`);
      const accessToken = await validateGoogleToken();
      
      // Get the file directly using alt=media parameter
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'text/plain'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('File fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          fileId
        });
        throw new Error(`Google Drive API error: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      console.log(`✅ Successfully fetched text content (${content.length} chars)`);
      
      return content;
    } catch (error) {
      console.error(`❌ Text file fetch failed:`, error);
      throw error;
    }
  };
  
  // Add this helper function at the top level
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
      .replace(/\u0000/g, '')  // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove non-printable chars
      .replace(/\r\n/g, '\n')  // Normalize newlines
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();

    return cleaned;
  };

  // Add enum for valid status values
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

  // Define valid status values
  const DOCUMENT_STATUS = {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    ERROR: 'error'
  } as const;

  // Classify text files
  const classifyTextFiles = async () => {
    setLoading(true);
    try {
      console.log('🚀 Starting text file classification process...');
      toast.success('Starting text file classification');
      
      // Load document types for reference
      console.log('📚 Loading document types...');
      const documentTypes = await loadDocumentTypes();
      if (!documentTypes) {
        console.error('❌ Failed to load document types');
        throw new Error('Failed to load document types');
      }
      console.log(`✅ Loaded ${documentTypes.length} document types`);
      
      // Load the classification prompt
      console.log('📜 Loading classification prompt...');
      const prompt = await loadClassificationPrompt();
      if (!prompt) {
        console.error('❌ Failed to load classification prompt');
        throw new Error('Failed to load classification prompt');
      }
      console.log(`✅ Loaded classification prompt (${prompt.length} chars)`);
      console.log('Prompt preview:', prompt.slice(0, 200) + '...');
      
      // Get all unclassified text files
      console.log('🔍 Searching for unclassified text files...');
      const { data: textFiles, error: fetchError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          mime_type,
          extracted_content,
          content_extracted,
          document_type_id,
          created_at,
          drive_id
        `)
        .eq('mime_type', 'text/plain')
        .is('document_type_id', null)
        .order('created_at', { ascending: false });
        
      if (fetchError) {
        console.error('❌ Database query failed:', fetchError);
        throw fetchError;
      }
      
      if (!textFiles?.length) {
        console.log('ℹ️ No unclassified text files found');
        toast.success('No unclassified text files found');
        return;
      }
      
      // Count files with content vs without content
      const filesWithContent = textFiles.filter(f => f.extracted_content !== null);
      const filesWithoutContent = textFiles.filter(f => f.extracted_content === null);
      
      console.log(`📊 Text File Statistics:`, {
        total: textFiles.length,
        withContent: filesWithContent.length,
        withoutContent: filesWithoutContent.length,
        firstFewNames: textFiles.slice(0, 3).map(f => f.name)
      });
      
      toast.success(`Found ${textFiles.length} text files to classify`);
      
      // Process files that have content
      console.log('\n📝 Processing text files with content');
      let processedCount = 0;
      let failedCount = 0;
      const results = [];
      
      // Show first few files for debugging
      console.log('Sample of files to process:', textFiles.slice(0, 3).map(f => ({
        id: f.id,
        name: f.name,
        hasContent: !!f.extracted_content,
        contentType: typeof f.extracted_content,
        mimeType: f.mime_type,
        driveId: f.drive_id
      })));
      
      for (let i = 0; i < textFiles.length; i++) {
        const file = textFiles[i];
        
        // Log progress
        console.log(`\n🔄 Processing file ${i+1}/${textFiles.length}: ${file.name}`);
        if (i > 0 && i % 5 === 0) {
          toast.success(`Processed ${i}/${textFiles.length} files`);
        }
        
        try {
          // Check for content first - if not present, try to extract it
          if (!file.extracted_content) {
            console.log(`⚠️ No extracted content for ${file.name} - attempting to fetch content from Google Drive`);
            
            try {
              // Check if we have a drive_id to fetch content
              if (!file.drive_id) {
                console.error(`❌ No drive_id available for ${file.name}`);
                failedCount++;
                continue;
              }
              
              console.log(`🔄 Fetching content for ${file.name} from Google Drive (ID: ${file.drive_id})`);
              
              // Use the appropriate method to fetch text content from Google Drive
              let textContent;
              
              // Use our helper function to get text content
              console.log(`🔄 Fetching text content for ${file.name}...`);
              try {
                textContent = await getTextFileContent(file.drive_id);
                
                // Log a sample of the content for verification
                console.log(`📄 Content sample: "${textContent.slice(0, 100)}..."`);
              } catch (fetchError) {
                console.error(`❌ Content fetch failed for ${file.name}:`, fetchError);
                throw fetchError; // Re-throw to be caught by outer try-catch
              }
              
              if (!textContent || textContent.length < 10) {
                console.error(`❌ Retrieved empty or very short content for ${file.name}`);
                failedCount++;
                continue;
              }
              
              // Save the extracted content back to the database
              console.log(`💾 Saving extracted content to database...`);
              const saveResult = await supabase
                .from('sources_google')
                .update({
                  extracted_content: textContent,
                  content_extracted: true,
                  updated_at: new Date().toISOString()
                })
                .eq('id', file.id);
                
              if (saveResult.error) {
                console.error(`❌ Failed to save extracted content:`, saveResult.error);
                // Continue with classification anyway using the fetched content
              } else {
                console.log(`✅ Content saved to database`);
              }
              
              // Use the fetched content for classification
              file.extracted_content = textContent;
              
            } catch (extractError) {
              console.error(`❌ Failed to extract content for ${file.name}:`, extractError);
              failedCount++;
              continue;
            }
          }
          
          // Get content - handle both string and object formats
          let content;
          if (typeof file.extracted_content === 'string') {
            content = file.extracted_content;
            console.log(`📄 Found string content (${content.length} chars)`);
          } else if (file.extracted_content?.text) {
            content = file.extracted_content.text;
            console.log(`📄 Found object.text content (${content.length} chars)`);
          } else {
            content = JSON.stringify(file.extracted_content);
            console.log(`📄 Converted object content to string (${content.length} chars)`);
          }
          
          // Log content sample
          console.log('Content sample:', content.slice(0, 200) + '...');
          
          if (!content || content.length < 10) {
            console.warn(`⚠️ Insufficient content for ${file.name}`);
            failedCount++;
            continue;
          }
          
          // Create the AI request payload
          const aiPayload = {
            documentTypes: documentTypes.map(dt => ({
              id: dt.id,
              type: dt.document_type,
              category: dt.category,
              description: dt.description
            })),
            documentToClassify: {
              name: file.name,
              content: content.slice(0, 15000) // Limit content length
            }
          };
          
          console.log('🤖 Sending to AI for classification:', {
            fileName: file.name,
            contentLength: content.length,
            promptLength: prompt.length,
            docTypeCount: documentTypes.length
          });
          
          // Process with AI using the same approach as classifyDocuments
          const result = await processWithAI({
            systemPrompt: prompt,
            userMessage: JSON.stringify(aiPayload),
            temperature: 0.1,
            requireJsonOutput: true,
            validateResponse: (response) => {
              console.log('🔍 Validating AI response...');
              const parsed = ClassificationResponseSchema.safeParse(response);
              if (!parsed.success) {
                console.error('❌ Invalid response format:', parsed.error.message);
                throw new Error(`Invalid response format: ${parsed.error.message}`);
              }
              
              // Verify typeId exists in document types
              const validTypeId = documentTypes.some(dt => dt.id === parsed.data.typeId);
              if (!validTypeId) {
                console.error('❌ Invalid typeId:', parsed.data.typeId);
                throw new Error('Invalid typeId: does not match any provided document type');
              }
              
              console.log('✅ Valid AI response:', {
                documentType: parsed.data.documentType,
                typeId: parsed.data.typeId,
                confidence: parsed.data.confidence
              });
              
              return parsed.data;
            }
          });
          
          console.log('🎯 Classification result:', {
            fileName: file.name,
            documentType: result.documentType,
            typeId: result.typeId,
            confidence: result.confidence,
            reasoning: result.reasoning?.slice(0, 100) + '...'
          });
          
          // Update the document with classification results
          const updateData = {
            document_type_id: result.typeId,
            updated_at: new Date().toISOString(),
            metadata: {
              ...file.metadata, // Preserve existing metadata if any
              classification: {
                confidence: result.confidence,
                reasoning: result.reasoning,
                classified_at: new Date().toISOString()
              }
            }
          };
          
          console.log('💾 Updating database record:', {
            fileId: file.id,
            updateData: {
              document_type_id: updateData.document_type_id,
              hasMetadata: !!updateData.metadata,
              updateTime: updateData.updated_at
            }
          });
          
          const { error: updateError } = await supabase
            .from('sources_google')
            .update(updateData)
            .eq('id', file.id);
            
          if (updateError) {
            console.error('❌ Failed to update database:', updateError);
            failedCount++;
            continue;
          }
          
          console.log(`✅ Successfully classified and updated ${file.name}`);
          processedCount++;
          results.push({
            fileName: file.name,
            documentId: file.id,
            documentType: result.documentType,
            typeId: result.typeId,
            confidence: result.confidence,
            reasoning: result.reasoning
          });
          
        } catch (error) {
          console.error(`❌ Error processing ${file.name}:`, {
            error,
            message: error.message,
            stack: error.stack
          });
          failedCount++;
        }
      }
      
      // Generate report
      const markdown = `# Text File Classification Results
${new Date().toISOString()}

## Summary
- Total Text Files: ${textFiles.length}
- Successfully Classified: ${processedCount}
- Failed: ${failedCount}

## Detailed Results

${results.map(result => `
### ${result.fileName}
- Document ID: ${result.documentId}
- Assigned Type: ${result.documentType}
- Document Type ID: \`${result.typeId}\`
- Confidence: ${(result.confidence * 100).toFixed(1)}%
- Reasoning: ${result.reasoning}
`).join('\n')}
`;

      setClassificationResults(markdown);
      toast.success(`Classified ${processedCount} text files (${failedCount} failed)`);
      
    } catch (error) {
      console.error('Text file classification error:', error);
      toast.error('Failed to classify text files');
    } finally {
      setLoading(false);
    }
  };

  // Generate a report on sources_google by mime_type and document_type_id
  const generateSourcesReport = async () => {
    setLoading(true);
    try {
      console.log('Generating sources_google report...');
      
      // Define the mime types we want to check
      const mimeTypes = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        pdf: 'application/pdf',
        txt: 'text/plain'
      };
      
      const report = {
        docx: { classified: 0, unclassified: 0, types: {} },
        pdf: { classified: 0, unclassified: 0, types: {} },
        txt: { classified: 0, unclassified: 0, types: {} },
        total: { classified: 0, unclassified: 0 }
      };
      
      // Get all sources_google records
      const { data: allSources, error: fetchError } = await supabase
        .from('sources_google')
        .select(`
          mime_type,
          document_type_id,
          document_types (
            document_type
          )
        `);
        
      if (fetchError) throw fetchError;
      
      if (!allSources?.length) {
        toast.success('No sources_google records found');
        return;
      }
      
      console.log(`Found ${allSources.length} sources_google records`);
      
      // Process each record
      allSources.forEach(source => {
        let fileType = 'other';
        
        // Determine file type based on mime_type
        if (source.mime_type === mimeTypes.docx) fileType = 'docx';
        else if (source.mime_type === mimeTypes.pdf) fileType = 'pdf';
        else if (source.mime_type === mimeTypes.txt) fileType = 'txt';
        
        // Skip if not one of our target types
        if (fileType === 'other') return;
        
        // Count based on classification status
        if (source.document_type_id) {
          report[fileType].classified++;
          report.total.classified++;
          
          // Count by document type
          const docType = source.document_types?.document_type || 'Unknown';
          report[fileType].types[docType] = (report[fileType].types[docType] || 0) + 1;
        } else {
          report[fileType].unclassified++;
          report.total.unclassified++;
        }
      });
      
      // Generate markdown report
      const markdown = `# Sources Google Report
${new Date().toISOString()}

## Summary
- Total Sources: ${allSources.length}
- Total Classified: ${report.total.classified}
- Total Unclassified: ${report.total.unclassified}

## By File Type

### DOCX Files
- Classified: ${report.docx.classified}
- Unclassified: ${report.docx.unclassified}
- Types:
${Object.entries(report.docx.types)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .map(([type, count]) => `  - ${type}: ${count}`)
  .join('\n')}

### PDF Files
- Classified: ${report.pdf.classified}
- Unclassified: ${report.pdf.unclassified}
- Types:
${Object.entries(report.pdf.types)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .map(([type, count]) => `  - ${type}: ${count}`)
  .join('\n')}

### Text Files
- Classified: ${report.txt.classified}
- Unclassified: ${report.txt.unclassified}
- Types:
${Object.entries(report.txt.types)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .map(([type, count]) => `  - ${type}: ${count}`)
  .join('\n')}
`;

      // Display the report
      setClassificationResults(markdown);
      toast.success('Generated sources_google report');
      
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  // Update the transfer function
  const transferToExpertDocuments = async () => {
    setLoading(true);
    try {
      console.log('🚀 Starting transfer process...');

      // STEP 1: Query sources_google
      const { data: sourceDocs, error: sourceError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          drive_id,
          mime_type,
          extracted_content,
          document_type_id,
          metadata
        `)
        .gte('updated_at', new Date().toISOString().split('T')[0])
        .not('extracted_content', 'is', null)
        .not('document_type_id', 'is', null);

      if (sourceError) {
        console.error('Query failed:', sourceError);
        throw sourceError;
      }

      console.log('Found documents:', sourceDocs?.length);

      let successCount = 0;
      const transferred = [];
      const errors = [];

      for (const doc of sourceDocs || []) {
        try {
          console.log(`\n📄 Processing: ${doc.name}`);

          // Check for existing
          const { data: existingDocs, error: checkError } = await supabase
            .from('expert_documents')
            .select('id')
            .eq('source_id', doc.id);

          if (checkError) {
            console.error('Check error:', checkError);
            continue;
          }

          if (existingDocs?.length > 0) {
            console.log('⏭️ Already exists, skipping');
            continue;
          }

          // Extract and clean content
          let rawContent;
          if (typeof doc.extracted_content === 'string') {
            rawContent = cleanContent(doc.extracted_content);
          } else if (doc.extracted_content?.text) {
            rawContent = cleanContent(doc.extracted_content.text);
          } else {
            console.warn('⚠️ Invalid content:', doc.extracted_content);
            continue;
          }

          // Update the insert data to handle JSON properly
          const now = new Date().toISOString();
          const insertData = {
            // Required fields (NOT NULL)
            raw_content: rawContent,
            document_type_id: doc.document_type_id,
            source_id: doc.id,
            created_at: now,  // NOT NULL with default now()
            updated_at: now,  // NOT NULL with default now()
            
            // Content fields (jsonb type)
            processed_content: {  // Don't stringify - it's jsonb
              title: doc.name,
              content: rawContent,
              source: {
                drive_id: doc.drive_id,
                mime_type: doc.mime_type
              }
            },
            
            // Status field
            processing_status: 'pending' as const,  // text type
            
            // Optional fields
            word_count: rawContent.split(/\s+/).length || null,  // integer
            language: 'en',  // text
            confidence_score: doc.metadata?.classification?.confidence || null,  // numeric
            
            // Arrays
            key_insights: [],  // ARRAY type
            topics: [],  // ARRAY type
          };

          // Add detailed debugging
          console.log('Document insert debug:', {
            document: {
              name: doc.name,
              id: doc.id,
              typeId: doc.document_type_id
            },
            insertData: debugObject(insertData),
            metadata: {
              original: doc.metadata,
              classification: doc.metadata?.classification
            },
            contentSample: {
              raw: rawContent.slice(0, 100),
              processed: JSON.stringify(insertData.processed_content).slice(0, 100)
            }
          });

          // Attempt insert with better error handling
          try {
            const { data, error: insertError } = await supabase
              .from('expert_documents')
              .insert(insertData)
              .select()
              .single();

            if (insertError) {
              console.error('Insert failed:', {
                error: insertError,
                code: insertError.code,
                message: insertError.message,
                hint: insertError.hint,
                details: insertError.details,
                data: debugObject(insertData)
              });
              throw insertError;
            }

            console.log('Insert succeeded:', {
              id: data.id,
              fields: Object.keys(data)
            });
          } catch (error) {
            console.error('Insert error:', error);
            throw error;
          }

          successCount++;
          transferred.push(doc.name);
          console.log('✅ Success');

        } catch (error) {
          console.error('Failed:', {
            doc: doc.name,
            error: error.message
          });
          errors.push({
            doc: doc.name,
            error: error.message
          });
        }
      }

      // Show results
      console.log('\n📊 Summary:', {
        processed: sourceDocs?.length || 0,
        succeeded: successCount,
        failed: errors.length,
        errors: errors
      });

      if (successCount > 0) {
        toast.success(`Transferred ${successCount} documents`);
      } else {
        toast.success('No documents transferred');
      }

    } catch (error) {
      console.error('Process failed:', error);
      toast.error('Transfer failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Add debug helper
  const debugObject = (obj: any) => {
    return Object.entries(obj).map(([key, value]) => ({
      key,
      type: typeof value,
      isNull: value === null,
      preview: JSON.stringify(value).slice(0, 100)
    }));
  };

  // Update to use processDocumentWithAI
  const processPresentationAnnouncements = async () => {
    setLoading(true);
    try {
      console.log('🔍 Starting presentation processing...');
      let processedCount = 0;
      let failedCount = 0;

      // Get ALL unprocessed presentation announcements
      const { data: docs, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          processing_status,
          sources_google!inner (
            name,
            document_type_id,
            document_types!inner (
              document_type
            )
          )
        `)
        .eq('sources_google.document_types.document_type', 'Presentation Announcement')
        .neq('processing_status', 'completed');

      console.log('Query results:', {
        success: !error,
        error: error ? {
          message: error.message,
          details: error.details
        } : null,
        docsFound: docs?.length
      });

      if (error) throw error;
      if (!docs?.length) {
        toast.success('No unprocessed presentation announcements found');
        return;
      }

      // Load and verify prompt
      const promptResponse = await fetch('/docs/prompts/expert-extraction-prompt.md');
      if (!promptResponse.ok) {
        throw new Error(`Failed to load prompt: ${promptResponse.status}`);
      }
      const prompt = await promptResponse.text();

      // Process each document
      for (const doc of docs) {
        try {
          console.log('\n📄 Processing document:', {
            id: doc.id,
            name: doc.sources_google?.name
          });

          if (!doc.raw_content) {
            console.warn('⚠️ Skipping - no content:', doc.id);
            failedCount++;
            continue;
          }

          const systemPrompt = prompt + `
\nIMPORTANT: Your response must be ONLY a valid JSON object. Do not include any text before or after the JSON.
Use this exact structure, with empty arrays [] for missing information:
{
  "basic_information": {
    "name": "string",
    "title": "string",
    "current_position": "string",
    "institution": "string",
    "credentials": [],
    "specialty_areas": []
  },
  "research_summary": "string",
  "notable_achievements": [],
  "professional_links": {
    "website_urls": [],
    "social_media": []
  },
  "expertise_keywords": []
}`;

          const result = await processWithAI({
            systemPrompt,
            userMessage: doc.raw_content,
            requireJsonOutput: true,
            validateResponse: validateExpertProfile
          });

          // Update the document with results
          const { error: updateError } = await supabase
            .from('expert_documents')
            .update({
              processing_status: 'completed',
              processed_content: {
                raw: doc.raw_content,
                ai_analysis: result,
                processed_at: new Date().toISOString()
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', doc.id);

          if (updateError) throw updateError;
          processedCount++;
          toast.success(`Processed: ${doc.sources_google?.name}`);

        } catch (error) {
          console.error(`Failed processing ${doc.id}:`, error);
          failedCount++;
          toast.error(`Failed: ${doc.sources_google?.name}`);
        }
      }

      // Show final summary
      toast.success(`Processing complete: ${processedCount} processed, ${failedCount} failed`);
      console.log('Processing Summary:', {
        total: docs.length,
        processed: processedCount,
        failed: failedCount,
        completionTime: new Date().toISOString()
      });

    } catch (error) {
      console.error('Processing failed:', error);
      toast.error('Failed to process presentation announcements');
    } finally {
      setLoading(false);
    }
  };

  // Add this function near your other handlers
  const checkProcessedPresentations = async () => {
    try {
      console.log('Checking processed presentations...');

      // Get today's date at midnight UTC
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const { data: docs, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          processing_status,
          processed_content,
          raw_content,
          updated_at,
          sources_google (
            name,
            document_type_id,
            document_types (
              document_type
            )
          )
        `)
        .gte('updated_at', today.toISOString())
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Query failed:', error);
        toast.error('Failed to check presentations');
        return;
      }

      console.log('Today\'s processed documents:', {
        total: docs?.length || 0,
        documents: docs?.map(doc => ({
          id: doc.id,
          fileName: doc.sources_google?.name,
          documentType: doc.sources_google?.document_types?.document_type,
          status: doc.processing_status,
          processedAt: doc.updated_at,
          hasRawContent: !!doc.raw_content,
          hasProcessedContent: !!doc.processed_content,
          aiAnalysis: doc.processed_content?.ai_analysis 
            ? JSON.stringify(doc.processed_content.ai_analysis).slice(0, 100) + '...'
            : 'No AI analysis'
        }))
      });

      // Show results in UI
      if (docs && docs.length > 0) {
        toast.success(`Found ${docs.length} documents processed today`);
        
        // Create detailed formatted list
        const resultsList = docs.map(doc => `
📄 ${doc.sources_google?.name || 'Unnamed'}
Status: ${doc.processing_status}
Type: ${doc.sources_google?.document_types?.document_type || 'Unknown'}
Processed: ${new Date(doc.updated_at).toLocaleTimeString()}
AI Analysis: ${doc.processed_content?.ai_analysis 
  ? JSON.stringify(doc.processed_content.ai_analysis, null, 2).slice(0, 200) + '...'
  : 'No AI analysis'}
-------------------`).join('\n');
        
        setDebugInfo(resultsList);
      } else {
        toast.success('No documents processed today');
        setDebugInfo('No documents processed today');
      }

    } catch (error) {
      console.error('Check failed:', error);
      toast.error('Failed to check processed documents');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Document Classification</h1>
      
      <div className="space-y-4">
        {isAuthenticated ? (
          <>
            <div className="flex gap-4">
              <button 
                className={`bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2
                  ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={classifyDocuments}
                disabled={loading}
              >
                <span>{loading ? '⏳' : '🏷️'}</span>
                {loading ? 'Classifying...' : 'Classify Documents'}
              </button>

              <button
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                onClick={addPresentationAnnouncementType}
              >
                <span>➕</span> Add Presentation Type
              </button>

              <div className="relative">
                {isExtracting ? (
                  <button
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-bold"
                    onClick={stopExtraction}
                  >
                    <span>⏹️</span> Stop Extraction
                  </button>
                ) : (
                  <button
                    className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                    onClick={async () => {
                      const count = await checkDocxCount();
                      if (count && count > 0) {
                        if (confirm(`Process ${count} DOCX files for content extraction?`)) {
                          extractDocxContent();
                        }
                      }
                    }}
                    disabled={loading}
                  >
                    <span>📄</span> Extract Content
                  </button>
                )}
              </div>
            </div>

            {classificationResults && (
              <>
                <button
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                  onClick={downloadResults}
                >
                  <span>📥</span> Download Results
                </button>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h2 className="text-lg font-medium mb-2">Classification Results</h2>
                  <pre className="whitespace-pre-wrap text-sm">
                    {classificationResults}
                  </pre>
                </div>
              </>
            )}

            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h2 className="text-lg font-medium mb-2">Diagnostics</h2>
              <button 
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
                onClick={runDebugQueries}
              >
                Run Diagnostics
              </button>
              {debugInfo && (
                <pre className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                  {debugInfo}
                </pre>
              )}
            </div>

            <button
              className="text-sm bg-blue-200 hover:bg-blue-300 px-3 py-1 rounded ml-2"
              onClick={checkAuthAndTableAccess}
            >
              Check Auth/DB Access
            </button>

            <button
              className="text-sm bg-purple-200 hover:bg-purple-300 px-3 py-1 rounded ml-2"
              onClick={checkTableStructure}
            >
              Check Table Structure
            </button>

            <button
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={updateClassificationMetadata}
              disabled={loading}
            >
              <span>📝</span> Update Classification Metadata
            </button>

            <button
              className="text-sm bg-orange-200 hover:bg-orange-300 px-3 py-1 rounded ml-2"
              onClick={checkExtractedContent}
            >
              Check Extracted Content
            </button>

            <button
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={classifyNewContent}
              disabled={loading}
            >
              <span>🤖</span> Classify New Content
            </button>

            <button
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={showTodaysClassifications}
              disabled={loading}
            >
              <span>📋</span> Show Today's Classifications
            </button>

            <button
              className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={transferToExpertDocuments}
              disabled={loading}
            >
              <span>📋➡️</span> Transfer to Expert Documents
            </button>

            <button
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={processPresentationAnnouncements}
              disabled={loading}
            >
              <span>🎯</span> Process Presentations
            </button>

            <button
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={checkProcessedPresentations}
              disabled={loading}
            >
              <span>🎯</span> Check Processed Presentations
            </button>

            <button
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={generateSourcesReport}
              disabled={loading}
            >
              <span>📊</span> Generate Sources Report
            </button>
            
            <button
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              onClick={classifyTextFiles}
              disabled={loading}
            >
              <span>📝</span> Classify Text Files
            </button>

            {todaysClassifications.length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h2 className="text-lg font-medium mb-4">Today's Classifications</h2>
                <div className="space-y-4">
                  {todaysClassifications.map((doc, index) => (
                    <div key={index} className="border-b pb-4">
                      <h3 className="font-medium text-blue-600">{doc.name}</h3>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                        <div>
                          <span className="font-medium">Document Type:</span>
                          <span className="ml-2">{doc.documentType}</span>
                        </div>
                        <div>
                          <span className="font-medium">Confidence:</span>
                          <span className="ml-2">{(doc.confidence * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="font-medium">Reasoning:</span>
                        <p className="mt-1 text-gray-600">{doc.reasoning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-gray-600">
            {loading ? 'Authenticating...' : 'Not authenticated. Please wait...'}
          </div>
        )}
      </div>
    </div>
  );
}
export default ClassifyDocument; 
