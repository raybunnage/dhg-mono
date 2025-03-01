import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FileTree, type FileNode } from '@/components/FileTree';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { 
  AlertTriangle,
  CheckCircle2,
  Code, 
  FileCode, 
  Loader2, 
  RefreshCw, 
  SquareCheckBig, 
  Text, 
  Search,
  XCircle
} from 'lucide-react';
import FunctionAnalyzer, { FunctionMetadata } from '@/utils/code-analysis/function-analyzer';
import { GutsTracker } from '@/utils/gutsTracker';
import { supabase } from '@/integrations/supabase/client';
import path from 'path';

interface FileAnalysisResult {
  filePath: string;
  fileName: string;
  functionCount: number;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  functions: FunctionMetadata[];
  error?: string;
}

interface AnalysisStats {
  totalFiles: number;
  analyzedFiles: number;
  totalFunctions: number;
  registeredFunctions: number;
  reactComponents: number;
  utilityFunctions: number;
  dashboardFunctions: number;
}

export default function CodeFunctionAnalyzer() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [fileContent, setFileContent] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('files');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [results, setResults] = useState<FileAnalysisResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AnalysisStats>({
    totalFiles: 0,
    analyzedFiles: 0,
    totalFunctions: 0,
    registeredFunctions: 0,
    reactComponents: 0,
    utilityFunctions: 0,
    dashboardFunctions: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');

  // Load files and prompt on component mount
  useEffect(() => {
    // Initialize GutsTracker
    GutsTracker.initialize('/code/analyze', 'dhg-improve-experts');
    
    // Load files
    loadFiles();
    
    // Load the enhanced analysis prompt
    loadPrompt();

    // Clean up on unmount
    return () => {
      GutsTracker.cleanup();
    };
  }, []);

  // Load the enhanced analysis prompt
  const loadPrompt = async () => {
    try {
      const response = await fetch('/prompts/enhanced-analysis-prompt.md');
      const text = await response.text();
      setEnhancedPrompt(text);
    } catch (error) {
      console.error('Error loading prompt:', error);
      setError('Failed to load analysis prompt. Some functionality may be limited.');
    }
  };

  // Load files from the src directory
  const loadFiles = async () => {
    try {
      // First, check if we have a mock file structure
      const mockFiles = getMockFileStructure();
      if (mockFiles && mockFiles.length > 0) {
        setFiles(mockFiles);
        return;
      }
      
      // Otherwise try to fetch real files
      const { data, error } = await supabase
        .rpc('list_source_files', { 
          path_pattern: 'src/**/*.{ts,tsx,js,jsx}',
          exclude_pattern: 'node_modules,dist,build,*.test.*'
        });
        
      if (error) {
        throw error;
      }
      
      // Convert to FileNode structure
      const fileNodes: FileNode[] = data.map((file: any) => ({
        id: file.path,
        name: path.basename(file.path),
        path: file.path,
        parent_path: path.dirname(file.path),
        content_type: 'text/typescript',
        size: file.size || 0
      }));
      
      setFiles(fileNodes);
    } catch (error) {
      console.error('Error loading files:', error);
      setError('Failed to load files. Using mock data.');
      // Fallback to mock data
      setFiles(getMockFileStructure());
    }
  };

  // Define a mock file structure for development or when file API fails
  const getMockFileStructure = (): FileNode[] => {
    return [
      {
        id: 'src/pages/Viewer.tsx',
        name: 'Viewer.tsx',
        path: 'src/pages/Viewer.tsx',
        parent_path: 'src/pages',
        content_type: 'text/typescript'
      },
      {
        id: 'src/components/FileTree.tsx',
        name: 'FileTree.tsx',
        path: 'src/components/FileTree.tsx',
        parent_path: 'src/components',
        content_type: 'text/typescript'
      },
      {
        id: 'src/components/FileViewer.tsx',
        name: 'FileViewer.tsx',
        path: 'src/components/FileViewer.tsx',
        parent_path: 'src/components',
        content_type: 'text/typescript'
      },
      {
        id: 'src/utils/ai-processing.ts',
        name: 'ai-processing.ts',
        path: 'src/utils/ai-processing.ts',
        parent_path: 'src/utils',
        content_type: 'text/typescript'
      }
    ];
  };

  // Handle file selection
  const handleFilesSelected = (fileIds: string[]) => {
    setSelectedFiles(fileIds);
    // Load the first selected file content
    if (fileIds.length > 0) {
      loadFileContent(fileIds[0]);
    } else {
      setFileContent('');
    }
  };

  // Load a file's content
  const loadFileContent = async (filePath: string) => {
    try {
      // Track the function usage in GUTS
      GutsTracker.trackFunctionUsage('loadFileContent', 'direct');
      
      // If in development or testing environment, load a mock file
      if (import.meta.env.DEV && !import.meta.env.VITE_USE_REAL_FILES) {
        setFileContent(`
// Mock content for ${filePath}
import React from 'react';

function ExampleComponent() {
  const [data, setData] = useState([]);
  
  useEffect(() => {
    // Load data on mount
    fetchData();
  }, []);
  
  const fetchData = async () => {
    // Fetch data from API
    const response = await fetch('/api/data');
    const data = await response.json();
    setData(data);
  }
  
  return (
    <div>
      <h1>Example Component</h1>
      <ul>
        {data.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}

export default ExampleComponent;
`);
        return;
      }
      
      // Otherwise, fetch the actual file content
      const { data, error } = await supabase
        .rpc('read_source_file', { file_path: filePath });
        
      if (error) {
        throw error;
      }
      
      setFileContent(data.content || 'File is empty');
    } catch (error) {
      console.error('Error loading file content:', error);
      setFileContent(`// Error loading file: ${error.message}`);
    }
  };

  // Start analysis process
  const startAnalysis = async () => {
    try {
      // Track this function usage
      GutsTracker.trackFunctionUsage('startAnalysis', 'direct');
      
      // Validate we have files to analyze
      if (selectedFiles.length === 0) {
        setError('Please select at least one file to analyze');
        return;
      }
      
      // Reset state
      setIsAnalyzing(true);
      setProgress(0);
      setError(null);
      setActiveTab('results');
      
      // Initialize results with pending status
      const initialResults: FileAnalysisResult[] = selectedFiles.map(file => ({
        filePath: file,
        fileName: path.basename(file),
        functionCount: 0,
        status: 'pending',
        functions: []
      }));
      setResults(initialResults);
      
      // Update stats
      setStats(prev => ({
        ...prev,
        totalFiles: selectedFiles.length,
        analyzedFiles: 0,
        totalFunctions: 0,
        registeredFunctions: 0
      }));
      
      // Create analyzer instance
      const analyzer = new FunctionAnalyzer(enhancedPrompt, true);
      
      // Process each file
      let analyzedCount = 0;
      let totalFunctions = 0;
      let registeredFunctions = 0;
      let reactComponents = 0;
      let utilityFunctions = 0;
      let dashboardFunctions = 0;
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const filePath = selectedFiles[i];
        setCurrentFile(filePath);
        
        // Update the status to analyzing
        setResults(prev => {
          const updated = [...prev];
          const index = updated.findIndex(r => r.filePath === filePath);
          if (index >= 0) {
            updated[index] = {
              ...updated[index],
              status: 'analyzing'
            };
          }
          return updated;
        });
        
        try {
          // Load file content
          await loadFileContent(filePath);
          
          // Analyze the file
          const analysis = await analyzer.analyzeFile(filePath, fileContent);
          
          // Register the functions
          const registered = analyzer.registerFunctions(analysis);
          
          // Update stats
          analyzedCount++;
          totalFunctions += analysis.functions.length;
          registeredFunctions += registered.length;
          
          // Count react components, utility and dashboard functions
          const reactComponentsCount = analysis.functions.filter(f => f.isReactComponent).length;
          reactComponents += reactComponentsCount;
          
          const utilityCount = analysis.functions.filter(f => f.isUtilityCandidate).length;
          utilityFunctions += utilityCount;
          
          const dashboardCount = analysis.functions.filter(f => f.isDashboardSpecific).length;
          dashboardFunctions += dashboardCount;
          
          // Update progress
          setProgress(Math.round((analyzedCount / selectedFiles.length) * 100));
          
          // Update results
          setResults(prev => {
            const updated = [...prev];
            const index = updated.findIndex(r => r.filePath === filePath);
            if (index >= 0) {
              updated[index] = {
                ...updated[index],
                status: 'complete',
                functionCount: analysis.functions.length,
                functions: analysis.functions
              };
            }
            return updated;
          });
          
          // Update stats after each file
          setStats({
            totalFiles: selectedFiles.length,
            analyzedFiles: analyzedCount,
            totalFunctions,
            registeredFunctions,
            reactComponents,
            utilityFunctions,
            dashboardFunctions
          });
        } catch (error) {
          console.error(`Error analyzing ${filePath}:`, error);
          
          // Update results with error
          setResults(prev => {
            const updated = [...prev];
            const index = updated.findIndex(r => r.filePath === filePath);
            if (index >= 0) {
              updated[index] = {
                ...updated[index],
                status: 'error',
                error: error.message
              };
            }
            return updated;
          });
        }
      }
      
      // Final stats update
      setStats({
        totalFiles: selectedFiles.length,
        analyzedFiles: analyzedCount,
        totalFunctions,
        registeredFunctions,
        reactComponents,
        utilityFunctions,
        dashboardFunctions
      });
      
      setCurrentFile(null);
    } catch (error) {
      console.error('Analysis error:', error);
      setError(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Filter results based on search term
  const filteredResults = results.filter(result => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    
    return (
      result.fileName.toLowerCase().includes(search) ||
      result.filePath.toLowerCase().includes(search) ||
      result.functions.some(f => 
        f.name.toLowerCase().includes(search) || 
        f.description.toLowerCase().includes(search) ||
        f.category.toLowerCase().includes(search)
      )
    );
  });

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="files">
            <FileCode className="h-4 w-4 mr-2" />
            Select Files
          </TabsTrigger>
          <TabsTrigger value="results">
            <Code className="h-4 w-4 mr-2" />
            Analysis Results
          </TabsTrigger>
          <TabsTrigger value="stats">
            <SquareCheckBig className="h-4 w-4 mr-2" />
            Statistics
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Select Files to Analyze</CardTitle>
              <CardDescription>
                Choose the files you want to analyze and add to the function registry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">File Browser</h3>
                  <div className="border rounded-md h-[400px] overflow-auto">
                    <FileTree 
                      files={files}
                      onSelectionChange={handleFilesSelected}
                    />
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3">File Preview</h3>
                  <div className="border rounded-md h-[400px] p-4 bg-gray-50 overflow-auto">
                    <pre className="text-xs">
                      {fileContent || 'Select a file to preview its content.'}
                    </pre>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <div className="flex justify-between w-full">
                <div>
                  {selectedFiles.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {selectedFiles.length} file(s) selected
                    </div>
                  )}
                </div>
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    onClick={loadFiles}
                    disabled={isAnalyzing}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Files
                  </Button>
                  <Button
                    onClick={startAnalysis}
                    disabled={selectedFiles.length === 0 || isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Code className="h-4 w-4 mr-2" />
                        Start Analysis
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Analysis Results</CardTitle>
                  <CardDescription>
                    Functions found in the selected files and their metadata.
                  </CardDescription>
                </div>
                
                {isAnalyzing && (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing: {currentFile ? path.basename(currentFile) : '...'}
                    </div>
                    <div className="w-[200px]">
                      <Progress value={progress} />
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="mb-4 flex items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search functions, files, or categories..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              {results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Code className="h-8 w-8 mx-auto mb-2" />
                  <p>No analysis results yet. Select files and click "Start Analysis".</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {filteredResults.map(result => (
                      <Card key={result.filePath} className="overflow-hidden">
                        <CardHeader className="p-4 pb-2">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-md">{result.fileName}</CardTitle>
                              <CardDescription className="text-xs">{result.filePath}</CardDescription>
                            </div>
                            <div>
                              {result.status === 'analyzing' && (
                                <Badge variant="outline" className="bg-blue-50">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Analyzing
                                </Badge>
                              )}
                              {result.status === 'pending' && (
                                <Badge variant="outline" className="bg-gray-50">Pending</Badge>
                              )}
                              {result.status === 'complete' && (
                                <Badge variant="outline" className="bg-green-50">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Complete
                                </Badge>
                              )}
                              {result.status === 'error' && (
                                <Badge variant="destructive">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Error
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="p-0">
                          {result.status === 'error' ? (
                            <div className="px-4 py-2 text-red-600 text-sm">
                              {result.error || 'An unknown error occurred'}
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Function</TableHead>
                                  <TableHead>Category</TableHead>
                                  <TableHead>Type</TableHead>
                                  <TableHead>Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {result.functions.length === 0 && result.status === 'complete' ? (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                      No functions found in this file
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  result.functions.map((func, idx) => (
                                    <TableRow key={`${result.filePath}-${func.name}-${idx}`}>
                                      <TableCell className="font-medium">
                                        {func.name}
                                        <div className="text-xs text-muted-foreground">{func.description}</div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="outline">{func.category.toLowerCase().replace(/_/g, ' ')}</Badge>
                                      </TableCell>
                                      <TableCell>
                                        {func.isReactComponent && (
                                          <Badge className="bg-blue-50 text-blue-800 mr-1">Component</Badge>
                                        )}
                                        {func.isUtilityCandidate && (
                                          <Badge className="bg-green-50 text-green-800 mr-1">Utility</Badge>
                                        )}
                                        {func.isDashboardSpecific && (
                                          <Badge className="bg-orange-50 text-orange-800">UI-Specific</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {func.status === 'active' && (
                                          <Badge className="bg-green-50 text-green-800">Active</Badge>
                                        )}
                                        {func.status === 'deprecated' && (
                                          <Badge className="bg-yellow-50 text-yellow-800">Deprecated</Badge>
                                        )}
                                        {func.status === 'experimental' && (
                                          <Badge className="bg-purple-50 text-purple-800">Experimental</Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Statistics</CardTitle>
              <CardDescription>
                Summary of the analysis results and function classification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Analyzed Files</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.analyzedFiles}</div>
                    <div className="text-xs text-muted-foreground">of {stats.totalFiles} selected</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Total Functions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.totalFunctions}</div>
                    <div className="text-xs text-muted-foreground">from all files</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">Registered</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.registeredFunctions}</div>
                    <div className="text-xs text-muted-foreground">functions added to registry</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm">React Components</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats.reactComponents}</div>
                    <div className="text-xs text-muted-foreground">components identified</div>
                  </CardContent>
                </Card>
              </div>
              
              <Card className="mb-6">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm">Function Classification</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Utility Candidates</span>
                        <span>{stats.utilityFunctions} functions ({stats.totalFunctions > 0 ? Math.round((stats.utilityFunctions / stats.totalFunctions) * 100) : 0}%)</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-green-500 rounded-full" 
                          style={{ width: `${stats.totalFunctions > 0 ? (stats.utilityFunctions / stats.totalFunctions) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>UI-Specific Functions</span>
                        <span>{stats.dashboardFunctions} functions ({stats.totalFunctions > 0 ? Math.round((stats.dashboardFunctions / stats.totalFunctions) * 100) : 0}%)</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-orange-500 rounded-full" 
                          style={{ width: `${stats.totalFunctions > 0 ? (stats.dashboardFunctions / stats.totalFunctions) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>React Components</span>
                        <span>{stats.reactComponents} components ({stats.totalFunctions > 0 ? Math.round((stats.reactComponents / stats.totalFunctions) * 100) : 0}%)</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full">
                        <div 
                          className="h-2 bg-blue-500 rounded-full" 
                          style={{ width: `${stats.totalFunctions > 0 ? (stats.reactComponents / stats.totalFunctions) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-center">
                <Button 
                  onClick={() => setActiveTab('files')} 
                  variant="outline"
                  disabled={isAnalyzing}
                >
                  <FileCode className="h-4 w-4 mr-2" />
                  Select More Files
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}