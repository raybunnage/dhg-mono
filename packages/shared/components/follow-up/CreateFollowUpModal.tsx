import { useState } from 'react';
import { FollowUpTaskService } from '../../services/follow-up-task-service';
import { SupabaseClient } from '@supabase/supabase-js';

interface CreateFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalTaskId?: string;
  originalWorkSummaryId?: string;
  followUpTaskId: string;
  followUpTaskTitle: string;
  onCreated?: () => void;
  supabaseClient: SupabaseClient;
}

export function CreateFollowUpModal({
  isOpen,
  onClose,
  originalTaskId,
  originalWorkSummaryId,
  followUpTaskId,
  followUpTaskTitle,
  onCreated,
  supabaseClient
}: CreateFollowUpModalProps) {
  const [followUpType, setFollowUpType] = useState('implementation');
  const [followUpSummary, setFollowUpSummary] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setCreating(true);
      setError(null);

      const followUpTaskService = FollowUpTaskService.getInstance(supabaseClient);
      await followUpTaskService.createFollowUpRelationship({
        originalTaskId,
        originalWorkSummaryId,
        followUpTaskId,
        followUpType,
        followUpSummary: followUpSummary.trim() || null
      });

      onCreated?.();
      onClose();
      
      // Reset form
      setFollowUpType('implementation');
      setFollowUpSummary('');
    } catch (err) {
      console.error('Error creating follow-up relationship:', err);
      setError(err instanceof Error ? err.message : 'Failed to create follow-up relationship');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  const followUpTypes = [
    { value: 'implementation', label: 'Implementation', description: 'Follow-up to implement requested changes' },
    { value: 'validation', label: 'Validation', description: 'Follow-up to validate or test the implementation' },
    { value: 'enhancement', label: 'Enhancement', description: 'Follow-up to enhance or improve the feature' },
    { value: 'bugfix', label: 'Bug Fix', description: 'Follow-up to fix issues discovered' },
    { value: 'documentation', label: 'Documentation', description: 'Follow-up to update documentation' },
    { value: 'testing', label: 'Testing', description: 'Follow-up to add or improve tests' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Create Follow-up Relationship
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600 mb-1">Follow-up Task:</div>
            <div className="font-medium text-gray-900">{followUpTaskTitle}</div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow-up Type
              </label>
              <select
                value={followUpType}
                onChange={(e) => setFollowUpType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {followUpTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {followUpTypes.find(t => t.value === followUpType)?.description}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Summary (Optional)
              </label>
              <textarea
                value={followUpSummary}
                onChange={(e) => setFollowUpSummary(e.target.value)}
                placeholder="Brief description of what this follow-up addresses..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Describe what this follow-up task addresses or implements
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Creating...
                  </>
                ) : (
                  'Create Relationship'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}