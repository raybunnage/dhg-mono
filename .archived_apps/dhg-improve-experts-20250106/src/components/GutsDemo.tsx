import React, { useState, useEffect } from 'react';
import { GutsTracker, trackFunction, trackDependency, useTrackedSupabase } from '../utils/gutsTracker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search, Database, FileText } from "lucide-react";
import GutsTab from './GutsTab';

// Mock function registry IDs - in a real app, these would come from your function_registry table
const FUNCTION_IDS = {
  fetchExperts: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  searchDocuments: '8c3dfa85-1234-4562-b3fc-2c963f66afa6',
  processAIResponse: '9e8d7f65-5432-1098-b3fc-2c963f66afa6'
};

interface GutsDemoProps {
  pagePath: string;
  appName: string;
}

const GutsDemo: React.FC<GutsDemoProps> = ({ pagePath, appName }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('demo');
  
  // Use the tracked Supabase client to automatically track table usage
  const trackedSupabase = useTrackedSupabase();
  
  useEffect(() => {
    // Initialize the GutsTracker when the component mounts
    const initTracker = async () => {
      try {
        await GutsTracker.initialize(pagePath, appName);
      } catch (err) {
        console.error('Error initializing GutsTracker:', err);
      }
    };
    
    initTracker();
    
    // Clean up when component unmounts
    return () => {
      GutsTracker.cleanup();
    };
  }, [pagePath, appName]);
  
  // Example function that uses the @trackFunction decorator
  @trackFunction(FUNCTION_IDS.fetchExperts, 'direct')
  const fetchExperts = async () => {
    setLoading(true);
    
    try {
      // This will automatically track table usage through the tracked client
      const { data, error } = await trackedSupabase
        .from('expert_profiles')
        .select('*')
        .limit(5);
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      console.error('Error fetching experts:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  // Example function that uses the @trackFunction decorator and @trackDependency
  @trackFunction(FUNCTION_IDS.searchDocuments, 'direct')
  @trackDependency('google_drive', 'Document Search API', { scope: 'read-only' })
  const searchDocuments = async (query: string) => {
    setLoading(true);
    
    try {
      // Simulate API call to Google Drive
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // This will automatically track table usage
      const { data, error } = await trackedSupabase
        .from('google_expert_documents')
        .select('*')
        .textSearch('content', query)
        .limit(5);
      
      if (error) throw error;
      
      return data || [];
    } catch (err) {
      console.error('Error searching documents:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };
  
  // Example function that manually tracks dependencies
  const processWithAI = async (text: string) => {
    setLoading(true);
    
    try {
      // Track AI service usage
      GutsTracker.trackFunctionUsage(FUNCTION_IDS.processAIResponse, 'direct');
      GutsTracker.trackDependency('ai_service', 'Claude API', {
        model: 'claude-3-5-sonnet-20241022',
        purpose: 'text analysis'
      });
      
      // Simulate AI processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return `AI processed: ${text}`;
    } catch (err) {
      console.error('Error processing with AI:', err);
      return 'Error processing with AI';
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    setResults([]);
    
    try {
      // First search documents
      const documents = await searchDocuments(searchTerm);
      
      // Then fetch experts
      const experts = await fetchExperts();
      
      // Process with AI
      const aiSummary = await processWithAI(searchTerm);
      
      // Combine results
      setResults([
        ...documents.map(doc => ({ type: 'document', ...doc })),
        ...experts.map(expert => ({ type: 'expert', ...expert }))
      ]);
      
      // Track table usage for the search results display
      GutsTracker.trackTableUsage('search_history', ['insert'], false);
      
    } catch (err) {
      console.error('Error performing search:', err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Guts Dashboard Demo</CardTitle>
          <CardDescription>
            This demo shows how the GutsTracker automatically tracks table usage, function calls, and dependencies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="demo">Demo App</TabsTrigger>
              <TabsTrigger value="guts">Guts Dashboard</TabsTrigger>
            </TabsList>
            
            <TabsContent value="demo" className="space-y-4 pt-4">
              <div className="flex gap-2">
                <div className="grid flex-1 gap-2">
                  <Label htmlFor="search">Search Experts and Documents</Label>
                  <Input
                    id="search"
                    placeholder="Enter search term..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  className="mt-8" 
                  onClick={handleSearch}
                  disabled={loading || !searchTerm.trim()}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Search
                </Button>
              </div>
              
              <div className="pt-4">
                <h3 className="text-lg font-medium mb-2">Results</h3>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((result, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2">
                            {result.type === 'document' ? (
                              <FileText className="h-5 w-5 text-blue-500" />
                            ) : (
                              <Database className="h-5 w-5 text-green-500" />
                            )}
                            <div>
                              <p className="font-medium">{result.name || result.title || 'Untitled'}</p>
                              <p className="text-sm text-muted-foreground">
                                {result.type === 'document' ? 'Document' : 'Expert'}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No results to display. Try searching for something.
                  </p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="guts" className="pt-4">
              <GutsTab pagePath={pagePath} appName={appName} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default GutsDemo; 