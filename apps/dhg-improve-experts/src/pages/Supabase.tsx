import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function SupabasePage() {
  const [schemaData, setSchemaData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Supabase Schema Explorer</h1>
      
      <button
        onClick={getCompleteSchema}
        disabled={loading}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
      >
        {loading ? 'Fetching Schema...' : 'Get Schema Info'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {schemaData && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Schema Information</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-[600px]">
            {JSON.stringify(schemaData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
} 