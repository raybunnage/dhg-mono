import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import type { Database } from '../../../../supabase/types';
import { processWithAI } from '@/utils/ai-processing';
import { getDocxContent } from '@/utils/google-drive';
import { ClassificationResponseSchema } from '@/schemas/classification.schema';

// Update interface to match the actual table structure
type DocumentType = Database['public']['Tables']['document_types']['Row'];

// Add this near the top of the file after the imports
const DEBUG_QUERIES = {
  count: () => supabase.from('document_types').select('*', { count: 'exact', head: true }),
  sample: () => supabase.from('document_types').select('*').limit(5),
  all: () => supabase.from('document_types').select('*')
};

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

      // Load source documents that already have extracted content
      const { data: sourceDocuments, error: sourceError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          mime_type,
          extracted_content,
          metadata
        `)
        .not('extracted_content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15);

      if (sourceError) throw sourceError;
      if (!sourceDocuments?.length) {
        toast.error('No documents with extracted content found');
        return;
      }

      console.log(`Found ${sourceDocuments.length} documents to classify`);
      const results = [];
      let presentationCount = 0;

      for (const doc of sourceDocuments) {
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

            // Track presentation announcements
            if (parsed.data.documentType === 'Presentation Announcement') {
              presentationCount++;
              console.log('🎯 Found Presentation Announcement:', {
                confidence: parsed.data.confidence,
                reasoning: parsed.data.reasoning
              });
            }

            return parsed.data;
          }
        });

        // Store result with more details
        results.push({
          fileName: doc.name,
          documentId: doc.id,
          classification: {
            ...result,
            isPresentationAnnouncement: result.documentType === 'Presentation Announcement',
            confidenceScore: result.confidence,
            classificationReasoning: result.reasoning
          }
        });
      }

      // Log summary statistics
      console.log('\n📊 Classification Summary:', {
        totalDocuments: sourceDocuments.length,
        presentationAnnouncements: presentationCount,
        presentationPercentage: `${(presentationCount / sourceDocuments.length * 100).toFixed(1)}%`
      });

      // Generate and display report
      const markdown = generateMarkdownReport(results);
      setClassificationResults(markdown);
      
      toast.success(`Classified ${results.length} documents`);
      return results;
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Failed to classify documents');
    } finally {
      setLoading(false);
    }
  };

  const generateMarkdownReport = (results) => {
    return `# Document Classification Results
${new Date().toISOString()}

## Summary
- Total Documents Processed: ${results.length}
- Presentation Announcements Found: ${results.filter(r => r.classification.isPresentationAnnouncement).length}

## Detailed Results

${results.map(result => `
### ${result.fileName}
- Document ID: ${result.documentId}
- Assigned Type: ${result.classification.documentType}
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
          created_by: userId,
          updated_at: new Date().toISOString(),
          updated_by: userId, // Explicitly set updated_by
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
        .select('id, document_type, created_by, updated_by')
        .limit(1);

      console.log('Document types read test:', {
        success: !readError,
        data: types,
        error: readError
      });

      // Try a test update with explicit updated_by
      if (session?.user?.id) {
        const { data: updateTest, error: updateError } = await supabase
          .from('document_types')
          .update({ 
            updated_at: new Date().toISOString(),
            updated_by: session.user.id 
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
