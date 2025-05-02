import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExpertInterface, ExpertDocument } from '@/types/expert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExpertDocumentList } from './ExpertDocumentList';
import { Edit, RefreshCw, User } from 'lucide-react';
import { format } from 'date-fns';
import JsonFormatter from '@/components/JsonFormatter';

interface ExpertDetailViewProps {
  expert: ExpertInterface;
  onEdit: (expert: ExpertInterface) => void;
  onSelectDocument: (document: ExpertDocument) => void;
  onAddDocument: () => void;
  onEditDocument: (document: ExpertDocument) => void;
  onDeleteDocument: (document: ExpertDocument) => void;
  onProcessDocument: (document: ExpertDocument) => void;
}

export function ExpertDetailView({
  expert,
  onEdit,
  onSelectDocument,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onProcessDocument
}: ExpertDetailViewProps) {
  const [loading, setLoading] = useState(false);
  const [jsonView, setJsonView] = useState(false);

  // We no longer need to fetch enhanced profile through the service
  // Just use the expert's metadata directly
  useEffect(() => {
    setLoading(false);
  }, [expert.id]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{expert.expert_name}</h2>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setJsonView(!jsonView)}>
            {jsonView ? 'Formatted View' : 'JSON View'}
          </Button>
          <Button onClick={() => onEdit(expert)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Expert
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Full Name</div>
                <div>{expert.full_name || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Mnemonic</div>
                <div>{expert.mnemonic || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Core Group</div>
                <div>{expert.is_in_core_group ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                <div>{formatDate(expert.updated_at)}</div>
              </div>
              <div className="col-span-2">
                <div className="text-sm font-medium text-muted-foreground">Metadata</div>
                <div className="mt-1">
                  {expert.metadata ? (
                    <JsonFormatter data={expert.metadata} />
                  ) : (
                    <div className="text-gray-500 italic">No metadata available</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="documents">
          <ExpertDocumentList
            expertId={expert.id}
            onSelectDocument={onSelectDocument}
            onAddDocument={onAddDocument}
            onEditDocument={onEditDocument}
            onDeleteDocument={onDeleteDocument}
            onProcessDocument={onProcessDocument}
          />
        </TabsContent>
        
        <TabsContent value="enhanced" className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : jsonView ? (
            <Card>
              <CardHeader>
                <CardTitle>Expert Metadata JSON</CardTitle>
                <CardDescription>Raw data from the expert's metadata field</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[calc(100vh-300px)]">
                  <pre className="text-xs font-mono p-4 bg-muted rounded-md">
                    {JSON.stringify(expert.metadata, null, 2) || 'No metadata available'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {!expert.metadata ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <div className="mb-2">No metadata information available for this expert.</div>
                    <div className="text-sm mb-4">
                      The expert doesn't have any metadata yet. You can add metadata by editing the expert.
                    </div>
                    <Button variant="outline" onClick={() => onEdit(expert)} size="sm">
                      Edit Expert
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Expert Information</CardTitle>
                    <CardDescription>
                      Displaying the raw metadata content for {expert.full_name || expert.expert_name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <JsonFormatter data={expert.metadata} />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}