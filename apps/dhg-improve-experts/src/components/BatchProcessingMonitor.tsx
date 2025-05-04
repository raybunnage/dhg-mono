import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { getBatchItems, retryBatchFailedItems } from '@/utils/batch-processor';
import { toast } from 'react-hot-toast';

export function BatchProcessingMonitor() {
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchItems, setBatchItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    loadBatches();
    
    // Set up real-time subscription
    const batchSubscription = supabase
      .channel('batch-updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'processing_batches' 
      }, payload => {
        // Refresh batches when updates occur
        loadBatches();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(batchSubscription);
    };
  }, []);
  
  useEffect(() => {
    if (selectedBatch) {
      loadBatchItems(selectedBatch);
    }
  }, [selectedBatch]);

  async function loadBatches() {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('processing_batches')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error loading batches:', error);
    } else {
      setBatches(data || []);
    }
    
    setLoading(false);
  }
  
  async function loadBatchItems(batch) {
    setItemsLoading(true);
    
    try {
      const items = await getBatchItems(batch.id);
      setBatchItems(items || []);
    } catch (error) {
      console.error('Error loading batch items:', error);
      setBatchItems([]);
    } finally {
      setItemsLoading(false);
    }
  }

  function getBatchStatusColor(status) {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  // Calculate progress percentage
  function getProgressPercentage(batch) {
    if (!batch.total_files) return 0;
    return Math.round((batch.processed_file / batch.total_files) * 100);
  }

  // Add batch retry functionality
  async function handleRetryFailedItems(batchId) {
    if (!confirm('Retry all failed items in this batch?')) return;
    
    try {
      setLoading(true);
      
      await retryBatchFailedItems(batchId, (file, status, processed, total) => {
        // You could update UI here with retry progress
        console.log(`Retrying ${file}: ${status} (${processed}/${total})`);
      });
      
      toast.success('Retry complete');
      await loadBatches();
      
      // Refresh the selected batch if it's the one we just retried
      if (selectedBatch?.id === batchId) {
        const { data } = await supabase
          .from('processing_batches')
          .select('*')
          .eq('id', batchId)
          .single();
          
        if (data) {
          setSelectedBatch(data);
        }
      }
    } catch (error) {
      toast.error('Retry failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Batch Processing Monitor</h2>
      
      <div className="mb-6 bg-blue-50 p-4 rounded-md border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Batch processing is primarily designed for audio/video files and other resource-intensive operations.
          Regular Google Drive syncing does not require batching and processes all files efficiently.
        </p>
      </div>
      
      {loading ? (
        <div className="text-center p-4">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <h3 className="font-medium mb-2">Recent Batches</h3>
            <div className="border rounded-md divide-y">
              {batches.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No batches found</div>
              ) : (
                batches.map(batch => (
                  <div 
                    key={batch.id}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${selectedBatch?.id === batch.id ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedBatch(batch)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">
                          Batch #{batch.id.substring(0, 8)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(batch.created_at).toLocaleString()}
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs ${getBatchStatusColor(batch.status)}`}>
                        {batch.status}
                      </div>
                    </div>
                    
                    {batch.total_files > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>{getProgressPercentage(batch)}% complete</span>
                          <span>{batch.processed_file}/{batch.total_files} files</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${getProgressPercentage(batch)}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="md:col-span-2">
            {selectedBatch ? (
              <div>
                <h3 className="font-medium mb-2">Batch Details</h3>
                <div className="bg-white rounded-md border p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Batch ID</div>
                      <div className="font-mono">{selectedBatch.id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Status</div>
                      <div className={`inline-block px-2 py-1 rounded-full text-xs ${getBatchStatusColor(selectedBatch.status)}`}>
                        {selectedBatch.status}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Started</div>
                      <div>{new Date(selectedBatch.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Progress</div>
                      <div>{selectedBatch.processed_file} of {selectedBatch.total_files} files</div>
                    </div>
                    
                    {selectedBatch.completed_at && (
                      <div>
                        <div className="text-sm text-gray-500">Completed</div>
                        <div>{new Date(selectedBatch.completed_at).toLocaleString()}</div>
                      </div>
                    )}
                    
                    {selectedBatch.error_message && (
                      <div className="col-span-2">
                        <div className="text-sm text-gray-500">Error</div>
                        <div className="text-red-600">{selectedBatch.error_message}</div>
                      </div>
                    )}
                  </div>
                </div>
                
                <h3 className="font-medium mb-2">Batch Files</h3>
                {itemsLoading ? (
                  <div className="text-center p-4">Loading files...</div>
                ) : (
                  <div className="overflow-x-auto">
                    {batchItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">No files available for this batch</div>
                    ) : (
                      <table className="min-w-full bg-white border">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="py-2 px-4 border-b text-left">Name</th>
                            <th className="py-2 px-4 border-b text-left">Type</th>
                            <th className="py-2 px-4 border-b text-left">Size</th>
                            <th className="py-2 px-4 border-b text-left">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchItems.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="py-2 px-4 border-b">{item.name}</td>
                              <td className="py-2 px-4 border-b">{item.mime_type}</td>
                              <td className="py-2 px-4 border-b">
                                {item.size ? `${Math.round(item.size / 1024)} KB` : 'Unknown'}
                              </td>
                              <td className="py-2 px-4 border-b">
                                <Link 
                                  to={`/transcribe?file=${item.id}`}
                                  className="text-blue-600 hover:text-blue-800 underline"
                                >
                                  View
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8 bg-gray-50 border rounded-md">
                <p className="text-gray-500">Select a batch to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 