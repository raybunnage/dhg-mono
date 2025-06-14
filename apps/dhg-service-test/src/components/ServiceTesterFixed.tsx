import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// Import all services statically
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import { BrowserAuthService } from '@shared/services/auth-service/browser';
import { getServerRegistry } from '@shared/services/server-registry-service';
import { ClipboardService } from '@shared/services/clipboard-service';
import { CLIRegistryService } from '@shared/services/cli-registry-service';
import { DevTaskService } from '@shared/services/dev-task-service';
import { documentTypeService } from '@shared/services/document-type-service';
import { getDocumentClassificationService } from '@shared/services/document-classification-service';
import { ElementCatalogService } from '@shared/services/element-catalog-service';
import { ElementCriteriaService } from '@shared/services/element-criteria-service';
import { MediaAnalyticsService } from '@shared/services/media-analytics-service';
import { WorkSummaryService } from '@shared/services/work-summary-service';

// Define all services that dhg-admin-code uses
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
  ],
  'Feature Services': [
    {
      name: 'ClipboardService',
      testFn: () => {
        return ClipboardService.getInstance(supabase);
      }
    },
    {
      name: 'CLIRegistryService',
      testFn: () => {
        return new CLIRegistryService(supabase);
      }
    },
    {
      name: 'DevTaskService',
      testFn: () => {
        return DevTaskService.getInstance(supabase);
      }
    }
  ],
  'Document Services': [
    {
      name: 'DocumentTypeService',
      testFn: () => {
        return documentTypeService;
      }
    },
    {
      name: 'DocumentClassificationService',
      testFn: () => {
        return getDocumentClassificationService(supabase);
      }
    }
  ],
  'Element Services': [
    {
      name: 'ElementCatalogService',
      testFn: () => {
        return ElementCatalogService.getInstance(supabase);
      }
    },
    {
      name: 'ElementCriteriaService',
      testFn: () => {
        return ElementCriteriaService.getInstance(supabase);
      }
    }
  ],
  'Other Services': [
    {
      name: 'MediaAnalyticsService',
      testFn: () => {
        return MediaAnalyticsService.getInstance(supabase);
      }
    },
    {
      name: 'WorkSummaryService',
      testFn: () => {
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
  initTime?: number;
}

export function ServiceTesterFixed() {
  const [results, setResults] = useState<ServiceTestResult[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set(['Core Services', 'Feature Services']));
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
      // Test service initialization
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
    
    // Collect selected services
    for (const [group, services] of Object.entries(SERVICE_GROUPS)) {
      if (selectedGroups.has(group)) {
        services.forEach(service => {
          servicesToTest.push({ service, group });
        });
      }
    }

    // Test one by one (sequential)
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
      <h1 className="text-3xl font-bold mb-8">Service Tester (Fixed)</h1>

      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
        
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

      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Testing Instructions</h3>
        <ul className="list-disc list-inside text-sm space-y-1">
          <li>This version uses static imports to avoid module resolution issues</li>
          <li>Start with Core + Feature Services</li>
          <li>Add groups incrementally to isolate issues</li>
          <li>Check browser console for detailed error messages</li>
        </ul>
      </div>
    </div>
  );
}