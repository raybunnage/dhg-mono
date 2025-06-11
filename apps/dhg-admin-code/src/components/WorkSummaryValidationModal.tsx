import React, { useState } from 'react';
import { X, CheckCircle, TestTube, AlertCircle, Database, Link, FileText, CheckSquare } from 'lucide-react';
import { TaskService } from '../services/task-service';
import { useNavigate } from 'react-router-dom';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

const supabase = createSupabaseAdapter({ env: import.meta.env as any });

interface ValidationChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  required: boolean;
}

interface WorkSummaryValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workSummary: {
    id: string;
    title: string;
    summary_content: string;
    category: string;
    tags?: string[];
    worktree?: string;
    metadata?: any;
  };
}

export const WorkSummaryValidationModal: React.FC<WorkSummaryValidationModalProps> = ({
  isOpen,
  onClose,
  workSummary
}) => {
  const navigate = useNavigate();
  const [selectedChecks, setSelectedChecks] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  const validationChecklist: ValidationChecklistItem[] = [
    {
      id: 'validate-success',
      label: 'Validate successful implementation',
      description: 'Verify the feature/fix works as intended with concrete evidence',
      icon: <CheckCircle className="w-4 h-4" />,
      required: true
    },
    {
      id: 'write-tests',
      label: 'Write or enhance tests',
      description: 'Create unit/integration tests or add to existing test suites',
      icon: <TestTube className="w-4 h-4" />,
      required: true
    },
    {
      id: 'evaluate-tests',
      label: 'Evaluate test results',
      description: 'Run tests and document any issues or discrepancies found',
      icon: <AlertCircle className="w-4 h-4" />,
      required: true
    },
    {
      id: 'update-statuses',
      label: 'Update tracking statuses',
      description: 'Mark appropriate statuses in dev_tasks and link to work summaries',
      icon: <CheckSquare className="w-4 h-4" />,
      required: false
    },
    {
      id: 'update-registries',
      label: 'Update registries and definitions',
      description: 'Add new code to command registries, table definitions, or sync commands',
      icon: <Database className="w-4 h-4" />,
      required: false
    },
    {
      id: 'complete-lifecycle',
      label: 'Complete task lifecycle',
      description: 'Determine if feature is implemented, bug is fixed, or question is answered',
      icon: <Link className="w-4 h-4" />,
      required: true
    },
    {
      id: 'database-updates',
      label: 'Database schema updates',
      description: 'Add tables/fields if needed and handle migrations properly',
      icon: <Database className="w-4 h-4" />,
      required: false
    },
    {
      id: 'living-doc',
      label: 'Update living documentation',
      description: 'Ensure validation is covered in the appropriate living document',
      icon: <FileText className="w-4 h-4" />,
      required: true
    }
  ];

  const handleCheckToggle = (checkId: string) => {
    setSelectedChecks(prev => 
      prev.includes(checkId) 
        ? prev.filter(id => id !== checkId)
        : [...prev, checkId]
    );
  };

  const handleCreateValidationTask = async () => {
    setIsCreating(true);
    
    try {
      // Get selected validation items
      const selectedItems = validationChecklist.filter(item => 
        selectedChecks.includes(item.id)
      );
      
      // Build task description
      const taskDescription = `## Validation Task for: ${workSummary.title}

This task validates and completes the implementation from work summary: ${workSummary.id}

### Validation Checklist:
${selectedItems.map(item => `- [ ] **${item.label}**: ${item.description}`).join('\n')}

### Original Work Summary:
${workSummary.summary_content}

### Additional Context:
- Category: ${workSummary.category}
- Tags: ${workSummary.tags?.join(', ') || 'None'}
- Worktree: ${workSummary.worktree || 'Not specified'}

### Success Criteria:
1. All selected validation items are completed
2. Evidence of successful validation is documented
3. Any issues found are resolved or documented
4. Living documentation is updated with validation results`;

      // Create the validation task
      const taskData = {
        title: `Validate: ${workSummary.title}`,
        description: taskDescription,
        task_type: 'feature' as const,
        priority: 'medium' as const,
        status: 'pending' as const,
        tags: [...(workSummary.tags || []), 'validation', 'follow-up'],
        worktree_path: workSummary.worktree || null,
        metadata: {
          parent_work_summary_id: workSummary.id,
          validation_checklist: selectedChecks,
          is_validation_task: true
        }
      };

      const taskId = await TaskService.createTask(taskData);
      
      // Update work summary metadata to link to validation task
      const { error: updateError } = await supabase
        .from('ai_work_summaries')
        .update({
          metadata: {
            ...workSummary.metadata,
            validation_task_id: taskId,
            validation_created_at: new Date().toISOString()
          }
        })
        .eq('id', workSummary.id);

      if (updateError) {
        console.error('Failed to update work summary:', updateError);
      }

      // Navigate to the new task
      navigate(`/tasks?id=${taskId}`);
      onClose();
    } catch (error) {
      console.error('Failed to create validation task:', error);
      alert('Failed to create validation task. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const requiredChecks = validationChecklist.filter(item => item.required);
  const requiredSelected = requiredChecks.every(item => selectedChecks.includes(item.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create Validation Task</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Create a follow-up task to validate and test the work from this summary
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-1">{workSummary.title}</h3>
            <p className="text-sm text-blue-700 line-clamp-3">{workSummary.summary_content}</p>
          </div>

          <h3 className="text-lg font-medium text-gray-900 mb-3">Validation Checklist</h3>
          <p className="text-sm text-gray-600 mb-4">
            Select the validation steps to include in the follow-up task. Required items are marked with *.
          </p>

          <div className="space-y-3">
            {validationChecklist.map((item) => (
              <label
                key={item.id}
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedChecks.includes(item.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedChecks.includes(item.id)}
                  onChange={() => handleCheckToggle(item.id)}
                  className="mt-1 mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{item.icon}</span>
                    <span className="font-medium text-gray-900">
                      {item.label}
                      {item.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {!requiredSelected && (
                <span className="text-red-600">Please select all required items (*)</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateValidationTask}
                disabled={!requiredSelected || selectedChecks.length === 0 || isCreating}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  'Create Validation Task'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};