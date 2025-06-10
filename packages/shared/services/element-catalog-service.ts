/**
 * Element Catalog Service - Manages app features, CLI commands, and services catalog
 */

import { SupabaseClientService } from './supabase-client';

export interface AppFeature {
  id: string;
  app_name: string;
  feature_type: 'page' | 'component' | 'hook' | 'service' | 'utility';
  feature_name: string;
  file_path: string;
  description?: string;
  parent_feature_id?: string;
  metadata?: any;
}

export interface CLICommand {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  command_name: string;
  description?: string;
  example_usage?: string;
}

export interface SharedService {
  id: string;
  service_name: string;
  service_path?: string;
  description?: string;
  category?: string;
  is_singleton?: boolean;
}

export interface TaskElement {
  element_type: 'app_feature' | 'cli_command' | 'shared_service';
  element_id: string;
  category: string;
  subcategory: string;
  name: string;
  path?: string;
  description?: string;
}

export class ElementCatalogService {
  private static instance: ElementCatalogService;
  private supabase;

  private constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  static getInstance(): ElementCatalogService {
    if (!ElementCatalogService.instance) {
      ElementCatalogService.instance = new ElementCatalogService();
    }
    return ElementCatalogService.instance;
  }

  /**
   * Get app features for a specific app
   */
  async getAppFeatures(appName: string): Promise<AppFeature[]> {
    const { data, error } = await this.supabase
      .rpc('get_app_features', { p_app_name: appName });

    if (error) {
      console.error('Error fetching app features:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get CLI commands for a specific pipeline
   */
  async getCLICommands(pipelineName: string): Promise<CLICommand[]> {
    const { data, error } = await this.supabase
      .from('command_definitions')
      .select(`
        id,
        command_name,
        description,
        example_usage,
        pipeline_id,
        command_pipelines!inner(
          id,
          name
        )
      `)
      .eq('command_pipelines.name', pipelineName)
      .eq('status', 'active')
      .order('display_order');

    if (error) {
      console.error('Error fetching CLI commands:', error);
      return [];
    }

    // Transform the data to flatten the structure
    return (data || []).map(cmd => ({
      id: cmd.id,
      pipeline_id: cmd.pipeline_id,
      pipeline_name: cmd.command_pipelines.name,
      command_name: cmd.command_name,
      description: cmd.description,
      example_usage: cmd.example_usage
    }));
  }

  /**
   * Get all shared services
   */
  async getSharedServices(category?: string): Promise<SharedService[]> {
    let query = this.supabase
      .from('shared_services')
      .select('*')
      .order('service_name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching shared services:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get available elements for task creation based on selection
   */
  async getAvailableElements(
    type: 'app' | 'cli_pipeline' | 'service',
    selection: string
  ): Promise<TaskElement[]> {
    const elements: TaskElement[] = [];

    if (type === 'app') {
      const features = await this.getAppFeatures(selection);
      features.forEach(feature => {
        elements.push({
          element_type: 'app_feature',
          element_id: feature.id,
          category: feature.app_name,
          subcategory: feature.feature_type,
          name: feature.feature_name,
          path: feature.file_path,
          description: feature.description
        });
      });
    } else if (type === 'cli_pipeline') {
      // Extract pipeline name from "cli-{pipeline}" format
      const pipelineName = selection.startsWith('cli-') ? selection.substring(4) : selection;
      const commands = await this.getCLICommands(pipelineName);
      commands.forEach(cmd => {
        elements.push({
          element_type: 'cli_command',
          element_id: cmd.id,
          category: cmd.pipeline_name,
          subcategory: 'command',
          name: cmd.command_name,
          path: cmd.example_usage,
          description: cmd.description
        });
      });
    } else if (type === 'service') {
      const services = await this.getSharedServices();
      services.forEach(svc => {
        elements.push({
          element_type: 'shared_service',
          element_id: svc.id,
          category: svc.category || 'uncategorized',
          subcategory: 'service',
          name: svc.service_name,
          path: svc.service_path,
          description: svc.description
        });
      });
    }

    return elements;
  }

  /**
   * Get all elements from the view
   */
  async getAllAvailableElements(): Promise<TaskElement[]> {
    const { data, error } = await this.supabase
      .from('available_task_elements_view')
      .select('*')
      .order('category, subcategory, name');

    if (error) {
      console.error('Error fetching available elements:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Catalog a new app feature
   */
  async catalogAppFeature(feature: Omit<AppFeature, 'id'>): Promise<string | null> {
    const { data, error } = await this.supabase
      .rpc('catalog_app_feature', {
        p_app_name: feature.app_name,
        p_feature_type: feature.feature_type,
        p_feature_name: feature.feature_name,
        p_file_path: feature.file_path,
        p_description: feature.description || null,
        p_parent_path: null, // Could be enhanced to support parent features
        p_metadata: feature.metadata || {}
      });

    if (error) {
      console.error('Error cataloging app feature:', error);
      return null;
    }

    return data;
  }

  /**
   * Link an element to a dev task
   */
  async linkElementToTask(
    taskId: string,
    elementType: 'app_feature' | 'cli_command' | 'shared_service',
    elementId: string,
    elementName: string
  ): Promise<boolean> {
    // First, update the dev_tasks table with element_target
    const { error: taskError } = await this.supabase
      .from('dev_tasks')
      .update({
        element_target: {
          type: elementType,
          id: elementId,
          name: elementName
        }
      })
      .eq('id', taskId);

    if (taskError) {
      console.error('Error updating task element target:', taskError);
      return false;
    }

    // Then, insert into dev_task_elements for tracking
    const { error: linkError } = await this.supabase
      .from('dev_task_elements')
      .insert({
        task_id: taskId,
        element_type: elementType,
        element_id: elementId,
        element_name: elementName
      });

    if (linkError && !linkError.message.includes('duplicate')) {
      console.error('Error linking element to task:', linkError);
      return false;
    }

    return true;
  }

  /**
   * Get element details by type and ID
   */
  async getElementDetails(
    elementType: 'app_feature' | 'cli_command' | 'shared_service',
    elementId: string
  ): Promise<TaskElement | null> {
    const { data, error } = await this.supabase
      .from('available_task_elements_view')
      .select('*')
      .eq('element_type', elementType)
      .eq('element_id', elementId)
      .single();

    if (error) {
      console.error('Error fetching element details:', error);
      return null;
    }

    return data;
  }
}