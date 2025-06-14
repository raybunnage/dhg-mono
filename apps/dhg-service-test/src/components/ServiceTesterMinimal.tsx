import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// Only import core services to start
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import { BrowserAuthService } from '@shared/services/auth-service/browser';
import { getServerRegistry } from '@shared/services/server-registry-service';

// Define only core services first
const SERVICE_GROUPS = {
  'Core Services': [
    {
      name: 'Supabase Client',
      testFn: () => {
        return createSupabaseAdapter({ env: import.meta.env as any });
      }
    },
    {
      name: 'BrowserAuthService',
      testFn: () => {
        return BrowserAuthService.getInstance();
      }
    },
    {
      name: 'ServerRegistryService',
      testFn: () => {
        return getServerRegistry();
      }
    }
  ]
};

interface ServiceTestResult {
  name: string;
  group: string;
  status: 'pending' | 'testing' | 'success' | 'error';
  error?: string;
  initTime?: number;
}

export function ServiceTesterMinimal() {
  const [results, setResults] = useState<ServiceTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const testService = async (service: any, group: string): Promise<ServiceTestResult> => {
    const startTime = Date.now();
    const result: ServiceTestResult = {
      name: service.name,
      group,
      status: 'testing'
    };

    try {
      await service.testFn();
      result.initTime = Date.now() - startTime;
      result.status = 'success';
      console.log(`✅ ${service.name} - Init: ${result.initTime}ms`);
    } catch (error) {
      result.status = 'error';
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ ${service.name} failed:`, error);
    }

    return result;
  };

  const runTests = async () => {
    setIsRunning(true);
    setResults([]);

    const servicesToTest: Array<{ service: any; group: string }> = [];
    
    // Test all core services
    for (const [group, services] of Object.entries(SERVICE_GROUPS)) {
      services.forEach(service => {
        servicesToTest.push({ service, group });
      });
    }

    // Test one by one
    for (const { service, group } of servicesToTest) {
      const result = await testService(service, group);
      setResults(prev => [...prev, result]);
    }

    setIsRunning(false);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Service Tester (Minimal - Core Only)</h1>

      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Core Services Only</h2>
        
        <p className="text-sm text-gray-600 mb-4">
          This version only tests core services to ensure the app can start.
        </p>

        <button
          onClick={runTests}
          disabled={isRunning}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isRunning ? 'Running Tests...' : 'Test Core Services'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="mb-8 bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          
          <div className="mb-4 flex gap-4 text-sm">
            <span className="text-green-600">✅ Success: {successCount}</span>
            <span className="text-red-600">❌ Errors: {errorCount}</span>
          </div>

          <div className="space-y-2">
            {results.map((result, index) => (
              <div 
                key={index}
                className={`p-3 rounded border ${
                  result.status === 'success' ? 'border-green-200 bg-green-50' :
                  result.status === 'error' ? 'border-red-200 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium">{result.name}</span>
                    <span className="text-sm text-gray-600 ml-2">({result.group})</span>
                  </div>
                  <div className="text-sm">
                    {result.status === 'success' && (
                      <span className="text-green-600">
                        Init: {result.initTime}ms
                      </span>
                    )}
                  </div>
                </div>
                {result.error && (
                  <div className="mt-1 text-sm text-red-600">
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Next Steps</h3>
        <p className="text-sm">
          Once core services pass, we'll incrementally add other services to find the problematic one.
        </p>
      </div>
    </div>
  );
}