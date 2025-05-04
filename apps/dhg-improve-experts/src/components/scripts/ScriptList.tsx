import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { MoreHorizontal, Plus, Search, RefreshCw, Trash2, Edit, Eye, FileText, PlayCircle, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { scriptPipelineAdapter, ScriptFile } from '@/services/script-pipeline-adapter';

interface ScriptListProps {
  onSelectScript: (script: ScriptFile) => void;
  onAddScript?: () => void;
  onEditScript?: (script: ScriptFile) => void;
  onProcessScript?: (script: ScriptFile) => void;
  onArchiveScript?: (script: ScriptFile) => void;
}

export function ScriptList({
  onSelectScript,
  onAddScript,
  onEditScript,
  onProcessScript,
  onArchiveScript
}: ScriptListProps) {
  const [scripts, setScripts] = useState<ScriptFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadScripts();
  }, []);

  async function loadScripts() {
    try {
      setLoading(true);
      
      // Use our script pipeline adapter
      const scripts = await scriptPipelineAdapter.getRecentScripts(50);
      setScripts(scripts);
    } catch (error) {
      console.error('Error loading scripts:', error);
      toast.error('Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }

  const refreshScripts = async () => {
    setIsRefreshing(true);
    await loadScripts();
    setIsRefreshing(false);
  };

  const filteredScripts = searchTerm
    ? scripts.filter(script => 
        script.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        script.file_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        script.language?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : scripts;

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

  const getLanguageBadge = (language?: string) => {
    if (!language) return null;
    
    const colorMap: Record<string, string> = {
      'javascript': 'bg-yellow-500',
      'typescript': 'bg-blue-500',
      'python': 'bg-green-500',
      'bash': 'bg-gray-600',
      'ruby': 'bg-red-500',
      'java': 'bg-orange-500',
      'csharp': 'bg-purple-500',
      'go': 'bg-cyan-500'
    };
    
    return (
      <Badge className={colorMap[language.toLowerCase()] || 'bg-gray-500'}>
        {language}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const getFileName = (filePath: string) => {
    return filePath.split('/').pop() || filePath;
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search scripts..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshScripts}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            {onAddScript && (
              <Button onClick={onAddScript}>
                <Plus className="h-4 w-4 mr-2" />
                Add Script
              </Button>
            )}
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
                  <TableHead>Filename</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScripts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                      {searchTerm ? 'No scripts match your search' : 'No scripts found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScripts.map(script => (
                    <TableRow 
                      key={script.id || script.file_path}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => onSelectScript(script)}
                    >
                      <TableCell>
                        <div className="font-medium flex items-center">
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          {getFileName(script.file_path)}
                        </div>
                      </TableCell>
                      <TableCell>{script.title || '-'}</TableCell>
                      <TableCell>{getLanguageBadge(script.language)}</TableCell>
                      <TableCell>{formatDate(script.created_at)}</TableCell>
                      <TableCell>{getStatusBadge(script.status)}</TableCell>
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
                              onSelectScript(script);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Script
                            </DropdownMenuItem>
                            
                            {onProcessScript && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onProcessScript(script);
                              }}>
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Process Script
                              </DropdownMenuItem>
                            )}
                            
                            {onEditScript && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onEditScript(script);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            
                            {onArchiveScript && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                onArchiveScript(script);
                              }}>
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            )}
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