import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { TableDetailsModal } from '../components/TableDetailsModal';
import { supabase } from '../lib/supabase';

interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
  object_type?: string; // 'table' | 'view' | 'materialized_view'
  row_count: number;
  size_pretty?: string;
  size_bytes?: number;
  column_count?: number;
  has_primary_key?: boolean;
  has_rls?: boolean;
  created_at?: string;
  updated_at?: string;
  description?: string;
  purpose?: string;
  created_date?: string;
  created_by?: string;
  notes?: string;
  error?: string;
  columns?: string[];
  is_updatable?: boolean;
  is_insertable?: boolean;
  depends_on?: string[];
  dependency_count?: number;
}

interface PrefixInfo {
  prefix: string;
  label: string;
  count: number;
  description: string;
}

interface ViewInfo {
  view_name: string;
  view_schema: string;
  is_updatable: boolean;
  is_insertable: boolean;
  has_rls: boolean;
  table_dependencies: string[];
  suggested_prefix: string;
}

export function DatabasePage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [views, setViews] = useState<ViewInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'with-data' | 'empty'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);
  const [objectTypeFilter, setObjectTypeFilter] = useState<'all' | 'tables' | 'views'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load table information on mount
  useEffect(() => {
    loadTableInfo();
  }, []);

  const loadTableInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First try the enhanced function, fall back to the basic one if it doesn't exist
      let tablesData: any[] | null = null;
      let tablesError: any = null;

      // Try the new function with definitions
      const result = await supabase.rpc('get_table_info_with_definitions');
      
      if (result.error?.code === '42883') { // Function does not exist
        // Fall back to the existing function
        const fallbackResult = await supabase.rpc('get_all_tables_with_metadata');
        tablesData = fallbackResult.data;
        tablesError = fallbackResult.error;
      } else {
        tablesData = result.data;
        tablesError = result.error;
      }

      if (tablesError) {
        throw tablesError;
      }

      const tableInfoList: TableInfo[] = [];

      // Filter to only include public schema tables and auth.users
      const filteredTables = (tablesData || []).filter((table: any) => {
        // Include all public schema tables
        if (table.table_schema === 'public') return true;
        
        // Only include auth.users from auth schema
        if (table.table_schema === 'auth' && table.table_name === 'users') return true;
        
        // Exclude all other auth schema tables
        return false;
      });

      // Process each table from the dynamic function
      for (const table of filteredTables) {
        try {
          // Get column information for each table
          const { data: columnsData, error: columnsError } = await supabase
            .rpc('get_table_columns', { p_table_name: table.table_name });

          const columns = columnsData?.map((col: any) => col.column_name) || [];

          // For auth tables, we might need special handling
          if (table.table_schema === 'auth' && table.row_count === 0) {
            // Try to get actual count using a special function if available
            const { data: actualCount } = await supabase
              .rpc('get_table_row_count', { p_table_name: table.table_name });
            
            if (actualCount !== null && actualCount !== undefined) {
              table.row_count = actualCount;
            }
          }

          tableInfoList.push({
            table_name: table.table_name,
            table_schema: table.table_schema || 'public',
            table_type: table.table_type || 'BASE TABLE',
            row_count: table.row_count || 0,
            size_pretty: table.size_pretty,
            size_bytes: table.size_bytes,
            column_count: table.column_count,
            has_primary_key: table.has_primary_key,
            has_rls: table.has_rls,
            created_at: table.created_at,
            updated_at: table.updated_at,
            description: table.description,
            purpose: table.purpose,
            created_date: table.created_date,
            created_by: table.created_by,
            notes: table.notes,
            columns: columns,
            error: columnsError ? columnsError.message : undefined
          });

        } catch (err) {
          console.error(`Error processing table ${table.table_name}:`, err);
          tableInfoList.push({
            table_name: table.table_name,
            table_schema: table.table_schema || 'public',
            table_type: 'BASE TABLE',
            row_count: 0,
            description: table.description,
            purpose: table.purpose,
            created_date: table.created_date,
            created_by: table.created_by,
            notes: table.notes,
            error: err instanceof Error ? err.message : 'Unknown error'
          });
        }
      }

      // Sort tables by prefix order (already done in SQL, but we can re-sort if needed)
      setTables(tableInfoList);
      
      // Load views as well
      await loadViewInfo();
      
      setLastRefresh(new Date());
      
    } catch (err) {
      console.error('Error loading table info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load table information');
    } finally {
      setLoading(false);
    }
  };
  
  const loadViewInfo = async () => {
    try {
      const { data: viewsData, error: viewsError } = await supabase
        .rpc('get_all_views_with_info');
      
      if (viewsError) {
        console.error('Error loading views:', viewsError);
        return;
      }
      
      setViews(viewsData || []);
    } catch (err) {
      console.error('Error loading views:', err);
    }
  };

  // Calculate prefix information
  const getPrefixInfo = (): PrefixInfo[] => {
    const prefixMap = new Map<string, number>();
    
    // Define known prefixes and their descriptions
    const prefixDescriptions: Record<string, { label: string; description: string }> = {
      'ai_': { label: 'AI', description: 'AI & prompt management' },
      'auth_': { label: 'Auth', description: 'Authentication & users' },
      'batch_': { label: 'Batch', description: 'Batch operations' },
      'clipboard_': { label: 'Clipboard', description: 'Clipboard snippets management' },
      'command_': { label: 'Command', description: 'Command & analytics' },
      'dev_': { label: 'Dev', description: 'Development tasks, merge queue & workflow' },
      'doc_': { label: 'Docs', description: 'Document management & continuous monitoring' },
      'document_': { label: 'Document Types', description: 'Document type definitions' },
      'email_': { label: 'Email', description: 'Email system' },
      'expert_': { label: 'Expert', description: 'Expert system' },
      'filter_': { label: 'Filter', description: 'User filters & preferences' },
      'google_': { label: 'Google', description: 'Google Drive integration' },
      'import_': { label: 'Import', description: 'Data import & migration' },
      'learn_': { label: 'Learning', description: 'Learning platform' },
      'media_': { label: 'Media', description: 'Media & presentations' },
      'registry_': { label: 'Registry', description: 'System registries & catalogs' },
      'scripts_': { label: 'Scripts', description: 'Script management' },
      'service_': { label: 'Service', description: 'Service configurations & metadata' },
      'sys_': { label: 'System', description: 'System & infrastructure, service registry' },
      'worktree_': { label: 'Worktree', description: 'Git worktree management' },
      '_other': { label: 'Other', description: 'Other tables' }
    };
    
    // Count tables by prefix
    tables.forEach(table => {
      // Special handling for auth.users - count it with auth_ prefix
      if (table.table_schema === 'auth' && table.table_name === 'users') {
        prefixMap.set('auth_', (prefixMap.get('auth_') || 0) + 1);
      } else {
        const prefix = Object.keys(prefixDescriptions).find(p => 
          p !== '_other' && table.table_name.startsWith(p)
        ) || '_other';
        
        prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
      }
    });
    
    // Convert to array and sort
    return Array.from(prefixMap.entries())
      .map(([prefix, count]) => ({
        prefix,
        label: prefixDescriptions[prefix]?.label || 'Other',
        count,
        description: prefixDescriptions[prefix]?.description || 'Other tables'
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  
  // Filter tables based on current filters
  const getFilteredTables = () => {
    let filtered = [...tables];
    
    // Apply object type filter
    if (objectTypeFilter !== 'all') {
      if (objectTypeFilter === 'tables') {
        filtered = filtered.filter(table => !table.object_type || table.object_type === 'table');
      } else if (objectTypeFilter === 'views') {
        filtered = filtered.filter(table => table.object_type === 'view' || table.object_type === 'materialized_view');
      }
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(table => 
        table.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        table.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply prefix filter
    if (selectedPrefix) {
      if (selectedPrefix === '_other') {
        const knownPrefixes = ['ai_', 'auth_', 'batch_', 'clipboard_', 'command_', 'dev_', 'doc_', 
                               'document_', 'email_', 'expert_', 'filter_', 'google_', 'import_', 
                               'learn_', 'media_', 'registry_', 'scripts_', 'service_', 'sys_', 
                               'worktree_'];
        filtered = filtered.filter(table => 
          !knownPrefixes.some(prefix => table.table_name.startsWith(prefix))
        );
      } else {
        filtered = filtered.filter(table => table.table_name.startsWith(selectedPrefix));
      }
    }
    
    // Apply row count filter
    if (filterMode === 'with-data') {
      filtered = filtered.filter(table => table.row_count > 0);
    } else if (filterMode === 'empty') {
      filtered = filtered.filter(table => table.row_count === 0);
    }
    
    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      if (dateFilter === 'week') {
        cutoffDate.setDate(now.getDate() - 7);
      } else if (dateFilter === 'month') {
        cutoffDate.setMonth(now.getMonth() - 1);
      }
      
      filtered = filtered.filter(table => {
        if (!table.created_date) return false;
        const tableDate = new Date(table.created_date);
        return tableDate >= cutoffDate;
      });
    }
    
    return filtered;
  };
  
  // Get views for the selected prefix
  const getViewsForPrefix = () => {
    if (!selectedPrefix) return [];
    
    return views.filter(view => {
      if (selectedPrefix === '_other') {
        return view.suggested_prefix === 'other';
      }
      return view.suggested_prefix === selectedPrefix;
    });
  };

  // Calculate statistics
  const totalTables = tables.length;
  const tablesWithData = tables.filter(t => t.row_count > 0).length;
  const emptyTables = tables.filter(t => t.row_count === 0 && !t.error).length;
  const tablesWithErrors = tables.filter(t => t.error).length;
  const totalRecords = tables.reduce((sum, t) => sum + t.row_count, 0);
  const totalSize = tables.reduce((sum, t) => sum + (t.size_bytes || 0), 0);
  
  // Calculate newest and oldest table dates
  const tableDates = tables
    .filter(t => t.created_date)
    .map(t => new Date(t.created_date!).getTime());
  const oldestTableDate = tableDates.length > 0 ? new Date(Math.min(...tableDates)) : null;
  const newestTableDate = tableDates.length > 0 ? new Date(Math.max(...tableDates)) : null;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-900 mb-2">Database Overview</h1>
          <p className="text-green-700">
            Live view of all database tables and their metadata
            {lastRefresh && (
              <span className="text-sm text-green-600 ml-2">
                (Last refreshed: {lastRefresh.toLocaleTimeString()})
              </span>
            )}
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-green-900">{totalTables}</div>
            <div className="text-sm text-green-600 mt-1">Total Tables</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-green-900">{tablesWithData}</div>
            <div className="text-sm text-green-600 mt-1">Tables with Data</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-gray-500">{emptyTables}</div>
            <div className="text-sm text-gray-500 mt-1">Empty Tables</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-red-600">{tablesWithErrors}</div>
            <div className="text-sm text-red-600 mt-1">Tables with Errors</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-green-900">{totalRecords.toLocaleString()}</div>
            <div className="text-sm text-green-600 mt-1">Total Records</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-green-900">
              {totalSize > 0 ? `${(totalSize / 1024 / 1024).toFixed(1)} MB` : 'N/A'}
            </div>
            <div className="text-sm text-green-600 mt-1">Total Size</div>
          </div>
        </div>

        {/* Table Age Information */}
        {(oldestTableDate || newestTableDate) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="text-sm text-blue-700">
                <span className="font-medium">Database Timeline:</span>
                {oldestTableDate && (
                  <span className="ml-3">
                    Oldest table created on <span className="font-medium">{oldestTableDate.toLocaleDateString()}</span>
                  </span>
                )}
                {newestTableDate && oldestTableDate && newestTableDate.getTime() !== oldestTableDate.getTime() && (
                  <span className="ml-3">
                    • Most recent table created on <span className="font-medium">{newestTableDate.toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prefix Filter Pills */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedPrefix(null)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedPrefix === null
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              All Tables ({tables.length})
            </button>
            {getPrefixInfo().map(({ prefix, label, count }) => {
              const viewCount = views.filter(v => 
                prefix === '_other' ? v.suggested_prefix === 'other' : v.suggested_prefix === prefix
              ).length;
              
              return (
                <button
                  key={prefix}
                  onClick={() => setSelectedPrefix(prefix)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedPrefix === prefix
                      ? 'bg-green-600 text-white'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                  title={`${label} - ${count} tables${viewCount > 0 ? `, ${viewCount} views` : ''}`}
                >
                  {label} ({count}{viewCount > 0 && `+${viewCount}v`})
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
          {/* Search and filter controls */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search tables by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            
            <div className="flex gap-2">
              {/* Row count filter toggles */}
              <button
                onClick={() => setFilterMode('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                All Tables
              </button>
              <button
                onClick={() => setFilterMode('with-data')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterMode === 'with-data'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                With Data
              </button>
              <button
                onClick={() => setFilterMode('empty')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterMode === 'empty'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                Empty Only
              </button>
              
              <div className="border-l border-green-300 mx-2"></div>
              
              {/* Object type filter */}
              <button
                onClick={() => setObjectTypeFilter('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  objectTypeFilter === 'all'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setObjectTypeFilter('tables')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  objectTypeFilter === 'tables'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                Tables
              </button>
              <button
                onClick={() => setObjectTypeFilter('views')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  objectTypeFilter === 'views'
                    ? 'bg-green-600 text-white'
                    : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                }`}
              >
                Views
              </button>
              
              <div className="border-l border-green-300 mx-2"></div>
              
              {/* Date filter toggles */}
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
                }`}
              >
                All Dates
              </button>
              <button
                onClick={() => setDateFilter('week')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
                }`}
              >
                Last Week
              </button>
              <button
                onClick={() => setDateFilter('month')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateFilter === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
                }`}
              >
                Last Month
              </button>
              
              <div className="border-l border-green-300 mx-2"></div>
              
              <button
                onClick={loadTableInfo}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Info bar */}
          <div className="text-sm text-green-600">
            Showing {getFilteredTables().length} tables
            {selectedPrefix && ` with prefix "${selectedPrefix === '_other' ? 'other' : selectedPrefix}"`}
            {filterMode === 'with-data' && ' with data'}
            {filterMode === 'empty' && ' that are empty'}
            {dateFilter === 'week' && ' created in the last week'}
            {dateFilter === 'month' && ' created in the last month'}
            {searchTerm && ` matching "${searchTerm}"`}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Tables List */}
        <div className="bg-white rounded-lg shadow-sm border border-green-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
            <table className="min-w-full divide-y divide-green-100">
              <thead className="bg-green-50 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Table Name <span className="text-xs text-gray-500 normal-case">(click for details)</span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Row Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Columns
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Features
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-green-100">
                {getFilteredTables().map((table) => (
                  <tr 
                    key={table.table_name} 
                    className={`hover:bg-green-50 cursor-pointer ${
                      table.table_type === 'VIEW' ? 'bg-blue-50/30 border-l-2 border-l-blue-300' : ''
                    }`}
                    onClick={() => {
                      setSelectedTable(table);
                      setIsModalOpen(true);
                    }}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-green-900 flex items-center gap-2">
                          <span>{table.table_name}</span>
                          {table.table_type === 'VIEW' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700" title="Database View">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              VIEW
                            </span>
                          )}
                        </div>
                        {table.description && (
                          <div className="text-xs text-gray-600 mt-1">{table.description}</div>
                        )}
                        {table.purpose && (
                          <div className="text-xs text-gray-500 mt-0.5 italic">{table.purpose}</div>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400">
                          {table.created_date && (
                            <span>Created: {new Date(table.created_date).toLocaleDateString()}</span>
                          )}
                          {table.created_by && (
                            <span>by {table.created_by}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {table.object_type === 'view' ? (
                        <span className="text-sm text-gray-500">
                          {table.depends_on && table.depends_on.length > 0 ? (
                            <span title={`Depends on: ${table.depends_on.join(', ')}`}>
                              {table.depends_on.length} deps
                            </span>
                          ) : (
                            'View'
                          )}
                        </span>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          table.row_count > 0 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {table.row_count.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {table.size_pretty || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {table.error ? (
                        <span className="text-red-600 text-sm" title={table.error}>⚠️ Error</span>
                      ) : table.row_count > 0 ? (
                        <span className="text-green-600 text-sm">✓ Active</span>
                      ) : (
                        <span className="text-gray-500 text-sm">Empty</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {table.columns && table.columns.length > 0 ? (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">{table.column_count || table.columns.length}</span> columns
                          {table.columns.length > 0 && (
                            <div className="mt-1">
                              {table.columns.slice(0, 3).join(', ')}
                              {table.columns.length > 3 && ` +${table.columns.length - 3} more`}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">
                          {table.column_count ? `${table.column_count} columns` : 'No column info'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {table.object_type === 'view' ? (
                          <>
                            {table.is_updatable && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded" title="Updatable View">
                                UPD
                              </span>
                            )}
                            {table.is_insertable && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded" title="Insertable View">
                                INS
                              </span>
                            )}
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded" title="Database View">
                              VIEW
                            </span>
                          </>
                        ) : (
                          <>
                            {table.has_primary_key && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded" title="Has Primary Key">
                                PK
                              </span>
                            )}
                            {table.has_rls && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded" title="Row Level Security Enabled">
                                RLS
                              </span>
                            )}
                          </>
                        )}
                        {table.table_schema === 'auth' && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded" title="Auth Schema">
                            Auth
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Views Section - Only show when a prefix is selected */}
        {selectedPrefix && getViewsForPrefix().length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-green-900">
                Views for {selectedPrefix === '_other' ? 'Other' : selectedPrefix} prefix
              </h2>
              {getViewsForPrefix().some(v => !v.has_rls) && (
                <div className="text-sm text-yellow-700 bg-yellow-50 px-3 py-1 rounded-lg">
                  ⚠️ Some views show no RLS, but their dependent tables may have RLS policies
                </div>
              )}
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-green-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-green-100">
                  <thead className="bg-green-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        View Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Features
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Dependencies
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                        Security
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-green-100">
                    {getViewsForPrefix().map((view) => (
                      <tr key={view.view_name} className="hover:bg-green-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-900">
                            {view.view_schema}.{view.view_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-1">
                            {view.is_insertable && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Insertable
                              </span>
                            )}
                            {view.is_updatable && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                Updatable
                              </span>
                            )}
                            {!view.is_insertable && !view.is_updatable && (
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                Read-only
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs text-gray-600">
                            {view.table_dependencies.length > 0 ? (
                              <div>
                                {view.table_dependencies.slice(0, 3).join(', ')}
                                {view.table_dependencies.length > 3 && (
                                  <span className="text-gray-400"> +{view.table_dependencies.length - 3} more</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">No dependencies</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {view.has_rls ? (
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              RLS Enabled
                            </span>
                          ) : (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                              No RLS
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && tables.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-green-600">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading database information...
            </div>
          </div>
        )}

        {/* Table Details Modal */}
        {selectedTable && (
          <TableDetailsModal
            table={selectedTable}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedTable(null);
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}