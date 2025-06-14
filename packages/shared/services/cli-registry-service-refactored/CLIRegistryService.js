// Temporary JavaScript wrapper for testing
const { BusinessService } = require('../base-classes/BusinessService');

class CLIRegistryService extends BusinessService {
  constructor(supabaseClient, logger) {
    super('CLIRegistryService', { supabaseClient }, logger);
  }

  async initialize() {
    // No special initialization needed
  }

  async cleanup() {
    // No special cleanup needed
  }

  async healthCheck() {
    try {
      const { error } = await this.dependencies.supabaseClient
        .from('command_pipelines')
        .select('id')
        .limit(1);
      
      return {
        healthy: !error,
        serviceName: this.serviceName,
        timestamp: new Date(),
        details: {
          supabaseConnected: !error
        },
        error: error ? error.message : undefined
      };
    } catch (error) {
      return {
        healthy: false,
        serviceName: this.serviceName,
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  async findPipelineByName(name) {
    return this.validateInput({ name }, () => {
      if (!name || !name.trim()) {
        throw new Error('Pipeline name is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('command_pipelines')
        .select('*')
        .eq('name', name)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    }, { operationName: 'findPipelineByName' }));
  }

  async getCommands(pipelineId) {
    return this.validateInput({ pipelineId }, () => {
      if (!pipelineId || !pipelineId.trim()) {
        throw new Error('Pipeline ID is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('command_definitions')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('display_order');

      if (error) throw error;
      return data || [];
    }, { operationName: 'getCommands' }));
  }

  async getAllPipelines(status = 'active') {
    return this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('command_pipelines')
        .select('*')
        .eq('status', status)
        .order('name');

      if (error) throw error;
      return data || [];
    }, { operationName: 'getAllPipelines' });
  }

  async addCommand(commandData) {
    return this.validateInput({ commandData }, () => {
      if (!commandData.pipeline_id || !commandData.pipeline_id.trim()) {
        throw new Error('Pipeline ID is required');
      }
      if (!commandData.command_name || !commandData.command_name.trim()) {
        throw new Error('Command name is required');
      }
      if (!commandData.description || !commandData.description.trim()) {
        throw new Error('Description is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('command_definitions')
        .insert(commandData)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { operationName: 'addCommand' }));
  }

  async updateCommand(commandId, updateData) {
    return this.validateInput({ commandId, updateData }, () => {
      if (!commandId || !commandId.trim()) {
        throw new Error('Command ID is required');
      }
      if (!updateData || Object.keys(updateData).length === 0) {
        throw new Error('Update data cannot be empty');
      }
    })
    .then(() => this.withRetry(async () => {
      const { data, error } = await this.dependencies.supabaseClient
        .from('command_definitions')
        .update(updateData)
        .eq('id', commandId)
        .select()
        .single();

      if (error) throw error;
      return data;
    }, { operationName: 'updateCommand' }));
  }

  async deleteCommand(commandId) {
    return this.validateInput({ commandId }, () => {
      if (!commandId || !commandId.trim()) {
        throw new Error('Command ID is required');
      }
    })
    .then(() => this.withRetry(async () => {
      const { error } = await this.dependencies.supabaseClient
        .from('command_definitions')
        .delete()
        .eq('id', commandId);

      if (error) throw error;
    }, { operationName: 'deleteCommand' }));
  }
}

module.exports = { CLIRegistryService };