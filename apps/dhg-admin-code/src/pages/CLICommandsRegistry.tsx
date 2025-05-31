import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { CLIRegistryService } from '@shared/services/cli-registry-service';
import { DashboardLayout } from '../components/DashboardLayout';
import type { 
  CommandPipeline, 
  CommandDefinition, 
  CommandCategory,
  PipelineStatistics 
} from '@shared/services/cli-registry-service';

interface PipelineTableData {
  id: string;
  pipeline_id: string;
  table_name: string;
  operation_type: string | null;
  description?: string;
  created_at: string | null;
}

interface RawPipelineData {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  category_id?: string;
  script_path: string;
  status: 'active' | 'deprecated' | 'maintenance';
  documentation_url?: string;
  last_scanned_at?: string;
  created_at: string;
  updated_at: string;
}

export const CLICommandsRegistry: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CommandCategory[]>([]);
  const [pipelines, setPipelines] = useState<CommandPipeline[]>([]);
  const [rawPipelines, setRawPipelines] = useState<RawPipelineData[]>([]);
  const [pipelineTables, setPipelineTables] = useState<PipelineTableData[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<CommandPipeline | null>(null);
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [statistics, setStatistics] = useState<PipelineStatistics[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pipelines' | 'commands' | 'statistics' | 'raw-data'>('pipelines');

  const registryService = new CLIRegistryService(supabase);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel, including raw table data
      const [categoriesData, pipelinesData, statsData, rawPipelinesData, pipelineTablesData] = await Promise.all([
        registryService.getCategories().catch(() => []),
        registryService.getPipelines().catch(() => []),
        registryService.getPipelineStatistics().catch(() => []),
        // Load raw data directly from tables
        supabase.from('command_pipelines').select('*').order('display_name'),
        supabase.from('command_pipeline_tables').select('*').order('table_name')
      ]);
      
      setCategories(categoriesData);
      setPipelines(pipelinesData);
      setStatistics(statsData);
      
      // Set raw data
      if (rawPipelinesData.data) {
        setRawPipelines(rawPipelinesData.data);
      }
      if (pipelineTablesData.data) {
        setPipelineTables(pipelineTablesData.data);
      }
      
      console.log('Loaded data:', {
        categories: categoriesData.length,
        pipelines: pipelinesData.length,
        rawPipelines: rawPipelinesData.data?.length || 0,
        pipelineTables: pipelineTablesData.data?.length || 0
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPipelineCommands = async (pipeline: CommandPipeline) => {
    try {
      setSelectedPipeline(pipeline);
      const commandsData = await registryService.getCommandsForPipeline(pipeline.id);
      setCommands(commandsData);
      setActiveTab('commands');
    } catch (error) {
      console.error('Error loading commands:', error);
    }
  };

  const filteredPipelines = pipelines.filter(pipeline => {
    const matchesSearch = searchTerm === '' || 
      pipeline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || pipeline.category_id === selectedCategory;
    const matchesStatus = selectedStatus === '' || pipeline.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredRawPipelines = rawPipelines.filter(pipeline => {
    const matchesSearch = searchTerm === '' || 
      pipeline.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === '' || pipeline.category_id === selectedCategory;
    const matchesStatus = selectedStatus === '' || pipeline.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getTablesForPipeline = (pipelineId: string) => {
    return pipelineTables.filter(table => table.pipeline_id === pipelineId);
  };

  const getCategoryColor = (category?: CommandCategory) => {
    return category?.color || '#6B7280';
  };

  const getCategoryIcon = (category?: CommandCategory) => {
    const icons: { [key: string]: string } = {
      sync: '🔄',
      document: '📄',
      database: '🗄️',
      shield: '🛡️',
      chart: '📊',
      code: '💻',
      video: '🎥',
      brain: '🧠'
    };
    return icons[category?.icon || ''] || '📦';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      deprecated: 'bg-red-100 text-red-800',
      maintenance: 'bg-yellow-100 text-yellow-800'
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
            <p className="text-gray-700">You need admin privileges to access this area.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-900 mb-2">CLI Commands Registry</h1>
          <p className="text-green-700">Manage and view CLI pipeline commands and configurations</p>
        </div>
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search pipelines or commands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          
          <div className="flex gap-4">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {getCategoryIcon(cat)} {cat.name}
                </option>
              ))}
            </select>
            
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="active">✅ Active</option>
              <option value="deprecated">❌ Deprecated</option>
              <option value="maintenance">🔧 Maintenance</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-green-200">
          <nav className="-mb-px flex gap-8">
            <button
              onClick={() => setActiveTab('pipelines')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pipelines'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pipelines ({pipelines.length})
            </button>
            <button
              onClick={() => setActiveTab('commands')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'commands'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Commands {selectedPipeline && `(${commands.length})`}
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statistics'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab('raw-data')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'raw-data'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Raw Data ({rawPipelines.length} pipelines, {pipelineTables.length} tables)
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <>
            {/* Pipelines Tab */}
            {activeTab === 'pipelines' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPipelines.map(pipeline => (
                  <div
                    key={pipeline.id}
                    onClick={() => loadPipelineCommands(pipeline)}
                    className="bg-white p-6 rounded-lg shadow-sm border border-green-200 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getCategoryIcon(pipeline.category)}</span>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {pipeline.display_name}
                        </h3>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(pipeline.status)}`}>
                        {pipeline.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{pipeline.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>📂 {pipeline.name}</span>
                      {pipeline.category && (
                        <span
                          className="px-2 py-1 rounded"
                          style={{ 
                            backgroundColor: `${getCategoryColor(pipeline.category)}20`,
                            color: getCategoryColor(pipeline.category)
                          }}
                        >
                          {pipeline.category.name}
                        </span>
                      )}
                    </div>
                    {pipeline.last_scanned_at && (
                      <div className="mt-2 text-xs text-gray-400">
                        Last scanned: {new Date(pipeline.last_scanned_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Commands Tab */}
            {activeTab === 'commands' && selectedPipeline && (
              <div>
                <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-green-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedPipeline.display_name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{selectedPipeline.description}</p>
                  <div className="text-xs text-gray-500 font-mono bg-green-50 p-2 rounded">
                    {selectedPipeline.script_path}
                  </div>
                </div>

                <div className="space-y-4">
                  {commands.length > 0 ? (
                    commands
                      .filter(command => !command.is_hidden)
                      .map(command => (
                      <div
                        key={command.id}
                        className={`bg-white p-4 rounded-lg shadow-sm border ${
                          command.status === 'deprecated' ? 'border-red-200 opacity-75' : 'border-green-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="text-md font-semibold text-gray-900 font-mono">
                                {command.command_name}
                              </h4>
                              {command.status && command.status !== 'active' && (
                                <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadge(command.status)}`}>
                                  {command.status}
                                </span>
                              )}
                            </div>
                            {command.description && (
                              <p className="text-sm text-gray-600 mt-1">{command.description}</p>
                            )}
                            {command.usage_pattern && (
                              <div className="mt-2 text-xs text-gray-500 font-mono bg-green-50 p-2 rounded">
                                Usage: {command.usage_pattern}
                              </div>
                            )}
                            {command.example_usage && (
                              <div className="mt-2 text-xs text-gray-500 font-mono bg-green-50 p-2 rounded">
                                Example: {command.example_usage}
                              </div>
                            )}
                            {command.deprecated_at && (
                              <div className="mt-2 text-xs text-red-600">
                                Deprecated: {new Date(command.deprecated_at).toLocaleDateString()}
                              </div>
                            )}
                            {command.last_verified_at && (
                              <div className="mt-1 text-xs text-gray-400">
                                Last verified: {new Date(command.last_verified_at).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            {command.requires_auth && (
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                Auth
                              </span>
                            )}
                            {command.requires_google_api && (
                              <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
                                Google API
                              </span>
                            )}
                            {command.is_dangerous && (
                              <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
                                ⚠️ Dangerous
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No commands found for this pipeline
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'statistics' && (
              <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Pipeline
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Active Commands
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Deprecated
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Tables Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Executions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Last Used
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-green-100">
                    {statistics.map((stat: any) => (
                      <tr key={stat.pipeline_id} className="hover:bg-green-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stat.pipeline_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.active_commands || stat.total_commands}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.deprecated_commands || 0}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.tables_accessed}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_executions}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.last_used ? new Date(stat.last_used).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Raw Data Tab */}
            {activeTab === 'raw-data' && (
              <div className="space-y-8">
                {/* Raw Pipelines */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Command Pipelines Table ({filteredRawPipelines.length})</h3>
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Display Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Script Path</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Tables</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Last Scanned</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {filteredRawPipelines.map((pipeline) => {
                            const tables = getTablesForPipeline(pipeline.id);
                            return (
                              <tr key={pipeline.id} className="hover:bg-green-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{pipeline.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{pipeline.display_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(pipeline.status)}`}>
                                    {pipeline.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-gray-600">{pipeline.script_path}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {tables.length > 0 ? `${tables.length} tables` : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {pipeline.last_scanned_at ? new Date(pipeline.last_scanned_at).toLocaleDateString() : 'Never'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Pipeline Tables */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Command Pipeline Tables ({pipelineTables.length})</h3>
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Table Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Pipeline</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Access Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">Description</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-green-100">
                          {pipelineTables.map((table) => {
                            const pipeline = rawPipelines.find(p => p.id === table.pipeline_id);
                            return (
                              <tr key={table.id} className="hover:bg-green-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{table.table_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {pipeline?.display_name || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    table.operation_type === 'read' ? 'bg-blue-100 text-blue-800' :
                                    table.operation_type === 'write' ? 'bg-yellow-100 text-yellow-800' :
                                    table.operation_type === 'both' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {table.operation_type || 'unknown'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{table.description || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};