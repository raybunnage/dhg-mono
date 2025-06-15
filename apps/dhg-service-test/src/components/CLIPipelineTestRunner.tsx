import { useState, useEffect } from 'react';

interface TestResult {
  pipeline: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  message?: string;
  duration?: number;
}

interface GroupTestResults {
  group: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  running: number;
  pending: number;
  pipelines: TestResult[];
  lastRun?: Date;
}

const ALPHA_PIPELINES = [
  'testing', 'utilities', 'system', 'registry', 'tracking', 'maintenance',
  'continuous', 'proxy', 'servers', 'monitoring', 'shared-services',
  'service_dependencies', 'refactor_tracking', 'deprecation', 'all_pipelines',
  'database', 'deployment'
];

const BETA_PIPELINES = [
  'ai', 'analysis', 'archive', 'auth', 'classify', 'continuous_docs',
  'dev_tasks', 'docs', 'document', 'document_archiving', 'document_types',
  'drive_filter', 'element_criteria', 'email', 'experts', 'git',
  'git_workflow', 'gmail', 'google_sync', 'living_docs'
];

const GAMMA_PIPELINES = [
  'media-analytics', 'media-processing', 'mime_types', 'presentations',
  'prompt_service', 'scripts', 'work_summaries'
];

export function CLIPipelineTestRunner() {
  const [selectedGroup, setSelectedGroup] = useState<'ALPHA' | 'BETA' | 'GAMMA'>('ALPHA');
  const [testResults, setTestResults] = useState<Record<string, GroupTestResults>>({
    ALPHA: {
      group: 'ALPHA',
      total: ALPHA_PIPELINES.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      running: 0,
      pending: ALPHA_PIPELINES.length,
      pipelines: ALPHA_PIPELINES.map(p => ({ pipeline: p, status: 'pending' }))
    },
    BETA: {
      group: 'BETA',
      total: BETA_PIPELINES.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      running: 0,
      pending: BETA_PIPELINES.length,
      pipelines: BETA_PIPELINES.map(p => ({ pipeline: p, status: 'pending' }))
    },
    GAMMA: {
      group: 'GAMMA',
      total: GAMMA_PIPELINES.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      running: 0,
      pending: GAMMA_PIPELINES.length,
      pipelines: GAMMA_PIPELINES.map(p => ({ pipeline: p, status: 'pending' }))
    }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const runTests = async (group: 'ALPHA' | 'BETA' | 'GAMMA') => {
    setIsRunning(true);
    setLogs([`Starting ${group} pipeline tests...`]);

    try {
      const response = await fetch(`http://localhost:9890/cli-tests/run-${group.toLowerCase()}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to start tests: ${response.statusText}`);
      }

      // Start polling for results
      pollTestResults(group);
    } catch (error) {
      console.error('Error running tests:', error);
      setLogs(prev => [...prev, `Error: ${error}`]);
      setIsRunning(false);
    }
  };

  const pollTestResults = async (group: 'ALPHA' | 'BETA' | 'GAMMA') => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:9890/cli-tests/status-${group.toLowerCase()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch test status');
        }

        const data = await response.json();
        
        // Update test results
        setTestResults(prev => ({
          ...prev,
          [group]: {
            ...prev[group],
            ...data.summary,
            pipelines: data.pipelines || prev[group].pipelines,
            lastRun: new Date()
          }
        }));

        // Add new logs
        if (data.logs && data.logs.length > 0) {
          setLogs(prev => [...prev, ...data.logs]);
        }

        // Check if tests are complete
        if (data.complete) {
          clearInterval(pollInterval);
          setIsRunning(false);
          setLogs(prev => [...prev, `${group} tests completed!`]);
        }
      } catch (error) {
        console.error('Error polling results:', error);
        clearInterval(pollInterval);
        setIsRunning(false);
      }
    }, 1000); // Poll every second
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '⏭️';
      case 'running': return '🔄';
      case 'pending': return '⏸️';
      default: return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'skipped': return 'text-yellow-600';
      case 'running': return 'text-blue-600 animate-pulse';
      case 'pending': return 'text-gray-400';
      default: return 'text-gray-500';
    }
  };

  const results = testResults[selectedGroup];
  const successRate = results.total > 0 
    ? Math.round((results.passed / results.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Group Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">CLI Pipeline Test Runner</h2>
        
        <div className="flex gap-4 mb-6">
          {(['ALPHA', 'BETA', 'GAMMA'] as const).map(group => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                selectedGroup === group
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {group} Group
              <div className="text-xs mt-1">
                {testResults[group].total} pipelines
              </div>
            </button>
          ))}
        </div>

        {/* Test Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded p-4">
            <div className="text-sm text-gray-600">Total</div>
            <div className="text-2xl font-bold">{results.total}</div>
          </div>
          <div className="bg-green-50 rounded p-4">
            <div className="text-sm text-green-600">Passed</div>
            <div className="text-2xl font-bold text-green-600">{results.passed}</div>
          </div>
          <div className="bg-red-50 rounded p-4">
            <div className="text-sm text-red-600">Failed</div>
            <div className="text-2xl font-bold text-red-600">{results.failed}</div>
          </div>
          <div className="bg-blue-50 rounded p-4">
            <div className="text-sm text-blue-600">Success Rate</div>
            <div className="text-2xl font-bold text-blue-600">{successRate}%</div>
          </div>
        </div>

        {/* Run Button */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => runTests(selectedGroup)}
            disabled={isRunning}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isRunning
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isRunning ? '🔄 Running Tests...' : `🚀 Run ${selectedGroup} Tests`}
          </button>
          
          {results.lastRun && (
            <div className="text-sm text-gray-600">
              Last run: {results.lastRun.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-green-500 transition-all duration-300"
                style={{ width: `${(results.passed / results.total) * 100}%` }}
              />
              <div 
                className="bg-red-500 transition-all duration-300"
                style={{ width: `${(results.failed / results.total) * 100}%` }}
              />
              <div 
                className="bg-yellow-500 transition-all duration-300"
                style={{ width: `${(results.skipped / results.total) * 100}%` }}
              />
              <div 
                className="bg-blue-500 transition-all duration-300 animate-pulse"
                style={{ width: `${(results.running / results.total) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pipeline Results Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {results.pipelines.map(pipeline => (
            <div
              key={pipeline.pipeline}
              className={`p-3 rounded-lg border ${
                pipeline.status === 'running' ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{pipeline.pipeline}</span>
                <span className={`text-lg ${getStatusColor(pipeline.status)}`}>
                  {getStatusIcon(pipeline.status)}
                </span>
              </div>
              {pipeline.message && (
                <div className="text-xs text-gray-600 mt-1">{pipeline.message}</div>
              )}
              {pipeline.duration && (
                <div className="text-xs text-gray-500 mt-1">{pipeline.duration}ms</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Test Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Test Logs</h3>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet. Run tests to see output.</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">
                <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}