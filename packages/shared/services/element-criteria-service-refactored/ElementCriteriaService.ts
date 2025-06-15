/**
 * Element Criteria Service - Manages success criteria and quality gates for elements
 * Refactored to extend BusinessService with proper dependency injection
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessService } from '../base-classes/BusinessService';
import { Logger } from '../base-classes/BaseService';

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

interface ServiceMetrics {
  totalCriteriaFetched: number;
  totalGatesFetched: number;
  totalCriteriaAdded: number;
  totalGatesAdded: number;
  totalTemplatesApplied: number;
  totalErrors: number;
  lastError?: string;
  lastOperation?: string;
  lastOperationTime?: Date;
}

export class ElementCriteriaService extends BusinessService {
  private metrics: ServiceMetrics = {
    totalCriteriaFetched: 0,
    totalGatesFetched: 0,
    totalCriteriaAdded: 0,
    totalGatesAdded: 0,
    totalTemplatesApplied: 0,
    totalErrors: 0
  };

  constructor(
    private supabase: SupabaseClient,
    logger?: Logger
  ) {
    super('ElementCriteriaService', { supabase }, logger);
  }

  /**
   * Validate required dependencies
   */
  protected validateDependencies(): void {
    if (!this.supabase) {
      throw new Error('ElementCriteriaService requires a Supabase client');
    }
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    this.logger?.info('ElementCriteriaService initialized');
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<{ healthy: boolean; details: any; timestamp: Date }> {
    try {
      // Test database connectivity
      const { error } = await this.supabase
        .from('element_success_criteria')
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
   * Get success criteria for an element
   */
  async getElementCriteria(
    elementType: string,
    elementId: string
  ): Promise<ElementSuccessCriteria[]> {
    this.metrics.lastOperation = 'getElementCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('element_success_criteria')
        .select('*')
        .eq('element_type', elementType)
        .eq('element_id', elementId)
        .order('priority', { ascending: false })
        .order('created_at');

      if (error) {
        this.handleError('Error fetching element criteria', error);
        return [];
      }

      this.metrics.totalCriteriaFetched += (data || []).length;
      this.logger?.info(`Fetched ${data?.length || 0} criteria for ${elementType}:${elementId}`);
      
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching element criteria', error);
      return [];
    }
  }

  /**
   * Get quality gates for an element
   */
  async getElementGates(
    elementType: string,
    elementId: string
  ): Promise<ElementQualityGate[]> {
    this.metrics.lastOperation = 'getElementGates';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('element_quality_gates')
        .select('*')
        .eq('element_type', elementType)
        .eq('element_id', elementId)
        .order('order_sequence')
        .order('created_at');

      if (error) {
        this.handleError('Error fetching element gates', error);
        return [];
      }

      this.metrics.totalGatesFetched += (data || []).length;
      this.logger?.info(`Fetched ${data?.length || 0} gates for ${elementType}:${elementId}`);
      
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching element gates', error);
      return [];
    }
  }

  /**
   * Suggest criteria for an element
   */
  async suggestCriteria(
    elementType: string,
    elementId: string,
    featureType?: string
  ): Promise<ElementSuccessCriteria[]> {
    this.metrics.lastOperation = 'suggestCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .rpc('suggest_element_criteria', {
          p_element_type: elementType,
          p_element_id: elementId,
          p_feature_type: featureType || null
        });

      if (error) {
        this.handleError('Error suggesting criteria', error);
        return [];
      }

      const suggestions = (data || []).map((item: any) => ({
        element_type: elementType as any,
        element_id: elementId,
        title: item.title,
        description: item.description,
        success_condition: item.success_condition,
        criteria_type: item.criteria_type,
        priority: item.priority,
        validation_method: item.validation_method,
        suggested_by: 'system' as const
      }));

      this.logger?.info(`Generated ${suggestions.length} criteria suggestions for ${elementType}:${elementId}`);
      return suggestions;
    } catch (error) {
      this.handleError('Unexpected error suggesting criteria', error);
      return [];
    }
  }

  /**
   * Add success criteria to an element
   */
  async addCriteria(criteria: ElementSuccessCriteria): Promise<ElementSuccessCriteria | null> {
    this.metrics.lastOperation = 'addCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      this.validateInput(criteria, (data) => {
        if (!data.element_type || !data.element_id || !data.title || !data.success_condition) {
          throw new Error('Missing required criteria fields');
        }
        return data;
      });

      const { data, error } = await this.supabase
        .from('element_success_criteria')
        .insert(criteria)
        .select()
        .single();

      if (error) {
        this.handleError('Error adding criteria', error);
        return null;
      }

      this.metrics.totalCriteriaAdded++;
      this.logger?.info(`Added criteria "${criteria.title}" for ${criteria.element_type}:${criteria.element_id}`);
      
      return data;
    } catch (error) {
      this.handleError('Unexpected error adding criteria', error);
      return null;
    }
  }

  /**
   * Add quality gate to an element
   */
  async addGate(gate: ElementQualityGate): Promise<ElementQualityGate | null> {
    this.metrics.lastOperation = 'addGate';
    this.metrics.lastOperationTime = new Date();

    try {
      // Validate input
      this.validateInput(gate, (data) => {
        if (!data.element_type || !data.element_id || !data.gate_name || !data.gate_type) {
          throw new Error('Missing required gate fields');
        }
        return data;
      });

      const { data, error } = await this.supabase
        .from('element_quality_gates')
        .insert(gate)
        .select()
        .single();

      if (error) {
        this.handleError('Error adding gate', error);
        return null;
      }

      this.metrics.totalGatesAdded++;
      this.logger?.info(`Added gate "${gate.gate_name}" for ${gate.element_type}:${gate.element_id}`);
      
      return data;
    } catch (error) {
      this.handleError('Unexpected error adding gate', error);
      return null;
    }
  }

  /**
   * Update success criteria
   */
  async updateCriteria(
    id: string,
    updates: Partial<ElementSuccessCriteria>
  ): Promise<boolean> {
    this.metrics.lastOperation = 'updateCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      const { error } = await this.supabase
        .from('element_success_criteria')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        this.handleError('Error updating criteria', error);
        return false;
      }

      this.logger?.info(`Updated criteria ${id}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error updating criteria', error);
      return false;
    }
  }

  /**
   * Update quality gate
   */
  async updateGate(
    id: string,
    updates: Partial<ElementQualityGate>
  ): Promise<boolean> {
    this.metrics.lastOperation = 'updateGate';
    this.metrics.lastOperationTime = new Date();

    try {
      const { error } = await this.supabase
        .from('element_quality_gates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        this.handleError('Error updating gate', error);
        return false;
      }

      this.logger?.info(`Updated gate ${id}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error updating gate', error);
      return false;
    }
  }

  /**
   * Delete success criteria
   */
  async deleteCriteria(id: string): Promise<boolean> {
    this.metrics.lastOperation = 'deleteCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      const { error } = await this.supabase
        .from('element_success_criteria')
        .delete()
        .eq('id', id);

      if (error) {
        this.handleError('Error deleting criteria', error);
        return false;
      }

      this.logger?.info(`Deleted criteria ${id}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error deleting criteria', error);
      return false;
    }
  }

  /**
   * Delete quality gate
   */
  async deleteGate(id: string): Promise<boolean> {
    this.metrics.lastOperation = 'deleteGate';
    this.metrics.lastOperationTime = new Date();

    try {
      const { error } = await this.supabase
        .from('element_quality_gates')
        .delete()
        .eq('id', id);

      if (error) {
        this.handleError('Error deleting gate', error);
        return false;
      }

      this.logger?.info(`Deleted gate ${id}`);
      return true;
    } catch (error) {
      this.handleError('Unexpected error deleting gate', error);
      return false;
    }
  }

  /**
   * Get all criteria templates
   */
  async getTemplates(elementType?: string): Promise<CriteriaTemplate[]> {
    this.metrics.lastOperation = 'getTemplates';
    this.metrics.lastOperationTime = new Date();

    try {
      let query = this.supabase
        .from('element_criteria_templates')
        .select('*')
        .eq('is_active', true)
        .order('use_count', { ascending: false });

      if (elementType) {
        query = query.eq('element_type', elementType);
      }

      const { data, error } = await query;

      if (error) {
        this.handleError('Error fetching templates', error);
        return [];
      }

      this.logger?.info(`Fetched ${data?.length || 0} templates`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching templates', error);
      return [];
    }
  }

  /**
   * Apply template to element
   */
  async applyTemplate(
    templateId: string,
    elementType: string,
    elementId: string
  ): Promise<{ criteriaCount: number; gatesCount: number }> {
    this.metrics.lastOperation = 'applyTemplate';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data: template } = await this.supabase
        .from('element_criteria_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (!template) {
        this.logger?.warn(`Template ${templateId} not found`);
        return { criteriaCount: 0, gatesCount: 0 };
      }

      let criteriaCount = 0;
      let gatesCount = 0;

      // Apply criteria from template
      for (const criteriaData of template.criteria_set || []) {
        const criteria: ElementSuccessCriteria = {
          element_type: elementType as any,
          element_id: elementId,
          ...criteriaData,
          suggested_by: 'system'
        };
        
        const result = await this.addCriteria(criteria);
        if (result) criteriaCount++;
      }

      // Apply gates from template
      for (const gateData of template.gates_set || []) {
        const gate: ElementQualityGate = {
          element_type: elementType as any,
          element_id: elementId,
          ...gateData,
          suggested_by: 'system'
        };
        
        const result = await this.addGate(gate);
        if (result) gatesCount++;
      }

      // Increment template use count
      await this.supabase
        .from('element_criteria_templates')
        .update({ use_count: template.use_count + 1 })
        .eq('id', templateId);

      this.metrics.totalTemplatesApplied++;
      this.logger?.info(`Applied template ${templateId}: ${criteriaCount} criteria, ${gatesCount} gates`);

      return { criteriaCount, gatesCount };
    } catch (error) {
      this.handleError('Unexpected error applying template', error);
      return { criteriaCount: 0, gatesCount: 0 };
    }
  }

  /**
   * Inherit criteria to a task
   */
  async inheritToTask(
    taskId: string,
    elementType: string,
    elementId: string
  ): Promise<number> {
    this.metrics.lastOperation = 'inheritToTask';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .rpc('inherit_element_criteria', {
          p_task_id: taskId,
          p_element_type: elementType,
          p_element_id: elementId
        });

      if (error) {
        this.handleError('Error inheriting criteria', error);
        return 0;
      }

      const count = data || 0;
      this.logger?.info(`Inherited ${count} criteria to task ${taskId}`);
      
      return count;
    } catch (error) {
      this.handleError('Unexpected error inheriting criteria', error);
      return 0;
    }
  }

  /**
   * Get elements with criteria counts
   */
  async getElementsWithCriteria(
    elementType?: string,
    category?: string
  ): Promise<ElementWithCriteria[]> {
    this.metrics.lastOperation = 'getElementsWithCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      let query = this.supabase
        .from('elements_with_criteria_view')
        .select('*')
        .order('criteria_count', { ascending: false });

      if (elementType) {
        query = query.eq('element_type', elementType);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        this.handleError('Error fetching elements with criteria', error);
        return [];
      }

      this.logger?.info(`Fetched ${data?.length || 0} elements with criteria`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching elements with criteria', error);
      return [];
    }
  }

  /**
   * Get element hierarchy with criteria counts
   */
  async getElementHierarchy(appName: string): Promise<any[]> {
    this.metrics.lastOperation = 'getElementHierarchy';
    this.metrics.lastOperationTime = new Date();

    try {
      const { data, error } = await this.supabase
        .from('element_hierarchy_view')
        .select('*')
        .eq('app_name', appName)
        .order('level_type')
        .order('element_name');

      if (error) {
        this.handleError('Error fetching element hierarchy', error);
        return [];
      }

      this.logger?.info(`Fetched hierarchy for app ${appName}: ${data?.length || 0} elements`);
      return data || [];
    } catch (error) {
      this.handleError('Unexpected error fetching element hierarchy', error);
      return [];
    }
  }

  /**
   * Copy criteria from one element to another
   */
  async copyCriteria(
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string
  ): Promise<{ criteriaCount: number; gatesCount: number }> {
    this.metrics.lastOperation = 'copyCriteria';
    this.metrics.lastOperationTime = new Date();

    try {
      let criteriaCount = 0;
      let gatesCount = 0;

      // Copy criteria
      const sourceCriteria = await this.getElementCriteria(sourceType, sourceId);
      for (const criteria of sourceCriteria) {
        const { id, ...criteriaData } = criteria;
        const newCriteria: ElementSuccessCriteria = {
          ...criteriaData,
          element_type: targetType as any,
          element_id: targetId
        };
        
        const result = await this.addCriteria(newCriteria);
        if (result) criteriaCount++;
      }

      // Copy gates
      const sourceGates = await this.getElementGates(sourceType, sourceId);
      for (const gate of sourceGates) {
        const { id, ...gateData } = gate;
        const newGate: ElementQualityGate = {
          ...gateData,
          element_type: targetType as any,
          element_id: targetId
        };
        
        const result = await this.addGate(newGate);
        if (result) gatesCount++;
      }

      this.logger?.info(`Copied ${criteriaCount} criteria and ${gatesCount} gates from ${sourceType}:${sourceId} to ${targetType}:${targetId}`);
      return { criteriaCount, gatesCount };
    } catch (error) {
      this.handleError('Unexpected error copying criteria', error);
      return { criteriaCount: 0, gatesCount: 0 };
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