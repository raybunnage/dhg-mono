import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExpertDocument } from '@/types/expert';
import { toast } from 'sonner';
import { expertService } from '@/services/expert-service';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MoreHorizontal, Plus, RefreshCw, Trash2, Edit, Eye, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ExpertDocumentListProps {
  expertId?: string;
  onSelectDocument: (document: ExpertDocument) => void;
  onAddDocument: () => void;
  onEditDocument: (document: ExpertDocument) => void;
  onDeleteDocument: (document: ExpertDocument) => void;
  onProcessDocument?: (document: ExpertDocument) => void;
}

export function ExpertDocumentList({
  expertId,
  onSelectDocument,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onProcessDocument
}: ExpertDocumentListProps) {
  const [documents, setDocuments] = useState<ExpertDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sourcesMap, setSourcesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDocuments();
    loadSourcesMap();
  }, [expertId]);

  async function loadDocuments() {
    try {
      setLoading(true);
      
      // Use our expert service
      const documents = await expertService.getExpertDocuments(expertId);
      setDocuments(documents);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load expert documents');
    } finally {
      setLoading(false);
    }
  }

  async function loadSourcesMap() {
    try {
      // Use our expert service
      const sources = await expertService.getSourcesMap();
      setSourcesMap(sources);
    } catch (error) {
      console.error('Error loading sources map:', error);
    }
  }

  const refreshDocuments = async () => {
    setIsRefreshing(true);
    await loadDocuments();
    setIsRefreshing(false);
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

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">
            {expertId ? 'Expert Documents' : 'All Expert Documents'}
          </h3>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshDocuments}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={onAddDocument}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-220px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                      No documents found
                    </TableCell>
                  </TableRow>
                ) : (
                  documents.map(document => (
                    <TableRow 
                      key={document.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => onSelectDocument(document)}
                    >
                      <TableCell>
                        <div className="font-medium">{document.title || 'Untitled Document'}</div>
                      </TableCell>
                      <TableCell>{sourcesMap[document.source_id] || document.source_id}</TableCell>
                      <TableCell>{document.document_type}</TableCell>
                      <TableCell>{format(new Date(document.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{getStatusBadge(document.processing_status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onSelectDocument(document);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            
                            {onProcessDocument && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onProcessDocument(document);
                              }}>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Process Document
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              onEditDocument(document);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteDocument(document);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}