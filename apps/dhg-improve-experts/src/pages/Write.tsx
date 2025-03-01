import React, { useState, useEffect } from 'react';
import { FileText, FolderOpen, PenTool, Eye, Zap, CheckSquare, X, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FileNode } from '@/components/FileTree';
import { supabase } from '@/integrations/supabase/client';
import { ExpertDocument } from '@/types/expert';
import { toast } from 'react-hot-toast';

interface DocumentSummary {
  id: string;
  title: string;
  document_type: string;
  content: string | null;
}

interface RelatedDocument {
  id: string;
  source_id: string;
  title: string;
  document_type: string;
  isSelected: boolean;
}

export default function Write() {
  const [activeTab, setActiveTab] = useState<string>('select');
  const [selectedFolder, setSelectedFolder] = useState<FileNode | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<FileNode | null>(null);
  const [relatedDocuments, setRelatedDocuments] = useState<RelatedDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [folders, setFolders] = useState<FileNode[]>([]);
  const [documents, setDocuments] = useState<FileNode[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [showPromptDialog, setShowPromptDialog] = useState<boolean>(false);
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [documentsLoading, setDocumentsLoading] = useState<boolean>(false);
  const [summaryType, setSummaryType] = useState<string>('comprehensive');
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<FileNode | null>(null);
  const [documentSummaries, setDocumentSummaries] = useState<{[key: string]: DocumentSummary}>({});

  // Fetch folders and documents on component mount
  useEffect(() => {
    fetchDocumentTypes();
    fetchFolders();
    fetchDocuments();
  }, []);

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('uni_document_types')
        .select('document_type')
        .order('document_type');
      
      if (error) throw error;
      setDocumentTypes(data.map(item => item.document_type));
    } catch (error) {
      console.error('Error fetching document types:', error);
      toast.error('Failed to load document types');
    }
  };

  const fetchFolders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('sources_google')
        .select('*')
        .eq('mime_type', 'application/vnd.google-apps.folder')
        .order('name');
      
      if (error) throw error;
      setFolders(data as FileNode[]);
    } catch (error) {
      console.error('Error fetching folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async () => {
    setDocumentsLoading(true);
    try {
      let query = supabase
        .from('sources_google')
        .select('*')
        .neq('mime_type', 'application/vnd.google-apps.folder');
      
      // If folder is selected, filter by parent_path
      if (selectedFolder) {
        query = query.eq('parent_path', selectedFolder.path);
      }
      
      // If search term is provided, filter by name
      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      // If document type is selected, filter by mime_type
      if (selectedDocumentType) {
        query = query.eq('document_type', selectedDocumentType);
      }
      
      const { data, error } = await query.order('name');
      
      if (error) throw error;
      setDocuments(data as FileNode[]);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleFolderSelect = (folder: FileNode) => {
    setSelectedFolder(folder);
    setSelectedDocument(null);
    fetchDocuments();
  };

  const clearFolderSelection = () => {
    setSelectedFolder(null);
    fetchDocuments();
  };

  const handleDocumentSelect = async (document: FileNode) => {
    setSelectedDocument(document);
    
    // Find related documents when selecting a document
    findRelatedDocuments(document);
  };

  const findRelatedDocuments = async (document: FileNode) => {
    try {
      // Fetch documents from the same folder
      const { data: folderDocs, error: folderError } = await supabase
        .from('sources_google')
        .select('*')
        .eq('parent_path', document.parent_path)
        .neq('id', document.id) // Exclude the selected document
        .limit(20);
      
      if (folderError) throw folderError;

      // Check if these documents have expert documents
      const sourceIds = folderDocs.map(doc => doc.id);
      
      const { data: expertDocs, error: expertError } = await supabase
        .from('expert_documents')
        .select('*')
        .in('source_id', sourceIds);
      
      if (expertError) throw expertError;
      
      // Create a map of source_id to expert document
      const expertDocsMap = new Map();
      expertDocs?.forEach(doc => expertDocsMap.set(doc.source_id, doc));
      
      // Create related documents array
      const related = folderDocs.map(doc => ({
        id: doc.id,
        source_id: doc.id,
        title: doc.name,
        document_type: doc.document_type || 'unknown',
        isSelected: false
      }));
      
      setRelatedDocuments(related);
    } catch (error) {
      console.error('Error finding related documents:', error);
      toast.error('Failed to find related documents');
    }
  };

  const toggleRelatedDocument = (id: string) => {
    setRelatedDocuments(prevDocs => 
      prevDocs.map(doc => 
        doc.id === id ? { ...doc, isSelected: !doc.isSelected } : doc
      )
    );
  };

  const extractDriveId = (url: string | null): string | null => {
    if (!url) return null;
    const match = url.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleDocumentTypeSelect = (type: string) => {
    setSelectedDocumentType(type === selectedDocumentType ? null : type);
  };

  const handleViewPreview = (document: FileNode) => {
    setPreviewDoc(document);
  };

  const closePreview = () => {
    setPreviewDoc(null);
  };

  const fetchDocumentSummary = async (sourceId: string) => {
    // Check if we already have this summary
    if (documentSummaries[sourceId]) return;
    
    try {
      const { data, error } = await supabase
        .from('expert_documents')
        .select('id, title, document_type, processed_content')
        .eq('source_id', sourceId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        // Extract a summary from the processed content
        let content = '';
        if (typeof data.processed_content === 'string') {
          content = data.processed_content.substring(0, 200) + '...';
        } else if (data.processed_content && data.processed_content.summary) {
          content = data.processed_content.summary;
        } else if (data.processed_content) {
          content = JSON.stringify(data.processed_content).substring(0, 200) + '...';
        }
        
        setDocumentSummaries(prev => ({
          ...prev,
          [sourceId]: {
            id: data.id,
            title: data.title || 'Untitled',
            document_type: data.document_type,
            content
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching document summary:', error);
    }
  };

  const handleNextStep = () => {
    if (activeTab === 'select' && selectedDocument) {
      setActiveTab('related');
    } else if (activeTab === 'related') {
      setActiveTab('prompt');
    } else if (activeTab === 'prompt') {
      handleGenerate();
    }
  };

  const handlePreviousStep = () => {
    if (activeTab === 'related') {
      setActiveTab('select');
    } else if (activeTab === 'prompt') {
      setActiveTab('related');
    } else if (activeTab === 'summary') {
      setActiveTab('prompt');
    }
  };

  const handleGenerate = () => {
    // Show loading state
    setIsLoading(true);
    setError(null);
    
    // In a real implementation, this would call your AI processing API
    // For this example, we'll simulate the generation with a timeout
    setTimeout(() => {
      try {
        // Get selected related documents
        const selectedRelated = relatedDocuments.filter(doc => doc.isSelected);
        
        // Create a mock summary based on the selected documents
        const mockSummary = createMockSummary(selectedDocument, selectedRelated, promptInput, summaryType);
        
        setGeneratedContent(mockSummary);
        setActiveTab('summary');
      } catch (err) {
        setError('Failed to generate summary: ' + (err.message || 'Unknown error'));
      } finally {
        setIsLoading(false);
      }
    }, 2000);
  };

  const createMockSummary = (
    mainDoc: FileNode | null, 
    relatedDocs: RelatedDocument[], 
    prompt: string,
    type: string
  ): string => {
    // This is a mock function that creates a sample summary
    // In a real implementation, this would be replaced with actual AI generation
    const docTitle = mainDoc?.name || 'Untitled Document';
    const relatedCount = relatedDocs.length;
    const relatedTitles = relatedDocs.map(doc => doc.title).join(', ');
    
    let summaryContent = '';
    
    if (type === 'comprehensive') {
      summaryContent = `# Comprehensive Analysis: ${docTitle}

## Executive Summary
This comprehensive analysis integrates insights from the primary document "${docTitle}" and ${relatedCount} related sources to provide a holistic understanding of the subject matter.

## Key Findings
1. The primary document establishes the foundational concepts related to the topic.
2. Supporting documents provide additional context and evidence that strengthen the main arguments.
3. Integration of multiple perspectives reveals patterns that might be missed when examining documents in isolation.

## Integrated Analysis
The combination of these ${relatedCount + 1} documents provides a robust framework for understanding the topic. ${prompt}

## Sources Referenced
- Primary: ${docTitle}
- Related: ${relatedTitles}

This summary was generated based on your specific query: "${prompt}"`;
    } else if (type === 'comparative') {
      summaryContent = `# Comparative Analysis: ${docTitle}

## Overview
This analysis compares and contrasts ${docTitle} with ${relatedCount} related documents to identify similarities, differences, and unique insights.

## Similarities
- Core concepts appear consistently across the document set
- Methodological approaches share common features
- Key stakeholders are recognized throughout the materials

## Differences
- ${docTitle} emphasizes certain aspects not addressed in the related materials
- Later documents show evolution in thinking around key topics
- Regional variations are evident in implementation approaches

## Synthesis of Insights
${prompt}

## Referenced Documents
- Primary: ${docTitle}
- Compared with: ${relatedTitles}`;
    } else {
      // Executive summary
      summaryContent = `# Executive Summary: ${docTitle}

This concise summary distills the essential points from ${docTitle} and ${relatedCount} supporting documents.

## Core Message
The primary document establishes that ${prompt}

## Supporting Evidence
The related documents (${relatedTitles}) provide corroborating evidence through:
- Additional case studies
- Statistical validation
- Expert perspectives

## Implications
Based on the combined analysis, organizations should consider:
1. Adjusting strategic approaches based on these findings
2. Implementing targeted interventions in key areas
3. Conducting further research to address remaining questions

## Conclusion
The integrated analysis of these materials suggests a clear direction forward that balances innovation with established best practices.`;
    }
    
    return summaryContent;
  };

  const handleOpenPromptDialog = () => {
    setShowPromptDialog(true);
    // Set default prompt based on document
    if (selectedDocument) {
      const docName = selectedDocument.name;
      const relatedCount = relatedDocuments.filter(d => d.isSelected).length;
      setAiPrompt(`Analyze ${docName} and the ${relatedCount} selected related documents to create a comprehensive research summary. Identify key themes, methodologies, findings, and how they relate to each other. Highlight any contradictions or supporting evidence between documents.`);
    }
  };

  const handleSavePrompt = () => {
    setPromptInput(aiPrompt);
    setShowPromptDialog(false);
  };

  // Filter documents by search term
  const filteredDocuments = searchTerm
    ? documents.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : documents;

  // Render the Select Document tab
  const renderSelectTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Select Folder or Document</CardTitle>
            <CardDescription>Browse for a primary document to analyze</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={handleSearch}
                className="mb-2"
              />
              
              <div className="space-y-1 mb-4">
                <p className="text-sm font-medium">Filter by type:</p>
                <div className="flex flex-wrap gap-2">
                  {documentTypes.slice(0, 10).map(type => (
                    <Badge 
                      key={type} 
                      variant={selectedDocumentType === type ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => handleDocumentTypeSelect(type)}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Show selected folder with clear option */}
              {selectedFolder && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md mb-4">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{selectedFolder.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 ml-auto"
                    onClick={clearFolderSelection}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <ScrollArea className="h-[calc(100vh-22rem)]">
              {!selectedFolder && (
                <div className="space-y-1 mb-4">
                  <p className="text-sm font-medium">Folders</p>
                  {folders.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No folders found</p>
                  ) : (
                    <div className="space-y-1">
                      {folders.map(folder => (
                        <div
                          key={folder.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer"
                          onClick={() => handleFolderSelect(folder)}
                        >
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{folder.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              <div className="space-y-1">
                <p className="text-sm font-medium">Documents</p>
                {documentsLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No documents found</p>
                ) : (
                  <div className="space-y-1">
                    {filteredDocuments.map(doc => (
                      <div
                        key={doc.id}
                        className={`flex items-center gap-2 p-2 hover:bg-muted rounded-md cursor-pointer ${selectedDocument?.id === doc.id ? 'bg-muted' : ''}`}
                        onClick={() => handleDocumentSelect(doc)}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{doc.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 ml-auto"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewPreview(doc);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" disabled>Back</Button>
            <Button 
              onClick={handleNextStep}
              disabled={!selectedDocument}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="md:col-span-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
            <CardDescription>
              {selectedDocument ? selectedDocument.name : 'Select a document to preview'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100vh-16rem)]">
            {selectedDocument ? (
              <>
                {selectedDocument.web_view_link ? (
                  <div className="h-full w-full">
                    <iframe
                      src={`https://drive.google.com/file/d/${extractDriveId(selectedDocument.web_view_link)}/preview`}
                      className="w-full h-full rounded-lg"
                      title="Document Preview"
                      allow="autoplay"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        Preview not available for this document
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select a document to preview</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Render the Related Documents tab
  const renderRelatedTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Related Documents</CardTitle>
            <CardDescription>Select documents to include in your analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="p-4 border rounded-md bg-muted/50">
                <h3 className="font-medium">Primary Document</h3>
                <div className="flex items-center mt-2">
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  <span>{selectedDocument?.name}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Select Related Documents</h3>
              <ScrollArea className="h-[calc(100vh-24rem)]">
                {relatedDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No related documents found</p>
                ) : (
                  <div className="space-y-1">
                    {relatedDocuments.map(doc => {
                      // Fetch document summary if not already loaded
                      if (!documentSummaries[doc.source_id]) {
                        fetchDocumentSummary(doc.source_id);
                      }
                      
                      return (
                        <div key={doc.id} className="border rounded-md p-3 mb-2">
                          <div className="flex items-start">
                            <div className="mt-1">
                              <Button
                                size="sm"
                                variant={doc.isSelected ? "default" : "outline"}
                                className="h-6 w-6 p-0"
                                onClick={() => toggleRelatedDocument(doc.id)}
                              >
                                {doc.isSelected ? <CheckSquare className="h-4 w-4" /> : <div className="h-4 w-4 border rounded-sm" />}
                              </Button>
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="font-medium">{doc.title}</div>
                                <Badge variant="outline">{doc.document_type}</Badge>
                              </div>
                              
                              {documentSummaries[doc.source_id] && (
                                <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                  {documentSummaries[doc.source_id].content}
                                </div>
                              )}
                              
                              <div className="mt-2 flex justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6"
                                  onClick={() => handleViewPreview({
                                    ...doc,
                                    name: doc.title,
                                    mime_type: 'application/pdf', // Assuming PDF for demonstration
                                  } as FileNode)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Preview
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePreviousStep}>Back</Button>
            <Button 
              onClick={handleNextStep}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="md:col-span-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Selected Documents</CardTitle>
            <CardDescription>
              {relatedDocuments.filter(d => d.isSelected).length} related documents selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-md bg-blue-50">
                <h3 className="font-medium text-blue-800">Primary Document</h3>
                <div className="flex items-center mt-2">
                  <FileText className="h-4 w-4 mr-2 text-blue-600" />
                  <span className="text-blue-800">{selectedDocument?.name}</span>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-3">Selected Related Documents</h3>
                {relatedDocuments.filter(doc => doc.isSelected).length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No related documents selected</p>
                ) : (
                  <ScrollArea className="h-[calc(100vh-24rem)]">
                    <div className="space-y-2">
                      {relatedDocuments
                        .filter(doc => doc.isSelected)
                        .map(doc => (
                          <div key={doc.id} className="p-3 border rounded-md">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{doc.title}</div>
                              <Badge variant="outline">{doc.document_type}</Badge>
                            </div>
                            {documentSummaries[doc.source_id] && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                {documentSummaries[doc.source_id].content}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Render the Prompt tab
  const renderPromptTab = () => (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Configure Summary</CardTitle>
            <CardDescription>Set parameters for your multi-document summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="summary-type">Summary Type</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <Button
                    variant={summaryType === 'comprehensive' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setSummaryType('comprehensive')}
                  >
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-2 ${summaryType === 'comprehensive' ? 'bg-primary' : 'border'}`} />
                      <div>
                        <div className="font-medium">Comprehensive Analysis</div>
                        <div className="text-xs text-muted-foreground">Detailed integration of all documents</div>
                      </div>
                    </div>
                  </Button>
                  
                  <Button
                    variant={summaryType === 'comparative' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setSummaryType('comparative')}
                  >
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-2 ${summaryType === 'comparative' ? 'bg-primary' : 'border'}`} />
                      <div>
                        <div className="font-medium">Comparative Analysis</div>
                        <div className="text-xs text-muted-foreground">Compare and contrast key findings</div>
                      </div>
                    </div>
                  </Button>
                  
                  <Button
                    variant={summaryType === 'executive' ? 'default' : 'outline'}
                    className="justify-start"
                    onClick={() => setSummaryType('executive')}
                  >
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full mr-2 ${summaryType === 'executive' ? 'bg-primary' : 'border'}`} />
                      <div>
                        <div className="font-medium">Executive Summary</div>
                        <div className="text-xs text-muted-foreground">Concise overview of key points</div>
                      </div>
                    </div>
                  </Button>
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label htmlFor="prompt">Custom Instructions</Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleOpenPromptDialog}
                  >
                    <PenTool className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </div>
                <div className="p-4 bg-muted rounded-md">
                  {promptInput ? (
                    <p className="text-sm">{promptInput}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No custom instructions provided. Click "Edit" to add instructions.
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <Alert>
                  <AlertDescription>
                    Your summary will analyze {selectedDocument?.name} and {relatedDocuments.filter(d => d.isSelected).length} related documents to create a {summaryType} summary.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={handlePreviousStep}>Back</Button>
            <Button 
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  Generate Summary
                  <Zap className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="md:col-span-3">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Document Overview</CardTitle>
            <CardDescription>
              Summary will be generated from {1 + relatedDocuments.filter(d => d.isSelected).length} documents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-20rem)]">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="primary">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-blue-600" />
                      <span>Primary Document: {selectedDocument?.name}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-4 bg-muted rounded-md">
                      <p className="text-sm text-muted-foreground">
                        This document will serve as the primary source for your analysis.
                      </p>
                      
                      {/* Show document metadata if available */}
                      {selectedDocument && (
                        <div className="mt-4 space-y-2">
                          <div className="flex">
                            <span className="text-sm font-medium w-24">Type:</span>
                            <span className="text-sm">{selectedDocument.document_type || 'Unknown'}</span>
                          </div>
                          <div className="flex">
                            <span className="text-sm font-medium w-24">Size:</span>
                            <span className="text-sm">{selectedDocument.size || 'Unknown'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="related">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2 text-green-600" />
                      <span>Related Documents ({relatedDocuments.filter(d => d.isSelected).length})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {relatedDocuments.filter(doc => doc.isSelected).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic p-4">No related documents selected</p>
                    ) : (
                      <div className="space-y-2">
                        {relatedDocuments
                          .filter(doc => doc.isSelected)
                          .map(doc => (
                            <div key={doc.id} className="p-3 border rounded-md">
                              <div className="font-medium">{doc.title}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {doc.document_type}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="instructions">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <PenTool className="h-4 w-4 mr-2 text-purple-600" />
                      <span>Custom Instructions</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-4 bg-muted rounded-md">
                      {promptInput ? (
                        <p className="text-sm">{promptInput}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No custom instructions provided.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  // Render the Summary tab
  const renderSummaryTab = () => (
    <div className="grid grid-cols-1 gap-6">
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Generated Summary</CardTitle>
              <CardDescription>
                Based on {selectedDocument?.name} and {relatedDocuments.filter(d => d.isSelected).length} related documents
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Export
              </Button>
              <Button variant="outline" size="sm">
                Copy
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <ScrollArea className="h-[calc(100vh-16rem)] border rounded-md p-6">
              <div className="prose max-w-none">
                {generatedContent.split('\n').map((line, i) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={i} className="text-2xl font-bold mt-6 mb-4">{line.substring(2)}</h1>;
                  } else if (line.startsWith('## ')) {
                    return <h2 key={i} className="text-xl font-bold mt-5 mb-3">{line.substring(3)}</h2>;
                  } else if (line.startsWith('### ')) {
                    return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.substring(4)}</h3>;
                  } else if (line.startsWith('- ')) {
                    return <li key={i} className="ml-4">{line.substring(2)}</li>;
                  } else if (line.startsWith('1. ')) {
                    return <div key={i} className="flex"><span className="mr-2">{line.substring(0, 2)}</span><span>{line.substring(3)}</span></div>;
                  } else if (line.trim() === '') {
                    return <div key={i} className="h-4"></div>;
                  } else {
                    return <p key={i} className="my-2">{line}</p>;
                  }
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handlePreviousStep}>Back to Prompt</Button>
          <Button 
            onClick={() => {
              // Reset the form
              setActiveTab('select');
              setSelectedDocument(null);
              setSelectedFolder(null);
              setRelatedDocuments([]);
              setPromptInput('');
              setGeneratedContent('');
              setSummaryType('comprehensive');
            }}
          >
            Start New Summary
          </Button>
        </CardFooter>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <PenTool className="mr-2 h-8 w-8 text-primary" />
        Research Writer
      </h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="select" disabled={activeTab === 'summary'}>Select Document</TabsTrigger>
          <TabsTrigger value="related" disabled={!selectedDocument || activeTab === 'summary'}>Related Documents</TabsTrigger>
          <TabsTrigger value="prompt" disabled={!selectedDocument || activeTab === 'summary'}>Configure Summary</TabsTrigger>
          <TabsTrigger value="summary" disabled={!generatedContent}>View Summary</TabsTrigger>
        </TabsList>
        
        <TabsContent value="select">{renderSelectTab()}</TabsContent>
        <TabsContent value="related">{renderRelatedTab()}</TabsContent>
        <TabsContent value="prompt">{renderPromptTab()}</TabsContent>
        <TabsContent value="summary">{renderSummaryTab()}</TabsContent>
      </Tabs>
      
      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => closePreview()}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewDoc?.name}</DialogTitle>
            <DialogDescription>
              Document Preview
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-[60vh] overflow-hidden">
            {previewDoc?.web_view_link ? (
              <iframe
                src={`https://drive.google.com/file/d/${extractDriveId(previewDoc.web_view_link)}/preview`}
                className="w-full h-full border-0"
                title="Document Preview"
                allow="autoplay"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Preview not available for this document</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={closePreview}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Prompt Dialog */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Custom Instructions</DialogTitle>
            <DialogDescription>
              Provide specific instructions for generating your summary
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Enter instructions for how the AI should analyze your documents..."
              className="min-h-[200px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPromptDialog(false)}>Cancel</Button>
            <Button onClick={handleSavePrompt}>Save Instructions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}