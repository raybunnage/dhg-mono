import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  AlertCircle, 
  Code as CodeIcon, 
  FileCode, 
  RefreshCw, 
  Search, 
  Layout,
  Info,
  ArrowRightLeft,
  Pencil,
  Layers,
  Zap
} from "lucide-react";
import { toast } from 'react-hot-toast';
import { functionRegistry, getAllFunctions, getFunctionInfo, categories } from '@/utils/function-registry';

interface PageMetadata {
  id: string;
  name: string;
  path: string;
  component: string;
  description?: string;
  dependencies?: string[];
  filePath?: string;
}

export default function CodeDashboard() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [functions, setFunctions] = useState<string[]>([]);
  const [pages, setPages] = useState<PageMetadata[]>([]);
  const [stats, setStats] = useState({
    totalFunctions: 0,
    utilityCandidates: 0,
    dashboardSpecific: 0,
    totalPages: 0
  });
  
  // State for analyze tab
  const [analyzeFiles, setAnalyzeFiles] = useState([]);
  const [analyzeSelectedFile, setAnalyzeSelectedFile] = useState(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  
  // State for registry tab
  const [registryFunctions, setRegistryFunctions] = useState([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [filteredRegistryFunctions, setFilteredRegistryFunctions] = useState([]);
  const [registrySearchTerm, setRegistrySearchTerm] = useState('');
  
  useEffect(() => {
    fetchData();
    
    // Initialize registry data
    try {
      // Create sample registry data
      let sampleData = [];
      
      try {
        // Try to get functions from registry
        const functions = getAllFunctions();
        
        // Map functions to sample data format
        if (functions && functions.length > 0) {
          sampleData = functions.map(f => ({
            name: f.name,
            description: f.description || "No description",
            category: f.category || "Unknown", 
            location: f.location || ""
          }));
        } else {
          // If no functions in registry, use hardcoded samples
          sampleData = [
            {
              name: "processDocumentWithAI",
              description: "Main entry point for AI document processing",
              category: "AI_PROCESSING",
              location: "src/utils/ai-processing.ts"
            },
            {
              name: "extractDocumentContent",
              description: "Extracts text content from documents",
              category: "CONTENT_EXTRACTION",
              location: "src/utils/document-processing.ts"
            },
            {
              name: "syncGoogleDrive",
              description: "Synchronizes files with Google Drive",
              category: "GOOGLE_DRIVE",
              location: "src/utils/google-drive-sync.ts"
            }
          ];
        }
      } catch (error) {
        console.error("Error getting functions from registry:", error);
        // Fall back to hardcoded samples
        sampleData = [
          {
            name: "processDocumentWithAI",
            description: "Main entry point for AI document processing",
            category: "AI_PROCESSING",
            location: "src/utils/ai-processing.ts"
          },
          {
            name: "extractDocumentContent",
            description: "Extracts text content from documents",
            category: "CONTENT_EXTRACTION", 
            location: "src/utils/document-processing.ts"
          }
        ];
      }
      
      // Update state with registry data
      setRegistryFunctions(sampleData);
      setFilteredRegistryFunctions(sampleData);
      setRegistryLoading(false);
    } catch (error) {
      console.error("Error in registry data setup:", error);
      setRegistryLoading(false);
    }
  }, []);
  
  // Filter registry functions when search term changes
  useEffect(() => {
    try {
      const filtered = registryFunctions.filter(f => 
        f.name?.toLowerCase().includes(registrySearchTerm.toLowerCase()) ||
        f.description?.toLowerCase().includes(registrySearchTerm.toLowerCase()) ||
        f.category?.toLowerCase().includes(registrySearchTerm.toLowerCase())
      );
      setFilteredRegistryFunctions(filtered);
    } catch (error) {
      console.error("Error filtering registry functions:", error);
    }
  }, [registrySearchTerm, registryFunctions]);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchFunctions(),
        fetchPages(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchFunctions = async () => {
    try {
      // Get all functions from registry or add samples if empty
      let functionsList = [];
      
      try {
        // Try getting functions from registry
        const allFunctions = getAllFunctions();
        
        // If registry is empty, register some sample functions
        if (allFunctions.length === 0) {
          // Register sample functions
          functionRegistry.register('extractDocumentContent', {
            description: 'Extracts text content from documents',
            status: 'active',
            location: 'src/utils/document-processing.ts',
            category: 'CONTENT_EXTRACTION'
          });
          
          functionRegistry.register('syncGoogleDrive', {
            description: 'Synchronizes files with Google Drive',
            status: 'active',
            location: 'src/utils/google-drive-sync.ts',
            category: 'GOOGLE_DRIVE',
            dependencies: ['google-api-client']
          });
          
          // Get updated list after registering samples
          functionsList = getAllFunctions().map(f => f.name);
        } else {
          // Use existing functions
          functionsList = allFunctions.map(f => f.name);
        }
      } catch (error) {
        console.error('Error accessing function registry:', error);
        
        // Fallback to hardcoded functions if there's an error
        functionsList = [
          'processDocumentWithAI',
          'extractDocumentContent',
          'syncGoogleDrive'
        ];
      }
      
      // Set the functions state
      setFunctions(functionsList);
    } catch (error) {
      console.error('Error fetching functions:', error);
      toast.error('Failed to load functions');
    }
  };
  
  const fetchPages = async () => {
    try {
      // Define the navigation items directly since app_pages table doesn't exist
      const navItems = [
        { id: '1', name: 'Home', path: '/', component: 'Dashboard', description: 'Main application dashboard', filePath: 'src/pages/Dashboard.tsx' },
        { id: '2', name: 'Viewer', path: '/viewer', component: 'Viewer', description: 'Document viewer', filePath: 'src/pages/Viewer.tsx' },
        { id: '3', name: 'Sync', path: '/sync', component: 'Sync', description: 'Data synchronization', filePath: 'src/pages/Sync.tsx' },
        { id: '4', name: 'Classify', path: '/classify', component: 'ClassifyDocument', description: 'Document classification', filePath: 'src/pages/ClassifyDocument.tsx' },
        { id: '5', name: 'Transcribe', path: '/transcribe', component: 'Transcribe', description: 'Audio transcription', filePath: 'src/pages/Transcribe.tsx' },
        { id: '6', name: 'Supabase', path: '/supabase', component: 'SupabaseAdmin', description: 'Database management', filePath: 'src/pages/SupabaseAdmin.tsx' },
        { id: '7', name: 'Analyze', path: '/analyze', component: 'Analyze', description: 'Document analysis', filePath: 'src/pages/Analyze.tsx' },
        { id: '8', name: 'Registry', path: '/registry', component: 'RegistryViewer', description: 'Function registry', filePath: 'src/components/RegistryViewer.tsx' },
        { id: '9', name: 'Experts', path: '/experts', component: 'ExpertsDashboard', description: 'Experts management', filePath: 'src/pages/ExpertsDashboard.tsx' },
        { id: '10', name: 'Code', path: '/code', component: 'CodeDashboard', description: 'Code organization and analysis', filePath: 'src/pages/Code.tsx' }
      ];
      setPages(navItems);
    } catch (error) {
      console.error('Error setting pages:', error);
      toast.error('Failed to load application pages');
    }
  };
  
  const fetchStats = async () => {
    try {
      // Get all functions from registry
      const allFunctions = getAllFunctions();
      
      // Calculate statistics
      const totalFunctions = allFunctions.length;
      
      // Functions that are utility candidates (not UI specific)
      const utilityCandidates = allFunctions.filter(f => 
        f.category !== 'UI_INTERACTION' && 
        f.category !== 'UI_RENDERING' &&
        !f.location.includes('components/')
      ).length;
      
      // Functions that are dashboard specific
      const dashboardSpecific = allFunctions.filter(f => 
        f.category === 'UI_INTERACTION' || 
        f.category === 'UI_RENDERING' ||
        f.location.includes('components/')
      ).length;
      
      // Use the navigation items count directly
      const totalPages = pages.length;
      
      setStats({
        totalFunctions,
        utilityCandidates,
        dashboardSpecific,
        totalPages
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Filter functions based on search term and category
  const filteredFunctions = functions.filter(f => {
    const info = getFunctionInfo(f);
    if (!info) return false;
    
    const matchesSearch = f.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (info.description && info.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (info.location && info.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || info.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  // Filter pages based on search term
  const filteredPages = pages.filter(page => 
    page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (page.description && page.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    page.component.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Get functions used by a specific page
  const getFunctionsForPage = (pageName: string) => {
    return functions.filter(f => {
      const info = getFunctionInfo(f);
      return info && info.usedIn && info.usedIn.includes(pageName);
    });
  };
  
  // Determine if a function is a refactoring candidate
  const isRefactoringCandidate = (functionName: string) => {
    try {
      const info = getFunctionInfo(functionName);
      if (!info) return false;
      
      return info.category !== 'UI_INTERACTION' && 
             info.category !== 'UI_RENDERING' && 
             !info.location.includes('components/') &&
             (info.usedIn && info.usedIn.length > 1);
    } catch (error) {
      console.error('Error checking refactoring candidate:', error);
      return false;
    }
  };

  // Render Overview Dashboard
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Functions</CardTitle>
            <CardDescription>Registered code functions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalFunctions}</div>
            <div className="text-sm text-gray-500 mt-2">
              {stats.utilityCandidates} utility functions
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setActiveTab('functions')}
            >
              <FileCode className="h-4 w-4 mr-2" />
              Manage Functions
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pages</CardTitle>
            <CardDescription>Application pages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalPages}</div>
            <div className="text-sm text-gray-500 mt-2">
              In main navigation
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setActiveTab('pages')}
            >
              <Layout className="h-4 w-4 mr-2" />
              View Pages
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Refactoring</CardTitle>
            <CardDescription>Refactoring candidates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.utilityCandidates}</div>
            <div className="text-sm text-gray-500 mt-2">
              Potential utility candidates
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setActiveTab('refactoring')}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              View Candidates
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Organization</CardTitle>
            <CardDescription>Codebase structure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">
              <Layers className="h-8 w-8 text-blue-500" />
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Application structure
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setActiveTab('organization')}
            >
              <Info className="h-4 w-4 mr-2" />
              View Structure
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Functions by Category</CardTitle>
            <CardDescription>Distribution of functions across categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-4">
                {categories.filter(c => c !== 'all').map(category => {
                  const categoryFunctions = functions.filter(f => {
                    const info = getFunctionInfo(f);
                    return info && info.category === category;
                  });
                  
                  const percentage = stats.totalFunctions > 0 
                    ? Math.round((categoryFunctions.length / stats.totalFunctions) * 100) 
                    : 0;
                  
                  return (
                    <div key={category}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {category.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        <span className="text-sm text-gray-500">
                          {categoryFunctions.length} functions ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full mt-1">
                        <div 
                          className="h-2 bg-blue-500 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Refactoring Candidates</CardTitle>
            <CardDescription>Functions that may be candidates for refactoring</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {functions.filter(isRefactoringCandidate).slice(0, 10).map(funcName => {
                  const info = getFunctionInfo(funcName);
                  return (
                    <div key={funcName} className="p-3 border rounded-md">
                      <div className="flex justify-between items-start">
                        <div className="font-medium text-sm">{funcName}</div>
                        <Badge variant="outline" className="text-xs">
                          {info?.category.toLowerCase().replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {info?.location}
                      </div>
                      <div className="text-xs mt-1">{info?.description}</div>
                      {info?.usedIn && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {info.usedIn.map(location => (
                            <Badge key={location} variant="secondary" className="text-xs">
                              {location}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {functions.filter(isRefactoringCandidate).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No refactoring candidates found
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="text-center mt-4">
              <Button variant="link" onClick={() => setActiveTab('refactoring')}>
                View all candidates
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common code management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button onClick={() => window.open('/registry', '_blank')}>
              <FileCode className="mr-2 h-4 w-4" />
              View Function Registry
            </Button>
            <Button onClick={() => setActiveTab('organization')}>
              <Layout className="mr-2 h-4 w-4" />
              View App Structure
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('functions')}>
              <CodeIcon className="mr-2 h-4 w-4" />
              Browse Functions
            </Button>
            <Button variant="outline" onClick={refreshData} disabled={isRefreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
  
  // Render Functions Tab
  const renderFunctions = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Function Registry</CardTitle>
            <CardDescription>Browse and manage registered functions</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search functions..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.toLowerCase().replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFunctions.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-gray-500">
              {searchTerm || selectedCategory !== 'all' 
                ? 'No functions match your search criteria' 
                : 'No functions found in registry'}
            </div>
          ) : (
            filteredFunctions.map(funcName => {
              const info = getFunctionInfo(funcName);
              if (!info) return null;

              return (
                <div key={funcName} className="border p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{info.name}</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      info.status === 'active' ? 'bg-green-100' :
                      info.status === 'deprecated' ? 'bg-red-100' :
                      'bg-yellow-100'
                    }`}>
                      {info.status}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2">{info.description}</p>
                  <div className="mt-2 text-sm text-gray-500">
                    Location: {info.location}
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Category:</span>{' '}
                    <Badge variant="outline">
                      {info.category.toLowerCase().replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  {info.targetPackage && (
                    <div className="mt-1 text-sm text-blue-600">
                      Target Package: {info.targetPackage}
                    </div>
                  )}
                  {info.dependencies && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Dependencies:</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {info.dependencies.map(dep => (
                          <span key={dep} className="px-2 py-1 bg-gray-100 rounded">
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {info.usedIn && (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Used in:</span>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {info.usedIn.map(location => (
                          <span key={location} className="px-2 py-1 bg-gray-50 rounded">
                            {location}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
  
  // Render Pages Tab
  const renderPages = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Application Pages</CardTitle>
            <CardDescription>Overview of application pages and their functions</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative flex w-full max-w-sm items-center mb-4">
          <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Page Name</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>File Location</TableHead>
                <TableHead>Functions</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                    {searchTerm ? 'No pages match your search' : 'No pages found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPages.map(page => {
                  const pageFunctions = getFunctionsForPage(page.name);
                  
                  return (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.name}</TableCell>
                      <TableCell><code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{page.path}</code></TableCell>
                      <TableCell>{page.component}</TableCell>
                      <TableCell>
                        {page.filePath ? (
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{page.filePath}</code>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {pageFunctions.slice(0, 3).map(funcName => (
                            <Badge key={funcName} variant="outline" className="text-xs">
                              {funcName}
                            </Badge>
                          ))}
                          {pageFunctions.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{pageFunctions.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{page.description || '-'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
  
  // Render Refactoring Tab
  const renderRefactoring = () => {
    const refactoringCandidates = functions.filter(isRefactoringCandidate);
    
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Refactoring Candidates</CardTitle>
              <CardDescription>Functions that may be candidates for moving to service layers</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative flex w-full max-w-sm items-center mb-4">
            <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search candidates..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {refactoringCandidates.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No refactoring candidates currently identified. Refactoring candidates are utility functions used in multiple places.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {refactoringCandidates
                .filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()))
                .map(funcName => {
                  const info = getFunctionInfo(funcName);
                  if (!info) return null;
                  
                  return (
                    <div key={funcName} className="border p-4 rounded-lg">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg">{info.name}</h3>
                        <Badge variant="outline">
                          {info.category.toLowerCase().replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className="text-gray-600 mt-2">{info.description}</p>
                      <div className="mt-2 text-sm text-gray-500">
                        Current location: {info.location}
                      </div>
                      {info.targetPackage && (
                        <div className="mt-1 text-sm text-blue-600">
                          Suggested target package: {info.targetPackage}
                        </div>
                      )}
                      {info.usedIn && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Used in {info.usedIn.length} places:</span>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {info.usedIn.map(location => (
                              <Badge key={location} variant="secondary">
                                {location}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {info.dependencies && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Dependencies:</span>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {info.dependencies.map(dep => (
                              <span key={dep} className="px-2 py-1 bg-gray-100 rounded">
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  // Render Organization Tab
  const renderOrganization = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Application Structure</CardTitle>
            <CardDescription>Overview of the application organization and architecture</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-2 flex items-center">
              <Layout className="h-5 w-5 mr-2 text-blue-500" />
              Navigation Structure
            </h3>
            <p className="text-muted-foreground mb-4">
              The main navigation defines the primary user interface for the application.
            </p>
            
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Component</TableHead>
                    <TableHead>File Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map(page => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.name}</TableCell>
                      <TableCell><code className="bg-gray-100 px-1 py-0.5 rounded">{page.path}</code></TableCell>
                      <TableCell>{page.component}</TableCell>
                      <TableCell>
                        {page.filePath ? (
                          <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{page.filePath}</code>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-2 flex items-center">
              <Layers className="h-5 w-5 mr-2 text-blue-500" />
              Code Structure
            </h3>
            <p className="text-muted-foreground mb-4">
              The application follows a layered architecture with clear separation of concerns.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-md p-4">
                <h4 className="font-medium flex items-center">
                  <FileCode className="h-4 w-4 mr-2 text-blue-500" />
                  Presentation Layer
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  User interfaces and components that render data.
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>components/ - Reusable UI components</li>
                  <li>pages/ - Page components</li>
                </ul>
              </div>
              
              <div className="border rounded-md p-4">
                <h4 className="font-medium flex items-center">
                  <ArrowRightLeft className="h-4 w-4 mr-2 text-blue-500" />
                  Service Layer
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Business logic and data processing functions.
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>services/ - Service classes</li>
                  <li>utils/ - Utility functions</li>
                </ul>
              </div>
              
              <div className="border rounded-md p-4">
                <h4 className="font-medium flex items-center">
                  <Pencil className="h-4 w-4 mr-2 text-blue-500" />
                  API Layer
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Data fetching and API interaction.
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>api/ - API endpoints and services</li>
                  <li>integrations/ - External service integrations</li>
                </ul>
              </div>
              
              <div className="border rounded-md p-4">
                <h4 className="font-medium flex items-center">
                  <Info className="h-4 w-4 mr-2 text-blue-500" />
                  Data Layer
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Data models and database interactions.
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                  <li>types/ - TypeScript interfaces and type definitions</li>
                  <li>schemas/ - Data validation schemas</li>
                  <li>lib/supabase/ - Database client and queries</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600">Loading code dashboard...</p>
      </div>
    );
  }
  
  // Code Analysis Component
  const renderAnalyzeTab = () => {

    // We'll implement a simplified version that matches the layout style
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Code Analysis</CardTitle>
              <CardDescription>Analyze code structure and dependencies</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Component Analysis</h3>
              <p className="mb-4 text-muted-foreground">
                The code analysis tool examines your components to provide insights on structure, 
                dependencies, and potential optimizations.
              </p>
              <div className="space-y-4">
                <div className="p-4 border rounded-md">
                  <h4 className="font-medium">React Component Analysis</h4>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    <li>Detects component structure and props</li>
                    <li>Identifies hook usage patterns</li>
                    <li>Analyzes rendering optimization opportunities</li>
                    <li>Detects potential state management issues</li>
                  </ul>
                  <Button className="mt-4" onClick={() => window.open('/analyze', '_blank')}>
                    Start Component Analysis
                  </Button>
                </div>
                
                <div className="p-4 border rounded-md">
                  <h4 className="font-medium">Function Analysis</h4>
                  <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                    <li>Extracts function signatures and dependencies</li>
                    <li>Maps component relationships</li>
                    <li>Analyzes code reuse opportunities</li>
                  </ul>
                  <Button className="mt-4" variant="outline" onClick={() => setActiveTab('functions')}>
                    View Function Registry
                  </Button>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Analysis Results</h3>
              <div className="border rounded-md p-4 min-h-[300px] bg-muted flex items-center justify-center">
                <div className="text-center">
                  <CodeIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Select a component to analyze or visit the full Analysis page for more options
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.open('/analyze', '_blank')}
                  >
                    Open Analysis Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Registry Viewer Component
  const renderRegistryTab = () => {

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Function Registry</CardTitle>
              <CardDescription>Browse registered functions in the application</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.open('/registry', '_blank')}
              >
                Open Full Registry
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative flex w-full max-w-sm items-center mb-4">
            <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search registry..."
              className="pl-8"
              value={registrySearchTerm}
              onChange={(e) => setRegistrySearchTerm(e.target.value)}
            />
          </div>
          
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRegistryFunctions.length > 0 ? (
                filteredRegistryFunctions.map((func, index) => (
                  <div key={index} className="border p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold">{func.name}</h3>
                      <Badge variant="outline">{func.category}</Badge>
                    </div>
                    <p className="text-gray-600 mt-2">{func.description}</p>
                    <div className="mt-2 text-sm text-gray-500">
                      Location: {func.location}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-10 text-muted-foreground">
                  {registrySearchTerm ? 'No functions match your search' : 'Loading registry data...'}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <CodeIcon className="mr-2 h-8 w-8 text-blue-500" />
        Code Dashboard
      </h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="functions">Functions</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="refactoring">Refactoring</TabsTrigger>
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="analyze">Analyze</TabsTrigger>
          <TabsTrigger value="registry">Registry</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">{renderOverview()}</TabsContent>
        <TabsContent value="functions">{renderFunctions()}</TabsContent>
        <TabsContent value="pages">{renderPages()}</TabsContent>
        <TabsContent value="refactoring">{renderRefactoring()}</TabsContent>
        <TabsContent value="organization">{renderOrganization()}</TabsContent>
        <TabsContent value="analyze">{renderAnalyzeTab()}</TabsContent>
        <TabsContent value="registry">{renderRegistryTab()}</TabsContent>
      </Tabs>
    </div>
  );
}