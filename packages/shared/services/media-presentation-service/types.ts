/**
 * Types for Media Presentation Service
 */

import { Database } from '../../../../supabase/types';

// Type aliases from database
export type MediaPresentation = Database['public']['Tables']['media_presentations']['Row'];
export type MediaPresentationInsert = Database['public']['Tables']['media_presentations']['Insert'];
export type MediaPresentationUpdate = Database['public']['Tables']['media_presentations']['Update'];

export type MediaPresentationAsset = Database['public']['Tables']['media_presentation_assets']['Row'];
export type MediaPresentationAssetInsert = Database['public']['Tables']['media_presentation_assets']['Insert'];
export type MediaPresentationAssetUpdate = Database['public']['Tables']['media_presentation_assets']['Update'];

// Service-specific types
export interface PresentationWithAssets extends MediaPresentation {
  assets?: MediaPresentationAsset[];
}

export interface CreatePresentationInput {
  title: string;
  expert_document_id?: string | null;
  video_source_id?: string | null;
  root_drive_id?: string | null;
  high_level_folder_source_id?: string | null;
  web_view_link?: string | null;
  duration_seconds?: number | null;
}

export interface UpdatePresentationInput {
  title?: string;
  expert_document_id?: string | null;
  video_source_id?: string | null;
  duration_seconds?: number | null;
  view_count?: number | null;
}

export interface LinkAssetInput {
  presentation_id: string;
  asset_source_id?: string | null;
  asset_expert_document_id?: string | null;
  asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null;
  asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null;
  importance_level?: number | null;
  timestamp_start?: number | null;
  timestamp_end?: number | null;
  user_notes?: string | null;
  metadata?: any;
}