import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { GutsTracker } from '../utils/gutsTracker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Database, Code, Package, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface GutsTabProps {
  pagePath: string;
  appName: string;
}

// Define interfaces for our data structures
interface TableUsage {
  table_usage_id: string;
  table_name: string;
  operations: string[];
  is_primary: boolean;
}

interface FunctionUsage {
  function_usage_id: string;
  function_id: string;
  function_name: string;
  location: string;
  uses_react: boolean;
  ai_prompts: any;
  refactor_candidate: boolean;
  specificity: string;
  usage_type: string;
}

interface Dependency {
  dependency_id: string;
  dependency_type: string;
  dependency_name: string;
  details: any;
}

interface PageInfo {
  page_id: string;
  page_name: string;
  page_path: string;
  app_name: string;
}

interface PageGuts {
  pageInfo: PageInfo;
  tables: TableUsage[];
  functions: FunctionUsage[];
  dependencies: Dependency[];
}

const GutsTab: React.FC<GutsTabProps> = ({ pagePath, appName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageGuts, setPageGuts] = useState<PageGuts | null>(null);
  const [activeTab, setActiveTab] = useState('tables');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Initialize the GutsTracker when the component mounts
    const initTracker = async () => {
      try {
        await GutsTracker.initialize(pagePath, appName);
        
        // Track that we're using the GutsTab component itself
        GutsTracker.trackTableUsage('app_pages', ['select'], true);
        GutsTracker.trackTableUsage('page_table_usage', ['select']);
        GutsTracker.trackTableUsage('page_function_usage', ['select']);
        GutsTracker.trackTableUsage('page_dependencies', ['select']);
        GutsTracker.trackTableUsage('function_registry', ['select']);
      } catch (err) {
        console.error('Error initializing GutsTracker:', err);
      }
    };
    
    initTracker();
    fetchPageData();
    
    // Clean up when component unmounts
    return () => {
      GutsTracker.cleanup();
    };
  }, [pagePath, appName]);

  const fetchPageData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Get or create the page
      const { data: pageData, error: pageError } = await supabase
        .rpc('get_or_create_page', {
          p_app_name: appName,
          p_page_name: pagePath.split('/').pop() || pagePath,
          p_page_path: pagePath,
          p_description: `Auto-registered page for ${appName}`
        });

      if (pageError) {
        console.error('Error registering page:', pageError);
        setError(`Failed to register page: ${pageError.message}`);
        setLoading(false);
        return;
      }

      const pageId = pageData;
      
      // Step 2: Fetch all data in parallel for better performance
      const [tablesResult, functionsResult, dependenciesResult] = await Promise.all([
        // Get tables used by this page
        supabase
          .from('page_table_usage')
          .select('*')
          .eq('page_id', pageId)
          .order('is_primary', { ascending: false }),
          
        // Get functions used by this page
        supabase
          .from('page_function_usage')
          .select('*')
          .eq('page_id', pageId),
          
        // Get dependencies used by this page
        supabase
          .from('page_dependencies')
          .select('*')
          .eq('page_id', pageId)
      ]);

      // Check for errors
      if (tablesResult.error) {
        console.error('Error fetching tables:', tablesResult.error);
        setError(`Failed to fetch tables: ${tablesResult.error.message}`);
        setLoading(false);
        return;
      }
      
      if (functionsResult.error) {
        console.error('Error fetching functions:', functionsResult.error);
        setError(`Failed to fetch functions: ${functionsResult.error.message}`);
        setLoading(false);
        return;
      }
      
      if (dependenciesResult.error) {
        console.error('Error fetching dependencies:', dependenciesResult.error);
        setError(`Failed to fetch dependencies: ${dependenciesResult.error.message}`);
        setLoading(false);
        return;
      }

      // Step 3: Process the data in the application
      // Just use the data directly without transformation
      const processedFunctions = functionsResult.data;

      // Assemble the page guts data
      const gutsData: PageGuts = {
        pageInfo: {
          page_id: pageId,
          page_name: pagePath.split('/').pop() || pagePath,
          page_path: pagePath,
          app_name: appName
        },
        tables: tablesResult.data as TableUsage[],
        functions: processedFunctions,
        dependencies: dependenciesResult.data as Dependency[]
      };

      setPageGuts(gutsData);
      console.log('Page guts data:', gutsData);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPageData();
  };

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-5">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
      <p className="mt-2">Loading page information...</p>
    </div>
  );

  const renderError = () => (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error loading page information</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );

  const renderEmptyState = () => (
    <Alert>
      <AlertTitle>No information available</AlertTitle>
      <AlertDescription>
        No information has been collected for this page yet. 
        This could be because the page is new or hasn't been analyzed.
      </AlertDescription>
    </Alert>
  );

  const renderTablesTab = () => {
    if (!pageGuts || !pageGuts.tables || pageGuts.tables.length === 0) {
      return (
        <Alert>
          <AlertTitle>No table usage information</AlertTitle>
          <AlertDescription>
            No Supabase table usage has been recorded for this page.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Supabase Tables</CardTitle>
          <CardDescription>Tables accessed by this page</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table Name</TableHead>
                <TableHead>Operations</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageGuts.tables.map((table, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{table.table_name || 'Unknown'}</TableCell>
                  <TableCell>
                    {table.operation_type && (
                      <Badge className="mr-1" variant="default">
                        {table.operation_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {table.is_primary ? (
                      <Badge variant="default">Primary</Badge>
                    ) : (
                      <Badge variant="outline">Secondary</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderFunctionsTab = () => {
    if (!pageGuts || !pageGuts.functions || pageGuts.functions.length === 0) {
      return (
        <Alert>
          <AlertTitle>No function usage information</AlertTitle>
          <AlertDescription>
            No function usage has been recorded for this page.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Functions</CardTitle>
          <CardDescription>Functions used by this page</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Usage Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageGuts.functions.map((func, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{func.function_id || 'Unknown'}</TableCell>
                  <TableCell>{func.page_id || 'Unknown'}</TableCell>
                  <TableCell>
                    {/* Show any available properties */}
                    {Object.keys(func).filter(key => !['id', 'function_id', 'page_id', 'usage_type'].includes(key)).map(key => (
                      <Badge key={key} className="mr-1" variant="outline">
                        {key}: {String(func[key])}
                      </Badge>
                    ))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">
                      {func.usage_type || 'unknown'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderDependenciesTab = () => {
    if (!pageGuts || !pageGuts.dependencies || pageGuts.dependencies.length === 0) {
      return (
        <Alert>
          <AlertTitle>No dependency information</AlertTitle>
          <AlertDescription>
            No external dependencies have been recorded for this page.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>External Dependencies</CardTitle>
          <CardDescription>External services and APIs used by this page</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dependency Type</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageGuts.dependencies.map((dep, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{dep.dependency_type || 'Unknown'}</TableCell>
                  <TableCell>{dep.dependency_name || 'Unknown'}</TableCell>
                  <TableCell>
                    {dep.details ? (
                      <pre className="text-xs overflow-auto max-h-20">
                        {JSON.stringify(dep.details, null, 2)}
                      </pre>
                    ) : (
                      <span className="text-muted-foreground">No details</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (loading && !refreshing) {
    return renderLoading();
  }

  if (error) {
    return renderError();
  }

  if (!pageGuts) {
    return renderEmptyState();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Card className="w-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Page Information</CardTitle>
              <CardDescription>Details about {pageGuts.pageInfo.page_name}</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="ml-auto"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Path:</p>
                <p className="text-sm">{pageGuts.pageInfo.page_path}</p>
              </div>
              <div>
                <p className="text-sm font-medium">App:</p>
                <p className="text-sm">{pageGuts.pageInfo.app_name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3">
          <TabsTrigger value="tables" className="flex items-center">
            <Database className="mr-2 h-4 w-4" />
            Tables ({pageGuts.tables.length})
          </TabsTrigger>
          <TabsTrigger value="functions" className="flex items-center">
            <Code className="mr-2 h-4 w-4" />
            Functions ({pageGuts.functions.length})
          </TabsTrigger>
          <TabsTrigger value="dependencies" className="flex items-center">
            <Package className="mr-2 h-4 w-4" />
            Dependencies ({pageGuts.dependencies.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tables">
          {renderTablesTab()}
        </TabsContent>
        <TabsContent value="functions">
          {renderFunctionsTab()}
        </TabsContent>
        <TabsContent value="dependencies">
          {renderDependenciesTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GutsTab; 