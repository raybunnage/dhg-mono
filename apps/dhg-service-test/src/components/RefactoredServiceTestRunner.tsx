import { useState, useEffect } from 'react';

interface ServiceTestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'no-tests';
  message?: string;
  testsRun?: number;
  testsPassed?: number;
  testsFailed?: number;
  duration?: number;
}

interface TestSummary {
  totalServices: number;
  servicesWithTests: number;
  passed: number;
  failed: number;
  running: number;
  pending: number;
  successRate: number;
}

// List of all refactored services
const REFACTORED_SERVICES = [
  'ai-processing-service-refactored',
  'audio-proxy-refactored',
  'audio-service-refactored',
  'audio-transcription-refactored',
  'auth-service-refactored',
  'batch-processing-service-refactored',
  'claude-service-refactored',
  'cli-registry-service-refactored',
  'converter-service-refactored',
  'database-service-refactored',
  'filter-service-refactored',
  'folder-hierarchy-service-refactored',
  'formatter-service-refactored',
  'google-auth-refactored',
  'google-drive-explorer-refactored',
  'google-drive-refactored',
  'google-drive-sync-service-refactored',
  'logger-refactored',
  'media-tracking-service-refactored',
  'prompt-service-refactored',
  'proxy-server-base-service-refactored',
  'sources-google-update-service-refactored',
  'supabase-adapter-refactored',
  'supabase-client-refactored',
  'supabase-service-refactored',
  'task-service-refactored',
  'unified-classification-service-refactored',
  'user-profile-service-refactored',
  // Additional services
  'batch-database-service-refactored',
  'deployment-service-refactored',
  'document-service-refactored',
  'element-catalog-service-refactored',
  'element-criteria-service-refactored',
  'env-config-service-refactored',
  'file-service-refactored',
  'file-system-service-refactored',
  'html-file-browser-refactored',
  'markdown-viewer-refactored',
  'media-analytics-service-refactored',
  'pdf-processor-service-refactored',
  'script-viewer-refactored',
  'worktree-switcher-refactored'
];

export function RefactoredServiceTestRunner() {
  const [testResults, setTestResults] = useState<ServiceTestResult[]>(
    REFACTORED_SERVICES.map(service => ({
      name: service,
      status: 'pending'
    }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentService, setCurrentService] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState<TestSummary>({
    totalServices: REFACTORED_SERVICES.length,
    servicesWithTests: 0,
    passed: 0,
    failed: 0,
    running: 0,
    pending: REFACTORED_SERVICES.length,
    successRate: 0
  });

  // Calculate summary from test results
  const updateSummary = (results: ServiceTestResult[]) => {
    const summary: TestSummary = {
      totalServices: results.length,
      servicesWithTests: results.filter(r => r.status !== 'no-tests').length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      running: results.filter(r => r.status === 'running').length,
      pending: results.filter(r => r.status === 'pending').length,
      successRate: 0
    };
    
    if (summary.servicesWithTests > 0) {
      summary.successRate = Math.round((summary.passed / summary.servicesWithTests) * 100);
    }
    
    setSummary(summary);
  };

  // Run all tests
  const runAllTests = async () => {
    setIsRunning(true);
    setLogs(['Starting test run for all refactored services...']);

    // Note: In a real implementation, this would make an API call to a proxy server
    // that executes the shell script. For now, we'll simulate the test run.
    alert(`To run all refactored service tests, execute this command in your terminal:

./scripts/cli-pipeline/utilities/run-all-refactored-service-tests.sh

Or for a quick test summary:
./scripts/cli-pipeline/utilities/test-summary-refactored-services.sh`);

    // Simulate test execution
    for (let i = 0; i < testResults.length; i++) {
      const service = testResults[i];
      
      // Update status to running
      setTestResults(prev => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: 'running' };
        return updated;
      });
      setCurrentService(service.name);
      
      // Simulate test delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Randomly assign test results for demo
      const hasTests = Math.random() > 0.2;
      const passed = hasTests && Math.random() > 0.3;
      
      setTestResults(prev => {
        const updated = [...prev];
        updated[i] = {
          ...updated[i],
          status: hasTests ? (passed ? 'passed' : 'failed') : 'no-tests',
          testsRun: hasTests ? Math.floor(Math.random() * 20) + 1 : 0,
          testsPassed: hasTests ? (passed ? Math.floor(Math.random() * 15) + 1 : 0) : 0,
          testsFailed: hasTests ? (passed ? 0 : Math.floor(Math.random() * 5) + 1) : 0,
          duration: hasTests ? Math.floor(Math.random() * 5000) + 500 : 0
        };
        return updated;
      });
      
      setLogs(prev => [...prev, `${hasTests ? (passed ? '✅' : '❌') : '⚠️'} ${service.name}`]);
    }
    
    setIsRunning(false);
    setCurrentService(null);
    setLogs(prev => [...prev, 'Test run completed!']);
  };

  // Run tests for a single service
  const runServiceTest = async (serviceName: string) => {
    alert(`To test ${serviceName}, run:

cd packages/shared/services/${serviceName}
npx vitest run --reporter=verbose`);
  };

  // Update summary when results change
  useEffect(() => {
    updateSummary(testResults);
  }, [testResults]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50 animate-pulse';
      case 'no-tests': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-400 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      case 'no-tests': return '⚠️';
      default: return '⏸️';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Refactored Service Test Runner</h2>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-50 rounded p-3">
            <div className="text-sm text-gray-600">Total Services</div>
            <div className="text-2xl font-bold">{summary.totalServices}</div>
          </div>
          <div className="bg-blue-50 rounded p-3">
            <div className="text-sm text-blue-600">With Tests</div>
            <div className="text-2xl font-bold text-blue-800">{summary.servicesWithTests}</div>
          </div>
          <div className="bg-green-50 rounded p-3">
            <div className="text-sm text-green-600">Passed</div>
            <div className="text-2xl font-bold text-green-800">{summary.passed}</div>
          </div>
          <div className="bg-red-50 rounded p-3">
            <div className="text-sm text-red-600">Failed</div>
            <div className="text-2xl font-bold text-red-800">{summary.failed}</div>
          </div>
          <div className="bg-yellow-50 rounded p-3">
            <div className="text-sm text-yellow-600">No Tests</div>
            <div className="text-2xl font-bold text-yellow-800">{summary.totalServices - summary.servicesWithTests}</div>
          </div>
          <div className="bg-purple-50 rounded p-3">
            <div className="text-sm text-purple-600">Success Rate</div>
            <div className="text-2xl font-bold text-purple-800">{summary.successRate}%</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(summary.passed / summary.totalServices) * 100}%` }}
              />
              <div 
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(summary.failed / summary.totalServices) * 100}%` }}
              />
              <div 
                className="bg-yellow-500 transition-all duration-300"
                style={{ width: `${((summary.totalServices - summary.servicesWithTests) / summary.totalServices) * 100}%` }}
              />
              <div 
                className="bg-blue-500 transition-all duration-300 animate-pulse"
                style={{ width: `${(summary.running / summary.totalServices) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isRunning
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? '🔄 Running Tests...' : '🚀 Run All Tests'}
          </button>
          
          {currentService && (
            <div className="flex items-center text-sm text-gray-600">
              Currently testing: <span className="ml-2 font-mono">{currentService}</span>
            </div>
          )}
        </div>
      </div>

      {/* Service Grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Service Test Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {testResults.map((result) => (
            <div
              key={result.name}
              className={`p-3 rounded-lg border ${
                result.status === 'running' ? 'border-blue-300' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm truncate pr-2" title={result.name}>
                  {result.name.replace('-refactored', '')}
                </span>
                <span className={`text-lg ${getStatusColor(result.status).split(' ')[0]}`}>
                  {getStatusIcon(result.status)}
                </span>
              </div>
              
              {result.testsRun !== undefined && result.testsRun > 0 && (
                <div className="text-xs text-gray-600">
                  Tests: {result.testsPassed}/{result.testsRun} passed
                  {result.duration && ` (${result.duration}ms)`}
                </div>
              )}
              
              {result.status !== 'pending' && result.status !== 'running' && (
                <button
                  onClick={() => runServiceTest(result.name)}
                  className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                >
                  Run Individual Test →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Test Logs</h3>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-48 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet. Run tests to see output.</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Command Line Usage</h3>
        <div className="space-y-2 font-mono text-sm">
          <p className="text-blue-800">
            <span className="font-bold">Run all tests:</span> ./scripts/cli-pipeline/utilities/run-all-refactored-service-tests.sh
          </p>
          <p className="text-blue-800">
            <span className="font-bold">Quick summary:</span> ./scripts/cli-pipeline/utilities/test-summary-refactored-services.sh
          </p>
          <p className="text-blue-800">
            <span className="font-bold">Test single service:</span> cd packages/shared/services/[service-name] && npx vitest run
          </p>
        </div>
      </div>
    </div>
  );
}