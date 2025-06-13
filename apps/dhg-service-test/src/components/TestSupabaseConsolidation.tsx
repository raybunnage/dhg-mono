import React, { useState } from 'react';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import { supabase } from '../lib/supabase';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  details?: any;
}

export function TestSupabaseConsolidation() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (name: string, status: TestResult['status'], message: string, details?: any) => {
    setResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        return prev.map(r => r.name === name ? { ...r, status, message, details } : r);
      }
      return [...prev, { name, status, message, details }];
    });
  };

  const tests = [
    {
      name: 'SupabaseClientService Singleton Pattern',
      run: async () => {
        updateResult('SupabaseClientService Singleton Pattern', 'running', 'Testing singleton behavior...');
        
        try {
          // Test 1: Singleton returns same instance
          const instance1 = SupabaseClientService.getInstance();
          const instance2 = SupabaseClientService.getInstance();
          
          if (instance1 !== instance2) {
            throw new Error('Singleton pattern broken - different instances returned');
          }

          // Test 2: Client is consistent
          const client1 = instance1.getClient();
          const client2 = instance2.getClient();
          
          if (client1 !== client2) {
            throw new Error('Different clients returned from same singleton');
          }

          updateResult(
            'SupabaseClientService Singleton Pattern', 
            'success', 
            'Singleton working correctly',
            { 
              sameInstance: instance1 === instance2,
              sameClient: client1 === client2 
            }
          );
        } catch (error) {
          updateResult(
            'SupabaseClientService Singleton Pattern', 
            'error', 
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    },
    {
      name: 'Browser Adapter Pattern',
      run: async () => {
        updateResult('Browser Adapter Pattern', 'running', 'Testing browser adapter...');
        
        try {
          // Test adapter creation
          const adapter = createSupabaseAdapter({ env: import.meta.env });
          
          // Test it can make queries
          const { data, error } = await adapter
            .from('sys_shared_services')
            .select('count')
            .single();
            
          if (error) {
            throw new Error(`Query failed: ${error.message}`);
          }

          updateResult(
            'Browser Adapter Pattern', 
            'success', 
            'Browser adapter working correctly',
            { 
              canQuery: true,
              recordCount: data?.count || 0
            }
          );
        } catch (error) {
          updateResult(
            'Browser Adapter Pattern', 
            'error', 
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    },
    {
      name: 'Local Supabase Instance',
      run: async () => {
        updateResult('Local Supabase Instance', 'running', 'Testing local app instance...');
        
        try {
          // Test the imported supabase from lib
          const { data, error } = await supabase
            .from('sys_shared_services')
            .select('service_name')
            .limit(1);
            
          if (error) {
            throw new Error(`Query failed: ${error.message}`);
          }

          updateResult(
            'Local Supabase Instance', 
            'success', 
            'Local supabase instance working',
            { 
              canQuery: true,
              sampleService: data?.[0]?.service_name
            }
          );
        } catch (error) {
          updateResult(
            'Local Supabase Instance', 
            'error', 
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    },
    {
      name: 'Connection Count Check',
      run: async () => {
        updateResult('Connection Count Check', 'running', 'Checking active connections...');
        
        try {
          // Query to check active connections (PostgreSQL specific)
          const { data, error } = await supabase.rpc('execute_sql', {
            sql_query: `
              SELECT COUNT(*) as connection_count
              FROM pg_stat_activity
              WHERE datname = current_database()
              AND state = 'active'
            `
          });
          
          if (error) {
            throw new Error(`Connection check failed: ${error.message}`);
          }

          const count = data?.[0]?.connection_count || 0;
          
          updateResult(
            'Connection Count Check', 
            'success', 
            `Active connections: ${count}`,
            { 
              connectionCount: count,
              isOptimal: count <= 5 // Should be minimal for free tier
            }
          );
        } catch (error) {
          updateResult(
            'Connection Count Check', 
            'error', 
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    },
    {
      name: 'Usage Pattern Analysis',
      run: async () => {
        updateResult('Usage Pattern Analysis', 'running', 'Analyzing Supabase usage patterns...');
        
        try {
          // Get usage stats for all Supabase services
          const { data, error } = await supabase
            .from('sys_shared_services')
            .select('service_name, usage_count')
            .ilike('service_name', '%supabase%')
            .order('usage_count', { ascending: false });
            
          if (error) {
            throw new Error(`Analysis failed: ${error.message}`);
          }

          const totalUsage = data?.reduce((sum, s) => sum + (s.usage_count || 0), 0) || 0;
          const duplicates = data?.filter(s => s.service_name !== 'SupabaseClientService') || [];
          
          updateResult(
            'Usage Pattern Analysis', 
            'success', 
            `Found ${data?.length || 0} Supabase services`,
            { 
              services: data,
              totalUsage,
              duplicateUsage: duplicates.reduce((sum, s) => sum + (s.usage_count || 0), 0),
              recommendation: duplicates.length > 0 ? 'Consolidation needed' : 'Already consolidated'
            }
          );
        } catch (error) {
          updateResult(
            'Usage Pattern Analysis', 
            'error', 
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }
    }
  ];

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    for (const test of tests) {
      await test.run();
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const allSuccess = results.every(r => r.status === 'success');
  const hasErrors = results.some(r => r.status === 'error');

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-2xl font-bold mb-4">Supabase Service Consolidation Test</h2>
        
        <p className="text-gray-600 mb-4">
          Testing all Supabase patterns to ensure consolidation is safe
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
                result.status === 'running' ? 'bg-yellow-50 border-yellow-200' :
                'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{result.name}</h3>
                  <p className={`text-sm mt-1 ${
                    result.status === 'success' ? 'text-green-700' :
                    result.status === 'error' ? 'text-red-700' :
                    'text-gray-700'
                  }`}>
                    {result.message}
                  </p>
                  {result.details && (
                    <pre className="mt-2 text-xs bg-white p-2 rounded border overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  )}
                </div>
                <span className="text-2xl ml-4">
                  {result.status === 'success' ? '✅' :
                   result.status === 'error' ? '❌' :
                   result.status === 'running' ? '⏳' :
                   '⏸️'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && !isRunning && (
        <div className={`p-4 rounded-lg ${
          allSuccess ? 'bg-green-100' : 
          hasErrors ? 'bg-red-100' : 
          'bg-yellow-100'
        }`}>
          <h3 className="font-semibold mb-2">
            {allSuccess ? '✅ All Tests Passed!' :
             hasErrors ? '❌ Some Tests Failed' :
             '⚠️ Tests Incomplete'}
          </h3>
          
          {allSuccess && (
            <p className="text-sm">
              Supabase services are working correctly. Safe to proceed with consolidation.
            </p>
          )}
          
          {hasErrors && (
            <p className="text-sm">
              Fix the failing tests before proceeding with consolidation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}