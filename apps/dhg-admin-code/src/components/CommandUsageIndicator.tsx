import React from 'react';

interface CommandUsageIndicatorProps {
  executionCount: number;
  lastExecuted: string | null;
  successRate: number;
  className?: string;
}

export const CommandUsageIndicator: React.FC<CommandUsageIndicatorProps> = ({
  executionCount,
  lastExecuted,
  successRate,
  className = ''
}) => {
  // Determine usage level
  const getUsageLevel = (count: number) => {
    if (count === 0) return { level: 'unused', color: 'gray', icon: '○' };
    if (count < 5) return { level: 'low', color: 'blue', icon: '◐' };
    if (count < 20) return { level: 'medium', color: 'green', icon: '◑' };
    return { level: 'high', color: 'emerald', icon: '●' };
  };

  const usage = getUsageLevel(executionCount);
  
  // Format last executed time
  const getRelativeTime = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Usage indicator dot */}
      <div className="flex items-center gap-2">
        <span className={`text-2xl text-${usage.color}-500`} title={`${executionCount} executions`}>
          {usage.icon}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-700">
            {executionCount} {executionCount === 1 ? 'use' : 'uses'}
          </span>
          <span className="text-xs text-gray-500">
            {getRelativeTime(lastExecuted)}
          </span>
        </div>
      </div>
      
      {/* Success rate indicator */}
      {executionCount > 0 && (
        <div className="flex items-center gap-1">
          <div className="relative w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full transition-all duration-300 ${
                successRate >= 90 ? 'bg-green-500' : 
                successRate >= 70 ? 'bg-yellow-500' : 
                'bg-red-500'
              }`}
              style={{ width: `${successRate}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{Math.round(successRate)}%</span>
        </div>
      )}
    </div>
  );
};