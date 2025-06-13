import React, { useState, useEffect } from 'react';
import { SupabaseClientService } from '@shared/services/supabase-client';
import { SupabaseService } from '@shared/services/supabase-service';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import type { SupabaseClient } from '@supabase/supabase-js';

interface TestResult {
  service: string;
  method: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  executionTime?: number;
  data?: any;
}

interface PerformanceMetrics {
  connectionCount: number;
  averageResponseTime: number;
  totalTests: number;
  successfulTests: number;
  failedTests: number;
}

export const TestSupabaseServices: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    connectionCount: 0,
    averageResponseTime: 0,
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0
  });
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
    
    // Update metrics
    setMetrics(prev => {
      const newMetrics = { ...prev };
      newMetrics.totalTests++;
      
      if (result.status === 'success') {
        newMetrics.successfulTests++;
      } else if (result.status === 'error') {
        newMetrics.failedTests++;
      }
      
      if (result.executionTime) {
        const totalTime = prev.averageResponseTime * (prev.totalTests - 1) + result.executionTime;
        newMetrics.averageResponseTime = totalTime / newMetrics.totalTests;
      }
      
      return newMetrics;
    });
  };

  const runTest = async (
    service: string,
    method: string,
    testFn: () => Promise<any>
  ): Promise<TestResult> => {
    const startTime = performance.now();
    const result: TestResult = {
      service,
      method,
      status: 'pending'
    };

    try {
      const data = await testFn();
      const endTime = performance.now();
      
      result.status = 'success';
      result.executionTime = endTime - startTime;
      result.data = data;
      result.message = `Successfully executed in ${result.executionTime.toFixed(2)}ms`;
    } catch (error) {
      const endTime = performance.now();
      result.status = 'error';
      result.executionTime = endTime - startTime;
      result.message = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  };

  const testSupabaseClientService = async () => {
    console.log('Testing SupabaseClientService...');
    
    // Test 1: Singleton pattern
    const result1 = await runTest(
      'SupabaseClientService',
      'getInstance() - Singleton Pattern',
      async () => {
        const instance1 = SupabaseClientService.getInstance();
        const instance2 = SupabaseClientService.getInstance();
        
        if (instance1 !== instance2) {
          throw new Error('Singleton pattern violation - instances are not the same');
        }
        
        return { 
          singletonVerified: true,
          instance: instance1.constructor.name 
        };
      }
    );
    addTestResult(result1);

    // Test 2: Get client
    const result2 = await runTest(
      'SupabaseClientService',
      'getClient() - Client Retrieval',
      async () => {
        const client = SupabaseClientService.getInstance().getClient();
        
        if (!client) {
          throw new Error('Failed to get Supabase client');
        }
        
        // Check client has expected methods
        const hasAuth = 'auth' in client;
        const hasFrom = 'from' in client;
        const hasRpc = 'rpc' in client;
        
        return {
          clientType: client.constructor.name,
          hasAuth,
          hasFrom,
          hasRpc,
          authUrl: client.auth.getSession ? 'Available' : 'Not available'
        };
      }
    );
    addTestResult(result2);

    // Test 3: Query execution
    const result3 = await runTest(
      'SupabaseClientService',
      'Query Execution - experts table',
      async () => {
        const client = SupabaseClientService.getInstance().getClient();
        const { data, error } = await client
          .from('expert_profiles')
          .select('id, expert_name')
          .limit(5);
        
        if (error) throw error;
        
        return {
          recordCount: data?.length || 0,
          sample: data?.[0] || null
        };
      }
    );
    addTestResult(result3);

    // Test 4: Connection count
    setMetrics(prev => ({ ...prev, connectionCount: 1 })); // Singleton ensures single connection
  };

  const testSupabaseService = async () => {
    console.log('Testing SupabaseService...');
    
    // Test 1: getPromptByName
    const result1 = await runTest(
      'SupabaseService',
      'getPromptByName()',
      async () => {
        const prompt = await SupabaseService.getPromptByName('document-classification');
        
        if (!prompt) {
          throw new Error('No prompt found with name: document-classification');
        }
        
        return {
          promptId: prompt.id,
          promptName: prompt.name,
          hasContent: !!prompt.content,
          contentLength: prompt.content?.length || 0
        };
      }
    );
    addTestResult(result1);

    // Test 2: getDocumentTypesByCategory
    const result2 = await runTest(
      'SupabaseService',
      'getDocumentTypesByCategory()',
      async () => {
        const types = await SupabaseService.getDocumentTypesByCategory('research');
        
        return {
          categoryCount: types.length,
          sampleType: types[0]?.name || 'None',
          allHaveExamples: types.every(t => t.example && t.example.length > 0)
        };
      }
    );
    addTestResult(result2);

    // Test 3: getActiveExperts
    const result3 = await runTest(
      'SupabaseService',
      'getActiveExperts()',
      async () => {
        const experts = await SupabaseService.getActiveExperts();
        
        return {
          expertCount: experts.length,
          sampleExpert: experts[0]?.expert_name || 'None',
          allActive: experts.every(e => e.is_active === true)
        };
      }
    );
    addTestResult(result3);

    // Test 4: getExpertByName
    const result4 = await runTest(
      'SupabaseService',
      'getExpertByName()',
      async () => {
        const expert = await SupabaseService.getExpertByName('Robert Naviaux');
        
        if (!expert) {
          throw new Error('Expert not found: Robert Naviaux');
        }
        
        return {
          expertId: expert.id,
          expertName: expert.expert_name,
          isActive: expert.is_active,
          hasAffiliation: !!expert.affiliation
        };
      }
    );
    addTestResult(result4);

    // Test 5: Available methods check
    const result5 = await runTest(
      'SupabaseService',
      'Available Methods Check',
      async () => {
        const availableMethods = Object.getOwnPropertyNames(SupabaseService)
          .filter(name => typeof (SupabaseService as any)[name] === 'function');
        
        return {
          methodCount: availableMethods.length,
          methods: availableMethods
        };
      }
    );
    addTestResult(result5);
  };

  const testSupabaseAdapter = async () => {
    console.log('Testing createSupabaseAdapter...');
    
    // Test 1: Adapter creation
    const result1 = await runTest(
      'createSupabaseAdapter',
      'Adapter Creation',
      async () => {
        const adapter = createSupabaseAdapter({
          env: import.meta.env as any
        });
        
        if (!adapter) {
          throw new Error('Failed to create Supabase adapter');
        }
        
        return {
          adapterType: adapter.constructor.name,
          hasAuth: 'auth' in adapter,
          hasFrom: 'from' in adapter,
          environment: typeof window !== 'undefined' ? 'browser' : 'server'
        };
      }
    );
    addTestResult(result1);

    // Test 2: Environment detection
    const result2 = await runTest(
      'createSupabaseAdapter',
      'Environment Detection',
      async () => {
        const adapter = createSupabaseAdapter({
          env: import.meta.env as any
        });
        
        // Check which environment variables are being used
        const isBrowser = typeof window !== 'undefined';
        const envVarPrefix = isBrowser ? 'VITE_' : '';
        
        return {
          environment: isBrowser ? 'browser' : 'server',
          expectedEnvPrefix: envVarPrefix,
          hasViteEnvVars: isBrowser && import.meta.env.VITE_SUPABASE_URL !== undefined,
          actualUrl: isBrowser ? import.meta.env.VITE_SUPABASE_URL : process.env.SUPABASE_URL
        };
      }
    );
    addTestResult(result2);

    // Test 3: Auth handling
    const result3 = await runTest(
      'createSupabaseAdapter',
      'Auth Handling',
      async () => {
        const adapter = createSupabaseAdapter({
          env: import.meta.env as any
        });
        const { data: session } = await adapter.auth.getSession();
        
        return {
          hasAuthMethods: true,
          sessionExists: !!session?.session,
          userId: session?.session?.user?.id || 'No active session'
        };
      }
    );
    addTestResult(result3);

    // Test 4: Query execution via adapter
    const result4 = await runTest(
      'createSupabaseAdapter',
      'Query Execution',
      async () => {
        const adapter = createSupabaseAdapter({
          env: import.meta.env as any
        });
        const { data, error } = await adapter
          .from('document_types')
          .select('id, name, category')
          .limit(3);
        
        if (error) throw error;
        
        return {
          recordCount: data?.length || 0,
          sample: data?.[0] || null
        };
      }
    );
    addTestResult(result4);

    // Test 5: Service comparison
    const result5 = await runTest(
      'createSupabaseAdapter',
      'Service Comparison',
      async () => {
        const adapter = createSupabaseAdapter({
          env: import.meta.env as any
        });
        const clientService = SupabaseClientService.getInstance().getClient();
        
        // Both should be able to query the same data
        const [adapterResult, clientResult] = await Promise.all([
          adapter.from('sys_shared_services').select('count').single(),
          clientService.from('sys_shared_services').select('count').single()
        ]);
        
        return {
          adapterWorks: !adapterResult.error,
          clientServiceWorks: !clientResult.error,
          bothWorkTogether: !adapterResult.error && !clientResult.error
        };
      }
    );
    addTestResult(result5);
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    setMetrics({
      connectionCount: 0,
      averageResponseTime: 0,
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0
    });

    try {
      await testSupabaseClientService();
      await testSupabaseService();
      await testSupabaseAdapter();
    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const saveTestResults = async () => {
    try {
      const adapter = createSupabaseAdapter({
        env: import.meta.env as any
      });
      
      // Prepare test results for storage
      const testSummary = {
        service_name: 'Supabase Services Test Suite',
        status: metrics.failedTests === 0 ? 'healthy' : 'warning',
        last_check: new Date().toISOString(),
        health_data: {
          metrics,
          testResults: testResults.map(r => ({
            service: r.service,
            method: r.method,
            status: r.status,
            executionTime: r.executionTime,
            message: r.message
          }))
        },
        instance_count: metrics.connectionCount,
        response_time_ms: Math.round(metrics.averageResponseTime),
        error_count: metrics.failedTests,
        success_rate: metrics.totalTests > 0 
          ? (metrics.successfulTests / metrics.totalTests * 100).toFixed(2) + '%'
          : '0%'
      };

      const { error } = await adapter
        .from('sys_shared_services')
        .upsert(testSummary, {
          onConflict: 'service_name'
        });

      if (error) throw error;

      alert('Test results saved successfully!');
    } catch (error) {
      console.error('Failed to save test results:', error);
      alert('Failed to save test results: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const toggleResultExpansion = (index: number) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Supabase Services Test Suite</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-3">Performance Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <p className="text-sm text-gray-600">Connection Count</p>
            <p className="text-2xl font-bold">{metrics.connectionCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Avg Response Time</p>
            <p className="text-2xl font-bold">{metrics.averageResponseTime.toFixed(2)}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Tests</p>
            <p className="text-2xl font-bold">{metrics.totalTests}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Successful</p>
            <p className="text-2xl font-bold text-green-600">{metrics.successfulTests}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Failed</p>
            <p className="text-2xl font-bold text-red-600">{metrics.failedTests}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-4">
        <button
          onClick={runAllTests}
          disabled={isRunning}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
        
        <button
          onClick={saveTestResults}
          disabled={testResults.length === 0}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Save Test Results
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Test Results</h2>
        
        {testResults.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              result.status === 'success' 
                ? 'bg-green-50 border-green-300' 
                : result.status === 'error'
                ? 'bg-red-50 border-red-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}
          >
            <div 
              className="flex justify-between items-start cursor-pointer"
              onClick={() => toggleResultExpansion(index)}
            >
              <div className="flex-1">
                <h3 className="font-semibold">{result.service}</h3>
                <p className="text-sm text-gray-600">{result.method}</p>
                {result.message && (
                  <p className={`text-sm mt-1 ${
                    result.status === 'error' ? 'text-red-600' : 'text-gray-700'
                  }`}>
                    {result.message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  result.status === 'success'
                    ? 'bg-green-200 text-green-800'
                    : result.status === 'error'
                    ? 'bg-red-200 text-red-800'
                    : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {result.status.toUpperCase()}
                </span>
                <svg 
                  className={`w-4 h-4 transform transition-transform ${
                    expandedResults.has(index) ? 'rotate-180' : ''
                  }`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            
            {expandedResults.has(index) && result.data && (
              <div className="mt-4 p-3 bg-white rounded border border-gray-200">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
        
        {testResults.length === 0 && !isRunning && (
          <p className="text-gray-500 text-center py-8">
            No test results yet. Click "Run All Tests" to start.
          </p>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Service Overview</h3>
        <div className="space-y-2 text-sm">
          <div>
            <strong>SupabaseClientService:</strong> Singleton pattern for server/CLI environments. 
            Manages a single connection instance.
          </div>
          <div>
            <strong>SupabaseService:</strong> Utility service with helper methods for common queries 
            (prompts, experts, document types).
          </div>
          <div>
            <strong>createSupabaseAdapter:</strong> Universal adapter that detects environment 
            (browser vs server) and configures accordingly.
          </div>
        </div>
      </div>
    </div>
  );
};