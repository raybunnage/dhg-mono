import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function SupabasePage() {
  const [schemaData, setSchemaData] = useState<any>(null)
  const [foreignKeyData, setForeignKeyData] = useState<any>(null)
  const [tableMetadata, setTableMetadata] = useState<any>(null)
  const [tableName, setTableName] = useState('sources_google')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'json' | 'formatted'>('formatted')
  
  const commonTables = [
    'sources_google',
    'sync_history',
    'google_auth_tokens',
    'experts',
    'expert_documents'
  ]

  async function getCompleteSchema() {
    setLoading(true)
    setError(null)
    try {
      // Tables and columns
      const { data: tablesData, error: tablesError } = await supabase.rpc(
        'get_schema_info',
        {
          schema_name: 'public'
        }
      )
      if (tablesError) throw tablesError

      // Functions
      const { data: functionsData, error: functionsError } = await supabase.rpc(
        'get_functions',
        {
          schema_name: 'public'
        }
      )
      if (functionsError) throw functionsError

      // Triggers
      const { data: triggersData, error: triggersError } = await supabase.rpc(
        'get_triggers',
        {
          schema_name: 'public'
        }
      )
      if (triggersError) throw triggersError

      const schema = {
        tables: tablesData,
        functions: functionsData,
        triggers: triggersData
      }

      setSchemaData(schema)

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
    } finally {
      setLoading(false)
    }
  }

  async function getForeignKeys() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.rpc('get_all_foreign_keys')
      if (error) throw error
      
      setForeignKeyData(data)

      // Save to separate file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'foreign_keys.json'
      a.click()
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error('Error fetching foreign keys:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch foreign keys')
    } finally {
      setLoading(false)
    }
  }
  
  async function getTableMetadata() {
    if (!tableName.trim()) {
      setError('Please enter a table name')
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase.rpc('get_table_metadata', { 
        p_target_table: tableName 
      })
      
      if (error) throw error
      
      setTableMetadata(data)
      
      // Save to file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${tableName}_metadata.json`
      a.click()
      window.URL.revokeObjectURL(url)
      
    } catch (err) {
      console.error('Error fetching table metadata:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch table metadata')
    } finally {
      setLoading(false)
    }
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
              onChange={(e) => setTableName(e.target.value)}
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
              <h2 className="text-xl font-semibold">Table: {tableMetadata.table_name}</h2>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gray-50 p-3 rounded">
                    <div className="font-medium mb-2">Table Info</div>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="text-gray-600">Size:</div>
                      <div>{tableMetadata.size}</div>
                      
                      <div className="text-gray-600">Row Count:</div>
                      <div>{tableMetadata.approximate_row_count || 'Unknown'}</div>
                      
                      <div className="text-gray-600">Last Vacuum:</div>
                      <div>{tableMetadata.last_vacuum || 'Never'}</div>
                      
                      <div className="text-gray-600">Last Analyze:</div>
                      <div>{tableMetadata.last_analyze || 'Never'}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Columns ({tableMetadata.columns?.length || 0})</h4>
                  {tableMetadata.columns?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Name</th>
                            <th className="px-2 py-1 text-left">Type</th>
                            <th className="px-2 py-1 text-left">Not Null</th>
                            <th className="px-2 py-1 text-left">PK</th>
                            <th className="px-2 py-1 text-left">Default</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {tableMetadata.columns.map((col: any) => (
                            <tr key={col.name}>
                              <td className="px-2 py-1">{col.name}</td>
                              <td className="px-2 py-1">{col.type}</td>
                              <td className="px-2 py-1">{col.not_null ? '✅' : ''}</td>
                              <td className="px-2 py-1">{col.is_primary_key ? '✅' : ''}</td>
                              <td className="px-2 py-1">{col.default || ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No columns found</p>
                  )}
                </div>
                
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Indexes ({tableMetadata.indexes?.length || 0})</h4>
                  {tableMetadata.indexes?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Name</th>
                            <th className="px-2 py-1 text-left">Type</th>
                            <th className="px-2 py-1 text-left">Unique</th>
                            <th className="px-2 py-1 text-left">Columns</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {tableMetadata.indexes.map((idx: any) => (
                            <tr key={idx.name}>
                              <td className="px-2 py-1">{idx.name}</td>
                              <td className="px-2 py-1">{idx.type}</td>
                              <td className="px-2 py-1">{idx.is_unique ? '✅' : ''}</td>
                              <td className="px-2 py-1">{idx.columns}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No indexes found</p>
                  )}
                </div>
                
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Foreign Keys ({tableMetadata.foreign_keys?.length || 0})</h4>
                  {tableMetadata.foreign_keys?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Name</th>
                            <th className="px-2 py-1 text-left">Source Column</th>
                            <th className="px-2 py-1 text-left">Target Table</th>
                            <th className="px-2 py-1 text-left">Target Column</th>
                            <th className="px-2 py-1 text-left">On Delete</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {tableMetadata.foreign_keys.map((fk: any) => (
                            <tr key={fk.name}>
                              <td className="px-2 py-1">{fk.name}</td>
                              <td className="px-2 py-1">{fk.source_column}</td>
                              <td className="px-2 py-1">{fk.target_table}</td>
                              <td className="px-2 py-1">{fk.target_column}</td>
                              <td className="px-2 py-1">{fk.on_delete}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No foreign keys found</p>
                  )}
                </div>
                
                {tableMetadata.rls_policies?.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">RLS Policies ({tableMetadata.rls_policies.length})</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-2 py-1 text-left">Name</th>
                            <th className="px-2 py-1 text-left">Command</th>
                            <th className="px-2 py-1 text-left">Using Expression</th>
                            <th className="px-2 py-1 text-left">Roles</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {tableMetadata.rls_policies.map((policy: any) => (
                            <tr key={policy.name}>
                              <td className="px-2 py-1">{policy.name}</td>
                              <td className="px-2 py-1">{policy.command_desc}</td>
                              <td className="px-2 py-1">{policy.using_expression}</td>
                              <td className="px-2 py-1">{policy.roles}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 