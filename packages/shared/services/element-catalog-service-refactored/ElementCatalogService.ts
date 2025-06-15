/**
 * Element Catalog Service - Manages app features, CLI commands, and services catalog
 * Refactored to extend BusinessService with proper dependency injection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { Logger } from '../base-classes/BaseService';

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

interface ServiceMetrics {
  totalAppFeaturesQueried: number;
  totalCLICommandsQueried: number;
  totalSharedServicesQueried: number;
  totalElementsLinked: number;
  totalFeaturesCataloged: number;
  totalErrors: number;
  lastError?: string;
  lastOperation?: string;
  lastOperationTime?: Date;
}

export class ElementCatalogService extends BusinessService {
  private metrics: ServiceMetrics = {
    totalAppFeaturesQueried: 0,
    totalCLICommandsQueried: 0,
    totalSharedServicesQueried: 0,
    totalElementsLinked: 0,
    totalFeaturesCataloged: 0,
    totalErrors: 0
  };

  constructor(
    private supabase: SupabaseClient,
    logger?: Logger
  ) {
    super('ElementCatalogService', { supabase }, logger);
  }

  /**
   * Validate required dependencies
   */
  protected validateDependencies(): void {
    if (!this.supabase) {
      throw new Error('ElementCatalogService requires a Supabase client');
    }
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('ElementCatalogService initialized');
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connectivity by checking a view
      const { error } = await this.supabase
        .from('available_task_elements_view')
        .select('count')
        .limit(1);

      const healthy = !error;
      
      return {
        healthy,
        details: {
          ...this.metrics,
          error: error?.message
        },
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          ...this.metrics,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get app features for a specific app
   */
  async getAppFeatures(appName: string): Promise<AppFeature[]> {
    this.metrics.lastOperation = 'getAppFeatures';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .rpc('get_app_features', { p_app_name: appName });

      if (error) {
        this.handleError('Error fetching app features', error);
        return [];
      }

      const features = data || [];
      this.metrics.totalAppFeaturesQueried += features.length;
      this.logger?.info(`Fetched ${features.length} features for app ${appName}`);
      
      return features;
    } catch (error) {
      this.handleError('Unexpected error fetching app features', error);
      return [];
    }
  }

  /**
   * Get CLI commands for a specific pipeline
   */
  async getCLICommands(pipelineName: string): Promise<CLICommand[]> {
    this.metrics.lastOperation = 'getCLICommands';
    this.metrics.lastOperationTime = new Date();

    try {
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
        this.handleError('Error fetching CLI commands', error);
        return [];
      }

      // Transform the data to flatten the structure
      const commands = (data || []).map(cmd => ({
        id: cmd.id,
        pipeline_id: cmd.pipeline_id,
        pipeline_name: (cmd.command_pipelines as any).name,
        command_name: cmd.command_name,
        description: cmd.description,
        example_usage: cmd.example_usage
      }));

      this.metrics.totalCLICommandsQueried += commands.length;
      this.logger?.info(`Fetched ${commands.length} commands for pipeline ${pipelineName}`);
      
      return commands;
    } catch (error) {
      this.handleError('Unexpected error fetching CLI commands', error);
      return [];
    }
  }

  /**
   * Get all shared services
   */
  async getSharedServices(category?: string): Promise<SharedService[]> {
    this.metrics.lastOperation = 'getSharedServices';
    this.metrics.lastOperationTime = new Date();

    try {
      let query = this.supabase
        .from('sys_shared_services')
        .select('*')
        .order('service_name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        this.handleError('Error fetching shared services', error);
        return [];
      }

      const services = data || [];
      this.metrics.totalSharedServicesQueried += services.length;
      this.logger?.info(`Fetched ${services.length} shared services${category ? ` in category ${category}` : ''}`);
      
      return services;
    } catch (error) {
      this.handleError('Unexpected error fetching shared services', error);
      return [];
    }
  }

  /**
   * Get available elements for task creation based on selection
   */
  async getAvailableElements(
    type: 'app' | 'cli_pipeline' | 'service',
    selection: string
  ): Promise<TaskElement[]> {
    this.metrics.lastOperation = 'getAvailableElements';
    this.metrics.lastOperationTime = new Date();

    try {
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

      this.logger?.info(`Fetched ${elements.length} elements of type ${type}`);
      return elements;
    } catch (error) {
      this.handleError('Unexpected error fetching available elements', error);
      return [];
    }
  }

  /**
   * Get all elements from the view
   */
  async getAllAvailableElements(): Promise<TaskElement[]> {
    this.metrics.lastOperation = 'getAllAvailableElements';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('available_task_elements_view')
        .select('*')
        .order('category, subcategory, name');

      if (error) {
        this.handleError('Error fetching available elements', error);
        return [];
      }

      const elements = data || [];
      this.logger?.info(`Fetched ${elements.length} total available elements`);
      
      return elements;
    } catch (error) {
      this.handleError('Unexpected error fetching all available elements', error);
      return [];
    }
  }

  /**
   * Catalog a new app feature
   */
  async catalogAppFeature(feature: Omit<AppFeature, 'id'>): Promise<string | null> {
    this.metrics.lastOperation = 'catalogAppFeature';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      this.validateInput(feature, (data) => {
        if (!data.app_name || !data.feature_type || !data.feature_name || !data.file_path) {
          throw new Error('Missing required feature fields');
        }
        return data;
      });

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
        this.handleError('Error cataloging app feature', error);
        return null;
      }

      this.metrics.totalFeaturesCataloged++;
      this.logger?.info(`Cataloged feature ${feature.feature_name} for app ${feature.app_name}`);
      
      return data;
    } catch (error) {
      this.handleError('Unexpected error cataloging app feature', error);
      return null;
    }
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
    this.metrics.lastOperation = 'linkElementToTask';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      if (!taskId || !elementType || !elementId || !elementName) {
        throw new Error('Missing required parameters for linking element to task');
      }

      // Use transaction-like behavior
      return await this.withTransaction(async () => {
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
          throw new Error(`Failed to update task element target: ${taskError.message}`);
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
          throw new Error(`Failed to link element to task: ${linkError.message}`);
        }

        this.metrics.totalElementsLinked++;
        this.logger?.info(`Linked ${elementType} ${elementName} to task ${taskId}`);
        
        return true;
      });
    } catch (error) {
      this.handleError('Error linking element to task', error);
      return false;
    }
  }

  /**
   * Get element details by type and ID
   */
  async getElementDetails(
    elementType: 'app_feature' | 'cli_command' | 'shared_service',
    elementId: string
  ): Promise<TaskElement | null> {
    this.metrics.lastOperation = 'getElementDetails';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('available_task_elements_view')
        .select('*')
        .eq('element_type', elementType)
        .eq('element_id', elementId)
        .single();

      if (error) {
        this.handleError('Error fetching element details', error);
        return null;
      }

      this.logger?.info(`Fetched details for ${elementType} ${elementId}`);
      return data;
    } catch (error) {
      this.handleError('Unexpected error fetching element details', error);
      return null;
    }
  }

  /**
   * Handle errors consistently
   */
  private handleError(message: string, error: any): void {
    this.metrics.totalErrors++;
    this.metrics.lastError = error?.message || String(error);
    this.logger?.error(message, error);
  }
}