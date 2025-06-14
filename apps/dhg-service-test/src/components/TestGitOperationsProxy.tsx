import React, { useState, useEffect } from 'react';

interface Worktree {
  path: string;
  commit: string;
  branch: string;
  lastCommit?: {
    hash: string;
    message: string;
    relativeTime: string;
    author: string;
  };
  uncommittedChanges?: number;
  ahead?: number;
  behind?: number;
  needsAttention?: boolean;
}

interface TestResult {
  endpoint: string;
  status: 'success' | 'error' | 'pending';
  data?: any;
  error?: string;
  responseTime?: number;
}

export const TestGitOperationsProxy: React.FC = () => {
  const [proxyUrl] = useState('http://localhost:9879');
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selectedWorktree, setSelectedWorktree] = useState<string>('');

  useEffect(() => {
    checkProxyStatus();
  }, []);

  const checkProxyStatus = async () => {
    try {
      const response = await fetch(`${proxyUrl}/health`);
      setProxyStatus(response.ok ? 'online' : 'offline');
    } catch {
      setProxyStatus('offline');
    }
  };

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const testEndpoint = async (
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<void> => {
    const start = Date.now();
    
    try {
      const response = await fetch(`${proxyUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();
      const responseTime = Date.now() - start;

      if (response.ok) {
        addTestResult({
          endpoint: `${options.method || 'GET'} ${endpoint}`,
          status: 'success',
          data,
          responseTime
        });
      } else {
        addTestResult({
          endpoint: `${options.method || 'GET'} ${endpoint}`,
          status: 'error',
          error: data.error || 'Request failed',
          responseTime
        });
      }
    } catch (error) {
      addTestResult({
        endpoint: `${options.method || 'GET'} ${endpoint}`,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - start
      });
    }
  };

  const runAllTests = async () => {
    setTestResults([]);

    // Test 1: Get worktrees
    await testEndpoint('/api/git/worktrees');

    // Test 2: Get branches
    await testEndpoint('/api/git/branches');

    // Test 3: Execute allowed command
    await testEndpoint('/api/git/execute', {
      method: 'POST',
      body: JSON.stringify({ command: 'git status' })
    });

    // Test 4: Execute disallowed command (should fail)
    await testEndpoint('/api/git/execute', {
      method: 'POST',
      body: JSON.stringify({ command: 'rm -rf /' })
    });

    // Test 5: Dry run branch cleanup
    await testEndpoint('/api/git/cleanup-branches', {
      method: 'POST',
      body: JSON.stringify({ 
        branches: ['test-branch-1', 'test-branch-2'],
        dryRun: true 
      })
    });
  };

  const fetchWorktrees = async () => {
    try {
      const response = await fetch(`${proxyUrl}/api/git/worktrees`);
      const data = await response.json();
      if (data.worktrees) {
        setWorktrees(data.worktrees);
      }
    } catch (error) {
      console.error('Failed to fetch worktrees:', error);
    }
  };

  const testWorktreeCommits = async () => {
    if (!selectedWorktree) {
      alert('Please select a worktree first');
      return;
    }

    await testEndpoint('/api/git/worktree-commits', {
      method: 'POST',
      body: JSON.stringify({ 
        worktreePath: selectedWorktree,
        limit: 10
      })
    });
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Git Operations Proxy Test</h2>
        
        <div className={`mb-4 p-3 rounded ${
          proxyStatus === 'online' ? 'bg-green-50 border border-green-200' : 
          proxyStatus === 'offline' ? 'bg-red-50 border border-red-200' : 
          'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">
              {proxyStatus === 'online' ? '🟢' : proxyStatus === 'offline' ? '🔴' : '🟡'}
            </span>
            <p className="text-sm font-medium">
              Proxy Status: {proxyStatus === 'online' ? 'Online' : 
                           proxyStatus === 'offline' ? 'Offline - Start the proxy server' : 
                           'Checking...'}
            </p>
            <span className="text-xs text-gray-500">({proxyUrl})</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={runAllTests}
            disabled={proxyStatus !== 'online'}
            className={`px-4 py-2 rounded font-medium ${
              proxyStatus === 'online'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Run All Tests
          </button>

          <button
            onClick={fetchWorktrees}
            disabled={proxyStatus !== 'online'}
            className={`px-4 py-2 rounded font-medium ${
              proxyStatus === 'online'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Fetch Worktrees
          </button>

          <button
            onClick={checkProxyStatus}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Refresh Status
          </button>
        </div>
      </div>

      {/* Worktree Testing */}
      {worktrees.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Test Worktree Commits</h3>
          <div className="flex gap-2 items-center mb-4">
            <select
              value={selectedWorktree}
              onChange={(e) => setSelectedWorktree(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a worktree...</option>
              {worktrees.map((wt, index) => (
                <option key={index} value={wt.path}>
                  {wt.branch} - {wt.path}
                  {wt.needsAttention && ' ⚠️'}
                </option>
              ))}
            </select>
            <button
              onClick={testWorktreeCommits}
              disabled={!selectedWorktree}
              className={`px-4 py-2 rounded font-medium ${
                selectedWorktree
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Test Commits
            </button>
          </div>
          
          {/* Worktree List */}
          <div className="space-y-2">
            {worktrees.map((wt, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{wt.branch}</p>
                    <p className="text-sm text-gray-600">{wt.path}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {wt.uncommittedChanges ? (
                      <span className="text-orange-600">
                        {wt.uncommittedChanges} uncommitted
                      </span>
                    ) : null}
                    {wt.ahead ? (
                      <span className="text-blue-600">↑ {wt.ahead}</span>
                    ) : null}
                    {wt.behind ? (
                      <span className="text-red-600">↓ {wt.behind}</span>
                    ) : null}
                  </div>
                </div>
                {wt.lastCommit && (
                  <p className="text-xs text-gray-500 mt-1">
                    Last: {wt.lastCommit.message} ({wt.lastCommit.relativeTime})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Test Results</h3>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="border rounded p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${getStatusColor(result.status)}`}>
                      {result.status === 'success' ? '✅' : '❌'} {result.endpoint}
                    </span>
                  </div>
                  {result.responseTime && (
                    <span className="text-sm text-gray-500">
                      {result.responseTime}ms
                    </span>
                  )}
                </div>
                
                {result.error && (
                  <p className="text-sm text-red-600 mb-2">{result.error}</p>
                )}
                
                {result.data && (
                  <div className="mt-2">
                    <details className="cursor-pointer">
                      <summary className="text-sm text-gray-600 hover:text-gray-800">
                        View Response
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Info */}
      <div className="mt-6 p-4 bg-gray-100 rounded text-sm text-gray-600">
        <p><strong>Git Operations Proxy</strong> provides:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Worktree management and information</li>
          <li>Branch listing, cleanup, and deletion</li>
          <li>Commit history for specific worktrees</li>
          <li>Safe git command execution</li>
        </ul>
        <p className="mt-2">
          Start the proxy with: <code className="bg-gray-200 px-1">ts-node test-proxy-servers.ts</code>
        </p>
      </div>
    </div>
  );
};