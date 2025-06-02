import React, { useEffect, useState } from 'react';
import { XCircle, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ErrorGroup {
  error_pattern: string;
  count: number;
  pipelines: string[];
  commands: string[];
  last_occurrence: string;
  example_message: string;
}

export const ErrorAnalysis: React.FC = () => {
  const [errorGroups, setErrorGroups] = useState<ErrorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadErrorData();
  }, [timeRange]);

  const loadErrorData = async () => {
    try {
      setLoading(true);
      
      // Calculate time range
      const now = new Date();
      const fromTime = new Date();
      switch (timeRange) {
        case '24h':
          fromTime.setDate(now.getDate() - 1);
          break;
        case '7d':
          fromTime.setDate(now.getDate() - 7);
          break;
        case '30d':
          fromTime.setDate(now.getDate() - 30);
          break;
      }

      // Fetch error data
      const { data, error } = await supabase
        .from('command_tracking')
        .select('pipeline_name, command_name, error_message, execution_time')
        .in('status', ['error', 'failed'])
        .not('error_message', 'is', null)
        .gte('execution_time', fromTime.toISOString())
        .order('execution_time', { ascending: false });

      if (error) throw error;

      // Group errors by pattern
      const errorMap = new Map<string, {
        count: number;
        pipelines: Set<string>;
        commands: Set<string>;
        last_occurrence: string;
        example: string;
      }>();

      data?.forEach(record => {
        if (!record.error_message) return;
        
        // Extract error pattern (simplified - you could make this more sophisticated)
        const pattern = extractErrorPattern(record.error_message);
        
        const existing = errorMap.get(pattern) || {
          count: 0,
          pipelines: new Set(),
          commands: new Set(),
          last_occurrence: record.execution_time,
          example: record.error_message
        };
        
        existing.count++;
        existing.pipelines.add(record.pipeline_name);
        existing.commands.add(record.command_name);
        if (record.execution_time > existing.last_occurrence) {
          existing.last_occurrence = record.execution_time;
        }
        
        errorMap.set(pattern, existing);
      });

      // Convert to array and sort by count
      const groups: ErrorGroup[] = Array.from(errorMap.entries())
        .map(([pattern, data]) => ({
          error_pattern: pattern,
          count: data.count,
          pipelines: Array.from(data.pipelines),
          commands: Array.from(data.commands),
          last_occurrence: data.last_occurrence,
          example_message: data.example
        }))
        .sort((a, b) => b.count - a.count);

      setErrorGroups(groups);
    } catch (error) {
      console.error('Error loading error data:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractErrorPattern = (errorMessage: string): string => {
    // Simple pattern extraction - could be enhanced
    // Remove specific values like IDs, timestamps, etc.
    let pattern = errorMessage
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[UUID]')
      .replace(/\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?\b/g, '[TIMESTAMP]')
      .replace(/\b\d+\b/g, '[NUMBER]')
      .substring(0, 100);
    
    // Group by common error types
    if (pattern.includes('permission') || pattern.includes('denied')) {
      return 'Permission/Access Error';
    }
    if (pattern.includes('timeout') || pattern.includes('timed out')) {
      return 'Timeout Error';
    }
    if (pattern.includes('not found') || pattern.includes('404')) {
      return 'Not Found Error';
    }
    if (pattern.includes('connection') || pattern.includes('network')) {
      return 'Connection Error';
    }
    if (pattern.includes('invalid') || pattern.includes('validation')) {
      return 'Validation Error';
    }
    
    return pattern;
  };

  const toggleGroup = (index: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedGroups(newExpanded);
  };

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading error analysis...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-green-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Common Error Patterns
        </h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="text-sm border border-gray-300 rounded px-3 py-1"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {errorGroups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No errors found in the selected time range
        </div>
      ) : (
        <div className="space-y-3">
          {errorGroups.slice(0, 10).map((group, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div
                className="p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => toggleGroup(index)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {group.error_pattern}
                        </h4>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-red-600">{group.count}</span>
                            occurrences
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-semibold">{group.pipelines.length}</span>
                            pipeline{group.pipelines.length !== 1 ? 's' : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            Last: {getRelativeTime(group.last_occurrence)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <svg
                      className={`w-5 h-5 text-gray-400 transform transition-transform ${
                        expandedGroups.has(index) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              
              {expandedGroups.has(index) && (
                <div className="p-4 border-t border-gray-200">
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Affected Commands:</h5>
                      <div className="flex flex-wrap gap-2">
                        {group.commands.map((cmd, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                          >
                            {cmd}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-700 mb-1">Example Error:</h5>
                      <pre className="text-xs text-red-600 bg-red-50 p-2 rounded overflow-x-auto">
                        {group.example_message}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};