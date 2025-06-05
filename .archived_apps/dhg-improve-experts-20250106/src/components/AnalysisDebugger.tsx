import React from 'react';

interface DebugLog {
  stage: string;
  data: {
    error?: string | Error;
    stack?: string;
    [key: string]: any;
  };
  timestamp: number;
}

interface Props {
  logs: DebugLog[];
}

export function AnalysisDebugger({ logs }: Props) {
  if (!logs?.length) {
    return null;
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg mt-4">
      <h3 className="text-lg font-semibold mb-2">Analysis Debug Log</h3>
      <div className="space-y-2">
        {logs.map((log, index) => (
          <div key={index} className="bg-white p-2 rounded shadow">
            <div className="font-medium flex justify-between items-center">
              <span className={`
                ${log.stage.includes('Error') ? 'text-red-600' : ''}
                ${log.stage.includes('Complete') ? 'text-green-600' : ''}
              `}>
                {log.stage}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            {/* Show error details if they exist */}
            {(log.data?.error || log.stage.includes('Error')) && (
              <div className="text-red-600 text-sm mt-2 p-2 bg-red-50 rounded">
                <div>Error: {log.data?.error?.toString() || 'Unknown error'}</div>
                {log.data?.stack && (
                  <pre className="text-xs mt-1 overflow-x-auto whitespace-pre-wrap">
                    {log.data.stack}
                  </pre>
                )}
              </div>
            )}

            {/* Show analysis results summary if they exist */}
            {log.data?.result && (
              <div className="text-sm mt-2">
                <div className="text-green-600">
                  Analysis completed successfully:
                </div>
                <ul className="list-disc list-inside mt-1">
                  {log.data.hasReactAnalysis && (
                    <li>React analysis included</li>
                  )}
                  {log.data.hasEnhancedAnalysis && (
                    <li>Enhanced analysis included</li>
                  )}
                </ul>
              </div>
            )}

            {/* Show full data in collapsible pre */}
            <details className="mt-2">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                View raw data
              </summary>
              <pre className="text-xs mt-2 overflow-x-auto bg-gray-50 p-2 rounded whitespace-pre-wrap">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
} 