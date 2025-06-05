import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Edit, RefreshCw, PlayCircle, Archive, ArrowLeft, Terminal, FileCode } from 'lucide-react';
import { format } from 'date-fns';
import { ScriptFile, scriptPipelineAdapter } from '@/services/script-pipeline-adapter';
import { scriptFileService } from '@/services/scriptFileService';

interface ScriptDetailProps {
  script: ScriptFile;
  onBack: () => void;
  onEdit?: (script: ScriptFile) => void;
  onArchive?: (script: ScriptFile) => void;
  onProcess?: (script: ScriptFile) => void;
}

export function ScriptDetail({
  script,
  onBack,
  onEdit,
  onArchive,
  onProcess
}: ScriptDetailProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentScript, setCurrentScript] = useState<ScriptFile>(script);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  
  useEffect(() => {
    loadScriptContent();
    setCurrentScript(script);
  }, [script.file_path]);
  
  async function loadScriptContent() {
    try {
      setLoading(true);
      
      const response = await scriptFileService.getFileContent(script.file_path);
      setContent(response.content);
    } catch (error) {
      console.error('Error loading script content:', error);
      toast.error('Failed to load script content');
    } finally {
      setLoading(false);
    }
  }
  
  // Process script using adapter
  const handleProcessScript = async () => {
    try {
      setProcessing(true);
      toast.loading('Processing script...');
      
      // Call the script pipeline adapter to process the script
      const result = await scriptPipelineAdapter.executeCommand('analyze', currentScript.file_path);
      
      if (result === 0) {
        toast.success('Script processed successfully');
        
        // Refresh the script to get the updated content
        await refreshScript();
        
        // Set analysis result
        setAnalysisResult({
          type: 'Success',
          document_type: 'Shell Script',
          categories: ['Utility', 'Data Processing'],
          language: getLanguageFromFilename(currentScript.file_path),
          lastProcessed: new Date().toISOString()
        });
      } else {
        toast.error('Failed to process script');
      }
    } catch (error) {
      console.error('Error processing script:', error);
      toast.error('An error occurred while processing the script');
    } finally {
      setProcessing(false);
    }
  };
  
  // Refresh the script data
  const refreshScript = async () => {
    try {
      setLoading(true);
      
      // Use the script pipeline adapter
      const scripts = await scriptPipelineAdapter.getRecentScripts();
      const updatedScript = scripts.find(s => s.file_path === currentScript.file_path);
      
      if (updatedScript) {
        setCurrentScript(updatedScript);
      }
      
      // Reload content
      await loadScriptContent();
    } catch (error) {
      console.error('Error refreshing script:', error);
      toast.error('Failed to refresh script data');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    try {
      return format(new Date(dateString), 'MMM d, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };
  
  const getStatusBadge = (status?: string) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-600">Active</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      case 'processing':
        return <Badge className="bg-blue-600">Processing</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getLanguageFromFilename = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js': return 'JavaScript';
      case 'ts': return 'TypeScript';
      case 'py': return 'Python';
      case 'sh': return 'Shell';
      case 'rb': return 'Ruby';
      case 'java': return 'Java';
      case 'cs': return 'C#';
      case 'go': return 'Go';
      default: return extension || 'Unknown';
    }
  };
  
  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">
            {currentScript.title || getFileName(currentScript.file_path)}
          </h2>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={refreshScript}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {onProcess && (
            <Button
              variant="outline"
              onClick={handleProcessScript}
              disabled={processing}
            >
              <PlayCircle className={`h-4 w-4 mr-2 ${processing ? 'animate-spin' : ''}`} />
              Process
            </Button>
          )}
          
          {onEdit && (
            <Button onClick={() => onEdit(currentScript)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          
          {onArchive && (
            <Button variant="outline" onClick={() => onArchive(currentScript)}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Script Information</CardTitle>
          <CardDescription>Details about this script file</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Filename</div>
            <div className="flex items-center">
              <FileCode className="h-4 w-4 mr-2 text-muted-foreground" />
              {getFileName(currentScript.file_path)}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Path</div>
            <div className="truncate">{currentScript.file_path}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Language</div>
            <div>{currentScript.language || getLanguageFromFilename(currentScript.file_path)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Document Type</div>
            <div>{currentScript.document_type || 'Not classified'}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Status</div>
            <div>{getStatusBadge(currentScript.status)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
            <div>{formatDate(currentScript.updated_at)}</div>
          </div>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Script Content</TabsTrigger>
          <TabsTrigger value="analysis" disabled={!analysisResult}>Analysis</TabsTrigger>
        </TabsList>
        
        <TabsContent value="content">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm font-medium">
                <Terminal className="h-4 w-4 mr-2 inline" />
                {currentScript.language || getLanguageFromFilename(currentScript.file_path)} Script
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : content ? (
                <ScrollArea className="h-[calc(100vh-400px)]">
                  <div className="bg-zinc-950 p-4 font-mono text-sm rounded-b-md">
                    <pre className="whitespace-pre-wrap text-gray-300">
                      {content}
                    </pre>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex justify-center items-center h-64 text-muted-foreground">
                  No content available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Script Analysis</CardTitle>
              <CardDescription>
                AI-generated analysis of this script file
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisResult ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Document Type</div>
                    <div className="text-lg">{analysisResult.document_type}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Categories</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {analysisResult.categories.map((cat: string, i: number) => (
                        <Badge key={i} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Analysis Result</div>
                    <div>{analysisResult.type}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Processed At</div>
                    <div>{formatDate(analysisResult.lastProcessed)}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No analysis results available. Process the script to generate analysis.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}