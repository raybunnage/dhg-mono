import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, Tag, Command, ChevronDown, ChevronUp, GitBranch, 
  CheckSquare, Clock, AlertCircle, FileText, ExternalLink,
  GitCommit, CheckCircle, XCircle, Loader, TestTube,
  ListChecks, Activity, Code, Plus
} from 'lucide-react';
import { WorkSummary } from '@shared/services/work-summary-service';
import { StatusPill, StatusIndicatorGroup, getStatusVariant } from '@shared/components/ui/StatusPill';

interface DevTaskInfo {
  id: string;
  title: string;
  status: string;
}

interface SubmissionInfo {
  timestamp: string;
  worktree: string;
  claudeSubmissionId?: string;
  gitCommit?: string;
}

interface ValidationInfo {
  submitted: boolean;
  timestamp?: string;
  status?: 'pending' | 'passed' | 'failed' | 'issues_found';
  summary?: string;
  issuesCount?: number;
}

interface TestResults {
  hasTests: boolean;
  testSuiteUrl?: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  coverage?: number;
  needsAction: boolean;
  actionReason?: string;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface DocumentationInfo {
  hasDocumentation: boolean;
  documentationType?: string;
  lastUpdated?: string;
  documentCount?: number;
}

interface WorkSummaryCardProps {
  summary: WorkSummary;
  devTask?: DevTaskInfo;
  submissionInfo?: SubmissionInfo;
  validationInfo?: ValidationInfo;
  testResults?: TestResults;
  documentationInfo?: DocumentationInfo;
  todoItems?: TodoItem[];
  onToggleTodo?: (todoId: string) => void;
  onCreateFollowUpTask?: () => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

export function WorkSummaryCard({
  summary,
  devTask,
  submissionInfo,
  validationInfo,
  testResults,
  documentationInfo,
  todoItems = [],
  onToggleTodo,
  onCreateFollowUpTask,
  expanded = false,
  onToggleExpanded
}: WorkSummaryCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const getCategoryEmoji = (category: string) => {
    const emojiMap: Record<string, string> = {
      feature: '✨',
      bug: '🐛',
      bug_fix: '🐛',
      refactor: '🔧',
      refactoring: '🔧',
      documentation: '📚',
      infrastructure: '🏗️',
      testing: '🧪',
      performance: '⚡',
      security: '🔒'
    };
    return emojiMap[category] || '📋';
  };


  const completedTodos = todoItems.filter(item => item.completed).length;
  const todoProgress = todoItems.length > 0 ? (completedTodos / todoItems.length) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg">{getCategoryEmoji(summary.category)}</span>
              <h3 className="text-lg font-semibold text-gray-900 flex-1">{summary.title}</h3>
              <StatusPill variant="primary" size="sm">
                Summary
              </StatusPill>
            </div>

            {/* Dev Task Link */}
            {devTask && (
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-4 w-4 text-gray-400" />
                <Link 
                  to={`/dev-tasks/${devTask.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                >
                  {devTask.title}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <StatusPill variant={getStatusVariant(devTask.status)} size="sm">
                  {devTask.status.replace('_', ' ')}
                </StatusPill>
              </div>
            )}

            {/* Metadata Row */}
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(summary.work_date).toLocaleDateString()}
              </span>
              
              {submissionInfo && (
                <>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(submissionInfo.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-4 w-4" />
                    {submissionInfo.worktree}
                  </span>
                  {submissionInfo.gitCommit && (
                    <a 
                      href={`#commit/${submissionInfo.gitCommit}`}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <GitCommit className="h-4 w-4" />
                      {submissionInfo.gitCommit.substring(0, 7)}
                    </a>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              title="Toggle details"
            >
              <Activity className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Status Indicators Bar - Visual Dot System */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <StatusIndicatorGroup 
            statuses={[
              {
                label: 'Submitted',
                status: submissionInfo ? 'completed' : 'not_started'
              },
              {
                label: 'Validated',
                status: validationInfo?.submitted 
                  ? (validationInfo.status === 'passed' ? 'completed' 
                    : validationInfo.status === 'failed' ? 'failed'
                    : validationInfo.status === 'pending' ? 'in_progress'
                    : 'warning')
                  : 'not_started'
              },
              {
                label: 'Tested',
                status: testResults?.hasTests
                  ? (testResults.failed === 0 ? 'completed' : 'failed')
                  : 'not_started'
              },
              {
                label: 'Documented',
                status: documentationInfo?.hasDocumentation ? 'completed' : 'not_started'
              }
            ]}
          />
          
          {/* Progress Bar */}
          <div className="mt-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-gray-600" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">Follow-up Tasks</span>
                <span className="text-xs text-gray-500">{completedTodos}/{todoItems.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${todoProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Content */}
        <div className="mb-4">
          <p className={`text-gray-600 leading-relaxed ${expanded ? 'whitespace-pre-wrap' : 'overflow-hidden'}`}
             style={expanded ? {} : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
            {summary.summary_content}
          </p>
          {summary.summary_content.length > 200 && onToggleExpanded && (
            <button
              onClick={onToggleExpanded}
              className="mt-2 text-sm text-gray-600 hover:text-gray-800 font-medium flex items-center gap-1 transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show more
                </>
              )}
            </button>
          )}
        </div>

        {/* Commands and Tags */}
        <div className="flex flex-wrap gap-2">
          {summary.commands?.map(cmd => (
            <StatusPill key={cmd} variant="secondary" size="sm" icon={<Command className="h-3 w-3" />}>
              {cmd}
            </StatusPill>
          ))}
          {summary.tags?.map(tag => (
            <StatusPill key={tag} variant="primary" size="sm" icon={<Tag className="h-3 w-3" />}>
              {tag}
            </StatusPill>
          ))}
        </div>

        {/* Expanded Details Section */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
            {/* Validation Summary */}
            {validationInfo?.submitted && validationInfo.summary && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Validation Summary
                </h4>
                <p className="text-sm text-gray-600">{validationInfo.summary}</p>
                {validationInfo.issuesCount && validationInfo.issuesCount > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-700">{validationInfo.issuesCount} issues found</span>
                  </div>
                )}
              </div>
            )}

            {/* Test Results */}
            {testResults?.hasTests && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Test Results
                </h4>
                <div className="grid grid-cols-4 gap-4 mb-2">
                  <div className="text-center">
                    <div className="text-lg font-semibold text-green-700">{testResults.passed || 0}</div>
                    <div className="text-xs text-gray-600">Passed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-red-700">{testResults.failed || 0}</div>
                    <div className="text-xs text-gray-600">Failed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-700">{testResults.skipped || 0}</div>
                    <div className="text-xs text-gray-600">Skipped</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-blue-700">{testResults.coverage || 0}%</div>
                    <div className="text-xs text-gray-600">Coverage</div>
                  </div>
                </div>
                {testResults.testSuiteUrl && (
                  <a 
                    href={testResults.testSuiteUrl}
                    className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    View full test report
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {testResults.needsAction && (
                  <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-orange-800">Action Required</p>
                        <p className="text-sm text-orange-700">{testResults.actionReason}</p>
                        {onCreateFollowUpTask && (
                          <button
                            onClick={onCreateFollowUpTask}
                            className="mt-2 text-sm text-orange-700 hover:text-orange-900 font-medium underline"
                          >
                            Create follow-up task
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Todo Checklist */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Follow-up Tasks {todoItems.length > 0 && `(${completedTodos}/${todoItems.length})`}
                </h4>
                {onCreateFollowUpTask && (
                  <button
                    onClick={onCreateFollowUpTask}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Add Task
                  </button>
                )}
              </div>
              
              {todoItems.length > 0 ? (
                <div className="space-y-2">
                  {todoItems.map(item => (
                    <label key={item.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => onToggleTodo?.(item.id)}
                        className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm ${item.completed ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                        {item.text}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No follow-up tasks yet. Click "Add Task" to create one.</p>
              )}
            </div>

            {/* Action Required Notice */}
            {!validationInfo?.submitted && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="text-sm text-yellow-800">
                    This work summary has not been validated yet. Consider running the validation workflow.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}