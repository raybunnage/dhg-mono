import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
  priority?: string;
}

interface DocumentationInfo {
  hasDocumentation: boolean;
  documentationType?: string;
  lastUpdated?: string;
  documentCount?: number;
}

interface WorkSummaryTrackingData {
  devTask?: DevTaskInfo;
  submissionInfo?: SubmissionInfo;
  validationInfo?: ValidationInfo;
  testResults?: TestResults;
  documentationInfo?: DocumentationInfo;
  todoItems: TodoItem[];
}

export function useWorkSummaryTracking(summaryId: string, taskId?: string) {
  const [data, setData] = useState<WorkSummaryTrackingData>({
    todoItems: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!summaryId) return;

    async function fetchTrackingData() {
      try {
        setLoading(true);
        const results: WorkSummaryTrackingData = { todoItems: [] };

        // If we have a task ID, fetch all related data
        if (taskId) {
          // Fetch dev task info
          const { data: taskData, error: taskError } = await supabase
            .from('dev_tasks')
            .select('id, title, status')
            .eq('id', taskId)
            .single();

          if (!taskError && taskData) {
            results.devTask = taskData;
          }

          // Fetch submission info from dev_tasks
          const { data: submissionData, error: submissionError } = await supabase
            .from('dev_tasks')
            .select('claude_submission_timestamp, claude_submission_worktree, git_commit_current, worktree')
            .eq('id', taskId)
            .single();

          if (!submissionError && submissionData && submissionData.claude_submission_timestamp) {
            results.submissionInfo = {
              timestamp: submissionData.claude_submission_timestamp,
              worktree: submissionData.claude_submission_worktree || submissionData.worktree,
              gitCommit: submissionData.git_commit_current
            };
          }

          // Fetch validation info from work_summary_validations
          const { data: validationData, error: validationError } = await supabase
            .from('work_summary_validations')
            .select('validated_at, validation_status, validation_summary, issues')
            .eq('dev_task_id', taskId)
            .order('validated_at', { ascending: false })
            .limit(1)
            .single();

          if (!validationError && validationData) {
            results.validationInfo = {
              submitted: true,
              timestamp: validationData.validated_at,
              status: validationData.validation_status as any,
              summary: validationData.validation_summary,
              issuesCount: validationData.issues ? Object.keys(validationData.issues).length : 0
            };
          } else {
            results.validationInfo = { submitted: false };
          }

          // Fetch test results
          const { data: testData, error: testError } = await supabase
            .from('test_results')
            .select('*')
            .eq('dev_task_id', taskId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (!testError && testData) {
            results.testResults = {
              hasTests: true,
              passed: testData.passed_count,
              failed: testData.failed_count,
              skipped: testData.skipped_count,
              coverage: testData.coverage_percentage,
              testSuiteUrl: testData.report_url,
              needsAction: testData.failed_count > 0,
              actionReason: testData.failed_count > 0 ? `${testData.failed_count} tests are failing` : undefined
            };
          } else {
            results.testResults = { hasTests: false, needsAction: false };
          }

          // Fetch documentation status
          const { data: docData, error: docError } = await supabase
            .from('continuous_documentation_tracking')
            .select('doc_type, updated_at, status')
            .eq('task_id', taskId)
            .order('updated_at', { ascending: false });

          if (!docError && docData && docData.length > 0) {
            results.documentationInfo = {
              hasDocumentation: true,
              documentationType: docData[0].doc_type,
              lastUpdated: docData[0].updated_at,
              documentCount: docData.length
            };
          } else {
            results.documentationInfo = { hasDocumentation: false };
          }

          // Fetch follow-up tasks as todo items
          const { data: followUpData, error: followUpError } = await supabase
            .from('dev_follow_up_tasks')
            .select('follow_up_task_id, follow_up_type, priority, follow_up_summary')
            .eq('parent_task_id', taskId);

          if (!followUpError && followUpData && followUpData.length > 0) {
            // Get the actual task details for follow-ups
            const followUpIds = followUpData.map((f: any) => f.follow_up_task_id);
            const { data: followUpTasks } = await supabase
              .from('dev_tasks')
              .select('id, title, status')
              .in('id', followUpIds);

            if (followUpTasks) {
              results.todoItems = followUpTasks.map((task: any) => {
                const followUpInfo = followUpData.find((f: any) => f.follow_up_task_id === task.id);
                return {
                  id: task.id,
                  text: task.title,
                  completed: task.status === 'completed',
                  priority: followUpInfo?.priority
                };
              });
            }
          }
        }

        // For now, we'll also check if the summary has associated validation/test data
        // This would be based on the summary ID itself
        const { data: summaryValidation } = await supabase
          .from('work_summary_validations')
          .select('*')
          .eq('work_summary_id', summaryId)
          .single();

        if (summaryValidation && !results.validationInfo?.submitted) {
          results.validationInfo = {
            submitted: true,
            timestamp: summaryValidation.validated_at,
            status: summaryValidation.validation_status,
            summary: summaryValidation.validation_summary
          };
        }

        setData(results);
      } catch (err) {
        console.error('Error fetching work summary tracking data:', err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchTrackingData();
  }, [summaryId, taskId]);

  const toggleTodo = async (todoId: string) => {
    try {
      const todo = data.todoItems.find(t => t.id === todoId);
      if (!todo) return;

      const newStatus = todo.completed ? 'pending' : 'completed';

      // Update in database (these are dev_tasks)
      const { error } = await supabase
        .from('dev_tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', todoId);

      if (error) throw error;

      // Update local state
      setData(prev => ({
        ...prev,
        todoItems: prev.todoItems.map(item =>
          item.id === todoId ? { ...item, completed: !item.completed } : item
        )
      }));
    } catch (err) {
      console.error('Error toggling todo:', err);
    }
  };

  return {
    ...data,
    loading,
    error,
    toggleTodo
  };
}