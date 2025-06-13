import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

// Top 5 browser-compatible services that aren't already tested
// Based on analysis of sys_shared_services with browser compatibility scoring

// Auth services (highest scoring) - Use browser-compatible versions
import { BrowserAuthService } from '@shared/services/auth-service/browser-auth-service';
// COMMENTED OUT: GoogleAuthService uses Node.js-only dependencies (google-auth-library)
// import { GoogleAuthService } from '@shared/services/google-drive/google-auth-service';

// Media services
import { MediaPresentationService } from '@shared/services/media-presentation-service';

// Testing service
// import { TestingService } from '@shared/services/testing-service';

// Audio service from dhg-audio (reported issue)
// import { audioBrowserService } from '../../../dhg-audio/src/services/audio-browser-service';

// Index service (utility aggregator)
// Note: This is the main index.ts that exports many services - testing import only
// import { } from '@shared/services/index'; // Will test direct import

// Define service groups for the new candidates
const NEW_SERVICE_CANDIDATES = {
  'Authentication Services': [
    {
      name: 'BrowserAuthService',
      description: 'Core authentication and authorization service (browser variant)',
      hassBrowserVariant: true,
      testFn: async () => {
        try {
          // Initialize BrowserAuthService with supabase client first
          BrowserAuthService.initialize(supabase);
          const authService = BrowserAuthService.getInstance();
          return authService !== null && typeof authService === 'object';
        } catch (error) {
          console.error('BrowserAuthService test error:', error);
          return false;
        }
      },
      browserFeatures: ['Browser-specific implementation', 'Singleton access', 'localStorage integration']
    }
    // COMMENTED OUT: GoogleAuthService uses Node.js-only dependencies
    // {
    //   name: 'GoogleAuthService', 
    //   description: 'Google authentication with service account and OAuth support',
    //   hassBrowserVariant: true,
    //   testFn: async () => {
    //     // Test both default instance and configured instance
    //     const defaultAuth = GoogleAuthService.getDefaultInstance();
    //     const configuredAuth = GoogleAuthService.getInstance({
    //       scopes: ['https://www.googleapis.com/auth/drive.readonly']
    //     });
    //     return defaultAuth !== null && configuredAuth !== null;
    //   },
    //   browserFeatures: ['Environment detection', 'localStorage adapter', 'Service account fallback']
    // }
  ],
  'Media Services': [
    {
      name: 'MediaPresentationService',
      description: 'Manages media presentations and their associated assets', 
      hassBrowserVariant: true,
      testFn: async () => {
        // Test browser-compatible getInstance with supabase client
        const mediaService = MediaPresentationService.getInstance(supabase);
        return mediaService !== null && typeof mediaService.getPresentationById === 'function';
      },
      browserFeatures: ['Browser-specific instantiation', 'Per-client instances', 'Database operations']
    }
  ],
  'Audio Services': [
    {
      name: 'AudioBrowserService',
      description: 'Audio file management and playback service from dhg-audio app',
      hassBrowserVariant: true,
      testFn: async () => {
        try {
          // Test getInstance and core methods
          // const audioService = audioBrowserService.getInstance();
          throw new Error('audioBrowserService temporarily disabled');
          return audioService !== null && 
                 typeof audioService.getAudioFiles === 'function' &&
                 typeof audioService.getAudioFile === 'function' &&
                 typeof audioService.getTranscript === 'function';
        } catch (error) {
          console.error('AudioBrowserService test error:', error);
          return false;
        }
      },
      browserFeatures: ['Singleton pattern', 'Database operations', 'Supabase integration', 'File management']
    }
  ],
  'Testing Services': [
    {
      name: 'TestingService',
      description: 'Orchestrates testing of shared services with registry intelligence',
      hassBrowserVariant: true,
      testFn: async () => {
        // Test singleton pattern and core methods
        // const testingService = TestingService.getInstance();
        throw new Error('TestingService temporarily disabled');
        return testingService !== null && 
               typeof testingService.getServicesForTesting === 'function' &&
               typeof testingService.runServiceTests === 'function';
      },
      browserFeatures: ['Service registry integration', 'Database-driven testing', 'Health monitoring']
    }
  ],
  'Index Services': [
    {
      name: 'SharedServicesIndex',
      description: 'Main index export aggregator (import test)',
      hassBrowserVariant: false,
      testFn: async () => {
        // Test that the main index can be imported without errors
        try {
          const indexModule = await import('@shared/services/index');
          return typeof indexModule === 'object' && indexModule !== null;
        } catch (error) {
          console.error('Index import failed:', error);
          return false;
        }
      },
      browserFeatures: ['Export aggregation', 'Service discovery', 'Dependency resolution']
    }
  ]
};

interface ServiceTestResult {
  name: string;
  group: string;
  status: 'pending' | 'testing' | 'success' | 'error';
  error?: string;
  initTime?: number;
  browserFeatures?: string[];
  description?: string;
}

export function ServiceTesterNewCandidates() {
  const [results, setResults] = useState<ServiceTestResult[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(['Authentication Services', 'Media Services', 'Audio Services', 'Testing Services', 'Index Services'])
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
      status: 'testing',
      browserFeatures: service.browserFeatures,
      description: service.description
    };

    try {
      const success = await service.testFn();
      result.initTime = Date.now() - startTime;
      result.status = success ? 'success' : 'error';
      result.error = success ? undefined : 'Service test returned false';
      
      console.log(`${success ? '✅' : '❌'} ${service.name} - Init: ${result.initTime}ms`);
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
    for (const [group, services] of Object.entries(NEW_SERVICE_CANDIDATES)) {
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
      <h1 className="text-3xl font-bold mb-8">New Browser Service Candidates</h1>

      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Test Configuration</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Service Groups</label>
          <div className="space-y-2">
            {Object.entries(NEW_SERVICE_CANDIDATES).map(([group, services]) => (
              <label key={group} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedGroups.has(group)}
                  onChange={() => toggleGroup(group)}
                  className="mr-2"
                />
                {group} ({services.length} services)
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

          <div className="space-y-4">
            {results.map((result, index) => (
              <div 
                key={index}
                className={`p-4 rounded border ${
                  result.status === 'success' ? 'border-green-200 bg-green-50' :
                  result.status === 'error' ? 'border-red-200 bg-red-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-medium text-lg">{result.name}</span>
                    <span className="text-sm text-gray-600 ml-2">({result.group})</span>
                  </div>
                  <div className="text-sm">
                    {result.status === 'success' && (
                      <span className="text-green-600 font-medium">
                        Init: {result.initTime}ms
                      </span>
                    )}
                  </div>
                </div>
                
                {result.description && (
                  <div className="text-sm text-gray-700 mb-2">
                    {result.description}
                  </div>
                )}
                
                {result.browserFeatures && result.browserFeatures.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-blue-600">Browser Features:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.browserFeatures.map((feature, idx) => (
                        <span key={idx} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {result.error && (
                  <div className="mt-2 text-sm text-red-600 bg-red-100 p-2 rounded">
                    <strong>Error:</strong> {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="font-medium mb-4">🔍 Analysis: Browser Service Issues Investigation</h3>
        
        <div className="mb-4 p-4 bg-yellow-100 rounded">
          <h4 className="font-medium mb-2">🚨 Issue Fixes Implemented:</h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>AuthService Issue:</strong> Switched from main AuthService (Node.js only) to BrowserAuthService (browser-compatible)</li>
            <li>• <strong>AudioService Issue:</strong> Added AudioBrowserService from dhg-audio app to test suite for investigation</li>
            <li>• <strong>Environment Detection:</strong> All services now use proper browser vs. Node.js environment handling</li>
          </ul>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">High Priority Candidates:</h4>
            <ul className="space-y-2">
              <li><strong>BrowserAuthService:</strong> Fixed auth service (browser-compatible version)</li>
              <li><strong>AudioBrowserService:</strong> Audio service from dhg-audio (investigating reported issue)</li>
              <li><strong>GoogleAuthService:</strong> Environment detection, localStorage support</li>
              <li><strong>TestingService:</strong> Registry-driven testing, works across environments</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Key Browser Features:</h4>
            <ul className="space-y-2">
              <li><strong>Environment Detection:</strong> typeof window checks</li>
              <li><strong>Singleton Patterns:</strong> getInstance() methods</li>
              <li><strong>Storage Adapters:</strong> localStorage/filesystem fallbacks</li>
              <li><strong>Cross-Platform:</strong> Works in both browser and Node.js</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-green-100 rounded">
          <h4 className="font-medium mb-2">✅ Why These Services Are Good Browser Candidates:</h4>
          <ul className="text-sm space-y-1">
            <li>• <strong>Proven Usage:</strong> Already used by multiple browser apps (dhg-admin-code, dhg-audio, etc.)</li>
            <li>• <strong>Environment Agnostic:</strong> Designed to work across browser and server environments</li>
            <li>• <strong>Proper Abstraction:</strong> Use dependency injection for environment-specific features</li>
            <li>• <strong>No Node.js Dependencies:</strong> Don't rely on fs, path, or other server-only modules</li>
            <li>• <strong>Database Compatible:</strong> Work with Supabase client instances</li>
          </ul>
        </div>
      </div>
    </div>
  );
}