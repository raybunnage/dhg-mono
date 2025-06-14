import React, { useState } from 'react';
import { Logger } from '@shared/utils/logger';

export function TestLogger() {
  const [logs, setLogs] = useState<string[]>([]);

  const testLogger = () => {
    const newLogs: string[] = [];
    
    // Capture console outputs
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;
    const originalDebug = console.debug;
    
    console.error = (...args) => {
      newLogs.push(`[ERROR] ${args.join(' ')}`);
      originalError(...args);
    };
    console.warn = (...args) => {
      newLogs.push(`[WARN] ${args.join(' ')}`);
      originalWarn(...args);
    };
    console.info = (...args) => {
      newLogs.push(`[INFO] ${args.join(' ')}`);
      originalInfo(...args);
    };
    console.debug = (...args) => {
      newLogs.push(`[DEBUG] ${args.join(' ')}`);
      originalDebug(...args);
    };

    // Test all log levels
    Logger.error('Test error message', new Error('Sample error'));
    Logger.warn('Test warning message');
    Logger.info('Test info message');
    Logger.debug('Test debug message');

    // Restore console methods
    console.error = originalError;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.debug = originalDebug;

    setLogs(newLogs);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Logger Test</h2>
      
      <div className="bg-gray-100 p-4 rounded">
        <p className="text-sm text-gray-600 mb-2">
          This tests the browser-safe logger that uses console methods instead of Node.js libraries.
        </p>
        <button
          onClick={testLogger}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Logger
        </button>
      </div>

      {logs.length > 0 && (
        <div className="bg-gray-900 text-white p-4 rounded font-mono text-sm">
          <h3 className="font-semibold mb-2">Log Output:</h3>
          {logs.map((log, index) => (
            <div key={index} className={
              log.includes('[ERROR]') ? 'text-red-400' :
              log.includes('[WARN]') ? 'text-yellow-400' :
              log.includes('[INFO]') ? 'text-blue-400' :
              'text-gray-400'
            }>
              {log}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}