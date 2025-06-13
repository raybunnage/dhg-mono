import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// Additional browser-compatible services not used by dhg-admin-code
// Adding SupabaseService (last one - likely the problematic one)
import { FilterService } from '@shared/services/filter-service';
import { DatabaseMetadataService } from '@shared/services/database-metadata-service';
import { createMediaTrackingService } from '@shared/services/media-tracking-service';
import { userProfileService } from '@shared/services/user-profile-service';
import { SupabaseService } from '@shared/services/supabase-service';

// Define service groups
const SERVICE_GROUPS = {
  'Data Management Services': [
    {
      name: 'FilterService',
      testFn: () => {
        // FilterService uses constructor pattern
        return new FilterService(supabase);
      }
    },
    {
      name: 'DatabaseMetadataService',
      testFn: () => {
        return DatabaseMetadataService.getInstance(supabase);
      }
    }
  ],
  'Media Services': [
    {
      name: 'MediaTrackingService',
      testFn: () => {
        return createMediaTrackingService(supabase);
      }
    }
  ],
  'User Services': [
    {
      name: 'UserProfileService',
      testFn: () => {
        return UserProfileService.getInstance(supabase);
      }
    }
  ],
  'Database Services': [
    {
      name: 'SupabaseService',
      testFn: () => {
        return new SupabaseService();
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

export function ServiceTesterIncremental5() {
  const [results, setResults] = useState<ServiceTestResult[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(['Data Management Services', 'Media Services', 'User Services', 'Database Services'])
  );
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
      <h1 className="text-3xl font-bold mb-8">Additional Browser Services Test</h1>

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

      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="font-medium mb-2">Additional Browser-Compatible Services</h3>
        <p className="text-sm mb-2">
          Testing services that could be useful in other browser applications:
        </p>
        <ul className="text-sm list-disc list-inside space-y-1">
          <li><strong>FilterService</strong> - Manage and apply query filters</li>
          <li><strong>DatabaseMetadataService</strong> - Database introspection and metadata</li>
          <li><strong>MediaTrackingService</strong> - Track media playback and analytics</li>
          <li><strong>UserProfileService</strong> - User profile management</li>
          <li><strong>SupabaseService</strong> - Additional database utilities</li>
        </ul>
        <p className="text-sm mt-2 text-gray-600">
          These services demonstrate the flexibility of the architecture for different app needs.
        </p>
      </div>
    </div>
  );
}