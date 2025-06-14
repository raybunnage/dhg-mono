/**
 * Media Presentation Service
 * 
 * Manages media presentations and their associated assets
 * Works with the renamed tables: media_presentations and media_presentation_assets
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../supabase-client';
import { Database } from '../../../../supabase/types';
import type {
  MediaPresentation,
  MediaPresentationInsert,
  MediaPresentationUpdate,
  MediaPresentationAsset,
  PresentationWithAssets,
  CreatePresentationInput,
  UpdatePresentationInput,
  LinkAssetInput
} from './types';

export class MediaPresentationService {
  private static instances = new Map<SupabaseClient, MediaPresentationService>();
  private supabase: SupabaseClient<Database>;

  private constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  /**
   * Get instance for browser environments (requires Supabase client)
   * For CLI/server environments, pass no parameter to use singleton
   */
  public static getInstance(supabaseClient?: SupabaseClient<Database>): MediaPresentationService {
    // If no client provided, try to use the singleton (CLI/server only)
    if (!supabaseClient) {
      if (typeof window !== 'undefined') {
        throw new Error('Browser environment requires a Supabase client to be passed to getInstance()');
      }
      // CLI/server environment - use singleton
      supabaseClient = SupabaseClientService.getInstance().getClient() as SupabaseClient<Database>;
    }

    // Check if we already have an instance for this client
    if (!MediaPresentationService.instances.has(supabaseClient)) {
      MediaPresentationService.instances.set(supabaseClient, new MediaPresentationService(supabaseClient));
    }
    
    return MediaPresentationService.instances.get(supabaseClient)!;
  }

  /**
   * Get a presentation by ID
   */
  async getPresentationById(id: string): Promise<MediaPresentation | null> {
    const { data, error } = await this.supabase
      .from('media_presentations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  }

  /**
   * Get all presentations with optional filtering
   */
  async getAllPresentations(filter?: { 
    expert_document_id?: string;
    root_drive_id?: string;
  }): Promise<MediaPresentation[]> {
    let query = this.supabase
      .from('media_presentations')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.expert_document_id) {
      query = query.eq('expert_document_id', filter.expert_document_id);
    }
    if (filter?.root_drive_id) {
      query = query.eq('root_drive_id', filter.root_drive_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  }

  /**
   * Get presentation with its assets
   */
  async getPresentationWithAssets(id: string): Promise<PresentationWithAssets | null> {
    // Get presentation
    const presentation = await this.getPresentationById(id);
    if (!presentation) return null;

    // Get assets
    const { data: assets, error } = await this.supabase
      .from('media_presentation_assets')
      .select('*')
      .eq('presentation_id', id)
      .order('timestamp_start', { ascending: true });

    if (error) throw error;

    return {
      ...presentation,
      assets: assets || []
    };
  }

  /**
   * Get assets for a presentation
   */
  async getPresentationAssets(presentationId: string): Promise<MediaPresentationAsset[]> {
    const { data, error } = await this.supabase
      .from('media_presentation_assets')
      .select('*')
      .eq('presentation_id', presentationId)
      .order('timestamp_start', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Create a new presentation
   */
  async createPresentation(input: CreatePresentationInput): Promise<MediaPresentation> {
    const presentationData: MediaPresentationInsert = {
      title: input.title,
      expert_document_id: input.expert_document_id,
      video_source_id: input.video_source_id,
      root_drive_id: input.root_drive_id,
      high_level_folder_source_id: input.high_level_folder_source_id,
      web_view_link: input.web_view_link,
      duration_seconds: input.duration_seconds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('media_presentations')
      .insert(presentationData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a presentation
   */
  async updatePresentation(id: string, input: UpdatePresentationInput): Promise<MediaPresentation> {
    const updateData: MediaPresentationUpdate = {
      ...input,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('media_presentations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a presentation (will cascade delete assets due to FK constraint)
   */
  async deletePresentation(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('media_presentations')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  /**
   * Link an asset to a presentation
   */
  async linkAssetToPresentation(input: LinkAssetInput): Promise<MediaPresentationAsset> {
    const assetData = {
      ...input,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('media_presentation_assets')
      .insert(assetData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Unlink an asset from a presentation
   */
  async unlinkAssetFromPresentation(assetId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('media_presentation_assets')
      .delete()
      .eq('id', assetId);

    if (error) throw error;
    return true;
  }

  /**
   * Update an asset link
   */
  async updateAssetLink(assetId: string, updates: Partial<LinkAssetInput>): Promise<MediaPresentationAsset> {
    const { data, error } = await this.supabase
      .from('media_presentation_assets')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// Export getter function for backward compatibility
export const getMediaPresentationService = (supabaseClient?: SupabaseClient<Database>) => {
  return MediaPresentationService.getInstance(supabaseClient);
};