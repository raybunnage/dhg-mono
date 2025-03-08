import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { useToast } from '@/hooks/use-toast';

interface DocumentFile {
  id: string;
  file_path: string;
  title: string;
  summary: string | null;
  ai_generated_tags: string[] | null;
  manual_tags: string[] | null;
  last_modified_at: string;
  last_indexed_at: string;
  file_hash: string;
  metadata: {
    size: number;
    isPrompt: boolean;
  };
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export default function TestDocs() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('active');
  const [runningUpdate, setRunningUpdate] = useState(false);
  const [updateOutput, setUpdateOutput] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [tab]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documentation_files')
        .select('*')
        .eq('is_deleted', tab === 'deleted')
        .order('file_path');

      if (error) {
        throw error;
      }

      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const runDatabaseUpdate = async () => {
    setRunningUpdate(true);
    setUpdateOutput('Running update script...\n');

    try {
      const response = await fetch('/api/docs-sync', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setUpdateOutput(data.output || 'Update completed successfully');
      fetchDocuments();
    } catch (error) {
      console.error('Error running update script:', error);
      setUpdateOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRunningUpdate(false);
    }
  };

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.file_path.toLowerCase().includes(filter.toLowerCase()) ||
      doc.title.toLowerCase().includes(filter.toLowerCase()) ||
      (doc.ai_generated_tags &&
        doc.ai_generated_tags.some((tag) => tag.toLowerCase().includes(filter.toLowerCase())))
  );

  return (
    <MainLayout>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Documentation Files</h1>
          <Button onClick={runDatabaseUpdate} disabled={runningUpdate}>
            {runningUpdate ? 'Updating...' : 'Update Database'}
          </Button>
        </div>

        {updateOutput && (
          <div className="mb-6 p-4 bg-gray-100 rounded border">
            <h3 className="font-medium mb-2">Update Output:</h3>
            <pre className="whitespace-pre-wrap text-sm">{updateOutput}</pre>
          </div>
        )}

        <div className="mb-4">
          <Input
            placeholder="Filter by path, title, or tags"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-md"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="active">Active Documents</TabsTrigger>
            <TabsTrigger value="deleted">Deleted Documents</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Path</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead>Last Indexed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocuments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      No documents found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocuments.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{doc.file_path}</span>
                          {doc.metadata?.isPrompt && (
                            <Badge variant="outline" className="mt-1 w-fit">
                              Prompt
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{doc.title}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {doc.ai_generated_tags?.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="mr-1">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{doc.metadata?.size || 'N/A'} bytes</TableCell>
                      <TableCell>
                        {doc.last_modified_at
                          ? new Date(doc.last_modified_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {doc.last_indexed_at
                          ? new Date(doc.last_indexed_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          {!loading && `${filteredDocuments.length} documents found`}
        </div>
      </div>
    </MainLayout>
  );
}