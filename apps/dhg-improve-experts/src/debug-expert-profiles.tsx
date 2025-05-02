import React, { useEffect, useState } from 'react';
import JsonFormatter from './components/JsonFormatter';
import { SupabaseClientService } from '../../packages/shared/services/supabase-client';

export const ExpertMetadataDebug: React.FC = () => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const expertId = '16bdcf4b-ad1a-445a-825b-e0f9a76db6af';

  useEffect(() => {
    const fetchExpert = async () => {
      setLoading(true);
      try {
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase
          .from('experts')
          .select('metadata')
          .eq('id', expertId)
          .single();
        
        if (error) throw error;
        
        setMetadata(data.metadata);
      } catch (err) {
        console.error('Error fetching expert metadata:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchExpert();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Expert Metadata Debug</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Expert ID: {expertId}</h2>
        
        {loading && <p className="text-gray-500">Loading metadata...</p>}
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
        )}
        
        {!loading && !error && metadata && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Metadata Content:</h3>
            <div className="border rounded p-4 bg-gray-50">
              <JsonFormatter data={metadata} />
            </div>
          </div>
        )}
        
        {!loading && !error && !metadata && (
          <p className="text-gray-500">No metadata available for this expert.</p>
        )}
      </div>
    </div>
  );
};

