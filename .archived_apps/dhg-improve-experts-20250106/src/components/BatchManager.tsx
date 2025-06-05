import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BatchProgress } from './BatchProgress';

export function BatchManager() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBatches();
    // Subscribe to batch updates
    const subscription = supabase
      .channel('processing_batches')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'processing_batches' 
      }, handleBatchUpdate)
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('processing_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error loading batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchUpdate = (payload: any) => {
    setBatches(current => {
      const updated = [...current];
      const index = updated.findIndex(b => b.id === payload.new.id);
      if (index >= 0) {
        updated[index] = payload.new;
      } else {
        updated.unshift(payload.new);
      }
      return updated;
    });
  };

  if (loading) return <div>Loading batches...</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Recent Processing Batches</h2>
      {batches.length === 0 ? (
        <p className="text-gray-500">No recent batches</p>
      ) : (
        batches.map(batch => (
          <BatchProgress key={batch.id} batch={batch} />
        ))
      )}
    </div>
  );
} 