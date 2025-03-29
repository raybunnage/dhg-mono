/**
 * This service will eventually use the shared document-pipeline-service
 * For now, it provides a simplified interface that will make migration easier later
 */
import { ExpertDocument } from '@/types/expert';
import { Logger } from '@/utils/logger';
import { supabase } from '@/integrations/supabase/client';
import { expertService } from './expert-service';

export class DocumentProcessingService {
  /**
   * Process a document to extract structured information
   */
  async processDocument(document: ExpertDocument): Promise<boolean> {
    try {
      Logger.debug(`Processing document: ${document.id}`);
      
      // Set processing status to indicate work has started
      const updatedDoc = await expertService.updateExpertDocument(document.id, {
        processing_status: 'processing'
      });
      
      if (!updatedDoc) {
        throw new Error(`Failed to update document status for ${document.id}`);
      }
      
      // In the real implementation, this would call the Claude API
      // or the shared document-pipeline service
      // For now, we're simulating success with a timeout
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create a simple structured result
      // This is where the real implementation would parse the document
      const expertName = await this.getExpertName(document.expert_id);
      const processingResult = {
        name: expertName,
        title: "Sample Title: Processed by Document Processing Service",
        bio: document.raw_content?.substring(0, 200) + '...' || 'No content available',
        expertise: ['Sample Expertise 1', 'Sample Expertise 2'],
        education: [
          {
            degree: 'Sample Degree',
            field: 'Sample Field',
            institution: 'Sample University',
            year: '2020'
          }
        ],
        processed_at: new Date().toISOString()
      };
      
      // Update document with processed content
      const result = await expertService.updateExpertDocument(document.id, {
        processed_content: processingResult,
        processing_status: 'completed'
      });
      
      return !!result;
    } catch (error) {
      Logger.error(`Error processing document ${document.id}:`, error);
      
      // Update status to indicate failure
      await expertService.updateExpertDocument(document.id, {
        processing_status: 'failed'
      });
      
      return false;
    }
  }
  
  /**
   * Helper method to get expert name for documents
   */
  private async getExpertName(expertId: string): Promise<string> {
    try {
      const expertInfo = await expertService.getExpertBasicInfo(expertId);
      return expertInfo?.expert_name || 'Unknown Expert';
    } catch (error) {
      Logger.error(`Error getting expert name:`, error);
      return 'Unknown Expert';
    }
  }
  
  /**
   * Process multiple documents in sequence
   */
  async processMultipleDocuments(documents: ExpertDocument[]): Promise<{
    success: number;
    failed: number;
  }> {
    let success = 0;
    let failed = 0;
    
    Logger.info(`Processing ${documents.length} documents`);
    
    for (const doc of documents) {
      const result = await this.processDocument(doc);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }
    
    Logger.info(`Completed processing. Success: ${success}, Failed: ${failed}`);
    
    return { success, failed };
  }
  
  /**
   * Queue unprocessed documents for processing
   */
  async queueUnprocessedDocuments(limit: number = 5): Promise<number> {
    try {
      Logger.debug(`Queuing up to ${limit} unprocessed documents`);
      
      // Find documents that need processing
      const { data, error } = await supabase
        .from('expert_documents')
        .select('*')
        .in('processing_status', ['pending', 'failed'])
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        Logger.info('No documents to process');
        return 0;
      }
      
      Logger.info(`Found ${data.length} documents to process`);
      
      // Process them
      const result = await this.processMultipleDocuments(data);
      return result.success;
    } catch (error) {
      Logger.error('Error queuing unprocessed documents:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const documentProcessingService = new DocumentProcessingService();