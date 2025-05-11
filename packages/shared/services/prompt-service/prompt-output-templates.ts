/**
 * Prompt Output Template Service
 * 
 * Handles JSON output templates that can be associated with prompts
 * to control the expected output format from Claude AI.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../utils';
import { SupabaseClientService } from '../supabase-client';

/**
 * Prompt output template data structure
 */
export interface PromptOutputTemplate {
  id: string;
  name: string;
  description?: string;
  template: TemplateDefinition;
  created_at: string;
  updated_at: string;
}

/**
 * Template field definition
 */
export interface TemplateFieldDefinition {
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  items?: {
    type: string;
    properties?: Record<string, any>;
  };
  properties?: Record<string, TemplateFieldDefinition>;
}

/**
 * Template definition (collection of fields)
 */
export type TemplateDefinition = Record<string, TemplateFieldDefinition>;

/**
 * Template association data structure
 */
export interface PromptTemplateAssociation {
  id: string;
  prompt_id: string;
  template_id: string;
  priority: number;
  created_at: string;
  updated_at: string;
}

/**
 * Template with association data
 */
export interface TemplateWithAssociation extends PromptOutputTemplate {
  association: {
    id: string;
    priority: number;
  };
}

/**
 * Prompt Output Template Service Implementation
 */
export class PromptOutputTemplateService {
  private static instance: PromptOutputTemplateService;
  private supabaseService: SupabaseClientService;
  
  /**
   * Create a new PromptOutputTemplate service
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    // Initialize services
    this.supabaseService = SupabaseClientService.getInstance();
    
    Logger.debug('PromptOutputTemplateService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PromptOutputTemplateService {
    if (!PromptOutputTemplateService.instance) {
      PromptOutputTemplateService.instance = new PromptOutputTemplateService();
    }
    return PromptOutputTemplateService.instance;
  }
  
  /**
   * Get all templates
   */
  public async getAllTemplates(): Promise<PromptOutputTemplate[]> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompt_output_templates')
        .select('*')
        .order('name');
        
      if (error) {
        Logger.error(`Error fetching templates: ${error.message}`);
        throw error;
      }
      
      return data as PromptOutputTemplate[];
    } catch (error) {
      Logger.error(`Error in getAllTemplates: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Get template by ID
   */
  public async getTemplateById(templateId: string): Promise<PromptOutputTemplate | null> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompt_output_templates')
        .select('*')
        .eq('id', templateId)
        .single();
        
      if (error) {
        Logger.error(`Error fetching template by ID: ${error.message}`);
        throw error;
      }
      
      return data as PromptOutputTemplate;
    } catch (error) {
      Logger.error(`Error in getTemplateById: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Get template by name
   */
  public async getTemplateByName(templateName: string): Promise<PromptOutputTemplate | null> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompt_output_templates')
        .select('*')
        .eq('name', templateName)
        .single();
        
      if (error) {
        if (error.code === 'PGRST116') { // Handle "No rows found" error gracefully
          return null;
        }
        Logger.error(`Error fetching template by name: ${error.message}`);
        throw error;
      }
      
      return data as PromptOutputTemplate;
    } catch (error) {
      Logger.error(`Error in getTemplateByName: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Create a new template
   */
  public async createTemplate(
    templateName: string,
    templateDefinition: TemplateDefinition,
    description?: string
  ): Promise<PromptOutputTemplate> {
    try {
      // Validate the template definition
      this.validateTemplateDefinition(templateDefinition);
      
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompt_output_templates')
        .insert({
          name: templateName,
          description,
          template: templateDefinition,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) {
        Logger.error(`Error creating template: ${error.message}`);
        throw error;
      }
      
      return data as PromptOutputTemplate;
    } catch (error) {
      Logger.error(`Error in createTemplate: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Update an existing template
   */
  public async updateTemplate(
    templateId: string,
    updates: {
      name?: string;
      description?: string;
      template?: TemplateDefinition;
    }
  ): Promise<PromptOutputTemplate> {
    try {
      // If template is provided, validate it
      if (updates.template) {
        this.validateTemplateDefinition(updates.template);
      }
      
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompt_output_templates')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)
        .select()
        .single();
        
      if (error) {
        Logger.error(`Error updating template: ${error.message}`);
        throw error;
      }
      
      return data as PromptOutputTemplate;
    } catch (error) {
      Logger.error(`Error in updateTemplate: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Delete a template
   */
  public async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from('prompt_output_templates')
        .delete()
        .eq('id', templateId);
        
      if (error) {
        Logger.error(`Error deleting template: ${error.message}`);
        throw error;
      }
      
      return true;
    } catch (error) {
      Logger.error(`Error in deleteTemplate: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Associate a template with a prompt
   */
  public async associateTemplateWithPrompt(
    promptId: string,
    templateId: string,
    priority: number = 1
  ): Promise<PromptTemplateAssociation> {
    try {
      const supabase = this.supabaseService.getClient();
      
      // Check if association already exists
      const { data: existingAssoc, error: checkError } = await supabase
        .from('prompt_template_associations')
        .select('*')
        .eq('prompt_id', promptId)
        .eq('template_id', templateId)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') { // Something other than "No rows found"
        Logger.error(`Error checking for existing association: ${checkError.message}`);
        throw checkError;
      }
      
      if (existingAssoc) {
        // Update the existing association
        const { data, error } = await supabase
          .from('prompt_template_associations')
          .update({
            priority,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAssoc.id)
          .select()
          .single();
          
        if (error) {
          Logger.error(`Error updating association: ${error.message}`);
          throw error;
        }
        
        return data as PromptTemplateAssociation;
      } else {
        // Create a new association
        const { data, error } = await supabase
          .from('prompt_template_associations')
          .insert({
            prompt_id: promptId,
            template_id: templateId,
            priority,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
          
        if (error) {
          Logger.error(`Error creating association: ${error.message}`);
          throw error;
        }
        
        return data as PromptTemplateAssociation;
      }
    } catch (error) {
      Logger.error(`Error in associateTemplateWithPrompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Dissociate a template from a prompt
   */
  public async dissociateTemplateFromPrompt(
    promptId: string,
    templateId: string
  ): Promise<boolean> {
    try {
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from('prompt_template_associations')
        .delete()
        .eq('prompt_id', promptId)
        .eq('template_id', templateId);
        
      if (error) {
        Logger.error(`Error dissociating template: ${error.message}`);
        throw error;
      }
      
      return true;
    } catch (error) {
      Logger.error(`Error in dissociateTemplateFromPrompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Get all templates associated with a prompt
   */
  public async getTemplatesForPrompt(promptId: string): Promise<TemplateWithAssociation[]> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase
        .from('prompt_template_associations')
        .select(`
          id,
          priority,
          prompt_output_templates (
            id,
            name,
            description,
            template,
            created_at,
            updated_at
          )
        `)
        .eq('prompt_id', promptId)
        .order('priority');
        
      if (error) {
        Logger.error(`Error fetching templates for prompt: ${error.message}`);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Transform the result to the expected format
      return data.map(item => ({
        id: item.prompt_output_templates.id,
        name: item.prompt_output_templates.name,
        description: item.prompt_output_templates.description,
        template: item.prompt_output_templates.template,
        created_at: item.prompt_output_templates.created_at,
        updated_at: item.prompt_output_templates.updated_at,
        association: {
          id: item.id,
          priority: item.priority
        }
      }));
    } catch (error) {
      Logger.error(`Error in getTemplatesForPrompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  /**
   * Validate a template definition
   */
  private validateTemplateDefinition(template: TemplateDefinition): void {
    // Make sure template is an object
    if (typeof template !== 'object' || template === null || Array.isArray(template)) {
      throw new Error('Template definition must be an object');
    }
    
    // Check that it has at least one field
    if (Object.keys(template).length === 0) {
      throw new Error('Template definition must have at least one field');
    }
    
    // Check each field
    for (const [fieldName, fieldDef] of Object.entries(template)) {
      // Check required properties
      if (typeof fieldDef.description !== 'string') {
        throw new Error(`Field ${fieldName} must have a description string`);
      }
      
      if (typeof fieldDef.required !== 'boolean') {
        throw new Error(`Field ${fieldName} must have a required boolean`);
      }
      
      if (!['string', 'number', 'boolean', 'array', 'object'].includes(fieldDef.type)) {
        throw new Error(`Field ${fieldName} must have a valid type (string, number, boolean, array, object)`);
      }
      
      // Additional checks for array type
      if (fieldDef.type === 'array' && !fieldDef.items) {
        throw new Error(`Array field ${fieldName} must have an 'items' definition`);
      }
      
      // Additional checks for object type
      if (fieldDef.type === 'object' && !fieldDef.properties) {
        throw new Error(`Object field ${fieldName} must have a 'properties' definition`);
      }
    }
  }
  
  /**
   * Generate a JSON example from template definition
   */
  public generateExampleFromTemplate(template: TemplateDefinition): Record<string, any> {
    const example: Record<string, any> = {};
    
    for (const [fieldName, fieldDef] of Object.entries(template)) {
      switch (fieldDef.type) {
        case 'string':
          example[fieldName] = `Example ${fieldDef.description}`;
          break;
        case 'number':
          example[fieldName] = 0.85;
          break;
        case 'boolean':
          example[fieldName] = true;
          break;
        case 'array':
          if (fieldDef.items?.type === 'object' && fieldDef.items.properties) {
            example[fieldName] = [
              this.generateExampleFromTemplate(fieldDef.items.properties as TemplateDefinition),
              this.generateExampleFromTemplate(fieldDef.items.properties as TemplateDefinition)
            ];
          } else if (fieldDef.items?.type === 'string') {
            example[fieldName] = ['Item 1', 'Item 2', 'Item 3'];
          } else {
            example[fieldName] = [];
          }
          break;
        case 'object':
          if (fieldDef.properties) {
            example[fieldName] = this.generateExampleFromTemplate(fieldDef.properties);
          } else {
            example[fieldName] = {};
          }
          break;
      }
    }
    
    return example;
  }
  
  /**
   * Generate a prompt instruction section for templates
   */
  public generateTemplateInstructions(templates: PromptOutputTemplate[]): string {
    if (!templates || templates.length === 0) {
      return '';
    }
    
    const lines: string[] = [];
    
    lines.push('## Expected Output Format');
    lines.push('');
    lines.push('Please provide your response as a JSON object with the following structure:');
    lines.push('');
    lines.push('```json');
    
    // Start with an empty example
    const example: Record<string, any> = {};
    
    // Merge all templates in order
    const mergedTemplate: TemplateDefinition = {};
    for (const template of templates) {
      Object.assign(mergedTemplate, template.template);
    }
    
    // Generate the example from the merged template
    const mergedExample = this.generateExampleFromTemplate(mergedTemplate);
    
    lines.push(JSON.stringify(mergedExample, null, 2));
    lines.push('```');
    lines.push('');
    
    lines.push('## Field Descriptions');
    lines.push('');
    
    // Add field descriptions
    for (const template of templates) {
      if (template.description) {
        lines.push(`### ${template.name}: ${template.description}`);
      } else {
        lines.push(`### ${template.name}`);
      }
      lines.push('');
      
      for (const [fieldName, fieldDef] of Object.entries(template.template)) {
        lines.push(`- **${fieldName}** (${fieldDef.type}${fieldDef.required ? ', required' : ''}): ${fieldDef.description}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Merge multiple templates into one
   */
  public mergeTemplates(templates: PromptOutputTemplate[]): TemplateDefinition {
    const mergedTemplate: TemplateDefinition = {};
    
    for (const template of templates) {
      Object.assign(mergedTemplate, template.template);
    }
    
    return mergedTemplate;
  }
}

// Export singleton instance
export const promptOutputTemplateService = PromptOutputTemplateService.getInstance();