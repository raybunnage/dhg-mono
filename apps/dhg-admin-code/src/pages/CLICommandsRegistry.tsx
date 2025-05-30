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

export const CLICommandsRegistry: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CommandCategory[]>([]);
  const [pipelines, setPipelines] = useState<CommandPipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<CommandPipeline | null>(null);
  const [commands, setCommands] = useState<CommandDefinition[]>([]);
  const [statistics, setStatistics] = useState<PipelineStatistics[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pipelines' | 'commands' | 'statistics'>('pipelines');

  const registryService = new CLIRegistryService(supabase);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [categoriesData, pipelinesData, statsData] = await Promise.all([
        registryService.getCategories(),
        registryService.getPipelines(),
        registryService.getPipelineStatistics()
      ]);
      
      setCategories(categoriesData);
      setPipelines(pipelinesData);
      setStatistics(statsData);
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
    
    return matchesSearch && matchesCategory;
  });

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-700">You need admin privileges to access this area.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">CLI Commands Registry</h1>
            </div>
            <span className="text-sm text-gray-700">{user?.email}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search pipelines or commands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {getCategoryIcon(cat)} {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-8">
            <button
              onClick={() => setActiveTab('pipelines')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pipelines'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pipelines ({pipelines.length})
            </button>
            <button
              onClick={() => setActiveTab('commands')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'commands'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Commands {selectedPipeline && `(${commands.length})`}
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statistics'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Statistics
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
                    className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
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
                <div className="mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {selectedPipeline.display_name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">{selectedPipeline.description}</p>
                  <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                    {selectedPipeline.script_path}
                  </div>
                </div>

                <div className="space-y-4">
                  {commands.map(command => (
                    <div
                      key={command.id}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-md font-semibold text-gray-900 font-mono">
                            {command.command_name}
                          </h4>
                          {command.description && (
                            <p className="text-sm text-gray-600 mt-1">{command.description}</p>
                          )}
                          {command.usage_pattern && (
                            <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                              Usage: {command.usage_pattern}
                            </div>
                          )}
                          {command.example_usage && (
                            <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                              Example: {command.example_usage}
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
                  ))}
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'statistics' && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pipeline
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Commands
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tables Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Executions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Used
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {statistics.map((stat: any) => (
                      <tr key={stat.pipeline_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {stat.pipeline_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stat.total_commands}
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
          </>
        )}
      </main>
    </div>
  );
};