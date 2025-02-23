import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { SchemaHelper } from '../../../../supabase/utils/schema-helper'

const schemaHelper = new SchemaHelper()

export function BatchProcessing() {
  const [batches, setBatches] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  
  // Get valid processing statuses from enum
  const validStatuses = schemaHelper.getEnumValues('processing_status')
  
  // Get column info for display
  const batchColumns = schemaHelper.getTableColumns('processing_batches')
  
  // Fetch active batches
  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await supabase
        .from('processing_batches')
        .select(`
          *,
          batch_processing_status (
            id,
            status,
            error,
            metadata
          )
        `)
        .order('created_at', { ascending: false })
        .limit(10)
      
      setBatches(data)
    }
    
    fetchBatches()
    // Set up realtime subscription
    const subscription = supabase
      .channel('batch_updates')
      .on('*', fetchBatches)
      .subscribe()
      
    return () => subscription.unsubscribe()
  }, [])
  
  const createBatch = async (type) => {
    // Call appropriate batch creation function
    const response = await fetch('/api/create-batch', {
      method: 'POST',
      body: JSON.stringify({
        type,
        fileIds: selectedFiles
      })
    })
    // Handle response...
  }
  
  return (
    <div>
      <h2>Batch Processing</h2>
      
      {/* Batch creation buttons */}
      <div className="flex gap-2">
        <button onClick={() => createBatch('google_extraction')}>
          Extract from Google
        </button>
        <button onClick={() => createBatch('audio_extraction')}>
          Extract Audio
        </button>
        <button onClick={() => createBatch('transcription')}>
          Transcribe
        </button>
      </div>
      
      {/* Batch status display */}
      <div className="mt-4">
        {batches.map(batch => (
          <BatchStatus key={batch.id} batch={batch} />
        ))}
      </div>
      
      <select>
        {validStatuses.map(status => (
          <option key={status} value={status}>{status}</option>
        ))}
      </select>
      
      <table>
        <thead>
          <tr>
            {batchColumns.map(col => (
              <th key={col.name}>{col.name}</th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  )
} 