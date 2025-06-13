import React, { useState, useEffect } from 'react';
import { getServerRegistry } from '@shared/services/server-registry-service';
import { BrowserAuthService } from '@shared/services/auth-service/browser';
import { ClipboardService } from '@shared/services/clipboard-service';
import { CLIRegistryService } from '@shared/services/cli-registry-service';
import { ElementCatalogService } from '@shared/services/element-catalog-service';
import { ElementCriteriaService } from '@shared/services/element-criteria-service';
import { supabase } from '../lib/supabase';

interface ServiceStatus {
  name: string;
  status: 'not-initialized' | 'initializing' | 'initialized' | 'error';
  error?: string;
  initTime?: number;
}

export function ServiceMonitor() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'BrowserAuthService', status: 'not-initialized' },
    { name: 'ServerRegistryService', status: 'not-initialized' },
    { name: 'ClipboardService', status: 'not-initialized' },
    { name: 'CLIRegistryService', status: 'not-initialized' },
    { name: 'ElementCatalogService', status: 'not-initialized' },
    { name: 'ElementCriteriaService', status: 'not-initialized' },
  ]);

  const [testPhase, setTestPhase] = useState<'waiting' | 'testing' | 'complete'>('waiting');

  const updateServiceStatus = (name: string, status: Partial<ServiceStatus>) => {
    setServices(prev => prev.map(s => 
      s.name === name ? { ...s, ...status } : s
    ));
  };

  const testService = async (name: string, testFn: () => Promise<any>) => {
    const startTime = Date.now();
    updateServiceStatus(name, { status: 'initializing' });
    
    try {
      await testFn();
      const initTime = Date.now() - startTime;
      updateServiceStatus(name, { status: 'initialized', initTime });
      console.log(`✅ ${name} initialized in ${initTime}ms`);
    } catch (error) {
      updateServiceStatus(name, { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      console.error(`❌ ${name} failed:`, error);
    }
  };

  const runTests = async () => {
    setTestPhase('testing');
    
    // Test services one by one to identify which causes issues
    
    // 1. BrowserAuthService (already initialized in auth-init.ts)
    await testService('BrowserAuthService', async () => {
      const service = BrowserAuthService.getInstance();
      return service;
    });

    // 2. ServerRegistryService (lazy initialization)
    await testService('ServerRegistryService', async () => {
      const registry = getServerRegistry();
      return registry;
    });

    // 3. ClipboardService (requires supabase client in browser)
    await testService('ClipboardService', async () => {
      const service = ClipboardService.getInstance(supabase);
      return service;
    });

    // 4. CLIRegistryService (not a singleton - needs constructor)
    await testService('CLIRegistryService', async () => {
      const service = new CLIRegistryService(supabase);
      return service;
    });

    // 5. ElementCatalogService (requires supabase client in browser)
    await testService('ElementCatalogService', async () => {
      const service = ElementCatalogService.getInstance(supabase);
      return service;
    });

    // 6. ElementCriteriaService (requires supabase client in browser)
    await testService('ElementCriteriaService', async () => {
      const service = ElementCriteriaService.getInstance(supabase);
      return service;
    });

    setTestPhase('complete');
  };

  useEffect(() => {
    // Check auth service status immediately (it's initialized on import)
    try {
      BrowserAuthService.getInstance();
      updateServiceStatus('BrowserAuthService', { status: 'initialized' });
    } catch (error) {
      updateServiceStatus('BrowserAuthService', { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'initialized': return 'text-green-600';
      case 'initializing': return 'text-blue-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'initialized': return '✅';
      case 'initializing': return '🔄';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">DHG Service Test</h1>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          This app tests the initialization of shared services used by dhg-admin-code.
          Check the browser console for detailed initialization logs.
        </p>
        
        {testPhase === 'waiting' && (
          <button 
            onClick={runTests}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Start Service Tests
          </button>
        )}
        
        {testPhase === 'testing' && (
          <div className="text-blue-600">
            <span className="animate-spin inline-block mr-2">🔄</span>
            Testing services...
          </div>
        )}
        
        {testPhase === 'complete' && (
          <div className="text-green-600">
            ✅ All tests complete
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold mb-4">Service Status</h2>
        
        {services.map(service => (
          <div 
            key={service.name} 
            className="border rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getStatusIcon(service.status)}</span>
                <div>
                  <h3 className="font-medium">{service.name}</h3>
                  <p className={`text-sm ${getStatusColor(service.status)}`}>
                    {service.status}
                    {service.initTime && ` (${service.initTime}ms)`}
                  </p>
                  {service.error && (
                    <p className="text-sm text-red-600 mt-1">
                      Error: {service.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-medium mb-2">Console Output</h3>
        <p className="text-sm text-gray-600">
          Open the browser console (F12) to see detailed initialization logs from:
        </p>
        <ul className="list-disc list-inside text-sm text-gray-600 mt-2">
          <li>[SupabaseAdapter] - Supabase client creation</li>
          <li>[BrowserAuthService] - Auth service initialization</li>
          <li>[ServerRegistryService] - Server registry initialization</li>
        </ul>
      </div>
    </div>
  );
}