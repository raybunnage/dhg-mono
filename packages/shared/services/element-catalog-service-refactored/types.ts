/**
 * Type definitions for ElementCatalogService
 */

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