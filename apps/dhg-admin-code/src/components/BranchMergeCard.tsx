import React from 'react';
import { GitBranch, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Clock, RefreshCw, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { MergeStatusBadge } from './MergeStatusBadge';
import type { MergeQueueItem } from './MergeQueueView';

interface BranchMergeCardProps {
  item: MergeQueueItem;
  isExpanded: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  isNextCandidate?: boolean;
}

export function BranchMergeCard({ 
  item, 
  isExpanded, 
  onToggle, 
  onRefresh,
  isNextCandidate 
}: BranchMergeCardProps) {
  const getCheckIcon = (status?: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'skipped':
        return <ArrowRight className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatCheckType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  };

  return (
    <div className={`
      border rounded-lg transition-all
      ${isNextCandidate ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white'}
      ${isExpanded ? 'shadow-md' : 'shadow-sm'}
    `}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button className="p-1">
              {isExpanded ? 
                <ChevronDown className="w-4 h-4 text-gray-500" /> : 
                <ChevronRight className="w-4 h-4 text-gray-500" />
              }
            </button>
            <GitBranch className="w-5 h-5 text-gray-600" />
            <span className="font-mono text-sm font-medium">{item.branch_name}</span>
            {isNextCandidate && (
              <span className="text-xs bg-green-200 text-green-700 px-2 py-0.5 rounded-full">
                Next
              </span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              Priority: {item.priority}
            </span>
            <MergeStatusBadge status={item.merge_status} size="sm" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick summary */}
        <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
          <span className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Updated {formatDate(item.last_updated_from_source)}</span>
          </span>
          {item.conflicts_detected && (
            <span className="flex items-center space-x-1 text-orange-600">
              <AlertCircle className="w-3 h-3" />
              <span>Has conflicts</span>
            </span>
          )}
          {item.dependencies && item.dependencies.length > 0 && (
            <span className="flex items-center space-x-1">
              <LinkIcon className="w-3 h-3" />
              <span>{item.dependencies.length} dependencies</span>
            </span>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Checklist */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Pre-merge Checklist</h4>
            <div className="space-y-1">
              {item.checklist?.map((check) => (
                <div key={check.id} className="flex items-center space-x-2 text-sm">
                  {getCheckIcon(check.status)}
                  <span className={check.status === 'failed' ? 'text-red-600' : 'text-gray-600'}>
                    {formatCheckType(check.check_type)}
                  </span>
                  {check.executed_at && (
                    <span className="text-gray-400 text-xs">
                      ({formatDate(check.executed_at)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dependencies */}
          {item.dependencies && item.dependencies.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Dependencies</h4>
              <div className="space-y-1">
                {item.dependencies.map((dep) => (
                  <div key={dep.id} className="flex items-center space-x-2 text-sm">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      Depends on <span className="font-mono">{dep.depends_on_branch}</span>
                      <span className="text-gray-400 ml-1">
                        ({dep.dependency_type.replace(/_/g, ' ')})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
              <p className="text-sm text-gray-600">{item.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center space-x-2 pt-2">
            <button className="text-sm bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors">
              Run Prepare
            </button>
            {item.merge_status === 'ready' && !item.dependencies?.length && (
              <button className="text-sm bg-green-500 text-white px-3 py-1.5 rounded hover:bg-green-600 transition-colors">
                Execute Merge
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}