import React, { useState, useEffect } from 'react';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';
import { DashboardLayout } from '../components/DashboardLayout';
import { MaintenancePanel } from '../components/MaintenancePanel';
import type { MaintenanceStats, MaintenanceAction } from '../components/MaintenancePanel';
import { serverRegistry } from '@shared/services/server-registry-service';
import { ServerStatusIndicator } from '../components/ServerStatusIndicator';

// Create supabase client with environment variables
const supabase = createSupabaseAdapter({ env: import.meta.env as any });

interface Script {
  id: string;
  file_path: string;
  title: string;
  summary?: string;
  language: string;
  ai_generated_tags?: string[];
  manual_tags?: string[];
  last_modified_at: string;
  last_indexed_at?: string;
  file_hash: string;
  metadata?: {
    cli_pipeline?: string;
    file_size?: number;
    is_archived?: boolean;
  };
  document_type_id?: string;
  ai_assessment?: {
    classification?: string;
    confidence?: number;
    purpose?: string;
    dependencies?: string[];
  };
  created_at: string;
  updated_at: string;
}

interface PipelineGroup {
  name: string;
  scripts: Script[];
  isExpanded: boolean;
}

export function ScriptsManagement() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [pipelineGroups, setPipelineGroups] = useState<PipelineGroup[]>([]);
  const [runningCommand, setRunningCommand] = useState<string | null>(null);
  const [commandStatus, setCommandStatus] = useState<string>('');

  // Extract pipeline from file path
  const extractPipelineFromPath = (filePath: string): string => {
    const match = filePath.match(/scripts\/cli-pipeline\/([^/]+)\//);
    return match ? match[1] : 'root';
  };

  // Format file size
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'unknown';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status indicator
  const getStatusIndicator = (script: Script): { icon: string; color: string; tooltip: string } => {
    const isArchived = script.metadata?.is_archived;
    const hasClassification = !!script.document_type_id;
    const confidence = script.ai_assessment?.confidence || 0;

    if (isArchived) {
      return { icon: '📦', color: 'text-gray-500', tooltip: 'Archived' };
    }
    if (!hasClassification) {
      return { icon: '❓', color: 'text-yellow-600', tooltip: 'Unclassified' };
    }
    if (confidence >= 0.8) {
      return { icon: '✅', color: 'text-green-600', tooltip: 'High confidence classification' };
    }
    if (confidence >= 0.6) {
      return { icon: '⚠️', color: 'text-yellow-600', tooltip: 'Medium confidence classification' };
    }
    return { icon: '❌', color: 'text-red-600', tooltip: 'Low confidence classification' };
  };

  // Run CLI command via API
  const runCliCommand = async (command: string, args: string[] = []) => {
    setRunningCommand(command);
    setCommandStatus(`Running ${command}...`);

    try {
      const gitApiUrl = await serverRegistry.getServerUrl('git-api-server');
      const response = await fetch(`${gitApiUrl}/api/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: './scripts/cli-pipeline/scripts/scripts-cli.sh',
          args: [command, ...args]
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setCommandStatus(`${command} completed successfully`);
        if (command === 'sync') {
          // Refresh scripts after sync - trigger a reload
          window.location.reload();
        }
      } else {
        setCommandStatus(`${command} failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error running command:', error);
      setCommandStatus('Failed to run command - is the API server running?');
    } finally {
      setRunningCommand(null);
      // Clear status after 5 seconds
      setTimeout(() => setCommandStatus(''), 5000);
    }
  };

  // Handle specific command buttons
  const handleSyncScripts = () => runCliCommand('sync');
  const handleHealthCheck = () => runCliCommand('health-check');
  const handleRunAnalysis = () => runCliCommand('stats');

  // Load scripts
  useEffect(() => {
    async function loadScripts() {
      try {
        setLoading(true);

        let query = supabase
          .from('registry_scripts')
          .select('*')
          .order('last_modified_at', { ascending: false });

        // Apply filters
        if (!showArchived) {
          query = query.or('metadata->>is_archived.is.null,metadata->>is_archived.neq.true');
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          throw fetchError;
        }

        setScripts(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scripts');
      } finally {
        setLoading(false);
      }
    }

    loadScripts();
  }, [showArchived]);

  // Filter and group scripts
  useEffect(() => {
    let filteredScripts = scripts;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredScripts = filteredScripts.filter(script =>
        script.title?.toLowerCase().includes(term) ||
        script.file_path.toLowerCase().includes(term) ||
        script.summary?.toLowerCase().includes(term) ||
        script.ai_assessment?.purpose?.toLowerCase().includes(term) ||
        script.ai_generated_tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Apply pipeline filter
    if (selectedPipeline !== 'all') {
      filteredScripts = filteredScripts.filter(script => {
        const pipeline = script.metadata?.cli_pipeline || extractPipelineFromPath(script.file_path);
        return pipeline === selectedPipeline;
      });
    }

    // Apply language filter
    if (selectedLanguage !== 'all') {
      filteredScripts = filteredScripts.filter(script => script.language === selectedLanguage);
    }

    // Group by pipeline
    const groups = filteredScripts.reduce((acc, script) => {
      const pipeline = script.metadata?.cli_pipeline || extractPipelineFromPath(script.file_path);
      const existingGroup = acc.find(g => g.name === pipeline);
      
      if (existingGroup) {
        existingGroup.scripts.push(script);
      } else {
        acc.push({
          name: pipeline,
          scripts: [script],
          isExpanded: true
        });
      }
      
      return acc;
    }, [] as PipelineGroup[]);

    // Sort groups by name
    groups.sort((a, b) => a.name.localeCompare(b.name));
    
    // Sort scripts within each group by last_modified_at
    groups.forEach(group => {
      group.scripts.sort((a, b) => 
        new Date(b.last_modified_at).getTime() - new Date(a.last_modified_at).getTime()
      );
    });

    setPipelineGroups(groups);
  }, [scripts, searchTerm, selectedPipeline, selectedLanguage]);

  // Get unique pipelines and languages for filters
  const uniquePipelines = Array.from(new Set(scripts.map(script => 
    script.metadata?.cli_pipeline || extractPipelineFromPath(script.file_path)
  ))).sort();

  const uniqueLanguages = Array.from(new Set(scripts.map(script => script.language))).sort();

  // Toggle pipeline expansion
  const togglePipelineExpansion = (pipelineName: string) => {
    setPipelineGroups(groups => 
      groups.map(group => 
        group.name === pipelineName 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Scripts Management</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading scripts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Scripts Management</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading scripts</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalScripts = scripts.length;
  const classifiedScripts = scripts.filter(s => s.document_type_id).length;
  const archivedScripts = scripts.filter(s => s.metadata?.is_archived).length;

  // Calculate maintenance statistics
  const maintenanceStats: MaintenanceStats = {
    totalItems: scripts.length,
    lastUsed30Days: scripts.filter(s => {
      const lastModified = new Date(s.last_modified_at);
      const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 30;
    }).length,
    lastUsed90Days: scripts.filter(s => {
      const lastModified = new Date(s.last_modified_at);
      const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    }).length,
    neverUsed: scripts.filter(s => !s.last_indexed_at).length,
    duplicates: 0, // TODO: Implement duplicate detection
    outdated: scripts.filter(s => {
      const lastModified = new Date(s.last_modified_at);
      const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 180; // 6 months
    }).length,
    oversized: scripts.filter(s => (s.metadata?.file_size || 0) > 100000).length, // > 100KB
    archived: archivedScripts
  };

  const runMaintenanceAnalysis = async (): Promise<MaintenanceAction[]> => {
    // Simulate AI analysis - in real implementation, this would call a CLI command
    const actions: MaintenanceAction[] = [];
    
    scripts.forEach(script => {
      const lastModified = new Date(script.last_modified_at);
      const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);
      
      // Check for scripts not used in 90+ days
      if (daysSince > 90 && !script.metadata?.is_archived) {
        actions.push({
          id: `archive-${script.id}`,
          type: 'archive',
          itemId: script.id,
          itemPath: script.file_path,
          reason: `Not modified in ${Math.round(daysSince)} days`,
          confidence: daysSince > 180 ? 0.9 : 0.7
        });
      }
      
      // Check for oversized scripts
      if ((script.metadata?.file_size || 0) > 100000) {
        actions.push({
          id: `review-${script.id}`,
          type: 'review',
          itemId: script.id,
          itemPath: script.file_path,
          reason: `Large file size (${Math.round((script.metadata?.file_size || 0) / 1024)}KB) - consider refactoring`,
          confidence: 0.8
        });
      }
    });
    
    return actions;
  };

  const executeMaintenanceAction = async (action: MaintenanceAction) => {
    // In real implementation, this would call CLI commands
    console.log('Executing action:', action);
    
    if (action.type === 'archive') {
      // Call: ./scripts/cli-pipeline/scripts/scripts-cli.sh archive <file>
      await supabase
        .from('scripts_registry')
        .update({ 
          metadata: { 
            ...scripts.find(s => s.id === action.itemId)?.metadata,
            is_archived: true 
          } 
        })
        .eq('id', action.itemId);
    }
  };

  const bulkArchiveScripts = async (scriptIds: string[]) => {
    // In real implementation, this would batch process through CLI
    console.log('Bulk archiving scripts:', scriptIds);
    
    for (const id of scriptIds) {
      await supabase
        .from('scripts_registry')
        .update({ 
          metadata: { 
            ...scripts.find(s => s.id === id)?.metadata,
            is_archived: true 
          } 
        })
        .eq('id', id);
    }
    
    // Refresh the scripts list
    loadScripts();
  };

  return (
    <DashboardLayout>
      <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Scripts Management</h1>
          <ServerStatusIndicator serviceName="git-api-server" showLabel={false} />
        </div>
        
        <div className="flex space-x-4">
          <button 
            onClick={handleSyncScripts}
            disabled={runningCommand === 'sync'}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
          >
            {runningCommand === 'sync' ? 'Syncing...' : 'Sync Scripts'}
          </button>
          <button 
            onClick={handleHealthCheck}
            disabled={runningCommand === 'health-check'}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-green-400 transition-colors"
          >
            {runningCommand === 'health-check' ? 'Checking...' : 'Run Health Check'}
          </button>
          <button 
            onClick={handleRunAnalysis}
            disabled={runningCommand === 'stats'}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:bg-purple-400 transition-colors"
          >
            {runningCommand === 'stats' ? 'Analyzing...' : 'Run Analysis'}
          </button>
        </div>
      </div>

      {/* Command Status */}
      {commandStatus && (
        <div className={`mb-6 px-4 py-2 rounded-md text-sm ${
          commandStatus.includes('failed') || commandStatus.includes('Failed') 
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {commandStatus}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Total Scripts</h3>
          <p className="text-3xl font-bold text-blue-600">{totalScripts}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Classified</h3>
          <p className="text-3xl font-bold text-green-600">
            {classifiedScripts} 
            <span className="text-sm text-gray-500 ml-2">
              ({totalScripts > 0 ? ((classifiedScripts / totalScripts) * 100).toFixed(1) : 0}%)
            </span>
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Pipelines</h3>
          <p className="text-3xl font-bold text-purple-600">{uniquePipelines.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Archived</h3>
          <p className="text-3xl font-bold text-gray-600">{archivedScripts}</p>
        </div>
      </div>

      {/* Maintenance Panel */}
      <MaintenancePanel
        type="scripts"
        stats={maintenanceStats}
        onRunAnalysis={runMaintenanceAnalysis}
        onExecuteAction={executeMaintenanceAction}
        onBulkArchive={bulkArchiveScripts}
      />

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Scripts
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, path, or description..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pipeline Filter */}
          <div>
            <label htmlFor="pipeline" className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline
            </label>
            <select
              id="pipeline"
              value={selectedPipeline}
              onChange={(e) => setSelectedPipeline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Pipelines</option>
              {uniquePipelines.map(pipeline => (
                <option key={pipeline} value={pipeline}>{pipeline}</option>
              ))}
            </select>
          </div>

          {/* Language Filter */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              id="language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Languages</option>
              {uniqueLanguages.map(language => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
          </div>

          {/* Show Archived */}
          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Show Archived</span>
            </label>
          </div>
        </div>
      </div>

      {/* Scripts List */}
      <div className="space-y-6">
        {pipelineGroups.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg">No scripts found matching your criteria</div>
            <p className="text-gray-400 mt-2">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          pipelineGroups.map(group => (
            <div key={group.name} className="bg-white rounded-lg border border-gray-200">
              {/* Pipeline Header */}
              <div 
                className="flex items-center justify-between p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50"
                onClick={() => togglePipelineExpansion(group.name)}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">
                    {group.isExpanded ? '📁' : '📂'}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {group.name}/ ({group.scripts.length} scripts)
                  </h3>
                </div>
                <span className="text-gray-400">
                  {group.isExpanded ? '▼' : '▶'}
                </span>
              </div>

              {/* Scripts in Pipeline */}
              {group.isExpanded && (
                <div className="divide-y divide-gray-100">
                  {group.scripts.map(script => {
                    const status = getStatusIndicator(script);
                    return (
                      <div key={script.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {/* Script Header */}
                            <div className="flex items-center space-x-2 mb-2">
                              <span 
                                className={`text-lg ${status.color}`} 
                                title={status.tooltip}
                              >
                                {status.icon}
                              </span>
                              <h4 className="text-lg font-medium text-gray-900 truncate">
                                {script.title || script.file_path.split('/').pop()}
                              </h4>
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                {script.language}
                              </span>
                            </div>

                            {/* File Path */}
                            <div className="text-sm text-gray-600 mb-2">
                              📄 {script.file_path}
                            </div>

                            {/* Purpose/Description */}
                            {script.ai_assessment?.purpose && (
                              <div className="text-sm text-gray-700 mb-2">
                                {script.ai_assessment.purpose}
                              </div>
                            )}

                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                              <span>Size: {formatFileSize(script.metadata?.file_size)}</span>
                              <span>Modified: {formatDate(script.last_modified_at)}</span>
                              {script.ai_assessment?.confidence && (
                                <span>
                                  Confidence: {(script.ai_assessment.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>

                            {/* Tags */}
                            {script.ai_generated_tags && script.ai_generated_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {script.ai_generated_tags.map(tag => (
                                  <span 
                                    key={tag}
                                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex space-x-2 ml-4">
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                              👁️
                            </button>
                            <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded">
                              ▶️
                            </button>
                            <button className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded">
                              ✏️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}