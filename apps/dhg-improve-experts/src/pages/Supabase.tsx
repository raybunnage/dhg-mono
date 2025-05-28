import { useState, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import { useSupabaseTabCache } from '@/hooks/useSupabaseTabCache'

export function SupabasePage() {
  // Use separate cache hooks for different data types
  const { 
    cachedData: cachedSchemaData, 
    setCachedData: setSchemaCache, 
    clearCache: clearSchemaCache,
    isCached: isSchemaDataCached
  } = useSupabaseTabCache<any>('schema')
  
  const { 
    cachedData: cachedForeignKeyData, 
    setCachedData: setForeignKeyCache, 
    clearCache: clearForeignKeyCache,
    isCached: isForeignKeyDataCached
  } = useSupabaseTabCache<any>('foreignKeys')
  
  const { 
    cachedData: cachedTableMetadata, 
    setCachedData: setTableMetadataCache, 
    clearCache: clearTableMetadataCache,
    isCached: isTableMetadataCached
  } = useSupabaseTabCache<any>('tableMetadata')
  
  const { 
    cachedData: cachedTableData, 
    setCachedData: setTableDataCache, 
    clearCache: clearTableDataCache,
    isCached: isTableDataCached
  } = useSupabaseTabCache<any[]>('tableData')
  
  // State for UI
  const [schemaData, setSchemaData] = useState<any>(null)
  const [foreignKeyData, setForeignKeyData] = useState<any>(null)
  const [tableMetadata, setTableMetadata] = useState<any>(null)
  const [tableName, setTableName] = useState('google_sources')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'json' | 'formatted'>('formatted')
  const [tableData, setTableData] = useState<any[]>([])
  // Flag to track if database has been connected
  const [dbInitialized, setDbInitialized] = useState(false)
  
  // CLAUDE-TAG: Supabase.tsx - This is the right file to modify for the Supabase tab
  const commonTables = [
    'google_sources',
    'google_sync_history',
    'google_auth_tokens',
    'experts',
    'expert_documents',
    'prompt_categories',
    'prompt_relationships',
    'prompt_usage',
    'prompts',
    'doc_files',
    'document_types'
  ]
  
  // Initialize UI state from cache when component mounts
  useEffect(() => {
    if (cachedSchemaData) setSchemaData(cachedSchemaData);
    if (cachedForeignKeyData) setForeignKeyData(cachedForeignKeyData);
    if (cachedTableMetadata) setTableMetadata(cachedTableMetadata);
    if (cachedTableData) setTableData(cachedTableData);
  }, [cachedSchemaData, cachedForeignKeyData, cachedTableMetadata, cachedTableData]);

  // Delay database connection to ensure UI renders first
  useEffect(() => {
    // Use setTimeout to delay the database connection verification
    // This ensures the UI components have time to render
    const timer = setTimeout(() => {
      verifyDatabaseConnection();
    }, 100); // Short delay to allow UI to render first
    
    return () => clearTimeout(timer);
  }, []);

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
      
      // Mark database as initialized
      setDbInitialized(true);
      
      // Check if we have cached data for the default table
      const cacheKey = `table_${tableName}`;
      if (isTableDataCached(cacheKey) && cachedTableData) {
        // Use cached data for faster initial load
        console.log(`Using cached data for default table: ${tableName}`);
        setTableData(cachedTableData);
        return;
      }
      
      // If no cached data, load data for default table
      // But do this with a slight delay to ensure UI is responsive
      setTimeout(() => {
        loadTableData(tableName);
      }, 500);
      
    } catch (err) {
      console.error('Connection verification error:', err);
      toast.error(`Connection verification error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Load table data
  async function loadTableData(table: string) {
    // Check if we already have this table data cached
    const cacheKey = `table_${table}`;
    if (isTableDataCached(cacheKey)) {
      console.log(`Using cached data for table: ${table}`);
      
      // Get data from cache
      const cachedTable = cachedTableData;
      if (cachedTable) {
        setTableData(cachedTable);
        return;
      }
    }
    
    setLoading(true)
    setError(null)
    try {
      // Skip authentication check if we're already initialized to avoid redundant calls
      if (!dbInitialized) {
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
        
        // Cache the empty result
        setTableDataCache(cacheKey, []);
        
        toast.success(`Table '${table}' exists but is empty`);
        return;
      }
      
      // Update UI state and cache
      setTableData(data);
      setTableDataCache(cacheKey, data);
      
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
    // Check if we already have schema data cached
    const cacheKey = 'schema_data';
    if (isSchemaDataCached(cacheKey)) {
      console.log('Using cached schema data');
      
      // Get data from cache
      const cachedSchema = cachedSchemaData;
      if (cachedSchema) {
        setSchemaData(cachedSchema);
        toast.success('Using cached schema data');
        return;
      }
    }
    
    setLoading(true)
    setError(null)
    try {
      // Skip authentication check if we're already initialized to avoid redundant calls
      if (!dbInitialized) {
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
      }
      
      // Instead of querying information_schema directly, we'll build a schema from all possible tables
      console.log('Attempting to query all tables from Database interface...');
      
      // Use a more focused list of tables to reduce query load
      const essentialTables = [
        // Just query the most important tables rather than all possible tables
        'google_sources',
        'google_sync_history', 
        'google_auth_tokens',
        'experts',
        'expert_documents',
        'document_types',
        'function_registry',
        'prompt_categories',
        'prompt_relationships',
        'prompt_usage',
        'prompts',
        'doc_files'
      ];
      
      console.log(`Querying ${essentialTables.length} essential tables...`);
      
      // Try to get a sample row from each table - but do not use Promise.all
      // Process tables sequentially to avoid overwhelming the connection
      const tablesData = [];
      
      for (const tableName of essentialTables) {
        try {
          // First try to get the count to check if the table exists
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
            
          if (countError) {
            // Table likely doesn't exist or no access
            if (countError.code === 'PGRST116') {
              // This is the "relation does not exist" error code
              continue; // Skip this table - it doesn't exist
            }
            
            tablesData.push({
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
              columns: [],
              row_count: 0,
              error: countError.message
            });
            continue;
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
            tablesData.push({
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
              columns: [],
              row_count: count || 0,
              error: error.message,
              note: 'Can get count but not data (RLS restriction?)'
            });
            continue;
          }
            
          if (data && data.length > 0) {
            // We have data, use it to get column names
            tablesData.push({
              table_name: tableName,
              table_schema: 'public',
              table_type: 'BASE TABLE',
              columns: Object.keys(data[0]),
              row_count: count || 1
            });
            continue;
          }
          
          // Table exists but is empty
          tablesData.push({
            table_name: tableName,
            table_schema: 'public',
            table_type: 'BASE TABLE',
            columns: [],
            row_count: count || 0,
            note: 'Table exists but is empty'
          });
          
        } catch (e) {
          console.error(`Exception querying ${tableName}:`, e);
          // Continue to next table
        }
      }
      
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

      // Update state and cache
      setSchemaData(schema)
      setSchemaCache(cacheKey, schema);
      
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
    // Check if we already have foreign key data cached
    const cacheKey = 'foreign_keys';
    if (isForeignKeyDataCached(cacheKey)) {
      console.log('Using cached foreign key data');
      
      // Get data from cache
      const cachedForeignKeys = cachedForeignKeyData;
      if (cachedForeignKeys) {
        setForeignKeyData(cachedForeignKeys);
        toast.success('Using cached foreign key data');
        return;
      }
    }
    
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
          table_name: 'google_sources',
          column_name: 'parent_folder_id',
          foreign_table_name: 'google_sources',
          foreign_column_name: 'drive_id'
        }
      ];
      
      // Update state and cache
      setForeignKeyData(mockForeignKeys);
      setForeignKeyCache(cacheKey, mockForeignKeys);

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
    
    // Check if we already have metadata for this table cached
    const cacheKey = `metadata_${tableName}`;
    if (isTableMetadataCached(cacheKey)) {
      console.log(`Using cached metadata for table: ${tableName}`);
      
      // Get data from cache
      const cachedMetadata = cachedTableMetadata;
      if (cachedMetadata) {
        setTableMetadata(cachedMetadata);
        toast.success(`Using cached metadata for table: ${tableName}`);
        return;
      }
    }
    
    setLoading(true)
    setError(null)
    try {
      // Skip authentication check if we're already initialized to avoid redundant calls
      if (!dbInitialized) {
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
        toast.success(`Table '${tableName}' exists but is empty. Cannot infer column structure.`);
        
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
      
      // Update state and cache
      setTableMetadata(metadata);
      setTableMetadataCache(cacheKey, metadata);
      
      toast.success(`Table metadata retrieved for ${tableName}`);
      
      // Skip file download for metadata to reduce operations
      
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

  // Function to clear all caches
  const clearAllCaches = () => {
    clearSchemaCache();
    clearForeignKeyCache();
    clearTableMetadataCache();
    clearTableDataCache();
    toast.success('All caches cleared');
  };
  
  // Function to check if data is being served from cache
  const isUsingCachedData = () => {
    return (
      isSchemaDataCached('schema_data') ||
      isForeignKeyDataCached('foreign_keys') ||
      isTableMetadataCached(`metadata_${tableName}`) ||
      isTableDataCached(`table_${tableName}`)
    );
  };
  
  // Function to refresh current view
  const refreshCurrentView = () => {
    if (schemaData) {
      clearSchemaCache('schema_data');
      getCompleteSchema();
    }
    
    if (foreignKeyData) {
      clearForeignKeyCache('foreign_keys');
      getForeignKeys();
    }
    
    if (tableMetadata) {
      clearTableMetadataCache(`metadata_${tableName}`);
      getTableMetadata();
    }
    
    if (tableData.length > 0) {
      clearTableDataCache(`table_${tableName}`);
      loadTableData(tableName);
    }
    
    toast.success('View refreshed with latest data');
  };

  // Add filter states
  const [hideEmptyTables, setHideEmptyTables] = useState(false)
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  
  // Table category definitions
  const tableCategories = {
    "Presentation": ["presentation", "present"],
    "Command": ["command"],
    "Email": ["email", "mail"],
    "Page": ["page"],
    "Prompt": ["prompt", "prompt_categories", "prompt_relationships", "prompt_usage", "prompts"],
    "Document": ["document", "documentation", "doc"],
    "Sql": ["sql"],
    "Sync": ["sync"],
    "Expert": ["expert"]
  }
  
  // Function to check if a table belongs to a category
  const tableMatchesCategory = (tableName: string, category: string): boolean => {
    const patterns = tableCategories[category as keyof typeof tableCategories] || []
    return patterns.some(pattern => tableName.toLowerCase().includes(pattern.toLowerCase()))
  }
  
  // Function to toggle a filter
  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      if (prev.includes(filter)) {
        return prev.filter(f => f !== filter)
      } else {
        return [...prev, filter]
      }
    })
  }
  
  // Filter tables based on active filters and empty table filter
  const getFilteredTables = () => {
    if (!schemaData || !schemaData.tables) return []
    
    let filtered = [...schemaData.tables]
    
    // Filter out empty tables if the option is selected
    if (hideEmptyTables) {
      filtered = filtered.filter(table => table.row_count > 0)
    }
    
    // Filter tables based on active category filters
    if (activeFilters.length > 0) {
      filtered = filtered.filter(table => {
        // If the table matches any of the active filters, include it
        return activeFilters.some(filter => 
          tableMatchesCategory(table.table_name, filter)
        )
      })
    }
    
    // Sort tables by row count in descending order
    return filtered.sort((a, b) => {
      // Convert to numbers to ensure proper comparison
      const countA = typeof a.row_count === 'number' ? a.row_count : 0
      const countB = typeof b.row_count === 'number' ? b.row_count : 0
      return countB - countA // Descending order
    })
  }

  return (
    <div className="container mx-auto p-4 relative">
      {/* Special marker to make this page easily identifiable */}
      <div className="absolute top-0 right-0 bg-green-500 text-white px-4 py-2 rounded-bl-lg font-bold shadow-md">
        Supabase Page (Not Admin)
      </div>
      <h1 className="text-2xl font-bold mb-4">Supabase Schema Explorer <span className="text-blue-500 text-sm font-normal">[Supabase.tsx - Main Tab]</span></h1>
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex flex-wrap gap-2">
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
                Table Name <span className="text-xs font-normal text-blue-600">(See filter pills below)</span>
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
                <option value="">Select a table to view Details: Pills Below</option>
                {commonTables.map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Cache controls */}
        <div className="flex gap-2">
          <div className="flex items-center">
            <span className={`px-2 py-1 rounded text-xs font-medium ${isUsingCachedData() ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {isUsingCachedData() ? 'Using cached data' : 'Using live data'}
            </span>
          </div>
          <button
            onClick={refreshCurrentView}
            className="bg-yellow-500 hover:bg-yellow-600 text-white text-sm py-1 px-3 rounded"
          >
            Refresh Current View
          </button>
          <button
            onClick={clearAllCaches}
            className="bg-red-500 hover:bg-red-600 text-white text-sm py-1 px-3 rounded"
          >
            Clear All Caches
          </button>
        </div>
      </div>

      {/* Table Filter Pills - Placed prominently at the top */}
      {schemaData && schemaData.tables && (
        <div className="mt-6 mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-3">Table Filters</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {/* Toggle for hiding empty tables */}
            <button
              onClick={() => setHideEmptyTables(!hideEmptyTables)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${
                hideEmptyTables 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-white border border-gray-300 hover:bg-gray-100 text-gray-800'
              }`}
            >
              {hideEmptyTables ? 'Showing Non-Empty Tables' : 'Show All Tables'}
            </button>
            
            {/* Category filter pills */}
            {Object.keys(tableCategories).map(category => (
              <button
                key={category}
                onClick={() => toggleFilter(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${
                  activeFilters.includes(category)
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-white border border-gray-300 hover:bg-gray-100 text-gray-800'
                }`}
              >
                {category}
              </button>
            ))}
            
            {/* Clear all filters button */}
            {(activeFilters.length > 0 || hideEmptyTables) && (
              <button
                onClick={() => {
                  setActiveFilters([]);
                  setHideEmptyTables(false);
                }}
                className="px-4 py-2 rounded-full text-sm font-medium bg-red-100 hover:bg-red-200 text-red-700 shadow-sm border border-red-200"
              >
                Clear All Filters
              </button>
            )}
          </div>
          
          {schemaData.tables && schemaData.tables.length > 0 && (
            <div className="text-sm font-medium text-blue-800 bg-blue-100 px-3 py-1 rounded inline-block">
              Showing {getFilteredTables().length} of {schemaData.tables.length} tables
              {hideEmptyTables ? ' (hiding empty tables)' : ''}
              {activeFilters.length > 0 ? ` with filters: ${activeFilters.join(', ')}` : ''}
            </div>
          )}
        </div>
      )}

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

      {/* Display filtered tables list */}
      {schemaData && schemaData.tables && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Tables & Views <span className="text-sm font-normal text-gray-500">(sorted by row count)</span></h2>
          
          <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Table Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Row Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Categories
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getFilteredTables().map((table: any) => (
                    <tr 
                      key={table.table_name} 
                      className={`hover:bg-gray-50 ${table.row_count > 0 ? 'bg-white' : 'bg-gray-50'}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{table.table_name}</div>
                        {table.error && (
                          <div className="text-xs text-red-500 mt-1">{table.error}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span 
                          className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full 
                            ${table.row_count > 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'}`}
                        >
                          {table.row_count || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {Object.keys(tableCategories).filter(
                            category => tableMatchesCategory(table.table_name, category)
                          ).map(category => (
                            <span 
                              key={category}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              onClick={() => {
                                // Make categories clickable to filter by them
                                if (!activeFilters.includes(category)) {
                                  toggleFilter(category);
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            >
                              {category}
                            </span>
                          ))}
                          {Object.keys(tableCategories).filter(
                            category => tableMatchesCategory(table.table_name, category)
                          ).length === 0 && (
                            <span className="text-xs text-gray-500">No category</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setTableName(table.table_name);
                            getTableMetadata();
                          }}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded text-sm font-medium"
                        >
                          View Metadata
                        </button>
                        <button
                          onClick={() => handleTableChange(table.table_name)}
                          className="ml-2 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm font-medium"
                        >
                          Load Data
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {getFilteredTables().length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                        No tables match the current filters. Try adjusting your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                  {activeView === 'json' && (
                    <button
                      onClick={() => {
                        if (tableMetadata) {
                          // Create content with table name in a comment
                          const content = `// Table structure for: ${tableName}\n${JSON.stringify(tableMetadata, null, 2)}`;
                          navigator.clipboard.writeText(content)
                            .then(() => toast.success('Table structure copied to clipboard'))
                            .catch(() => toast.error('Failed to copy to clipboard'));
                        }
                      }}
                      className="ml-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200"
                      title="Copy to clipboard"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    </button>
                  )}
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