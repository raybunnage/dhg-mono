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
      // First attempt with proper count syntax
      const { count, error } = await supabase
        .from('sources_google')
        .select('*', { count: 'exact', head: true })
      
      if (error) {
        console.error('Database connection error:', error)
        toast.error(`Database connection error: ${error.message}`)
      } else {
        // Log the count value to see what's being returned
        console.log('Database connection successful, count result:', count)
        
        // If count wasn't returned, try a different approach
        if (count === null || count === undefined) {
          console.log('Count not returned, trying to fetch actual data')
          const { data, error: dataError } = await supabase
            .from('sources_google')
            .select('*')
            .limit(5)
            
          if (!dataError) {
            console.log(`Successfully fetched ${data?.length} rows`)
          }
        }
        
        toast.success('Connected to database successfully')
        // Load initial data for the default table
        loadTableData(tableName)
      }
    } catch (err) {
      console.error('Connection verification error:', err)
    }
  }

  // Load table data
  async function loadTableData(table: string) {
    setLoading(true)
    setError(null)
    try {
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
      } else {
        console.log(`Table ${table} contains approximately ${count || 'unknown'} rows`);
      }
      
      // Now fetch actual data
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(10);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log(`No data retrieved from table ${table} (might be empty)`);
        
        // Try a more specific query just to validate the table exists
        const { data: testData, error: testError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (testError) {
          throw new Error(`Table access error: ${testError.message}`);
        }
      }
      
      setTableData(data || []);
      toast.success(`Loaded data from ${table} (${data?.length || 0} rows)`);
    } catch (err) {
      console.error(`Error loading table ${table}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load data from ${table}`);
      toast.error(`Failed to load table: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function getCompleteSchema() {
    setLoading(true)
    setError(null)
    try {
      // Instead of querying information_schema directly, we'll build a schema from what we can access
      // Get a list of tables we can access by trying to query common tables
      const commonTables = [
        'sources_google',
        'sync_history', 
        'google_auth_tokens',
        'experts',
        'expert_documents',
        'document_types',
        'sync_statistics'
      ];
      
      // Try to get a sample row from each table
      const tablesData = await Promise.all(
        commonTables.map(async (tableName) => {
          try {
            // First try to get the count to check if the table exists
            const { count, error: countError } = await supabase
              .from(tableName)
              .select('*', { count: 'exact', head: true });
              
            if (countError) {
              console.log(`Error querying table ${tableName}:`, countError);
              return null;
            }
            
            // Then get actual data to determine columns
            const { data, error } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
              
            if (!error && data) {
              return {
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                columns: data.length > 0 ? Object.keys(data[0]) : [],
                row_count: count || (data ? data.length : 0)
              };
            }
            
            // If we got here but have a count, the table exists but is empty
            if (count !== null && count !== undefined) {
              return {
                table_name: tableName,
                table_schema: 'public',
                table_type: 'BASE TABLE',
                columns: [],
                row_count: count
              };
            }
            
            return null;
          } catch (e) {
            console.error(`Exception querying ${tableName}:`, e);
            return null;
          }
        })
      );
      
      // Filter out nulls
      const accessibleTables = tablesData.filter(table => table !== null);
      
      // We can't get functions or triggers without direct SQL access, so use empty arrays
      const functionsData = [];
      const triggersData = [];

      const schema = {
        tables: accessibleTables,
        functions: functionsData,
        triggers: triggersData
      }

      setSchemaData(schema)
      toast.success('Schema information retrieved')

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
      // Get a sample row to infer table structure
      const { data: sampleData, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)
      
      if (sampleError) throw sampleError
      
      // Generate metadata from the sample data
      let metadata = []
      
      if (sampleData && sampleData.length > 0) {
        metadata = Object.keys(sampleData[0]).map(columnName => ({
          column_name: columnName,
          data_type: typeof sampleData[0][columnName] === 'number' ? 'number' : 
                   typeof sampleData[0][columnName] === 'boolean' ? 'boolean' :
                   typeof sampleData[0][columnName] === 'object' ? 'object' : 'string',
          is_nullable: 'YES', // We don't know this for sure
          table_name: tableName,
          table_schema: 'public'
        }))
      }
      
      setTableMetadata(metadata)
      toast.success(`Table metadata retrieved for ${tableName}`)
      
      // Save to file
      const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tableName}_metadata.json`
      a.click()
      window.URL.revokeObjectURL(url)
      
    } catch (err) {
      console.error('Error fetching table metadata:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch table metadata')
      toast.error(`Failed to fetch table metadata: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
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