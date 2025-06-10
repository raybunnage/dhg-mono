import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Save } from 'lucide-react';

interface WorktreeDefinition {
  id: string;
  path: string;
  alias_name: string;
  alias_number: string;
  emoji: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface Mapping {
  id: string;
  worktree_id: string;
  app_name?: string;
  pipeline_name?: string;
}

interface ServiceMapping {
  id: string;
  worktree_id: string | null;
  service_id: string | null;
  service_name?: string; // This will be populated from the joined service
}

interface SharedService {
  id: string;
  service_name: string;
  category: string;
  description: string | null;
}

// List of all apps (can be fetched from database if stored there)
const ALL_APPS = [
  'dhg-hub',
  'dhg-hub-lovable',
  'dhg-audio',
  'dhg-admin-suite',
  'dhg-admin-code',
  'dhg-admin-google',
  'dhg-a',
  'dhg-b',
  'dhg-improve-experts',
  'dhg-research'
];

export default function WorktreeMappings() {
  const [worktrees, setWorktrees] = useState<WorktreeDefinition[]>([]);
  const [appMappings, setAppMappings] = useState<Mapping[]>([]);
  const [pipelineMappings, setPipelineMappings] = useState<Mapping[]>([]);
  const [serviceMappings, setServiceMappings] = useState<ServiceMapping[]>([]);
  const [allPipelines, setAllPipelines] = useState<string[]>([]);
  const [allServices, setAllServices] = useState<SharedService[]>([]);
  const [selectedWorktree, setSelectedWorktree] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [pendingAppChanges, setPendingAppChanges] = useState<Map<string, Set<string>>>(new Map());
  const [pendingPipelineChanges, setPendingPipelineChanges] = useState<Map<string, Set<string>>>(new Map());
  const [pendingServiceChanges, setPendingServiceChanges] = useState<Map<string, Set<string>>>(new Map());

  // Load worktrees and mappings
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load worktree definitions
      const { data: worktreeData, error: worktreeError } = await supabase
        .from('worktree_definitions')
        .select('*')
        .order('alias_number');
      
      if (worktreeError) throw worktreeError;
      setWorktrees(worktreeData || []);

      // Load app mappings
      const { data: appData, error: appError } = await supabase
        .from('worktree_app_mappings')
        .select('*');
      
      if (appError) throw appError;
      setAppMappings(appData || []);

      // Load pipeline mappings
      const { data: pipelineData, error: pipelineError } = await supabase
        .from('worktree_pipeline_mappings')
        .select('*');
      
      if (pipelineError) throw pipelineError;
      setPipelineMappings(pipelineData || []);

      // Load all CLI pipelines from command_pipelines table
      const { data: pipelinesData, error: pipelinesError } = await supabase
        .from('command_pipelines')
        .select('name')
        .eq('status', 'active')
        .order('name');
      
      if (pipelinesError) throw pipelinesError;
      setAllPipelines(pipelinesData?.map(p => p.name) || []);

      // Load service mappings with joined service names
      const { data: serviceData, error: serviceError } = await supabase
        .from('worktree_service_mappings')
        .select(`
          id,
          worktree_id,
          service_id,
          shared_services(service_name)
        `);
      
      if (serviceError) throw serviceError;
      
      // Transform the data to include service_name at the top level
      const transformedServiceData = serviceData?.map(item => ({
        id: item.id,
        worktree_id: item.worktree_id,
        service_id: item.service_id,
        service_name: (item as any).shared_services?.service_name
      })) || [];
      
      setServiceMappings(transformedServiceData);

      // Load all shared services
      const { data: servicesData, error: servicesError } = await supabase
        .from('shared_services')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (servicesError) throw servicesError;
      setAllServices(servicesData || []);

      // Select first worktree by default
      if (worktreeData && worktreeData.length > 0 && !selectedWorktree) {
        setSelectedWorktree(worktreeData[0].id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load worktree data');
    } finally {
      setLoading(false);
    }
  };

  const toggleAppMapping = (worktreeId: string, appName: string) => {
    setUnsavedChanges(true);
    
    const changes = new Map(pendingAppChanges);
    if (!changes.has(worktreeId)) {
      changes.set(worktreeId, new Set());
    }
    
    const worktreeChanges = changes.get(worktreeId)!;
    if (worktreeChanges.has(appName)) {
      worktreeChanges.delete(appName);
    } else {
      worktreeChanges.add(appName);
    }
    
    setPendingAppChanges(changes);
  };

  const togglePipelineMapping = (worktreeId: string, pipelineName: string) => {
    setUnsavedChanges(true);
    
    const changes = new Map(pendingPipelineChanges);
    if (!changes.has(worktreeId)) {
      changes.set(worktreeId, new Set());
    }
    
    const worktreeChanges = changes.get(worktreeId)!;
    if (worktreeChanges.has(pipelineName)) {
      worktreeChanges.delete(pipelineName);
    } else {
      worktreeChanges.add(pipelineName);
    }
    
    setPendingPipelineChanges(changes);
  };

  const toggleServiceMapping = (worktreeId: string, serviceName: string) => {
    setUnsavedChanges(true);
    
    const changes = new Map(pendingServiceChanges);
    if (!changes.has(worktreeId)) {
      changes.set(worktreeId, new Set());
    }
    
    const worktreeChanges = changes.get(worktreeId)!;
    if (worktreeChanges.has(serviceName)) {
      worktreeChanges.delete(serviceName);
    } else {
      worktreeChanges.add(serviceName);
    }
    
    setPendingServiceChanges(changes);
  };

  const isAppMapped = (worktreeId: string, appName: string) => {
    const isCurrentlyMapped = appMappings.some(m => m.worktree_id === worktreeId && m.app_name === appName);
    const hasPendingChange = pendingAppChanges.get(worktreeId)?.has(appName) || false;
    return hasPendingChange ? !isCurrentlyMapped : isCurrentlyMapped;
  };

  const isPipelineMapped = (worktreeId: string, pipelineName: string) => {
    const isCurrentlyMapped = pipelineMappings.some(m => m.worktree_id === worktreeId && m.pipeline_name === pipelineName);
    const hasPendingChange = pendingPipelineChanges.get(worktreeId)?.has(pipelineName) || false;
    return hasPendingChange ? !isCurrentlyMapped : isCurrentlyMapped;
  };

  const isServiceMapped = (worktreeId: string, serviceName: string) => {
    const isCurrentlyMapped = serviceMappings.some(m => m.worktree_id === worktreeId && m.service_name === serviceName);
    const hasPendingChange = pendingServiceChanges.get(worktreeId)?.has(serviceName) || false;
    return hasPendingChange ? !isCurrentlyMapped : isCurrentlyMapped;
  };

  const getAppCountForWorktree = (worktreeId: string) => {
    return appMappings.filter(m => m.worktree_id === worktreeId).length;
  };

  const getPipelineCountForWorktree = (worktreeId: string) => {
    return pipelineMappings.filter(m => m.worktree_id === worktreeId).length;
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      setError(null);

      // Process app changes
      for (const [worktreeId, changes] of pendingAppChanges) {
        for (const appName of changes) {
          const existing = appMappings.find(m => m.worktree_id === worktreeId && m.app_name === appName);
          
          console.log(`Processing app ${appName} for worktree ${worktreeId}, existing:`, existing);
          
          if (existing) {
            // Remove mapping
            const { error } = await supabase
              .from('worktree_app_mappings')
              .delete()
              .eq('id', existing.id);
            
            if (error) {
              console.error('Delete error:', error);
              throw error;
            }
          } else {
            // Add mapping
            const { data, error } = await supabase
              .from('worktree_app_mappings')
              .insert({ worktree_id: worktreeId, app_name: appName })
              .select();
            
            if (error) {
              console.error('Insert error:', error);
              throw error;
            }
            console.log('Inserted:', data);
          }
        }
      }

      // Process pipeline changes
      for (const [worktreeId, changes] of pendingPipelineChanges) {
        for (const pipelineName of changes) {
          const existing = pipelineMappings.find(m => m.worktree_id === worktreeId && m.pipeline_name === pipelineName);
          
          if (existing) {
            // Remove mapping
            const { error } = await supabase
              .from('worktree_pipeline_mappings')
              .delete()
              .eq('id', existing.id);
            
            if (error) throw error;
          } else {
            // Add mapping
            const { error } = await supabase
              .from('worktree_pipeline_mappings')
              .insert({ worktree_id: worktreeId, pipeline_name: pipelineName });
            
            if (error) throw error;
          }
        }
      }

      // Process service changes
      for (const [worktreeId, changes] of pendingServiceChanges) {
        for (const serviceName of changes) {
          const existing = serviceMappings.find(m => m.worktree_id === worktreeId && m.service_name === serviceName);
          
          if (existing) {
            // Remove mapping
            const { error } = await supabase
              .from('worktree_service_mappings')
              .delete()
              .eq('id', existing.id);
            
            if (error) throw error;
          } else {
            // Find the service_id for this service_name
            const service = allServices.find(s => s.service_name === serviceName);
            if (!service) {
              console.error(`Service not found: ${serviceName}`);
              continue;
            }
            
            // Add mapping using service_id
            const { error } = await supabase
              .from('worktree_service_mappings')
              .insert({ worktree_id: worktreeId, service_id: service.id });
            
            if (error) throw error;
          }
        }
      }

      // Clear pending changes
      setPendingAppChanges(new Map());
      setPendingPipelineChanges(new Map());
      setPendingServiceChanges(new Map());
      setUnsavedChanges(false);
      
      // Reload data to get fresh state
      await loadData();
      
      setSuccess('All changes saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error saving changes:', err);
      const errorMessage = err?.message || err?.error || 'Failed to save changes';
      setError(`Error: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  const currentWorktree = worktrees.find(w => w.id === selectedWorktree);

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Worktree Mappings</h1>
          <p className="text-gray-600">
            Configure which apps and CLI pipelines belong to each worktree
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Worktree selector and save button */}
        <div className="mb-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <label htmlFor="worktree-select" className="font-medium text-gray-700">
              Select Worktree:
            </label>
            <select
              id="worktree-select"
              value={selectedWorktree}
              onChange={(e) => setSelectedWorktree(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a worktree...</option>
              {worktrees.map(worktree => (
                <option key={worktree.id} value={worktree.id}>
                  {worktree.emoji} {worktree.alias_number}/{worktree.alias_name} - {worktree.path}
                </option>
              ))}
            </select>
          </div>
          
          {unsavedChanges && (
            <div className="flex items-center gap-4">
              <span className="text-amber-600 text-sm">You have unsaved changes</span>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save All Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {currentWorktree && (
          <div className="space-y-8">
            {/* Worktree info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                <span className="text-2xl">{currentWorktree.emoji}</span>
                {currentWorktree.alias_number}/{currentWorktree.alias_name}
              </h2>
              <p className="text-gray-600 mb-2">{currentWorktree.description}</p>
              <p className="text-sm text-gray-500 font-mono">{currentWorktree.path}</p>
            </div>

            {/* Apps section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Applications</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {ALL_APPS.map(app => (
                  <label
                    key={app}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isAppMapped(currentWorktree.id, app)}
                      onChange={() => toggleAppMapping(currentWorktree.id, app)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm">{app}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* CLI Pipelines section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">CLI Pipelines</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {allPipelines.map(pipeline => (
                  <label
                    key={pipeline}
                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isPipelineMapped(currentWorktree.id, pipeline)}
                      onChange={() => togglePipelineMapping(currentWorktree.id, pipeline)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm">cli-{pipeline}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Shared Services section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Shared Services</h3>
              {/* Group services by category */}
              {Object.entries(
                allServices.reduce((acc, service) => {
                  if (!acc[service.category]) acc[service.category] = [];
                  acc[service.category].push(service);
                  return acc;
                }, {} as Record<string, SharedService[]>)
              ).map(([category, services]) => (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">{category}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {services.map(service => (
                      <label
                        key={service.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                        title={service.description || undefined}
                      >
                        <input
                          type="checkbox"
                          checked={isServiceMapped(currentWorktree.id, service.service_name)}
                          onChange={() => toggleServiceMapping(currentWorktree.id, service.service_name)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm">{service.service_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">Summary for {currentWorktree.alias_name}</h4>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Apps:</span>{' '}
                  {appMappings
                    .filter(m => m.worktree_id === currentWorktree.id)
                    .map(m => m.app_name)
                    .join(', ') || 'None'}
                </div>
                <div>
                  <span className="font-medium">Pipelines:</span>{' '}
                  {pipelineMappings
                    .filter(m => m.worktree_id === currentWorktree.id)
                    .map(m => `cli-${m.pipeline_name}`)
                    .join(', ') || 'None'}
                </div>
                <div>
                  <span className="font-medium">Services:</span>{' '}
                  {serviceMappings
                    .filter(m => m.worktree_id === currentWorktree.id)
                    .map(m => m.service_name)
                    .join(', ') || 'None'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}