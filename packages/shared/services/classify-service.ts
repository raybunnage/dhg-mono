/**
 * ClassifyService
 * 
 * Service for managing subject classifications and classification operations
 */
import { SupabaseClientService } from './supabase-client';
import { Logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Classification data interface
 */
export interface Classification {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

/**
 * Classification hierarchy interface for nested structures
 */
export interface ClassificationHierarchy extends Classification {
  children?: ClassificationHierarchy[];
}

/**
 * Subject classification service implementation
 */
export class ClassifyService {
  private static instance: ClassifyService;
  private supabaseService: SupabaseClientService;
  private tableName = 'subject_classifications';
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
    Logger.debug('ClassifyService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): ClassifyService {
    if (!ClassifyService.instance) {
      ClassifyService.instance = new ClassifyService();
    }
    return ClassifyService.instance;
  }

  /**
   * Get all classifications
   */
  public async getAllClassifications(): Promise<Classification[]> {
    try {
      Logger.debug('Getting all classifications');
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        Logger.error(`Error getting classifications: ${error.message}`);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception in getAllClassifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get classification by ID
   */
  public async getClassificationById(id: string): Promise<Classification | null> {
    try {
      Logger.debug(`Getting classification by ID: ${id}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // Not found error
          return null;
        }
        Logger.error(`Error getting classification by ID: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      Logger.error(`Exception in getClassificationById: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get classification by name
   */
  public async getClassificationByName(name: string): Promise<Classification | null> {
    try {
      Logger.debug(`Getting classification by name: ${name}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('name', name)
        .maybeSingle();
      
      if (error) {
        Logger.error(`Error getting classification by name: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      Logger.error(`Exception in getClassificationByName: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create a new classification
   */
  public async createClassification(classification: Omit<Classification, 'id' | 'created_at' | 'updated_at'>): Promise<Classification> {
    try {
      Logger.debug(`Creating classification: ${classification.name}`);
      const supabase = this.supabaseService.getClient();
      
      // Check if classification with same name already exists
      const existing = await this.getClassificationByName(classification.name);
      if (existing) {
        throw new Error(`Classification with name "${classification.name}" already exists`);
      }
      
      // Create new classification with auto-generated ID
      const newClassification = {
        ...classification,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_active: classification.is_active ?? true
      };
      
      const { data, error } = await supabase
        .from(this.tableName)
        .insert(newClassification)
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error creating classification: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      Logger.error(`Exception in createClassification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Update an existing classification
   */
  public async updateClassification(id: string, updates: Partial<Omit<Classification, 'id' | 'created_at' | 'updated_at'>>): Promise<Classification> {
    try {
      Logger.debug(`Updating classification: ${id}`);
      const supabase = this.supabaseService.getClient();
      
      // Check if classification exists
      const existing = await this.getClassificationById(id);
      if (!existing) {
        throw new Error(`Classification with ID "${id}" not found`);
      }
      
      // If we're updating the name, check if that name already exists
      if (updates.name && updates.name !== existing.name) {
        const existingWithName = await this.getClassificationByName(updates.name);
        if (existingWithName && existingWithName.id !== id) {
          throw new Error(`Another classification with name "${updates.name}" already exists`);
        }
      }
      
      const updatedClassification = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from(this.tableName)
        .update(updatedClassification)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        Logger.error(`Error updating classification: ${error.message}`);
        throw error;
      }
      
      return data;
    } catch (error) {
      Logger.error(`Exception in updateClassification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Delete a classification
   */
  public async deleteClassification(id: string): Promise<boolean> {
    try {
      Logger.debug(`Deleting classification: ${id}`);
      const supabase = this.supabaseService.getClient();
      
      // Check if classification exists
      const existing = await this.getClassificationById(id);
      if (!existing) {
        throw new Error(`Classification with ID "${id}" not found`);
      }
      
      // Check if any classifications have this as a parent
      const { data: children, error: childrenError } = await supabase
        .from(this.tableName)
        .select('id')
        .eq('parent_id', id);
      
      if (childrenError) {
        Logger.error(`Error checking for child classifications: ${childrenError.message}`);
        throw childrenError;
      }
      
      if (children && children.length > 0) {
        throw new Error(`Cannot delete classification "${existing.name}" as it has ${children.length} child classifications`);
      }
      
      // Delete the classification
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);
      
      if (error) {
        Logger.error(`Error deleting classification: ${error.message}`);
        throw error;
      }
      
      return true;
    } catch (error) {
      Logger.error(`Exception in deleteClassification: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get classifications by category
   */
  public async getClassificationsByCategory(category: string): Promise<Classification[]> {
    try {
      Logger.debug(`Getting classifications by category: ${category}`);
      const supabase = this.supabaseService.getClient();
      
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('category', category)
        .order('name', { ascending: true });
      
      if (error) {
        Logger.error(`Error getting classifications by category: ${error.message}`);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception in getClassificationsByCategory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Get hierarchical classification structure
   */
  public async getClassificationHierarchy(): Promise<ClassificationHierarchy[]> {
    try {
      Logger.debug('Getting classification hierarchy');
      const supabase = this.supabaseService.getClient();
      
      // Get all classifications
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        Logger.error(`Error getting classifications: ${error.message}`);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Build hierarchy
      const classifications = data as Classification[];
      const rootClassifications: ClassificationHierarchy[] = [];
      const classificationMap = new Map<string, ClassificationHierarchy>();
      
      // First pass: Create map of all classifications
      classifications.forEach(classification => {
        classificationMap.set(classification.id, { ...classification, children: [] });
      });
      
      // Second pass: Build hierarchy
      classifications.forEach(classification => {
        const classHierarchy = classificationMap.get(classification.id);
        if (!classHierarchy) return;
        
        if (classification.parent_id && classificationMap.has(classification.parent_id)) {
          // Add as child to parent
          const parent = classificationMap.get(classification.parent_id);
          if (parent && parent.children) {
            parent.children.push(classHierarchy);
          }
        } else {
          // Add as root classification
          rootClassifications.push(classHierarchy);
        }
      });
      
      return rootClassifications;
    } catch (error) {
      Logger.error(`Exception in getClassificationHierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Create multiple classifications in batch
   */
  public async createClassificationsBatch(classifications: Omit<Classification, 'id' | 'created_at' | 'updated_at'>[]): Promise<Classification[]> {
    try {
      Logger.debug(`Creating ${classifications.length} classifications in batch`);
      const supabase = this.supabaseService.getClient();
      
      // Prepare batch with generated IDs and timestamps
      const now = new Date().toISOString();
      const batch = classifications.map(classification => ({
        ...classification,
        id: uuidv4(),
        created_at: now,
        updated_at: now,
        is_active: classification.is_active ?? true
      }));
      
      const { data, error } = await supabase
        .from(this.tableName)
        .insert(batch)
        .select();
      
      if (error) {
        Logger.error(`Error creating classifications batch: ${error.message}`);
        throw error;
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception in createClassificationsBatch: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Test database connection to subject_classifications table
   */
  public async testConnection(): Promise<{ success: boolean, error?: string, details?: any }> {
    try {
      Logger.debug('Testing connection to subject_classifications table');
      const supabase = this.supabaseService.getClient();
      
      // Try to query for a single record as a test
      const { data, error } = await supabase
        .from(this.tableName)
        .select('id')
        .limit(1);
      
      if (error) {
        Logger.error(`Connection test failed: ${error.message}`);
        return { 
          success: false, 
          error: error.message,
          details: { code: error.code, hint: error.hint }
        };
      }
      
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Exception in testConnection: ${message}`);
      return { success: false, error: message };
    }
  }
}

// Export singleton instance
export const classifyService = ClassifyService.getInstance();