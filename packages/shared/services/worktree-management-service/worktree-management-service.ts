import { SupabaseClient } from '@supabase/supabase-js';
import {
  WorktreeDefinition,
  WorktreeAppMapping,
  WorktreePipelineMapping,
  WorktreeServiceMapping,
  CreateWorktreeInput,
  UpdateWorktreeInput,
  WorktreeMappingSummary,
  WorktreeFilters,
  MappingChange,
  BatchMappingUpdate,
  STANDARD_APPS
} from './types';

export class WorktreeManagementService {
  private static instance: WorktreeManagementService | null = null;
  private supabase: SupabaseClient;

  private constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  static getInstance(supabaseClient?: SupabaseClient): WorktreeManagementService {
    if (!WorktreeManagementService.instance) {
      if (!supabaseClient) {
        throw new Error('Supabase client must be provided when creating WorktreeManagementService instance');
      }
      WorktreeManagementService.instance = new WorktreeManagementService(supabaseClient);
    }
    return WorktreeManagementService.instance;
  }

  /**
   * Get all worktree definitions
   */
  async getWorktrees(filters?: WorktreeFilters): Promise<WorktreeDefinition[]> {
    try {
      let query = this.supabase
        .from('worktree_definitions')
        .select('*')
        .order('alias_number');

      const { data, error } = await query;
      if (error) throw error;

      let worktrees = data || [];

      // Apply filters if provided
      if (filters) {
        const mappings = await this.getAllMappingsForWorktrees(worktrees.map(w => w.id));
        
        worktrees = worktrees.filter(worktree => {
          const worktreeMappings = mappings[worktree.id] || { apps: [], pipelines: [], services: [] };
          
          if (filters.hasApps !== undefined && (worktreeMappings.apps.length > 0) !== filters.hasApps) {
            return false;
          }
          if (filters.hasPipelines !== undefined && (worktreeMappings.pipelines.length > 0) !== filters.hasPipelines) {
            return false;
          }
          if (filters.hasServices !== undefined && (worktreeMappings.services.length > 0) !== filters.hasServices) {
            return false;
          }
          if (filters.app && !worktreeMappings.apps.includes(filters.app)) {
            return false;
          }
          if (filters.pipeline && !worktreeMappings.pipelines.includes(filters.pipeline)) {
            return false;
          }
          if (filters.service && !worktreeMappings.services.includes(filters.service)) {
            return false;
          }
          
          return true;
        });
      }

      return worktrees;
    } catch (error) {
      console.error('Error fetching worktrees:', error);
      throw error;
    }
  }

  /**
   * Get a single worktree by ID
   */
  async getWorktreeById(id: string): Promise<WorktreeDefinition | null> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_definitions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching worktree:', error);
      throw error;
    }
  }

  /**
   * Get worktree by path
   */
  async getWorktreeByPath(path: string): Promise<WorktreeDefinition | null> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_definitions')
        .select('*')
        .eq('path', path)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching worktree by path:', error);
      throw error;
    }
  }

  /**
   * Create a new worktree definition
   */
  async createWorktree(input: CreateWorktreeInput): Promise<WorktreeDefinition> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_definitions')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create worktree');

      return data;
    } catch (error) {
      console.error('Error creating worktree:', error);
      throw error;
    }
  }

  /**
   * Update an existing worktree
   */
  async updateWorktree(id: string, input: UpdateWorktreeInput): Promise<WorktreeDefinition> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_definitions')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Worktree not found');

      return data;
    } catch (error) {
      console.error('Error updating worktree:', error);
      throw error;
    }
  }

  /**
   * Delete a worktree and all its mappings
   */
  async deleteWorktree(id: string): Promise<void> {
    try {
      // Delete will cascade to mappings due to foreign key constraints
      const { error } = await this.supabase
        .from('worktree_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting worktree:', error);
      throw error;
    }
  }

  /**
   * Get all app mappings
   */
  async getAppMappings(): Promise<WorktreeAppMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_app_mappings')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching app mappings:', error);
      throw error;
    }
  }

  /**
   * Get app mappings for a specific worktree
   */
  async getAppMappingsForWorktree(worktreeId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_app_mappings')
        .select('app_name')
        .eq('worktree_id', worktreeId);

      if (error) throw error;
      return (data || []).map(m => m.app_name);
    } catch (error) {
      console.error('Error fetching app mappings for worktree:', error);
      throw error;
    }
  }

  /**
   * Get all pipeline mappings
   */
  async getPipelineMappings(): Promise<WorktreePipelineMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_pipeline_mappings')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching pipeline mappings:', error);
      throw error;
    }
  }

  /**
   * Get pipeline mappings for a specific worktree
   */
  async getPipelineMappingsForWorktree(worktreeId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_pipeline_mappings')
        .select('pipeline_name')
        .eq('worktree_id', worktreeId);

      if (error) throw error;
      return (data || []).map(m => m.pipeline_name);
    } catch (error) {
      console.error('Error fetching pipeline mappings for worktree:', error);
      throw error;
    }
  }

  /**
   * Get all service mappings with joined service names
   */
  async getServiceMappings(): Promise<WorktreeServiceMapping[]> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_service_mappings')
        .select(`
          id,
          worktree_id,
          service_id,
          sys_shared_services(service_name)
        `);

      if (error) throw error;

      // Transform the data to include service_name at the top level
      return (data || []).map(item => ({
        id: item.id,
        worktree_id: item.worktree_id,
        service_id: item.service_id,
        service_name: (item as any).sys_shared_services?.service_name
      }));
    } catch (error) {
      console.error('Error fetching service mappings:', error);
      throw error;
    }
  }

  /**
   * Get service mappings for a specific worktree
   */
  async getServiceMappingsForWorktree(worktreeId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('worktree_service_mappings')
        .select(`
          service_id,
          sys_shared_services(service_name)
        `)
        .eq('worktree_id', worktreeId);

      if (error) throw error;
      return (data || []).map(item => (item as any).sys_shared_services?.service_name).filter(Boolean);
    } catch (error) {
      console.error('Error fetching service mappings for worktree:', error);
      throw error;
    }
  }

  /**
   * Get all mappings for multiple worktrees (efficient batch operation)
   */
  async getAllMappingsForWorktrees(worktreeIds: string[]): Promise<Record<string, { apps: string[], pipelines: string[], services: string[] }>> {
    try {
      const [appMappings, pipelineMappings, serviceMappings] = await Promise.all([
        this.getAppMappings(),
        this.getPipelineMappings(),
        this.getServiceMappings()
      ]);

      const result: Record<string, { apps: string[], pipelines: string[], services: string[] }> = {};

      worktreeIds.forEach(id => {
        result[id] = {
          apps: appMappings.filter(m => m.worktree_id === id).map(m => m.app_name),
          pipelines: pipelineMappings.filter(m => m.worktree_id === id).map(m => m.pipeline_name),
          services: serviceMappings.filter(m => m.worktree_id === id).map(m => m.service_name).filter(Boolean) as string[]
        };
      });

      return result;
    } catch (error) {
      console.error('Error fetching all mappings:', error);
      throw error;
    }
  }

  /**
   * Get complete mapping summary for a worktree
   */
  async getWorktreeMappingSummary(worktreeId: string): Promise<WorktreeMappingSummary | null> {
    try {
      const worktree = await this.getWorktreeById(worktreeId);
      if (!worktree) return null;

      const [apps, pipelines, services] = await Promise.all([
        this.getAppMappingsForWorktree(worktreeId),
        this.getPipelineMappingsForWorktree(worktreeId),
        this.getServiceMappingsForWorktree(worktreeId)
      ]);

      return {
        worktree,
        apps,
        pipelines,
        services
      };
    } catch (error) {
      console.error('Error fetching worktree mapping summary:', error);
      throw error;
    }
  }

  /**
   * Toggle an app mapping (add if not exists, remove if exists)
   */
  async toggleAppMapping(worktreeId: string, appName: string): Promise<void> {
    try {
      const existing = await this.supabase
        .from('worktree_app_mappings')
        .select('id')
        .eq('worktree_id', worktreeId)
        .eq('app_name', appName)
        .single();

      if (existing.data) {
        // Remove mapping
        const { error } = await this.supabase
          .from('worktree_app_mappings')
          .delete()
          .eq('id', existing.data.id);
        
        if (error) throw error;
      } else {
        // Add mapping
        const { error } = await this.supabase
          .from('worktree_app_mappings')
          .insert({ worktree_id: worktreeId, app_name: appName });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling app mapping:', error);
      throw error;
    }
  }

  /**
   * Toggle a pipeline mapping
   */
  async togglePipelineMapping(worktreeId: string, pipelineName: string): Promise<void> {
    try {
      const existing = await this.supabase
        .from('worktree_pipeline_mappings')
        .select('id')
        .eq('worktree_id', worktreeId)
        .eq('pipeline_name', pipelineName)
        .single();

      if (existing.data) {
        // Remove mapping
        const { error } = await this.supabase
          .from('worktree_pipeline_mappings')
          .delete()
          .eq('id', existing.data.id);
        
        if (error) throw error;
      } else {
        // Add mapping
        const { error } = await this.supabase
          .from('worktree_pipeline_mappings')
          .insert({ worktree_id: worktreeId, pipeline_name: pipelineName });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling pipeline mapping:', error);
      throw error;
    }
  }

  /**
   * Toggle a service mapping
   */
  async toggleServiceMapping(worktreeId: string, serviceId: string): Promise<void> {
    try {
      const existing = await this.supabase
        .from('worktree_service_mappings')
        .select('id')
        .eq('worktree_id', worktreeId)
        .eq('service_id', serviceId)
        .single();

      if (existing.data) {
        // Remove mapping
        const { error } = await this.supabase
          .from('worktree_service_mappings')
          .delete()
          .eq('id', existing.data.id);
        
        if (error) throw error;
      } else {
        // Add mapping
        const { error } = await this.supabase
          .from('worktree_service_mappings')
          .insert({ worktree_id: worktreeId, service_id: serviceId });
        
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error toggling service mapping:', error);
      throw error;
    }
  }

  /**
   * Batch update mappings for a worktree
   */
  async batchUpdateMappings(worktreeId: string, updates: BatchMappingUpdate): Promise<void> {
    try {
      const promises: Promise<any>[] = [];

      // Handle app updates
      if (updates.apps) {
        if (updates.apps.remove.length > 0) {
          promises.push(
            this.supabase
              .from('worktree_app_mappings')
              .delete()
              .eq('worktree_id', worktreeId)
              .in('app_name', updates.apps.remove)
          );
        }
        if (updates.apps.add.length > 0) {
          const appInserts = updates.apps.add.map(app_name => ({
            worktree_id: worktreeId,
            app_name
          }));
          promises.push(
            this.supabase
              .from('worktree_app_mappings')
              .insert(appInserts)
          );
        }
      }

      // Handle pipeline updates
      if (updates.pipelines) {
        if (updates.pipelines.remove.length > 0) {
          promises.push(
            this.supabase
              .from('worktree_pipeline_mappings')
              .delete()
              .eq('worktree_id', worktreeId)
              .in('pipeline_name', updates.pipelines.remove)
          );
        }
        if (updates.pipelines.add.length > 0) {
          const pipelineInserts = updates.pipelines.add.map(pipeline_name => ({
            worktree_id: worktreeId,
            pipeline_name
          }));
          promises.push(
            this.supabase
              .from('worktree_pipeline_mappings')
              .insert(pipelineInserts)
          );
        }
      }

      // Handle service updates
      if (updates.services) {
        if (updates.services.remove.length > 0) {
          // Need to look up service IDs first
          const { data: services } = await this.supabase
            .from('sys_shared_services')
            .select('id, service_name')
            .in('service_name', updates.services.remove);
          
          if (services && services.length > 0) {
            const serviceIds = services.map(s => s.id);
            promises.push(
              this.supabase
                .from('worktree_service_mappings')
                .delete()
                .eq('worktree_id', worktreeId)
                .in('service_id', serviceIds)
            );
          }
        }
        if (updates.services.add.length > 0) {
          // Need to look up service IDs first
          const { data: services } = await this.supabase
            .from('sys_shared_services')
            .select('id, service_name')
            .in('service_name', updates.services.add);
          
          if (services && services.length > 0) {
            const serviceInserts = services.map(service => ({
              worktree_id: worktreeId,
              service_id: service.id
            }));
            promises.push(
              this.supabase
                .from('worktree_service_mappings')
                .insert(serviceInserts)
            );
          }
        }
      }

      const results = await Promise.all(promises);
      
      // Check for errors
      results.forEach(result => {
        if (result.error) throw result.error;
      });
    } catch (error) {
      console.error('Error batch updating mappings:', error);
      throw error;
    }
  }

  /**
   * Apply a list of mapping changes
   */
  async applyMappingChanges(changes: MappingChange[]): Promise<void> {
    try {
      for (const change of changes) {
        switch (change.type) {
          case 'app':
            if (change.action === 'add') {
              await this.supabase
                .from('worktree_app_mappings')
                .insert({ worktree_id: change.worktreeId, app_name: change.name });
            } else {
              const { data } = await this.supabase
                .from('worktree_app_mappings')
                .select('id')
                .eq('worktree_id', change.worktreeId)
                .eq('app_name', change.name)
                .single();
              
              if (data) {
                await this.supabase
                  .from('worktree_app_mappings')
                  .delete()
                  .eq('id', data.id);
              }
            }
            break;
            
          case 'pipeline':
            if (change.action === 'add') {
              await this.supabase
                .from('worktree_pipeline_mappings')
                .insert({ worktree_id: change.worktreeId, pipeline_name: change.name });
            } else {
              const { data } = await this.supabase
                .from('worktree_pipeline_mappings')
                .select('id')
                .eq('worktree_id', change.worktreeId)
                .eq('pipeline_name', change.name)
                .single();
              
              if (data) {
                await this.supabase
                  .from('worktree_pipeline_mappings')
                  .delete()
                  .eq('id', data.id);
              }
            }
            break;
            
          case 'service':
            // For services, we need to look up the service ID
            const { data: service } = await this.supabase
              .from('sys_shared_services')
              .select('id')
              .eq('service_name', change.name)
              .single();
            
            if (!service) {
              console.error(`Service not found: ${change.name}`);
              continue;
            }
            
            if (change.action === 'add') {
              await this.supabase
                .from('worktree_service_mappings')
                .insert({ worktree_id: change.worktreeId, service_id: service.id });
            } else {
              const { data } = await this.supabase
                .from('worktree_service_mappings')
                .select('id')
                .eq('worktree_id', change.worktreeId)
                .eq('service_id', service.id)
                .single();
              
              if (data) {
                await this.supabase
                  .from('worktree_service_mappings')
                  .delete()
                  .eq('id', data.id);
              }
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error applying mapping changes:', error);
      throw error;
    }
  }

  /**
   * Get all available apps (standard list or from database)
   */
  getAvailableApps(): string[] {
    return [...STANDARD_APPS];
  }

  /**
   * Get all available pipelines from the database
   */
  async getAvailablePipelines(): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('command_pipelines')
        .select('name')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return (data || []).map(p => p.name);
    } catch (error) {
      console.error('Error fetching available pipelines:', error);
      throw error;
    }
  }

  /**
   * Get all available services from the database
   */
  async getAvailableServices(): Promise<Array<{ id: string; name: string; category: string }>> {
    try {
      const { data, error } = await this.supabase
        .from('sys_shared_services')
        .select('id, service_name, category')
        .order('category', { ascending: true })
        .order('service_name', { ascending: true });

      if (error) throw error;
      return (data || []).map(s => ({
        id: s.id,
        name: s.service_name,
        category: s.category
      }));
    } catch (error) {
      console.error('Error fetching available services:', error);
      throw error;
    }
  }

  /**
   * Get worktrees associated with a specific app
   */
  async getWorktreesForApp(appName: string): Promise<WorktreeDefinition[]> {
    try {
      const { data: mappings, error: mappingError } = await this.supabase
        .from('worktree_app_mappings')
        .select('worktree_id')
        .eq('app_name', appName);

      if (mappingError) throw mappingError;
      if (!mappings || mappings.length === 0) return [];

      const worktreeIds = mappings.map(m => m.worktree_id);
      
      const { data: worktrees, error: worktreeError } = await this.supabase
        .from('worktree_definitions')
        .select('*')
        .in('id', worktreeIds)
        .order('alias_number');

      if (worktreeError) throw worktreeError;
      return worktrees || [];
    } catch (error) {
      console.error('Error fetching worktrees for app:', error);
      throw error;
    }
  }

  /**
   * Get worktrees associated with a specific pipeline
   */
  async getWorktreesForPipeline(pipelineName: string): Promise<WorktreeDefinition[]> {
    try {
      const { data: mappings, error: mappingError } = await this.supabase
        .from('worktree_pipeline_mappings')
        .select('worktree_id')
        .eq('pipeline_name', pipelineName);

      if (mappingError) throw mappingError;
      if (!mappings || mappings.length === 0) return [];

      const worktreeIds = mappings.map(m => m.worktree_id);
      
      const { data: worktrees, error: worktreeError } = await this.supabase
        .from('worktree_definitions')
        .select('*')
        .in('id', worktreeIds)
        .order('alias_number');

      if (worktreeError) throw worktreeError;
      return worktrees || [];
    } catch (error) {
      console.error('Error fetching worktrees for pipeline:', error);
      throw error;
    }
  }
}