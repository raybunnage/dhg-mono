import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';

export default function DatabaseInspector() {
  const [tableName, setTableName] = useState('sources_google');
  const [metadata, setMetadata] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'json' | 'formatted'>('formatted');
  
  const commonTables = [
    'sources_google',
    'sync_history',
    'google_auth_tokens',
    'experts',
    'expert_documents'
  ];
  
  const fetchTableMetadata = async () => {
    if (!tableName.trim()) {
      toast.error('Please enter a table name');
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_table_metadata', { 
        target_table: tableName 
      });
      
      if (error) throw error;
      
      setMetadata(data);
      toast.success(`Metadata loaded for table: ${tableName}`);
    } catch (error) {
      console.error('Error fetching table metadata:', error);
      toast.error(`Failed to load metadata: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const downloadMetadata = () => {
    if (!metadata) return;
    
    // Create JSON file
    const jsonContent = JSON.stringify(metadata, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create link and click it
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tableName}_metadata.json`;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success(`Downloaded metadata for ${tableName}`);
  };
  
  return (
    <div className="mt-6 bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold mb-3">Database Table Inspector</h2>
      
      <div className="mb-4 flex flex-col md:flex-row gap-3">
        <div className="flex-grow">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Table Name
          </label>
          <div className="flex">
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="flex-grow px-3 py-2 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter table name"
            />
            <button
              onClick={fetchTableMetadata}
              disabled={isLoading}
              className={`px-4 py-2 rounded-r font-medium ${
                isLoading 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {isLoading ? 'Loading...' : 'Inspect'}
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Common Tables
          </label>
          <select
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a table</option>
            {commonTables.map(table => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
        </div>
      </div>
      
      {metadata && (
        <div className="border rounded p-3 bg-gray-50">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Table: {metadata.table_name}</h3>
            <div className="flex gap-2">
              <div className="flex border rounded overflow-hidden">
                <button
                  onClick={() => setView('formatted')}
                  className={`px-3 py-1 text-sm ${
                    view === 'formatted' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-700'
                  }`}
                >
                  Formatted
                </button>
                <button
                  onClick={() => setView('json')}
                  className={`px-3 py-1 text-sm ${
                    view === 'json' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-700'
                  }`}
                >
                  JSON
                </button>
              </div>
              <button
                onClick={downloadMetadata}
                className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              >
                Download
              </button>
            </div>
          </div>
          
          {view === 'json' ? (
            <pre className="bg-gray-900 text-green-400 p-3 rounded overflow-auto max-h-96 text-xs">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          ) : (
            <div className="overflow-auto max-h-96">
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div className="font-medium">Description:</div>
                <div>{metadata.description || 'No description'}</div>
                
                <div className="font-medium">Size:</div>
                <div>{metadata.size || '0 bytes'}</div>
                
                <div className="font-medium">Row Count (approx):</div>
                <div>{metadata.approximate_row_count || '0'}</div>
              </div>
              
              <div className="mt-4">
                <h4 className="font-medium mb-2">Columns ({metadata.columns?.length || 0})</h4>
                {metadata.columns?.length > 0 ? (
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
                        {metadata.columns.map((col: any) => (
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
                <h4 className="font-medium mb-2">Indexes ({metadata.indexes?.length || 0})</h4>
                {metadata.indexes?.length > 0 ? (
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
                        {metadata.indexes.map((idx: any) => (
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
                <h4 className="font-medium mb-2">Foreign Keys ({metadata.foreign_keys?.length || 0})</h4>
                {metadata.foreign_keys?.length > 0 ? (
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
                        {metadata.foreign_keys.map((fk: any) => (
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
              
              {metadata.rls_policies?.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">RLS Policies ({metadata.rls_policies.length})</h4>
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
                        {metadata.rls_policies.map((policy: any) => (
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
      )}
    </div>
  );
} 