import React, { useState, useEffect } from 'react';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import JsonFormatter from './JsonFormatter';

interface ExpertMetadataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExpertMetadataModal: React.FC<ExpertMetadataModalProps> = ({ isOpen, onClose }) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const expertId = '16bdcf4b-ad1a-445a-825b-e0f9a76db6af'; // The fixed expert ID

  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchExpert() {
      setLoading(true);
      try {
        const supabase = SupabaseClientService.getInstance().getClient();
        const { data, error } = await supabase
          .from('experts')
          .select('metadata, expert_name, full_name')
          .eq('id', expertId)
          .single();
        
        if (error) throw error;
        
        setMetadata(data);
      } catch (err) {
        console.error('Error fetching expert metadata:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchExpert();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            {metadata ? `Expert Metadata: ${metadata.full_name || metadata.expert_name}` : 'Expert Metadata'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            &times;
          </button>
        </div>
        
        <div className="p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-3 text-gray-600">Loading metadata...</p>
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}
          
          {!loading && !error && metadata && (
            <div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                <h3 className="font-medium mb-2">Expert Information:</h3>
                <p><strong>Name:</strong> {metadata.full_name || metadata.expert_name}</p>
                <p><strong>ID:</strong> {expertId}</p>
              </div>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">Metadata:</h3>
                {metadata.metadata ? (
                  <div className="border rounded p-4 bg-gray-50">
                    <JsonFormatter data={metadata.metadata} />
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No metadata available for this expert.</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};