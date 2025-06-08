import { useState, useEffect, useRef } from 'react';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

// Test configurations
const TEST_SCENARIOS = {
  'no-supabase': 'No Supabase connection',
  'supabase-lazy': 'Supabase created lazily on first use',
  'supabase-immediate': 'Supabase created immediately',
  'supabase-with-query': 'Supabase with immediate query',
  'react-query-only': 'React Query without Supabase',
  'static-only': 'Static content only'
};

export function IsolationTest() {
  const [scenario, setScenario] = useState<keyof typeof TEST_SCENARIOS>('static-only');
  const [logs, setLogs] = useState<string[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState<any>(null);
  const [queryResult, setQueryResult] = useState<any>(null);
  const renderCount = useRef(0);
  const mountTime = useRef(Date.now());
  const flashTimeout = useRef<any>(null);
  
  const log = (message: string) => {
    const timestamp = Date.now() - mountTime.current;
    const logEntry = `[${timestamp}ms] ${message}`;
    console.log(`🧪 ${logEntry}`);
    setLogs(prev => [...prev, logEntry]);
  };
  
  // Track renders
  renderCount.current++;
  
  // Track background color changes
  useEffect(() => {
    log(`Component mounted - Scenario: ${scenario}`);
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target as HTMLElement;
          if (target === document.body || target === document.documentElement) {
            log(`⚡ STYLE CHANGE DETECTED on ${target.tagName}: ${target.getAttribute('style')}`);
            setIsFlashing(true);
            
            if (flashTimeout.current) clearTimeout(flashTimeout.current);
            flashTimeout.current = setTimeout(() => setIsFlashing(false), 500);
          }
        }
      });
    });
    
    observer.observe(document.body, { 
      attributes: true, 
      attributeFilter: ['style', 'class'],
      subtree: true 
    });
    
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['style', 'class'] 
    });
    
    return () => {
      observer.disconnect();
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [scenario]);
  
  // Execute test scenarios
  useEffect(() => {
    log(`Starting scenario: ${scenario}`);
    setQueryResult(null);
    setSupabaseClient(null);
    
    const runScenario = async () => {
      switch (scenario) {
        case 'no-supabase':
          log('No Supabase initialization');
          break;
          
        case 'supabase-lazy':
          log('Setting up lazy Supabase initialization');
          // Don't create client until button is clicked
          break;
          
        case 'supabase-immediate':
          log('Creating Supabase client immediately');
          const client1 = createSupabaseAdapter({ env: import.meta.env as any });
          setSupabaseClient(client1);
          log('Supabase client created');
          break;
          
        case 'supabase-with-query':
          log('Creating Supabase client and running query');
          const client2 = createSupabaseAdapter({ env: import.meta.env as any });
          setSupabaseClient(client2);
          log('Running test query');
          
          try {
            const { data, error } = await client2
              .from('expert_profiles')
              .select('id, expert_name')
              .limit(1);
            
            if (error) {
              log(`Query error: ${error.message}`);
            } else {
              log(`Query success: ${data?.length || 0} results`);
              setQueryResult(data);
            }
          } catch (e) {
            log(`Query exception: ${e}`);
          }
          break;
          
        case 'react-query-only':
          log('Testing React Query without Supabase');
          // Would add React Query test here
          break;
          
        case 'static-only':
          log('Static content only - no external dependencies');
          break;
      }
    };
    
    runScenario();
  }, [scenario]);
  
  const handleLazyInit = async () => {
    log('Lazy initialization triggered');
    const client = createSupabaseAdapter({ env: import.meta.env as any });
    setSupabaseClient(client);
    log('Supabase client created lazily');
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Isolation Test - Finding the Flash</h1>
        
        {/* Flash indicator */}
        {isFlashing && (
          <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg animate-pulse">
            ⚡ FLASH DETECTED!
          </div>
        )}
        
        {/* Test scenario selector */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Scenarios</h2>
          <div className="grid grid-cols-2 gap-4">
            {Object.entries(TEST_SCENARIOS).map(([key, description]) => (
              <button
                key={key}
                onClick={() => setScenario(key as keyof typeof TEST_SCENARIOS)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  scenario === key 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{key}</div>
                <div className="text-sm text-gray-600">{description}</div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Current state */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current State</h2>
          <div className="space-y-2">
            <div>Current Scenario: <span className="font-mono">{scenario}</span></div>
            <div>Render Count: <span className="font-mono">{renderCount.current}</span></div>
            <div>Supabase Client: <span className="font-mono">{supabaseClient ? 'Initialized' : 'Not initialized'}</span></div>
            <div>Query Result: <span className="font-mono">{queryResult ? JSON.stringify(queryResult) : 'None'}</span></div>
          </div>
          
          {scenario === 'supabase-lazy' && !supabaseClient && (
            <button
              onClick={handleLazyInit}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Initialize Supabase
            </button>
          )}
        </div>
        
        {/* Timeline logs */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Timeline</h2>
          <div className="space-y-1 font-mono text-sm max-h-96 overflow-y-auto">
            {logs.map((log, i) => (
              <div 
                key={i} 
                className={`py-1 ${log.includes('FLASH') ? 'text-red-600 font-bold' : ''}`}
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}