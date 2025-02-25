import { processAudioFile } from './audio-pipeline';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../../../../supabase/types';

type BatchType = Database['public']['Enums']['batch_type'];
type ProcessingStatus = Database['public']['Enums']['processing_status'];
type ProcessingStage = Database['public']['Enums']['processing_stage'];

interface BatchParameters {
  model?: string;
  quality?: 'low' | 'medium' | 'high';
  language?: string;
  [key: string]: any;
}

/**
 * Process a batch of files with concurrency control and database tracking
 */
export async function processBatch(
  fileIds: string[], 
  batchType: BatchType = 'audio_extraction',
  parameters: BatchParameters = {},
  concurrency = 1,
  progressCallback: (file: string, status: string, processed: number, total: number) => void
) {
  // 1. Create batch record in database
  const batchId = await createBatchRecord(fileIds.length, batchType, parameters);
  
  // 2. Get all files data
  const { data: files, error } = await supabase
    .from('sources_google')
    .select('*')
    .in('id', fileIds);
    
  if (error || !files) {
    await updateBatchStatus(batchId, 'failed', 'Failed to fetch files');
    throw new Error('Failed to fetch files for batch processing');
  }
  
  // 3. Create batch items
  await createBatchItems(batchId, files);
  
  // 4. Process files with tracking
  const queue = [...files];
  const results = [];
  const processing = new Set();
  let processed = 0;
  
  // Process concurrently with limits
  async function processNext() {
    if (queue.length === 0) return;
    
    const file = queue.shift();
    processing.add(file.id);
    
    progressCallback(
      file.name, 
      'Starting', 
      processed, 
      files.length
    );
    
    // Update item status to processing
    await updateBatchItemStatus(batchId, file.id, 'processing', 'downloading');
    
    try {
      const startTime = Date.now();
      
      await processAudioFile(file, async (msg) => {
        // Update processing stage based on message
        let stage: ProcessingStage = 'processing';
        if (msg.includes('Downloading')) stage = 'downloading';
        else if (msg.includes('Transcribing')) stage = 'processing';
        else if (msg.includes('Saving')) stage = 'saving';
        
        await updateBatchItemStatus(batchId, file.id, 'processing', stage);
        progressCallback(file.name, msg, processed, files.length);
      });
      
      const processingTime = Date.now() - startTime;
      
      // Update status to completed
      await updateBatchItemStatus(
        batchId, 
        file.id, 
        'completed', 
        'completed', 
        null, 
        processingTime
      );
      
      results.push({ id: file.id, success: true });
    } catch (err) {
      // Update status to failed
      await updateBatchItemStatus(
        batchId, 
        file.id, 
        'failed', 
        'failed', 
        err.message
      );
      
      results.push({ id: file.id, success: false, error: err });
    }
    
    processed++;
    processing.delete(file.id);
    
    // Update batch progress
    await updateBatchProgress(batchId, processed, files.length);
    
    // Start next file
    await processNext();
  }
  
  // Start initial batch based on concurrency
  const initial = Math.min(concurrency, queue.length);
  const promises = [];
  
  for (let i = 0; i < initial; i++) {
    promises.push(processNext());
  }
  
  // Wait for all to complete
  await Promise.all(promises);
  
  // 5. Update final batch status
  if (results.every(r => r.success)) {
    await updateBatchStatus(batchId, 'completed');
  } else if (results.some(r => r.success)) {
    await updateBatchStatus(batchId, 'completed', 'Some files failed processing');
  } else {
    await updateBatchStatus(batchId, 'failed', 'All files failed processing');
  }
  
  return {
    batchId,
    total: files.length,
    processed,
    results
  };
}

// Create a new batch record
async function createBatchRecord(
  fileCount: number, 
  batchType: BatchType,
  parameters: BatchParameters
): Promise<string> {
  const { data, error } = await supabase
    .from('processing_batches')
    .insert({
      status: 'processing' as ProcessingStatus,
      total_files: fileCount,
      processed_file: 0,
      batch_type: batchType,
      parameters
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Failed to create batch record:', error);
    throw error;
  }
  
  return data.id;
}

// Create batch items for each file
async function createBatchItems(batchId: string, files: any[]) {
  const batchItems = files.map(file => ({
    batch_id: batchId,
    source_id: file.id,
    status: 'queued' as ProcessingStatus,
    stage: 'queued' as ProcessingStage
  }));
  
  const { error } = await supabase
    .from('batch_items')
    .insert(batchItems);
  
  if (error) {
    console.error('Failed to create batch items:', error);
    throw error;
  }
}

// Update batch item status
async function updateBatchItemStatus(
  batchId: string,
  fileId: string,
  status: ProcessingStatus,
  stage: ProcessingStage,
  errorMessage?: string,
  processingTime?: number
) {
  const updates: any = {
    status,
    stage,
    updated_at: new Date().toISOString()
  };
  
  if (errorMessage) {
    updates.error_message = errorMessage;
  }
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  
  if (processingTime) {
    updates.processing_time = processingTime;
  }
  
  const { error } = await supabase
    .from('batch_items')
    .update(updates)
    .match({ batch_id: batchId, source_id: fileId });
  
  if (error) {
    console.error('Failed to update batch item status:', error);
  }
}

// Update batch status and progress
async function updateBatchStatus(
  batchId: string, 
  status: ProcessingStatus, 
  errorMessage?: string
) {
  const updates: any = {
    status,
    updated_at: new Date().toISOString()
  };
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  
  if (errorMessage) {
    updates.error_message = errorMessage;
  }
  
  const { error } = await supabase
    .from('processing_batches')
    .update(updates)
    .eq('id', batchId);
  
  if (error) {
    console.error('Failed to update batch status:', error);
  }
}

// Update batch progress based on batch items
async function updateBatchProgress(batchId: string, processed: number, total: number) {
  // Get current counts
  const { data: countData, error: countError } = await supabase
    .from('batch_items')
    .select('status')
    .eq('batch_id', batchId);
  
  if (countError) {
    console.error('Failed to get batch items for progress update:', countError);
    // Fall back to basic update
    await updateBasicBatchProgress(batchId, processed, total);
    return;
  }
  
  const completedCount = countData.filter(item => item.status === 'completed').length;
  const failedCount = countData.filter(item => item.status === 'failed').length;
  
  const { error } = await supabase
    .from('processing_batches')
    .update({
      processed_file: completedCount + failedCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', batchId);
  
  if (error) {
    console.error('Failed to update batch progress:', error);
  }
}

// Basic progress update as fallback
async function updateBasicBatchProgress(batchId: string, processed: number, total: number) {
  const { error } = await supabase
    .from('processing_batches')
    .update({
      processed_file: processed,
      updated_at: new Date().toISOString()
    })
    .eq('id', batchId);
  
  if (error) {
    console.error('Failed to update basic batch progress:', error);
  }
}

// Retrieve batch items for a specific batch
export async function getBatchItems(batchId: string) {
  const { data, error } = await supabase
    .from('batch_items')
    .select(`
      *,
      source:source_id(id, name, mime_type, size),
      document:document_id(id, title, document_type)
    `)
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true });
    
  if (error) {
    console.error('Failed to get batch items:', error);
    return [];
  }
  
  return data;
}

// Retry failed items in a batch
export async function retryBatchFailedItems(
  batchId: string,
  progressCallback: (file: string, status: string, processed: number, total: number) => void
) {
  // Get failed items
  const { data: failedItems, error: itemsError } = await supabase
    .from('batch_items')
    .select('source_id, status')
    .eq('batch_id', batchId)
    .eq('status', 'failed');
    
  if (itemsError || !failedItems?.length) {
    throw new Error('No failed items to retry');
  }
  
  // Get batch type and parameters
  const { data: batch, error: batchError } = await supabase
    .from('processing_batches')
    .select('batch_type, parameters')
    .eq('id', batchId)
    .single();
    
  if (batchError) {
    throw new Error('Could not retrieve batch information');
  }
  
  // Reset status of failed items to queued
  await supabase
    .from('batch_items')
    .update({
      status: 'queued',
      stage: 'queued',
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq('batch_id', batchId)
    .eq('status', 'failed');
  
  // Update batch status
  await supabase
    .from('processing_batches')
    .update({
      status: 'processing',
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', batchId);
  
  // Process the items
  const sourceIds = failedItems.map(item => item.source_id);
  
  // Run the batch processing again with the same parameters
  return processBatch(
    sourceIds,
    batch.batch_type,
    batch.parameters,
    1, // Use lower concurrency for retries
    progressCallback
  );
} 