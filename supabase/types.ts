export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_processing_attempts: {
        Row: {
          cost: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          expert_document_id: string
          id: string
          input_tokens: number | null
          model_name: string
          output_tokens: number | null
          prompt: string | null
          success: boolean | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          expert_document_id: string
          id?: string
          input_tokens?: number | null
          model_name: string
          output_tokens?: number | null
          prompt?: string | null
          success?: boolean | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          expert_document_id?: string
          id?: string
          input_tokens?: number | null
          model_name?: string
          output_tokens?: number | null
          prompt?: string | null
          success?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_processing_attempts_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      app_pages: {
        Row: {
          app_name: string
          created_at: string | null
          description: string | null
          id: string
          page_name: string
          page_path: string
          updated_at: string | null
        }
        Insert: {
          app_name: string
          created_at?: string | null
          description?: string | null
          id?: string
          page_name: string
          page_path: string
          updated_at?: string | null
        }
        Update: {
          app_name?: string
          created_at?: string | null
          description?: string | null
          id?: string
          page_name?: string
          page_path?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      app_state: {
        Row: {
          category: string
          description: string | null
          id: string
          is_active: boolean | null
          key_name: string
          last_updated_at: string | null
          last_updated_by: string | null
          metadata: Json | null
          value_data: Json
          value_type: string
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          key_name: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          metadata?: Json | null
          value_data: Json
          value_type: string
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          key_name?: string
          last_updated_at?: string | null
          last_updated_by?: string | null
          metadata?: Json | null
          value_data?: Json
          value_type?: string
        }
        Relationships: []
      }
      asset_types: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      audio_processing_configs: {
        Row: {
          configuration: Json
          created_at: string | null
          description: string | null
          document_type_id: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          configuration: Json
          created_at?: string | null
          description?: string | null
          document_type_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          configuration?: Json
          created_at?: string | null
          description?: string | null
          document_type_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_processing_configs_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_processing_stages: {
        Row: {
          batch_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metrics: Json | null
          output_data: Json | null
          source_id: string | null
          stage_name: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metrics?: Json | null
          output_data?: Json | null
          source_id?: string | null
          stage_name: string
          started_at?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metrics?: Json | null
          output_data?: Json | null
          source_id?: string | null
          stage_name?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_processing_stages_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_status"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "audio_processing_stages_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "processing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_processing_stages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_processor_steps: {
        Row: {
          config_id: string | null
          created_at: string | null
          id: string
          is_required: boolean | null
          processor_type: string
          retry_policy: Json | null
          sequence_order: number
          settings: Json
          step_name: string
          timeout_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          config_id?: string | null
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          processor_type: string
          retry_policy?: Json | null
          sequence_order: number
          settings: Json
          step_name: string
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          config_id?: string | null
          created_at?: string | null
          id?: string
          is_required?: boolean | null
          processor_type?: string
          retry_policy?: Json | null
          sequence_order?: number
          settings?: Json
          step_name?: string
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_processor_steps_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "audio_processing_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_segments: {
        Row: {
          confidence: number | null
          created_at: string | null
          end_time: number
          expert_document_id: string | null
          id: string
          important: boolean | null
          speaker: string | null
          speaker_profile_id: string | null
          start_time: number
          transcript: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          end_time: number
          expert_document_id?: string | null
          id?: string
          important?: boolean | null
          speaker?: string | null
          speaker_profile_id?: string | null
          start_time: number
          transcript: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          end_time?: number
          expert_document_id?: string | null
          id?: string
          important?: boolean | null
          speaker?: string | null
          speaker_profile_id?: string | null
          start_time?: number
          transcript?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_segments_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audio_segments_speaker_profile_id_fkey"
            columns: ["speaker_profile_id"]
            isOneToOne: false
            referencedRelation: "speaker_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      citation_expert_aliases: {
        Row: {
          alias_name: string
          expert_id: number | null
          expert_uuid: string
          id: number
        }
        Insert: {
          alias_name: string
          expert_id?: number | null
          expert_uuid: string
          id?: number
        }
        Update: {
          alias_name?: string
          expert_id?: number | null
          expert_uuid?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_expert_uuid"
            columns: ["expert_uuid"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
        ]
      }
      command_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      command_history: {
        Row: {
          category_id: string | null
          command_text: string
          duration_ms: number | null
          executed_at: string | null
          exit_code: number | null
          id: string
          notes: string | null
          sanitized_command: string
          success: boolean | null
          tags: string[] | null
        }
        Insert: {
          category_id?: string | null
          command_text: string
          duration_ms?: number | null
          executed_at?: string | null
          exit_code?: number | null
          id?: string
          notes?: string | null
          sanitized_command: string
          success?: boolean | null
          tags?: string[] | null
        }
        Update: {
          category_id?: string | null
          command_text?: string
          duration_ms?: number | null
          executed_at?: string | null
          exit_code?: number | null
          id?: string
          notes?: string | null
          sanitized_command?: string
          success?: boolean | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "command_history_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "command_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      command_patterns: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          pattern: string
          replacement: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          pattern: string
          replacement: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          pattern?: string
          replacement?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_type_aliases: {
        Row: {
          alias_name: string
          document_type_id: number
          document_type_uuid: string | null
          id: number
        }
        Insert: {
          alias_name: string
          document_type_id: number
          document_type_uuid?: string | null
          id?: number
        }
        Update: {
          alias_name?: string
          document_type_id?: number
          document_type_uuid?: string | null
          id?: number
        }
        Relationships: []
      }
      document_types: {
        Row: {
          ai_processing_rules: Json | null
          category: string
          content_schema: Json | null
          created_at: string
          current_num_of_type: number | null
          description: string | null
          document_type: string
          document_type_counts: number | null
          file_extension: string | null
          id: string
          is_ai_generated: boolean
          legacy_document_type_id: number | null
          mime_type: string | null
          required_fields: Json | null
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          ai_processing_rules?: Json | null
          category: string
          content_schema?: Json | null
          created_at?: string
          current_num_of_type?: number | null
          description?: string | null
          document_type: string
          document_type_counts?: number | null
          file_extension?: string | null
          id?: string
          is_ai_generated?: boolean
          legacy_document_type_id?: number | null
          mime_type?: string | null
          required_fields?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          ai_processing_rules?: Json | null
          category?: string
          content_schema?: Json | null
          created_at?: string
          current_num_of_type?: number | null
          description?: string | null
          document_type?: string
          document_type_counts?: number | null
          file_extension?: string | null
          id?: string
          is_ai_generated?: boolean
          legacy_document_type_id?: number | null
          mime_type?: string | null
          required_fields?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Relationships: []
      }
      documentation_files: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          file_size: number | null
          id: string | null
          language: string | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          status_recommendation: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string | null
          language?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          status_recommendation?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string | null
          language?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          status_recommendation?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_backup_20240317_snapshot_20240318: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          is_deleted: boolean | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_backup_20250216: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          is_deleted: boolean | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_backup_20250318: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          is_deleted: boolean | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_backup_20250318b: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          is_deleted: boolean | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_backup_20250321: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          status_recommendation: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          status_recommendation?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          status_recommendation?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_backup_20250324: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          status_recommendation: string | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          status_recommendation?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          status_recommendation?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_files_missing_doc_ids: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string
          id: string
          is_deleted: boolean | null
          last_indexed_at: string
          last_modified_at: string
          manual_tags: string[] | null
          metadata: Json | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path: string
          id?: string
          is_deleted?: boolean | null
          last_indexed_at: string
          last_modified_at: string
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string
          id?: string
          is_deleted?: boolean | null
          last_indexed_at?: string
          last_modified_at?: string
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_documentation_files_type"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_files_missing_doc_ids2: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          is_deleted: boolean | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          summary: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      documentation_processing_queue: {
        Row: {
          attempts: number
          created_at: string | null
          error_message: string | null
          file_id: string
          id: string
          last_attempt_at: string | null
          priority: number
          status: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          error_message?: string | null
          file_id: string
          id?: string
          last_attempt_at?: string | null
          priority?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string | null
          error_message?: string | null
          file_id?: string
          id?: string
          last_attempt_at?: string | null
          priority?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentation_processing_queue_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "documentation_files_missing_doc_ids"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_relations: {
        Row: {
          created_at: string | null
          id: string
          relation_type: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relation_type: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relation_type?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentation_relations_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "documentation_files_missing_doc_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentation_relations_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "documentation_files_missing_doc_ids"
            referencedColumns: ["id"]
          },
        ]
      }
      documentation_sections: {
        Row: {
          anchor_id: string
          created_at: string | null
          file_id: string
          heading: string
          id: string
          level: number
          position: number
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          anchor_id: string
          created_at?: string | null
          file_id: string
          heading: string
          id?: string
          level: number
          position: number
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          anchor_id?: string
          created_at?: string | null
          file_id?: string
          heading?: string
          id?: string
          level?: number
          position?: number
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentation_sections_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "documentation_files_missing_doc_ids"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_addresses: {
        Row: {
          created_at: string
          domain_id: string
          email_address: string
          id: string
          is_important: boolean
          is_primary: boolean | null
          last_used_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          domain_id?: string
          email_address: string
          id?: string
          is_important?: boolean
          is_primary?: boolean | null
          last_used_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          domain_id?: string
          email_address?: string
          id?: string
          is_important?: boolean
          is_primary?: boolean | null
          last_used_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_domain_id"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          attachment_cnt: number | null
          content: string | null
          contents_length: number | null
          created_at: string | null
          date: string | null
          domain_id: string
          email_id: number
          id: string
          is_ai_process_for_concepts: number | null
          is_in_concepts: number | null
          is_in_contents: number | null
          is_valid: number | null
          sender: string | null
          subject: string | null
          to_recipients: string | null
          updated_at: string
          url_cnt: number | null
        }
        Insert: {
          attachment_cnt?: number | null
          content?: string | null
          contents_length?: number | null
          created_at?: string | null
          date?: string | null
          domain_id?: string
          email_id: number
          id?: string
          is_ai_process_for_concepts?: number | null
          is_in_concepts?: number | null
          is_in_contents?: number | null
          is_valid?: number | null
          sender?: string | null
          subject?: string | null
          to_recipients?: string | null
          updated_at?: string
          url_cnt?: number | null
        }
        Update: {
          attachment_cnt?: number | null
          content?: string | null
          contents_length?: number | null
          created_at?: string | null
          date?: string | null
          domain_id?: string
          email_id?: number
          id?: string
          is_ai_process_for_concepts?: number | null
          is_in_concepts?: number | null
          is_in_contents?: number | null
          is_valid?: number | null
          sender?: string | null
          subject?: string | null
          to_recipients?: string | null
          updated_at?: string
          url_cnt?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "emails_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_documents: {
        Row: {
          ai_analysis: Json | null
          ai_processing_details: Json | null
          ai_summary_status:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          confidence_score: number | null
          content_type: string | null
          created_at: string
          diarization_complete: boolean | null
          document_type_id: string | null
          error_message: string | null
          expert_id: string | null
          id: string
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          last_error_at: string | null
          last_processed_at: string | null
          last_viewed_at: string | null
          model_used: string | null
          previous_version_id: string | null
          processed_at: string | null
          processed_content: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          processing_stats: Json | null
          processing_status: string | null
          prompt_used: string | null
          queued_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string
          status: string | null
          structure: Json | null
          summary_complete: boolean | null
          token_count: number | null
          topics: string[] | null
          transcription_complete: boolean | null
          updated_at: string
          version: number | null
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          ai_processing_details?: Json | null
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string
          diarization_complete?: boolean | null
          document_type_id?: string | null
          error_message?: string | null
          expert_id?: string | null
          id?: string
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_error_at?: string | null
          last_processed_at?: string | null
          last_viewed_at?: string | null
          model_used?: string | null
          previous_version_id?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          prompt_used?: string | null
          queued_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id: string
          status?: string | null
          structure?: Json | null
          summary_complete?: boolean | null
          token_count?: number | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          ai_processing_details?: Json | null
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string
          diarization_complete?: boolean | null
          document_type_id?: string | null
          error_message?: string | null
          expert_id?: string | null
          id?: string
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_error_at?: string | null
          last_processed_at?: string | null
          last_viewed_at?: string | null
          model_used?: string | null
          previous_version_id?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          prompt_used?: string | null
          queued_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string
          status?: string | null
          structure?: Json | null
          summary_complete?: boolean | null
          token_count?: number | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batch_processing_status"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "expert_documents_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "processing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_documents_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_documents_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_documents_backup_2025_02_16: {
        Row: {
          ai_analysis: Json | null
          ai_processing_details: Json | null
          ai_summary_status:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          confidence_score: number | null
          content_type: string | null
          created_at: string | null
          diarization_complete: boolean | null
          document_type_id: string | null
          error_message: string | null
          expert_id: string | null
          id: string | null
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          last_error_at: string | null
          last_processed_at: string | null
          last_viewed_at: string | null
          model_used: string | null
          previous_version_id: string | null
          processed_at: string | null
          processed_content: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          processing_stats: Json | null
          processing_status: string | null
          prompt_used: string | null
          queued_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string | null
          status: string | null
          structure: Json | null
          summary_complete: boolean | null
          token_count: number | null
          topics: string[] | null
          transcription_complete: boolean | null
          updated_at: string | null
          version: number | null
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          ai_processing_details?: Json | null
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string | null
          diarization_complete?: boolean | null
          document_type_id?: string | null
          error_message?: string | null
          expert_id?: string | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_error_at?: string | null
          last_processed_at?: string | null
          last_viewed_at?: string | null
          model_used?: string | null
          previous_version_id?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          prompt_used?: string | null
          queued_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          structure?: Json | null
          summary_complete?: boolean | null
          token_count?: number | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          ai_processing_details?: Json | null
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string | null
          diarization_complete?: boolean | null
          document_type_id?: string | null
          error_message?: string | null
          expert_id?: string | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_error_at?: string | null
          last_processed_at?: string | null
          last_viewed_at?: string | null
          model_used?: string | null
          previous_version_id?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          prompt_used?: string | null
          queued_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          structure?: Json | null
          summary_complete?: boolean | null
          token_count?: number | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      experts: {
        Row: {
          bio: string | null
          created_at: string
          email_address: string | null
          experience_years: number | null
          expert_name: string
          expertise_area: string | null
          full_name: string | null
          google_email: string | null
          google_profile_data: Json | null
          google_user_id: string | null
          id: string
          is_in_core_group: boolean
          last_synced_at: string | null
          legacy_expert_id: number | null
          starting_ref_id: number | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email_address?: string | null
          experience_years?: number | null
          expert_name: string
          expertise_area?: string | null
          full_name?: string | null
          google_email?: string | null
          google_profile_data?: Json | null
          google_user_id?: string | null
          id?: string
          is_in_core_group?: boolean
          last_synced_at?: string | null
          legacy_expert_id?: number | null
          starting_ref_id?: number | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email_address?: string | null
          experience_years?: number | null
          expert_name?: string
          expertise_area?: string | null
          full_name?: string | null
          google_email?: string | null
          google_profile_data?: Json | null
          google_user_id?: string | null
          id?: string
          is_in_core_group?: boolean
          last_synced_at?: string | null
          legacy_expert_id?: number | null
          starting_ref_id?: number | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      favorite_commands: {
        Row: {
          category_id: string | null
          command_text: string
          created_at: string | null
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          tags: string[] | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category_id?: string | null
          command_text: string
          created_at?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category_id?: string | null
          command_text?: string
          created_at?: string | null
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          tags?: string[] | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "favorite_commands_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "command_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      function_registry: {
        Row: {
          ai_prompts: Json | null
          app_name: string | null
          category: string
          code_signature: string | null
          created_at: string | null
          dependencies: string[] | null
          description: string
          git_branch: string | null
          git_commit: string | null
          git_commit_hash: string | null
          github_url: string | null
          id: string
          implementation_notes: string | null
          input_types: Json | null
          last_modified_by: string | null
          last_verified_at: string | null
          location: string
          name: string
          output_types: Json | null
          refactor_candidate: boolean | null
          repository: string
          shared_package_status: boolean | null
          similar_functions: Json | null
          specificity: string | null
          status: string | null
          supabase_operations: Json | null
          target_package: string | null
          updated_at: string | null
          used_in: string[] | null
          uses_react: boolean | null
        }
        Insert: {
          ai_prompts?: Json | null
          app_name?: string | null
          category: string
          code_signature?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          description: string
          git_branch?: string | null
          git_commit?: string | null
          git_commit_hash?: string | null
          github_url?: string | null
          id?: string
          implementation_notes?: string | null
          input_types?: Json | null
          last_modified_by?: string | null
          last_verified_at?: string | null
          location: string
          name: string
          output_types?: Json | null
          refactor_candidate?: boolean | null
          repository: string
          shared_package_status?: boolean | null
          similar_functions?: Json | null
          specificity?: string | null
          status?: string | null
          supabase_operations?: Json | null
          target_package?: string | null
          updated_at?: string | null
          used_in?: string[] | null
          uses_react?: boolean | null
        }
        Update: {
          ai_prompts?: Json | null
          app_name?: string | null
          category?: string
          code_signature?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          description?: string
          git_branch?: string | null
          git_commit?: string | null
          git_commit_hash?: string | null
          github_url?: string | null
          id?: string
          implementation_notes?: string | null
          input_types?: Json | null
          last_modified_by?: string | null
          last_verified_at?: string | null
          location?: string
          name?: string
          output_types?: Json | null
          refactor_candidate?: boolean | null
          repository?: string
          shared_package_status?: boolean | null
          similar_functions?: Json | null
          specificity?: string | null
          status?: string | null
          supabase_operations?: Json | null
          target_package?: string | null
          updated_at?: string | null
          used_in?: string[] | null
          uses_react?: boolean | null
        }
        Relationships: []
      }
      function_relationships: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          relationship_type: string | null
          source_function_id: string | null
          target_function_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          relationship_type?: string | null
          source_function_id?: string | null
          target_function_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          relationship_type?: string | null
          source_function_id?: string | null
          target_function_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "function_relationships_source_function_id_fkey"
            columns: ["source_function_id"]
            isOneToOne: false
            referencedRelation: "function_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "function_relationships_source_function_id_fkey"
            columns: ["source_function_id"]
            isOneToOne: false
            referencedRelation: "page_guts_raw_data"
            referencedColumns: ["function_id"]
          },
          {
            foreignKeyName: "function_relationships_target_function_id_fkey"
            columns: ["target_function_id"]
            isOneToOne: false
            referencedRelation: "function_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "function_relationships_target_function_id_fkey"
            columns: ["target_function_id"]
            isOneToOne: false
            referencedRelation: "page_guts_raw_data"
            referencedColumns: ["function_id"]
          },
        ]
      }
      google_auth_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      lionya_emails: {
        Row: {
          created_at: string
          email_address: string | null
          email_count: number | null
          id: string
        }
        Insert: {
          created_at?: string
          email_address?: string | null
          email_count?: number | null
          id?: string
        }
        Update: {
          created_at?: string
          email_address?: string | null
          email_count?: number | null
          id?: string
        }
        Relationships: []
      }
      page_dependencies: {
        Row: {
          created_at: string | null
          dependency_name: string
          dependency_type: string
          details: Json | null
          id: string
          page_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dependency_name: string
          dependency_type: string
          details?: Json | null
          id?: string
          page_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dependency_name?: string
          dependency_type?: string
          details?: Json | null
          id?: string
          page_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_dependencies_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "app_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_dependencies_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "page_guts_raw_data"
            referencedColumns: ["page_id"]
          },
        ]
      }
      page_function_usage: {
        Row: {
          created_at: string | null
          function_id: string
          id: string
          page_id: string
          updated_at: string | null
          usage_type: string
        }
        Insert: {
          created_at?: string | null
          function_id: string
          id?: string
          page_id: string
          updated_at?: string | null
          usage_type: string
        }
        Update: {
          created_at?: string | null
          function_id?: string
          id?: string
          page_id?: string
          updated_at?: string | null
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_function_usage_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "function_registry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_function_usage_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "page_guts_raw_data"
            referencedColumns: ["function_id"]
          },
          {
            foreignKeyName: "page_function_usage_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "app_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_function_usage_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "page_guts_raw_data"
            referencedColumns: ["page_id"]
          },
        ]
      }
      page_table_usage: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          operation_type: string[]
          page_id: string
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          operation_type: string[]
          page_id: string
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          operation_type?: string[]
          page_id?: string
          table_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_table_usage_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "app_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_table_usage_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "page_guts_raw_data"
            referencedColumns: ["page_id"]
          },
        ]
      }
      presentation_assets: {
        Row: {
          asset_role: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_type: Database["public"]["Enums"]["asset_type_enum"] | null
          asset_type_id: string | null
          created_at: string
          expert_document_id: string | null
          id: string
          importance_level: number | null
          metadata: Json | null
          presentation_id: string | null
          source_id: string | null
          timestamp_end: number | null
          timestamp_start: number | null
          updated_at: string
          user_notes: string | null
        }
        Insert: {
          asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null
          asset_type_id?: string | null
          created_at?: string
          expert_document_id?: string | null
          id?: string
          importance_level?: number | null
          metadata?: Json | null
          presentation_id?: string | null
          source_id?: string | null
          timestamp_end?: number | null
          timestamp_start?: number | null
          updated_at?: string
          user_notes?: string | null
        }
        Update: {
          asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null
          asset_type_id?: string | null
          created_at?: string
          expert_document_id?: string | null
          id?: string
          importance_level?: number | null
          metadata?: Json | null
          presentation_id?: string | null
          source_id?: string | null
          timestamp_end?: number | null
          timestamp_start?: number | null
          updated_at?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_assets_asset_type_id_fkey"
            columns: ["asset_type_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_collection_items: {
        Row: {
          collection_id: string
          created_at: string | null
          notes: string | null
          position: number
          presentation_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string | null
          notes?: string | null
          position: number
          presentation_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string | null
          notes?: string | null
          position?: number
          presentation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "presentation_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_collection_items_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_collections: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      presentation_relationships: {
        Row: {
          created_at: string | null
          relationship_type: string
          source_presentation_id: string
          strength: number | null
          target_presentation_id: string
        }
        Insert: {
          created_at?: string | null
          relationship_type: string
          source_presentation_id: string
          strength?: number | null
          target_presentation_id: string
        }
        Update: {
          created_at?: string | null
          relationship_type?: string
          source_presentation_id?: string
          strength?: number | null
          target_presentation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_relationships_source_presentation_id_fkey"
            columns: ["source_presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_relationships_target_presentation_id_fkey"
            columns: ["target_presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_search_index: {
        Row: {
          content_vector: unknown | null
          presentation_id: string
          title_vector: unknown | null
          updated_at: string | null
        }
        Insert: {
          content_vector?: unknown | null
          presentation_id: string
          title_vector?: unknown | null
          updated_at?: string | null
        }
        Update: {
          content_vector?: unknown | null
          presentation_id?: string
          title_vector?: unknown | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_search_index_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: true
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_tag_links: {
        Row: {
          created_at: string | null
          presentation_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          presentation_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          presentation_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_tag_links_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_tag_links_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "presentation_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      presentation_theme_links: {
        Row: {
          created_at: string | null
          presentation_id: string
          relevance_score: number | null
          theme_id: string
        }
        Insert: {
          created_at?: string | null
          presentation_id: string
          relevance_score?: number | null
          theme_id: string
        }
        Update: {
          created_at?: string | null
          presentation_id?: string
          relevance_score?: number | null
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_theme_links_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_theme_links_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "presentation_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_themes: {
        Row: {
          ai_confidence: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      presentations: {
        Row: {
          created_at: string | null
          duration: unknown | null
          duration_seconds: number | null
          filename: string
          folder_path: string
          id: string
          is_public: boolean | null
          main_video_id: string | null
          metadata: Json | null
          presenter_name: string | null
          recorded_date: string | null
          title: string | null
          transcript: string | null
          transcript_status: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          duration?: unknown | null
          duration_seconds?: number | null
          filename: string
          folder_path: string
          id?: string
          is_public?: boolean | null
          main_video_id?: string | null
          metadata?: Json | null
          presenter_name?: string | null
          recorded_date?: string | null
          title?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          duration?: unknown | null
          duration_seconds?: number | null
          filename?: string
          folder_path?: string
          id?: string
          is_public?: boolean | null
          main_video_id?: string | null
          metadata?: Json | null
          presenter_name?: string | null
          recorded_date?: string | null
          title?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "presentations_main_video_id_fkey"
            columns: ["main_video_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      presentations_backup_2024_04_06: {
        Row: {
          created_at: string | null
          duration: unknown | null
          duration_seconds: number | null
          filename: string | null
          folder_path: string | null
          id: string | null
          is_public: boolean | null
          main_video_id: string | null
          metadata: Json | null
          presenter_name: string | null
          recorded_date: string | null
          title: string | null
          transcript: string | null
          transcript_status: string | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          created_at?: string | null
          duration?: unknown | null
          duration_seconds?: number | null
          filename?: string | null
          folder_path?: string | null
          id?: string | null
          is_public?: boolean | null
          main_video_id?: string | null
          metadata?: Json | null
          presenter_name?: string | null
          recorded_date?: string | null
          title?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          created_at?: string | null
          duration?: unknown | null
          duration_seconds?: number | null
          filename?: string | null
          folder_path?: string | null
          id?: string | null
          is_public?: boolean | null
          main_video_id?: string | null
          metadata?: Json | null
          presenter_name?: string | null
          recorded_date?: string | null
          title?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      processing_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          error_details: string | null
          error_message: string | null
          id: string
          item_ids: Json | null
          priority: number | null
          processed_duration_seconds: number | null
          processed_files: number | null
          processor_config: Json | null
          resource_usage: Json | null
          status: string
          total_duration_seconds: number | null
          total_files: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          error_message?: string | null
          id?: string
          item_ids?: Json | null
          priority?: number | null
          processed_duration_seconds?: number | null
          processed_files?: number | null
          processor_config?: Json | null
          resource_usage?: Json | null
          status: string
          total_duration_seconds?: number | null
          total_files: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_details?: string | null
          error_message?: string | null
          id?: string
          item_ids?: Json | null
          priority?: number | null
          processed_duration_seconds?: number | null
          processed_files?: number | null
          processor_config?: Json | null
          resource_usage?: Json | null
          status?: string
          total_duration_seconds?: number | null
          total_files?: number
          updated_at?: string
        }
        Relationships: []
      }
      processing_templates: {
        Row: {
          created_at: string | null
          description: string | null
          file_type_pattern: string | null
          id: string
          name: string
          processor_sequence: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_type_pattern?: string | null
          id?: string
          name: string
          processor_sequence?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_type_pattern?: string | null
          id?: string
          name?: string
          processor_sequence?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      prompt_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          parent_category_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          parent_category_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_category_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "prompt_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_relationships: {
        Row: {
          asset_id: string | null
          asset_path: string
          created_at: string
          description: string | null
          document_type_id: string | null
          id: string
          prompt_id: string
          relationship_context: string | null
          relationship_type: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          asset_path: string
          created_at?: string
          description?: string | null
          document_type_id?: string | null
          id?: string
          prompt_id: string
          relationship_context?: string | null
          relationship_type: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          asset_path?: string
          created_at?: string
          description?: string | null
          document_type_id?: string | null
          id?: string
          prompt_id?: string
          relationship_context?: string | null
          relationship_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_prompt_relationships_document_type"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_relationships_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "documentation_files_missing_doc_ids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_relationships_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_relationships_backup_20250309_205247: {
        Row: {
          child_prompt_id: string
          created_at: string | null
          description: string | null
          id: string
          parent_prompt_id: string
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          updated_at: string | null
        }
        Insert: {
          child_prompt_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          parent_prompt_id: string
          relationship_type: Database["public"]["Enums"]["relationship_type"]
          updated_at?: string | null
        }
        Update: {
          child_prompt_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          parent_prompt_id?: string
          relationship_type?: Database["public"]["Enums"]["relationship_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_relationships_child_prompt_id_fkey"
            columns: ["child_prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_relationships_parent_prompt_id_fkey"
            columns: ["parent_prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_usage: {
        Row: {
          execution_time: number | null
          function_name: string | null
          id: string
          prompt_id: string | null
          response_summary: string | null
          success: boolean | null
          used_at: string | null
        }
        Insert: {
          execution_time?: number | null
          function_name?: string | null
          id?: string
          prompt_id?: string | null
          response_summary?: string | null
          success?: boolean | null
          used_at?: string | null
        }
        Update: {
          execution_time?: number | null
          function_name?: string | null
          id?: string
          prompt_id?: string | null
          response_summary?: string | null
          success?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_usage_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          author: string | null
          category_id: string | null
          content: Json
          created_at: string | null
          description: string | null
          document_type_id: string | null
          file_path: string | null
          id: string
          metadata: Json | null
          name: string
          status: Database["public"]["Enums"]["prompt_status"] | null
          tags: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          author?: string | null
          category_id?: string | null
          content: Json
          created_at?: string | null
          description?: string | null
          document_type_id?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: Database["public"]["Enums"]["prompt_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          author?: string | null
          category_id?: string | null
          content?: Json
          created_at?: string | null
          description?: string | null
          document_type_id?: string | null
          file_path?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: Database["public"]["Enums"]["prompt_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "prompt_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string
          document_type_id: string | null
          file_hash: string | null
          file_path: string
          id: string
          language: string
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json
          package_json_references: Json | null
          script_type_id: string | null
          summary: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string
          document_type_id?: string | null
          file_hash?: string | null
          file_path: string
          id?: string
          language: string
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json
          package_json_references?: Json | null
          script_type_id?: string | null
          summary?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string
          id?: string
          language?: string
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json
          package_json_references?: Json | null
          script_type_id?: string | null
          summary?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scripts_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      scripts_backup_20250216: {
        Row: {
          ai_assessment: Json | null
          ai_generated_tags: string[] | null
          assessment_created_at: string | null
          assessment_date: string | null
          assessment_model: string | null
          assessment_quality_score: number | null
          assessment_updated_at: string | null
          assessment_version: number | null
          created_at: string | null
          document_type_id: string | null
          file_hash: string | null
          file_path: string | null
          id: string | null
          is_deleted: boolean | null
          language: string | null
          last_indexed_at: string | null
          last_modified_at: string | null
          manual_tags: string[] | null
          metadata: Json | null
          package_json_references: Json | null
          script_type_id: string | null
          summary: Json | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          language?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          package_json_references?: Json | null
          script_type_id?: string | null
          summary?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_assessment?: Json | null
          ai_generated_tags?: string[] | null
          assessment_created_at?: string | null
          assessment_date?: string | null
          assessment_model?: string | null
          assessment_quality_score?: number | null
          assessment_updated_at?: string | null
          assessment_version?: number | null
          created_at?: string | null
          document_type_id?: string | null
          file_hash?: string | null
          file_path?: string | null
          id?: string | null
          is_deleted?: boolean | null
          language?: string | null
          last_indexed_at?: string | null
          last_modified_at?: string | null
          manual_tags?: string[] | null
          metadata?: Json | null
          package_json_references?: Json | null
          script_type_id?: string | null
          summary?: Json | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          abstract: string | null
          aggregate_subject_classifications: string | null
          all_references_cnt: number | null
          article_type: string | null
          authors: string | null
          cleaned_authors: string | null
          concept_count: number | null
          created_at: string
          date_text: string | null
          day: number | null
          domain_id: string
          email_content_id: string | null
          email_id: string | null
          expert_id: string | null
          file_hash: string | null
          file_size: number | null
          folder_level: number | null
          google_id: string | null
          has_processing_errors: boolean | null
          has_title_and_reference_info: boolean | null
          keywords: string | null
          month: number | null
          notes: string | null
          parent_id: string | null
          primary_authors: string | null
          processing_error: string | null
          ref_id: number | null
          reference_info: string | null
          reference_tag: string | null
          relationship_action_id: number | null
          source_id: string
          source_identifier: string | null
          source_type: string
          subject_classifications: string | null
          summary: string | null
          title: string | null
          trust_level: number | null
          uni_document_type_id: string | null
          updated_at: string
          url_id: string | null
          user_id: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          aggregate_subject_classifications?: string | null
          all_references_cnt?: number | null
          article_type?: string | null
          authors?: string | null
          cleaned_authors?: string | null
          concept_count?: number | null
          created_at?: string
          date_text?: string | null
          day?: number | null
          domain_id?: string
          email_content_id?: string | null
          email_id?: string | null
          expert_id?: string | null
          file_hash?: string | null
          file_size?: number | null
          folder_level?: number | null
          google_id?: string | null
          has_processing_errors?: boolean | null
          has_title_and_reference_info?: boolean | null
          keywords?: string | null
          month?: number | null
          notes?: string | null
          parent_id?: string | null
          primary_authors?: string | null
          processing_error?: string | null
          ref_id?: number | null
          reference_info?: string | null
          reference_tag?: string | null
          relationship_action_id?: number | null
          source_id?: string
          source_identifier?: string | null
          source_type: string
          subject_classifications?: string | null
          summary?: string | null
          title?: string | null
          trust_level?: number | null
          uni_document_type_id?: string | null
          updated_at?: string
          url_id?: string | null
          user_id?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          aggregate_subject_classifications?: string | null
          all_references_cnt?: number | null
          article_type?: string | null
          authors?: string | null
          cleaned_authors?: string | null
          concept_count?: number | null
          created_at?: string
          date_text?: string | null
          day?: number | null
          domain_id?: string
          email_content_id?: string | null
          email_id?: string | null
          expert_id?: string | null
          file_hash?: string | null
          file_size?: number | null
          folder_level?: number | null
          google_id?: string | null
          has_processing_errors?: boolean | null
          has_title_and_reference_info?: boolean | null
          keywords?: string | null
          month?: number | null
          notes?: string | null
          parent_id?: string | null
          primary_authors?: string | null
          processing_error?: string | null
          ref_id?: number | null
          reference_info?: string | null
          reference_tag?: string | null
          relationship_action_id?: number | null
          source_id?: string
          source_identifier?: string | null
          source_type?: string
          subject_classifications?: string | null
          summary?: string | null
          title?: string | null
          trust_level?: number | null
          uni_document_type_id?: string | null
          updated_at?: string
          url_id?: string | null
          user_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sources_domain_id"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sources_expert_id"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sources_parent_id"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["source_id"]
          },
        ]
      }
      sources_google: {
        Row: {
          audio_bitrate: number | null
          audio_channels: number | null
          audio_duration_seconds: number | null
          audio_extracted: boolean | null
          audio_extraction_path: string | null
          audio_quality_metrics: Json | null
          content_extracted: boolean | null
          created_at: string
          deleted: boolean | null
          document_type_id: string | null
          drive_id: string
          expert_id: string | null
          extracted_content: Json | null
          extraction_error: string | null
          id: string
          is_root: boolean | null
          last_indexed: string | null
          metadata: Json | null
          mime_type: string
          modified_time: string | null
          name: string
          parent_folder_id: string | null
          parent_id: string | null
          parent_path: string | null
          path: string | null
          size: number | null
          size_bytes: number | null
          sync_error: string | null
          sync_id: string | null
          sync_status: string | null
          thumbnail_link: string | null
          updated_at: string
          web_view_link: string | null
        }
        Insert: {
          audio_bitrate?: number | null
          audio_channels?: number | null
          audio_duration_seconds?: number | null
          audio_extracted?: boolean | null
          audio_extraction_path?: string | null
          audio_quality_metrics?: Json | null
          content_extracted?: boolean | null
          created_at?: string
          deleted?: boolean | null
          document_type_id?: string | null
          drive_id: string
          expert_id?: string | null
          extracted_content?: Json | null
          extraction_error?: string | null
          id?: string
          is_root?: boolean | null
          last_indexed?: string | null
          metadata?: Json | null
          mime_type: string
          modified_time?: string | null
          name: string
          parent_folder_id?: string | null
          parent_id?: string | null
          parent_path?: string | null
          path?: string | null
          size?: number | null
          size_bytes?: number | null
          sync_error?: string | null
          sync_id?: string | null
          sync_status?: string | null
          thumbnail_link?: string | null
          updated_at?: string
          web_view_link?: string | null
        }
        Update: {
          audio_bitrate?: number | null
          audio_channels?: number | null
          audio_duration_seconds?: number | null
          audio_extracted?: boolean | null
          audio_extraction_path?: string | null
          audio_quality_metrics?: Json | null
          content_extracted?: boolean | null
          created_at?: string
          deleted?: boolean | null
          document_type_id?: string | null
          drive_id?: string
          expert_id?: string | null
          extracted_content?: Json | null
          extraction_error?: string | null
          id?: string
          is_root?: boolean | null
          last_indexed?: string | null
          metadata?: Json | null
          mime_type?: string
          modified_time?: string | null
          name?: string
          parent_folder_id?: string | null
          parent_id?: string | null
          parent_path?: string | null
          path?: string | null
          size?: number | null
          size_bytes?: number | null
          sync_error?: string | null
          sync_id?: string | null
          sync_status?: string | null
          thumbnail_link?: string | null
          updated_at?: string
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_google_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_google_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
        ]
      }
      sources_google_backup: {
        Row: {
          audio_bitrate: number | null
          audio_channels: number | null
          audio_duration_seconds: number | null
          audio_extracted: boolean | null
          audio_extraction_path: string | null
          audio_quality_metrics: Json | null
          content_extracted: boolean | null
          created_at: string | null
          deleted: boolean | null
          document_type_id: string | null
          drive_id: string | null
          expert_id: string | null
          extracted_content: Json | null
          extraction_error: string | null
          id: string | null
          is_root: boolean | null
          last_indexed: string | null
          metadata: Json | null
          mime_type: string | null
          modified_time: string | null
          name: string | null
          parent_folder_id: string | null
          parent_id: string | null
          parent_path: string | null
          path: string | null
          size: number | null
          size_bytes: number | null
          sync_error: string | null
          sync_id: string | null
          sync_status: string | null
          thumbnail_link: string | null
          updated_at: string | null
          web_view_link: string | null
        }
        Insert: {
          audio_bitrate?: number | null
          audio_channels?: number | null
          audio_duration_seconds?: number | null
          audio_extracted?: boolean | null
          audio_extraction_path?: string | null
          audio_quality_metrics?: Json | null
          content_extracted?: boolean | null
          created_at?: string | null
          deleted?: boolean | null
          document_type_id?: string | null
          drive_id?: string | null
          expert_id?: string | null
          extracted_content?: Json | null
          extraction_error?: string | null
          id?: string | null
          is_root?: boolean | null
          last_indexed?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_time?: string | null
          name?: string | null
          parent_folder_id?: string | null
          parent_id?: string | null
          parent_path?: string | null
          path?: string | null
          size?: number | null
          size_bytes?: number | null
          sync_error?: string | null
          sync_id?: string | null
          sync_status?: string | null
          thumbnail_link?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Update: {
          audio_bitrate?: number | null
          audio_channels?: number | null
          audio_duration_seconds?: number | null
          audio_extracted?: boolean | null
          audio_extraction_path?: string | null
          audio_quality_metrics?: Json | null
          content_extracted?: boolean | null
          created_at?: string | null
          deleted?: boolean | null
          document_type_id?: string | null
          drive_id?: string | null
          expert_id?: string | null
          extracted_content?: Json | null
          extraction_error?: string | null
          id?: string | null
          is_root?: boolean | null
          last_indexed?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_time?: string | null
          name?: string | null
          parent_folder_id?: string | null
          parent_id?: string | null
          parent_path?: string | null
          path?: string | null
          size?: number | null
          size_bytes?: number | null
          sync_error?: string | null
          sync_id?: string | null
          sync_status?: string | null
          thumbnail_link?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Relationships: []
      }
      speaker_profiles: {
        Row: {
          created_at: string | null
          expert_id: string | null
          id: string
          name: string | null
          updated_at: string | null
          voice_characteristics: Json | null
        }
        Insert: {
          created_at?: string | null
          expert_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
          voice_characteristics?: Json | null
        }
        Update: {
          created_at?: string | null
          expert_id?: string | null
          id?: string
          name?: string | null
          updated_at?: string | null
          voice_characteristics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "speaker_profiles_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
        ]
      }
      sql_query_history: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          execution_count: number | null
          execution_status: string | null
          id: string
          is_favorite: boolean | null
          last_executed_at: string | null
          query_name: string | null
          query_text: string
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          execution_status?: string | null
          id?: string
          is_favorite?: boolean | null
          last_executed_at?: string | null
          query_name?: string | null
          query_text: string
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          execution_status?: string | null
          id?: string
          is_favorite?: boolean | null
          last_executed_at?: string | null
          query_name?: string | null
          query_text?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      sql_query_tag_mappings: {
        Row: {
          query_id: string
          tag_id: string
        }
        Insert: {
          query_id: string
          tag_id: string
        }
        Update: {
          query_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sql_query_tag_mappings_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "sql_query_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sql_query_tag_mappings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "sql_query_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      sql_query_tags: {
        Row: {
          created_at: string
          id: string
          tag_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag_name: string
        }
        Update: {
          created_at?: string
          id?: string
          tag_name?: string
        }
        Relationships: []
      }
      sync_history: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          files_added: number | null
          files_error: number | null
          files_processed: number | null
          files_skipped: number | null
          files_total: number | null
          files_updated: number | null
          folder_id: string
          folder_name: string
          id: string
          status: string
          timestamp: string
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          files_added?: number | null
          files_error?: number | null
          files_processed?: number | null
          files_skipped?: number | null
          files_total?: number | null
          files_updated?: number | null
          folder_id: string
          folder_name?: string
          id?: string
          status?: string
          timestamp?: string
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          files_added?: number | null
          files_error?: number | null
          files_processed?: number | null
          files_skipped?: number | null
          files_total?: number | null
          files_updated?: number | null
          folder_id?: string
          folder_name?: string
          id?: string
          status?: string
          timestamp?: string
        }
        Relationships: []
      }
      sync_history_backup: {
        Row: {
          completed_at: string | null
          duration_ms: number | null
          error_message: string | null
          files_added: number | null
          files_error: number | null
          files_processed: number | null
          files_skipped: number | null
          files_total: number | null
          files_updated: number | null
          folder_id: string | null
          folder_name: string | null
          id: string | null
          status: string | null
          timestamp: string | null
        }
        Insert: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          files_added?: number | null
          files_error?: number | null
          files_processed?: number | null
          files_skipped?: number | null
          files_total?: number | null
          files_updated?: number | null
          folder_id?: string | null
          folder_name?: string | null
          id?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          completed_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          files_added?: number | null
          files_error?: number | null
          files_processed?: number | null
          files_skipped?: number | null
          files_total?: number | null
          files_updated?: number | null
          folder_id?: string | null
          folder_name?: string | null
          id?: string | null
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      sync_statistics: {
        Row: {
          created_at: string | null
          folder_id: string | null
          folder_name: string | null
          google_drive_count: number | null
          google_drive_documents: number | null
          google_drive_folders: number | null
          id: string
          local_files: number | null
          local_only_files: number | null
          matching_files: number | null
          mp4_files: number | null
          mp4_total_size: string | null
          new_files: number | null
          total_google_drive_items: number | null
        }
        Insert: {
          created_at?: string | null
          folder_id?: string | null
          folder_name?: string | null
          google_drive_count?: number | null
          google_drive_documents?: number | null
          google_drive_folders?: number | null
          id?: string
          local_files?: number | null
          local_only_files?: number | null
          matching_files?: number | null
          mp4_files?: number | null
          mp4_total_size?: string | null
          new_files?: number | null
          total_google_drive_items?: number | null
        }
        Update: {
          created_at?: string | null
          folder_id?: string | null
          folder_name?: string | null
          google_drive_count?: number | null
          google_drive_documents?: number | null
          google_drive_folders?: number | null
          id?: string
          local_files?: number | null
          local_only_files?: number | null
          matching_files?: number | null
          mp4_files?: number | null
          mp4_total_size?: string | null
          new_files?: number | null
          total_google_drive_items?: number | null
        }
        Relationships: []
      }
      temp_sources: {
        Row: {
          abstract: string | null
          aggregate_subject_classifications: string | null
          all_references_cnt: number | null
          article_type: string | null
          authors: string | null
          cleaned_authors: string | null
          concept_count: number | null
          created_at: string | null
          date_text: string | null
          day: number | null
          email_content_id: number | null
          email_id: number | null
          expert_id: number | null
          file_hash: string | null
          file_size: number | null
          folder_level: number | null
          has_processing_errors: number | null
          has_title_and_reference_info: number | null
          keywords: string | null
          last_modified: string | null
          month: number | null
          notes: string | null
          parent_id: number | null
          primary_authors: string | null
          processing_error: string | null
          ref_id: number | null
          reference_info: string | null
          reference_tag: string | null
          relationship_action_id: number | null
          source_id: number
          source_identifier: string | null
          source_type: string | null
          src_document_type_id: number | null
          subject_classifications: string | null
          summary: string | null
          title: string | null
          trust_level: number | null
          url_id: number | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          aggregate_subject_classifications?: string | null
          all_references_cnt?: number | null
          article_type?: string | null
          authors?: string | null
          cleaned_authors?: string | null
          concept_count?: number | null
          created_at?: string | null
          date_text?: string | null
          day?: number | null
          email_content_id?: number | null
          email_id?: number | null
          expert_id?: number | null
          file_hash?: string | null
          file_size?: number | null
          folder_level?: number | null
          has_processing_errors?: number | null
          has_title_and_reference_info?: number | null
          keywords?: string | null
          last_modified?: string | null
          month?: number | null
          notes?: string | null
          parent_id?: number | null
          primary_authors?: string | null
          processing_error?: string | null
          ref_id?: number | null
          reference_info?: string | null
          reference_tag?: string | null
          relationship_action_id?: number | null
          source_id: number
          source_identifier?: string | null
          source_type?: string | null
          src_document_type_id?: number | null
          subject_classifications?: string | null
          summary?: string | null
          title?: string | null
          trust_level?: number | null
          url_id?: number | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          aggregate_subject_classifications?: string | null
          all_references_cnt?: number | null
          article_type?: string | null
          authors?: string | null
          cleaned_authors?: string | null
          concept_count?: number | null
          created_at?: string | null
          date_text?: string | null
          day?: number | null
          email_content_id?: number | null
          email_id?: number | null
          expert_id?: number | null
          file_hash?: string | null
          file_size?: number | null
          folder_level?: number | null
          has_processing_errors?: number | null
          has_title_and_reference_info?: number | null
          keywords?: string | null
          last_modified?: string | null
          month?: number | null
          notes?: string | null
          parent_id?: number | null
          primary_authors?: string | null
          processing_error?: string | null
          ref_id?: number | null
          reference_info?: string | null
          reference_tag?: string | null
          relationship_action_id?: number | null
          source_id?: number
          source_identifier?: string | null
          source_type?: string | null
          src_document_type_id?: number | null
          subject_classifications?: string | null
          summary?: string | null
          title?: string | null
          trust_level?: number | null
          url_id?: number | null
          year?: number | null
        }
        Relationships: []
      }
      transcription_feedback: {
        Row: {
          corrected_text: string | null
          created_at: string | null
          id: string
          original_text: string | null
          segment_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          corrected_text?: string | null
          created_at?: string | null
          id?: string
          original_text?: string | null
          segment_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          corrected_text?: string | null
          created_at?: string | null
          id?: string
          original_text?: string | null
          segment_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transcription_feedback_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "audio_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_annotations: {
        Row: {
          asset_id: string | null
          content: string
          created_at: string | null
          id: string
          presentation_id: string | null
          timestamp: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          presentation_id?: string | null
          timestamp?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          asset_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          presentation_id?: string | null
          timestamp?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_annotations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "presentation_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_annotations_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      batch_processing_status: {
        Row: {
          batch_completed_at: string | null
          batch_created_at: string | null
          batch_id: string | null
          batch_started_at: string | null
          batch_status: string | null
          completed_count: number | null
          computed_status: string | null
          error_messages: string | null
          error_rate_percentage: number | null
          failed_count: number | null
          in_progress_count: number | null
          latest_error_at: string | null
          max_retries: number | null
          permanent_failures: number | null
          processing_hours: number | null
          queued_count: number | null
          top_error_types: Json | null
          total_documents: number | null
          total_files: number | null
        }
        Relationships: []
      }
      command_suggestions: {
        Row: {
          category_name: string | null
          last_used: string | null
          recommendation_strength: string | null
          sanitized_command: string | null
          success_rate: number | null
          usage_count: number | null
        }
        Relationships: []
      }
      page_guts_raw_data: {
        Row: {
          ai_prompts: Json | null
          app_name: string | null
          dependency_details: Json | null
          dependency_id: string | null
          dependency_name: string | null
          dependency_type: string | null
          function_id: string | null
          function_location: string | null
          function_name: string | null
          function_usage_id: string | null
          is_primary: boolean | null
          page_id: string | null
          page_name: string | null
          page_path: string | null
          refactor_candidate: boolean | null
          specificity: string | null
          table_name: string | null
          table_operations: string[] | null
          table_usage_id: string | null
          usage_type: string | null
          uses_react: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_unique_constraint: {
        Args: {
          p_table_name: string
          p_column_name: string
        }
        Returns: undefined
      }
      analyze_default_values: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          data_type: string
          current_default: string
          suggested_default: string
        }[]
      }
      analyze_foreign_keys: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          potential_reference_table: string
          potential_reference_column: string
          match_percentage: number
        }[]
      }
      analyze_table_constraints: {
        Args: {
          p_table_name: string
        }
        Returns: string
      }
      analyze_unique_constraints: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          distinct_ratio: number
          recommendation: string
        }[]
      }
      batch_track_usage: {
        Args: {
          p_page_id: string
          p_tables?: Json
          p_functions?: Json
          p_dependencies?: Json
        }
        Returns: boolean
      }
      check_user_id_foreign_keys: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          has_user_id: boolean
          has_proper_fk: boolean
          constraint_name: string
          deletion_rule: string
        }[]
      }
      execute_sql: {
        Args: {
          sql: string
        }
        Returns: Json
      }
      execute_sql_query: {
        Args: {
          query_text: string
          params?: Json
        }
        Returns: Json
      }
      export_all_functions_to_json: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      export_functions_audit: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      extract_filename: {
        Args: {
          file_path: string
        }
        Returns: string
      }
      find_and_sync_scripts: {
        Args: {
          existing_files_json: Json
        }
        Returns: Json
      }
      find_mp4_files_in_folder: {
        Args: {
          folder_id: string
        }
        Returns: {
          file_id: string
          file_name: string
          file_drive_id: string
          file_web_view_link: string
          parent_folder_name: string
          parent_folder_drive_id: string
        }[]
      }
      find_orphaned_user_ids: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          column_name: string
          orphaned_user_id: string
          row_count: number
        }[]
      }
      generate_table_documentation: {
        Args: {
          p_table_name: string
        }
        Returns: string
      }
      generate_unique_constraints_sql: {
        Args: {
          p_table_name: string
        }
        Returns: string
      }
      get_all_foreign_keys: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_all_table_definitions: {
        Args: Record<PropertyKey, never>
        Returns: {
          create_statement: string
        }[]
      }
      get_command_history: {
        Args: {
          category_filter?: string
          success_filter?: boolean
          search_term?: string
          page_size?: number
          page_number?: number
        }
        Returns: {
          id: string
          command_text: string
          sanitized_command: string
          category_name: string
          executed_at: string
          duration_ms: number
          exit_code: number
          success: boolean
          notes: string
          tags: string[]
        }[]
      }
      get_command_usage_by_category: {
        Args: {
          time_period?: unknown
        }
        Returns: {
          category_name: string
          usage_count: number
          success_rate: number
        }[]
      }
      get_document_type_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          mime_type: string
          count: number
        }[]
      }
      get_domain_id_by_name: {
        Args: {
          domain_name_input: string
        }
        Returns: string
      }
      get_dynamic_healing_domain_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_foreign_key_info: {
        Args: {
          p_constraint_name: string
        }
        Returns: {
          table_schema: string
          constraint_name: string
          table_name: string
          column_name: string
          foreign_table_schema: string
          foreign_table_name: string
          foreign_column_name: string
        }[]
      }
      get_foreign_keys: {
        Args: {
          schema_name: string
        }
        Returns: Json
      }
      get_function_details: {
        Args: {
          p_name: string
        }
        Returns: {
          function_details: Json
          relationships: Json
          history: Json
        }[]
      }
      get_functions: {
        Args: {
          schema_name: string
        }
        Returns: Json
      }
      get_most_used_commands: {
        Args: {
          time_period?: unknown
          limit_count?: number
        }
        Returns: {
          command_text: string
          category_name: string
          usage_count: number
          success_rate: number
        }[]
      }
      get_next_file_for_processing: {
        Args: Record<PropertyKey, never>
        Returns: {
          queue_id: string
          file_id: string
          file_path: string
        }[]
      }
      get_or_create_page: {
        Args: {
          p_page_path: string
          p_app_name: string
          p_page_name?: string
        }
        Returns: string
      }
      get_page_basic_info: {
        Args: {
          p_page_path: string
          p_app_name?: string
        }
        Returns: {
          page_id: string
          page_name: string
          page_path: string
          app_name: string
        }[]
      }
      get_page_dependencies: {
        Args: {
          p_page_id: string
        }
        Returns: {
          dependency_id: string
          dependency_type: string
          dependency_name: string
          details: Json
        }[]
      }
      get_page_functions: {
        Args: {
          p_page_id: string
        }
        Returns: {
          function_usage_id: string
          function_id: string
          function_name: string
          location: string
          uses_react: boolean
          ai_prompts: Json
          refactor_candidate: boolean
          specificity: string
          usage_type: string
        }[]
      }
      get_page_tables: {
        Args: {
          p_page_id: string
        }
        Returns: {
          table_usage_id: string
          table_name: string
          operations: string[]
          is_primary: boolean
        }[]
      }
      get_schema_info: {
        Args: {
          schema_name: string
        }
        Returns: Json
      }
      get_table_columns: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
        }[]
      }
      get_table_columns_plus: {
        Args: {
          p_table_name: string
        }
        Returns: {
          ordinal_position: number
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
          is_unique: string
          unique_constraint_name: string
          foreign_key: string
          trigger_name: string
          check_constraint: string
        }[]
      }
      get_table_columns_with_constraints_and_triggers: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
          is_unique: string
          foreign_key: string
          trigger_name: string
        }[]
      }
      get_table_columns_with_unique: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
          is_unique: string
        }[]
      }
      get_table_constraints: {
        Args: {
          p_table_name: string
        }
        Returns: Json
      }
      get_table_definition: {
        Args: {
          p_table_name: string
        }
        Returns: string[]
      }
      get_table_foreign_keys: {
        Args: {
          p_table_name: string
        }
        Returns: {
          table_schema: string
          constraint_name: string
          table_name: string
          column_name: string
          foreign_table_schema: string
          foreign_table_name: string
          foreign_column_name: string
        }[]
      }
      get_table_info: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          is_nullable: string
          data_type: string
          check_constraint: string
        }[]
      }
      get_table_metadata: {
        Args: {
          p_target_table: string
        }
        Returns: Json
      }
      get_triggers: {
        Args: {
          schema_name: string
        }
        Returns: Json
      }
      get_user_uuid_by_email: {
        Args: {
          email_input: string
        }
        Returns: string
      }
      increment_favorite_command_usage: {
        Args: {
          favorite_id: string
        }
        Returns: undefined
      }
      list_function_comments: {
        Args: Record<PropertyKey, never>
        Returns: {
          function_name: string
          comment_text: string
          schema_name: string
          return_type: string
          argument_types: string
        }[]
      }
      populate_sources_with_fixed_user_id: {
        Args: {
          user_email_address: string
        }
        Returns: undefined
      }
      queue_documentation_file_for_processing: {
        Args: {
          file_id: string
          priority?: number
        }
        Returns: string
      }
      refresh_schema_and_fix_metadata: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      register_document_relation: {
        Args: {
          p_source_id: string
          p_target_id: string
          p_relation_type: string
        }
        Returns: string
      }
      register_document_section: {
        Args: {
          p_file_id: string
          p_heading: string
          p_level: number
          p_position: number
          p_anchor_id: string
          p_summary?: string
        }
        Returns: string
      }
      register_markdown_file: {
        Args: {
          p_file_path: string
          p_title?: string
          p_file_hash?: string
          p_metadata?: Json
        }
        Returns: string
      }
      sanitize_command: {
        Args: {
          command_text: string
        }
        Returns: string
      }
      set_current_domain: {
        Args: {
          domain_id: string
        }
        Returns: undefined
      }
      table_exists: {
        Args: {
          p_schema_name: string
          p_table_name: string
        }
        Returns: boolean
      }
      update_document_ai_metadata: {
        Args: {
          p_file_id: string
          p_summary: string
          p_ai_generated_tags: string[]
        }
        Returns: undefined
      }
    }
    Enums: {
      ai_summary_status_type: "pending" | "processing" | "completed" | "error"
      asset_role_enum:
        | "main"
        | "supplementary"
        | "thumbnail"
        | "preview"
        | "background"
        | "reference"
        | "exhibit"
        | "source"
      asset_type_enum:
        | "video"
        | "audio"
        | "image"
        | "document"
        | "slide"
        | "transcript"
        | "presentation"
        | "chart"
        | "diagram"
      batch_type:
        | "google_extraction"
        | "audio_extraction"
        | "transcription"
        | "diarization"
        | "summarization"
      processing_stage:
        | "queued"
        | "downloading"
        | "extracting"
        | "processing"
        | "saving"
        | "completed"
        | "failed"
        | "retrying"
      processing_status:
        | "pending"
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "retrying"
      prompt_status: "draft" | "active" | "deprecated" | "archived"
      relationship_type:
        | "extends"
        | "references"
        | "prerequisite"
        | "alternative"
        | "successor"
      script_status:
        | "ACTIVE"
        | "UPDATE_NEEDED"
        | "OBSOLETE"
        | "DUPLICATE"
        | "UNUSED"
      script_type:
        | "UTILITY"
        | "DEPLOYMENT"
        | "DATABASE"
        | "BUILD"
        | "SETUP"
        | "OTHER"
      script_usage_status:
        | "DIRECTLY_REFERENCED"
        | "INDIRECTLY_REFERENCED"
        | "NOT_REFERENCED"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
