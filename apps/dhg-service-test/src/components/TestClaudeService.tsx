import React, { useState } from 'react';
import { claudeService } from '@shared/services/claude-service/claude-service';

interface TestResult {
  testName: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
  response?: any;
  executionTime?: number;
}

export const TestClaudeService: React.FC = () => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const addTestResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    // Test 1: Basic prompt
    const test1Start = Date.now();
    try {
      addTestResult({
        testName: 'Basic Prompt Test',
        status: 'pending',
        message: 'Sending basic prompt...'
      });

      const response = await claudeService.sendPrompt('What is 2+2?');
      
      addTestResult({
        testName: 'Basic Prompt Test',
        status: 'success',
        message: 'Successfully received response',
        response: response.substring(0, 100) + '...',
        executionTime: Date.now() - test1Start
      });
    } catch (error) {
      addTestResult({
        testName: 'Basic Prompt Test',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - test1Start
      });
    }

    // Test 2: JSON response
    const test2Start = Date.now();
    try {
      addTestResult({
        testName: 'JSON Response Test',
        status: 'pending',
        message: 'Requesting JSON response...'
      });

      const jsonResponse = await claudeService.getJsonResponse(
        'Return a JSON object with two fields: "greeting" with value "Hello" and "number" with value 42'
      );
      
      addTestResult({
        testName: 'JSON Response Test',
        status: 'success',
        message: 'Successfully parsed JSON response',
        response: jsonResponse,
        executionTime: Date.now() - test2Start
      });
    } catch (error) {
      addTestResult({
        testName: 'JSON Response Test',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - test2Start
      });
    }

    // Test 3: Service configuration
    const test3Start = Date.now();
    try {
      addTestResult({
        testName: 'Service Configuration Test',
        status: 'pending',
        message: 'Checking service configuration...'
      });

      // Check if service is properly initialized
      const hasApiKey = !!(claudeService as any).apiKey;
      const model = (claudeService as any).model || 'Not accessible';
      
      addTestResult({
        testName: 'Service Configuration Test',
        status: hasApiKey ? 'success' : 'error',
        message: hasApiKey ? 'Service is properly configured' : 'API key not found',
        response: { hasApiKey, model },
        executionTime: Date.now() - test3Start
      });
    } catch (error) {
      addTestResult({
        testName: 'Service Configuration Test',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - test3Start
      });
    }

    setIsRunning(false);
  };

  const runCustomPrompt = async () => {
    if (!customPrompt.trim()) return;

    setIsRunning(true);
    const startTime = Date.now();

    try {
      addTestResult({
        testName: 'Custom Prompt',
        status: 'pending',
        message: `Sending: "${customPrompt}"`
      });

      const response = await claudeService.sendPrompt(customPrompt);
      
      addTestResult({
        testName: 'Custom Prompt',
        status: 'success',
        message: 'Successfully received response',
        response: response,
        executionTime: Date.now() - startTime
      });
    } catch (error) {
      addTestResult({
        testName: 'Custom Prompt',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      });
    }

    setIsRunning(false);
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'pending': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '•';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Claude Service Test Suite</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Testing the Claude AI service singleton from @shared/services/claude-service
          </p>
        </div>

        <button
          onClick={runTests}
          disabled={isRunning}
          className={`px-4 py-2 rounded font-medium ${
            isRunning 
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </button>
      </div>

      {/* Custom Prompt Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">Custom Prompt Test</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Enter a custom prompt..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && runCustomPrompt()}
          />
          <button
            onClick={runCustomPrompt}
            disabled={isRunning || !customPrompt.trim()}
            className={`px-4 py-2 rounded font-medium ${
              isRunning || !customPrompt.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            Send
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Test Results</h3>
          <div className="space-y-3">
            {testResults.map((result, index) => (
              <div key={index} className="border rounded p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <h4 className="font-semibold">{result.testName}</h4>
                  </div>
                  {result.executionTime && (
                    <span className="text-sm text-gray-500">
                      {result.executionTime}ms
                    </span>
                  )}
                </div>
                
                {result.message && (
                  <p className={`text-sm ${getStatusColor(result.status)}`}>
                    {result.message}
                  </p>
                )}
                
                {result.response && (
                  <div className="mt-2 p-2 bg-gray-100 rounded">
                    <pre className="text-xs overflow-x-auto">
                      {typeof result.response === 'string' 
                        ? result.response 
                        : JSON.stringify(result.response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Info */}
      <div className="mt-6 p-4 bg-gray-100 rounded text-sm text-gray-600">
        <p>
          <strong>Note:</strong> This tests the Claude AI singleton service. The service should:
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Use a single shared instance across the application</li>
          <li>Handle basic prompts and JSON-formatted responses</li>
          <li>Load API configuration from environment variables</li>
          <li>Provide consistent error handling</li>
        </ul>
      </div>
    </div>
  );
};