import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { createSupabaseAdapter } from '@shared/adapters/supabase-adapter';

const supabase = createSupabaseAdapter({ env: import.meta.env as any });

interface Service {
  id: string;
  service_name: string;
  service_path: string;
  description: string;
  category: string;
  is_singleton: boolean;
  has_browser_variant: boolean;
  exports: string[];
  dependencies: string[];
  status: string;
}

interface Application {
  id: string;
  app_name: string;
  app_path: string;
  description: string;
  app_type: string;
  port_dev?: number;
  status: string;
}

interface Pipeline {
  id: string;
  pipeline_name: string;
  pipeline_path: string;
  description: string;
  shell_script: string;
  commands: string[];
  status: string;
}

interface ServiceDependency {
  id: string;
  service_name: string;
  category: string;
  used_by_apps_count: number;
  used_by_pipelines_count: number;
  depends_on_count: number;
  depended_by_count: number;
}

type ViewMode = 'services' | 'applications' | 'pipelines' | 'dependencies';

export default function ServiceDependencies() {
  const [viewMode, setViewMode] = useState<ViewMode>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [dependencies, setDependencies] = useState<ServiceDependency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, [viewMode]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      switch (viewMode) {
        case 'services':
          const { data: servicesData, error: servicesError } = await supabase
            .from('sys_shared_services')
            .select('*')
            .order('category', { ascending: true })
            .order('service_name', { ascending: true });
          
          if (servicesError) throw servicesError;
          setServices(servicesData || []);
          break;

        case 'applications':
          const { data: appsData, error: appsError } = await supabase
            .from('sys_applications')
            .select('*')
            .order('app_name', { ascending: true });
          
          if (appsError) throw appsError;
          setApplications(appsData || []);
          break;

        case 'pipelines':
          const { data: pipelinesData, error: pipelinesError } = await supabase
            .from('sys_cli_pipelines')
            .select('*')
            .order('pipeline_name', { ascending: true });
          
          if (pipelinesError) throw pipelinesError;
          setPipelines(pipelinesData || []);
          break;

        case 'dependencies':
          const { data: depsData, error: depsError } = await supabase
            .from('sys_service_dependency_summary')
            .select('*')
            .order('used_by_apps_count', { ascending: false })
            .order('used_by_pipelines_count', { ascending: false });
          
          if (depsError) throw depsError;
          setDependencies(depsData || []);
          break;
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const getUniqueCategories = () => {
    const categories = new Set(services.map(s => s.category));
    return ['all', ...Array.from(categories).sort()];
  };

  const filteredServices = services.filter(service => {
    const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      service.service_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredApplications = applications.filter(app => {
    return searchTerm === '' || 
      app.app_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredPipelines = pipelines.filter(pipeline => {
    return searchTerm === '' || 
      pipeline.pipeline_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pipeline.description?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getCategoryBadgeColor = (category: string) => {
    const colors: Record<string, string> = {
      'auth': 'bg-purple-100 text-purple-800',
      'database': 'bg-blue-100 text-blue-800',
      'ai': 'bg-pink-100 text-pink-800',
      'google': 'bg-green-100 text-green-800',
      'document': 'bg-orange-100 text-orange-800',
      'media': 'bg-red-100 text-red-800',
      'utility': 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl">
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-2xl font-bold text-green-900 mb-4">Service Dependencies Registry</h2>
          
          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setViewMode('services')}
              className={`px-4 py-2 rounded ${
                viewMode === 'services' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Services ({services.length})
            </button>
            <button
              onClick={() => setViewMode('applications')}
              className={`px-4 py-2 rounded ${
                viewMode === 'applications' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Applications ({applications.length})
            </button>
            <button
              onClick={() => setViewMode('pipelines')}
              className={`px-4 py-2 rounded ${
                viewMode === 'pipelines' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              CLI Pipelines ({pipelines.length})
            </button>
            <button
              onClick={() => setViewMode('dependencies')}
              className={`px-4 py-2 rounded ${
                viewMode === 'dependencies' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Dependency Graph
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {viewMode === 'services' && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {getUniqueCategories().map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading...</p>
            </div>
          ) : error ? (
            <div className="text-red-600 p-4 bg-red-50 rounded">
              Error: {error}
            </div>
          ) : (
            <>
              {/* Services View */}
              {viewMode === 'services' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredServices.map(service => (
                    <div key={service.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{service.service_name}</h3>
                        <span className={`px-2 py-1 text-xs rounded ${getCategoryBadgeColor(service.category)}`}>
                          {service.category}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-2">
                        {service.is_singleton && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Singleton
                          </span>
                        )}
                        {service.has_browser_variant && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                            Browser Support
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500">
                        <div>Path: {service.service_path}</div>
                        {service.exports.length > 0 && (
                          <div>Exports: {service.exports.length} items</div>
                        )}
                        {service.dependencies.length > 0 && (
                          <div>Dependencies: {service.dependencies.join(', ')}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Applications View */}
              {viewMode === 'applications' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredApplications.map(app => (
                    <div key={app.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <h3 className="font-semibold text-lg mb-2">{app.app_name}</h3>
                      <p className="text-sm text-gray-600 mb-3">{app.description}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs rounded ${
                          app.app_type === 'vite' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {app.app_type}
                        </span>
                        {app.port_dev && (
                          <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                            Port: {app.port_dev}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500">
                        Path: {app.app_path}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pipelines View */}
              {viewMode === 'pipelines' && (
                <div className="space-y-4">
                  {filteredPipelines.map(pipeline => (
                    <div key={pipeline.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-1">{pipeline.pipeline_name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{pipeline.description}</p>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Script: {pipeline.shell_script}</span>
                            <span>Commands: {pipeline.commands.length}</span>
                          </div>

                          {pipeline.commands.length > 0 && (
                            <div className="mt-2">
                              <div className="flex flex-wrap gap-1">
                                {pipeline.commands.slice(0, 10).map((cmd, idx) => (
                                  <span key={idx} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                                    {cmd}
                                  </span>
                                ))}
                                {pipeline.commands.length > 10 && (
                                  <span className="px-2 py-1 text-xs text-gray-500">
                                    +{pipeline.commands.length - 10} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Dependencies View */}
              {viewMode === 'dependencies' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-yellow-800">
                      Note: Dependency mappings need to be populated. Run the analyze-dependencies command to scan and map actual usage.
                    </p>
                  </div>
                  
                  {dependencies.map(dep => (
                    <div key={dep.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{dep.service_name}</h3>
                        <span className={`px-2 py-1 text-xs rounded ${getCategoryBadgeColor(dep.category)}`}>
                          {dep.category}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">{dep.used_by_apps_count}</div>
                          <div className="text-xs text-gray-600">Apps Using</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{dep.used_by_pipelines_count}</div>
                          <div className="text-xs text-gray-600">Pipelines Using</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{dep.depends_on_count}</div>
                          <div className="text-xs text-gray-600">Dependencies</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">{dep.depended_by_count}</div>
                          <div className="text-xs text-gray-600">Depended By</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}