import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import type { Database } from '@/integrations/supabase/types';
import { processWithAI, processDocumentWithAI, validateExpertProfile } from '@/utils/ai-processing';
import { getDocxContent } from '@/utils/google-drive';
import { ClassificationResponseSchema } from '@/schemas/classification.schema';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';

// Update interface to match the actual table structure
type DocumentType = Database['public']['Tables']['document_types']['Row'];

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

// Define workflow stages for the UI
type WorkflowStage = 'sync' | 'extract' | 'classify' | 'process' | 'analyze';

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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const [todaysClassifications, setTodaysClassifications] = useState<{
    name: string;
    documentType: string;
    confidence: number;
    reasoning: string;
  }[]>([]);

  // New state variables for document stats
  const [documentStats, setDocumentStats] = useState<{
    byMimeType: Record<string, { total: number, classified: number, byType: Record<string, number> }>,
    documentTypes: { id: string, document_type: string, category: string, count: number, isNew?: boolean }[],
    expertDocuments: { total: number, byStatus: Record<string, number>, byType: Record<string, number> }
  }>({
    byMimeType: {},
    documentTypes: [],
    expertDocuments: { total: 0, byStatus: {}, byType: {} }
  });

  // State for pipeline status
  const [pipelineStats, setPipelineStats] = useState({
    unprocessedDocuments: 0,
    unclassifiedDocuments: 0,
    pendingExtraction: 0,
    pendingAiProcessing: 0,
    completedDocuments: 0
  });

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      const authSuccess = await ensureAuth();
      setIsAuthenticated(authSuccess);
      if (authSuccess) {
        initialCheck();
        fetchPipelineStats();
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // Fetch pipeline statistics
  const fetchPipelineStats = async () => {
    try {
      const { count: unprocessedCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .is('content_extracted', false);
      
      const { count: unclassifiedCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .is('document_type_id', null)
        .not('extracted_content', 'is', null);
      
      const { count: pendingExtractionCount } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
        .eq('content_extracted', false);
      
      const { count: pendingAiCount } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'pending');
      
      const { count: completedCount } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'completed');
      
      setPipelineStats({
        unprocessedDocuments: unprocessedCount || 0,
        unclassifiedDocuments: unclassifiedCount || 0,
        pendingExtraction: pendingExtractionCount || 0,
        pendingAiProcessing: pendingAiCount || 0,
        completedDocuments: completedCount || 0
      });
      
    } catch (error) {
      console.error('Failed to fetch pipeline stats:', error);
    }
  };

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
      toast.success(`Loaded ${documentTypes.length} document types`);
      return documentTypes;
    } catch (error) {
      console.error('Error loading document types:', error);
      toast.error('Failed to load document types');
    } finally {
      setLoading(false);
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

  // Debug helper
  const debugObject = (obj: any) => {
    return Object.entries(obj).map(([key, value]) => ({
      key,
      type: typeof value,
      isNull: value === null,
      preview: JSON.stringify(value).slice(0, 100)
    }));
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

  // Function to fetch document stats
  const fetchDocumentStats = async () => {
    try {
      console.log('Fetching document statistics...');
      
      // Get document type counts - using * to get all fields
      const { data: types, error: typesError } = await supabase
        .from('document_types')
        .select('*')
        .order('document_type');
        
      if (typesError) {
        console.error('Error fetching document types:', typesError);
        throw typesError;
      }
      
      console.log(`Found ${types?.length || 0} document types`, types);
      
      // Count by mime type and document type
      const { data: sources, error: sourcesError } = await supabase
        .from('sources_google')
        .select(`
          mime_type,
          document_type_id,
          document_types (
            id, document_type
          )
        `);
        
      if (sourcesError) {
        console.error('Error fetching sources:', sourcesError);
        throw sourcesError;
      }
      
      // Get expert documents stats
      const { data: expertDocs, error: expertError } = await supabase
        .from('expert_documents')
        .select(`
          id,
          processing_status,
          document_type_id,
          document_types (
            id, document_type
          )
        `);
      
      if (expertError) {
        console.error('Error fetching expert documents:', expertError);
        throw expertError;
      }
      
      // Process expert document stats
      const expertStats = {
        total: expertDocs?.length || 0,
        byStatus: {} as Record<string, number>,
        byType: {} as Record<string, number>
      };
      
      expertDocs?.forEach(doc => {
        // Count by status
        expertStats.byStatus[doc.processing_status] = 
          (expertStats.byStatus[doc.processing_status] || 0) + 1;
        
        // Count by document type
        if (doc.document_type_id) {
          const typeName = doc.document_types?.document_type || 'Unknown';
          expertStats.byType[typeName] = (expertStats.byType[typeName] || 0) + 1;
        }
      });
      
      console.log(`Found ${sources?.length || 0} source files`);
      
      // Process stats
      const stats: Record<string, { total: number, classified: number, byType: Record<string, number> }> = {};
      const typeCounts: Record<string, number> = {};
      
      // Initialize mime type stats
      const mimeTypes = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'application/pdf'];
      mimeTypes.forEach(type => {
        const shortName = type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ? 'docx' :
                        type === 'text/plain' ? 'text' :
                        type === 'application/pdf' ? 'pdf' : type;
                        
        stats[shortName] = { total: 0, classified: 0, byType: {} };
      });
      
      // Count sources
      sources?.forEach(source => {
        let mimeShort = 'other';
        
        if (source.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          mimeShort = 'docx';
        } else if (source.mime_type === 'text/plain') {
          mimeShort = 'text';
        } else if (source.mime_type === 'application/pdf') {
          mimeShort = 'pdf';
        }
        
        // Initialize if not present
        if (!stats[mimeShort]) {
          stats[mimeShort] = { total: 0, classified: 0, byType: {} };
        }
        
        stats[mimeShort].total++;
        
        if (source.document_type_id) {
          stats[mimeShort].classified++;
          
          const docType = source.document_types?.document_type || 'Unknown';
          stats[mimeShort].byType[docType] = (stats[mimeShort].byType[docType] || 0) + 1;
          
          // Track total counts per document type
          typeCounts[source.document_type_id] = (typeCounts[source.document_type_id] || 0) + 1;
        }
      });
      
      // Combine with document types, preserving all fields
      const documentTypesWithCounts = types ? types.map(type => ({
        ...type, // Keep all original fields
        count: typeCounts[type.id] || 0,
        isNew: localStorage.getItem(`seen_doctype_${type.id}`) ? false : true
      })) : [];
      
      console.log('Document types with counts:', documentTypesWithCounts);
      
      // Mark all as seen
      if (types) {
        types.forEach(type => {
          localStorage.setItem(`seen_doctype_${type.id}`, 'true');
        });
      }
      
      setDocumentStats({
        byMimeType: stats,
        documentTypes: documentTypesWithCounts,
        expertDocuments: expertStats
      });
      
      console.log('Document stats updated successfully');
      
    } catch (error) {
      console.error('Error fetching document stats:', error);
      // Initialize with empty data in case of error
      setDocumentStats({
        byMimeType: {},
        documentTypes: [],
        expertDocuments: { total: 0, byStatus: {}, byType: {} }
      });
    }
  };
  
  // Fetch stats on initial load and when needed
  useEffect(() => {
    if (isAuthenticated) {
      fetchDocumentStats();
    }
  }, [isAuthenticated]);


  // Document Types Manager state and effects
  const [documentTypesData, setDocumentTypesData] = useState<DocumentType[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [formData, setFormData] = useState({
    document_type: '',
    category: '',
    description: '',
    mime_type: '',
    file_extension: '',
    is_ai_generated: false
  });
  const [formCategories, setFormCategories] = useState<string[]>([]);
  const [formMimeTypes, setFormMimeTypes] = useState<string[]>([]);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [isAiRequesting, setIsAiRequesting] = useState(false);
  const [aiRequestPrompt, setAiRequestPrompt] = useState('');
  const [aiRequestResponse, setAiRequestResponse] = useState('');
  const [aiResponseJson, setAiResponseJson] = useState('');
  const [aiResponseComments, setAiResponseComments] = useState('');
  const [editedAiJson, setEditedAiJson] = useState('');

  // Function to fetch document types for the manager tab
  const fetchDocumentTypesForManager = async () => {
    try {
      console.log("Fetching document types for manager...");
      const { data, error } = await supabase
        .from("document_types")
        .select("*")
        .order("document_type", { ascending: true });

      if (error) throw error;
      
      console.log(`Fetched ${data?.length} document types for manager`);
      setDocumentTypesData(data || []);
    } catch (error) {
      console.error("Error fetching document types:", error);
      toast.error("Failed to load document types");
    }
  };

  // Function to fetch form options like categories and mime types
  const fetchFormOptions = async () => {
    try {
      // Fetch categories
      const { data: categoryData, error: categoryError } = await supabase
        .from("document_types")
        .select("category")
        .not("category", "is", null);
      
      if (categoryError) throw categoryError;
      
      // Fetch mime types
      const { data: mimeTypeData, error: mimeTypeError } = await supabase
        .from("document_types")
        .select("mime_type")
        .not("mime_type", "is", null);
      
      if (mimeTypeError) throw mimeTypeError;
      
      // Extract unique values
      const uniqueCategories = Array.from(
        new Set(categoryData.map(item => item.category))
      ).filter(Boolean).sort();
      
      const uniqueMimeTypes = Array.from(
        new Set(mimeTypeData.map(item => item.mime_type))
      ).filter(Boolean).sort();
      
      setFormCategories(uniqueCategories.length > 0 ? uniqueCategories : 
        ["Research", "Communication", "Documentation", "Legal"]);
        
      setFormMimeTypes(uniqueMimeTypes.length > 0 ? uniqueMimeTypes : 
        ["application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    } catch (error) {
      console.error("Error loading form options:", error);
      // Set default values on error
      setFormCategories(["Research", "Communication", "Documentation", "Legal"]);
      setFormMimeTypes([
        "application/pdf", 
        "text/plain", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ]);
    }
  };

  // Fetch document types and options when the active tab changes to document-types
  useEffect(() => {
    if (activeTab === 'document-types') {
      fetchDocumentTypesForManager();
      fetchFormOptions();
    }
  }, [activeTab]);

  // Reset form when selectedType changes
  useEffect(() => {
    if (selectedType) {
      setFormData({
        document_type: selectedType.document_type || '',
        category: selectedType.category || '',
        description: selectedType.description || '',
        mime_type: selectedType.mime_type || '',
        file_extension: selectedType.file_extension || '',
        is_ai_generated: selectedType.is_ai_generated || false
      });
    } else {
      setFormData({
        document_type: '',
        category: '',
        description: '',
        mime_type: '',
        file_extension: '',
        is_ai_generated: false
      });
    }
  }, [selectedType]);
  
  // Document Type Manager handlers
  const handleEditClick = (docType: DocumentType) => {
    // Fetch latest categories when editing to ensure dropdown is up-to-date
    fetchFormOptions();
    setSelectedType(docType);
    setIsEditing(true);
    setIsAiRequesting(false);
  };

  const handleAddNewClick = () => {
    // Fetch latest categories when adding new item
    fetchFormOptions();
    setSelectedType(null);
    setIsEditing(true);
    setIsAiRequesting(false);
  };
  
  const handleAiRequestClick = () => {
    setIsAiRequesting(true);
    setIsEditing(false);
    setAiRequestPrompt('');
    setAiResponseJson('');
    setAiResponseComments('');
    setEditedAiJson('');
  };

  const handleSubmitAiRequest = async () => {
    if (!aiRequestPrompt.trim()) {
      toast.error('Please enter a request prompt');
      return;
    }

    setIsFormSubmitting(true);
    try {
      // First, check if we have a database prompt template
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompts')
        .select('*')
        .eq('name', 'document-type-request-template')
        .eq('status', 'active');
      
      if (promptsError) {
        console.error('Error fetching prompt template:', promptsError);
        toast.error('Failed to load document type request template');
        return;
      }
      
      // Get existing document types to provide context to the AI
      const documentTypes = await loadDocumentTypes();
      
      // Use the database template if available, otherwise use the hardcoded one
      let systemPrompt = '';
      let userMessage = '';
      
      if (promptsData && promptsData.length > 0) {
        console.log('Using database prompt template:', promptsData[0].name);
        // Parse the content from JSON string if needed
        const promptContent = typeof promptsData[0].content === 'string' 
          ? JSON.parse(promptsData[0].content) 
          : promptsData[0].content;
          
        systemPrompt = promptContent;
        userMessage = `Please create a document type definition based on this request:\n\n${aiRequestPrompt}\n\nInclude realistic validation rules and AI processing rules that would be appropriate for this document type. Use existing document types for reference but do not duplicate them.`;
      } else {
        console.log('Using hardcoded prompt template (no database template found)');
        // Use the original hardcoded template
        systemPrompt = `You are an expert system designer who creates document type schemas for a content management system. 
        You will receive a request from a user who needs a new document type defined. 
        Your job is to analyze the request and create a structured document type definition based on the request.
        
        First, provide a brief analysis of the request in plain text, including what you understand about:
        1. The purpose of this document type
        2. The key fields that will be needed
        3. Any special processing requirements
        
        Then, create a JSON object that defines the document type with all required fields. The schema must follow this structure:
        
        {
          "document_type": string, // A concise name for this document type
          "category": string, // One of these categories: "Research", "Communication", "Documentation", "Legal", or create a new appropriate category
          "description": string, // Detailed description of what this document type represents
          "mime_type": string | null, // Preferred MIME type, or null if not specific
          "file_extension": string | null, // Preferred file extension, or null if not specific
          "is_ai_generated": boolean, // Whether this document type was created via AI
          "required_fields": {
            // Define fields that must be present in this document type
            "field_name": "field_type", // Types can be: string, number, boolean, date, array
            // Add as many fields as needed
          },
          "validation_rules": {
            // Optional validation rules for fields
            "field_name": { 
              "required": boolean,
              "minLength": number, // for strings
              "maxLength": number, // for strings
              "min": number, // for numbers
              "max": number, // for numbers
              // Add other validation rules as needed
            }
          },
          "ai_processing_rules": {
            // Rules for AI processing of this document type
            "extractFields": [string], // List of fields to extract
            "confidenceThreshold": number, // Minimum confidence score (0-1)
            // Add other processing rules as needed
          }
        }
        
        Be creative but practical in your design. Include all fields that would be necessary for this document type.`;
        userMessage = `Please create a document type definition based on this request:\n\n${aiRequestPrompt}\n\nInclude realistic validation rules and AI processing rules that would be appropriate for this document type. Use existing document types for reference but do not duplicate them.`;
      }

      // Use Claude 3.7 Sonnet for processing
      const result = await processWithAI({
        systemPrompt,
        userMessage,
        temperature: 0,
        requireJsonOutput: false
      });
      
      // Parse the response to separate comments from JSON
      const response = result.trim();
      try {
        // Find the JSON part of the response (assumes JSON is at the end or between code blocks)
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) || 
                        response.match(/```\n([\s\S]*?)\n```/) || 
                        response.match(/({[\s\S]*})/);
                        
        if (jsonMatch && jsonMatch[1]) {
          // We found JSON in code blocks
          const jsonStr = jsonMatch[1].trim();
          // Validate it parses correctly
          JSON.parse(jsonStr);
          
          // Get the comments (everything before the JSON)
          const jsonIndex = response.indexOf(jsonMatch[0]);
          const comments = response.substring(0, jsonIndex).trim();
          
          setAiResponseJson(jsonStr);
          setEditedAiJson(jsonStr);
          setAiResponseComments(comments);
        } else {
          // Attempt to find JSON object in the text
          const lastBraceIndex = response.lastIndexOf('}');
          const firstBraceIndex = response.indexOf('{');
          
          if (firstBraceIndex !== -1 && lastBraceIndex !== -1) {
            const jsonPart = response.substring(firstBraceIndex, lastBraceIndex + 1);
            try {
              // Validate it parses correctly
              JSON.parse(jsonPart);
              
              const commentsPart = response.substring(0, firstBraceIndex).trim();
              
              setAiResponseJson(jsonPart);
              setEditedAiJson(jsonPart);
              setAiResponseComments(commentsPart);
            } catch (parseError) {
              // If we can't parse JSON, treat it all as comments
              setAiResponseComments(response);
              setAiResponseJson('');
              setEditedAiJson('');
              toast.warning('Could not extract valid JSON from AI response');
            }
          } else {
            // No JSON found, treat it all as comments
            setAiResponseComments(response);
            setAiResponseJson('');
            setEditedAiJson('');
            toast.warning('Could not extract valid JSON from AI response');
          }
        }
      } catch (error) {
        console.error('Error parsing AI response:', error);
        setAiResponseComments(response);
        setAiResponseJson('');
        setEditedAiJson('');
        toast.warning('Could not parse AI response format');
      }
      
      setAiRequestResponse(result);
      toast.success('AI request processed successfully');
    } catch (error) {
      console.error('AI request error:', error);
      toast.error('Failed to process AI request');
    } finally {
      setIsFormSubmitting(false);
    }
  };
  
  const handleAddProposedDocumentType = async () => {
    setIsFormSubmitting(true);
    try {
      // Validate the JSON
      if (!editedAiJson.trim()) {
        toast.error('No document type definition available');
        return;
      }
      
      let docTypeData;
      // Try to parse the JSON
      try {
        docTypeData = JSON.parse(editedAiJson);
      } catch (parseError) {
        toast.error('Invalid JSON format. Please check the document type definition.');
        console.error('JSON parse error:', parseError);
        return;
      }
      
      // Validate required fields
      if (!docTypeData.document_type || !docTypeData.category) {
        toast.error('Document type and category are required');
        return;
      }
      
      // Check if a document type with the same name already exists
      const { data: existingTypes, error: checkError } = await supabase
        .from("document_types")
        .select("id, document_type")
        .eq("document_type", docTypeData.document_type);
        
      if (checkError) {
        throw new Error(`Error checking existing document types: ${checkError.message}`);
      }
      
      if (existingTypes && existingTypes.length > 0) {
        toast.error(`Document type "${docTypeData.document_type}" already exists`);
        return;
      }
      
      // Create new document type
      const newId = crypto.randomUUID();
      
      const { error } = await supabase
        .from("document_types")
        .insert({
          id: newId,
          document_type: docTypeData.document_type,
          description: docTypeData.description || null,
          category: docTypeData.category,
          mime_type: docTypeData.mime_type || null,
          file_extension: docTypeData.file_extension || null,
          is_ai_generated: true,
          required_fields: docTypeData.required_fields || null,
          validation_rules: docTypeData.validation_rules || null,
          ai_processing_rules: docTypeData.ai_processing_rules || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      
      toast.success('AI-proposed document type created successfully');
      
      // Reset form and refresh data
      setIsAiRequesting(false);
      setAiRequestPrompt('');
      setAiResponseJson('');
      setAiResponseComments('');
      setEditedAiJson('');
      fetchDocumentTypesForManager();
      // Also update the main lists
      loadDocumentTypes();
      fetchDocumentStats();
    } catch (error) {
      console.error('Error saving AI-proposed document type:', error);
      toast.error('Failed to save document type: ' + (error.message || 'Invalid JSON'));
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document type?")) return;

    try {
      const { error } = await supabase
        .from("document_types")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Document type deleted successfully");
      fetchDocumentTypesForManager();
      // Also update the main list
      loadDocumentTypes();
      fetchDocumentStats();
    } catch (error) {
      console.error("Error deleting document type:", error);
      toast.error("Failed to delete document type");
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({
        ...formData,
        [name]: checked
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFormSubmitting(true);

    try {
      if (!formData.document_type || !formData.category) {
        toast.error("Document type and category are required");
        return;
      }

      if (selectedType) {
        // Update existing document type
        const { error } = await supabase
          .from("document_types")
          .update({
            document_type: formData.document_type,
            description: formData.description || null,
            category: formData.category,
            mime_type: formData.mime_type || null,
            file_extension: formData.file_extension || null,
            is_ai_generated: formData.is_ai_generated,
            updated_at: new Date().toISOString()
          })
          .eq("id", selectedType.id);

        if (error) throw error;
        toast.success("Document type updated successfully");
      } else {
        // Create new document type
        const newId = crypto.randomUUID();
        
        const { error } = await supabase
          .from("document_types")
          .insert({
            id: newId,
            document_type: formData.document_type,
            description: formData.description || null,
            category: formData.category,
            mime_type: formData.mime_type || null,
            file_extension: formData.file_extension || null,
            is_ai_generated: formData.is_ai_generated,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
        toast.success("Document type created successfully");
      }

      // Reset form and refresh data
      setIsEditing(false);
      setSelectedType(null);
      fetchDocumentTypesForManager();
      // Also update the main lists
      loadDocumentTypes();
      fetchDocumentStats();
    } catch (error) {
      console.error("Error saving document type:", error);
      toast.error("Failed to save document type");
    } finally {
      setIsFormSubmitting(false);
    }
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
      
      const typeId = crypto.randomUUID();
      console.log('Generated Presentation Announcement ID:', typeId);

      const { data, error } = await supabase
        .from('document_types')
        .insert({
          id: typeId,
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

      // Remove this ID from localStorage to ensure it shows as new
      localStorage.removeItem(`seen_doctype_${typeId}`);
      
      // Refresh the document types list and stats
      await loadDocumentTypes();
      fetchDocumentStats();
    } catch (error) {
      console.error('Error adding document type:', error);
      toast.error('Failed to add document type');
    }
  };

  // Function to extract content
  const extractContent = async () => {
    setLoading(true);
    setIsExtracting(true);
    extractionRef.current = true;
    
    try {
      // Check all unextracted DOCX and TXT files
      const { data: filesToProcess, error: queryError } = await supabase
        .from('sources_google')
        .select(`
          id, name, mime_type, drive_id, content_extracted, extracted_content
        `)
        .is('content_extracted', false)
        .in('mime_type', [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain'
        ])
        .order('created_at', { ascending: false });
      
      if (queryError) throw queryError;
      
      if (!filesToProcess?.length) {
        toast.success('No files needing content extraction');
        return;
      }
      
      toast.success(`Found ${filesToProcess.length} files to extract`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const file of filesToProcess) {
        if (!extractionRef.current) {
          console.log('Extraction stopped by user');
          break;
        }
        
        try {
          console.log(`Processing ${file.name}...`);
          
          let content = null;
          
          // Extract based on mime type
          if (file.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            content = await getDocxContent(file.drive_id);
          } else if (file.mime_type === 'text/plain') {
            content = await getTextFileContent(file.drive_id);
          }
          
          if (!content) {
            console.error(`No content extracted for ${file.name}`);
            failCount++;
            continue;
          }
          
          // Format content object based on type
          const contentObject = file.mime_type === 'text/plain' 
            ? content 
            : {
                text: content,
                metadata: {
                  extractedAt: new Date().toISOString(),
                  contentLength: content.length,
                  extractionMethod: file.mime_type.includes('wordprocessingml') ? 'mammoth' : 'direct'
                }
              };
          
          // Update the database
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({
              extracted_content: contentObject,
              content_extracted: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', file.id);
          
          if (updateError) throw updateError;
          
          successCount++;
          console.log(`Successfully extracted content for ${file.name}`);
          
        } catch (error) {
          console.error(`Error extracting ${file.name}:`, error);
          failCount++;
        }
      }
      
      toast.success(`Extracted ${successCount} files (${failCount} failed)`);
      
      // Update stats after extraction
      fetchDocumentStats();
      fetchPipelineStats();
      
    } catch (error) {
      console.error('Content extraction error:', error);
      toast.error('Failed to extract content');
    } finally {
      setLoading(false);
      setIsExtracting(false);
    }
  };

  // Stop extraction
  const stopExtraction = () => {
    extractionRef.current = false;
    toast.success('Stopping extraction process...');
  };

  // Classify documents function
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

      // Load all documents with extracted content but no document type
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
        .is('document_type_id', null)
        .order('created_at', { ascending: false });

      if (sourceError) throw sourceError;
      
      if (!sourceDocuments?.length) {
        toast.success('No unclassified documents found');
        return;
      }

      console.log(`Found ${sourceDocuments.length} documents to classify`);
      
      let successCount = 0;
      let failCount = 0;
      const presentationCount = 0;
      const results = [];

      // Process each document
      for (const doc of sourceDocuments) {
        try {
          console.log(`Processing: ${doc.name}`);
          
          // Prepare content for AI processing
          const content = typeof doc.extracted_content === 'string' ? 
            doc.extracted_content : 
            doc.extracted_content?.text || JSON.stringify(doc.extracted_content);
          
          if (!content) {
            console.warn(`No content found for ${doc.name}`);
            failCount++;
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
                content: content.slice(0, 15000)
              }
            }),
            temperature: 0,
            requireJsonOutput: true,
            validateResponse: (response) => {
              const parsed = ClassificationResponseSchema.safeParse(response);
              if (!parsed.success) {
                throw new Error(`Invalid response format: ${parsed.error.message}`);
              }
              
              // Validate document type
              const suggestedType = parsed.data.documentType;
              const matchingTypeByName = documentTypes.find(dt => dt.document_type === suggestedType);
              
              // If we have a name match but wrong ID, use the correct ID
              if (matchingTypeByName) {
                console.log('Found type name match, correcting ID:', {
                  suggestedType,
                  correctId: matchingTypeByName.id 
                });
                parsed.data.typeId = matchingTypeByName.id;
              } else if (!documentTypes.some(dt => dt.id === parsed.data.typeId)) {
                // Fall back to general type if no match
                const fallbackType = documentTypes.find(dt => dt.document_type === 'General Document') || documentTypes[0];
                if (fallbackType) {
                  console.log('Using fallback document type:', fallbackType.document_type);
                  parsed.data.typeId = fallbackType.id;
                  parsed.data.documentType = fallbackType.document_type;
                } else {
                  throw new Error('Invalid document type ID and no fallback available');
                }
              }
              
              return parsed.data;
            }
          });

          // Update the document with classification results
          const { error: updateError } = await supabase
            .from('sources_google')
            .update({
              document_type_id: result.typeId,
              updated_at: new Date().toISOString(),
              metadata: {
                ...doc.metadata,
                classification: {
                  confidence: result.confidence,
                  reasoning: result.reasoning,
                  classified_at: new Date().toISOString()
                }
              }
            })
            .eq('id', doc.id);

          if (updateError) throw updateError;
          
          successCount++;
          results.push({
            fileName: doc.name,
            documentType: result.documentType,
            typeId: result.typeId,
            confidence: result.confidence
          });
          
          console.log(`Classified ${doc.name} as ${result.documentType}`);
          
        } catch (error) {
          console.error(`Failed to classify ${doc.name}:`, error);
          failCount++;
        }
      }
      
      // Update display
      toast.success(`Classified ${successCount} documents (${failCount} failed)`);
      
      // Update stats after classification
      fetchDocumentStats();
      fetchPipelineStats();
      
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Failed to classify documents');
    } finally {
      setLoading(false);
    }
  };

  // Transfer to expert documents
  const transferToExpertDocuments = async () => {
    setLoading(true);
    try {
      const daysAgo = 30; // Only transfer documents from the last 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      
      // Query sources_google for documents with content and document type
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
        .gte('updated_at', cutoffDate.toISOString())
        .not('extracted_content', 'is', null)
        .not('document_type_id', 'is', null);

      if (sourceError) throw sourceError;
      
      if (!sourceDocs?.length) {
        toast.success('No documents found to transfer');
        return;
      }

      // Check which docs already exist in expert_documents
      const { data: existingDocs, error: existingError } = await supabase
        .from('expert_documents')
        .select('source_id');
      
      if (existingError) throw existingError;
      
      // Create a set of existing source_ids for quick lookup
      const existingSourceIds = new Set(existingDocs?.map(doc => doc.source_id) || []);
      
      // Filter to docs that don't already exist
      const docsToTransfer = sourceDocs.filter(doc => !existingSourceIds.has(doc.id));
      
      if (!docsToTransfer.length) {
        toast.success('All documents are already transferred');
        return;
      }
      
      console.log(`Found ${docsToTransfer.length} documents to transfer`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const doc of docsToTransfer) {
        try {
          // Extract and clean content
          let rawContent;
          if (typeof doc.extracted_content === 'string') {
            rawContent = cleanContent(doc.extracted_content);
          } else if (doc.extracted_content?.text) {
            rawContent = cleanContent(doc.extracted_content.text);
          } else {
            console.warn(`Invalid content format for ${doc.name}`);
            failCount++;
            continue;
          }

          // Create insert data
          const now = new Date().toISOString();
          const insertData = {
            raw_content: rawContent,
            document_type_id: doc.document_type_id,
            source_id: doc.id,
            created_at: now,
            updated_at: now,
            processed_content: {
              title: doc.name,
              content: rawContent,
              source: {
                drive_id: doc.drive_id,
                mime_type: doc.mime_type
              }
            },
            processing_status: 'pending' as const,
            word_count: rawContent.split(/\\s+/).length || null,
            language: 'en',
            confidence_score: doc.metadata?.classification?.confidence || null,
            key_insights: [],
            topics: [],
          };

          // Insert the record
          const { error: insertError } = await supabase
            .from('expert_documents')
            .insert(insertData);

          if (insertError) throw insertError;
          
          successCount++;
          console.log(`Transferred ${doc.name}`);
          
        } catch (error) {
          console.error(`Failed to transfer ${doc.name}:`, error);
          failCount++;
        }
      }
      
      toast.success(`Transferred ${successCount} documents (${failCount} failed)`);
      
      // Update stats
      fetchDocumentStats();
      fetchPipelineStats();
      
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error('Failed to transfer documents');
    } finally {
      setLoading(false);
    }
  };

  // Process expert documents based on their type
  const processExpertDocuments = async () => {
    setLoading(true);
    try {
      // Get unprocessed presentation announcements
      const { data: presentations, error: presentationsError } = await supabase
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
        .eq('processing_status', 'pending');
      
      if (presentationsError) throw presentationsError;
      
      if (!presentations?.length) {
        toast.success('No unprocessed presentation announcements found');
        return;
      }
      
      console.log(`Found ${presentations.length} presentation announcements to process`);
      
      // Load expert extraction prompt
      const promptResponse = await fetch('/docs/prompts/expert-extraction-prompt.md');
      if (!promptResponse.ok) {
        throw new Error(`Failed to load prompt: ${promptResponse.status}`);
      }
      const prompt = await promptResponse.text();
      
      let successCount = 0;
      let failCount = 0;
      
      for (const doc of presentations) {
        try {
          console.log(`Processing: ${doc.sources_google?.name}`);
          
          if (!doc.raw_content) {
            console.warn(`No content for ${doc.id}`);
            failCount++;
            continue;
          }
          
          // Process with AI
          const result = await processWithAI({
            systemPrompt: prompt + `
\\nIMPORTANT: Your response must be ONLY a valid JSON object. Do not include any text before or after the JSON.
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
}`,
            userMessage: doc.raw_content,
            requireJsonOutput: true,
            validateResponse: validateExpertProfile
          });
          
          // Update the document
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
          
          successCount++;
          console.log(`Successfully processed ${doc.sources_google?.name}`);
          
        } catch (error) {
          console.error(`Failed to process ${doc.id}:`, error);
          failCount++;
        }
      }
      
      toast.success(`Processed ${successCount} presentations (${failCount} failed)`);
      
      // Update stats
      fetchDocumentStats();
      fetchPipelineStats();
      
    } catch (error) {
      console.error('Processing error:', error);
      toast.error('Failed to process expert documents');
    } finally {
      setLoading(false);
    }
  };


  // Render the pipeline section
  const renderPipeline = () => (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Processing Pipeline</h2>
      
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
          <div className="text-sm text-gray-500 mb-1">Documents Awaiting Extraction</div>
          <div className="text-2xl font-bold">{pipelineStats.pendingExtraction}</div>
          <button 
            className="mt-2 text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md"
            onClick={extractContent}
            disabled={loading || isExtracting}
          >
            {isExtracting ? 'Extracting...' : 'Extract Content'}
          </button>
        </div>
        
        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="text-sm text-gray-500 mb-1">Unclassified Documents</div>
          <div className="text-2xl font-bold">{pipelineStats.unclassifiedDocuments}</div>
          <button 
            className="mt-2 text-sm bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md"
            onClick={classifyDocuments}
            disabled={loading}
          >
            Classify Documents
          </button>
        </div>
        
        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
          <div className="text-sm text-gray-500 mb-1">Awaiting Transfer</div>
          <div className="text-2xl font-bold">{pipelineStats.unclassifiedDocuments === 0 ? documentStats.byMimeType?.docx?.classified || 0 : '⏳'}</div>
          <button 
            className="mt-2 text-sm bg-purple-100 hover:bg-purple-200 text-purple-800 px-3 py-1 rounded-md"
            onClick={transferToExpertDocuments}
            disabled={loading}
          >
            Transfer Documents
          </button>
        </div>
        
        <div className="flex-1 min-w-[200px] bg-white p-4 rounded-lg shadow-sm border-l-4 border-amber-500">
          <div className="text-sm text-gray-500 mb-1">Pending AI Processing</div>
          <div className="text-2xl font-bold">{pipelineStats.pendingAiProcessing}</div>
          <button 
            className="mt-2 text-sm bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-md"
            onClick={processExpertDocuments}
            disabled={loading}
          >
            Process with AI
          </button>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Processing Progress</h3>
        <button
          onClick={() => {
            fetchDocumentStats();
            fetchPipelineStats();
          }}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded flex items-center gap-1"
        >
          <span>🔄</span> Refresh
        </button>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
        <div 
          className="bg-blue-600 h-4 rounded-full transition-all duration-500"
          style={{ 
            width: `${Math.min(100, Math.round(
              pipelineStats.completedDocuments / 
              (pipelineStats.completedDocuments + pipelineStats.pendingAiProcessing) * 100
            ) || 0)}%` 
          }}
        ></div>
      </div>
      <div className="text-sm text-gray-500">
        {pipelineStats.completedDocuments} of {pipelineStats.completedDocuments + pipelineStats.pendingAiProcessing} documents fully processed
      </div>
    </div>
  );

  // Render document statistics
  const renderDocumentStats = () => (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Document Statistics</h2>
        <button
          onClick={fetchDocumentStats}
          className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded flex items-center gap-1"
        >
          <span>🔄</span> Refresh Stats
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(documentStats.byMimeType).map(([mimeType, stats]) => (
          <div key={mimeType} className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="font-bold text-lg capitalize mb-2">
              {mimeType === 'docx' ? 'Word Documents' : 
               mimeType === 'text' ? 'Text Files' :
               mimeType === 'pdf' ? 'PDF Documents' : mimeType}
            </h3>
            
            <div className="flex items-center mb-2">
              <div className="text-sm font-medium">Total: {stats.total}</div>
              <div className="mx-2">|</div>
              <div className="text-sm font-medium">
                Classified: {stats.classified} 
                <span className="text-xs ml-1 text-gray-500">
                  ({stats.total > 0 ? (stats.classified / stats.total * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-blue-600 h-2 rounded-full"
                style={{ width: `${stats.total > 0 ? stats.classified / stats.total * 100 : 0}%` }}
              ></div>
            </div>
            
            {Object.entries(stats.byType).length > 0 && (
              <div>
                <div className="text-sm font-medium mb-1">Document Types:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(stats.byType)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([type, count]) => (
                      <div key={type} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {type} ({count})
                      </div>
                    ))}
                  {Object.entries(stats.byType).length > 5 && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      +{Object.entries(stats.byType).length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <h3 className="text-lg font-medium mb-3">Expert Document Processing</h3>
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
        <div className="flex items-center mb-3">
          <div className="text-sm font-medium">Total: {documentStats.expertDocuments.total}</div>
          <div className="mx-2">|</div>
          <div className="text-sm font-medium">
            Completed: {documentStats.expertDocuments.byStatus.completed || 0}
            <span className="text-xs ml-1 text-gray-500">
              ({documentStats.expertDocuments.total > 0 ? 
                Math.round((documentStats.expertDocuments.byStatus.completed || 0) / documentStats.expertDocuments.total * 100) : 0}%)
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {Object.entries(documentStats.expertDocuments.byStatus).map(([status, count]) => (
            <div key={status} className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-500 mb-1 capitalize">{status}</div>
              <div className="text-xl font-semibold">{count}</div>
            </div>
          ))}
        </div>
        
        {Object.keys(documentStats.expertDocuments.byType).length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium mb-2">By Document Type:</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(documentStats.expertDocuments.byType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    {type} ({count})
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // State for sorting - moved outside render function to follow React Hook rules
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'ascending' | 'descending';
  } | null>(null);

  // Sorting function
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === 'ascending'
    ) {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Apply sorting to document types
  const sortedDocumentTypes = React.useMemo(() => {
    let sortableItems = [...filteredDocumentTypes];
    if (sortConfig !== null) {
      sortableItems.sort((a: any, b: any) => {
        // Handle null values
        const aValue = a[sortConfig.key] ?? '';
        const bValue = b[sortConfig.key] ?? '';
        
        // Special handling for count which is numeric
        if (sortConfig.key === 'count') {
          return sortConfig.direction === 'ascending'
            ? (a.count || 0) - (b.count || 0)
            : (b.count || 0) - (a.count || 0);
        }
        
        // Handle boolean values
        if (typeof aValue === 'boolean') {
          return sortConfig.direction === 'ascending'
            ? aValue === bValue ? 0 : aValue ? -1 : 1
            : aValue === bValue ? 0 : aValue ? 1 : -1;
        }
        
        // String comparison for other values
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredDocumentTypes, sortConfig]);

  // Helper for sort indicator
  const getSortDirectionIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortConfig.direction === 'ascending' ? 
      <span className="text-blue-600 ml-1">↑</span> : 
      <span className="text-blue-600 ml-1">↓</span>;
  };

  // Form UI for adding/editing document types
  const renderForm = () => (
    <div className="bg-white p-5 rounded-lg shadow mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">
          {selectedType ? "Edit Document Type" : "Add New Document Type"}
        </h3>
        <button
          onClick={() => setIsEditing(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Document Type *</label>
          <input
            type="text"
            name="document_type"
            value={formData.document_type}
            onChange={handleFormChange}
            className="w-full px-3 py-2 border rounded-md"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Category *</label>
          <select
            name="category"
            value={formData.category || ''}
            onChange={handleFormChange}
            className="w-full px-3 py-2 border rounded-md appearance-none"
            required
          >
            <option value="" disabled>Select a category</option>
            {formCategories && formCategories.length > 0 ? (
              formCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))
            ) : (
              <option value="" disabled>Loading categories...</option>
            )}
            <option value="new">-- Enter new category --</option>
          </select>
          
          {formData.category === 'new' && (
            <input
              type="text"
              name="category"
              placeholder="Enter new category name"
              className="w-full px-3 py-2 border rounded-md mt-2"
              onChange={handleFormChange}
              required
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleFormChange}
            className="w-full px-3 py-2 border rounded-md"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">MIME Type</label>
            <select
              name="mime_type"
              value={formData.mime_type}
              onChange={handleFormChange}
              className="w-full px-3 py-2 border rounded-md appearance-none"
            >
              <option value="">Select a MIME type (optional)</option>
              {formMimeTypes.map((mimeType) => (
                <option key={mimeType} value={mimeType}>
                  {mimeType}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">File Extension</label>
            <input
              type="text"
              name="file_extension"
              value={formData.file_extension}
              onChange={handleFormChange}
              placeholder=".pdf, .doc, .txt, etc."
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4">
          <input
            type="checkbox"
            id="is_ai_generated"
            name="is_ai_generated"
            checked={formData.is_ai_generated}
            onChange={(e) => setFormData({...formData, is_ai_generated: e.target.checked})}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="is_ai_generated" className="text-sm font-medium text-gray-700">
            AI Generated
          </label>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md mr-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
            disabled={isFormSubmitting}
          >
            {isFormSubmitting ? 'Saving...' : selectedType ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );

  // Render document types section
  const renderDocumentTypes = () => {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Document Types</h2>
          
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await loadDocumentTypes();
                fetchDocumentStats();
              }}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded flex items-center gap-1"
            >
              <span>🔄</span> Refresh
            </button>
            <button
              onClick={handleAddNewClick}
              className="flex items-center gap-2 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-2 rounded"
            >
              <PlusCircle size={16} />
              Add New Type
            </button>
            <button
              onClick={handleAiRequestClick}
              className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded"
            >
              <PlusCircle size={16} />
              AI Request
            </button>
          </div>
        </div>
        
        {/* Display the form when isEditing is true */}
        {isEditing && renderForm()}
        
        {/* Display the AI Request form when isAiRequesting is true */}
        {isAiRequesting && (
          <div className="bg-white p-5 rounded-lg shadow mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Generate Document Type with AI
              </h3>
              <button
                onClick={() => setIsAiRequesting(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Step 1: Request Input */}
              <div className="border-b pb-4">
                <label className="block text-sm font-medium mb-2">Describe the document type you need:</label>
                <textarea
                  value={aiRequestPrompt}
                  onChange={(e) => setAiRequestPrompt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md h-32"
                  placeholder="Example: I need a document type for financial reports that include quarterly revenue, expenses, and profit margins. The document should track financial metrics and allow for year-over-year comparisons."
                  disabled={!!aiResponseJson}
                />
                {!aiResponseJson && (
                  <button
                    onClick={handleSubmitAiRequest}
                    disabled={isFormSubmitting || !aiRequestPrompt.trim()}
                    className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                  >
                    {isFormSubmitting ? 'Processing...' : 'Submit Request to AI'}
                  </button>
                )}
                
                {/* Display result visualization if we're processing */}
                {isFormSubmitting && !aiResponseJson && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800 font-medium">⏳ Processing with Claude 3.7...</p>
                    <p className="text-xs text-blue-600">This may take up to 30 seconds</p>
                  </div>
                )}
              </div>
              
              {/* Step 2: AI Response */}
              {aiResponseComments && (
                <div className="border-b pb-4">
                  <h4 className="font-medium mb-2">AI Analysis:</h4>
                  <div className="bg-gray-50 p-4 rounded text-sm whitespace-pre-line">
                    {aiResponseComments}
                  </div>
                </div>
              )}
              
              {/* Step 3: JSON Output */}
              {aiResponseJson && (
                <div className="border-b pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Proposed Document Type Definition:</h4>
                    <span className="text-sm px-2 py-1 bg-green-100 text-green-800 rounded">✅ Ready for review</span>
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    Review and edit the JSON below if needed:
                  </div>
                  <textarea
                    value={editedAiJson}
                    onChange={(e) => setEditedAiJson(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md h-80 font-mono text-sm"
                  />
                </div>
              )}
              
              {/* Step 4: Final Action */}
              {aiResponseJson && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setIsAiRequesting(false);
                      setAiRequestPrompt('');
                      setAiResponseJson('');
                      setAiResponseComments('');
                      setEditedAiJson('');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md mr-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddProposedDocumentType}
                    disabled={isFormSubmitting || !editedAiJson.trim()}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md"
                  >
                    {isFormSubmitting ? 'Adding...' : 'Add Proposed Document Type'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium">Filter by Category:</div>
            <button
              onClick={() => {
                // Create JSON of filtered document types
                const categoryName = selectedCategory === 'all' ? 'All Categories' : selectedCategory;
                const jsonData = JSON.stringify(filteredDocumentTypes, null, 2);
                // Copy to clipboard
                navigator.clipboard.writeText(jsonData)
                  .then(() => toast.success(`Copied ${filteredDocumentTypes.length} ${categoryName} document types as JSON`))
                  .catch(err => toast.error('Failed to copy JSON: ' + err.message));
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
              title="Copy document types as JSON"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy {selectedCategory === 'all' ? 'All' : selectedCategory} as JSON
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded text-sm font-medium ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                {category === 'all' ? 'All Categories' : category}
              </button>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('document_type')}
                >
                  <div className="flex items-center">
                    Document Type {getSortDirectionIcon('document_type')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('category')}
                >
                  <div className="flex items-center">
                    Category {getSortDirectionIcon('category')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('description')}
                >
                  <div className="flex items-center">
                    Description {getSortDirectionIcon('description')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('mime_type')}
                >
                  <div className="flex items-center">
                    MIME Type {getSortDirectionIcon('mime_type')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('file_extension')}
                >
                  <div className="flex items-center">
                    File Extension {getSortDirectionIcon('file_extension')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('is_ai_generated')}
                >
                  <div className="flex items-center justify-center">
                    AI Generated {getSortDirectionIcon('is_ai_generated')}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => requestSort('count')}
                >
                  <div className="flex items-center justify-center">
                    Usage Count {getSortDirectionIcon('count')}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDocumentTypes.length > 0 ? (
                sortedDocumentTypes.map((type) => {
                  return (
                    <tr key={type.id} className={type.isNew ? "bg-yellow-50" : ""}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {type.document_type}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {type.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs overflow-hidden text-ellipsis">
                        {type.description || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] overflow-hidden text-ellipsis">
                        {type.mime_type || ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {type.file_extension || ''}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                        {type.is_ai_generated ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-center">
                        {type.count}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {type.isNew ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            New
                          </span>
                        ) : type.count > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            In Use
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Unused
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditClick(type)}
                            className="text-blue-600 hover:text-blue-900 bg-blue-100 hover:bg-blue-200 p-1 rounded"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(type.id)}
                            className="text-red-600 hover:text-red-900 bg-red-100 hover:bg-red-200 p-1 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-center text-sm text-gray-500">
                    No document types found in this category.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Document Classification Dashboard</h1>
        {loading && <span className="text-gray-500">Working...</span>}
      </div>
      
      {isAuthenticated ? (
        <>
          {/* Tabs Navigation */}
          <div className="mb-8 border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
                  activeTab === 'dashboard'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveTab('document-types')}
                className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
                  activeTab === 'document-types'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Document Types
              </button>
              <button
                onClick={() => setActiveTab('utilities')}
                className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
                  activeTab === 'utilities'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Utilities
              </button>
              <button
                onClick={() => setActiveTab('results')}
                className={`mr-4 py-2 px-1 font-medium text-sm border-b-2 ${
                  activeTab === 'results'
                    ? 'text-blue-600 border-blue-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Results
              </button>
            </nav>
          </div>
          
          {/* Tab Content */}
          <div>
            {activeTab === 'dashboard' && (
              <div>
                {renderPipeline()}
                {renderDocumentStats()}
              </div>
            )}
            
            {activeTab === 'document-types' && renderDocumentTypes()}
            
            
            {activeTab === 'utilities' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-semibold mb-4">Quick Setup Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="font-medium mb-2">Add Common Document Types</h3>
                      <p className="text-sm text-gray-600 mb-3">Add standard document types to your collection</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={addPresentationAnnouncementType}
                          className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md text-sm"
                        >
                          Add Presentation Type
                        </button>
                        
                        <button
                          onClick={async () => {
                            // Check if "Chat Log" already exists
                            const documentTypes = await loadDocumentTypes();
                            const chatLogExists = documentTypes?.some(dt => dt.document_type === 'Chat Log');
                            
                            if (chatLogExists) {
                              toast.success('Chat Log document type already exists');
                              return;
                            }
                            
                            try {
                              const chatLogId = crypto.randomUUID();
                              console.log('Generated Chat Log ID:', chatLogId);
                              
                              const { data, error } = await supabase
                                .from('document_types')
                                .insert({
                                  id: chatLogId,
                                  document_type: 'Chat Log',
                                  category: 'Communication',
                                  description: 'Chat conversations, messaging logs, or text-based discussions between multiple participants',
                                  created_at: new Date().toISOString(),
                                  updated_at: new Date().toISOString(),
                                  is_ai_generated: false,
                                  required_fields: {
                                    participants: 'array',
                                    timestamp: 'date',
                                    content: 'string'
                                  },
                                  validation_rules: {
                                    content: { required: true }
                                  },
                                  ai_processing_rules: {
                                    extractFields: ['participants', 'topics', 'key_points'],
                                    confidenceThreshold: 0.7
                                  }
                                })
                                .select();
                                
                              if (error) throw error;
                              toast.success('Added Chat Log document type');
                              console.log('New document type:', data[0]);
                              
                              // Remove this ID from localStorage to ensure it shows as new
                              localStorage.removeItem(`seen_doctype_${chatLogId}`);
                              
                              // Refresh document types and stats
                              await loadDocumentTypes();
                              fetchDocumentStats();
                            } catch (error) {
                              console.error('Error adding document type:', error);
                              toast.error('Failed to add Chat Log document type');
                            }
                          }}
                          className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md text-sm"
                        >
                          Add Chat Log Type
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <h3 className="font-medium mb-2">Run Automated Processing</h3>
                      <p className="text-sm text-gray-600 mb-3">Automatically process all pending documents</p>
                      <button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            toast.success('Starting automated processing...');
                            
                            // 1. Extract content
                            await extractContent();
                            
                            // 2. Classify documents
                            await classifyDocuments();
                            
                            // 3. Transfer to expert documents
                            await transferToExpertDocuments();
                            
                            // 4. Process with AI
                            await processExpertDocuments();
                            
                            // 5. Update stats
                            fetchDocumentStats();
                            fetchPipelineStats();
                            
                            toast.success('Automated processing complete!');
                          } catch (error) {
                            console.error('Automated processing error:', error);
                            toast.error('Automated processing failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
                        disabled={loading}
                      >
                        {loading ? 'Processing...' : 'Run Full Pipeline'}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold mb-4">Pipeline Tool</h2>
                  <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex flex-wrap gap-4 justify-between">
                      <div className="w-full md:w-auto space-y-2">
                        <h3 className="font-medium">Content Extraction</h3>
                        <div className="flex gap-2">
                          <button 
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm"
                            onClick={extractContent}
                            disabled={loading || isExtracting}
                          >
                            {isExtracting ? 'Extracting...' : 'Extract Content'}
                          </button>
                          
                          {isExtracting && (
                            <button
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded text-sm"
                              onClick={stopExtraction}
                            >
                              Stop Extraction
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="w-full md:w-auto space-y-2">
                        <h3 className="font-medium">Document Classification</h3>
                        <button 
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded text-sm"
                          onClick={classifyDocuments}
                          disabled={loading}
                        >
                          Classify Documents
                        </button>
                      </div>
                      
                      <div className="w-full md:w-auto space-y-2">
                        <h3 className="font-medium">Expert Documents</h3>
                        <div className="flex gap-2">
                          <button 
                            className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded text-sm"
                            onClick={transferToExpertDocuments}
                            disabled={loading}
                          >
                            Transfer Documents
                          </button>
                          
                          <button 
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded text-sm"
                            onClick={processExpertDocuments}
                            disabled={loading}
                          >
                            Process Expert Documents
                          </button>
                        </div>
                      </div>
                      
                      <div className="w-full md:w-auto space-y-2">
                        <h3 className="font-medium">Statistics</h3>
                        <button 
                          className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
                          onClick={() => {
                            fetchDocumentStats();
                            fetchPipelineStats();
                          }}
                          disabled={loading}
                        >
                          Refresh All Stats
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'results' && (
              <div>
                {classificationResults ? (
                  <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">Classification Results</h2>
                      <button
                        onClick={() => {
                          const blob = new Blob([classificationResults], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `classification-results-${new Date().toISOString()}.md`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded text-sm flex items-center gap-1"
                      >
                        <span>📥</span> Download
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm overflow-auto max-h-[60vh] bg-gray-50 p-4 rounded">
                      {classificationResults}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">Run a classification or processing operation to see results here</p>
                    <button
                      onClick={() => setActiveTab('utilities')}
                      className="mt-4 bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2 rounded"
                    >
                      Go to Utilities
                    </button>
                  </div>
                )}
                
                {todaysClassifications.length > 0 && (
                  <div className="mt-8">
                    <h2 className="text-xl font-semibold mb-4">Today's Classifications</h2>
                    <div className="bg-white rounded-lg shadow-sm p-4">
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
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <div className="text-center">
            <div className="text-gray-500 mb-2">
              {loading ? 'Authenticating...' : 'Not authenticated.'}
            </div>
            {!loading && (
              <button
                onClick={ensureAuth}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassifyDocument;