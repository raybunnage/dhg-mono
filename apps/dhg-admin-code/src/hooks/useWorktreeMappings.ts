import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface WorktreeDefinition {
  id: string;
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorktreeMapping {
  worktree_id: string;
  app_name?: string;
  pipeline_name?: string;
}

export function useWorktreeMappings() {
  const [worktrees, setWorktrees] = useState<WorktreeDefinition[]>([]);
  const [appMappings, setAppMappings] = useState<WorktreeMapping[]>([]);
  const [pipelineMappings, setPipelineMappings] = useState<WorktreeMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('🔍 Fetching worktree data...');
      
      // Check current user
      const { data: { user } } = await supabase.auth.getUser();
      console.log('👤 Current user:', user?.email || 'not authenticated');
      
      // Fetch worktree definitions
      const { data: worktreeData, error: worktreeError } = await supabase
        .from('worktree_definitions')
        .select('*')
        .order('alias_number');

      console.log('📊 Worktree data:', worktreeData, 'Error:', worktreeError);
      if (worktreeError) throw worktreeError;

      // Fetch app mappings
      const { data: appData, error: appError } = await supabase
        .from('worktree_app_mappings')
        .select('*');

      if (appError) throw appError;

      // Fetch pipeline mappings
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('worktree_pipeline_mappings')
        .select('*');

      if (pipelineError) throw pipelineError;

      setWorktrees(worktreeData || []);
      setAppMappings(appData || []);
      setPipelineMappings(pipelineData || []);
      console.log('✅ Successfully loaded:', worktreeData?.length, 'worktrees,', appData?.length, 'app mappings,', pipelineData?.length, 'pipeline mappings');
    } catch (err) {
      console.error('❌ Error fetching worktree mappings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch worktree mappings');
    } finally {
      setLoading(false);
    }
  };

  const getWorktreeById = (id: string): WorktreeDefinition | undefined => {
    return worktrees.find(w => w.id === id);
  };

  const getWorktreeByPath = (path: string): WorktreeDefinition | undefined => {
    return worktrees.find(w => w.path === path);
  };

  const getAppsForWorktree = (worktreeId: string): string[] => {
    return appMappings
      .filter(m => m.worktree_id === worktreeId)
      .map(m => m.app_name!)
      .sort();
  };

  const getPipelinesForWorktree = (worktreeId: string): string[] => {
    return pipelineMappings
      .filter(m => m.worktree_id === worktreeId)
      .map(m => m.pipeline_name!)
      .sort();
  };

  const getWorktreeLabel = (worktree: WorktreeDefinition): string => {
    return `${worktree.emoji} ${worktree.alias_name}`;
  };

  return {
    worktrees,
    appMappings,
    pipelineMappings,
    loading,
    error,
    getWorktreeById,
    getWorktreeByPath,
    getAppsForWorktree,
    getPipelinesForWorktree,
    getWorktreeLabel,
    refetch: fetchData
  };
}