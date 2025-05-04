import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PromptFile, getPromptFiles, loadPromptContent as fetchPromptContent, savePromptContent, createPromptFile, generatePromptWithContext, applyPromptToFiles as applyPrompt } from '@/utils/prompt-manager';
import { toast } from 'react-hot-toast';
import { SupabaseClientService, getSupabaseClient, initializeSupabase } from '@/integrations/supabase/client';

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  mime_type: string | null;
  category: string;
}

interface PromptCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DatabasePrompt {
  id: string;
  name: string;
  description: string | null;
  content: string;
  metadata: {
    hash: string;
    source: {
      fileName: string;
      createdAt: string;
      gitInfo?: {
        branch: string;
        commitId: string;
      };
    };
    aiEngine: {
      model: string;
      temperature: number;
      maxTokens: number;
    };
    usage: {
      inputSchema: any;
      outputSchema: any;
    };
    function: {
      purpose: string;
      successCriteria: string;
      dependencies: string[];
      estimatedCost: string;
    };
    relatedAssets?: string[]; // Array of related asset IDs
    databaseQuery?: string; // SQL query for database retrieval
    databaseQuery2?: string; // Second SQL query for database retrieval
    packageJsonFiles?: any[]; // Package.json files with relationship settings
  };
  document_type_id: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
  version: string;
  status: 'draft' | 'active' | 'deprecated' | 'archived';
  author: string | null;
  tags: string[];
  file_path: string | null;
}

interface DocumentationFile {
  id: string;
  file_path: string;
  title: string;
  metadata?: {
    file_size?: number; // Changed from size to file_size
    size?: number; // Kept for backwards compatibility
    created?: string;
    modified?: string;
    isPrompt?: boolean;
  };
  last_modified_at?: string;
  created_at: string;
  updated_at: string;
  document_type_id?: string | null;
  status_recommendation?: string | null;
}

const AI: React.FC = () => {
  const [activeTab, setActiveTab] = useState('prompts');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [promptFiles, setPromptFiles] = useState<PromptFile[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [promptCategories, setPromptCategories] = useState<PromptCategory[]>([]);
  const [databasePrompts, setDatabasePrompts] = useState<DatabasePrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [selectedDbPrompt, setSelectedDbPrompt] = useState<DatabasePrompt | null>(null);
  const [promptContent, setPromptContent] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0);
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [newPromptName, setNewPromptName] = useState<string>('');
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDescription, setNewCategoryDescription] = useState<string>('');
  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState<boolean>(false);
  const [showRelationshipsDialog, setShowRelationshipsDialog] = useState<boolean>(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [documentationFiles, setDocumentationFiles] = useState<DocumentationFile[]>([]);
  const [selectedRelationshipPrompt, setSelectedRelationshipPrompt] = useState<DatabasePrompt | null>(null);
  const [selectedRelatedAssets, setSelectedRelatedAssets] = useState<string[]>([]);
  const [relationshipsFilter, setRelationshipsFilter] = useState<string>('');
  const [relationshipType, setRelationshipType] = useState<string>('reference');
  const [relationshipContext, setRelationshipContext] = useState<string>('');
  const [relationshipDescription, setRelationshipDescription] = useState<string>('');
  const [relationshipDocumentTypeId, setRelationshipDocumentTypeId] = useState<string>('none');
  const [selectedPromptForView, setSelectedPromptForView] = useState<string | null>(null);
  const [promptRelationshipsMap, setPromptRelationshipsMap] = useState<Record<string, DocumentationFile[]>>({});
  const [databaseQuery, setDatabaseQuery] = useState<string>('');
  const [databaseQuery2, setDatabaseQuery2] = useState<string>('');
  // New state for storing individual asset relationship settings
  const [assetRelationshipSettings, setAssetRelationshipSettings] = useState<Record<string, {
    relationship_type: string;
    relationship_context: string;
    description: string;
    document_type_id: string;
  }>>({});
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({
    loadingPrompts: false,
    savingPrompt: false,
    generatingPrompt: false,
    applyingPrompt: false,
    loadingDbPrompts: false,
    savingDbPrompt: false,
    importingPrompt: false,
    creatingCategory: false,
    loadingDocFiles: false,
    savingRelationships: false
  });
  
  // Check for online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success('Connection restored. Reloading data...');
      
      // Initialize auth first
      try {
        const authSuccess = await initializeSupabase();
        if (!authSuccess) {
          toast.error('Authentication failed. Some features may be unavailable.');
          return;
        }
        
        // Reload data when connection is restored
        await Promise.all([
          loadPromptFiles(),
          loadDocumentTypes(),
          loadPromptCategories(),
          loadDatabasePrompts(),
          loadDocumentationFiles()
        ]);
      } catch (error) {
        console.error('Error reloading data after reconnect:', error);
        toast.error('Failed to reload data after reconnection.');
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are currently offline. Some features may be unavailable.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load from localStorage on component mount
  useEffect(() => {
    const savedTemperature = localStorage.getItem('claude-temperature');
    if (savedTemperature) {
      setTemperature(parseFloat(savedTemperature));
    }
    
    const savedApiKey = localStorage.getItem('claude-api-key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
    
    // Initialize Supabase and load data
    async function initializeData() {
      try {
        // Initialize Supabase auth before loading any data
        const authSuccess = await initializeSupabase();
        if (!authSuccess) {
          toast.error('Authentication failed. Some features may be unavailable.');
        }
        
        // Check if online before loading data
        if (navigator.onLine) {
          await Promise.all([
            loadPromptFiles(),
            loadDocumentTypes(),
            loadPromptCategories(),
            loadDatabasePrompts(),
            loadDocumentationFiles()
          ]);
        } else {
          // If offline, show a message and load fallback data
          toast.error('You are currently offline. Some features may be unavailable.');
          loadPromptFiles(); // This might still work if it uses local storage
          loadDocumentTypes(); // This has fallback data
          setPromptCategories([]);
          setDatabasePrompts([]);
          setDocumentationFiles([]);
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        toast.error('Failed to load data. Please try again later.');
      }
    }
    
    initializeData();
  }, []);
  
  // Load documentation files from the database
  const loadDocumentationFiles = async () => {
    setIsLoading(prev => ({ ...prev, loadingDocFiles: true }));
    
    // Function to get package.json files
    const findPackageJsonFiles = async () => {
      try {
        // This is a simplification - in a real implementation, you would
        // scan the filesystem for package.json files or use an API
        // Using proper UUID format for the ids
        const packageFiles = [
          {
            id: "00000000-0000-4000-a000-000000000001",
            file_path: "/package.json",
            title: "Root package.json",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
            metadata: { isPackageJson: true }
          },
          {
            id: "00000000-0000-4000-a000-000000000002",
            file_path: "/apps/dhg-a/package.json",
            title: "dhg-a package.json",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
            metadata: { isPackageJson: true }
          },
          {
            id: "00000000-0000-4000-a000-000000000003",
            file_path: "/apps/dhg-b/package.json",
            title: "dhg-b package.json",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
            metadata: { isPackageJson: true }
          },
          {
            id: "00000000-0000-4000-a000-000000000004",
            file_path: "/apps/dhg-hub-lovable/package.json",
            title: "dhg-hub-lovable package.json",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
            metadata: { isPackageJson: true }
          },
          {
            id: "00000000-0000-4000-a000-000000000005",
            file_path: "/apps/dhg-improve-experts/package.json",
            title: "dhg-improve-experts package.json",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
            metadata: { isPackageJson: true }
          }
        ];
        return packageFiles;
      } catch (error) {
        console.error("Error finding package.json files:", error);
        return [];
      }
    };
    
    try {
      // Get supabase client from service
      const supabase = getSupabaseClient();
      
      // Modified to remove the is_deleted filter which was removed from the table
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .order('last_modified_at', { ascending: false });
        
      if (error) {
        // Handle authentication errors
        if (error.code === '401' || error.message?.includes('JWT')) {
          // Try to re-authenticate
          const authSuccess = await initializeSupabase();
          if (!authSuccess) {
            throw new Error('Authentication failed. Please refresh the page and try again.');
          }
          
          // Retry the query after successful authentication
          const { data: retryData, error: retryError } = await supabase
            .from('documentation_files')
            .select('*')
            .order('last_modified_at', { ascending: false });
            
          if (retryError) throw retryError;
          
          if (retryData) {
            // Continue with the retry data
            const packageFiles = await findPackageJsonFiles();
            const combinedFiles = [...(retryData || []), ...packageFiles];
            
            setDocumentationFiles(combinedFiles);
            console.log(`Loaded ${retryData?.length || 0} documentation files and ${packageFiles.length} package.json files`);
            return;
          }
        } else {
          throw error;
        }
      }

      // Combine database files with package.json files
      const packageFiles = await findPackageJsonFiles();
      const combinedFiles = [...(data || []), ...packageFiles];
      
      setDocumentationFiles(combinedFiles);
      console.log(`Loaded ${data?.length || 0} documentation files and ${packageFiles.length} package.json files`);
    } catch (error) {
      console.error('Error loading documentation files:', error);
      // Check for network connectivity issues
      if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
        toast.error('Network connection issue. Please check your internet connection.');
        // Provide fallback data if needed
        setDocumentationFiles([]);
      } else if (error.message?.includes('401') || error.message?.includes('auth')) {
        toast.error('Authentication error. Please refresh the page.');
        setDocumentationFiles([]);
      } else {
        toast.error('Failed to load documentation files');
        setDocumentationFiles([]);
      }
    } finally {
      setIsLoading(prev => ({ ...prev, loadingDocFiles: false }));
    }
  };
  
  const loadDocumentTypes = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('document_type', { ascending: true });
        
      if (error) {
        // Handle authentication errors
        if (error.code === '401' || error.message?.includes('JWT')) {
          // Try to re-authenticate
          const authSuccess = await initializeSupabase();
          if (!authSuccess) {
            throw new Error('Authentication failed. Please refresh the page and try again.');
          }
          
          // Retry the query after successful authentication
          const { data: retryData, error: retryError } = await supabase
            .from('document_types')
            .select('*')
            .order('document_type', { ascending: true });
            
          if (retryError) throw retryError;
          
          if (retryData) {
            setDocumentTypes(retryData);
            return;
          }
        } else {
          throw error;
        }
      }
      
      if (data) {
        setDocumentTypes(data);
      }
    } catch (error) {
      console.error('Error loading document types:', error);
      // Check for network connectivity issues
      if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
        toast.error('Network connection issue. Please check your internet connection.');
      } else if (error.message?.includes('401') || error.message?.includes('auth')) {
        toast.error('Authentication error. Please refresh the page.');
      } else {
        toast.error('Failed to load document types');
      }
      
      // Fallback to mock data if database connection fails
      setDocumentTypes([
        { id: '1', document_type: 'PDF Document', description: 'PDF files containing text content', mime_type: 'application/pdf', category: 'Document' },
        { id: '2', document_type: 'React Component', description: 'React component source files', mime_type: 'text/jsx', category: 'Code' },
        { id: '3', document_type: 'Expert Profile', description: 'Expert biographical information', mime_type: 'application/json', category: 'Profile' },
        { id: '4', document_type: 'Code Source', description: 'General source code files', mime_type: 'text/plain', category: 'Code' },
      ]);
    }
  };
  
  const loadPromptCategories = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('prompt_categories')
        .select('*')
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      if (data) {
        setPromptCategories(data);
      }
    } catch (error) {
      console.error('Error loading prompt categories:', error);
      // Check for network connectivity issues
      if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
        toast.error('Network connection issue. Please check your internet connection.');
        // Provide fallback empty array
        setPromptCategories([]);
      } else {
        toast.error('Failed to load prompt categories');
      }
    }
  };
  
  const loadDatabasePrompts = async () => {
    setIsLoading(prev => ({ ...prev, loadingDbPrompts: true }));
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      
      if (data) {
        setDatabasePrompts(data);
        // Load relationship data after loading prompts
        loadPromptRelationships(data);
      }
    } catch (error) {
      console.error('Error loading database prompts:', error);
      // Check for network connectivity issues
      if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
        toast.error('Network connection issue. Please check your internet connection.');
        // Provide fallback empty array
        setDatabasePrompts([]);
      } else {
        toast.error('Failed to load database prompts');
      }
    } finally {
      setIsLoading(prev => ({ ...prev, loadingDbPrompts: false }));
    }
  };
  
  // Function to load relationship data for all prompts
  const loadPromptRelationships = async (prompts: DatabasePrompt[]) => {
    try {
      // Only proceed if we have documentation files already loaded
      if (documentationFiles.length === 0) {
        await loadDocumentationFiles();
      }
      
      // Create a map of prompt ID to related documentation files
      const relationshipsMap: Record<string, DocumentationFile[]> = {};
      
      // For each prompt, find its related assets
      for (const prompt of prompts) {
        const relatedAssetIds = prompt.metadata.relatedAssets || [];
        
        if (relatedAssetIds.length > 0) {
          try {
            // Get relationship data from prompt_relationships table
            const supabase = getSupabaseClient();
            const { data: relationshipData, error } = await supabase
              .from('prompt_relationships')
              .select('asset_id, document_type_id')
              .eq('prompt_id', prompt.id);
              
            if (error) {
              console.error('Error fetching relationship data:', error);
              throw error;
            }
            
            // Create a mapping of asset_id to document_type_id
            const documentTypeMap: Record<string, string> = {};
            if (relationshipData) {
              relationshipData.forEach(rel => {
                if (rel.document_type_id) {
                  documentTypeMap[rel.asset_id] = rel.document_type_id;
                }
              });
            }
            
            // Find the documentation files that match these IDs and enhance them with relationship data
            const relatedFiles = documentationFiles
              .filter(file => relatedAssetIds.includes(file.id))
              .map(file => ({
                ...file,
                related_document_type_id: documentTypeMap[file.id] || null
              }));
            
            relationshipsMap[prompt.id] = relatedFiles;
          } catch (error) {
            console.error(`Error fetching relationships for prompt ${prompt.id}:`, error);
            // If we fail for a single prompt, still continue with the others
            relationshipsMap[prompt.id] = [];
          }
        } else {
          relationshipsMap[prompt.id] = [];
        }
      }
      
      setPromptRelationshipsMap(relationshipsMap);
      console.log('Loaded relationships map:', relationshipsMap);
    } catch (error) {
      console.error('Error loading prompt relationships:', error);
      // Check for network connectivity issues
      if (error.message?.includes('Failed to fetch') || !navigator.onLine) {
        toast.error('Network connection issue. Please check your internet connection.');
        // Initialize an empty relationships map
        setPromptRelationshipsMap({});
      } else {
        toast.error('Failed to load prompt relationships');
      }
    }
  };
  
  const loadPromptFiles = async () => {
    setIsLoading(prev => ({ ...prev, loadingPrompts: true }));
    try {
      const files = await getPromptFiles();
      setPromptFiles(files);
    } catch (error) {
      console.error('Error loading prompt files:', error);
      toast.error('Failed to load prompt files');
    } finally {
      setIsLoading(prev => ({ ...prev, loadingPrompts: false }));
    }
  };
  
  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('claude-temperature', temperature.toString());
    localStorage.setItem('claude-api-key', apiKey);
  }, [temperature, apiKey]);
  
  const loadPromptContent = async (path: string) => {
    setIsLoading(prev => ({ ...prev, loadingPrompt: true }));
    try {
      const content = await fetchPromptContent(path);
      setPromptContent(content);
      setSelectedPrompt(path);
    } catch (error) {
      console.error('Error loading prompt:', error);
      setPromptContent('Error loading prompt content.');
      toast.error(`Failed to load prompt: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, loadingPrompt: false }));
    }
  };
  
  const handleFileSelection = (filePath: string) => {
    if (selectedFiles.includes(filePath)) {
      setSelectedFiles(selectedFiles.filter(path => path !== filePath));
    } else {
      setSelectedFiles([...selectedFiles, filePath]);
    }
  };
  
  const generatePrompt = async () => {
    if (selectedFiles.length === 0) {
      toast('Please select at least one file for context');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, generatingPrompt: true }));
    try {
      // Determine what kind of prompt to generate based on selected document type
      const docType = documentTypes.find(dt => dt.id === selectedDocumentType);
      let templateType: 'extraction' | 'classification' | 'analysis' = 'extraction';
      
      if (docType) {
        if (docType.category === 'Code') {
          templateType = 'analysis';
        } else if (docType.document_type.includes('Document')) {
          templateType = 'classification';
        }
      }
      
      const generatedPrompt = await generatePromptWithContext(selectedFiles, templateType);
      setPromptContent(generatedPrompt);
      
      toast.success(`Generated ${templateType} prompt with ${selectedFiles.length} context files`);
    } catch (error) {
      console.error('Error generating prompt:', error);
      toast.error(`Generation failed: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, generatingPrompt: false }));
    }
  };
  
  const savePrompt = async () => {
    if (!promptContent) {
      toast.error('Cannot save an empty prompt');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, savingPrompt: true }));
    try {
      if (selectedPrompt) {
        // Save existing prompt
        const success = await savePromptContent(selectedPrompt, promptContent);
        if (success) {
          toast.success(`Successfully saved ${selectedPrompt.split('/').pop()}`);
          // Refresh prompt list
          await loadPromptFiles();
        } else {
          throw new Error('Failed to save prompt');
        }
      } else {
        // Create new prompt
        if (!newPromptName) {
          toast.error('Please provide a name for the new prompt');
          return;
        }
        
        const newPrompt = await createPromptFile(newPromptName, promptContent, selectedDocumentType);
        if (newPrompt) {
          toast.success(`Successfully created ${newPrompt.name}`);
          // Update prompt list and select the new prompt
          await loadPromptFiles();
          setSelectedPrompt(newPrompt.path);
          setNewPromptName('');
        } else {
          throw new Error('Failed to create prompt');
        }
      }
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error(`Save failed: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, savingPrompt: false }));
    }
  };
  
  const applyPromptToFiles = async () => {
    if (!promptContent) {
      toast.error('Please select or create a prompt first');
      return;
    }
    
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file to process');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, applyingPrompt: true }));
    try {
      const results = await applyPrompt(promptContent, selectedFiles, temperature);
      
      toast.success(`Successfully processed ${results.results.length} files`);
      
      // This is where you would integrate with database storage
      console.log('Processing results:', results);
    } catch (error) {
      console.error('Error applying prompt:', error);
      toast.error(`Processing failed: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, applyingPrompt: false }));
    }
  };
  
  // Generate content hash for integrity verification
  const generateContentHash = (content: string): string => {
    // In a real implementation, this would use crypto to create a SHA-256 hash
    // For demo purposes, using a simplified hash method
    return btoa(encodeURIComponent(content)).slice(0, 40);
  };
  
  // Parse markdown frontmatter
  const parseMarkdownFrontmatter = (content: string): { metadata: any, content: string } => {
    try {
      // Check if the content has frontmatter (starts with ---)
      if (!content.startsWith('---')) {
        return { 
          metadata: {}, 
          content 
        };
      }
      
      // Find the end of the frontmatter
      const endOfFrontmatter = content.indexOf('---', 3);
      if (endOfFrontmatter === -1) {
        return { metadata: {}, content };
      }
      
      const frontmatterText = content.substring(3, endOfFrontmatter).trim();
      const mainContent = content.substring(endOfFrontmatter + 3).trim();
      
      // Parse YAML frontmatter
      const metadata: Record<string, any> = {};
      frontmatterText.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          const value = valueParts.join(':').trim();
          
          // Handle arrays (formatted as "tags:\n  - tag1\n  - tag2")
          if (value === '') {
            const keyWithoutColon = key.trim();
            const arrayEntries: string[] = [];
            let i = frontmatterText.indexOf(`${key}:`);
            const lines = frontmatterText.substring(i).split('\n');
            
            for (let j = 1; j < lines.length; j++) {
              const line = lines[j];
              if (line.trim().startsWith('-')) {
                arrayEntries.push(line.trim().substring(1).trim());
              } else if (!line.trim().startsWith(' ')) {
                break;
              }
            }
            
            if (arrayEntries.length) {
              metadata[keyWithoutColon] = arrayEntries;
              return;
            }
          }
          
          // Handle string values
          metadata[key.trim()] = value;
        }
      });
      
      return { metadata, content: mainContent };
    } catch (error) {
      console.error('Error parsing frontmatter:', error);
      return { metadata: {}, content };
    }
  };
  
  // Build metadata object for database storage
  const buildMetadataObject = (extractedMetadata: any, content: string, fileName: string) => {
    const contentHash = generateContentHash(content);
    
    return {
      hash: contentHash,
      source: {
        fileName,
        createdAt: new Date().toISOString(),
        gitInfo: {
          branch: 'main', // In real implementation, would get from git
          commitId: 'none'
        }
      },
      aiEngine: {
        model: extractedMetadata.model || 'claude-3-sonnet-20240229',
        temperature: extractedMetadata.temperature || 0.7,
        maxTokens: extractedMetadata.maxTokens || 4000
      },
      usage: {
        inputSchema: extractedMetadata.inputSchema || {},
        outputSchema: extractedMetadata.outputSchema || 'text'
      },
      function: {
        purpose: extractedMetadata.purpose || extractedMetadata.description || '',
        successCriteria: extractedMetadata.successCriteria || '',
        dependencies: extractedMetadata.dependencies || [],
        estimatedCost: extractedMetadata.estimatedCost || ''
      }
    };
  };
  
  // Import a prompt from a markdown file to the database
  const importPromptToDatabase = async (file: File) => {
    setIsLoading(prev => ({ ...prev, importingPrompt: true }));
    try {
      // Read the file content
      const fileContent = await file.text();
      
      // Parse the markdown frontmatter
      const { metadata, content } = parseMarkdownFrontmatter(fileContent);
      
      // Build structured metadata object
      const structuredMetadata = buildMetadataObject(metadata, content, file.name);
      
      // Get or create category if specified
      const supabase = getSupabaseClient();
      let categoryId = null;
      if (metadata.category) {
        // Check if category exists
        const { data: existingCategories } = await supabase
          .from('prompt_categories')
          .select('id')
          .eq('name', metadata.category);
          
        if (existingCategories && existingCategories.length > 0) {
          categoryId = existingCategories[0].id;
        } else {
          // Create the category
          const { data: newCategory, error } = await supabase
            .from('prompt_categories')
            .insert([{ name: metadata.category }])
            .select()
            .single();
            
          if (error) throw error;
          
          if (newCategory) {
            categoryId = newCategory.id;
            // Refresh categories list
            await loadPromptCategories();
          }
        }
      }
      
      // Alternatively, use selected category
      if (!categoryId && selectedCategory && selectedCategory !== 'none') {
        categoryId = selectedCategory;
      }
      
      // Skip hash check for now due to potential PostgreSQL query syntax issues
      // Instead, we'll use the name and content as a check
      const { data: existingNamePrompts } = await supabase
        .from('prompts')
        .select('id, version, name')
        .eq('name', metadata.name || file.name.replace('.md', ''));
        
      if (existingNamePrompts && existingNamePrompts.length > 0) {
        toast(`A prompt with name "${existingNamePrompts[0].name}" already exists. Consider using a different name.`, {
          icon: '⚠️'
        });
        // We'll still allow the import, but warn the user
      }
      
      console.log('Supabase test:', { data: existingNamePrompts });
      
      // Insert new prompt with proper UUID handling
      const docTypeId = selectedDocumentType && selectedDocumentType !== 'none' ? selectedDocumentType : null;
      const catId = categoryId || (selectedCategory && selectedCategory !== 'none' ? selectedCategory : null);
      
      const insertData = {
        name: metadata.name || file.name.replace('.md', ''),
        description: metadata.description || null,
        content: JSON.stringify(content),
        metadata: structuredMetadata,
        version: metadata.version || '1.0',
        status: metadata.status || 'active',
        author: metadata.author || null,
        tags: metadata.tags || [],
        file_path: file.name
      };
      
      // Only add these fields if they're not null to avoid UUID validation errors
      if (docTypeId) insertData.document_type_id = docTypeId;
      if (catId) insertData.category_id = catId;
      
      console.log('Inserting prompt with data:', insertData);
      
      const { data: newPrompt, error } = await supabase
        .from('prompts')
        .insert([insertData])
        .select()
        .single();
        
      if (error) throw error;
      
      if (newPrompt) {
        toast.success(`Successfully imported prompt: ${newPrompt.name}`);
        // Refresh prompts list
        await loadDatabasePrompts();
        setShowImportDialog(false);
        setImportFile(null);
      }
    } catch (error) {
      console.error('Error importing prompt:', error);
      toast.error(`Import failed: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, importingPrompt: false }));
    }
  };
  
  // Create a new prompt category
  const createPromptCategory = async () => {
    if (!newCategoryName) {
      toast.error('Please provide a name for the category');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, creatingCategory: true }));
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('prompt_categories')
        .insert([{
          name: newCategoryName,
          description: newCategoryDescription || null,
          parent_category_id: null // Can be enhanced to support hierarchical categories
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      if (data) {
        toast.success(`Category '${data.name}' created successfully`);
        // Refresh categories
        await loadPromptCategories();
        setShowCategoryDialog(false);
        setNewCategoryName('');
        setNewCategoryDescription('');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      toast.error(`Failed to create category: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, creatingCategory: false }));
    }
  };
  
  // Load a database prompt for viewing/editing
  const loadDatabasePrompt = async (promptId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('id', promptId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setSelectedDbPrompt(data);
        // Parse the content from JSON string if needed
        setPromptContent(typeof data.content === 'string' ? JSON.parse(data.content) : data.content);
        
        // Set appropriate document type and category
        if (data.document_type_id) {
          setSelectedDocumentType(data.document_type_id);
        }
        
        if (data.category_id) {
          setSelectedCategory(data.category_id);
        }
        
        setActiveTab('database');
      }
    } catch (error) {
      console.error('Error loading database prompt:', error);
      toast.error(`Failed to load prompt: ${error.message}`);
    }
  };
  
  // Save changes to a database prompt
  const saveDbPrompt = async () => {
    if (!selectedDbPrompt) {
      toast.error('No prompt selected for saving');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, savingDbPrompt: true }));
    try {
      // Generate new content hash
      const newContentHash = generateContentHash(promptContent);
      
      // Update metadata
      const updatedMetadata = {
        ...selectedDbPrompt.metadata,
        hash: newContentHash,
        source: {
          ...selectedDbPrompt.metadata.source,
          lastModified: new Date().toISOString()
        }
      };
      
      // Prepare update data with proper UUID handling
      const updateData = {
        content: JSON.stringify(promptContent),
        metadata: updatedMetadata,
        updated_at: new Date().toISOString()
      };
      
      // Only add UUID fields if they have valid values
      if (selectedDocumentType && selectedDocumentType !== 'none') {
        updateData.document_type_id = selectedDocumentType;
      } else {
        updateData.document_type_id = null;
      }
      
      if (selectedCategory && selectedCategory !== 'none') {
        updateData.category_id = selectedCategory;
      } else {
        updateData.category_id = null;
      }
      
      console.log('Updating prompt with data:', updateData);
      
      // Update prompt
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('prompts')
        .update(updateData)
        .eq('id', selectedDbPrompt.id)
        .select()
        .single();
        
      if (error) throw error;
      
      if (data) {
        toast.success(`Prompt '${data.name}' updated successfully`);
        // Refresh prompts list
        await loadDatabasePrompts();
        // Update selected prompt with new data
        setSelectedDbPrompt(data);
      }
    } catch (error) {
      console.error('Error saving database prompt:', error);
      toast.error(`Failed to save prompt: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, savingDbPrompt: false }));
    }
  };
  
  // Open relationships dialog for a prompt
  const openRelationshipsDialog = () => {
    // If we don't have documentation files yet, load them
    if (documentationFiles.length === 0) {
      loadDocumentationFiles();
    }
    
    setShowRelationshipsDialog(true);
  };
  
  // Handle selecting a prompt for relationships
  const selectPromptForRelationships = async (prompt: DatabasePrompt) => {
    setSelectedRelationshipPrompt(prompt);
    
    // Initialize selected assets from existing relationships if available
    const existingRelationships = prompt.metadata.relatedAssets || [];
    setSelectedRelatedAssets(existingRelationships);
    
    // Set default values for relationship fields
    setRelationshipType('reference');
    setRelationshipContext(`Works with ${prompt.name}`);
    setRelationshipDescription(`This defines how the ${prompt.name} prompt interacts with the selected documentation files.`);
    setRelationshipDocumentTypeId('none');
    
    // Load the database queries from metadata if available
    if (prompt.metadata.databaseQuery) {
      setDatabaseQuery(prompt.metadata.databaseQuery);
    } else {
      setDatabaseQuery('');
    }
    
    // Load the second database query from metadata if available
    if (prompt.metadata.databaseQuery2) {
      setDatabaseQuery2(prompt.metadata.databaseQuery2);
    } else {
      setDatabaseQuery2('');
    }
    
    // Clear existing relationship settings
    setAssetRelationshipSettings({});
    
    // Load relationship data for all existing assets
    if (existingRelationships.length > 0) {
      try {
        // Get relationship data from prompt_relationships table
        const supabase = getSupabaseClient();
        const { data: relationshipData, error } = await supabase
          .from('prompt_relationships')
          .select('*')
          .eq('prompt_id', prompt.id);
          
        if (error) throw error;
        
        if (relationshipData && relationshipData.length > 0) {
          // Create a map of asset ID to relationship settings
          const settings: Record<string, {
            relationship_type: string;
            relationship_context: string;
            description: string;
            document_type_id: string;
          }> = {};
          
          relationshipData.forEach(rel => {
            if (rel.asset_id) {
              settings[rel.asset_id] = {
                relationship_type: rel.relationship_type || 'reference',
                relationship_context: rel.relationship_context || '',
                description: rel.description || '',
                document_type_id: rel.document_type_id || 'none'
              };
            }
          });
          
          // Update the state with per-asset settings
          setAssetRelationshipSettings(settings);
          
          console.log('Loaded relationship settings:', settings);
          
          // If there's only one selected asset, use its settings for the form
          if (existingRelationships.length === 1) {
            const assetId = existingRelationships[0];
            const assetSettings = settings[assetId];
            
            if (assetSettings) {
              setRelationshipType(assetSettings.relationship_type);
              setRelationshipContext(assetSettings.relationship_context);
              setRelationshipDescription(assetSettings.description);
              setRelationshipDocumentTypeId(assetSettings.document_type_id || 'none');
            }
          }
        }
      } catch (error) {
        console.error('Error loading relationship data:', error);
      }
    }
  };
  
  // Toggle selection of a related asset
  const toggleRelatedAsset = async (assetId: string) => {
    if (selectedRelatedAssets.includes(assetId)) {
      // If we're removing this asset, check if it was the only one
      const newSelection = selectedRelatedAssets.filter(id => id !== assetId);
      setSelectedRelatedAssets(newSelection);
      
      // If we now have exactly one asset selected, show its specific settings
      if (newSelection.length === 1) {
        const remainingAssetId = newSelection[0];
        const settings = assetRelationshipSettings[remainingAssetId];
        
        if (settings) {
          // Use the settings for the remaining asset
          setRelationshipType(settings.relationship_type);
          setRelationshipContext(settings.relationship_context);
          setRelationshipDescription(settings.description);
          setRelationshipDocumentTypeId(settings.document_type_id);
        } else if (selectedRelationshipPrompt) {
          // Check if this is a package.json file
          const file = documentationFiles.find(f => f.id === remainingAssetId);
          if (file?.metadata?.isPackageJson) {
            // Look for package.json settings in the prompt metadata
            if (selectedRelationshipPrompt?.metadata?.packageJsonFiles) {
              const packageData = selectedRelationshipPrompt.metadata.packageJsonFiles.find(pkg => pkg.id === remainingAssetId);
              if (packageData) {
                console.log(`Loading settings for package.json ${remainingAssetId}:`, packageData);
                
                // Use settings from metadata - PREFER top-level fields first, then settings object
                const relType = packageData.relationship_type || packageData.settings?.relationship_type || 'reference';
                const context = packageData.context || packageData.settings?.relationship_context || '';
                const desc = packageData.description || packageData.settings?.description || 'Package.json file relationship';
                const docType = packageData.document_type_id || packageData.settings?.document_type_id || 'none';
                
                console.log(`Setting UI values for package.json: relType=${relType}, context=${context}, docType=${docType}`);
                
                // Set UI fields
                setRelationshipType(relType);
                setRelationshipContext(context);
                setRelationshipDescription(desc);
                setRelationshipDocumentTypeId(docType);
                
                // Update our cache
                setAssetRelationshipSettings(prev => ({
                  ...prev,
                  [remainingAssetId]: {
                    relationship_type: relType,
                    relationship_context: context,
                    description: desc,
                    document_type_id: docType
                  }
                }));
                return;
              }
            }
            
            // Default settings for package.json
            setRelationshipType('reference');
            setRelationshipContext('');
            setRelationshipDescription('Package.json file relationship');
            setRelationshipDocumentTypeId('none');
            
            // Initialize settings for this asset
            setAssetRelationshipSettings(prev => ({
              ...prev,
              [remainingAssetId]: {
                relationship_type: 'reference',
                relationship_context: '',
                description: 'Package.json file relationship',
                document_type_id: 'none'
              }
            }));
          } else {
            // Try to load from database if not found in our cache for regular files
            try {
              const supabase = getSupabaseClient();
              const { data, error } = await supabase
                .from('prompt_relationships')
                .select('*')
                .eq('prompt_id', selectedRelationshipPrompt.id)
                .eq('asset_id', remainingAssetId)
                .single();
                
              if (data) {
                setRelationshipType(data.relationship_type || 'reference');
                setRelationshipContext(data.relationship_context || '');
                setRelationshipDescription(data.description || '');
                setRelationshipDocumentTypeId(data.document_type_id || 'none');
                
                // Update our cache
                setAssetRelationshipSettings(prev => ({
                  ...prev,
                  [remainingAssetId]: {
                    relationship_type: data.relationship_type || 'reference',
                    relationship_context: data.relationship_context || '',
                    description: data.description || '',
                    document_type_id: data.document_type_id || 'none'
                  }
                }));
              } else {
                // Default values if no relationship exists
                const docTypeId = file && file.document_type_id ? file.document_type_id : 'none';
                
                // Initialize settings for this asset
                setAssetRelationshipSettings(prev => ({
                  ...prev,
                  [remainingAssetId]: {
                    relationship_type: 'reference',
                    relationship_context: '',
                    description: '',
                    document_type_id: docTypeId
                  }
                }));
              }
            } catch (error) {
              console.error('Error getting relationship data:', error);
              
              // Initialize with empty settings for this asset
              setAssetRelationshipSettings(prev => ({
                ...prev,
                [remainingAssetId]: {
                  relationship_type: 'reference',
                  relationship_context: '',
                  description: '',
                  document_type_id: 'none'
                }
              }));
            }
          }
        }
      } else if (newSelection.length === 0) {
        // Reset if no assets selected
        // No need to set global fields as they're no longer used
      } else {
        // Multiple assets selected, individual card fields are used instead
      }
    } else {
      // Adding a new asset
      const newSelection = [...selectedRelatedAssets, assetId];
      setSelectedRelatedAssets(newSelection);
      
      // If this is the only asset selected, show its specific settings
      if (newSelection.length === 1) {
        const settings = assetRelationshipSettings[assetId];
        
        if (settings) {
          // Use cached settings if available
          setRelationshipType(settings.relationship_type);
          setRelationshipContext(settings.relationship_context);
          setRelationshipDescription(settings.description);
          setRelationshipDocumentTypeId(settings.document_type_id);
        } else if (selectedRelationshipPrompt) {
          // Check if this is a package.json file
          const file = documentationFiles.find(f => f.id === assetId);
          if (file?.metadata?.isPackageJson) {
            // Look for package.json settings in the prompt metadata
            if (selectedRelationshipPrompt?.metadata?.packageJsonFiles) {
              const packageData = selectedRelationshipPrompt.metadata.packageJsonFiles.find(pkg => pkg.id === assetId);
              if (packageData) {
                console.log(`Loading settings for package.json ${assetId}:`, packageData);
                
                // Use settings from metadata - PREFER top-level fields first, then settings object
                const relType = packageData.relationship_type || packageData.settings?.relationship_type || 'reference';
                const context = packageData.context || packageData.settings?.relationship_context || '';
                const desc = packageData.description || packageData.settings?.description || 'Package.json file relationship';
                const docType = packageData.document_type_id || packageData.settings?.document_type_id || 'none';
                
                console.log(`Setting UI values for package.json: relType=${relType}, context=${context}, docType=${docType}`);
                
                // Set UI fields
                setRelationshipType(relType);
                setRelationshipContext(context);
                setRelationshipDescription(desc);
                setRelationshipDocumentTypeId(docType);
                
                // Update our cache
                setAssetRelationshipSettings(prev => ({
                  ...prev,
                  [assetId]: {
                    relationship_type: relType,
                    relationship_context: context,
                    description: desc,
                    document_type_id: docType
                  }
                }));
                return;
              }
            }
            
            // Default settings for package.json
            setRelationshipType('reference');
            setRelationshipContext('');
            setRelationshipDescription('Package.json file relationship');
            setRelationshipDocumentTypeId('none');
            
            // Initialize settings for this asset
            setAssetRelationshipSettings(prev => ({
              ...prev,
              [assetId]: {
                relationship_type: 'reference',
                relationship_context: '',
                description: 'Package.json file relationship',
                document_type_id: 'none'
              }
            }));
          } else {
            // Try to load from database for regular files
            try {
              const supabase = getSupabaseClient();
              const { data, error } = await supabase
                .from('prompt_relationships')
                .select('*')
                .eq('prompt_id', selectedRelationshipPrompt.id)
                .eq('asset_id', assetId)
                .single();
                
              if (data) {
                setRelationshipType(data.relationship_type || 'reference');
                setRelationshipContext(data.relationship_context || '');
                setRelationshipDescription(data.description || '');
                setRelationshipDocumentTypeId(data.document_type_id || 'none');
                
                // Update our cache
                setAssetRelationshipSettings(prev => ({
                  ...prev,
                  [assetId]: {
                    relationship_type: data.relationship_type || 'reference',
                    relationship_context: data.relationship_context || '',
                    description: data.description || '',
                    document_type_id: data.document_type_id || 'none'
                  }
                }));
              } else {
                // Default values if no relationship exists
                const docTypeId = file && file.document_type_id ? file.document_type_id : 'none';
                
                // Initialize settings for this asset
                setAssetRelationshipSettings(prev => ({
                  ...prev,
                  [assetId]: {
                    relationship_type: 'reference',
                    relationship_context: '',
                    description: '',
                    document_type_id: docTypeId
                  }
                }));
              }
            } catch (error) {
              console.error('Error getting relationship data:', error);
              
              // Initialize with empty settings for this asset
              const docTypeId = file && file.document_type_id ? file.document_type_id : 'none';
              
              setAssetRelationshipSettings(prev => ({
                ...prev,
                [assetId]: {
                  relationship_type: 'reference',
                  relationship_context: '',
                  description: '',
                  document_type_id: docTypeId
                }
              }));
            }
          }
        }
      } else {
        // Multiple assets selected, individual card fields are used instead
      }
    }
  };
  
  // Save relationships for the selected prompt
  const saveRelationships = async () => {
    if (!selectedRelationshipPrompt) {
      toast.error('No prompt selected');
      return;
    }
    
    setIsLoading(prev => ({ ...prev, savingRelationships: true }));
    try {
      // Filter out package.json files (which aren't in the database)
      // and only keep regular documentation files for database operations
      const databaseAssets = selectedRelatedAssets.filter(assetId => {
        const file = documentationFiles.find(file => file.id === assetId);
        // Skip files with special isPackageJson flag
        return !(file?.metadata?.isPackageJson || false);
      });
      
      // But include ALL assets (including package.json) in the metadata
      // This way they'll show up in the UI but won't cause database errors
      const updatedMetadata = {
        ...selectedRelationshipPrompt.metadata,
        relatedAssets: selectedRelatedAssets,
        databaseQuery: databaseQuery, // Save the database query in metadata
        databaseQuery2: databaseQuery2, // Save the second database query in metadata
        packageJsonFiles: documentationFiles
          .filter(file => file.metadata?.isPackageJson && selectedRelatedAssets.includes(file.id))
          .map(file => {
            // Get settings for this package.json file - use logged version so we can debug issues
            const settings = assetRelationshipSettings[file.id] || {
              relationship_type: 'reference',
              relationship_context: '',
              description: `Package.json file relationship`,
              document_type_id: null
            };
            
            console.log(`Saving package.json ${file.id} settings:`, settings);
            
            // Fix document_type_id: convert 'none' to null, otherwise keep ID
            const docTypeId = settings.document_type_id === 'none' ? null : settings.document_type_id;
            
            // Create the complete object with all fields both at top level and in settings
            return {
              id: file.id,
              path: file.file_path,
              title: file.title,
              document_type_id: docTypeId,
              context: settings.relationship_context,
              relationship_type: settings.relationship_type, 
              description: settings.description,
              // Store complete settings object with corrected document_type_id
              settings: {
                relationship_type: settings.relationship_type,
                relationship_context: settings.relationship_context,
                description: settings.description,
                document_type_id: docTypeId
              }
            };
          })
      };
      
      // Update the prompt in the database
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('prompts')
        .update({
          metadata: updatedMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRelationshipPrompt.id)
        .select()
        .single();
        
      if (error) throw error;
      
      // Create or update relationship records in the prompt_relationships table
      // But only for real database assets (not package.json files)
      if (databaseAssets.length > 0) {
        // Get the existing relationships to avoid duplicates and determine which to delete
        const { data: existingRelationships, error: fetchError } = await supabase
          .from('prompt_relationships')
          .select('id, asset_id')
          .eq('prompt_id', selectedRelationshipPrompt.id);
          
        if (fetchError) throw fetchError;
        
        // Check which existing relationships need to be removed
        const existingAssetIds = existingRelationships?.map(rel => rel.asset_id) || [];
        const assetsToRemove = existingAssetIds.filter(id => !databaseAssets.includes(id));
        
        // Delete removed relationships
        if (assetsToRemove.length > 0) {
          const { error: deleteError } = await supabase
            .from('prompt_relationships')
            .delete()
            .eq('prompt_id', selectedRelationshipPrompt.id)
            .in('asset_id', assetsToRemove);
            
          if (deleteError) throw deleteError;
        }
        
        // Process existing assets that need to be updated and new assets that need to be added
        for (const assetId of databaseAssets) {
          // Get the file information
          const file = documentationFiles.find(file => file.id === assetId);
          if (!file) continue;
          
          // Get the settings for this asset from our stored state
          let settings;
          
          // If we have specific settings for this asset in our state, use those
          if (assetRelationshipSettings[assetId]) {
            settings = assetRelationshipSettings[assetId];
          } else {
            // For newly added assets without specific settings, create default values
            settings = {
              relationship_type: 'reference',
              relationship_context: '',
              description: `Generated relationship between prompt "${selectedRelationshipPrompt.name}" and asset "${file.title}"`,
              // Use the file's own document type if available as a fallback
              document_type_id: file.document_type_id || null
            };
          }
          
          // Check if this asset already exists in the relationships
          const isExistingAsset = existingAssetIds.includes(assetId);
          
          if (isExistingAsset) {
            // Update existing relationship
            const { error: updateError } = await supabase
              .from('prompt_relationships')
              .update({
                relationship_type: settings.relationship_type,
                relationship_context: settings.relationship_context,
                description: settings.description,
                document_type_id: settings.document_type_id === 'none' ? null : settings.document_type_id
              })
              .eq('prompt_id', selectedRelationshipPrompt.id)
              .eq('asset_id', assetId);
              
            if (updateError) throw updateError;
          } else {
            // Create new relationship record
            const { error: insertError } = await supabase
              .from('prompt_relationships')
              .insert({
                prompt_id: selectedRelationshipPrompt.id,
                asset_id: assetId,
                asset_path: file.file_path,
                relationship_type: settings.relationship_type,
                relationship_context: settings.relationship_context,
                document_type_id: settings.document_type_id === 'none' ? null : settings.document_type_id,
                description: settings.description
              });
              
            if (insertError) throw insertError;
          }
        }
      } else {
        // If no database assets are selected, delete all relationships from the table
        const { error: deleteAllError } = await supabase
          .from('prompt_relationships')
          .delete()
          .eq('prompt_id', selectedRelationshipPrompt.id);
          
        if (deleteAllError) throw deleteAllError;
      }
      
      // Update local state
      if (data) {
        // Update the relationships map with the new data
        await updateRelationshipsMap(data);
        
        // Update the prompts list
        await loadDatabasePrompts();
        
        toast.success(`Relationships updated for "${data.name}"`);
        setShowRelationshipsDialog(false);
        setSelectedRelationshipPrompt(null);
        setSelectedRelatedAssets([]);
        setRelationshipType('reference');
        setRelationshipContext('');
        setRelationshipDescription('');
        setRelationshipDocumentTypeId('none');
        // Clear the asset relationship settings
        setAssetRelationshipSettings({});
      }
    } catch (error) {
      console.error('Error saving relationships:', error);
      toast.error(`Failed to save relationships: ${error.message}`);
    } finally {
      setIsLoading(prev => ({ ...prev, savingRelationships: false }));
    }
  };
  
  // Update the relationships map with a single prompt
  const updateRelationshipsMap = async (prompt: DatabasePrompt) => {
    const relatedAssetIds = prompt.metadata.relatedAssets || [];
    
    if (relatedAssetIds.length > 0) {
      try {
        // Get relationship data from prompt_relationships table
        const supabase = getSupabaseClient();
        const { data: relationshipData, error } = await supabase
          .from('prompt_relationships')
          .select('*') // Select all fields to get all relationship data
          .eq('prompt_id', prompt.id);
          
        if (error) {
          console.error('Error fetching relationship data:', error);
        }
        
        // Create a mapping of asset_id to relationship data
        const relationshipMap: Record<string, any> = {};
        if (relationshipData) {
          relationshipData.forEach(rel => {
            relationshipMap[rel.asset_id] = {
              document_type_id: rel.document_type_id || null,
              relationship_type: rel.relationship_type || 'reference',
              relationship_context: rel.relationship_context || '',
              description: rel.description || ''
            };
          });
        }
        
        // Find the documentation files that match these IDs
        let relatedFiles = documentationFiles
          .filter(file => relatedAssetIds.includes(file.id))
          .map(file => {
            // Check if it's a package.json file
            if (file.metadata?.isPackageJson) {
              // Get settings from package.json metadata if available
              const packageJsonFiles = prompt.metadata.packageJsonFiles || [];
              const packageData = packageJsonFiles.find(pkg => pkg.id === file.id);
              
              if (packageData) {
                console.log(`Loading package.json ${file.id} data from metadata:`, packageData);
                
                return {
                  ...file,
                  // Use top-level properties if available, otherwise fallback to settings
                  related_document_type_id: packageData.document_type_id || packageData.settings?.document_type_id,
                  relationship_type: packageData.relationship_type || packageData.settings?.relationship_type || 'reference',
                  relationship_context: packageData.context || packageData.settings?.relationship_context || '',
                  relationship_description: packageData.description || packageData.settings?.description || 'Package.json file relationship'
                };
              } else {
                // Default package.json relationship data
                return {
                  ...file,
                  related_document_type_id: null,
                  relationship_type: 'reference',
                  relationship_context: '',
                  relationship_description: 'Package.json file relationship'
                };
              }
            } else {
              // Regular database file - use relationship data from database
              const relData = relationshipMap[file.id] || {};
              return {
                ...file,
                related_document_type_id: relData.document_type_id,
                relationship_type: relData.relationship_type,
                relationship_context: relData.relationship_context,
                relationship_description: relData.description
              };
            }
          });
        
        // Update the map for this single prompt
        setPromptRelationshipsMap(prevMap => ({
          ...prevMap,
          [prompt.id]: relatedFiles
        }));
      } catch (error) {
        console.error('Error updating relationships map:', error);
      }
    } else {
      // If no related assets, just set an empty array
      setPromptRelationshipsMap(prevMap => ({
        ...prevMap,
        [prompt.id]: []
      }));
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">AI Prompt Workshop</h1>
        {!isOnline && (
          <div className="bg-red-100 text-red-800 px-4 py-2 rounded-md flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>You are offline - Limited functionality available</span>
          </div>
        )}
      </div>
      
      <Tabs defaultValue="prompts" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="prompts">Prompts Library</TabsTrigger>
          <TabsTrigger value="editor">Prompt Editor</TabsTrigger>
          <TabsTrigger value="generator">Prompt Generator</TabsTrigger>
          <TabsTrigger value="database" disabled={!isOnline}>Database{!isOnline && ' (Offline)'}</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        {/* Prompts Library Tab */}
        <TabsContent value="prompts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Library</CardTitle>
              <CardDescription>Browse and manage your prompt collection</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Document Type</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promptFiles.map((file) => (
                    <TableRow key={file.path}>
                      <TableCell>{file.name}</TableCell>
                      <TableCell>{file.documentType || 'General'}</TableCell>
                      <TableCell>{file.lastModified.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => {
                          loadPromptContent(file.path);
                          setActiveTab('editor');
                        }}>
                          View/Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              <div className="mt-4">
                <Button onClick={() => {
                  setSelectedPrompt(null);
                  setPromptContent('');
                  setActiveTab('editor');
                }}>
                  Create New Prompt
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Prompt Editor Tab */}
        <TabsContent value="editor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{selectedPrompt ? `Editing: ${selectedPrompt.split('/').pop()}` : 'New Prompt'}</CardTitle>
              <CardDescription>Edit your prompt and save changes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {!selectedPrompt && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="promptName">Prompt Name</Label>
                      <Input id="promptName" placeholder="e.g., new-analysis-prompt.md" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="documentType">Document Type</Label>
                      <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          {documentTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.document_type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="promptContent">Prompt Content (Markdown)</Label>
                  <Textarea 
                    id="promptContent" 
                    value={promptContent} 
                    onChange={(e) => setPromptContent(e.target.value)} 
                    className="font-mono h-[500px]" 
                  />
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setActiveTab('prompts')}>
                    Cancel
                  </Button>
                  <Button onClick={savePrompt}>
                    Save Prompt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Prompt Generator Tab */}
        <TabsContent value="generator" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Source Selection</CardTitle>
                <CardDescription>Select files for prompt context</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="docTypeFilter">Filter by Document Type</Label>
                    <Select>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="All Document Types" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="all">All Document Types</SelectItem>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.document_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <ScrollArea className="h-[300px] border rounded-md p-4">
                    {/* This would be a file tree in production */}
                    <div className="space-y-2">
                      {['File 1.tsx', 'File 2.md', 'File 3.json', 'File 4.py'].map((file, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`file-${index}`} 
                            checked={selectedFiles.includes(`file-${index}`)}
                            onCheckedChange={() => handleFileSelection(`file-${index}`)}
                          />
                          <Label htmlFor={`file-${index}`}>{file}</Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {selectedFiles.length} files selected
                    </p>
                    <Button onClick={generatePrompt} disabled={selectedFiles.length === 0}>
                      Generate Prompt
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Generated Prompt</CardTitle>
                <CardDescription>Review and apply the generated prompt</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ScrollArea className="h-[300px] border rounded-md p-4 font-mono">
                    <p className="text-sm text-muted-foreground">
                      {promptContent || 'Generated prompt will appear here...'}
                    </p>
                  </ScrollArea>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="temperature">Temperature: {temperature.toFixed(2)}</Label>
                      </div>
                      <Slider 
                        id="temperature"
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={[temperature]} 
                        onValueChange={(value) => setTemperature(value[0])} 
                      />
                    </div>
                    
                    <div className="flex justify-between">
                      <Button variant="outline" onClick={() => {
                        setSelectedPrompt(null);
                        setPromptContent('');
                        setActiveTab('editor');
                      }}>
                        Edit Full Prompt
                      </Button>
                      <Button onClick={applyPromptToFiles} disabled={!promptContent || selectedFiles.length === 0}>
                        Apply to Files
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Left sidebar: Prompt categories */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Prompt Categories</CardTitle>
                <CardDescription>Organize prompts by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <ScrollArea className="h-[200px] border rounded-md p-4">
                    <div className="space-y-2">
                      {promptCategories.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No categories found</p>
                      ) : (
                        promptCategories.map((category) => (
                          <div 
                            key={category.id} 
                            className={`flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer ${selectedCategory === category.id ? 'bg-accent' : ''}`}
                            onClick={() => setSelectedCategory(category.id)}
                          >
                            <span>{category.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {category.description && (
                                <span title={category.description}>ℹ️</span>
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  
                  <Button variant="outline" onClick={() => setShowCategoryDialog(true)}>
                    Add Category
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Middle: Database Prompts List */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Database Prompts</CardTitle>
                    <CardDescription>View and manage stored prompts</CardDescription>
                  </div>
                  <Button onClick={() => setShowImportDialog(true)}>
                    Import Prompt
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading.loadingDbPrompts ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">Loading prompts...</TableCell>
                      </TableRow>
                    ) : databasePrompts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center">No prompts found in database</TableCell>
                      </TableRow>
                    ) : (
                      databasePrompts
                        .filter(prompt => !selectedCategory || prompt.category_id === selectedCategory)
                        .map((prompt) => (
                          <TableRow key={prompt.id}>
                            <TableCell>
                              <div className="font-medium">{prompt.name}</div>
                              {prompt.description && (
                                <div className="text-xs text-muted-foreground">{prompt.description}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              {documentTypes.find(dt => dt.id === prompt.document_type_id)?.document_type || 'General'}
                            </TableCell>
                            <TableCell>{prompt.version}</TableCell>
                            <TableCell>
                              <Badge variant={
                                prompt.status === 'active' ? 'default' :
                                prompt.status === 'draft' ? 'outline' : 
                                prompt.status === 'deprecated' ? 'secondary' : 'destructive'
                              }>
                                {prompt.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => loadDatabasePrompt(prompt.id)}>
                                View/Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          
          {/* Prompt Editor (when a database prompt is selected) */}
          {selectedDbPrompt && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Editing Database Prompt: {selectedDbPrompt.name}</CardTitle>
                <CardDescription>
                  Version {selectedDbPrompt.version} • Last updated: {new Date(selectedDbPrompt.updated_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dbPromptDocType">Document Type</Label>
                      <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none">None</SelectItem>
                          {documentTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.document_type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dbPromptCategory">Category</Label>
                      <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="none">None</SelectItem>
                          {promptCategories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dbPromptContent">Prompt Content</Label>
                    <Textarea 
                      id="dbPromptContent" 
                      value={promptContent} 
                      onChange={(e) => setPromptContent(e.target.value)} 
                      className="font-mono h-[400px]" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Metadata</Label>
                      <div className="text-xs text-muted-foreground p-4 border rounded-md bg-accent/20">
                        <p><strong>Hash:</strong> {selectedDbPrompt.metadata.hash}</p>
                        <p><strong>Source:</strong> {selectedDbPrompt.metadata.source.fileName}</p>
                        <p><strong>Created:</strong> {new Date(selectedDbPrompt.metadata.source.createdAt).toLocaleString()}</p>
                        <p><strong>Model:</strong> {selectedDbPrompt.metadata.aiEngine.model}</p>
                        <p><strong>Temperature:</strong> {selectedDbPrompt.metadata.aiEngine.temperature}</p>
                        <p><strong>Purpose:</strong> {selectedDbPrompt.metadata.function.purpose}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Actions</Label>
                      <div className="space-y-2">
                        <Button 
                          className="w-full" 
                          onClick={saveDbPrompt}
                          disabled={isLoading.savingDbPrompt}
                        >
                          {isLoading.savingDbPrompt ? 'Saving...' : 'Save Changes'}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => {
                            setSelectedDbPrompt(null);
                            setPromptContent('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Import Dialog */}
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogContent className="bg-white border-gray-200 shadow-lg">
              <DialogHeader className="bg-white">
                <DialogTitle>Import Prompt from File</DialogTitle>
                <DialogDescription>
                  Upload a markdown file with YAML frontmatter to import as a prompt
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="importFile">Prompt File (Markdown)</Label>
                  <Input 
                    id="importFile" 
                    type="file" 
                    accept=".md,.markdown" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setImportFile(e.target.files[0]);
                      }
                    }} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="importDocType">Document Type (Optional)</Label>
                  <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="none">None</SelectItem>
                      {documentTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.document_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="importCategory">Category (Optional)</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="none">None</SelectItem>
                      {promptCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => {
                    if (importFile) {
                      importPromptToDatabase(importFile);
                    } else {
                      toast.error('Please select a file to import');
                    }
                  }} 
                  disabled={!importFile || isLoading.importingPrompt}
                >
                  {isLoading.importingPrompt ? 'Importing...' : 'Import'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Set Relationships Button */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="flex justify-center">
                <Button 
                  variant="outline" 
                  size="lg"
                  className="w-full md:w-1/2 lg:w-1/3 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-800"
                  onClick={openRelationshipsDialog}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Set Relationships
                </Button>
              </div>
            </CardContent>
          </Card>
          
          {/* Prompt Relationships Viewer */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Prompt Relationships</CardTitle>
              <CardDescription>
                View relationships between prompts and documentation files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Prompts Selection Column */}
                  <div className="border rounded-md p-4">
                    <h3 className="text-sm font-medium mb-3">Select a Prompt</h3>
                    <Select
                      value={selectedPromptForView || ''}
                      onValueChange={setSelectedPromptForView}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Choose a prompt" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="none">None</SelectItem>
                        {databasePrompts.map(prompt => (
                          <SelectItem key={prompt.id} value={prompt.id}>
                            {prompt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedPromptForView && selectedPromptForView !== 'none' && (
                      <div className="mt-4 text-sm">
                        <div className="font-medium">
                          {databasePrompts.find(p => p.id === selectedPromptForView)?.name}
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {databasePrompts.find(p => p.id === selectedPromptForView)?.description || 'No description'}
                        </div>
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Category:</span>{' '}
                          {promptCategories.find(c => c.id === databasePrompts.find(p => p.id === selectedPromptForView)?.category_id)?.name || 'None'}
                        </div>
                        <div className="mt-1 text-xs">
                          <span className="font-medium">Status:</span>{' '}
                          {databasePrompts.find(p => p.id === selectedPromptForView)?.status || 'Unknown'}
                        </div>
                        <div className="mt-2 bg-blue-50 p-2 rounded text-blue-800 text-xs">
                          {promptRelationshipsMap[selectedPromptForView]?.length || 0} Related Files
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Relationships Display - 2/3 width */}
                  <div className="md:col-span-2 border rounded-md p-4">
                    <h3 className="text-sm font-medium mb-3">Related Documentation Files</h3>
                    
                    {!selectedPromptForView || selectedPromptForView === 'none' ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground">
                        Select a prompt to view its relationships
                      </div>
                    ) : promptRelationshipsMap[selectedPromptForView]?.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground">
                        No related files for this prompt
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                        {promptRelationshipsMap[selectedPromptForView]?.map(file => (
                          <div 
                            key={file.id} 
                            className={`border rounded-md p-3 hover:bg-gray-50 ${
                              file.metadata?.isPackageJson || file.file_path.toLowerCase().includes('package.json') 
                                ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="font-medium">
                                  {file.title}
                                  {(file.metadata?.isPackageJson || file.file_path.toLowerCase().includes('package.json')) && (
                                    <Badge className="ml-2 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300">
                                      package.json
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {file.file_path}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex gap-1">
                                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-800 border-gray-200">
                                    File Type: {documentTypes.find(dt => dt.id === file.document_type_id)?.document_type || 'No Type'}
                                  </Badge>
                                </div>
                                <div className="flex gap-1">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${file.related_document_type_id && file.document_type_id && 
                                                file.related_document_type_id !== file.document_type_id ? 
                                                'bg-orange-50 text-orange-800 border-orange-200' : 
                                                'bg-blue-50 text-blue-800 border-blue-200'}`}
                                  >
                                    Relationship Type: {documentTypes.find(dt => dt.id === file.related_document_type_id)?.document_type || 
                                                    documentTypes.find(dt => dt.id === file.document_type_id)?.document_type || 'Unspecified'}
                                    {file.related_document_type_id && file.document_type_id && 
                                      file.related_document_type_id !== file.document_type_id && ' (Override)'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                              Last modified: {file.last_modified_at ? 
                                new Date(file.last_modified_at).toLocaleDateString() : 
                                new Date(file.updated_at).toLocaleDateString()}
                            </div>
                            {(file.metadata?.file_size || file.metadata?.size) && (
                              <div className="mt-1 text-xs text-gray-500">
                                Size: {Math.round((file.metadata?.file_size || file.metadata?.size) / 1024)} KB
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {selectedPromptForView && selectedPromptForView !== 'none' && (
                      <div className="mt-4">
                        {/* Display database queries if available */}
                        {selectedPromptForView && (databasePrompts.find(p => p.id === selectedPromptForView)?.metadata.databaseQuery || 
                                                 databasePrompts.find(p => p.id === selectedPromptForView)?.metadata.databaseQuery2) && (
                          <div className="mb-4 border-t pt-4">
                            {/* First database query */}
                            {databasePrompts.find(p => p.id === selectedPromptForView)?.metadata.databaseQuery && (
                              <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-sm font-medium">Primary Database Query</h3>
                                  <Badge className="bg-blue-100 text-blue-800 border border-blue-200 font-mono">SQL</Badge>
                                </div>
                                <div className="border rounded-md p-3 bg-gray-50 font-mono text-xs overflow-x-auto">
                                  {databasePrompts.find(p => p.id === selectedPromptForView)?.metadata.databaseQuery}
                                </div>
                              </div>
                            )}
                            
                            {/* Second database query */}
                            {databasePrompts.find(p => p.id === selectedPromptForView)?.metadata.databaseQuery2 && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h3 className="text-sm font-medium">Secondary Database Query</h3>
                                  <Badge className="bg-blue-100 text-blue-800 border border-blue-200 font-mono">SQL</Badge>
                                </div>
                                <div className="border rounded-md p-3 bg-gray-50 font-mono text-xs overflow-x-auto">
                                  {databasePrompts.find(p => p.id === selectedPromptForView)?.metadata.databaseQuery2}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Add display of relationship data */}
                        {selectedPromptForView && promptRelationshipsMap[selectedPromptForView]?.length > 0 && (
                          <div className="mb-4 border-t pt-4">
                            <h3 className="text-sm font-medium mb-2">Relationship Details</h3>
                            <div className="space-y-2">
                              {promptRelationshipsMap[selectedPromptForView].map(file => (
                                <div 
                                  key={file.id} 
                                  className={`border rounded-md p-2 text-sm ${
                                    file.metadata?.isPackageJson || file.file_path.toLowerCase().includes('package.json') 
                                      ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'
                                  }`}
                                >
                                  <div className="flex justify-between items-start">
                                    <span className="font-medium">
                                      {file.title}
                                      {(file.metadata?.isPackageJson || file.file_path.toLowerCase().includes('package.json')) && (
                                        <Badge className="ml-2 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300">
                                          package.json
                                        </Badge>
                                      )}
                                    </span>
                                    {file.relationship_type && (
                                      <Badge className="text-xs bg-blue-100 text-blue-800">
                                        {file.relationship_type}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {file.relationship_context && (
                                    <div className="mt-1 text-xs">
                                      <span className="font-medium text-green-700">Context:</span> {file.relationship_context}
                                    </div>
                                  )}
                                  
                                  {file.relationship_description && (
                                    <div className="mt-1 text-xs text-gray-600">
                                      <span className="italic">Description:</span> {file.relationship_description}
                                    </div>
                                  )}
                                  
                                  <div className="mt-1 text-xs">
                                    <span className="font-medium text-purple-700">Document Type:</span> 
                                    <span className={`ml-1 px-1.5 py-0.5 rounded ${
                                      file.related_document_type_id && file.document_type_id && 
                                      file.related_document_type_id !== file.document_type_id ? 
                                      'bg-orange-50 text-orange-800' : 'bg-blue-50 text-blue-800'
                                    }`}>
                                      {documentTypes.find(dt => dt.id === file.related_document_type_id)?.document_type || 
                                       documentTypes.find(dt => dt.id === file.document_type_id)?.document_type || 
                                       'No Document Type'}
                                    </span>
                                    
                                    {file.related_document_type_id && file.document_type_id && file.related_document_type_id !== file.document_type_id && (
                                      <span className="ml-2 bg-gray-50 text-gray-800 px-1.5 py-0.5 rounded">
                                        Original file type: {
                                          documentTypes.find(dt => dt.id === file.document_type_id)?.document_type || 'None'
                                        }
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const prompt = databasePrompts.find(p => p.id === selectedPromptForView);
                              if (prompt) {
                                selectPromptForRelationships(prompt)
                                  .then(() => setShowRelationshipsDialog(true))
                                  .catch(error => {
                                    console.error('Error selecting prompt for relationships:', error);
                                    setShowRelationshipsDialog(true);
                                  });
                              }
                            }}
                          >
                            Edit Relationships
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Relationships Dialog */}
          <Dialog open={showRelationshipsDialog} onOpenChange={setShowRelationshipsDialog}>
            <DialogContent className="bg-white border-gray-200 shadow-lg max-w-5xl">
              <DialogHeader className="bg-white">
                <DialogTitle>Manage Prompt Relationships</DialogTitle>
                <DialogDescription>
                  Link prompts to related markdown documentation files
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-h-[500px] bg-white">
                {/* Prompts List - takes 2/7 of the space */}
                <div className="md:col-span-2 border rounded-md p-2 bg-white">
                  <div className="font-medium text-sm mb-2">Select a Prompt</div>
                  <ScrollArea className="h-[450px] bg-white">
                    {databasePrompts.length > 0 ? (
                      databasePrompts.map(prompt => (
                        <div 
                          key={prompt.id}
                          className={`p-2 mb-1 rounded cursor-pointer hover:bg-accent ${selectedRelationshipPrompt?.id === prompt.id ? 'bg-accent' : ''}`}
                          onClick={() => {
                            selectPromptForRelationships(prompt).catch(error => {
                              console.error('Error selecting prompt for relationships:', error);
                            });
                          }}
                        >
                          <div className="font-medium text-sm">{prompt.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {prompt.description || 'No description'}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {prompt.metadata.relatedAssets ? 
                              `${prompt.metadata.relatedAssets.length} related files` : 
                              'No related files'}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground py-4">
                        No prompts available
                      </div>
                    )}
                  </ScrollArea>
                </div>
                
                {/* Documentation Files - takes 5/7 of the space */}
                <div className="md:col-span-5 border rounded-md p-2 bg-white">
                  <div className="mb-2 bg-white">
                    <div className="font-medium text-sm mb-2">Related Documentation Files</div>
                    <Input 
                      placeholder="Filter markdown files..." 
                      value={relationshipsFilter}
                      onChange={(e) => setRelationshipsFilter(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  
                  {/* Message explaining individual card settings */}
                  {selectedRelationshipPrompt && (
                    <div className="p-3 mb-3 border border-blue-200 rounded-md bg-blue-50">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Relationship Settings</h4>
                      <p className="text-xs text-blue-700">
                        Configure relationship settings on each file card. Changes will be saved when you click "Save Relationships".
                      </p>
                    </div>
                  )}
                  
                  {!selectedRelationshipPrompt ? (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground bg-white">
                      Please select a prompt from the list
                    </div>
                  ) : (
                    <ScrollArea className="h-[330px] bg-white">
                      {isLoading.loadingDocFiles ? (
                        <div className="text-center py-4">Loading documentation files...</div>
                      ) : documentationFiles.length === 0 ? (
                        <div className="text-center py-4">No documentation files found</div>
                      ) : (
                        documentationFiles
                          .filter(file => {
                            if (!relationshipsFilter) return true;
                            
                            // Special case for searching package.json files
                            if (relationshipsFilter.toLowerCase().includes('package') || 
                                relationshipsFilter.toLowerCase().includes('pkg') || 
                                relationshipsFilter.toLowerCase().includes('json')) {
                              if (file.metadata?.isPackageJson || 
                                  file.file_path.toLowerCase().includes('package.json')) {
                                return true;
                              }
                            }
                            
                            return (
                              file.file_path.toLowerCase().includes(relationshipsFilter.toLowerCase()) ||
                              file.title.toLowerCase().includes(relationshipsFilter.toLowerCase())
                            );
                          })
                          .map(file => {
                            // Get settings for this file if it exists
                            const fileSettings = assetRelationshipSettings[file.id];
                            const isSelected = selectedRelatedAssets.includes(file.id);
                            
                            return (
                              <div 
                                key={file.id}
                                className={`p-2 hover:bg-accent rounded mb-1 ${
                                  isSelected ? 'border-l-4 border-blue-500 pl-2' : ''
                                } ${
                                  file.metadata?.isPackageJson || file.file_path.toLowerCase().includes('package.json') 
                                    ? 'bg-yellow-50 hover:bg-yellow-100' : ''
                                }`}
                              >
                                <div className="flex items-start">
                                  <Checkbox 
                                    id={`file-${file.id}`} 
                                    checked={isSelected}
                                    onCheckedChange={() => {
                                      toggleRelatedAsset(file.id).catch(error => {
                                        console.error('Error toggling related asset:', error);
                                      });
                                    }}
                                    className="mr-2 mt-1"
                                  />
                                  <div className="flex-1">
                                    <div className="flex justify-between">
                                      <Label htmlFor={`file-${file.id}`} className="font-medium cursor-pointer">
                                        {file.title}
                                        {(file.metadata?.isPackageJson || file.file_path.toLowerCase().includes('package.json')) && (
                                          <Badge className="ml-2 text-xs bg-yellow-100 text-yellow-800 border border-yellow-300">
                                            package.json
                                          </Badge>
                                        )}
                                      </Label>
                                      
                                      {isSelected && fileSettings && (
                                        <Badge className="ml-2 text-xs bg-blue-100 text-blue-800">
                                          {fileSettings.relationship_type}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="text-xs text-muted-foreground">
                                      {file.file_path}
                                    </div>
                                    
                                    {isSelected && fileSettings && fileSettings.relationship_context && (
                                      <div className="text-xs text-green-700 mt-1 italic">
                                        Context: {fileSettings.relationship_context}
                                      </div>
                                    )}
                                    
                                    {/* Enhanced settings for each selected file card */}
                                    {isSelected && (
                                      <div className="mt-3 p-2 border border-blue-200 rounded-md bg-blue-50">
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                          {/* Relationship Type */}
                                          <div className="space-y-1">
                                            <Label className="text-xs text-blue-800">Reference Type</Label>
                                            <Select 
                                              value={fileSettings?.relationship_type || 'reference'}
                                              onValueChange={(value) => {
                                                // Update the asset settings cache with the new relationship type
                                                setAssetRelationshipSettings(prev => ({
                                                  ...prev,
                                                  [file.id]: {
                                                    ...prev[file.id] || {
                                                      relationship_context: '',
                                                      description: '',
                                                      document_type_id: fileSettings?.document_type_id || 'none'
                                                    },
                                                    relationship_type: value
                                                  }
                                                }));
                                                
                                                // Update global field if this is the only selected asset
                                                if (selectedRelatedAssets.length === 1) {
                                                  setRelationshipType(value);
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-7 text-xs bg-white">
                                                <SelectValue placeholder="Select type" />
                                              </SelectTrigger>
                                              <SelectContent className="bg-white">
                                                <SelectItem value="reference">Reference</SelectItem>
                                                <SelectItem value="dependency">Dependency</SelectItem>
                                                <SelectItem value="enhancement">Enhancement</SelectItem>
                                                <SelectItem value="alternative">Alternative</SelectItem>
                                                <SelectItem value="parent">Parent</SelectItem>
                                                <SelectItem value="child">Child</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                          
                                          {/* Document Type */}
                                          <div className="space-y-1">
                                            <Label className="text-xs text-blue-800">Document Type</Label>
                                            <Select 
                                              value={fileSettings?.document_type_id || 'none'}
                                              onValueChange={(value) => {
                                                // Update the asset settings cache with the new document type
                                                setAssetRelationshipSettings(prev => ({
                                                  ...prev,
                                                  [file.id]: {
                                                    ...prev[file.id] || {
                                                      relationship_type: fileSettings?.relationship_type || 'reference',
                                                      relationship_context: fileSettings?.relationship_context || '',
                                                      description: fileSettings?.description || '',
                                                    },
                                                    document_type_id: value
                                                  }
                                                }));
                                                
                                                // Update global field if this is the only selected asset
                                                if (selectedRelatedAssets.length === 1) {
                                                  setRelationshipDocumentTypeId(value);
                                                }
                                              }}
                                            >
                                              <SelectTrigger className="h-7 text-xs bg-white">
                                                <SelectValue placeholder="Select type">
                                                  {fileSettings?.document_type_id && fileSettings.document_type_id !== 'none' 
                                                    ? documentTypes.find(dt => dt.id === fileSettings.document_type_id)?.document_type || 'Custom'
                                                    : 'Select document type'}
                                                </SelectValue>
                                              </SelectTrigger>
                                              <SelectContent className="bg-white">
                                                <SelectItem value="none">None</SelectItem>
                                                {documentTypes.map((type) => (
                                                  <SelectItem key={type.id} value={type.id}>
                                                    {type.document_type}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        
                                        {/* Context */}
                                        <div className="space-y-1 mb-2">
                                          <Label className="text-xs text-blue-800">Context</Label>
                                          <Textarea 
                                            placeholder="E.g., Used for analysis of" 
                                            className="text-xs min-h-[40px] bg-white" 
                                            value={fileSettings?.relationship_context || ''}
                                            onChange={(e) => {
                                              setAssetRelationshipSettings(prev => ({
                                                ...prev,
                                                [file.id]: {
                                                  ...prev[file.id] || {
                                                    relationship_type: fileSettings?.relationship_type || 'reference',
                                                    description: fileSettings?.description || '',
                                                    document_type_id: fileSettings?.document_type_id || 'none',
                                                  },
                                                  relationship_context: e.target.value
                                                }
                                              }));
                                              
                                              // Update global field if this is the only selected asset
                                              if (selectedRelatedAssets.length === 1) {
                                                setRelationshipContext(e.target.value);
                                              }
                                            }}
                                          />
                                        </div>
                                        
                                        {/* Description */}
                                        <div className="space-y-1">
                                          <Label className="text-xs text-blue-800">Description</Label>
                                          <Textarea 
                                            placeholder="Detailed description of how this prompt relates to the file" 
                                            className="text-xs min-h-[40px] bg-white" 
                                            value={fileSettings?.description || ''}
                                            onChange={(e) => {
                                              setAssetRelationshipSettings(prev => ({
                                                ...prev,
                                                [file.id]: {
                                                  ...prev[file.id] || {
                                                    relationship_type: fileSettings?.relationship_type || 'reference',
                                                    relationship_context: fileSettings?.relationship_context || '',
                                                    document_type_id: fileSettings?.document_type_id || 'none',
                                                  },
                                                  description: e.target.value
                                                }
                                              }));
                                              
                                              // Update global field if this is the only selected asset
                                              if (selectedRelatedAssets.length === 1) {
                                                setRelationshipDescription(e.target.value);
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    
                                    <div className="text-xs text-slate-500 mt-1">
                                      {file.last_modified_at ? 
                                        `Modified: ${new Date(file.last_modified_at).toLocaleDateString()}` : 
                                        `Created: ${new Date(file.created_at).toLocaleDateString()}`}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </ScrollArea>
                  )}
                </div>
              </div>
              
              {/* Database Query Section */}
              <div className="border-t pt-4 mt-4 bg-white">
                <div className="space-y-4">
                  {/* First Database Query */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="databaseQuery" className="text-sm font-medium">
                        Database Query
                        <span className="ml-2 text-xs text-muted-foreground">(Primary)</span>
                      </Label>
                      <Badge className="bg-blue-100 text-blue-800 border border-blue-200 font-mono">SQL</Badge>
                    </div>
                    <Textarea 
                      id="databaseQuery" 
                      placeholder="SELECT * FROM documentations WHERE category = 'guides'" 
                      className="font-mono text-sm h-24"
                      value={databaseQuery}
                      onChange={(e) => setDatabaseQuery(e.target.value)}
                    />
                  </div>
                  
                  {/* Second Database Query */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="databaseQuery2" className="text-sm font-medium">
                        Database Query 2
                        <span className="ml-2 text-xs text-muted-foreground">(Secondary)</span>
                      </Label>
                      <Badge className="bg-blue-100 text-blue-800 border border-blue-200 font-mono">SQL</Badge>
                    </div>
                    <Textarea 
                      id="databaseQuery2" 
                      placeholder="SELECT * FROM related_data WHERE prompt_id = :prompt_id" 
                      className="font-mono text-sm h-24"
                      value={databaseQuery2}
                      onChange={(e) => setDatabaseQuery2(e.target.value)}
                    />
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    These queries will be stored with the prompt's metadata and can be used for dynamic data retrieval.
                  </p>
                </div>
              </div>
              
              <DialogFooter className="flex justify-between mt-4 bg-white pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  {selectedRelatedAssets.length} file(s) selected
                </div>
                <div className="space-x-2">
                  <Button variant="outline" onClick={() => {
                    setShowRelationshipsDialog(false);
                    setSelectedRelationshipPrompt(null);
                    setSelectedRelatedAssets([]);
                    setRelationshipType('reference');
                    setRelationshipContext('');
                    setRelationshipDescription('');
                    setRelationshipDocumentTypeId('none');
                    setDatabaseQuery('');
                    setAssetRelationshipSettings({});
                  }}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={saveRelationships}
                    disabled={!selectedRelationshipPrompt || isLoading.savingRelationships}
                  >
                    {isLoading.savingRelationships ? 'Saving...' : 'Save Relationships'}
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New Category Dialog */}
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogContent className="bg-white border-gray-200 shadow-lg">
              <DialogHeader className="bg-white">
                <DialogTitle>Create Prompt Category</DialogTitle>
                <DialogDescription>
                  Add a new category to organize your prompts
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">Category Name</Label>
                  <Input 
                    id="categoryName" 
                    value={newCategoryName} 
                    onChange={(e) => setNewCategoryName(e.target.value)} 
                    placeholder="e.g., Code Analysis" 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="categoryDescription">Description (Optional)</Label>
                  <Textarea 
                    id="categoryDescription" 
                    value={newCategoryDescription} 
                    onChange={(e) => setNewCategoryDescription(e.target.value)} 
                    placeholder="A brief description of what prompts belong in this category" 
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={createPromptCategory} 
                  disabled={!newCategoryName || isLoading.creatingCategory}
                >
                  {isLoading.creatingCategory ? 'Creating...' : 'Create Category'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Configure your Claude Sonnet 3.7 API settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">Claude API Key</Label>
                  <Input 
                    id="apiKey" 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="Enter your Claude API key" 
                  />
                  <p className="text-sm text-muted-foreground">
                    Your API key is stored in local storage and never sent to our servers.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="defaultTemperature">Default Temperature: {temperature.toFixed(2)}</Label>
                  </div>
                  <Slider 
                    id="defaultTemperature"
                    min={0} 
                    max={1} 
                    step={0.01} 
                    value={[temperature]} 
                    onValueChange={(value) => setTemperature(value[0])} 
                  />
                  <p className="text-sm text-muted-foreground">
                    Lower values (0) make responses more deterministic and focused.
                    Higher values allow more creativity and variation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AI;