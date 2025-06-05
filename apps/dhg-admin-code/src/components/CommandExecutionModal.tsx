import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ExecutionRecord {
  id: string;
  pipeline_name: string;
  command_name: string;
  status: string;
  execution_time: string;
  duration_ms: number | null;
  error_message: string | null;
  user_id: string | null;
  environment: string | null;
}

interface CommandExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineName: string;
  commandName: string;
}

export const CommandExecutionModal: React.FC<CommandExecutionModalProps> = ({
  isOpen,
  onClose,
  pipelineName,
  commandName
}) => {
  const [executions, setExecutions] = useState<ExecutionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');

  useEffect(() => {
    if (isOpen) {
      loadExecutions();
    }
  }, [isOpen, timeRange, statusFilter, pipelineName, commandName]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      
      console.log('Loading executions for:', { pipelineName, commandName });
      
      // Calculate time range
      const now = new Date();
      let fromTime = new Date();
      switch (timeRange) {
        case '1h':
          fromTime.setHours(now.getHours() - 1);
          break;
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

      // For database pipeline migration commands, we need to check both formats
      let query;
      if (pipelineName === 'database' && ['validate', 'dry-run', 'test', 'run-staged'].includes(commandName)) {
        // Handle migration subcommands - check for both "run-staged" and "migration-run-staged"
        query = supabase
          .from('command_tracking')
          .select('*')
          .eq('pipeline_name', pipelineName)
          .or(`command_name.eq.${commandName},command_name.eq.migration-${commandName}`)
          .gte('execution_time', fromTime.toISOString())
          .order('execution_time', { ascending: false })
          .limit(50);
      } else {
        // Standard query for other commands
        query = supabase
          .from('command_tracking')
          .select('*')
          .eq('pipeline_name', pipelineName)
          .eq('command_name', commandName)
          .gte('execution_time', fromTime.toISOString())
          .order('execution_time', { ascending: false })
          .limit(50);
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'error') {
          query = query.in('status', ['error', 'failed']);
        } else {
          query = query.eq('status', statusFilter);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      
      console.log('Query results:', { 
        count: data?.length || 0, 
        data: data?.slice(0, 2) // Show first 2 records
      });
      
      setExecutions(data || []);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'error':
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black opacity-30"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Execution History
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {pipelineName} / {commandName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-3 border-b border-gray-200 flex gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="all">All</option>
                <option value="success">Success</option>
                <option value="error">Errors</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : executions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No executions found for the selected time range
              </div>
            ) : (
              <div className="space-y-2">
                {executions.map((execution) => (
                  <div
                    key={execution.id}
                    className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getStatusIcon(execution.status)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(execution.status)}`}>
                              {execution.status}
                            </span>
                            <span className="text-sm text-gray-600">
                              {getRelativeTime(execution.execution_time)}
                            </span>
                            {execution.duration_ms && (
                              <span className="text-sm text-gray-500">
                                • {formatDuration(execution.duration_ms)}
                              </span>
                            )}
                          </div>
                          {execution.error_message && (
                            <div className="mt-2">
                              <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded">
                                {execution.error_message}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(execution.execution_time).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {executions.length} executions
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};