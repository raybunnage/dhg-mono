import React, { useState, useEffect } from 'react';

interface EnvStatus {
  VITE_SUPABASE_URL: string | undefined;
  VITE_SUPABASE_ANON_KEY: string | undefined;
  VITE_SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  NODE_ENV: string | undefined;
  MODE: string | undefined;
  DEV: boolean;
  PROD: boolean;
  BASE_URL: string;
}

interface DiagnosticResult {
  issue: string;
  status: 'error' | 'warning' | 'success';
  solution: string;
}

export const ViteEnvFixPage: React.FC = () => {
  const [envStatus, setEnvStatus] = useState<EnvStatus | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [showRawEnv, setShowRawEnv] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    checkEnvironment();
  }, []);

  const checkEnvironment = () => {
    const env = import.meta.env;
    const status: EnvStatus = {
      VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: env.VITE_SUPABASE_ANON_KEY,
      VITE_SUPABASE_SERVICE_ROLE_KEY: env.VITE_SUPABASE_SERVICE_ROLE_KEY,
      NODE_ENV: env.NODE_ENV,
      MODE: env.MODE,
      DEV: env.DEV,
      PROD: env.PROD,
      BASE_URL: env.BASE_URL
    };
    
    setEnvStatus(status);
    runDiagnostics(status);
  };

  const runDiagnostics = (status: EnvStatus) => {
    const results: DiagnosticResult[] = [];

    // Check 1: Are the critical variables present?
    if (!status.VITE_SUPABASE_URL) {
      results.push({
        issue: 'VITE_SUPABASE_URL is missing',
        status: 'error',
        solution: 'Ensure .env.development exists with VITE_SUPABASE_URL="your-url"'
      });
    } else {
      results.push({
        issue: 'VITE_SUPABASE_URL is loaded',
        status: 'success',
        solution: 'No action needed'
      });
    }

    if (!status.VITE_SUPABASE_ANON_KEY) {
      results.push({
        issue: 'VITE_SUPABASE_ANON_KEY is missing',
        status: 'error',
        solution: 'Ensure .env.development exists with VITE_SUPABASE_ANON_KEY="your-key"'
      });
    } else {
      results.push({
        issue: 'VITE_SUPABASE_ANON_KEY is loaded',
        status: 'success',
        solution: 'No action needed'
      });
    }

    // Check 2: Is this dev mode?
    if (!status.DEV) {
      results.push({
        issue: 'Not running in development mode',
        status: 'warning',
        solution: 'Make sure you are running "pnpm dev" not "pnpm build"'
      });
    }

    // Check 3: Mode check
    if (status.MODE !== 'development') {
      results.push({
        issue: `Running in ${status.MODE} mode instead of development`,
        status: 'warning',
        solution: 'Vite may not be loading .env.development file'
      });
    }

    setDiagnostics(results);
  };

  const testSupabaseConnection = async () => {
    try {
      setTestResult('Testing Supabase connection...');
      
      // Try to create adapter
      const { createSupabaseAdapter } = await import('@shared/adapters/supabase-adapter');
      const adapter = createSupabaseAdapter({
        env: import.meta.env as any
      });

      // Try a simple query
      const { data, error } = await adapter
        .from('sys_shared_services')
        .select('service_name')
        .limit(1);

      if (error) {
        setTestResult(`❌ Connection failed: ${error.message}`);
      } else {
        setTestResult(`✅ Connection successful! Found ${data?.length || 0} services`);
      }
    } catch (error) {
      setTestResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const [proxyStatus, setProxyStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [fixInProgress, setFixInProgress] = useState(false);
  const PROXY_URL = 'http://localhost:9876';

  useEffect(() => {
    checkProxyServer();
  }, []);

  const checkProxyServer = async () => {
    try {
      const response = await fetch(`${PROXY_URL}/health`);
      if (response.ok) {
        setProxyStatus('online');
      } else {
        setProxyStatus('offline');
      }
    } catch {
      setProxyStatus('offline');
    }
  };

  const executeProxyFix = async (action: 'fix' | 'nuclear-fix') => {
    setFixInProgress(true);
    try {
      const response = await fetch(`${PROXY_URL}/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: 'dhg-service-test', action })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`✅ ${action === 'nuclear-fix' ? 'Nuclear' : 'Quick'} fix applied successfully! Please restart your dev server.`);
        // Refresh diagnostics after fix
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        alert(`❌ Fix failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`❌ Failed to connect to proxy server: ${error}`);
    } finally {
      setFixInProgress(false);
    }
  };

  const copyFixCommand = () => {
    const command = 'cd /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks && ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts dhg-service-test';
    navigator.clipboard.writeText(command);
    alert('Fix command copied to clipboard! Run it in your terminal.');
  };

  const copyNuclearFixCommand = () => {
    const command = 'cd /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks && ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts dhg-service-test --nuclear';
    navigator.clipboard.writeText(command);
    alert('Nuclear fix command copied to clipboard! This will reinstall all dependencies.');
  };

  const startProxyServer = () => {
    const command = 'cd /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks && ts-node scripts/cli-pipeline/utilities/vite-fix-proxy-server.ts';
    navigator.clipboard.writeText(command);
    alert('Proxy server start command copied to clipboard! Run it in a new terminal window.');
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'success': return 'text-green-600';
    }
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
    }
  };

  const hasErrors = diagnostics.some(d => d.status === 'error');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">
          Vite Environment Variable Diagnostic & Fix Center
        </h1>
        
        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="text-sm text-blue-800 mb-2">
            This page helps diagnose and fix the "Unable to find Supabase credentials" error.
          </p>
          <p className="text-sm text-blue-600">
            Current Status: {hasErrors ? '🔴 Environment variables NOT loaded' : '🟢 Environment variables loaded'}
          </p>
        </div>

        <button
          onClick={checkEnvironment}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
        >
          🔄 Refresh Diagnostics
        </button>

        <button
          onClick={testSupabaseConnection}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mr-2"
        >
          🧪 Test Supabase Connection
        </button>

        <button
          onClick={checkProxyServer}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          🔄 Check Proxy Server
        </button>
      </div>

      {/* Proxy Server Status */}
      <div className={`mb-4 p-3 rounded ${
        proxyStatus === 'online' ? 'bg-green-50 border border-green-200' : 
        proxyStatus === 'offline' ? 'bg-red-50 border border-red-200' : 
        'bg-gray-50 border border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {proxyStatus === 'online' ? '🟢' : proxyStatus === 'offline' ? '🔴' : '🟡'}
            </span>
            <p className="text-sm font-medium">
              Proxy Server: {proxyStatus === 'online' ? 'Online - One-click fixes available!' : 
                           proxyStatus === 'offline' ? 'Offline - Start it for browser-based fixes' : 
                           'Checking...'}
            </p>
          </div>
          {proxyStatus === 'offline' && (
            <button
              onClick={startProxyServer}
              className="text-sm px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              📋 Copy Start Command
            </button>
          )}
        </div>
      </div>

      {/* Diagnostic Results */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Diagnostic Results</h2>
        <div className="space-y-3">
          {diagnostics.map((diag, index) => (
            <div key={index} className="border rounded p-3 bg-gray-50">
              <div className="flex items-start gap-2">
                <span className="text-xl">{getStatusIcon(diag.status)}</span>
                <div className="flex-1">
                  <p className={`font-medium ${getStatusColor(diag.status)}`}>
                    {diag.issue}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {diag.solution}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {testResult && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="font-mono text-sm">{testResult}</p>
          </div>
        )}
      </div>

      {/* Fix Instructions */}
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-red-800">
            🛠️ How to Fix This Issue
          </h2>
          
          <div className="space-y-4">
            {proxyStatus === 'online' ? (
              <div>
                <h3 className="font-semibold text-green-700 mb-2">🎉 Browser-Based Fix Available!</h3>
                <p className="text-sm mb-3">The proxy server is running. Click to fix directly from your browser:</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => executeProxyFix('fix')}
                    disabled={fixInProgress}
                    className={`px-4 py-2 rounded font-medium ${
                      fixInProgress 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {fixInProgress ? '⏳ Fixing...' : '🚀 Quick Fix (from browser!)'}
                  </button>
                  <button
                    onClick={() => executeProxyFix('nuclear-fix')}
                    disabled={fixInProgress}
                    className={`px-4 py-2 rounded font-medium ${
                      fixInProgress 
                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {fixInProgress ? '⏳ Fixing...' : '💣 Nuclear Fix (from browser!)'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-semibold text-red-700 mb-2">Option 1: Manual Fix Commands</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Click the button below to copy the fix command</li>
                  <li>Open your terminal</li>
                  <li>Paste and run the command</li>
                  <li>Restart the dev server: <code className="bg-gray-100 px-1">pnpm dev</code></li>
                  <li>Refresh this page to verify the fix worked</li>
                </ol>
                <button
                  onClick={copyFixCommand}
                  className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  📋 Copy Quick Fix Command
                </button>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold text-red-700 mb-2">Option 2: Nuclear Fix (100% success rate)</h3>
              <p className="text-sm mb-2">If the quick fix doesn't work, this will completely reinstall dependencies:</p>
              <button
                onClick={copyNuclearFixCommand}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                💣 Copy Nuclear Fix Command
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Steps */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Manual Troubleshooting Steps</h2>
        <ol className="list-decimal list-inside space-y-3 text-sm">
          <li>
            <strong>Check .env.development exists:</strong>
            <code className="block mt-1 bg-gray-100 p-2 rounded">
              ls -la /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks/.env.development
            </code>
          </li>
          <li>
            <strong>Verify it contains the required variables:</strong>
            <code className="block mt-1 bg-gray-100 p-2 rounded">
              grep "VITE_SUPABASE" /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks/.env.development
            </code>
          </li>
          <li>
            <strong>Clear Vite cache manually:</strong>
            <code className="block mt-1 bg-gray-100 p-2 rounded">
              rm -rf apps/dhg-service-test/node_modules/.vite
            </code>
          </li>
          <li>
            <strong>Kill all Vite processes:</strong>
            <code className="block mt-1 bg-gray-100 p-2 rounded">
              pkill -f vite
            </code>
          </li>
          <li>
            <strong>Restart the dev server from the app directory:</strong>
            <code className="block mt-1 bg-gray-100 p-2 rounded">
              cd apps/dhg-service-test && pnpm dev
            </code>
          </li>
        </ol>
      </div>

      {/* Environment Details */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Environment Details</h2>
          <button
            onClick={() => setShowRawEnv(!showRawEnv)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showRawEnv ? 'Hide' : 'Show'} Raw Environment
          </button>
        </div>
        
        {envStatus && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Mode:</strong> {envStatus.MODE}
              </div>
              <div>
                <strong>Dev:</strong> {envStatus.DEV ? 'Yes' : 'No'}
              </div>
              <div>
                <strong>Base URL:</strong> {envStatus.BASE_URL}
              </div>
              <div>
                <strong>Node Env:</strong> {envStatus.NODE_ENV || 'Not set'}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className={`p-2 rounded ${envStatus.VITE_SUPABASE_URL ? 'bg-green-50' : 'bg-red-50'}`}>
                <strong>VITE_SUPABASE_URL:</strong> {
                  envStatus.VITE_SUPABASE_URL 
                    ? `✅ Loaded (${envStatus.VITE_SUPABASE_URL.substring(0, 30)}...)`
                    : '❌ Not loaded'
                }
              </div>
              <div className={`p-2 rounded ${envStatus.VITE_SUPABASE_ANON_KEY ? 'bg-green-50' : 'bg-red-50'}`}>
                <strong>VITE_SUPABASE_ANON_KEY:</strong> {
                  envStatus.VITE_SUPABASE_ANON_KEY 
                    ? `✅ Loaded (${envStatus.VITE_SUPABASE_ANON_KEY.substring(0, 20)}...)`
                    : '❌ Not loaded'
                }
              </div>
            </div>

            {showRawEnv && (
              <pre className="mt-4 p-4 bg-gray-100 rounded overflow-x-auto text-xs">
                {JSON.stringify(import.meta.env, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};