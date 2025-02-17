import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type FunctionRegistryEntry = {
  id: string;
  name: string;
  description: string;
  status: string;
  location: string;
  category: string;
  repository: string;
  supabase_operations: Record<string, any>;
  dependencies: string[];
  implementation_notes: string;
  code_signature: string;
  relationships: Array<{
    related_function: string;
    relationship_type: string;
    details: Record<string, any>;
  }>;
};

export default function RegistryViewer() {
  const [entries, setEntries] = useState<FunctionRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRegistry() {
      try {
        console.log('Fetching registry data...');
        const { data, error } = await supabase
          .from('function_registry_view')
          .select('*');

        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }

        console.log('Fetched data:', data?.length, 'entries');
        setEntries(data || []);
      } catch (err) {
        console.error('Error fetching registry:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchRegistry();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (error) return (
    <div className="p-4 text-red-500">
      Error: {error}
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Function Registry</h1>
      <div className="grid gap-6">
        {entries.map((entry) => (
          <div key={entry.id} className="bg-white shadow-lg rounded-lg p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold text-blue-600">{entry.name}</h2>
                <p className="text-gray-600">{entry.description}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm ${
                entry.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {entry.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-semibold text-gray-700">Location</h3>
                <p className="text-gray-600">{entry.location}</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-700">Category</h3>
                <p className="text-gray-600">{entry.category}</p>
              </div>
            </div>

            {entry.dependencies.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Dependencies</h3>
                <div className="flex flex-wrap gap-2">
                  {entry.dependencies.map((dep, index) => (
                    <span key={index} className="bg-gray-100 px-2 py-1 rounded text-sm">
                      {dep}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {entry.relationships && entry.relationships.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Relationships</h3>
                <div className="space-y-2">
                  {entry.relationships.map((rel, index) => (
                    <div key={index} className="bg-gray-50 p-2 rounded">
                      <span className="text-blue-600">{rel.related_function}</span>
                      <span className="text-gray-500 mx-2">→</span>
                      <span className="text-gray-700">{rel.relationship_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <h3 className="font-semibold text-gray-700 mb-2">Implementation Notes</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{entry.implementation_notes}</p>
            </div>

            {entry.code_signature && (
              <div className="mt-4">
                <h3 className="font-semibold text-gray-700 mb-2">Code Signature</h3>
                <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
                  <code className="text-sm">{entry.code_signature}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 