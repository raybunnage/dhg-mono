import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Spinner } from './ui/spinner';
import { Progress } from './ui/progress';

interface ScriptAnalysisStatus {
  scanCompleted: boolean;
  reportsGenerated: boolean;
  categorySummaryGenerated: boolean;
  scriptCount?: number;
  categoryBreakdown?: Record<string, number>;
}

/**
 * Script Analysis Panel Component
 * 
 * Provides a UI for triggering and monitoring script analysis
 */
export function ScriptAnalysisPanel() {
  const [status, setStatus] = useState<ScriptAnalysisStatus | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('status');
  const [report, setReport] = useState<string | null>(null);
  const [categorySummary, setCategorySummary] = useState<string | null>(null);
  const [scriptAnalyses, setScriptAnalyses] = useState<any[]>([]);

  // Fetch initial status
  useEffect(() => {
    fetchStatus();
  }, []);

  // Fetch status from API
  const fetchStatus = async () => {
    try {
      setLoading('status');
      const response = await fetch('/api/script-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'status' }),
      });

      const data = await response.json();
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.error || 'Failed to fetch script analysis status');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred fetching status');
    } finally {
      setLoading(null);
    }
  };

  // Scan for script files
  const handleScan = async () => {
    try {
      setLoading('scan');
      setError(null);
      const response = await fetch('/api/script-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'scan' }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Failed to scan script files');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred during scanning');
    } finally {
      setLoading(null);
    }
  };

  // Batch analyze script files
  const handleBatchAnalyze = async () => {
    try {
      setLoading('batch');
      setError(null);
      const response = await fetch('/api/script-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'batch',
          options: {
            batchSize: 5,
            concurrency: 2
          } 
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchStatus();
        setActiveTab('report');
        fetchReport();
      } else {
        setError(data.error || 'Failed to batch analyze script files');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred during batch analysis');
    } finally {
      setLoading(null);
    }
  };

  // Fetch analysis report
  const fetchReport = async () => {
    try {
      setLoading('report');
      setError(null);
      const response = await fetch('/api/script-analysis?action=report');
      const data = await response.json();
      if (data.success) {
        setReport(data.data.report);
      } else {
        setError(data.error || 'Failed to fetch report');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred fetching report');
    } finally {
      setLoading(null);
    }
  };

  // Fetch category summary
  const fetchCategorySummary = async () => {
    try {
      setLoading('summary');
      setError(null);
      const response = await fetch('/api/script-analysis?action=category-summary');
      const data = await response.json();
      if (data.success) {
        setCategorySummary(data.data.summary);
      } else {
        setError(data.error || 'Failed to fetch category summary');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred fetching category summary');
    } finally {
      setLoading(null);
    }
  };

  // Fetch script analyses list
  const fetchScriptAnalyses = async () => {
    try {
      setLoading('analyses');
      setError(null);
      const response = await fetch('/api/script-analysis?action=list-analyses');
      const data = await response.json();
      if (data.success) {
        setScriptAnalyses(data.data.files || []);
      } else {
        setError(data.error || 'Failed to fetch script analyses');
      }
    } catch (err) {
      setError((err as Error).message || 'An error occurred fetching script analyses');
    } finally {
      setLoading(null);
    }
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Load data for selected tab if needed
    if (value === 'report' && !report) {
      fetchReport();
    } else if (value === 'categories' && !categorySummary) {
      fetchCategorySummary();
    } else if (value === 'scripts' && scriptAnalyses.length === 0) {
      fetchScriptAnalyses();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Script Analysis Pipeline</CardTitle>
        <CardDescription>
          Analyze scripts to categorize them into document types
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4 mb-6">
          <Button
            onClick={handleScan}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === 'scan' ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Scanning...
              </>
            ) : (
              'Scan Script Files'
            )}
          </Button>
          <Button
            onClick={handleBatchAnalyze}
            disabled={loading !== null || !status?.scanCompleted}
            variant="default"
          >
            {loading === 'batch' ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Analyzing...
              </>
            ) : (
              'Analyze Scripts'
            )}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="report" disabled={!status?.reportsGenerated}>
              Report
            </TabsTrigger>
            <TabsTrigger value="categories" disabled={!status?.categorySummaryGenerated}>
              Categories
            </TabsTrigger>
            <TabsTrigger value="scripts" disabled={!status?.scanCompleted}>
              Script Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="status">
            {loading === 'status' ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : status ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="py-4 px-6">
                      <CardTitle className="text-sm font-medium">Pipeline Status</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-6">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span>Script Scan</span>
                          <Badge variant={status.scanCompleted ? "success" : "outline"}>
                            {status.scanCompleted ? "Completed" : "Not Started"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Analysis Report</span>
                          <Badge variant={status.reportsGenerated ? "success" : "outline"}>
                            {status.reportsGenerated ? "Generated" : "Not Available"}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Category Summary</span>
                          <Badge variant={status.categorySummaryGenerated ? "success" : "outline"}>
                            {status.categorySummaryGenerated ? "Generated" : "Not Available"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="py-4 px-6">
                      <CardTitle className="text-sm font-medium">Script Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 px-6">
                      {status.scriptCount ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span>Total Scripts</span>
                            <Badge variant="secondary">{status.scriptCount}</Badge>
                          </div>
                          {status.categoryBreakdown && Object.keys(status.categoryBreakdown).length > 0 && (
                            <>
                              <Separator className="my-2" />
                              <div className="text-sm font-medium mb-1">By Category</div>
                              {Object.entries(status.categoryBreakdown).map(([category, count]) => (
                                <div key={category} className="flex justify-between items-center">
                                  <span>{category}</span>
                                  <div className="flex items-center gap-2">
                                    <Progress 
                                      value={Math.round((count / status.scriptCount!) * 100)} 
                                      className="w-20 h-2" 
                                    />
                                    <span className="text-sm">{count}</span>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No script statistics available
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Status information not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="report">
            {loading === 'report' ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : report ? (
              <ScrollArea className="h-[500px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm">{report}</pre>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Report not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            {loading === 'summary' ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : categorySummary ? (
              <ScrollArea className="h-[500px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm">{categorySummary}</pre>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Category summary not available
              </div>
            )}
          </TabsContent>

          <TabsContent value="scripts">
            {loading === 'analyses' ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-8 w-8" />
              </div>
            ) : scriptAnalyses.length > 0 ? (
              <div className="rounded-md border">
                <div className="grid grid-cols-4 gap-4 p-4 font-medium border-b">
                  <div>Filename</div>
                  <div>Document Type</div>
                  <div>Status</div>
                  <div>Quality</div>
                </div>
                <ScrollArea className="h-[400px]">
                  <div className="divide-y">
                    {scriptAnalyses.map((file, index) => (
                      <div key={index} className="grid grid-cols-4 gap-4 p-4 hover:bg-muted">
                        <div className="truncate">{file.filename}</div>
                        <div>-</div>
                        <div>-</div>
                        <div>-</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No script analyses available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex justify-between border-t p-4">
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date().toLocaleTimeString()}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStatus}
          disabled={loading !== null}
        >
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}

// Spinner is now imported from UI components

// Export variant to Badge component to style the success state
Badge.defaultProps = {
  ...Badge.defaultProps,
  variants: {
    ...Badge.defaultProps?.variants,
    success: "bg-green-100 text-green-800 hover:bg-green-200",
  },
};