import React from 'react';

interface ServiceInfo {
  name: string;
  path: string;
  status: 'working' | 'needs-fix' | 'untested';
  issue?: string;
  notes?: string;
}

const services: ServiceInfo[] = [
  {
    name: 'Supabase Adapter',
    path: '@shared/adapters/supabase-adapter',
    status: 'working',
    notes: 'Browser-safe adapter with environment detection'
  },
  {
    name: 'Logger',
    path: '@shared/utils/logger',
    status: 'working',
    notes: 'Console-based logger, no Node.js dependencies'
  },
  {
    name: 'Claude Service',
    path: '@shared/services/claude-service',
    status: 'needs-fix',
    issue: 'Uses Node.js dotenv, needs browser-safe env handling'
  },
  {
    name: 'Document Classification Service',
    path: '@shared/services/document-classification-service',
    status: 'untested',
    notes: 'Depends on claude-service'
  },
  {
    name: 'Testing Service',
    path: '@shared/services/testing-service',
    status: 'needs-fix',
    issue: 'Import error - file may not exist'
  },
  {
    name: 'Audio Browser Service',
    path: '@shared/services/audio-browser-service',
    status: 'needs-fix',
    issue: 'Import error - file may not exist'
  },
  {
    name: 'Server Registry Service',
    path: '@shared/services/server-registry-service',
    status: 'needs-fix',
    issue: 'Import error - file may not exist'
  },
  {
    name: 'Clipboard Service',
    path: '@shared/services/clipboard-service',
    status: 'needs-fix',
    issue: 'Import error - file may not exist'
  },
  {
    name: 'Process Service',
    path: '@shared/services/process-service',
    status: 'needs-fix',
    issue: 'Import error - file may not exist'
  },
  {
    name: 'File Service',
    path: '@shared/services/file-service',
    status: 'needs-fix',
    issue: 'Uses Node.js fs module, needs browser alternative'
  },
  {
    name: 'Prompt Service',
    path: '@shared/services/prompt-service',
    status: 'untested',
    notes: 'May work if it only uses Supabase'
  }
];

export function ServiceStatus() {
  const working = services.filter(s => s.status === 'working');
  const needsFix = services.filter(s => s.status === 'needs-fix');
  const untested = services.filter(s => s.status === 'untested');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Service Status Dashboard</h2>
      
      <div className="grid gap-6">
        {/* Working Services */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-green-700">
            ✅ Working Services ({working.length})
          </h3>
          <div className="space-y-2">
            {working.map(service => (
              <div key={service.name} className="bg-green-50 p-3 rounded border border-green-200">
                <div className="font-medium">{service.name}</div>
                <div className="text-sm text-gray-600">{service.path}</div>
                {service.notes && (
                  <div className="text-sm text-green-700 mt-1">{service.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Services Needing Fixes */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-red-700">
            ❌ Needs Fix ({needsFix.length})
          </h3>
          <div className="space-y-2">
            {needsFix.map(service => (
              <div key={service.name} className="bg-red-50 p-3 rounded border border-red-200">
                <div className="font-medium">{service.name}</div>
                <div className="text-sm text-gray-600">{service.path}</div>
                {service.issue && (
                  <div className="text-sm text-red-700 mt-1">Issue: {service.issue}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Untested Services */}
        <div>
          <h3 className="text-lg font-semibold mb-3 text-yellow-700">
            🔍 Untested ({untested.length})
          </h3>
          <div className="space-y-2">
            {untested.map(service => (
              <div key={service.name} className="bg-yellow-50 p-3 rounded border border-yellow-200">
                <div className="font-medium">{service.name}</div>
                <div className="text-sm text-gray-600">{service.path}</div>
                {service.notes && (
                  <div className="text-sm text-yellow-700 mt-1">{service.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded">
        <h4 className="font-semibold mb-2">Next Steps:</h4>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>Test the untested services to see if they work in browser</li>
          <li>Fix Claude Service by using browser-safe environment handling</li>
          <li>Check if missing services actually exist in the codebase</li>
          <li>Create browser alternatives for Node.js-dependent services</li>
        </ol>
      </div>
    </div>
  );
}