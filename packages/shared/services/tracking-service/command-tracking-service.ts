/**
 * Command Tracking Service
 * 
 * Tracks execution of CLI pipeline commands for auditing and monitoring purposes.
 * Records each command execution with details about execution time, status, and results.
 */
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../utils/logger';
import { SupabaseClientService } from '../supabase-client';

/**
 * Tracking record structure for command execution
 */
export interface CommandTrackingRecord {
  id?: string;
  pipeline_name: string;
  command_name: string;
  execution_time: string | Date;
  duration_ms?: number;
  status: 'success' | 'error' | 'running';
  records_affected?: number | null;
  affected_entity?: string | null;
  summary?: string | null;
  error_message?: string | null;
  created_at?: string | Date;
}

/**
 * Command tracking service implementation
 */
export class CommandTrackingService {
  private static instance: CommandTrackingService;
  private supabaseService: SupabaseClientService;
  private TRACKING_TABLE = 'cli_command_tracking';
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.supabaseService = SupabaseClientService.getInstance();
    Logger.debug('CommandTrackingService initialized');
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): CommandTrackingService {
    if (!CommandTrackingService.instance) {
      CommandTrackingService.instance = new CommandTrackingService();
    }
    return CommandTrackingService.instance;
  }
  
  /**
   * Start tracking a command (creates a record with 'running' status)
   * @param pipelineName Name of the CLI pipeline (e.g., 'document', 'google_sync')
   * @param commandName Name of the specific command being executed
   * @returns tracking ID to update when command completes
   */
  public async startTracking(
    pipelineName: string, 
    commandName: string
  ): Promise<string> {
    try {
      const trackingId = uuidv4();
      const executionTime = new Date();
      
      const record: CommandTrackingRecord = {
        id: trackingId,
        pipeline_name: pipelineName,
        command_name: commandName,
        execution_time: executionTime.toISOString(),
        status: 'running',
        created_at: executionTime.toISOString()
      };
      
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from(this.TRACKING_TABLE)
        .insert(record);
      
      if (error) {
        Logger.error(`Error creating command tracking record: ${error.message}`);
        // Return a valid ID even if tracking fails - we don't want to break command execution
        return trackingId;
      }
      
      Logger.debug(`Started tracking command: ${pipelineName}/${commandName} (ID: ${trackingId})`);
      return trackingId;
    } catch (error) {
      Logger.error(`Exception in startTracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Return a valid ID even if tracking fails
      return uuidv4();
    }
  }
  
  /**
   * Update tracking for a command that has completed successfully
   * @param trackingId ID returned from startTracking
   * @param results Optional information about the command results
   */
  public async completeTracking(
    trackingId: string,
    results?: {
      recordsAffected?: number;
      affectedEntity?: string;
      summary?: string;
    }
  ): Promise<void> {
    try {
      // Get the original record to calculate duration
      const supabase = this.supabaseService.getClient();
      const { data, error: fetchError } = await supabase
        .from(this.TRACKING_TABLE)
        .select('execution_time')
        .eq('id', trackingId)
        .single();
      
      if (fetchError) {
        Logger.error(`Error fetching original tracking record: ${fetchError.message}`);
        return;
      }
      
      // Calculate duration in milliseconds
      const startTime = new Date(data.execution_time);
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      // Update the record
      const updateData: Partial<CommandTrackingRecord> = {
        status: 'success',
        duration_ms: durationMs,
        records_affected: results?.recordsAffected ?? null,
        affected_entity: results?.affectedEntity ?? null,
        summary: results?.summary ?? null
      };
      
      const { error } = await supabase
        .from(this.TRACKING_TABLE)
        .update(updateData)
        .eq('id', trackingId);
      
      if (error) {
        Logger.error(`Error updating command tracking record: ${error.message}`);
        return;
      }
      
      Logger.debug(`Completed tracking for command ID: ${trackingId}`);
    } catch (error) {
      Logger.error(`Exception in completeTracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update tracking for a command that has failed
   * @param trackingId ID returned from startTracking
   * @param errorMessage Error message or details about the failure
   */
  public async failTracking(
    trackingId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      // Get the original record to calculate duration
      const supabase = this.supabaseService.getClient();
      const { data, error: fetchError } = await supabase
        .from(this.TRACKING_TABLE)
        .select('execution_time')
        .eq('id', trackingId)
        .single();
      
      if (fetchError) {
        Logger.error(`Error fetching original tracking record: ${fetchError.message}`);
        return;
      }
      
      // Calculate duration in milliseconds
      const startTime = new Date(data.execution_time);
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      // Update the record
      const updateData: Partial<CommandTrackingRecord> = {
        status: 'error',
        duration_ms: durationMs,
        error_message: errorMessage
      };
      
      const { error } = await supabase
        .from(this.TRACKING_TABLE)
        .update(updateData)
        .eq('id', trackingId);
      
      if (error) {
        Logger.error(`Error updating command tracking record: ${error.message}`);
        return;
      }
      
      Logger.debug(`Updated tracking for failed command ID: ${trackingId}`);
    } catch (error) {
      Logger.error(`Exception in failTracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Track an entire command execution in one call
   * Useful for simpler commands or when you don't need to track the 'running' state
   * @param options Command tracking details
   */
  public async trackCommand(options: {
    pipelineName: string;
    commandName: string;
    startTime: Date;
    status: 'success' | 'error';
    recordsAffected?: number;
    affectedEntity?: string;
    summary?: string;
    errorMessage?: string;
  }): Promise<string> {
    try {
      const trackingId = uuidv4();
      const endTime = new Date();
      const durationMs = endTime.getTime() - options.startTime.getTime();
      
      const record: CommandTrackingRecord = {
        id: trackingId,
        pipeline_name: options.pipelineName,
        command_name: options.commandName,
        execution_time: options.startTime.toISOString(),
        duration_ms: durationMs,
        status: options.status,
        records_affected: options.recordsAffected ?? null,
        affected_entity: options.affectedEntity ?? null,
        summary: options.summary ?? null,
        error_message: options.errorMessage ?? null,
        created_at: options.startTime.toISOString()
      };
      
      const supabase = this.supabaseService.getClient();
      const { error } = await supabase
        .from(this.TRACKING_TABLE)
        .insert(record);
      
      if (error) {
        Logger.error(`Error creating command tracking record: ${error.message}`);
        return trackingId;
      }
      
      Logger.debug(`Tracked command: ${options.pipelineName}/${options.commandName} (ID: ${trackingId})`);
      return trackingId;
    } catch (error) {
      Logger.error(`Exception in trackCommand: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return uuidv4();
    }
  }
  
  /**
   * Get recent command executions
   * @param limit Maximum number of records to return
   * @param pipeline Filter by specific pipeline (optional)
   * @param status Filter by status (optional)
   */
  public async getRecentCommands(
    limit: number = 100,
    pipeline?: string,
    status?: 'success' | 'error' | 'running'
  ): Promise<CommandTrackingRecord[]> {
    try {
      const supabase = this.supabaseService.getClient();
      let query = supabase
        .from(this.TRACKING_TABLE)
        .select('*')
        .order('execution_time', { ascending: false })
        .limit(limit);
      
      // Apply filters if provided
      if (pipeline) {
        query = query.eq('pipeline_name', pipeline);
      }
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) {
        Logger.error(`Error fetching command history: ${error.message}`);
        return [];
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception in getRecentCommands: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
  
  /**
   * Get command execution stats grouped by pipeline and command
   * Useful for reporting on most commonly used commands
   */
  public async getCommandStats(): Promise<any[]> {
    try {
      const supabase = this.supabaseService.getClient();
      const { data, error } = await supabase.rpc('get_cli_command_stats');
      
      if (error) {
        Logger.error(`Error fetching command stats: ${error.message}`);
        return [];
      }
      
      return data || [];
    } catch (error) {
      Logger.error(`Exception in getCommandStats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }
}

// Export singleton instance
export const commandTrackingService = CommandTrackingService.getInstance();