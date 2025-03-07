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
import { supabase } from '@/integrations/supabase/client';

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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({
    loadingPrompts: false,
    savingPrompt: false,
    generatingPrompt: false,
    applyingPrompt: false,
    loadingDbPrompts: false,
    savingDbPrompt: false,
    importingPrompt: false,
    creatingCategory: false
  });
  
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
    
    loadPromptFiles();
    loadDocumentTypes();
    loadPromptCategories();
    loadDatabasePrompts();
  }, []);
  
  const loadDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('document_type', { ascending: true });
        
      if (error) throw error;
      
      if (data) {
        setDocumentTypes(data);
      }
    } catch (error) {
      console.error('Error loading document types:', error);
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
      toast.error('Failed to load prompt categories');
    }
  };
  
  const loadDatabasePrompts = async () => {
    setIsLoading(prev => ({ ...prev, loadingDbPrompts: true }));
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('updated_at', { ascending: false });
        
      if (error) throw error;
      
      if (data) {
        setDatabasePrompts(data);
      }
    } catch (error) {
      console.error('Error loading database prompts:', error);
      toast.error('Failed to load database prompts');
    } finally {
      setIsLoading(prev => ({ ...prev, loadingDbPrompts: false }));
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

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">AI Prompt Workshop</h1>
      
      <Tabs defaultValue="prompts" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="prompts">Prompts Library</TabsTrigger>
          <TabsTrigger value="editor">Prompt Editor</TabsTrigger>
          <TabsTrigger value="generator">Prompt Generator</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
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
                      <SelectTrigger>
                        <SelectValue placeholder="All Document Types" />
                      </SelectTrigger>
                      <SelectContent>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                        <SelectContent>
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
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
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
            <DialogContent className="bg-background border-border">
              <DialogHeader>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
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
          
          {/* New Category Dialog */}
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogContent className="bg-background border-border">
              <DialogHeader>
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