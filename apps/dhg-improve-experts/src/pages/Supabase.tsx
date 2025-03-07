import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'

export function SupabasePage() {
  const [schemaData, setSchemaData] = useState<any>(null)
  const [foreignKeyData, setForeignKeyData] = useState<any>(null)
  const [tableMetadata, setTableMetadata] = useState<any>(null)
  const [tableName, setTableName] = useState('sources_google')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'json' | 'formatted'>('formatted')
  const [tableData, setTableData] = useState<any[]>([])
  
  const commonTables = [
    'sources_google',
    'sync_history',
    'google_auth_tokens',
    'experts',
    'expert_documents'
  ]

  // Verify database connection on component mount
  useEffect(() => {
    verifyDatabaseConnection()
  }, [])

  // Verify that we can connect to Supabase
  async function verifyDatabaseConnection() {
    try {
      console.log('Verifying database connection...');
      
      // First check authentication
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Authentication error:', authError);
        toast.error(`Authentication error: ${authError.message}`);
        return;
      }
      
      if (!authData.session) {
        console.warn('No active session found. Attempting to sign in with test user');
        
        // Try auto-signin with test account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError || !signInData.session) {
          console.error('Sign in failed:', signInError);
          toast.error(`Unable to authenticate: ${signInError?.message || 'No session created'}`);
          return;
        }
        
        console.log('Signed in as:', signInData.user?.email);
        toast.success(`Signed in as ${signInData.user?.email}`);
      } else {
        console.log('Already authenticated as:', authData.session.user.email);
      }
      
      // Test access to various common tables
      const testTables = ['sources_google', 'sync_history', 'document_types', 'expert_documents'];
      let accessibleTablesCount = 0;
      
      for (const table of testTables) {
        try {
          console.log(`Testing access to ${table}...`);
          const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
          
          if (error) {
            console.warn(`Cannot access ${table}:`, error.message);
          } else {
            console.log(`Table ${table} accessible, contains ${count || 0} rows`);
            accessibleTablesCount++;
          }
        } catch (tableError) {
          console.error(`Error testing ${table}:`, tableError);
        }
      }
      
      if (accessibleTablesCount === 0) {
        toast.warning('Connected to database, but no tables accessible. Check RLS policies.');
      } else {
        toast.success(`Connected to database successfully (${accessibleTablesCount}/${testTables.length} tables accessible)`);
        // Load initial data for the default table
        loadTableData(tableName);
      }
    } catch (err) {
      console.error('Connection verification error:', err);
      toast.error(`Connection verification error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Load table data
  async function loadTableData(table: string) {
    setLoading(true)
    setError(null)
    try {
      // First, ensure we're authenticated
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.warn('No active session, attempting to authenticate before loading table data');
        // Auto-login with test account
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError) {
          throw new Error(`Authentication required: ${signInError.message}`);
        }
      }
      
      // First log some info about what we're doing
      console.log(`Attempting to fetch data from table: ${table}`);
      
      // Check that we have a valid table name
      if (!table || table.trim() === '') {
        throw new Error('Table name is empty');
      }
      
      // Try to get count first to verify table exists
      const { count, error: countError } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (countError) {
        console.warn(`Count query failed for table ${table}:`, countError);
        if (countError.code === 'PGRST116') {
          throw new Error(`Table '${table}' not found. Verify the table name is correct`);
        }
      } else {
        console.log(`Table ${table} contains approximately ${count || 'unknown'} rows`);
      }
      
      // Now fetch actual data
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(10);
      
      if (error) {
        if (error.code === '42501') {
          throw new Error(`Permission denied to table '${table}'. Check RLS policies.`);
        }
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.log(`No data retrieved from table ${table} (might be empty)`);
        
        // Set empty array but don't throw an error - empty tables are valid
        setTableData([]);
        toast.info(`Table '${table}' exists but is empty`);
        return;
      }
      
      setTableData(data);
      toast.success(`Loaded data from ${table} (${data.length} rows)`);
    } catch (err) {
      console.error(`Error loading table ${table}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load data from ${table}`);
      toast.error(`Failed to load table: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTableData([]); // Clear any previous data
    } finally {
      setLoading(false);
    }
  }

  async function getCompleteSchema() {
    setLoading(true)
    setError(null)
    try {
      // Check if authentication is working first
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Authentication error:', authError);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!authData.session) {
        console.warn('No active session found. Attempting to sign in with test user');
        // Try auto-signin with test account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError || !signInData.session) {
          throw new Error(`Unable to authenticate. Please make sure you're logged in.`);
        }
        
        toast.success(`Signed in as ${signInData.user?.email}`);
      }
      
      // Instead of querying information_schema directly, we'll build a schema from all possible tables
      console.log('Attempting to query all tables from Database interface...');
      
      // Comprehensive list of tables that might exist in the database
      const allPossibleTables = [
        // Common tables we know exist
        'sources_google',
        'sync_history', 
        'google_auth_tokens',
        'experts',
        'expert_documents',
        'document_types',
        'sync_statistics',
        'function_registry',
        'prompts',
        
        // Additional tables from the Database type
        'ai_processing_attempts',
        'app_pages',
        'app_state',
        'asset_types',
        'audio_processing_configs',
        'audio_processing_stages',
        'audio_processor_steps',
        'audio_segments',
        'batch_processing_status',
        'citation_expert_aliases',
        'command_categories',
        'command_history',
        'command_patterns',
        'documentation_files',
        'documentation_processing_queue',
        'documentation_relations',
        'documentation_sections',
        'domains',
        'email_addresses',
        'emails',
        'favorite_commands',
        'function_relationships',
        'page_dependencies',
        'page_function_usage',
        'page_guts_raw_data',
        'page_table_usage',
        'presentation_assets',
        'presentation_collection_items',
        'presentation_collections',
        'presentation_relationships',
        'presentation_search_index',
        'presentation_tag_links',
        'presentation_tags',
        'presentation_theme_links',
        'presentation_themes',
        'presentations',
        'processing_batches',
        'profiles',
        'sources',
        'speaker_profiles',
        'transcription_feedback',
        'user_annotations'
      ];
      
      console.log(`Querying ${allPossibleTables.length} possible tables...`);
      
      // Try to get a sample row from each table
      const tablesData = await Promise.all(
        allPossibleTables.map(async (tableName) => {
          try {
            // First try to get the count to check if the table exists
            const { count, error: countError } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
              
            if (countError) {
              // Table likely doesn't exist or no access
              if (countError.code === 'PGRST116') {
                // This is the "relation does not exist" error code
                return null; // Skip this table altogether - it doesn't exist
              }
              
              return {
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                columns: [],
                row_count: 0,
                error: countError.message
              };
            }
            
            // Table exists and we have access to it
            console.log(`Found table ${tableName} with count: ${count || 0}`);
            
            // Then get actual data to determine columns
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            if (error) {
              // We can get the count but not the data (likely RLS issue)
              return {
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                columns: [],
                row_count: count || 0,
                error: error.message,
                note: 'Can get count but not data (RLS restriction?)'
              };
            }
              
            if (data && data.length > 0) {
              // We have data, use it to get column names
              return {
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                columns: Object.keys(data[0]),
                row_count: count || 1
              };
            }
            
            // Table exists but is empty
            return {
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
              columns: [],
              row_count: count || 0,
              note: 'Table exists but is empty'
            };
          } catch (e) {
            console.error(`Exception querying ${tableName}:`, e);
            return null; // Skip tables with unexpected errors
          }
        })
      );
      
      // Filter out nulls (tables that don't exist)
      const existingTables = tablesData.filter(table => table !== null);
      
      console.log(`Found ${existingTables.length} tables that exist in the database`);
      
      // Count successful tables (have data or at least count)
      const successfulTables = existingTables.filter(table => !table.error).length;
      console.log(`Successfully queried ${successfulTables} of ${existingTables.length} tables`);
      
      // We can't get functions or triggers without direct SQL access, so use empty arrays
      const functionsData = [];
      const triggersData = [];

      const schema = {
        tables: existingTables,
        functions: functionsData,
        triggers: triggersData
      }

      setSchemaData(schema)
      
      if (successfulTables === 0) {
        toast.warning('No tables could be accessed. Check permissions or connection.')
      } else {
        toast.success(`Schema information retrieved (${successfulTables} tables)`)
      }

      // Save to file
      const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'schema.json'
      a.click()
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Error fetching schema:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch schema')
      toast.error(`Failed to fetch schema: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  async function getForeignKeys() {
    setLoading(true)
    setError(null)
    try {
      // We can't query foreign keys directly from Supabase client API
      // Instead, we'll create a mock foreign key data structure
      const mockForeignKeys = [
        {
          table_name: 'expert_documents',
          column_name: 'expert_id',
          foreign_table_name: 'experts',
          foreign_column_name: 'id'
        },
        {
          table_name: 'sources_google',
          column_name: 'parent_folder_id',
          foreign_table_name: 'sources_google',
          foreign_column_name: 'drive_id'
        }
      ];
      
      setForeignKeyData(mockForeignKeys);

      // Save to separate file
      const blob = new Blob([JSON.stringify(mockForeignKeys, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'foreign_keys.json';
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Created mock foreign key data (direct queries not supported)');
    } catch (err) {
      console.error('Error fetching foreign keys:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch foreign keys');
      toast.error(`Failed to fetch foreign keys: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }
  
  async function getTableMetadata() {
    if (!tableName.trim()) {
      setError('Please enter a table name')
      toast.error('Please enter a table name')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      // First, ensure we're authenticated
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.warn('No active session, attempting to authenticate before getting metadata');
        // Auto-login with test account
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError) {
          throw new Error(`Authentication required: ${signInError.message}`);
        }
      }
      
      // First check if the table exists
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        // Handle specific error codes
        if (countError.code === 'PGRST116') {
          throw new Error(`Table '${tableName}' not found. Verify the table name is correct`);
        } else if (countError.code === '42501') {
          throw new Error(`Permission denied to table '${tableName}'. Check RLS policies.`);
        }
        throw countError;
      }
      
      console.log(`Table ${tableName} exists with ${count || 0} rows`);
        
      // Get a sample row to infer table structure
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (sampleError) {
        throw sampleError;
      }
      
      // Generate metadata from the sample data
      let metadata = [];
      
      if (sampleData && sampleData.length > 0) {
        metadata = Object.keys(sampleData[0]).map(columnName => ({
          column_name: columnName,
          data_type: typeof sampleData[0][columnName] === 'number' ? 'number' : 
                   typeof sampleData[0][columnName] === 'boolean' ? 'boolean' :
                   typeof sampleData[0][columnName] === 'object' ? 'object' : 'string',
          is_nullable: 'YES', // We don't know this for sure
          table_name: tableName,
          table_schema: 'public',
          sample_value: sampleData[0][columnName] !== null ? 
                        (typeof sampleData[0][columnName] === 'object' ? 
                          JSON.stringify(sampleData[0][columnName]).substring(0, 50) : 
                          String(sampleData[0][columnName]).substring(0, 50)) 
                        : 'NULL'
        }))
      } else {
        // Table exists but is empty - try to provide some helpful info
        console.log(`Table ${tableName} exists but is empty`);
        toast.info(`Table '${tableName}' exists but is empty. Cannot infer column structure.`);
        
        // We can still set an empty metadata array, but with a message
        metadata = [{
          column_name: '(empty table)',
          data_type: 'unknown',
          is_nullable: 'unknown',
          table_name: tableName,
          table_schema: 'public',
          note: 'Table exists but is empty. Cannot infer structure.'
        }];
      }
      
      setTableMetadata(metadata);
      toast.success(`Table metadata retrieved for ${tableName}`);
      
      // Save to file
      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}_metadata.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Error fetching table metadata:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch table metadata');
      toast.error(`Failed to fetch table metadata: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setTableMetadata([]); // Clear any previous metadata
    } finally {
      setLoading(false);
    }
  }

  // Handle table selection change
  const handleTableChange = (newTable: string) => {
    setTableName(newTable)
    loadTableData(newTable)
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Supabase Schema Explorer</h1>
      
      <div className="flex flex-wrap gap-4 mb-4">
        <button
          onClick={getCompleteSchema}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {loading ? 'Fetching Schema...' : 'Get Schema Info'}
        </button>
        
        <button
          onClick={getForeignKeys}
          disabled={loading}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {loading ? 'Fetching Foreign Keys...' : 'Get Foreign Keys'}
        </button>
        
        <div className="w-full md:w-auto flex items-end gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Table Name
            </label>
            <div className="flex">
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="flex-grow px-3 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Enter table name"
              />
              <button
                onClick={getTableMetadata}
                disabled={loading}
                className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-r disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Inspect Table'}
              </button>
            </div>
          </div>
          
          <div>
            <select
              value={tableName}
              onChange={(e) => handleTableChange(e.target.value)}
              className="h-10 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select a table</option>
              {commonTables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Display table data */}
      {tableData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Data Preview - {tableName}</h2>
          <div className="overflow-auto max-h-[300px] bg-white shadow-md rounded">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(tableData[0]).map(column => (
                    <th key={column} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tableData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((value, valueIdx) => (
                      <td key={valueIdx} className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                        {typeof value === 'object' ? 
                          JSON.stringify(value).substring(0, 30) + (JSON.stringify(value).length > 30 ? '...' : '') : 
                          String(value).substring(0, 30) + (String(value).length > 30 ? '...' : '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schemaData && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Schema Information</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[600px]">
              {JSON.stringify(schemaData, null, 2)}
            </pre>
          </div>
        )}

        {foreignKeyData && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Foreign Key Information</h2>
            <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[600px]">
              {JSON.stringify(foreignKeyData, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {tableMetadata && (
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Table Structure: {tableName}</h2>
              <div className="flex gap-2">
                <div className="flex border rounded overflow-hidden">
                  <button
                    onClick={() => setActiveView('formatted')}
                    className={`px-3 py-1 text-sm ${
                      activeView === 'formatted' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    Formatted
                  </button>
                  <button
                    onClick={() => setActiveView('json')}
                    className={`px-3 py-1 text-sm ${
                      activeView === 'json' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>
            </div>
            
            {activeView === 'json' ? (
              <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[600px] text-xs">
                {JSON.stringify(tableMetadata, null, 2)}
              </pre>
            ) : (
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Columns ({tableMetadata.length})</h4>
                  {tableMetadata.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Name</th>
                            <th className="px-2 py-1 text-left">Type</th>
                            <th className="px-2 py-1 text-left">Not Null</th>
                            <th className="px-2 py-1 text-left">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {tableMetadata.map((col: any) => (
                            <tr key={col.column_name}>
                              <td className="px-2 py-1">{col.column_name}</td>
                              <td className="px-2 py-1">{col.data_type}</td>
                              <td className="px-2 py-1">{col.is_nullable === 'NO' ? '✅' : ''}</td>
                              <td className="px-2 py-1">{col.column_default || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No columns found</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}