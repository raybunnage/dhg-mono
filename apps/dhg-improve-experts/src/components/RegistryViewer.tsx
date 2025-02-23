import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/types/supabase';

type FunctionRegistry = Database['public']['Tables']['function_registry']['Row'];

export function RegistryViewer() {
  const [functions, setFunctions] = useState<FunctionRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFunctions();
  }, []);

  const loadFunctions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('function_registry')
        .select(`
          id,
          name,
          description,
          category,
          location,
          dependencies,
          implementation_notes,
          repository,
          status,
          created_at,
          updated_at
        `)
        .order('name');

      if (error) throw error;

      setFunctions(data || []);
    } catch (err) {
      console.error('Error loading functions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load functions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Function Registry</h2>
      <div className="grid gap-4">
        {functions.map((func) => (
          <div key={func.id} className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-xl font-semibold">{func.name}</h3>
            <div className="mt-2 text-gray-600">{func.description}</div>
            <div className="mt-2">
              <span className="font-medium">Category:</span> {func.category}
            </div>
            <div className="mt-2">
              <span className="font-medium">Location:</span> {func.location}
            </div>
            {func.dependencies && func.dependencies.length > 0 && (
              <div className="mt-2">
                <span className="font-medium">Dependencies:</span>
                <ul className="list-disc list-inside">
                  {func.dependencies.map((dep, index) => (
                    <li key={index}>{dep}</li>
                  ))}
                </ul>
              </div>
            )}
            {func.implementation_notes && (
              <div className="mt-2">
                <span className="font-medium">Implementation Notes:</span>
                <div className="text-sm text-gray-600">{func.implementation_notes}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 