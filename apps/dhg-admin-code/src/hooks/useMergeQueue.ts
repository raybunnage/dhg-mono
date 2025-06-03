import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { MergeQueueItem } from '../components/MergeQueueView';

interface UseMergeQueueOptions {
  taskId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useMergeQueue(options: UseMergeQueueOptions = {}) {
  const { taskId, autoRefresh = false, refreshInterval = 30000 } = options;
  const [items, setItems] = useState<MergeQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMergeQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('dev_merge_queue')
        .select(`
          *,
          dev_merge_checklist (
            id,
            check_type,
            status,
            executed_at,
            result
          ),
          dev_merge_dependencies (
            id,
            depends_on_branch,
            dependency_type
          )
        `)
        .not('merge_status', 'eq', 'merged')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (taskId) {
        query = query.contains('task_ids', [taskId]);
      }

      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;

      const formattedData = data?.map(item => ({
        ...item,
        checklist: item.dev_merge_checklist || [],
        dependencies: item.dev_merge_dependencies || []
      })) || [];

      setItems(formattedData);
    } catch (err) {
      console.error('Error loading merge queue:', err);
      setError(err instanceof Error ? err.message : 'Failed to load merge queue');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const getNextCandidate = useCallback(() => {
    return items.find(item => 
      item.merge_status === 'ready' && 
      !item.dependencies?.some(dep => 
        items.some(other => 
          other.branch_name === dep.depends_on_branch && 
          other.merge_status !== 'merged'
        )
      )
    );
  }, [items]);

  const addToQueue = useCallback(async (branchName: string, priority: number = 0, relatedTaskIds?: string[]) => {
    try {
      const { error: insertError } = await supabase
        .from('dev_merge_queue')
        .insert({
          branch_name: branchName,
          priority,
          merge_status: 'pending',
          task_ids: relatedTaskIds
        });

      if (insertError) throw insertError;
      
      await loadMergeQueue();
    } catch (err) {
      console.error('Error adding to queue:', err);
      throw err;
    }
  }, [loadMergeQueue]);

  const updatePriority = useCallback(async (branchName: string, priority: number) => {
    try {
      const { error: updateError } = await supabase
        .from('dev_merge_queue')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('branch_name', branchName);

      if (updateError) throw updateError;
      
      await loadMergeQueue();
    } catch (err) {
      console.error('Error updating priority:', err);
      throw err;
    }
  }, [loadMergeQueue]);

  const removeFromQueue = useCallback(async (branchName: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('dev_merge_queue')
        .delete()
        .eq('branch_name', branchName);

      if (deleteError) throw deleteError;
      
      await loadMergeQueue();
    } catch (err) {
      console.error('Error removing from queue:', err);
      throw err;
    }
  }, [loadMergeQueue]);

  const addDependency = useCallback(async (branchName: string, dependsOn: string, dependencyType: 'must_merge_first' | 'should_merge_first' | 'test_together' = 'must_merge_first') => {
    try {
      // Get the queue entry
      const { data: queueEntry } = await supabase
        .from('dev_merge_queue')
        .select('id')
        .eq('branch_name', branchName)
        .single();

      if (!queueEntry) throw new Error('Branch not found in merge queue');

      const { error: insertError } = await supabase
        .from('dev_merge_dependencies')
        .insert({
          merge_queue_id: queueEntry.id,
          depends_on_branch: dependsOn,
          dependency_type: dependencyType
        });

      if (insertError) throw insertError;
      
      await loadMergeQueue();
    } catch (err) {
      console.error('Error adding dependency:', err);
      throw err;
    }
  }, [loadMergeQueue]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && !loading) {
      const interval = setInterval(loadMergeQueue, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, loading, loadMergeQueue]);

  // Initial load
  useEffect(() => {
    loadMergeQueue();
  }, [loadMergeQueue]);

  // Subscribe to real-time updates
  useEffect(() => {
    const subscription = supabase
      .channel('merge_queue_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dev_merge_queue'
      }, () => {
        loadMergeQueue();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadMergeQueue]);

  return {
    items,
    loading,
    error,
    refresh: loadMergeQueue,
    getNextCandidate,
    addToQueue,
    updatePriority,
    removeFromQueue,
    addDependency
  };
}