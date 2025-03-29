/**
 * Adapter for expert service
 * 
 * This adapter will eventually use the shared expert-service.
 * It's designed as an adapter to make the future transition smoother.
 * 
 * NOTES FOR MIGRATION:
 * 1. This is a temporary adapter that will be replaced with the shared service
 * 2. Keep the interface consistent with the shared service
 * 3. When migrating, update the implementation to use the shared service but
 *    maintain the same interface
 */
import { Expert, ExpertDocument, EnhancedExpertProfile } from '@/types/expert';
import { Logger } from '@/utils/logger';
import { expertService } from './expert-service';

export class ExpertServiceAdapter {
  /**
   * Get all experts
   */
  async getAllExperts(): Promise<Expert[]> {
    try {
      Logger.debug('Getting all experts via adapter');
      return await expertService.getAllExperts();
    } catch (error) {
      Logger.error('Error getting all experts:', error);
      return [];
    }
  }
  
  /**
   * Get expert by ID
   */
  async getExpertById(id: string): Promise<Expert | null> {
    try {
      Logger.debug(`Getting expert by ID: ${id}`);
      return await expertService.getExpertById(id);
    } catch (error) {
      Logger.error(`Error getting expert ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Create or update an expert
   */
  async upsertExpert(expertData: Partial<Expert>): Promise<Expert | null> {
    try {
      Logger.debug(`Upserting expert: ${expertData.id || 'new'}`);
      return await expertService.upsertExpert(expertData);
    } catch (error) {
      Logger.error(`Error upserting expert:`, error);
      return null;
    }
  }
  
  /**
   * Get basic expert info
   */
  async getExpertBasicInfo(id: string): Promise<{ expert_name: string; full_name: string | null } | null> {
    try {
      Logger.debug(`Getting basic info for expert: ${id}`);
      return await expertService.getExpertBasicInfo(id);
    } catch (error) {
      Logger.error(`Error getting basic info for expert ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Create a new expert
   */
  async createExpert(expertData: Partial<Expert>): Promise<Expert | null> {
    try {
      Logger.debug('Creating new expert');
      return await expertService.createExpert(expertData);
    } catch (error) {
      Logger.error('Error creating expert:', error);
      return null;
    }
  }
  
  /**
   * Update an expert
   */
  async updateExpert(id: string, expertData: Partial<Expert>): Promise<Expert | null> {
    try {
      Logger.debug(`Updating expert: ${id}`);
      return await expertService.updateExpert(id, expertData);
    } catch (error) {
      Logger.error(`Error updating expert ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Delete an expert
   */
  async deleteExpert(id: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting expert: ${id}`);
      return await expertService.deleteExpert(id);
    } catch (error) {
      Logger.error(`Error deleting expert ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Get expert documents
   */
  async getExpertDocuments(expertId?: string): Promise<ExpertDocument[]> {
    try {
      Logger.debug(`Getting documents for expert: ${expertId || 'all'}`);
      return await expertService.getExpertDocuments(expertId);
    } catch (error) {
      Logger.error(`Error getting expert documents:`, error);
      return [];
    }
  }
  
  /**
   * Get expert document by ID
   */
  async getExpertDocumentById(id: string): Promise<ExpertDocument | null> {
    try {
      Logger.debug(`Getting expert document by ID: ${id}`);
      return await expertService.getExpertDocumentById(id);
    } catch (error) {
      Logger.error(`Error getting expert document ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Create a new expert document
   */
  async createExpertDocument(documentData: Partial<ExpertDocument>): Promise<ExpertDocument | null> {
    try {
      Logger.debug('Creating new expert document');
      return await expertService.createExpertDocument(documentData);
    } catch (error) {
      Logger.error('Error creating expert document:', error);
      return null;
    }
  }
  
  /**
   * Update an expert document
   */
  async updateExpertDocument(id: string, documentData: Partial<ExpertDocument>): Promise<ExpertDocument | null> {
    try {
      Logger.debug(`Updating expert document: ${id}`);
      return await expertService.updateExpertDocument(id, documentData);
    } catch (error) {
      Logger.error(`Error updating expert document ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Delete an expert document
   */
  async deleteExpertDocument(id: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting expert document: ${id}`);
      return await expertService.deleteExpertDocument(id);
    } catch (error) {
      Logger.error(`Error deleting expert document ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Get source info
   */
  async getSourceInfo(sourceId: string): Promise<{ title: string } | null> {
    try {
      Logger.debug(`Getting source info: ${sourceId}`);
      return await expertService.getSourceInfo(sourceId);
    } catch (error) {
      Logger.error(`Error getting source info ${sourceId}:`, error);
      return null;
    }
  }
  
  /**
   * Get all sources
   */
  async getSources(): Promise<{ id: string, title: string }[]> {
    try {
      Logger.debug('Getting all sources');
      return await expertService.getSources();
    } catch (error) {
      Logger.error('Error getting sources:', error);
      return [];
    }
  }
  
  /**
   * Get enhanced profile for an expert
   */
  async getEnhancedProfile(expertId: string): Promise<EnhancedExpertProfile | null> {
    try {
      Logger.debug(`Getting enhanced profile for expert: ${expertId}`);
      return await expertService.getEnhancedProfile(expertId);
    } catch (error) {
      Logger.error(`Error getting enhanced profile for expert ${expertId}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const expertServiceAdapter = new ExpertServiceAdapter();