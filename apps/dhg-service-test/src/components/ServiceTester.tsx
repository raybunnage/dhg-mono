import React, { useState } from 'react';

// Define all services that dhg-admin-code uses
const SERVICE_GROUPS = {
  'Core Services': [
    {
      name: 'Supabase Client',
      importPath: '@shared/adapters/supabase-adapter',
      testFn: async () => {
        const { createSupabaseAdapter } = await import('@shared/adapters/supabase-adapter');
        return createSupabaseAdapter({ env: import.meta.env as any });
      }
    },
    {
      name: 'BrowserAuthService',
      importPath: '@shared/services/auth-service/browser',
      testFn: async () => {
        const { BrowserAuthService } = await import('@shared/services/auth-service/browser');
        return BrowserAuthService.getInstance();
      }
    },
    {
      name: 'ServerRegistryService',
      importPath: '@shared/services/server-registry-service',
      testFn: async () => {
        const { getServerRegistry } = await import('@shared/services/server-registry-service');
        return getServerRegistry();
      }
    }
  ],
  'Feature Services': [
    {
      name: 'ClipboardService',
      importPath: '@shared/services/clipboard-service',
      testFn: async () => {
        const { ClipboardService } = await import('@shared/services/clipboard-service');
        const { supabase } = await import('../lib/supabase');
        return ClipboardService.getInstance(supabase);
      }
    },
    {
      name: 'CLIRegistryService',
      importPath: '@shared/services/cli-registry-service',
      testFn: async () => {
        const { CLIRegistryService } = await import('@shared/services/cli-registry-service');
        const { supabase } = await import('../lib/supabase');
        return new CLIRegistryService(supabase);
      }
    },
    {
      name: 'DevTaskService',
      importPath: '@shared/services/dev-task-service',
      testFn: async () => {
        const { DevTaskService } = await import('@shared/services/dev-task-service');
        const { supabase } = await import('../lib/supabase');
        return DevTaskService.getInstance(supabase);
      }
    }
  ],
  'Document Services': [
    {
      name: 'DocumentTypeService',
      importPath: '@shared/services/document-type-service',
      testFn: async () => {
        const { documentTypeService } = await import('@shared/services/document-type-service');
        return documentTypeService;
      }
    },
    {
      name: 'DocumentClassificationService',
      importPath: '@shared/services/document-classification-service',
      testFn: async () => {
        const { documentClassificationService } = await import('@shared/services/document-classification-service');
        return documentClassificationService;
      }
    }
  ],
  'Element Services': [
    {
      name: 'ElementCatalogService',
      importPath: '@shared/services/element-catalog-service',
      testFn: async () => {
        const { ElementCatalogService } = await import('@shared/services/element-catalog-service');
        const { supabase } = await import('../lib/supabase');
        return ElementCatalogService.getInstance(supabase);
      }
    },
    {
      name: 'ElementCriteriaService',
      importPath: '@shared/services/element-criteria-service',
      testFn: async () => {
        const { ElementCriteriaService } = await import('@shared/services/element-criteria-service');
        const { supabase } = await import('../lib/supabase');
        return ElementCriteriaService.getInstance(supabase);
      }
    }
  ],
  'Other Services': [
    {
      name: 'MediaAnalyticsService',
      importPath: '@shared/services/media-analytics-service',
      testFn: async () => {
        const { MediaAnalyticsService } = await import('@shared/services/media-analytics-service');
        const { supabase } = await import('../lib/supabase');
        return MediaAnalyticsService.getInstance(supabase);
      }
    },
    {
      name: 'WorkSummaryService',
      importPath: '@shared/services/work-summary-service',
      testFn: async () => {
        const { WorkSummaryService } = await import('@shared/services/work-summary-service');
        const { supabase } = await import('../lib/supabase');
        return WorkSummaryService.getInstance(supabase);
      }
    }
  ]
};

interface ServiceTestResult {
  name: string;
  group: string;
  status: 'pending' | 'testing' | 'success' | 'error';
  error?: string;
  importTime?: number;
  initTime?: number;
}

export function ServiceTester() {
  const [results, setResults] = useState<ServiceTestResult[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(Object.keys(SERVICE_GROUPS)));
  const [testMode, setTestMode] = useState<'sequential' | 'parallel'>('sequential');
  const [isRunning, setIsRunning] = useState(false);

  const toggleGroup = (group: string) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(group)) {
        newSet.delete(group);
      } else {
        newSet.add(group);
      }
      return newSet;
    });
  };

  const testService = async (service: any, group: string): Promise<ServiceTestResult> => {
    const startTime = Date.now();
    const result: ServiceTestResult = {
      name: service.name,
      group,
      status: 'testing'
    };

    try {
      // Test dynamic import
      const importStart = Date.now();
      await import(service.importPath);
      result.importTime = Date.now() - importStart;

      // Test service initialization
      const initStart = Date.now();
      await service.testFn();
      result.initTime = Date.now() - initStart;

      result.status = 'success';
      console.log(`✅ ${service.name} - Import: ${result.importTime}ms, Init: ${result.initTime}ms`);
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
    
    // Collect selected services
    for (const [group, services] of Object.entries(SERVICE_GROUPS)) {
      if (selectedGroups.has(group)) {
        services.forEach(service => {
          servicesToTest.push({ service, group });
        });
      }
    }

    if (testMode === 'sequential') {
      // Test one by one
      for (const { service, group } of servicesToTest) {
        const result = await testService(service, group);
        setResults(prev => [...prev, result]);
      }
    } else {
      // Test in parallel
      const promises = servicesToTest.map(({ service, group }) => 
        testService(service, group)
      );
      const parallelResults = await Promise.all(promises);
      setResults(parallelResults);
    }

    setIsRunning(false);
  };

  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Service Tester</h1>

      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Test Mode</label>
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="sequential"
                checked={testMode === 'sequential'}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="mr-2"
              />
              Sequential (easier to debug)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="parallel"
                checked={testMode === 'parallel'}
                onChange={(e) => setTestMode(e.target.value as any)}
                className="mr-2"
              />
              Parallel (faster)
            </label>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Service Groups</label>
          <div className="space-y-2">
            {Object.keys(SERVICE_GROUPS).map(group => (
              <label key={group} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedGroups.has(group)}
                  onChange={() => toggleGroup(group)}
                  className="mr-2"
                />
                {group} ({SERVICE_GROUPS[group as keyof typeof SERVICE_GROUPS].length} services)
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={runTests}
          disabled={isRunning || selectedGroups.size === 0}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isRunning ? 'Running Tests...' : 'Run Tests'}
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
                        Import: {result.importTime}ms, Init: {result.initTime}ms
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

      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Testing Strategy</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>Start with Core Services - these are required by most other services</li>
          <li>Test incrementally - uncheck groups to isolate problematic services</li>
          <li>Use sequential mode for better error visibility</li>
          <li>Check browser console for detailed error messages</li>
        </ul>
      </div>
    </div>
  );
}