import { supabase } from "@/integrations/supabase/client";
import { ExpertInterface, ExpertDocument, expertUtils, EnhancedExpertProfile } from "@/types/expert";
import { Logger } from "@/utils/logger";

export interface ExpertBasicInfo {
  expert_name: string;
  full_name: string | null;
}

export interface SourceInfo {
  title: string;
}

/**
 * MIGRATION PLAN:
 * This service is intended to be a temporary solution to abstract Supabase calls.
 * The next steps in the migration process are:
 * 
 * 1. Add the shared package as a dependency in package.json
 * 2. Update the tsconfig.json to properly resolve shared package paths
 * 3. Replace direct supabase calls with the shared supabaseService
 * 4. Eventually refactor this service to extend or use the shared service
 */

/**
 * Service class for managing expert data
 */
export class ExpertService {
  /**
   * Get all experts ordered by name
   */
  async getAllExperts(): Promise<ExpertInterface[]> {
    try {
      Logger.debug('Getting all experts');
      
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .order('expert_name');
      
      if (error) throw error;
      
      return (data || []).map(expert => expertUtils.normalizeExpert(expert));
    } catch (error) {
      Logger.error('Error getting experts:', error);
      return [];
    }
  }
  
  /**
   * Get expert by ID
   */
  async getExpertById(id: string): Promise<ExpertInterface | null> {
    try {
      Logger.debug(`Getting expert by ID: ${id}`);
      
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return expertUtils.normalizeExpert(data);
    } catch (error) {
      Logger.error(`Error getting expert by ID ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Get expert basic info by ID
   */
  async getExpertBasicInfo(id: string): Promise<ExpertBasicInfo | null> {
    try {
      Logger.debug(`Getting expert basic info by ID: ${id}`);
      
      const { data, error } = await supabase
        .from('experts')
        .select('expert_name, full_name')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      Logger.error(`Error getting expert basic info for ID ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Get source info by ID
   */
  async getSourceInfo(id: string): Promise<SourceInfo | null> {
    try {
      Logger.debug(`Getting source info by ID: ${id}`);
      
      const { data, error } = await supabase
        .from('sources_google')
        .select('title')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return data;
    } catch (error) {
      Logger.error(`Error getting source info for ID ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Create or update expert
   */
  async upsertExpert(expert: Partial<ExpertInterface>): Promise<ExpertInterface | null> {
    try {
      const now = new Date().toISOString();
      const expertData = {
        ...expert,
        updated_at: now,
        created_at: expert.id ? expert.created_at : now
      };
      
      Logger.debug(`Upserting expert: ${expert.expert_name}`);
      
      const { data, error } = await supabase
        .from('experts')
        .upsert(expertData)
        .select()
        .single();
      
      if (error) throw error;
      
      return expertUtils.normalizeExpert(data);
    } catch (error) {
      Logger.error(`Error upserting expert:`, error);
      return null;
    }
  }
  
  /**
   * Delete expert by ID
   */
  async deleteExpert(id: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting expert with ID: ${id}`);
      
      const { error } = await supabase
        .from('experts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return true;
    } catch (error) {
      Logger.error(`Error deleting expert with ID ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Get documents for an expert
   */
  async getExpertDocuments(expertId?: string): Promise<ExpertDocument[]> {
    try {
      Logger.debug(`Getting documents for expert${expertId ? ` ID: ${expertId}` : 's'}`);
      
      let query = supabase
        .from('expert_documents')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (expertId) {
        query = query.eq('expert_id', expertId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      Logger.error(`Error getting documents for expert${expertId ? ` ID ${expertId}` : 's'}:`, error);
      return [];
    }
  }
  
  /**
   * Get Google Drive sources
   */
  async getSourcesMap(): Promise<Record<string, string>> {
    try {
      Logger.debug('Getting Google Drive sources map');
      
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, title');
        
      if (error) throw error;
      
      const sourceMap: Record<string, string> = {};
      data?.forEach(source => {
        sourceMap[source.id] = source.title;
      });
      
      return sourceMap;
    } catch (error) {
      Logger.error('Error loading sources map:', error);
      return {};
    }
  }
  
  /**
   * Get all Google Drive sources as array
   */
  async getSources(): Promise<Array<{id: string, title: string}>> {
    try {
      Logger.debug('Getting Google Drive sources');
      
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, title')
        .order('title');
        
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      Logger.error('Error loading sources:', error);
      return [];
    }
  }
  
  /**
   * Get the enhanced profile for an expert
   */
  async getEnhancedProfile(expertId: string): Promise<EnhancedExpertProfile | null> {
    try {
      Logger.debug(`Getting enhanced profile for expert ID: ${expertId}`);
      
      // Get the latest processed document with enhanced profile information
      const { data, error } = await supabase
        .from('expert_documents')
        .select('*')
        .eq('expert_id', expertId)
        .eq('processing_status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (error) throw error;
      
      if (data && data.length > 0 && data[0].processed_content) {
        try {
          const processedContent = data[0].processed_content;
          if (typeof processedContent === 'string') {
            return JSON.parse(processedContent);
          } else {
            return processedContent as EnhancedExpertProfile;
          }
        } catch (parseError) {
          Logger.error('Error parsing enhanced profile:', parseError);
        }
      }
      
      return null;
    } catch (error) {
      Logger.error(`Error getting enhanced profile for expert ID ${expertId}:`, error);
      return null;
    }
  }
  
  /**
   * Get expert document by ID
   */
  async getExpertDocumentById(id: string): Promise<ExpertDocument | null> {
    try {
      Logger.debug(`Getting expert document by ID: ${id}`);
      
      const { data, error } = await supabase
        .from('expert_documents')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      
      return data;
    } catch (error) {
      Logger.error(`Error getting expert document by ID ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Update expert document
   */
  async updateExpertDocument(id: string, updates: Partial<ExpertDocument>): Promise<ExpertDocument | null> {
    try {
      Logger.debug(`Updating expert document ID: ${id}`);
      
      const { data, error } = await supabase
        .from('expert_documents')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      
      return data;
    } catch (error) {
      Logger.error(`Error updating expert document ID ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Delete expert document
   */
  async deleteExpertDocument(id: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting expert document ID: ${id}`);
      
      const { error } = await supabase
        .from('expert_documents')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      return true;
    } catch (error) {
      Logger.error(`Error deleting expert document ID ${id}:`, error);
      return false;
    }
  }
  
  /**
   * Create expert document
   */
  async createExpertDocument(document: Partial<ExpertDocument>): Promise<ExpertDocument | null> {
    try {
      Logger.debug(`Creating expert document for expert ID: ${document.expert_id}`);
      
      const now = new Date().toISOString();
      const documentData = {
        ...document,
        processing_status: document.processing_status || 'pending',
        created_at: now,
        updated_at: now
      };
      
      const { data, error } = await supabase
        .from('expert_documents')
        .insert(documentData)
        .select()
        .single();
        
      if (error) throw error;
      
      return data;
    } catch (error) {
      Logger.error(`Error creating expert document:`, error);
      return null;
    }
  }
}

// Export a singleton instance
export const expertService = new ExpertService();