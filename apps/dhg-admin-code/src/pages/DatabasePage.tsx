import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';

interface TableInfo {
  table_name: string;
  table_schema: string;
  table_type: string;
  row_count: number;
  error?: string;
  columns?: string[];
}

interface PrefixInfo {
  prefix: string;
  label: string;
  count: number;
  description: string;
}

export function DatabasePage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'with-data' | 'empty'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrefix, setSelectedPrefix] = useState<string | null>(null);

  // Load table information on mount
  useEffect(() => {
    loadTableInfo();
  }, []);

  const loadTableInfo = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Only use the NEW table names from supabase/types.ts
      // These are the actual tables that exist in the database
      const knownTables = [
        // AI & prompt management (ai_ prefix)
        'ai_prompt_categories',
        'ai_prompt_output_templates', 
        'ai_prompt_relationships',
        'ai_prompt_template_associations',
        'ai_prompts',
        'ai_work_summaries',
        
        // Authentication & user management (auth_ prefix)
        'auth_allowed_emails',
        'auth_audit_log',
        'auth_cli_tokens',
        'auth_user_profiles',
        
        // Batch operations (batch_ prefix)
        'batch_processing',
        
        // Command & analytics (command_ prefix)
        'command_categories',
        'command_definitions',
        'command_dependencies',
        'command_patterns',
        'command_pipeline_tables',
        'command_pipelines',
        'command_refactor_tracking',
        'command_tracking',
        
        // Development (dev_ prefix)
        'dev_task_files',
        'dev_task_tags',
        'dev_tasks',
        
        // Document management (doc_ prefix)
        'doc_files',
        'document_type_aliases',
        'document_types',
        
        // Email system (email_ prefix)
        'email_addresses',
        'email_messages',
        
        // Expert system (expert_ prefix)
        'expert_profile_aliases',
        'expert_profiles',
        
        // Filter & preferences (filter_ prefix)
        'filter_user_profile_drives',
        'filter_user_profiles',
        
        // Google Drive integration (google_ prefix)
        'google_expert_documents',
        'google_sources',
        'google_sources_experts',
        'google_sync_history',
        'google_sync_statistics',
        
        // Learning platform (learn_ prefix)
        'learn_document_classifications',
        'learn_document_concepts',
        'learn_media_bookmarks',
        'learn_media_playback_events',
        'learn_media_sessions',
        'learn_media_topic_segments',
        'learn_subject_classifications',
        'learn_topics',
        'learn_user_analytics',
        'learn_user_interests',
        'learn_user_progress',
        'learn_user_scores',
        
        // Media & presentations (media_ prefix)
        'media_presentation_assets',
        'media_presentations',
        
        // Scripts (scripts_ prefix)
        'scripts_registry',
        
        // System & infrastructure (sys_ prefix)
        'sys_mime_types',
        'sys_table_migrations'
      ];

      const tableInfoList: TableInfo[] = [];
      const processedTables = new Set<string>();

      // Process each known table
      for (const tableName of knownTables) {
        // Skip if we've already processed this table
        if (processedTables.has(tableName)) continue;
        processedTables.add(tableName);

        try {
          let count: number | null = null;
          let countError: any = null;
          
          // Special handling for auth_audit_log table which requires admin access
          if (tableName === 'auth_audit_log') {
            // Try to use the SECURITY DEFINER function to get the actual count
            const { data: auditCountData, error: auditCountError } = await supabase
              .rpc('get_auth_audit_log_count');
            
            if (!auditCountError && auditCountData !== null) {
              count = auditCountData;
              // Successfully got count, now add to list with known columns
              tableInfoList.push({
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                row_count: count,
                columns: ['id', 'user_id', 'event_type', 'created_at', 'metadata', 'ip_address', 'user_agent'] // Known columns
              });
              continue;
            } else {
              // Fallback to regular count if function doesn't exist yet
              const result = await supabase
                .from(tableName)
                .select('*', { count: 'exact', head: true });
              
              count = result.count || 0;
              countError = result.error;
              
              // Add with note about RLS
              tableInfoList.push({
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                row_count: count,
                error: countError ? countError.message : (count === 0 ? 'RLS restricted - run migration for actual count' : null),
                columns: ['id', 'user_id', 'event_type', 'created_at', 'metadata', 'ip_address', 'user_agent']
              });
              continue;
            }
          } else {
            // Regular count for other tables
            const result = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
            count = result.count;
            countError = result.error;
          }

          if (countError) {
            // Table doesn't exist, skip it
            if (countError.code === 'PGRST116') {
              continue;
            }
            
            tableInfoList.push({
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
              row_count: 0,
              error: countError.message
            });
            continue;
          }

          // Try to get a sample row to determine columns
          const { data, error: dataError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (dataError) {
            // Can get count but not data (likely RLS issue)
            tableInfoList.push({
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
              row_count: count || 0,
              error: `RLS restriction: ${dataError.message}`
            });
            continue;
          }

          // Successfully accessed table
          tableInfoList.push({
            table_name: tableName,
            table_schema: 'public',
            table_type: 'BASE TABLE',
            row_count: count || 0,
            columns: data && data.length > 0 ? Object.keys(data[0]) : []
          });

        } catch (err) {
          console.error(`Error checking table ${tableName}:`, err);
        }
      }

      // Sort tables alphabetically by default
      tableInfoList.sort((a, b) => a.table_name.localeCompare(b.table_name));
      
      setTables(tableInfoList);
      
    } catch (err) {
      console.error('Error loading table info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load table information');
    } finally {
      setLoading(false);
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
      'command_': { label: 'Command', description: 'Command & analytics' },
      'dev_': { label: 'Dev', description: 'Development tasks' },
      'doc_': { label: 'Docs', description: 'Document management' },
      'document_': { label: 'Document Types', description: 'Document type definitions' },
      'email_': { label: 'Email', description: 'Email system' },
      'expert_': { label: 'Expert', description: 'Expert system' },
      'filter_': { label: 'Filter', description: 'User filters & preferences' },
      'google_': { label: 'Google', description: 'Google Drive integration' },
      'learn_': { label: 'Learning', description: 'Learning platform' },
      'media_': { label: 'Media', description: 'Media & presentations' },
      'scripts_': { label: 'Scripts', description: 'Script management' },
      'sys_': { label: 'System', description: 'System & infrastructure' },
      '_other': { label: 'Other', description: 'Other tables' }
    };
    
    // Count tables by prefix
    tables.forEach(table => {
      const prefix = Object.keys(prefixDescriptions).find(p => 
        p !== '_other' && table.table_name.startsWith(p)
      ) || '_other';
      
      prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
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
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(table => 
        table.table_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply prefix filter
    if (selectedPrefix) {
      if (selectedPrefix === '_other') {
        const knownPrefixes = ['ai_', 'auth_', 'batch_', 'command_', 'dev_', 'doc_', 
                               'document_', 'email_', 'expert_', 'filter_', 'google_', 'learn_', 
                               'media_', 'scripts_', 'sys_'];
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
    
    return filtered;
  };

  // Calculate statistics
  const totalTables = tables.length;
  const tablesWithData = tables.filter(t => t.row_count > 0).length;
  const emptyTables = tables.filter(t => t.row_count === 0 && !t.error).length;
  const tablesWithErrors = tables.filter(t => t.error).length;
  const totalRecords = tables.reduce((sum, t) => sum + t.row_count, 0);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-900 mb-2">Database Overview</h1>
          <p className="text-green-700">View table information and record counts across the database</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
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
        </div>

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
            {getPrefixInfo().map(({ prefix, label, count }) => (
              <button
                key={prefix}
                onClick={() => setSelectedPrefix(prefix)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedPrefix === prefix
                    ? 'bg-green-600 text-white'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
          {/* Search and filter controls */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search tables..."
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
              
              <button
                onClick={loadTableInfo}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh Data'}
              </button>
            </div>
          </div>
          
          {/* Info bar */}
          <div className="text-sm text-green-600">
            Showing {getFilteredTables().length} tables
            {selectedPrefix && ` with prefix "${selectedPrefix === '_other' ? 'other' : selectedPrefix}"`}
            {filterMode === 'with-data' && ' with data'}
            {filterMode === 'empty' && ' that are empty'}
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
                    Table Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Row Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-green-700 uppercase tracking-wider">
                    Columns
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-green-100">
                {getFilteredTables().map((table) => (
                  <tr key={table.table_name} className="hover:bg-green-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-900">{table.table_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        table.row_count > 0 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {table.row_count.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {table.error ? (
                        <span className="text-red-600 text-sm">{table.error}</span>
                      ) : table.row_count > 0 ? (
                        <span className="text-green-600 text-sm">✓ Active</span>
                      ) : (
                        <span className="text-gray-500 text-sm">Empty</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {table.columns && table.columns.length > 0 ? (
                        <div className="text-xs text-gray-600">
                          {table.columns.slice(0, 3).join(', ')}
                          {table.columns.length > 3 && ` +${table.columns.length - 3} more`}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No column info</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
      </div>
    </DashboardLayout>
  );
}