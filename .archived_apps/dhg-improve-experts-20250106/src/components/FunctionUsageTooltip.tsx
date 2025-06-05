import { useState } from 'react';
import { getFunctionInfo } from '@/utils/function-registry';

interface FunctionUsageTooltipProps {
  functionName: string;
  children: React.ReactNode;
}

export function FunctionUsageTooltip({ functionName, children }: FunctionUsageTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const functionInfo = getFunctionInfo(functionName);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </div>
      
      {showTooltip && functionInfo && (
        <div className="absolute z-50 w-96 p-4 bg-white shadow-lg rounded-lg border mt-2">
          <h3 className="font-bold">{functionInfo.name}</h3>
          <p className="text-sm text-gray-600">{functionInfo.description}</p>
          <div className="mt-2 text-xs">
            <div className="flex gap-2">
              <span className={`px-2 py-1 rounded ${
                functionInfo.status === 'active' ? 'bg-green-100' :
                functionInfo.status === 'deprecated' ? 'bg-red-100' :
                'bg-yellow-100'
              }`}>
                {functionInfo.status}
              </span>
              <span className="text-gray-500">Location: {functionInfo.location}</span>
            </div>
            {functionInfo.example && (
              <pre className="mt-2 p-2 bg-gray-50 rounded">
                {functionInfo.example}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 