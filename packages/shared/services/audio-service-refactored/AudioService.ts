/**
 * Audio Service - Refactored
 * 
 * Service for handling audio file metadata operations from the database.
 * This service queries audio files and their associated transcripts from
 * the Supabase database. It's cross-platform compatible (browser & Node.js).
 * 
 * Refactored to extend BusinessService for proper dependency injection
 * and enhanced error handling.
 */

import { BusinessService } from '../base-classes/BusinessService';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/supabase';

// Type definitions for audio file data
export interface AudioFile {
  id: string;
  name: string;
  web_view_link: string | null;
  drive_id: string;
  mime_type: string;
  path: string | null;
  metadata: Record<string, any> | null;
  google_sources_experts?: {
    expert_id: string;
    experts: {
      expert_name: string;
      full_name: string | null;
    };
  }[];
}

export interface AudioFileOptions {
  limit?: number;
  offset?: number;
  includeExperts?: boolean;
  mimeTypes?: string[];
}

export interface TranscriptData {
  id: string;
  raw_content: string | null;
  processed_content: string | Record<string, any> | null;
  source_id: string;
}

export interface AudioServiceMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  cacheHits: number;
  cacheMisses: number;
  averageQueryTime: number;
}

/**
 * Service for handling audio file metadata operations
 */
export class AudioService extends BusinessService<Database> {
  private supabase: SupabaseClient<Database>;
  
  // Enhanced features
  private queryCache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheDuration = 300000; // 5 minutes
  private metrics: AudioServiceMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageQueryTime: 0
  };
  
  // Default MIME types for audio files
  private readonly defaultAudioMimeTypes = [
    'audio/x-m4a',
    'audio/mp4a',
    'audio/mp4',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
    'audio/flac'
  ];

  constructor(supabase: SupabaseClient<Database>) {
    super('AudioService', { supabase });
    this.supabase = supabase;
  }

  /**
   * Validate dependencies
   */
  protected validateDependencies(): void {
    if (!this.dependencies.supabase) {
      throw new Error('Supabase client is required');
    }
  }

  /**
   * Initialize the service
   */
  protected async initialize(): Promise<void> {
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Clean every minute
    
    this.logger.info('AudioService initialized successfully');
  }

  /**
   * Get audio files from google_sources table with enhanced options
   */
  public async getAudioFiles(options: AudioFileOptions = {}): Promise<AudioFile[]> {
    await this.ensureInitialized();
    
    const {
      limit = 100,
      offset = 0,
      includeExperts = true,
      mimeTypes = this.defaultAudioMimeTypes
    } = options;
    
    const cacheKey = `audio-files-${JSON.stringify(options)}`;
    
    // Check cache
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }
    
    const startTime = Date.now();
    this.metrics.totalQueries++;
    
    try {
      // Build query
      let query = this.supabase
        .from('google_sources')
        .select(includeExperts ? `
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          google_sources_experts(
            expert_id,
            experts:expert_id(
              expert_name,
              full_name
            )
          )
        ` : `
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata
        `);
      
      // Build MIME type filter
      const mimeTypeFilters = mimeTypes.map(type => 
        type.includes('%') ? `mime_type.like.${type}` : `mime_type.eq.${type}`
      ).join(',');
      
      query = query
        .or(mimeTypeFilters)
        .is('is_deleted', false)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);
      
      const { data, error } = await query;
      
      if (error) {
        this.metrics.failedQueries++;
        this.logger.error('Error fetching audio files:', error);
        throw error;
      }
      
      const result = (data || []) as AudioFile[];
      
      // Update metrics
      this.metrics.successfulQueries++;
      this.updateAverageQueryTime(Date.now() - startTime);
      this.metrics.cacheMisses++;
      
      // Cache result
      this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch audio files: ${errorMessage}`);
    }
  }

  /**
   * Get audio file by ID with caching
   */
  public async getAudioFile(id: string): Promise<AudioFile | null> {
    await this.ensureInitialized();
    
    // Validate input
    this.validateInput({ id }, {
      id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9-_]+$/ }
    });
    
    const cacheKey = `audio-file-${id}`;
    
    // Check cache
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }
    
    const startTime = Date.now();
    this.metrics.totalQueries++;
    
    try {
      const { data, error } = await this.supabase
        .from('google_sources')
        .select(`
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          google_sources_experts(
            expert_id,
            experts:expert_id(
              expert_name,
              full_name
            )
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Not found
          this.metrics.successfulQueries++;
          return null;
        }
        this.metrics.failedQueries++;
        this.logger.error(`Error fetching audio file with id ${id}:`, error);
        throw error;
      }
      
      const result = data as AudioFile;
      
      // Update metrics
      this.metrics.successfulQueries++;
      this.updateAverageQueryTime(Date.now() - startTime);
      this.metrics.cacheMisses++;
      
      // Cache result
      this.setCachedResult(cacheKey, result);
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch audio file ${id}: ${errorMessage}`);
    }
  }

  /**
   * Get associated transcript for an audio file
   */
  public async getTranscript(sourceId: string): Promise<string | null> {
    await this.ensureInitialized();
    
    // Validate input
    this.validateInput({ sourceId }, {
      sourceId: { type: 'string', required: true }
    });
    
    const cacheKey = `transcript-${sourceId}`;
    
    // Check cache
    const cached = this.getCachedResult(cacheKey);
    if (cached !== undefined) {
      this.metrics.cacheHits++;
      return cached;
    }
    
    const startTime = Date.now();
    this.metrics.totalQueries++;
    
    try {
      const { data, error } = await this.supabase
        .from('google_expert_documents')
        .select('id, raw_content, processed_content, source_id')
        .eq('source_id', sourceId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') { // Not found
          this.metrics.successfulQueries++;
          this.setCachedResult(cacheKey, null);
          return null;
        }
        this.metrics.failedQueries++;
        this.logger.error(`Error fetching transcript for source ${sourceId}:`, error);
        throw error;
      }
      
      let transcript: string | null = null;
      
      if (data?.raw_content) {
        transcript = data.raw_content;
      } else if (data?.processed_content) {
        if (typeof data.processed_content === 'string') {
          transcript = data.processed_content;
        } else {
          // If processed_content is an object, stringify it
          transcript = JSON.stringify(data.processed_content, null, 2);
        }
      }
      
      // Update metrics
      this.metrics.successfulQueries++;
      this.updateAverageQueryTime(Date.now() - startTime);
      this.metrics.cacheMisses++;
      
      // Cache result
      this.setCachedResult(cacheKey, transcript);
      
      return transcript;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch transcript for source ${sourceId}: ${errorMessage}`);
    }
  }

  /**
   * Search audio files by name or metadata
   */
  public async searchAudioFiles(
    searchTerm: string,
    options: AudioFileOptions = {}
  ): Promise<AudioFile[]> {
    await this.ensureInitialized();
    
    const { limit = 50, includeExperts = true } = options;
    
    try {
      const { data, error } = await this.supabase
        .from('google_sources')
        .select(includeExperts ? `
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata,
          google_sources_experts(
            expert_id,
            experts:expert_id(
              expert_name,
              full_name
            )
          )
        ` : `
          id,
          name,
          web_view_link,
          drive_id,
          mime_type,
          path,
          metadata
        `)
        .or(`name.ilike.%${searchTerm}%,path.ilike.%${searchTerm}%`)
        .in('mime_type', this.defaultAudioMimeTypes)
        .is('is_deleted', false)
        .order('name', { ascending: true })
        .limit(limit);
      
      if (error) {
        this.logger.error('Error searching audio files:', error);
        throw error;
      }
      
      return (data || []) as AudioFile[];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to search audio files: ${errorMessage}`);
    }
  }

  /**
   * Get audio files by expert
   */
  public async getAudioFilesByExpert(
    expertId: string,
    options: AudioFileOptions = {}
  ): Promise<AudioFile[]> {
    await this.ensureInitialized();
    
    const { limit = 100 } = options;
    
    try {
      const { data, error } = await this.supabase
        .from('google_sources_experts')
        .select(`
          google_sources:source_id(
            id,
            name,
            web_view_link,
            drive_id,
            mime_type,
            path,
            metadata
          )
        `)
        .eq('expert_id', expertId)
        .limit(limit);
      
      if (error) {
        this.logger.error(`Error fetching audio files for expert ${expertId}:`, error);
        throw error;
      }
      
      // Flatten the results and filter for audio files
      const audioFiles = (data || [])
        .map(item => item.google_sources)
        .filter(file => file && this.isAudioFile(file.mime_type))
        .filter(Boolean) as AudioFile[];
      
      return audioFiles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch audio files for expert ${expertId}: ${errorMessage}`);
    }
  }

  /**
   * Get metrics for monitoring
   */
  public getMetrics(): AudioServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageQueryTime: 0
    };
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.queryCache.clear();
    this.logger.info('Audio service cache cleared');
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    try {
      // Test database connection with a simple query
      const { error } = await this.supabase
        .from('google_sources')
        .select('id')
        .limit(1);
      
      const dbHealthy = !error;
      
      return {
        healthy: this.initialized && dbHealthy,
        details: {
          initialized: this.initialized,
          databaseConnection: dbHealthy,
          cacheSize: this.queryCache.size,
          metrics: this.getMetrics()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          initialized: this.initialized,
          databaseConnection: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Shutdown
   */
  protected async shutdown(): Promise<void> {
    this.queryCache.clear();
    this.logger.info('AudioService shut down successfully');
  }

  // Private helper methods

  private isAudioFile(mimeType: string): boolean {
    return this.defaultAudioMimeTypes.some(type => 
      mimeType === type || mimeType.includes(type.replace('audio/', ''))
    );
  }

  private getCachedResult(key: string): any {
    const cached = this.queryCache.get(key);
    if (!cached) return undefined;
    
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheDuration) {
      this.queryCache.delete(key);
      return undefined;
    }
    
    return cached.data;
  }

  private setCachedResult(key: string, data: any): void {
    this.queryCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.queryCache.entries()) {
      if (now - entry.timestamp > this.cacheDuration) {
        this.queryCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  private updateAverageQueryTime(duration: number): void {
    const totalTime = this.metrics.averageQueryTime * 
      (this.metrics.successfulQueries - 1) + duration;
    this.metrics.averageQueryTime = totalTime / this.metrics.successfulQueries;
  }
}