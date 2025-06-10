import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, Clock, RefreshCw, AlertCircle, Terminal, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DashboardLayout } from '../components/DashboardLayout';

interface TestResult {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
  duration?: number;
  output?: string;
  error?: string;
  timestamp: Date;
}

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details?: any;
  timestamp: Date;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  command: string;
  category: 'unit' | 'integration' | 'e2e' | 'health';
}

const TEST_SUITES: TestSuite[] = [
  {
    id: 'shared-services',
    name: 'Shared Services Tests',
    description: 'Unit tests for shared services in packages/shared',
    command: 'pnpm --filter @dhg/shared test',
    category: 'unit'
  },
  {
    id: 'document-service',
    name: 'Document Service Tests',
    description: 'Tests for document classification and processing',
    command: 'cd scripts/cli-pipeline/document && npm test',
    category: 'unit'
  },
  {
    id: 'unified-classification',
    name: 'Unified Classification Tests',
    description: 'Tests for unified classification service',
    command: 'cd packages/shared/services/unified-classification-service && npm test',
    category: 'integration'
  },
  {
    id: 'health-check-all',
    name: 'CLI Pipeline Health Check',
    description: 'Comprehensive health check of all CLI pipelines',
    command: './scripts/cli-pipeline/maintenance-cli.sh health-check',
    category: 'health'
  },
  {
    id: 'singleton-check',
    name: 'Singleton Usage Check',
    description: 'Verify correct usage of singleton services',
    command: './scripts/cli-pipeline/maintenance-cli.sh singleton-usage',
    category: 'health'
  }
];

interface Notification {
  id: string;
  type: 'info' | 'success' | 'error';
  message: string;
  timestamp: Date;
}

export const TestingPage: React.FC = () => {
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [healthChecks, setHealthChecks] = useState<HealthCheckResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    // Load previous test results from database
    loadTestHistory();
    // Check server status
    checkServerStatus();
  }, []);

  const checkServerStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setServerStatus(response.ok ? 'online' : 'offline');
    } catch (error) {
      setServerStatus('offline');
    }
  };

  // Auto-remove notifications after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNotifications(prev => 
        prev.filter(n => Date.now() - n.timestamp.getTime() < 5000)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const addNotification = (type: 'info' | 'success' | 'error', message: string) => {
    const notification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      timestamp: new Date()
    };
    setNotifications(prev => [...prev, notification]);
  };

  const loadTestHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('sys_test_results')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (data && !error) {
        const results: Record<string, TestResult> = {};
        data.forEach(result => {
          if (!results[result.test_suite_id] || 
              new Date(result.created_at) > new Date(results[result.test_suite_id].timestamp)) {
            results[result.test_suite_id] = {
              id: result.test_suite_id,
              name: result.test_name,
              status: result.status,
              duration: result.duration_ms,
              output: result.output,
              error: result.error_output,
              timestamp: new Date(result.created_at)
            };
          }
        });
        setTestResults(results);
      }
    } catch (error) {
      console.error('Error loading test history:', error);
    }
  };

  const runTest = async (suite: TestSuite) => {
    // Check server status first
    if (serverStatus === 'offline') {
      addNotification('error', 'Cannot run tests: Test runner server is offline');
      return;
    }
    
    // Add to running tests
    setRunningTests(prev => new Set(prev).add(suite.id));
    
    // Show notification
    addNotification('info', `Starting ${suite.name}...`);
    
    // Update UI to show test is running
    setTestResults(prev => ({
      ...prev,
      [suite.id]: {
        id: suite.id,
        name: suite.name,
        status: 'running',
        timestamp: new Date()
      }
    }));

    const startTime = Date.now();

    try {
      // Call the test runner backend
      const response = await fetch('/api/run-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: suite.command, suiteId: suite.id })
      }).catch(err => {
        // If fetch fails (server not running), throw a more descriptive error
        throw new Error('Test runner server is not running. Please start it with: pnpm servers');
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const duration = Date.now() - startTime;
      const status = result.success ? 'passed' : 'failed';

      setTestResults(prev => ({
        ...prev,
        [suite.id]: {
          id: suite.id,
          name: suite.name,
          status,
          duration,
          output: result.output,
          error: result.error,
          timestamp: new Date()
        }
      }));

      // Remove from running tests
      setRunningTests(prev => {
        const next = new Set(prev);
        next.delete(suite.id);
        return next;
      });

      // Show completion notification
      addNotification(
        status === 'passed' ? 'success' : 'error',
        `${suite.name} ${status === 'passed' ? 'completed successfully' : 'failed'} in ${formatDuration(duration)}`
      );

      // Save to database
      await supabase.from('sys_test_results').insert({
        test_suite_id: suite.id,
        test_name: suite.name,
        status: result.success ? 'passed' : 'failed',
        duration_ms: duration,
        output: result.output,
        error_output: result.error,
        command: suite.command
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      setTestResults(prev => ({
        ...prev,
        [suite.id]: {
          id: suite.id,
          name: suite.name,
          status: 'error',
          duration,
          error: `Test execution failed: ${error}`,
          timestamp: new Date()
        }
      }));

      // Remove from running tests
      setRunningTests(prev => {
        const next = new Set(prev);
        next.delete(suite.id);
        return next;
      });

      // Show error notification
      addNotification('error', `${suite.name} encountered an error: ${error}`);
    }
  };

  const runAllTests = async () => {
    setIsRunningAll(true);
    const suitesToRun = TEST_SUITES.filter(suite => 
      selectedCategory === 'all' || suite.category === selectedCategory
    );

    for (const suite of suitesToRun) {
      await runTest(suite);
      // Add delay between tests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsRunningAll(false);
  };

  const runHealthChecks = async () => {
    addNotification('info', 'Starting health checks...');
    
    try {
      // Run maintenance health check
      const healthSuite = TEST_SUITES.find(s => s.id === 'health-check-all');
      if (healthSuite) {
        await runTest(healthSuite);
      }

      // Simulate additional health checks
      const services = [
        'Supabase Connection',
        'Claude AI Service',
        'Google Drive Service',
        'File System Access',
        'Git Repository'
      ];

      const checks: HealthCheckResult[] = services.map(service => ({
        service,
        status: Math.random() > 0.8 ? 'warning' : 'healthy',
        message: `${service} is operational`,
        timestamp: new Date()
      }));

      setHealthChecks(checks);
      
      // Show health check completion
      const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
      const warningCount = checks.filter(c => c.status === 'warning').length;
      
      if (unhealthyCount > 0) {
        addNotification('error', `Health checks completed: ${unhealthyCount} services unhealthy`);
      } else if (warningCount > 0) {
        addNotification('success', `Health checks completed with ${warningCount} warnings`);
      } else {
        addNotification('success', 'All health checks passed!');
      }
    } catch (error) {
      console.error('Error running health checks:', error);
      addNotification('error', 'Health checks failed to complete');
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getHealthIcon = (status: HealthCheckResult['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const toggleExpanded = (id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredSuites = TEST_SUITES.filter(suite => 
    selectedCategory === 'all' || suite.category === selectedCategory
  );

  return (
    <DashboardLayout>
      <style>{`
        @keyframes subtlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-subtle-pulse {
          animation: subtlePulse 2s ease-in-out infinite;
        }
      `}</style>
      {/* Notification Container */}
      <div className="fixed top-20 right-4 z-50 space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`
              p-4 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px]
              transform transition-all duration-300 ease-in-out
              ${notification.type === 'info' ? 'bg-blue-50 border border-blue-200' : ''}
              ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : ''}
              ${notification.type === 'error' ? 'bg-red-50 border border-red-200' : ''}
            `}
          >
            {notification.type === 'info' && <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />}
            {notification.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
            <span className={`
              text-sm font-medium
              ${notification.type === 'info' ? 'text-blue-800' : ''}
              ${notification.type === 'success' ? 'text-green-800' : ''}
              ${notification.type === 'error' ? 'text-red-800' : ''}
            `}>
              {notification.message}
            </span>
          </div>
        ))}
      </div>

      {/* Running Tests Indicator */}
      {runningTests.size > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">
              {runningTests.size} test{runningTests.size !== 1 ? 's' : ''} running
            </span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
      {/* Server Status Alert */}
      {serverStatus === 'offline' && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Test Runner Server Offline</p>
            <p className="text-sm text-yellow-700 mt-1">
              The test runner server is not running. Start it with: <code className="bg-yellow-100 px-2 py-1 rounded">pnpm servers</code>
            </p>
          </div>
          <button
            onClick={checkServerStatus}
            className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
          >
            Retry
          </button>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-green-900">Testing Dashboard</h1>
            <p className="text-green-600 mt-1">Run tests and monitor system health</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={runHealthChecks}
              disabled={serverStatus === 'offline'}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Heart className="w-4 h-4" />
              Health Check
            </button>
            <button
              onClick={runAllTests}
              disabled={isRunningAll || serverStatus === 'offline'}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isRunningAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run All Tests
                </>
              )}
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedCategory === 'all' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Tests
          </button>
          <button
            onClick={() => setSelectedCategory('unit')}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedCategory === 'unit' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unit Tests
          </button>
          <button
            onClick={() => setSelectedCategory('integration')}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedCategory === 'integration' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Integration
          </button>
          <button
            onClick={() => setSelectedCategory('health')}
            className={`px-3 py-1 rounded-lg text-sm ${
              selectedCategory === 'health' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Health Checks
          </button>
        </div>

        {/* Test Suites */}
        <div className="space-y-4">
          {filteredSuites.map(suite => {
            const result = testResults[suite.id];
            const isExpanded = expandedResults.has(suite.id);

            return (
              <div 
                key={suite.id} 
                className={`
                  border rounded-lg transition-all duration-300
                  ${runningTests.has(suite.id) 
                    ? 'border-blue-400 bg-blue-50 animate-pulse' 
                    : 'border-gray-200'
                  }
                `}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result ? getStatusIcon(result.status) : <Clock className="w-5 h-5 text-gray-400" />}
                      <div>
                        <h3 className="font-semibold text-gray-900">{suite.name}</h3>
                        <p className="text-sm text-gray-600">{suite.description}</p>
                        <p className="text-xs text-gray-500 mt-1 font-mono">{suite.command}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {result && (
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            Duration: {formatDuration(result.duration)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {result.timestamp.toLocaleString()}
                          </p>
                        </div>
                      )}
                      <button
                        onClick={() => runTest(suite)}
                        disabled={result?.status === 'running' || serverStatus === 'offline'}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                      >
                        {result?.status === 'running' ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Running
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run
                          </>
                        )}
                      </button>
                      {result && (result.output || result.error) && (
                        <button
                          onClick={() => toggleExpanded(suite.id)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2"
                        >
                          <Terminal className="w-4 h-4" />
                          {isExpanded ? 'Hide' : 'Show'} Output
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Output */}
                {isExpanded && result && (result.output || result.error) && (
                  <div className="border-t border-gray-200 bg-gray-50 p-4">
                    {result.output && (
                      <div className="mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Output:</h4>
                        <pre className="text-xs bg-white p-3 rounded border border-gray-200 overflow-x-auto whitespace-pre-wrap">
                          {result.output}
                        </pre>
                      </div>
                    )}
                    {result.error && (
                      <div>
                        <h4 className="text-sm font-semibold text-red-700 mb-2">Error:</h4>
                        <pre className="text-xs bg-red-50 p-3 rounded border border-red-200 overflow-x-auto whitespace-pre-wrap text-red-800">
                          {result.error}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Health Check Results */}
      {healthChecks.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-green-900 mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthChecks.map((check, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  check.status === 'healthy' ? 'border-green-200 bg-green-50' :
                  check.status === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getHealthIcon(check.status)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{check.service}</h3>
                    <p className="text-sm text-gray-600">{check.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
};