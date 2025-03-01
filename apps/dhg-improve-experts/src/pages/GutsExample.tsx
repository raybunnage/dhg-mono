import { useEffect, useState } from 'react';
import GutsTab from '@/components/GutsTab';
import { GutsTracker, useTrackedSupabase } from '@/utils/gutsTracker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Example service with tracked functions
class ExampleService {
  static async processData(input: string) {
    // Track function usage manually
    GutsTracker.trackFunctionUsage('ExampleService.processData', 'direct');
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 500));
    return `Processed: ${input}`;
  }

  static async fetchExternalData() {
    // Track dependency usage manually
    GutsTracker.trackDependency('external-api', 'Data Fetching');
    // Simulate external API call
    await new Promise(resolve => setTimeout(resolve, 800));
    return { success: true, data: ['item1', 'item2', 'item3'] };
  }
}

export default function GutsExample() {
  const [input, setInput] = useState('');
  const [processedData, setProcessedData] = useState('');
  const [externalData, setExternalData] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Get tracked Supabase client
  const supabase = useTrackedSupabase();
  
  // Initialize GutsTracker
  useEffect(() => {
    // Initialize with current page path and app name
    GutsTracker.initialize('/guts-example', 'dhg-improve-experts');
    
    // Cleanup on unmount
    return () => {
      GutsTracker.cleanup();
    };
  }, []);
  
  // Example function to process data
  async function handleProcessData() {
    setLoading(true);
    try {
      // This will be tracked manually in the service
      const result = await ExampleService.processData(input);
      setProcessedData(result);
      
      // This will track table usage via our tracked client
      await supabase.from('function_registry').select('*').limit(1);
    } catch (error) {
      console.error('Error processing data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  // Example function to fetch external data
  async function handleFetchExternalData() {
    setLoading(true);
    try {
      // This will be tracked manually in the service
      const result = await ExampleService.fetchExternalData();
      if (result.success) {
        setExternalData(result.data);
      }
    } catch (error) {
      console.error('Error fetching external data:', error);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Guts Dashboard Example</h1>
      
      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Process Data Example</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="input">Input Data</Label>
                <Input
                  id="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter some data to process"
                />
              </div>
              
              <Button 
                onClick={handleProcessData} 
                disabled={loading || !input}
                className="w-full"
              >
                Process Data
              </Button>
              
              {processedData && (
                <div className="mt-4 p-3 bg-gray-100 rounded-md">
                  <p className="font-medium">Result:</p>
                  <p>{processedData}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>External API Example</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button 
                onClick={handleFetchExternalData} 
                disabled={loading}
                className="w-full"
              >
                Fetch External Data
              </Button>
              
              {externalData.length > 0 && (
                <div className="mt-4 p-3 bg-gray-100 rounded-md">
                  <p className="font-medium">External Data:</p>
                  <ul className="list-disc pl-5">
                    {externalData.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Guts Tab Component */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Guts Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">
            This dashboard shows the internal workings of this page. Try using the features above and see how they appear in the dashboard below.
          </p>
          
          <GutsTab 
            pagePath="/guts-example" 
            appName="dhg-improve-experts" 
          />
        </CardContent>
      </Card>
    </div>
  );
} 