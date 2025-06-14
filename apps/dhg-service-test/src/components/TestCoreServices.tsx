import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { browserAuthService } from '../lib/auth-init';
import { CLIRegistryService } from '@shared/services/cli-registry-service';

interface TestResult {
  service: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  data?: any;
}

export function TestCoreServices() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (service: string, status: TestResult['status'], message: string, data?: any) => {
    setResults(prev => {
      const existing = prev.find(r => r.service === service);
      if (existing) {
        return prev.map(r => r.service === service ? { ...r, status, message, data } : r);
      }
      return [...prev, { service, status, message, data }];
    });
  };

  const testSupabase = async () => {
    updateResult('Supabase', 'pending', 'Testing connection...');
    try {
      // Test a simple query like dhg-admin-code does
      const { data, error } = await supabase
        .from('command_pipelines')
        .select('name, display_name, status')
        .eq('status', 'active')
        .limit(3);

      if (error) throw error;

      updateResult('Supabase', 'success', `Connected! Found ${data?.length || 0} active pipelines`, data);
    } catch (error) {
      updateResult('Supabase', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testAuth = async () => {
    updateResult('BrowserAuthService', 'pending', 'Checking auth state...');
    try {
      // Test auth service like dhg-admin-code does
      const user = await browserAuthService().getCurrentUser();
      
      if (user) {
        updateResult('BrowserAuthService', 'success', `Authenticated as: ${user.email}`, { 
          id: user.id,
          email: user.email,
          created_at: user.created_at
        });
      } else {
        updateResult('BrowserAuthService', 'success', 'Not authenticated (working correctly)');
      }
    } catch (error) {
      updateResult('BrowserAuthService', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const testCLIRegistry = async () => {
    updateResult('CLIRegistryService', 'pending', 'Initializing service...');
    try {
      // Initialize service with supabase like dhg-admin-code does
      const registryService = new CLIRegistryService(supabase);
      
      // Test getting pipelines
      const pipelines = await registryService.getPipelines();
      
      updateResult('CLIRegistryService', 'success', 
        `Service working! Found ${pipelines.length} pipelines`, 
        pipelines.slice(0, 3).map(p => ({ name: p.name, status: p.status }))
      );
    } catch (error) {
      updateResult('CLIRegistryService', 'error', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    // Run tests sequentially
    await testSupabase();
    await testAuth();
    await testCLIRegistry();

    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Core Services Test</h2>
        <p className="text-gray-600 mb-4">
          Testing the same core services that work in dhg-admin-code
        </p>
        
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                result.status === 'success' ? 'bg-green-50 border-green-200' :
                result.status === 'error' ? 'bg-red-50 border-red-200' :
                'bg-yellow-50 border-yellow-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{result.service}</h3>
                  <p className={`text-sm mt-1 ${
                    result.status === 'success' ? 'text-green-700' :
                    result.status === 'error' ? 'text-red-700' :
                    'text-yellow-700'
                  }`}>
                    {result.message}
                  </p>
                </div>
                <span className="text-2xl">
                  {result.status === 'success' ? '✅' :
                   result.status === 'error' ? '❌' :
                   '⏳'}
                </span>
              </div>
              
              {result.data && (
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Implementation Notes:</h3>
        <ul className="text-sm space-y-1 list-disc list-inside">
          <li>Using the same Supabase adapter pattern as dhg-admin-code</li>
          <li>BrowserAuthService initialized with Supabase client in auth-init.ts</li>
          <li>CLIRegistryService instantiated with Supabase client (not a singleton)</li>
          <li>All services follow the exact patterns from dhg-admin-code</li>
        </ul>
      </div>
    </div>
  );
}