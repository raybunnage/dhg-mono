/**
 * Element Criteria Service - Manages success criteria and quality gates for elements
 */

import { SupabaseClientService } from './supabase-client';

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

export class ElementCriteriaService {
  private static instance: ElementCriteriaService;
  private supabase;

  private constructor() {
    this.supabase = SupabaseClientService.getInstance().getClient();
  }

  static getInstance(): ElementCriteriaService {
    if (!ElementCriteriaService.instance) {
      ElementCriteriaService.instance = new ElementCriteriaService();
    }
    return ElementCriteriaService.instance;
  }

  /**
   * Get success criteria for an element
   */
  async getElementCriteria(
    elementType: string,
    elementId: string
  ): Promise<ElementSuccessCriteria[]> {
    const { data, error } = await this.supabase
      .from('element_success_criteria')
      .select('*')
      .eq('element_type', elementType)
      .eq('element_id', elementId)
      .order('priority', { ascending: false })
      .order('created_at');

    if (error) {
      console.error('Error fetching element criteria:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get quality gates for an element
   */
  async getElementGates(
    elementType: string,
    elementId: string
  ): Promise<ElementQualityGate[]> {
    const { data, error } = await this.supabase
      .from('element_quality_gates')
      .select('*')
      .eq('element_type', elementType)
      .eq('element_id', elementId)
      .order('order_sequence')
      .order('created_at');

    if (error) {
      console.error('Error fetching element gates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Suggest criteria for an element
   */
  async suggestCriteria(
    elementType: string,
    elementId: string,
    featureType?: string
  ): Promise<ElementSuccessCriteria[]> {
    const { data, error } = await this.supabase
      .rpc('suggest_element_criteria', {
        p_element_type: elementType,
        p_element_id: elementId,
        p_feature_type: featureType || null
      });

    if (error) {
      console.error('Error suggesting criteria:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
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
  }

  /**
   * Add success criteria to an element
   */
  async addCriteria(criteria: ElementSuccessCriteria): Promise<ElementSuccessCriteria | null> {
    const { data, error } = await this.supabase
      .from('element_success_criteria')
      .insert(criteria)
      .select()
      .single();

    if (error) {
      console.error('Error adding criteria:', error);
      return null;
    }

    return data;
  }

  /**
   * Add quality gate to an element
   */
  async addGate(gate: ElementQualityGate): Promise<ElementQualityGate | null> {
    const { data, error } = await this.supabase
      .from('element_quality_gates')
      .insert(gate)
      .select()
      .single();

    if (error) {
      console.error('Error adding gate:', error);
      return null;
    }

    return data;
  }

  /**
   * Update success criteria
   */
  async updateCriteria(
    id: string,
    updates: Partial<ElementSuccessCriteria>
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('element_success_criteria')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating criteria:', error);
      return false;
    }

    return true;
  }

  /**
   * Update quality gate
   */
  async updateGate(
    id: string,
    updates: Partial<ElementQualityGate>
  ): Promise<boolean> {
    const { error } = await this.supabase
      .from('element_quality_gates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Error updating gate:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete success criteria
   */
  async deleteCriteria(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('element_success_criteria')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting criteria:', error);
      return false;
    }

    return true;
  }

  /**
   * Delete quality gate
   */
  async deleteGate(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('element_quality_gates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting gate:', error);
      return false;
    }

    return true;
  }

  /**
   * Get all criteria templates
   */
  async getTemplates(elementType?: string): Promise<CriteriaTemplate[]> {
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
      console.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Apply template to element
   */
  async applyTemplate(
    templateId: string,
    elementType: string,
    elementId: string
  ): Promise<{ criteriaCount: number; gatesCount: number }> {
    const { data: template } = await this.supabase
      .from('element_criteria_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) {
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

    return { criteriaCount, gatesCount };
  }

  /**
   * Inherit criteria to a task
   */
  async inheritToTask(
    taskId: string,
    elementType: string,
    elementId: string
  ): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('inherit_element_criteria', {
        p_task_id: taskId,
        p_element_type: elementType,
        p_element_id: elementId
      });

    if (error) {
      console.error('Error inheriting criteria:', error);
      return 0;
    }

    return data || 0;
  }

  /**
   * Get elements with criteria counts
   */
  async getElementsWithCriteria(
    elementType?: string,
    category?: string
  ): Promise<ElementWithCriteria[]> {
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
      console.error('Error fetching elements with criteria:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get element hierarchy with criteria counts
   */
  async getElementHierarchy(appName: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('element_hierarchy_view')
      .select('*')
      .eq('app_name', appName)
      .order('level_type')
      .order('element_name');

    if (error) {
      console.error('Error fetching element hierarchy:', error);
      return [];
    }

    return data || [];
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

    return { criteriaCount, gatesCount };
  }
}