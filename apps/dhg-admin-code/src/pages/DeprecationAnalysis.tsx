import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';

interface UnusedService {
  id: string;
  service_name: string;
  service_path: string;
  description: string | null;
  category: string | null;
  status: string;
  dependency_count: number;
  is_unused: boolean;
  created_at: string;
  updated_at: string | null;
}

interface UnusedScript {
  id: string;
  file_path: string;
  file_name: string;
  status: string;
  last_run: string | null;
  run_count: number;
  created_at: string;
}

interface LowUsageCommand {
  id: string;
  command_name: string;
  pipeline_name: string;
  total_uses: number;
  last_used: string | null;
  days_since_last_use: number;
  error_rate: number;
}

interface ArchivedScript {
  id: string;
  file_name: string;
  original_path: string;
  archived_path: string;
  archive_reason: string | null;
  archive_date: string;
  last_used: string | null;
  replacement_command: string | null;
  pipeline_name: string | null;
  command_name: string | null;
  file_size_bytes: number | null;
  restored: boolean | null;
}

interface ArchivedCommand {
  id: string;
  command_name: string;
  pipeline_name: string;
  original_file_path: string;
  archived_file_path: string;
  archived_date: string | null;
  last_used_date: string | null;
  usage_count: number | null;
  description: string | null;
}

interface ArchivedPackage {
  id: string;
  package_name: string;
  original_path: string;
  archived_path: string;
  archive_reason: string | null;
  dependencies_count: number | null;
  file_size: number | null;
  file_type: string | null;
  last_modified: string | null;
  created_by: string | null;
}

interface DeprecationCandidate {
  type: 'service' | 'script' | 'command' | 'pipeline';
  name: string;
  path?: string;
  reason: string;
  usage_count: number;
  last_used?: string;
  dependencies?: string[];
  recommendation: 'safe' | 'caution' | 'review';
}

export function DeprecationAnalysis() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'scripts' | 'commands' | 'pipelines' | 'archived-scripts' | 'archived-commands' | 'archived-apps'>('overview');
  const [unusedServices, setUnusedServices] = useState<UnusedService[]>([]);
  const [unusedScripts, setUnusedScripts] = useState<UnusedScript[]>([]);
  const [lowUsageCommands, setLowUsageCommands] = useState<LowUsageCommand[]>([]);
  const [candidates, setCandidates] = useState<DeprecationCandidate[]>([]);
  const [archivedScripts, setArchivedScripts] = useState<ArchivedScript[]>([]);
  const [archivedCommands, setArchivedCommands] = useState<ArchivedCommand[]>([]);
  const [archivedPackages, setArchivedPackages] = useState<ArchivedPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDeprecationData();
  }, []);

  const loadDeprecationData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load unused services from registry_unused_services_view
      const { data: services, error: servicesError } = await supabase
        .from('registry_unused_services_view')
        .select('*')
        .order('service_name');
        
      if (servicesError) {
        console.warn('registry_unused_services_view not available:', servicesError);
        setUnusedServices([]);
      } else {
        setUnusedServices(services || []);
      }
      
      // Load services from registry_services as fallback
      const { data: allServices, error: allServicesError } = await supabase
        .from('registry_services')
        .select('*')
        .order('service_name');
        
      if (allServicesError) {
        console.warn('registry_services not available:', allServicesError);
      }
      
      // Mock unused scripts data for now
      setUnusedScripts([]);
      
      // Mock low usage commands data for now  
      setLowUsageCommands([]);
      
      // Load archived scripts
      const { data: archivedScriptsData, error: archivedScriptsError } = await supabase
        .from('sys_archived_scripts_files')
        .select('*')
        .order('archive_date', { ascending: false });
        
      if (archivedScriptsError) {
        console.warn('sys_archived_scripts_files not available:', archivedScriptsError);
        setArchivedScripts([]);
      } else {
        setArchivedScripts(archivedScriptsData || []);
      }
      
      // Load archived commands
      const { data: archivedCommandsData, error: archivedCommandsError } = await supabase
        .from('sys_archived_cli_pipeline_files')
        .select('*')
        .order('archived_date', { ascending: false });
        
      if (archivedCommandsError) {
        console.warn('sys_archived_cli_pipeline_files not available:', archivedCommandsError);
        setArchivedCommands([]);
      } else {
        setArchivedCommands(archivedCommandsData || []);
      }
      
      // Load archived packages
      const { data: archivedPackagesData, error: archivedPackagesError } = await supabase
        .from('sys_archived_package_files')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (archivedPackagesError) {
        console.warn('sys_archived_package_files not available:', archivedPackagesError);
        setArchivedPackages([]);
      } else {
        setArchivedPackages(archivedPackagesData || []);
      }

      // Build deprecation candidates from available data
      buildCandidates(services || [], [], []);
      
    } catch (err) {
      console.error('Error loading deprecation data:', err);
      setError('Failed to load deprecation analysis data. Some features may not be available yet.');
    } finally {
      setLoading(false);
    }
  };
  
  const buildCandidates = (
    services: UnusedService[], 
    scripts: UnusedScript[], 
    commands: LowUsageCommand[]
  ) => {
    const allCandidates: DeprecationCandidate[] = [];
    
    // Add unused services
    services.forEach(service => {
      allCandidates.push({
        type: 'service',
        name: service.service_name,
        path: service.service_path,
        reason: 'No dependencies found',
        usage_count: 0,
        recommendation: service.category === 'utility' ? 'review' : 'safe'
      });
    });
    
    // Add unused scripts
    scripts.forEach(script => {
      const daysSinceRun = script.last_run 
        ? Math.floor((Date.now() - new Date(script.last_run).getTime()) / (24 * 60 * 60 * 1000))
        : 999;
        
      allCandidates.push({
        type: 'script',
        name: script.file_name,
        path: script.file_path,
        reason: script.last_run ? `Not run in ${daysSinceRun} days` : 'Never run',
        usage_count: script.run_count || 0,
        last_used: script.last_run,
        recommendation: script.run_count > 10 ? 'caution' : 'safe'
      });
    });
    
    // Add low usage commands
    commands.forEach(cmd => {
      if (cmd.total_uses < 3 && cmd.days_since_last_use > 30) {
        allCandidates.push({
          type: 'command',
          name: cmd.command_name,
          path: cmd.pipeline_name,
          reason: `Only ${cmd.total_uses} uses in 90 days`,
          usage_count: cmd.total_uses,
          last_used: cmd.last_used,
          recommendation: cmd.error_rate > 0.5 ? 'safe' : 'review'
        });
      }
    });
    
    setCandidates(allCandidates);
  };
  
  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };
  
  const handleSelectAll = () => {
    if (selectedItems.size === candidates.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(candidates.map((_, idx) => `candidate-${idx}`)));
    }
  };
  
  const exportDeprecationPlan = () => {
    const selected = candidates.filter((_, idx) => selectedItems.has(`candidate-${idx}`));
    const plan = {
      generated_at: new Date().toISOString(),
      total_items: selected.length,
      by_type: {
        services: selected.filter(c => c.type === 'service').length,
        scripts: selected.filter(c => c.type === 'script').length,
        commands: selected.filter(c => c.type === 'command').length,
        pipelines: selected.filter(c => c.type === 'pipeline').length
      },
      items: selected
    };
    
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deprecation-plan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };
  
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-gray-900">{unusedServices.length}</div>
          <div className="text-sm text-gray-600 mt-1">Unused Services</div>
          <div className="text-xs text-gray-500 mt-2">No dependencies detected</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-gray-900">{unusedScripts.length}</div>
          <div className="text-sm text-gray-600 mt-1">Inactive Scripts</div>
          <div className="text-xs text-gray-500 mt-2">Not run in 90+ days</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-gray-900">{lowUsageCommands.length}</div>
          <div className="text-sm text-gray-600 mt-1">Low Usage Commands</div>
          <div className="text-xs text-gray-500 mt-2">Under 5 uses in 90 days</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-3xl font-bold text-gray-900">{candidates.length}</div>
          <div className="text-sm text-gray-600 mt-1">Total Candidates</div>
          <div className="text-xs text-gray-500 mt-2">For deprecation review</div>
        </div>
      </div>

      {/* Archived Items Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-6 rounded-lg shadow-sm border border-blue-200">
          <div className="text-3xl font-bold text-blue-900">{archivedScripts.length}</div>
          <div className="text-sm text-blue-700 mt-1">Archived Scripts</div>
          <div className="text-xs text-blue-600 mt-2">Previously deprecated files</div>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-200">
          <div className="text-3xl font-bold text-purple-900">{archivedCommands.length}</div>
          <div className="text-sm text-purple-700 mt-1">Archived Commands</div>
          <div className="text-xs text-purple-600 mt-2">CLI commands removed</div>
        </div>
        
        <div className="bg-green-50 p-6 rounded-lg shadow-sm border border-green-200">
          <div className="text-3xl font-bold text-green-900">{archivedPackages.length}</div>
          <div className="text-sm text-green-700 mt-1">Archived Apps</div>
          <div className="text-xs text-green-600 mt-2">Packages/apps archived</div>
        </div>
      </div>
      
      {/* Recommendations by Category */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Deprecation Candidates</h3>
          <p className="text-sm text-gray-600 mt-1">
            Items identified as potential deprecation candidates based on usage patterns
          </p>
        </div>
        
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedItems.size === candidates.length && candidates.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
                Select All ({candidates.length})
              </label>
              
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  Safe: {candidates.filter(c => c.recommendation === 'safe').length}
                </span>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">
                  Caution: {candidates.filter(c => c.recommendation === 'caution').length}
                </span>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                  Review: {candidates.filter(c => c.recommendation === 'review').length}
                </span>
              </div>
            </div>
            
            <button
              onClick={exportDeprecationPlan}
              disabled={selectedItems.size === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Export Plan ({selectedItems.size})
            </button>
          </div>
          
          {candidates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-2">No deprecation candidates found</div>
              <div className="text-sm text-gray-400">
                This could mean:
                <ul className="text-left inline-block mt-2">
                  <li>• All services are being used</li>
                  <li>• Database views need to be populated</li>
                  <li>• Analysis system is still initializing</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <input type="checkbox" className="sr-only" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Used
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recommendation
                    </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidates.map((candidate, idx) => (
                  <tr key={`candidate-${idx}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedItems.has(`candidate-${idx}`)}
                        onChange={() => handleSelectItem(`candidate-${idx}`)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        candidate.type === 'service' ? 'bg-blue-100 text-blue-700' :
                        candidate.type === 'script' ? 'bg-purple-100 text-purple-700' :
                        candidate.type === 'command' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {candidate.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{candidate.name}</div>
                      {candidate.path && (
                        <div className="text-xs text-gray-500">{candidate.path}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {candidate.reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {candidate.usage_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {candidate.last_used 
                        ? new Date(candidate.last_used).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        candidate.recommendation === 'safe' ? 'bg-green-100 text-green-700' :
                        candidate.recommendation === 'caution' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {candidate.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  );
  
  const renderServices = () => (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Unused Services</h3>
        <p className="text-sm text-gray-600 mt-1">
          Services with no detected dependencies in applications or pipelines
        </p>
      </div>
      
      {unusedServices.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">No unused services found</div>
          <div className="text-sm text-gray-400">
            All registered services appear to have dependencies or are actively used.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unusedServices.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{service.service_name}</div>
                    <div className="text-xs text-gray-500">{service.service_path}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                      {service.category || 'uncategorized'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {service.description || 'No description'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(service.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="text-red-600 hover:text-red-800 text-sm">
                      Mark for deprecation
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
  
  const renderScripts = () => (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Inactive Scripts</h3>
        <p className="text-sm text-gray-600 mt-1">
          Scripts that haven't been run recently or have low usage
        </p>
      </div>
      
      {unusedScripts.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">No inactive scripts found</div>
          <div className="text-sm text-gray-400">
            Scripts registry is not populated yet or all scripts are actively used.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Script
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Path
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Run
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Run Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unusedScripts.map((script) => (
                <tr key={script.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{script.file_name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {script.file_path}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {script.last_run 
                      ? new Date(script.last_run).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {script.run_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      script.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {script.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderArchivedScripts = () => (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Archived Scripts</h3>
        <p className="text-sm text-gray-600 mt-1">
          Scripts that have been archived and are no longer actively maintained
        </p>
      </div>
      
      {archivedScripts.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">No archived scripts found</div>
          <div className="text-sm text-gray-400">
            No scripts have been archived yet.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original Path
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archive Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archive Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Replacement
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archivedScripts.map((script) => (
                <tr key={script.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{script.file_name}</div>
                    {script.command_name && (
                      <div className="text-xs text-gray-500">Command: {script.command_name}</div>
                    )}
                    {script.pipeline_name && (
                      <div className="text-xs text-gray-500">Pipeline: {script.pipeline_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="max-w-xs truncate" title={script.original_path}>
                      {script.original_path}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {script.archive_reason || 'No reason provided'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(script.archive_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {script.replacement_command ? (
                      <div className="max-w-xs truncate" title={script.replacement_command}>
                        <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                          {script.replacement_command}
                        </code>
                      </div>
                    ) : (
                      'None'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      script.restored ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {script.restored ? 'Restored' : 'Archived'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderArchivedCommands = () => (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Archived CLI Commands</h3>
        <p className="text-sm text-gray-600 mt-1">
          CLI pipeline commands that have been archived
        </p>
      </div>
      
      {archivedCommands.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">No archived commands found</div>
          <div className="text-sm text-gray-400">
            No CLI commands have been archived yet.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Command
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pipeline
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original Path
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archived
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archivedCommands.map((command) => (
                <tr key={command.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{command.command_name}</div>
                    {command.description && (
                      <div className="text-xs text-gray-500 max-w-xs truncate" title={command.description}>
                        {command.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {command.pipeline_name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="max-w-xs truncate" title={command.original_file_path}>
                      {command.original_file_path}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {command.usage_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {command.last_used_date 
                      ? new Date(command.last_used_date).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {command.archived_date 
                      ? new Date(command.archived_date).toLocaleDateString()
                      : 'Unknown'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderArchivedApps = () => (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Archived Apps/Packages</h3>
        <p className="text-sm text-gray-600 mt-1">
          Applications and packages that have been archived
        </p>
      </div>
      
      {archivedPackages.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-2">No archived packages found</div>
          <div className="text-sm text-gray-400">
            No packages or apps have been archived yet.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Package Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original Path
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Archive Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dependencies
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Modified
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {archivedPackages.map((pkg) => (
                <tr key={pkg.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{pkg.package_name}</div>
                    {pkg.file_type && (
                      <div className="text-xs text-gray-500">Type: {pkg.file_type}</div>
                    )}
                    {pkg.created_by && (
                      <div className="text-xs text-gray-500">By: {pkg.created_by}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="max-w-xs truncate" title={pkg.original_path}>
                      {pkg.original_path}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {pkg.archive_reason || 'No reason provided'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {pkg.dependencies_count !== null ? (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                        {pkg.dependencies_count} deps
                      </span>
                    ) : (
                      'Unknown'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {pkg.file_size !== null ? (
                      `${(pkg.file_size / 1024).toFixed(1)} KB`
                    ) : (
                      'Unknown'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {pkg.last_modified 
                      ? new Date(pkg.last_modified).toLocaleDateString()
                      : 'Unknown'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
  
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Deprecation Analysis</h1>
          <p className="text-gray-600">
            Identify unused code, services, and commands for potential deprecation
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6 flex-wrap">
            {(['overview', 'services', 'scripts', 'commands', 'pipelines', 'archived-scripts', 'archived-commands', 'archived-apps'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'archived-scripts' ? 'Archived Scripts' :
                 tab === 'archived-commands' ? 'Archived Commands' :
                 tab === 'archived-apps' ? 'Archived Apps' :
                 tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'archived-scripts' && archivedScripts.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                    {archivedScripts.length}
                  </span>
                )}
                {tab === 'archived-commands' && archivedCommands.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                    {archivedCommands.length}
                  </span>
                )}
                {tab === 'archived-apps' && archivedPackages.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs">
                    {archivedPackages.length}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-600">Loading deprecation analysis...</div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'services' && renderServices()}
            {activeTab === 'scripts' && renderScripts()}
            {activeTab === 'commands' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-600">Command usage analysis coming soon...</p>
              </div>
            )}
            {activeTab === 'pipelines' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-600">Pipeline analysis coming soon...</p>
              </div>
            )}
            {activeTab === 'archived-scripts' && renderArchivedScripts()}
            {activeTab === 'archived-commands' && renderArchivedCommands()}
            {activeTab === 'archived-apps' && renderArchivedApps()}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}