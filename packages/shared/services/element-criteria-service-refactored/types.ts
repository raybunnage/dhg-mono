/**
 * Type definitions for ElementCriteriaService
 */

export interface ElementSuccessCriteria {
  id?: string;
  element_type: 'app_feature' | 'cli_command' | 'shared_service' | 'app' | 'pipeline';
  element_id: string;
  title: string;
  description?: string;
  success_condition: string;
  criteria_type: 'functional' | 'performance' | 'security' | 'ux' | 'integration' | 'documentation' | 'testing';
  is_required?: boolean;
  priority?: 'low' | 'medium' | 'high';
  validation_method?: string;
  validation_script?: string;
  suggested_by?: 'system' | 'user' | 'ai';
  is_template?: boolean;
  parent_criteria_id?: string;
  metadata?: any;
}

export interface ElementQualityGate {
  id?: string;
  element_type: 'app_feature' | 'cli_command' | 'shared_service' | 'app' | 'pipeline';
  element_id: string;
  gate_name: string;
  gate_type: 'pre-commit' | 'pre-merge' | 'post-deploy' | 'continuous' | 'manual';
  description?: string;
  check_script?: string;
  auto_check?: boolean;
  is_blocking?: boolean;
  order_sequence?: number;
  suggested_by?: 'system' | 'user' | 'ai';
  metadata?: any;
}

export interface CriteriaTemplate {
  id: string;
  template_name: string;
  element_type: string;
  feature_type?: string;
  criteria_set: any[];
  gates_set: any[];
  description?: string;
  use_count: number;
  is_active: boolean;
}

export interface ElementWithCriteria {
  element_type: string;
  element_id: string;
  category: string;
  subcategory: string;
  name: string;
  path?: string;
  description?: string;
  criteria_count: number;
  gates_count: number;
}