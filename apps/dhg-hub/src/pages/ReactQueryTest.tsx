import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

// Test if React Query is causing the issue
export function ReactQueryTest() {
  const [queryEnabled, setQueryEnabled] = useState(true);
  const [renderCount, setRenderCount] = useState(0);
  
  // Create a query client with specific settings
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        retry: false,
        staleTime: Infinity,
      },
    },
  });
  
  // Increment render count
  useState(() => {
    setRenderCount(c => c + 1);
  });
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">React Query Test</h1>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-100 rounded">
          <p>Render count: {renderCount}</p>
          <p>Query enabled: {queryEnabled ? 'YES' : 'NO'}</p>
        </div>
        
        <button
          onClick={() => setQueryEnabled(!queryEnabled)}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Toggle React Query
        </button>
        
        {queryEnabled ? (
          <QueryClientProvider client={queryClient}>
            <div className="p-4 border-2 border-blue-500 rounded">
              <h2 className="font-bold">With React Query Provider</h2>
              <p>If this area flashes but not when disabled, React Query is the issue.</p>
            </div>
          </QueryClientProvider>
        ) : (
          <div className="p-4 border-2 border-green-500 rounded">
            <h2 className="font-bold">Without React Query Provider</h2>
            <p>React Query is disabled.</p>
          </div>
        )}
        
        <div className="p-4 bg-yellow-100 rounded">
          <h3 className="font-bold">What to look for:</h3>
          <ul className="list-disc list-inside">
            <li>If flashing stops when React Query is disabled, it's polling/refetching</li>
            <li>Check if refetchInterval was accidentally set somewhere</li>
            <li>Look for queries with aggressive refetch settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}