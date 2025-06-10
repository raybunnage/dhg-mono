import { useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PhaseInfo } from '@shared/utils/markdown-phase-extractor';

interface CreateTaskFromPhaseProps {
  phaseInfo: PhaseInfo;
  docId?: string;
  docTitle: string;
  docPath: string;
  onTaskCreated?: (taskId: string) => void;
  onCancel?: () => void;
}

export function CreateTaskFromPhase({
  phaseInfo,
  docId,
  docTitle,
  docPath,
  onTaskCreated,
  onCancel
}: CreateTaskFromPhaseProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState(`Implement: ${phaseInfo.phaseName}`);
  const [taskDescription, setTaskDescription] = useState(generateDescription());
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskType, setTaskType] = useState<'feature' | 'bug' | 'refactor' | 'question'>('feature');

  function generateDescription(): string {
    let desc = `## Implementation Plan for: ${phaseInfo.phaseName}\n\n`;
    desc += `**Source Document**: ${docTitle}\n`;
    desc += `**Document Path**: ${docPath}\n\n`;
    
    if (phaseInfo.targetDate) {
      desc += `**Target Date**: ${phaseInfo.targetDate}\n`;
    }
    
    if (phaseInfo.status) {
      desc += `**Current Status**: ${phaseInfo.status}\n`;
    }
    
    desc += `\n### Tasks to Complete\n\n`;
    
    if (phaseInfo.tasks.length > 0) {
      phaseInfo.tasks.forEach((task, index) => {
        desc += `${index + 1}. ${task}\n`;
      });
    }
    
    desc += `\n### Implementation Steps\n\n`;
    desc += `1. Review the full documentation in the source document\n`;
    desc += `2. Break down each task into specific technical requirements\n`;
    desc += `3. Identify dependencies and prerequisites\n`;
    desc += `4. Create test cases for each feature\n`;
    desc += `5. Implement features incrementally\n`;
    desc += `6. Update documentation as features are completed\n`;
    desc += `7. Mark tasks complete in the source document\n`;
    
    desc += `\n### Success Criteria\n\n`;
    desc += `- All listed tasks are completed and tested\n`;
    desc += `- Source document is updated to reflect completion\n`;
    desc += `- No regressions in existing functionality\n`;
    desc += `- Code follows project standards and patterns\n`;
    
    return desc;
  }

  async function handleCreate() {
    try {
      setCreating(true);
      setError(null);

      // Generate Claude request
      const claudeRequest = `# Task: ${taskTitle}
ID: [will be assigned]
Type: ${taskType}
Priority: ${priority}

## Description
${taskDescription}

## Context
This task was generated from the continuous documentation: ${docTitle}
Phase: ${phaseInfo.phaseName}`;

      // Create the dev task
      const { data, error: createError } = await supabase
        .from('dev_tasks')
        .insert({
          title: taskTitle,
          description: taskDescription,
          task_type: taskType,
          priority,
          status: 'pending',
          claude_request: claudeRequest,
          source_doc_id: docId,
          source_doc_path: docPath,
          source_doc_phase: phaseInfo.phaseName,
          requires_branch: true,
          success_criteria_defined: true
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add success criteria based on the tasks
      if (data && phaseInfo.tasks.length > 0) {
        const criteria = phaseInfo.tasks.map((task, index) => ({
          task_id: data.id,
          criteria_type: 'implementation',
          description: task,
          priority: index === 0 ? 'high' : 'medium',
          is_required: true,
          success_condition: `Task "${task}" is fully implemented and tested`
        }));

        const { error: criteriaError } = await supabase
          .from('dev_task_success_criteria')
          .insert(criteria);

        if (criteriaError) {
          console.error('Error creating success criteria:', criteriaError);
        }
      }

      if (onTaskCreated && data) {
        onTaskCreated(data.id);
      }
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Create Implementation Task
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Create a dev task from the "{phaseInfo.phaseName}" phase
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Task Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter task title"
              />
            </div>

            {/* Task Type and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="feature">Feature</option>
                  <option value="bug">Bug</option>
                  <option value="refactor">Refactor</option>
                  <option value="question">Question</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Task description..."
              />
            </div>

            {/* Phase Info */}
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium text-gray-900 mb-2">Phase Information</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-600">Phase:</dt>
                <dd className="text-gray-900">{phaseInfo.phaseName}</dd>
                
                {phaseInfo.targetDate && (
                  <>
                    <dt className="text-gray-600">Target Date:</dt>
                    <dd className="text-gray-900">{phaseInfo.targetDate}</dd>
                  </>
                )}
                
                {phaseInfo.status && (
                  <>
                    <dt className="text-gray-600">Status:</dt>
                    <dd className="text-gray-900">{phaseInfo.status}</dd>
                  </>
                )}
                
                <dt className="text-gray-600">Tasks:</dt>
                <dd className="text-gray-900">{phaseInfo.tasks.length} items</dd>
              </dl>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={creating}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !taskTitle.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}