import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../utils';

export interface ProcessingTask {
  id: string;
  type: 'convert' | 'transcribe' | 'upload' | 'summarize';
  fileId: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  metadata?: any;
}

export class ProcessingQueue {
  private supabase: SupabaseClient<any>;
  private queue: ProcessingTask[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number;

  constructor(supabase: SupabaseClient<any>, maxConcurrent: number = 3) {
    this.supabase = supabase;
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add task to queue
   */
  public async addTask(task: Omit<ProcessingTask, 'id' | 'retryCount' | 'status'>): Promise<void> {
    const newTask: ProcessingTask = {
      ...task,
      id: `${task.type}-${task.fileId}-${Date.now()}`,
      retryCount: 0,
      status: 'pending'
    };

    this.queue.push(newTask);
    Logger.info(`Added task to queue: ${newTask.id}`);
    
    // Start processing if not at capacity
    this.processNext();
  }

  /**
   * Process next task in queue
   */
  private async processNext(): Promise<void> {
    if (this.processing.size >= this.maxConcurrent) {
      return;
    }

    const task = this.queue.find(t => t.status === 'pending');
    if (!task) {
      return;
    }

    task.status = 'processing';
    this.processing.add(task.id);

    try {
      await this.processWithRetry(task);
      task.status = 'completed';
      Logger.info(`Task completed: ${task.id}`);
    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      Logger.error(`Task failed: ${task.id} - ${error.message}`);
    } finally {
      this.processing.delete(task.id);
      this.processNext(); // Process next task
    }
  }

  /**
   * Process task with retry logic
   */
  private async processWithRetry(task: ProcessingTask): Promise<void> {
    while (task.retryCount <= task.maxRetries) {
      try {
        Logger.info(`Processing task: ${task.id} (attempt ${task.retryCount + 1}/${task.maxRetries + 1})`);
        
        // Execute the task based on type
        await this.executeTask(task);
        
        // Update status in database
        await this.updateProcessingStatus(task.fileId, task.type, 'completed');
        
        return; // Success
      } catch (error: any) {
        task.retryCount++;
        task.error = error.message;
        
        Logger.error(`Task ${task.id} failed: ${error.message}`);
        
        if (task.retryCount <= task.maxRetries) {
          // Wait before retry with exponential backoff
          const waitTime = Math.min(1000 * Math.pow(2, task.retryCount - 1), 30000);
          Logger.info(`Retrying task ${task.id} in ${waitTime}ms...`);
          await this.sleep(waitTime);
        } else {
          // Max retries exceeded
          await this.updateProcessingStatus(task.fileId, task.type, 'failed', error.message);
          throw error;
        }
      }
    }
  }

  /**
   * Execute specific task type
   */
  private async executeTask(task: ProcessingTask): Promise<void> {
    switch (task.type) {
      case 'convert':
        await this.executeConvert(task);
        break;
      case 'transcribe':
        await this.executeTranscribe(task);
        break;
      case 'upload':
        await this.executeUpload(task);
        break;
      case 'summarize':
        await this.executeSummarize(task);
        break;
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Execute conversion task
   */
  private async executeConvert(task: ProcessingTask): Promise<void> {
    // This would call the actual conversion logic
    Logger.info(`Converting file: ${task.fileId}`);
    
    // Simulate conversion
    if (Math.random() < 0.1) {
      throw new Error('Simulated conversion failure');
    }
    
    await this.sleep(2000);
  }

  /**
   * Execute transcription task
   */
  private async executeTranscribe(task: ProcessingTask): Promise<void> {
    // This would call the actual transcription logic
    Logger.info(`Transcribing file: ${task.fileId}`);
    
    // Simulate transcription
    if (Math.random() < 0.1) {
      throw new Error('Simulated transcription failure');
    }
    
    await this.sleep(3000);
  }

  /**
   * Execute upload task
   */
  private async executeUpload(task: ProcessingTask): Promise<void> {
    // This would call the actual upload logic
    Logger.info(`Uploading file: ${task.fileId}`);
    
    // Simulate upload
    if (Math.random() < 0.1) {
      throw new Error('Simulated upload failure');
    }
    
    await this.sleep(1000);
  }

  /**
   * Execute summarization task
   */
  private async executeSummarize(task: ProcessingTask): Promise<void> {
    // This would call the actual summarization logic
    Logger.info(`Summarizing file: ${task.fileId}`);
    
    // Simulate summarization
    if (Math.random() < 0.05) {
      throw new Error('Simulated summarization failure');
    }
    
    await this.sleep(2000);
  }

  /**
   * Update processing status in database
   */
  private async updateProcessingStatus(
    fileId: string, 
    taskType: string, 
    status: string, 
    error?: string
  ): Promise<void> {
    try {
      const update: any = {
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        update[`${taskType}_completed_at`] = new Date().toISOString();
      }

      if (status === 'failed' && error) {
        update.error_message = error;
        update.last_error_at = new Date().toISOString();
        update.error_count = this.supabase.sql`COALESCE(error_count, 0) + 1`;
      }

      await this.supabase
        .from('media_processing_status')
        .update(update)
        .eq('expert_document_id', fileId);

    } catch (error: any) {
      Logger.error(`Failed to update processing status: ${error.message}`);
    }
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    const stats = {
      total: this.queue.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    for (const task of this.queue) {
      stats[task.status]++;
    }

    return stats;
  }

  /**
   * Clear completed and failed tasks
   */
  public clearCompleted(): void {
    const before = this.queue.length;
    this.queue = this.queue.filter(t => t.status === 'pending' || t.status === 'processing');
    const removed = before - this.queue.length;
    Logger.info(`Cleared ${removed} completed/failed tasks from queue`);
  }

  /**
   * Retry failed tasks
   */
  public retryFailed(): void {
    const failedTasks = this.queue.filter(t => t.status === 'failed');
    
    for (const task of failedTasks) {
      task.status = 'pending';
      task.retryCount = 0;
      task.error = undefined;
    }

    Logger.info(`Reset ${failedTasks.length} failed tasks for retry`);
    this.processNext();
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}