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
import { PromptFile, getPromptFiles, loadPromptContent as fetchPromptContent, savePromptContent, createPromptFile, generatePromptWithContext, applyPromptToFiles as applyPrompt } from '@/utils/prompt-manager';
import { toast } from 'react-hot-toast';

interface DocumentType {
  id: string;
  document_type: string;
  description: string | null;
  mime_type: string | null;
  category: string;
}

const AI: React.FC = () => {
  const [activeTab, setActiveTab] = useState('prompts');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [promptFiles, setPromptFiles] = useState<PromptFile[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0);
  const [apiKey, setApiKey] = useState<string>('');
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [newPromptName, setNewPromptName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({
    loadingPrompts: false,
    savingPrompt: false,
    generatingPrompt: false,
    applyingPrompt: false
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
    
    // Mock data for document types - in production, these would be loaded from the database
    setDocumentTypes([
      { id: '1', document_type: 'PDF Document', description: 'PDF files containing text content', mime_type: 'application/pdf', category: 'Document' },
      { id: '2', document_type: 'React Component', description: 'React component source files', mime_type: 'text/jsx', category: 'Code' },
      { id: '3', document_type: 'Expert Profile', description: 'Expert biographical information', mime_type: 'application/json', category: 'Profile' },
      { id: '4', document_type: 'Code Source', description: 'General source code files', mime_type: 'text/plain', category: 'Code' },
    ]);
  }, []);
  
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

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">AI Prompt Workshop</h1>
      
      <Tabs defaultValue="prompts" onValueChange={setActiveTab} value={activeTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="prompts">Prompts Library</TabsTrigger>
          <TabsTrigger value="editor">Prompt Editor</TabsTrigger>
          <TabsTrigger value="generator">Prompt Generator</TabsTrigger>
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