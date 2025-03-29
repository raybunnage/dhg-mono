import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExpertDocument } from '@/types/expert';
import { toast } from 'sonner';
import { expertService } from '@/services/expert-service';
import { documentPipelineAdapter } from '@/services/document-pipeline-adapter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Edit, RefreshCw, PlayCircle, Download, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface ExpertDocumentDetailProps {
  document: ExpertDocument;
  onBack: () => void;
  onEdit: (document: ExpertDocument) => void;
  onProcess: (document: ExpertDocument) => void;
}

export function ExpertDocumentDetail({
  document,
  onBack,
  onEdit,
  onProcess
}: ExpertDocumentDetailProps) {
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [expert, setExpert] = useState<{ expert_name: string; full_name: string | null } | null>(null);
  const [source, setSource] = useState<{ title: string } | null>(null);
  const [jsonView, setJsonView] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<ExpertDocument>(document);

  useEffect(() => {
    loadRelatedData();
    setCurrentDocument(document);
  }, [document.id]);

  async function loadRelatedData() {
    try {
      setLoading(true);
      
      // Use our expert service
      const [expertData, sourceData] = await Promise.all([
        expertService.getExpertBasicInfo(document.expert_id),
        expertService.getSourceInfo(document.source_id)
      ]);
      
      if (expertData) {
        setExpert(expertData);
      }
      
      if (sourceData) {
        setSource(sourceData);
      }
    } catch (error) {
      console.error('Error loading related data:', error);
      toast.error('Failed to load all document data');
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-600">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Handle processed content display
  const getProcessedContent = () => {
    if (!document.processed_content) return null;
    
    try {
      if (typeof document.processed_content === 'string') {
        return JSON.parse(document.processed_content);
      }
      return document.processed_content;
    } catch (e) {
      return document.processed_content;
    }
  };

  const processedContent = getProcessedContent();
  
  // Handle document processing using our service
  const handleProcessDocument = async () => {
    try {
      setProcessing(true);
      
      // Process the document using our adapter
      const success = await documentPipelineAdapter.processDocument(currentDocument.id);
      
      if (success) {
        toast.success('Document processed successfully');
        
        // Refresh the document to get the updated content
        const updatedDoc = await expertService.getExpertDocumentById(currentDocument.id);
        if (updatedDoc) {
          setCurrentDocument(updatedDoc);
        }
      } else {
        toast.error('Failed to process document');
      }
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('An error occurred while processing the document');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">{document.title || 'Untitled Document'}</h2>
        </div>
        <div className="flex space-x-2">
          {processedContent && (
            <Button variant="outline" onClick={() => setJsonView(!jsonView)}>
              {jsonView ? 'Formatted View' : 'JSON View'}
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={handleProcessDocument} 
            disabled={processing || currentDocument.processing_status === 'processing'}
          >
            <PlayCircle className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
            {processing ? 'Processing...' : 'Process'}
          </Button>
          <Button variant="outline" onClick={loadRelatedData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => onEdit(document)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Information</CardTitle>
          <CardDescription>Details about this expert document</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Document Type</div>
            <div>{document.document_type}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Status</div>
            <div>{getStatusBadge(currentDocument.processing_status)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Expert</div>
            <div>{expert ? `${expert.expert_name}${expert.full_name ? ` (${expert.full_name})` : ''}` : document.expert_id}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Source</div>
            <div>{source ? source.title : document.source_id}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Created</div>
            <div>{formatDate(document.created_at)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
            <div>{formatDate(document.updated_at)}</div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="raw">
        <TabsList>
          <TabsTrigger value="raw">Raw Content</TabsTrigger>
          <TabsTrigger value="processed" disabled={!currentDocument.processed_content}>Processed Content</TabsTrigger>
        </TabsList>
        
        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Raw Document Content</CardTitle>
              <CardDescription>Original content extracted from the source</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="whitespace-pre-wrap font-mono text-sm p-4 bg-muted rounded-md">
                  {document.raw_content || 'No raw content available'}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="processed">
          <Card>
            <CardHeader>
              <CardTitle>Processed Content</CardTitle>
              <CardDescription>AI-processed structured information</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-400px)]">
                {jsonView ? (
                  <pre className="text-xs font-mono p-4 bg-muted rounded-md">
                    {JSON.stringify(processedContent, null, 2)}
                  </pre>
                ) : (
                  <div className="p-4">
                    {!processedContent ? (
                      <div className="text-center text-muted-foreground">
                        No processed content available
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {processedContent.name && (
                          <div>
                            <h3 className="font-medium text-lg">Name</h3>
                            <p>{processedContent.name}</p>
                          </div>
                        )}
                        
                        {processedContent.title && (
                          <div>
                            <h3 className="font-medium text-lg">Title</h3>
                            <p>{processedContent.title}</p>
                          </div>
                        )}
                        
                        {processedContent.affiliations && processedContent.affiliations.length > 0 && (
                          <div>
                            <h3 className="font-medium text-lg">Affiliations</h3>
                            <ul className="list-disc pl-5">
                              {processedContent.affiliations.map((item: string, i: number) => (
                                <li key={i}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {processedContent.bio && (
                          <div>
                            <h3 className="font-medium text-lg">Biography</h3>
                            <p className="whitespace-pre-wrap">{processedContent.bio}</p>
                          </div>
                        )}
                        
                        {processedContent.expertise && processedContent.expertise.length > 0 && (
                          <div>
                            <h3 className="font-medium text-lg">Expertise</h3>
                            <div className="flex flex-wrap gap-2">
                              {processedContent.expertise.map((item: string, i: number) => (
                                <span key={i} className="bg-muted rounded-full px-3 py-1 text-sm">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {processedContent.education && processedContent.education.length > 0 && (
                          <div>
                            <h3 className="font-medium text-lg">Education</h3>
                            <div className="space-y-3">
                              {processedContent.education.map((edu: any, i: number) => (
                                <div key={i} className="border-l-2 border-muted pl-4">
                                  <div className="font-medium">{edu.degree} in {edu.field}</div>
                                  <div>{edu.institution}</div>
                                  <div className="text-sm text-muted-foreground">{edu.year}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {processedContent.experience && processedContent.experience.length > 0 && (
                          <div>
                            <h3 className="font-medium text-lg">Experience</h3>
                            <div className="space-y-4">
                              {processedContent.experience.map((exp: any, i: number) => (
                                <div key={i} className="border-l-2 border-muted pl-4">
                                  <div className="font-medium">{exp.role}</div>
                                  <div>{exp.organization}</div>
                                  <div className="text-sm text-muted-foreground">{exp.duration}</div>
                                  {exp.description && <div className="mt-1">{exp.description}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {processedContent.publications && processedContent.publications.length > 0 && (
                          <div>
                            <h3 className="font-medium text-lg">Publications</h3>
                            <div className="space-y-3">
                              {processedContent.publications.map((pub: any, i: number) => (
                                <div key={i} className="border-l-2 border-muted pl-4">
                                  <div className="font-medium">{pub.title}</div>
                                  <div>{pub.journal}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {pub.year} • {pub.authors?.join(', ')}
                                  </div>
                                  {pub.url && (
                                    <a href={pub.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                                      View Publication
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {processedContent.awards && processedContent.awards.length > 0 && (
                          <div>
                            <h3 className="font-medium text-lg">Awards & Honors</h3>
                            <div className="space-y-3">
                              {processedContent.awards.map((award: any, i: number) => (
                                <div key={i} className="border-l-2 border-muted pl-4">
                                  <div className="font-medium">{award.title}</div>
                                  <div>{award.organization}</div>
                                  <div className="text-sm text-muted-foreground">{award.year}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {processedContent.contact && (
                          <div>
                            <h3 className="font-medium text-lg">Contact Information</h3>
                            <div className="space-y-1">
                              {processedContent.contact.email && <div>Email: {processedContent.contact.email}</div>}
                              {processedContent.contact.phone && <div>Phone: {processedContent.contact.phone}</div>}
                              {processedContent.contact.website && <div>Website: {processedContent.contact.website}</div>}
                            </div>
                          </div>
                        )}
                        
                        {processedContent.social_media && Object.values(processedContent.social_media).some(v => v) && (
                          <div>
                            <h3 className="font-medium text-lg">Social Media</h3>
                            <div className="space-y-1">
                              {processedContent.social_media.linkedin && <div>LinkedIn: {processedContent.social_media.linkedin}</div>}
                              {processedContent.social_media.twitter && <div>Twitter: {processedContent.social_media.twitter}</div>}
                              {processedContent.social_media.github && <div>GitHub: {processedContent.social_media.github}</div>}
                              {processedContent.social_media.other && Object.entries(processedContent.social_media.other).map(([key, value]) => (
                                <div key={key}>{key}: {value}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}