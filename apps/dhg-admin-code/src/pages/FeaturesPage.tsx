import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { 
  ChevronRight, 
  ChevronDown, 
  Package, 
  FileCode, 
  Component, 
  Wrench,
  Layers,
  Code,
  Search,
  Filter,
  FolderOpen,
  File
} from 'lucide-react';

interface AppFeature {
  id: string;
  app_name: string;
  feature_name: string;
  feature_type: string;
  file_path: string;
  description: string | null;
  parent_feature_id: string | null;
  metadata: any;
  last_scanned_at: string | null;
}

interface AppUIPage {
  id: string;
  app_name: string;
  page_name: string;
  page_path: string | null;
  description: string | null;
  primary_service: string | null;
}

interface AppPageFeature {
  id: string;
  page_id: string | null;
  feature_name: string;
  feature_type: string | null;
  description: string | null;
  is_critical: boolean | null;
  service_dependencies: string[] | null;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'app' | 'page' | 'component' | 'hook' | 'service' | 'utility' | 'feature';
  path?: string;
  description?: string | null;
  children: TreeNode[];
  metadata?: any;
  isExpanded?: boolean;
}

export const FeaturesPage: React.FC = () => {
  const [apps, setApps] = useState<string[]>([]);
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [pages, setPages] = useState<AppUIPage[]>([]);
  const [pageFeatures, setPageFeatures] = useState<AppPageFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [treeData, setTreeData] = useState<TreeNode[]>([]);

  useEffect(() => {
    loadApps();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadAppData(selectedApp);
    }
  }, [selectedApp]);

  const loadApps = async () => {
    try {
      setLoading(true);
      
      // Get unique app names from features
      const { data: featureApps, error: featuresError } = await supabase
        .from('app_features')
        .select('app_name')
        .order('app_name');
        
      if (featuresError) throw featuresError;
      
      // Get unique app names from pages
      const { data: pageApps, error: pagesError } = await supabase
        .from('app_ui_pages')
        .select('app_name')
        .order('app_name');
        
      if (pagesError) throw pagesError;
      
      // Combine and deduplicate
      const allApps = new Set<string>();
      featureApps?.forEach(f => allApps.add(f.app_name));
      pageApps?.forEach(p => allApps.add(p.app_name));
      
      setApps(Array.from(allApps).sort());
      
      // Auto-select first app
      if (allApps.size > 0 && !selectedApp) {
        setSelectedApp(Array.from(allApps)[0]);
      }
    } catch (err) {
      console.error('Error loading apps:', err);
      setError(err instanceof Error ? err.message : 'Failed to load apps');
    } finally {
      setLoading(false);
    }
  };

  const loadAppData = async (appName: string) => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [featuresResult, pagesResult] = await Promise.all([
        supabase
          .from('app_features')
          .select('*')
          .eq('app_name', appName)
          .order('feature_type, feature_name'),
        supabase
          .from('app_ui_pages')
          .select('*')
          .eq('app_name', appName)
          .order('page_name')
      ]);
      
      if (featuresResult.error) throw featuresResult.error;
      if (pagesResult.error) throw pagesResult.error;
      
      setFeatures(featuresResult.data || []);
      setPages(pagesResult.data || []);
      
      // Load page features for all pages
      if (pagesResult.data && pagesResult.data.length > 0) {
        const pageIds = pagesResult.data.map(p => p.id);
        const { data: pageFeaturesData, error: pageFeaturesError } = await supabase
          .from('app_page_features')
          .select('*')
          .in('page_id', pageIds);
          
        if (pageFeaturesError) throw pageFeaturesError;
        setPageFeatures(pageFeaturesData || []);
      }
      
      // Build tree structure
      buildTreeStructure(
        appName, 
        featuresResult.data || [], 
        pagesResult.data || [],
        pageFeatures
      );
      
    } catch (err) {
      console.error('Error loading app data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load app data');
    } finally {
      setLoading(false);
    }
  };

  const buildTreeStructure = (
    appName: string, 
    features: AppFeature[], 
    pages: AppUIPage[],
    pageFeatures: AppPageFeature[]
  ) => {
    const tree: TreeNode[] = [{
      id: appName,
      name: appName,
      type: 'app',
      children: [],
      isExpanded: true
    }];
    
    const appNode = tree[0];
    
    // Add pages as top-level items
    if (pages.length > 0) {
      const pagesNode: TreeNode = {
        id: `${appName}-pages`,
        name: 'Pages',
        type: 'feature',
        children: pages.map(page => ({
          id: page.id,
          name: page.page_name,
          type: 'page',
          path: page.page_path || undefined,
          description: page.description,
          children: pageFeatures
            .filter(pf => pf.page_id === page.id)
            .map(pf => ({
              id: pf.id,
              name: pf.feature_name,
              type: 'feature',
              description: pf.description,
              children: [],
              metadata: {
                feature_type: pf.feature_type,
                is_critical: pf.is_critical,
                service_dependencies: pf.service_dependencies
              }
            }))
        }))
      };
      appNode.children.push(pagesNode);
    }
    
    // Group features by type
    const featuresByType = features.reduce((acc, feature) => {
      if (!acc[feature.feature_type]) {
        acc[feature.feature_type] = [];
      }
      acc[feature.feature_type].push(feature);
      return acc;
    }, {} as Record<string, AppFeature[]>);
    
    // Add features grouped by type
    Object.entries(featuresByType).forEach(([type, typeFeatures]) => {
      const typeNode: TreeNode = {
        id: `${appName}-${type}`,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)}s`,
        type: type as any,
        children: typeFeatures.map(feature => ({
          id: feature.id,
          name: feature.feature_name,
          type: feature.feature_type as any,
          path: feature.file_path,
          description: feature.description,
          children: [],
          metadata: feature.metadata
        }))
      };
      appNode.children.push(typeNode);
    });
    
    setTreeData(tree);
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'app':
        return <Package className="w-5 h-5 text-blue-500" />;
      case 'page':
        return <FileCode className="w-5 h-5 text-green-500" />;
      case 'component':
        return <Component className="w-5 h-5 text-purple-500" />;
      case 'hook':
        return <Code className="w-5 h-5 text-orange-500" />;
      case 'service':
        return <Wrench className="w-5 h-5 text-red-500" />;
      case 'utility':
        return <Layers className="w-5 h-5 text-yellow-600" />;
      case 'feature':
        return <FolderOpen className="w-5 h-5 text-gray-500" />;
      default:
        return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  const filterNodes = (nodes: TreeNode[], search: string, type: string): TreeNode[] => {
    return nodes.reduce((acc, node) => {
      const matchesSearch = !search || 
        node.name.toLowerCase().includes(search.toLowerCase()) ||
        node.description?.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = type === 'all' || node.type === type;
      
      const filteredChildren = filterNodes(node.children, search, type);
      
      if (matchesSearch && matchesType || filteredChildren.length > 0) {
        acc.push({
          ...node,
          children: filteredChildren
        });
      }
      
      return acc;
    }, [] as TreeNode[]);
  };

  const renderTree = (nodes: TreeNode[], level: number = 0) => {
    const filteredNodes = filterNodes(nodes, searchTerm, filterType);
    
    return filteredNodes.map(node => {
      const isExpanded = expandedNodes.has(node.id) || node.isExpanded;
      const hasChildren = node.children && node.children.length > 0;
      
      return (
        <div key={node.id} className="select-none">
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer ${
              level === 0 ? 'font-semibold' : ''
            }`}
            style={{ paddingLeft: `${level * 20 + 8}px` }}
            onClick={() => hasChildren && toggleNode(node.id)}
          >
            {hasChildren && (
              <div className="w-4 h-4 flex items-center justify-center">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            )}
            {!hasChildren && <div className="w-4" />}
            
            {getIcon(node.type)}
            
            <span className="flex-1">{node.name}</span>
            
            {node.path && (
              <span className="text-xs text-gray-500 truncate max-w-xs" title={node.path}>
                {node.path.split('/').pop()}
              </span>
            )}
            
            {node.metadata?.is_critical && (
              <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                Critical
              </span>
            )}
          </div>
          
          {node.description && isExpanded && (
            <div
              className="text-sm text-gray-600 mt-1 mb-2"
              style={{ paddingLeft: `${level * 20 + 32}px` }}
            >
              {node.description}
            </div>
          )}
          
          {hasChildren && isExpanded && (
            <div>{renderTree(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (loading && apps.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-8 h-8" />
            Application Features Explorer
          </h1>
          <p className="text-gray-600 mt-1">
            Drill down into apps to explore their pages, components, hooks, services, and utilities
          </p>
        </div>

        {/* App Selector and Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select App
              </label>
              <select
                value={selectedApp || ''}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Choose an app...</option>
                {apps.map(app => (
                  <option key={app} value={app}>{app}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search features..."
                  className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Type
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Types</option>
                <option value="page">Pages</option>
                <option value="component">Components</option>
                <option value="hook">Hooks</option>
                <option value="service">Services</option>
                <option value="utility">Utilities</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  setExpandedNodes(new Set());
                  setSearchTerm('');
                  setFilterType('all');
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 inline mr-1" />
                Reset
              </button>
              <button
                onClick={() => {
                  // Expand all nodes
                  const allNodeIds = new Set<string>();
                  const collectIds = (nodes: TreeNode[]) => {
                    nodes.forEach(node => {
                      allNodeIds.add(node.id);
                      if (node.children) {
                        collectIds(node.children);
                      }
                    });
                  };
                  collectIds(treeData);
                  setExpandedNodes(allNodeIds);
                }}
                className="px-4 py-2 text-sm text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
              >
                Expand All
              </button>
            </div>
          </div>
        </div>

        {/* Tree View */}
        {selectedApp && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                </div>
              ) : treeData.length > 0 ? (
                <div className="space-y-1">
                  {renderTree(treeData)}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No features found for this app
                </div>
              )}
            </div>

            {/* Statistics */}
            {!loading && selectedApp && (
              <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div>
                    Total Features: <span className="font-semibold">{features.length}</span>
                  </div>
                  <div>
                    Pages: <span className="font-semibold">{pages.length}</span>
                  </div>
                  <div>
                    Components: <span className="font-semibold">
                      {features.filter(f => f.feature_type === 'component').length}
                    </span>
                  </div>
                  <div>
                    Services: <span className="font-semibold">
                      {features.filter(f => f.feature_type === 'service').length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        {!selectedApp && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <Package className="w-12 h-12 text-blue-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Select an App to Explore
            </h3>
            <p className="text-blue-700">
              Choose an application from the dropdown above to view its features in a hierarchical structure.
              You can drill down into pages, components, hooks, services, and utilities.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};