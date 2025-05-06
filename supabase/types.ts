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
      cli_command_tracking: {
        Row: {
          affected_entity: string | null
          command_name: string
          created_at: string
          duration_ms: number | null
          error_message: string | null
          execution_time: string
          id: string
          pipeline_name: string
          records_affected: number | null
          status: string
          summary: string | null
        }
        Insert: {
          affected_entity?: string | null
          command_name: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_time: string
          id?: string
          pipeline_name: string
          records_affected?: number | null
          status: string
          summary?: string | null
        }
        Update: {
          affected_entity?: string | null
          command_name?: string
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_time?: string
          id?: string
          pipeline_name?: string
          records_affected?: number | null
          status?: string
          summary?: string | null
        }
        Relationships: []
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
      document_concepts: {
        Row: {
          concept: string
          created_at: string | null
          document_id: string
          id: string
          metadata: Json | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          concept: string
          created_at?: string | null
          document_id: string
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          concept?: string
          created_at?: string | null
          document_id?: string
          id?: string
          metadata?: Json | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_concepts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
        ]
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
          category: string | null
          created_at: string | null
          description: string | null
          expected_json_schema: Json | null
          id: string
          is_ai_generated: boolean | null
          is_general_type: boolean | null
          name: string
          prompt_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          expected_json_schema?: Json | null
          id?: string
          is_ai_generated?: boolean | null
          is_general_type?: boolean | null
          name: string
          prompt_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          expected_json_schema?: Json | null
          id?: string
          is_ai_generated?: boolean | null
          is_general_type?: boolean | null
          name?: string
          prompt_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_types_backup_2025_05_02: {
        Row: {
          ai_processing_rules: Json | null
          category: string | null
          classifier: Database["public"]["Enums"]["document_classifier"] | null
          content_schema: Json | null
          created_at: string | null
          current_num_of_type: number | null
          description: string | null
          document_type: string | null
          document_type_counts: number | null
          file_extension: string | null
          id: string | null
          is_ai_generated: boolean | null
          legacy_document_type_id: number | null
          required_fields: Json | null
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          ai_processing_rules?: Json | null
          category?: string | null
          classifier?: Database["public"]["Enums"]["document_classifier"] | null
          content_schema?: Json | null
          created_at?: string | null
          current_num_of_type?: number | null
          description?: string | null
          document_type?: string | null
          document_type_counts?: number | null
          file_extension?: string | null
          id?: string | null
          is_ai_generated?: boolean | null
          legacy_document_type_id?: number | null
          required_fields?: Json | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          ai_processing_rules?: Json | null
          category?: string | null
          classifier?: Database["public"]["Enums"]["document_classifier"] | null
          content_schema?: Json | null
          created_at?: string | null
          current_num_of_type?: number | null
          description?: string | null
          document_type?: string | null
          document_type_counts?: number | null
          file_extension?: string | null
          id?: string | null
          is_ai_generated?: boolean | null
          legacy_document_type_id?: number | null
          required_fields?: Json | null
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: []
      }
      document_types_original: {
        Row: {
          ai_processing_rules: Json | null
          category: string
          classifier: Database["public"]["Enums"]["document_classifier"] | null
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
          required_fields: Json | null
          updated_at: string
          validation_rules: Json | null
        }
        Insert: {
          ai_processing_rules?: Json | null
          category: string
          classifier?: Database["public"]["Enums"]["document_classifier"] | null
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
          required_fields?: Json | null
          updated_at?: string
          validation_rules?: Json | null
        }
        Update: {
          ai_processing_rules?: Json | null
          category?: string
          classifier?: Database["public"]["Enums"]["document_classifier"] | null
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
            referencedRelation: "document_types_original"
            referencedColumns: ["id"]
          },
        ]
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
          ai_summary_status:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          classification_reasoning: string | null
          confidence_score: number | null
          content_type: string | null
          created_at: string
          diarization_complete: boolean | null
          document_processing_status:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at: string | null
          document_type_id: string | null
          id: string
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          last_processed_at: string | null
          processed_at: string | null
          processed_content: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_skip_reason: string | null
          processing_started_at: string | null
          processing_stats: Json | null
          processing_status: string | null
          processing_status_updated_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string
          status: string | null
          summary_complete: boolean | null
          title: string | null
          topics: string[] | null
          transcription_complete: boolean | null
          updated_at: string
          version: number | null
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          classification_reasoning?: string | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string
          diarization_complete?: boolean | null
          document_processing_status?:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          id?: string
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_processed_at?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id: string
          status?: string | null
          summary_complete?: boolean | null
          title?: string | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          classification_reasoning?: string | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string
          diarization_complete?: boolean | null
          document_processing_status?:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          id?: string
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_processed_at?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string
          status?: string | null
          summary_complete?: boolean | null
          title?: string | null
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
            referencedRelation: "processing_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types_original"
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
      expert_documents_backup_2025_05_02: {
        Row: {
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
          document_processing_status:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at: string | null
          document_type_id: string | null
          id: string | null
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          last_processed_at: string | null
          processed_at: string | null
          processed_content: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_skip_reason: string | null
          processing_started_at: string | null
          processing_stats: Json | null
          processing_status: string | null
          processing_status_updated_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string | null
          status: string | null
          summary_complete: boolean | null
          title: string | null
          topics: string[] | null
          transcription_complete: boolean | null
          updated_at: string | null
          version: number | null
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
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
          document_processing_status?:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_processed_at?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          summary_complete?: boolean | null
          title?: string | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
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
          document_processing_status?:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_processed_at?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          summary_complete?: boolean | null
          title?: string | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      expert_documents_backup_2025_05_05: {
        Row: {
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
          document_processing_status:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at: string | null
          document_type_id: string | null
          id: string | null
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          last_processed_at: string | null
          processed_at: string | null
          processed_content: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_skip_reason: string | null
          processing_started_at: string | null
          processing_stats: Json | null
          processing_status: string | null
          processing_status_updated_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string | null
          status: string | null
          summary_complete: boolean | null
          title: string | null
          topics: string[] | null
          transcription_complete: boolean | null
          updated_at: string | null
          version: number | null
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
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
          document_processing_status?:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_processed_at?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          summary_complete?: boolean | null
          title?: string | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
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
          document_processing_status?:
            | Database["public"]["Enums"]["document_processing_status"]
            | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_processed_at?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          processing_started_at?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          summary_complete?: boolean | null
          title?: string | null
          topics?: string[] | null
          transcription_complete?: boolean | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      expert_documents2: {
        Row: {
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          confidence_score: number | null
          content_type: string | null
          created_at: string | null
          document_processing_status_updated_at: string | null
          document_type_id: string | null
          extraction_metadata: Json | null
          id: string | null
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          processed_content: Json | null
          processing_history: Json | null
          processing_skip_reason: string | null
          processing_stats: Json | null
          processing_status: string | null
          processing_status_updated_at: string | null
          processing_status_v2:
            | Database["public"]["Enums"]["processing_status_v2"]
            | null
          processing_updated_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string | null
          title: string | null
          topics: string[] | null
          updated_at: string | null
          version: number | null
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          extraction_metadata?: Json | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          processed_content?: Json | null
          processing_history?: Json | null
          processing_skip_reason?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          processing_status_v2?:
            | Database["public"]["Enums"]["processing_status_v2"]
            | null
          processing_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          title?: string | null
          topics?: string[] | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string | null
          document_processing_status_updated_at?: string | null
          document_type_id?: string | null
          extraction_metadata?: Json | null
          id?: string | null
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          processed_content?: Json | null
          processing_history?: Json | null
          processing_skip_reason?: string | null
          processing_stats?: Json | null
          processing_status?: string | null
          processing_status_updated_at?: string | null
          processing_status_v2?:
            | Database["public"]["Enums"]["processing_status_v2"]
            | null
          processing_updated_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          title?: string | null
          topics?: string[] | null
          updated_at?: string | null
          version?: number | null
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      experts: {
        Row: {
          created_at: string
          expert_name: string
          full_name: string | null
          id: string
          is_in_core_group: boolean
          metadata: Json | null
          mnemonic: string | null
          starting_ref_id: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expert_name: string
          full_name?: string | null
          id?: string
          is_in_core_group?: boolean
          metadata?: Json | null
          mnemonic?: string | null
          starting_ref_id?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expert_name?: string
          full_name?: string | null
          id?: string
          is_in_core_group?: boolean
          metadata?: Json | null
          mnemonic?: string | null
          starting_ref_id?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      experts_backup_2025_05_02: {
        Row: {
          created_at: string | null
          expert_name: string | null
          full_name: string | null
          id: string | null
          is_in_core_group: boolean | null
          metadata: Json | null
          mnemonic: string | null
          starting_ref_id: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expert_name?: string | null
          full_name?: string | null
          id?: string | null
          is_in_core_group?: boolean | null
          metadata?: Json | null
          mnemonic?: string | null
          starting_ref_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expert_name?: string | null
          full_name?: string | null
          id?: string | null
          is_in_core_group?: boolean | null
          metadata?: Json | null
          mnemonic?: string | null
          starting_ref_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
            foreignKeyName: "function_relationships_target_function_id_fkey"
            columns: ["target_function_id"]
            isOneToOne: false
            referencedRelation: "function_registry"
            referencedColumns: ["id"]
          },
        ]
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
      mime_type_processing: {
        Row: {
          default_processing_steps: Json | null
          extraction_method: string | null
          id: string
          mime_type_id: string
          processing_priority: number | null
          requires_transcription: boolean | null
        }
        Insert: {
          default_processing_steps?: Json | null
          extraction_method?: string | null
          id?: string
          mime_type_id: string
          processing_priority?: number | null
          requires_transcription?: boolean | null
        }
        Update: {
          default_processing_steps?: Json | null
          extraction_method?: string | null
          id?: string
          mime_type_id?: string
          processing_priority?: number | null
          requires_transcription?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_mime_type_id"
            columns: ["mime_type_id"]
            isOneToOne: false
            referencedRelation: "mime_types"
            referencedColumns: ["id"]
          },
        ]
      }
      mime_types: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          extension: string | null
          icon: string | null
          id: string
          is_supported: boolean | null
          mime_type: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          extension?: string | null
          icon?: string | null
          id?: string
          is_supported?: boolean | null
          mime_type: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          extension?: string | null
          icon?: string | null
          id?: string
          is_supported?: boolean | null
          mime_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      presentation_assets: {
        Row: {
          asset_expert_document_id: string | null
          asset_role: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id: string | null
          asset_type: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at: string | null
          id: string
          importance_level: number | null
          metadata: Json | null
          presentation_id: string
          timestamp_end: number | null
          timestamp_start: number | null
          updated_at: string | null
          user_notes: string | null
        }
        Insert: {
          asset_expert_document_id?: string | null
          asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at?: string | null
          id?: string
          importance_level?: number | null
          metadata?: Json | null
          presentation_id: string
          timestamp_end?: number | null
          timestamp_start?: number | null
          updated_at?: string | null
          user_notes?: string | null
        }
        Update: {
          asset_expert_document_id?: string | null
          asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at?: string | null
          id?: string
          importance_level?: number | null
          metadata?: Json | null
          presentation_id?: string
          timestamp_end?: number | null
          timestamp_start?: number | null
          updated_at?: string | null
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_assets_asset_expert_document_id_fkey"
            columns: ["asset_expert_document_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_asset_source_id_fkey"
            columns: ["asset_source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_assets_backup_2025_05_02: {
        Row: {
          asset_expert_document_id: string | null
          asset_role: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id: string | null
          asset_type: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at: string | null
          id: string | null
          importance_level: number | null
          metadata: Json | null
          presentation_id: string | null
          timestamp_end: number | null
          timestamp_start: number | null
          updated_at: string | null
          user_notes: string | null
        }
        Insert: {
          asset_expert_document_id?: string | null
          asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at?: string | null
          id?: string | null
          importance_level?: number | null
          metadata?: Json | null
          presentation_id?: string | null
          timestamp_end?: number | null
          timestamp_start?: number | null
          updated_at?: string | null
          user_notes?: string | null
        }
        Update: {
          asset_expert_document_id?: string | null
          asset_role?: Database["public"]["Enums"]["asset_role_enum"] | null
          asset_source_id?: string | null
          asset_type?: Database["public"]["Enums"]["asset_type_enum"] | null
          created_at?: string | null
          id?: string | null
          importance_level?: number | null
          metadata?: Json | null
          presentation_id?: string | null
          timestamp_end?: number | null
          timestamp_start?: number | null
          updated_at?: string | null
          user_notes?: string | null
        }
        Relationships: []
      }
      presentations: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          expert_document_id: string | null
          high_level_folder_source_id: string | null
          id: string
          root_drive_id: string | null
          title: string | null
          updated_at: string | null
          video_source_id: string | null
          view_count: number | null
          web_view_link: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          expert_document_id?: string | null
          high_level_folder_source_id?: string | null
          id?: string
          root_drive_id?: string | null
          title?: string | null
          updated_at?: string | null
          video_source_id?: string | null
          view_count?: number | null
          web_view_link?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          expert_document_id?: string | null
          high_level_folder_source_id?: string | null
          id?: string
          root_drive_id?: string | null
          title?: string | null
          updated_at?: string | null
          video_source_id?: string | null
          view_count?: number | null
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentations_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentations_high_level_folder_source_id_fkey"
            columns: ["high_level_folder_source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentations_video_source_id_fkey"
            columns: ["video_source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      presentations_backup_2025_05_02: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          expert_document_id: string | null
          expert_id: string | null
          high_level_folder_source_id: string | null
          id: string | null
          root_drive_id: string | null
          title: string | null
          updated_at: string | null
          video_source_id: string | null
          view_count: number | null
          web_view_link: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          expert_document_id?: string | null
          expert_id?: string | null
          high_level_folder_source_id?: string | null
          id?: string | null
          root_drive_id?: string | null
          title?: string | null
          updated_at?: string | null
          video_source_id?: string | null
          view_count?: number | null
          web_view_link?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          expert_document_id?: string | null
          expert_id?: string | null
          high_level_folder_source_id?: string | null
          id?: string | null
          root_drive_id?: string | null
          title?: string | null
          updated_at?: string | null
          video_source_id?: string | null
          view_count?: number | null
          web_view_link?: string | null
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
            referencedRelation: "document_types_original"
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
            referencedRelation: "document_types_original"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts_backup_2025_05_02: {
        Row: {
          author: string | null
          category_id: string | null
          content: Json | null
          created_at: string | null
          description: string | null
          document_type_id: string | null
          file_path: string | null
          id: string | null
          metadata: Json | null
          name: string | null
          status: Database["public"]["Enums"]["prompt_status"] | null
          tags: string[] | null
          updated_at: string | null
          version: string | null
        }
        Insert: {
          author?: string | null
          category_id?: string | null
          content?: Json | null
          created_at?: string | null
          description?: string | null
          document_type_id?: string | null
          file_path?: string | null
          id?: string | null
          metadata?: Json | null
          name?: string | null
          status?: Database["public"]["Enums"]["prompt_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          author?: string | null
          category_id?: string | null
          content?: Json | null
          created_at?: string | null
          description?: string | null
          document_type_id?: string | null
          file_path?: string | null
          id?: string | null
          metadata?: Json | null
          name?: string | null
          status?: Database["public"]["Enums"]["prompt_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
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
            referencedRelation: "document_types_original"
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
          created_at: string | null
          document_type_id: string | null
          drive_id: string | null
          file_signature: string | null
          id: string
          is_deleted: boolean | null
          is_root: boolean | null
          last_indexed: string | null
          main_video_id: string | null
          metadata: Json | null
          mime_type: string | null
          modified_at: string | null
          name: string | null
          parent_folder_id: string | null
          path: string | null
          path_array: string[] | null
          path_depth: number | null
          root_drive_id: string | null
          size: number | null
          thumbnail_link: string | null
          updated_at: string | null
          web_view_link: string | null
        }
        Insert: {
          created_at?: string | null
          document_type_id?: string | null
          drive_id?: string | null
          file_signature?: string | null
          id: string
          is_deleted?: boolean | null
          is_root?: boolean | null
          last_indexed?: string | null
          main_video_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string | null
          parent_folder_id?: string | null
          path?: string | null
          path_array?: string[] | null
          path_depth?: number | null
          root_drive_id?: string | null
          size?: number | null
          thumbnail_link?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Update: {
          created_at?: string | null
          document_type_id?: string | null
          drive_id?: string | null
          file_signature?: string | null
          id?: string
          is_deleted?: boolean | null
          is_root?: boolean | null
          last_indexed?: string | null
          main_video_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string | null
          parent_folder_id?: string | null
          path?: string | null
          path_array?: string[] | null
          path_depth?: number | null
          root_drive_id?: string | null
          size?: number | null
          thumbnail_link?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Relationships: []
      }
      sources_google_backup_2025_04_08: {
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
          main_video_id: string | null
          metadata: Json | null
          mime_type: string | null
          modified_time: string | null
          name: string | null
          parent_folder_id: string | null
          parent_id: string | null
          parent_path: string | null
          path: string | null
          root_drive_id: string | null
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
          main_video_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_time?: string | null
          name?: string | null
          parent_folder_id?: string | null
          parent_id?: string | null
          parent_path?: string | null
          path?: string | null
          root_drive_id?: string | null
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
          main_video_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_time?: string | null
          name?: string | null
          parent_folder_id?: string | null
          parent_id?: string | null
          parent_path?: string | null
          path?: string | null
          root_drive_id?: string | null
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
      sources_google_backup_2025_05_02: {
        Row: {
          created_at: string | null
          document_type_id: string | null
          drive_id: string | null
          file_signature: string | null
          id: string | null
          is_deleted: boolean | null
          is_root: boolean | null
          last_indexed: string | null
          main_video_id: string | null
          metadata: Json | null
          mime_type: string | null
          modified_at: string | null
          name: string | null
          parent_folder_id: string | null
          path: string | null
          path_array: string[] | null
          path_depth: number | null
          root_drive_id: string | null
          size: number | null
          thumbnail_link: string | null
          updated_at: string | null
          web_view_link: string | null
        }
        Insert: {
          created_at?: string | null
          document_type_id?: string | null
          drive_id?: string | null
          file_signature?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_root?: boolean | null
          last_indexed?: string | null
          main_video_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string | null
          parent_folder_id?: string | null
          path?: string | null
          path_array?: string[] | null
          path_depth?: number | null
          root_drive_id?: string | null
          size?: number | null
          thumbnail_link?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Update: {
          created_at?: string | null
          document_type_id?: string | null
          drive_id?: string | null
          file_signature?: string | null
          id?: string | null
          is_deleted?: boolean | null
          is_root?: boolean | null
          last_indexed?: string | null
          main_video_id?: string | null
          metadata?: Json | null
          mime_type?: string | null
          modified_at?: string | null
          name?: string | null
          parent_folder_id?: string | null
          path?: string | null
          path_array?: string[] | null
          path_depth?: number | null
          root_drive_id?: string | null
          size?: number | null
          thumbnail_link?: string | null
          updated_at?: string | null
          web_view_link?: string | null
        }
        Relationships: []
      }
      sources_google_experts: {
        Row: {
          created_at: string | null
          expert_id: string
          id: string
          is_primary: boolean | null
          role_description: string | null
          source_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expert_id: string
          id?: string
          is_primary?: boolean | null
          role_description?: string | null
          source_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expert_id?: string
          id?: string
          is_primary?: boolean | null
          role_description?: string | null
          source_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_google_experts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "experts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_google_experts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["id"]
          },
        ]
      }
      sources_google_experts_backup_2025_05_02: {
        Row: {
          created_at: string | null
          expert_id: string | null
          id: string | null
          is_primary: boolean | null
          role_description: string | null
          source_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expert_id?: string | null
          id?: string | null
          is_primary?: boolean | null
          role_description?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expert_id?: string | null
          id?: string | null
          is_primary?: boolean | null
          role_description?: string | null
          source_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      subject_classifications: {
        Row: {
          associated_concepts: string | null
          created_at: string | null
          description: string | null
          id: string
          short_name: string | null
          subject: string
          subject_character: string | null
          updated_at: string | null
        }
        Insert: {
          associated_concepts?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          short_name?: string | null
          subject: string
          subject_character?: string | null
          updated_at?: string | null
        }
        Update: {
          associated_concepts?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          short_name?: string | null
          subject?: string
          subject_character?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subject_classifications_backup_2025_05_02: {
        Row: {
          associated_concepts: string | null
          created_at: string | null
          description: string | null
          id: string | null
          short_name: string | null
          subject: string | null
          subject_character: string | null
          updated_at: string | null
        }
        Insert: {
          associated_concepts?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          short_name?: string | null
          subject?: string | null
          subject_character?: string | null
          updated_at?: string | null
        }
        Update: {
          associated_concepts?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          short_name?: string | null
          subject?: string | null
          subject_character?: string | null
          updated_at?: string | null
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
      table_classifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["classified_entity_type"]
          id: string
          notes: string | null
          subject_classification_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["classified_entity_type"]
          id?: string
          notes?: string | null
          subject_classification_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["classified_entity_type"]
          id?: string
          notes?: string | null
          subject_classification_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_subject_classification"
            columns: ["subject_classification_id"]
            isOneToOne: false
            referencedRelation: "subject_classifications"
            referencedColumns: ["id"]
          },
        ]
      }
      table_classifications_backup_2025_05_02: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_id: string | null
          entity_type:
            | Database["public"]["Enums"]["classified_entity_type"]
            | null
          id: string | null
          notes: string | null
          subject_classification_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string | null
          entity_type?:
            | Database["public"]["Enums"]["classified_entity_type"]
            | null
          id?: string | null
          notes?: string | null
          subject_classification_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_id?: string | null
          entity_type?:
            | Database["public"]["Enums"]["classified_entity_type"]
            | null
          id?: string | null
          notes?: string | null
          subject_classification_id?: string | null
        }
        Relationships: []
      }
      user_filter_profile_drives: {
        Row: {
          id: string
          include_children: boolean | null
          profile_id: string | null
          root_drive_id: string
        }
        Insert: {
          id?: string
          include_children?: boolean | null
          profile_id?: string | null
          root_drive_id: string
        }
        Update: {
          id?: string
          include_children?: boolean | null
          profile_id?: string | null
          root_drive_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_filter_profile_drives_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_filter_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_filter_profiles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      view_backups: {
        Row: {
          definition: string | null
          schemaname: unknown | null
          viewname: unknown | null
        }
        Insert: {
          definition?: string | null
          schemaname?: unknown | null
          viewname?: unknown | null
        }
        Update: {
          definition?: string | null
          schemaname?: unknown | null
          viewname?: unknown | null
        }
        Relationships: []
      }
    }
    Views: {
      document_classifications_view: {
        Row: {
          document_type: string | null
          file_name: string | null
          processed_content: Json | null
          subject_classification: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_unique_constraint: {
        Args: { p_table_name: string; p_column_name: string }
        Returns: undefined
      }
      analyze_default_values: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
          current_default: string
          suggested_default: string
        }[]
      }
      analyze_foreign_keys: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          potential_reference_table: string
          potential_reference_column: string
          match_percentage: number
        }[]
      }
      analyze_table_constraints: {
        Args: { p_table_name: string }
        Returns: string
      }
      analyze_unique_constraints: {
        Args: { p_table_name: string }
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
        Args: { sql: string }
        Returns: Json
      }
      execute_sql_query: {
        Args: { query_text: string; params?: Json }
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
        Args: { file_path: string }
        Returns: string
      }
      find_and_sync_scripts: {
        Args: { existing_files_json: Json }
        Returns: Json
      }
      find_mp4_files_in_folder: {
        Args: { folder_id: string }
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
        Args: { p_table_name: string }
        Returns: string
      }
      generate_unique_constraints_sql: {
        Args: { p_table_name: string }
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
      get_cli_command_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          pipeline_name: string
          command_name: string
          total_executions: number
          successful_executions: number
          failed_executions: number
          running_executions: number
          avg_duration_ms: number
          last_execution: string
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
      get_command_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          pipeline_name: string
          command_name: string
          total_executions: number
          successful_executions: number
          failed_executions: number
          running_executions: number
          avg_duration_ms: number
          last_execution: string
        }[]
      }
      get_command_usage_by_category: {
        Args: { time_period?: unknown }
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
        Args: { domain_name_input: string }
        Returns: string
      }
      get_dynamic_healing_domain_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_foreign_key_info: {
        Args: { p_constraint_name: string }
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
        Args: { schema_name: string }
        Returns: Json
      }
      get_function_details: {
        Args: { p_name: string }
        Returns: {
          function_details: Json
          relationships: Json
          history: Json
        }[]
      }
      get_functions: {
        Args: { schema_name: string }
        Returns: Json
      }
      get_most_used_commands: {
        Args: { time_period?: unknown; limit_count?: number }
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
        Args: { p_page_path: string; p_app_name: string; p_page_name?: string }
        Returns: string
      }
      get_page_basic_info: {
        Args: { p_page_path: string; p_app_name?: string }
        Returns: {
          page_id: string
          page_name: string
          page_path: string
          app_name: string
        }[]
      }
      get_page_dependencies: {
        Args: { p_page_id: string }
        Returns: {
          dependency_id: string
          dependency_type: string
          dependency_name: string
          details: Json
        }[]
      }
      get_page_functions: {
        Args: { p_page_id: string }
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
        Args: { p_page_id: string }
        Returns: {
          table_usage_id: string
          table_name: string
          operations: string[]
          is_primary: boolean
        }[]
      }
      get_schema_info: {
        Args: { schema_name: string }
        Returns: Json
      }
      get_table_columns: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
        }[]
      }
      get_table_columns_plus: {
        Args: { p_table_name: string }
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
        Args: { p_table_name: string }
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
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
          column_default: string
          is_unique: string
        }[]
      }
      get_table_constraints: {
        Args: { p_table_name: string }
        Returns: Json
      }
      get_table_definition: {
        Args: { p_table_name: string }
        Returns: string[]
      }
      get_table_foreign_keys: {
        Args: { p_table_name: string }
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
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          is_nullable: string
          data_type: string
          check_constraint: string
        }[]
      }
      get_table_metadata: {
        Args: { p_target_table: string }
        Returns: Json
      }
      get_triggers: {
        Args: { schema_name: string }
        Returns: Json
      }
      get_user_uuid_by_email: {
        Args: { email_input: string }
        Returns: string
      }
      increment_favorite_command_usage: {
        Args: { favorite_id: string }
        Returns: undefined
      }
      increment_presentation_view_count: {
        Args: { presentation_uuid: string }
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
        Args: { user_email_address: string }
        Returns: undefined
      }
      queue_documentation_file_for_processing: {
        Args: { file_id: string; priority?: number }
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
        Args: { command_text: string }
        Returns: string
      }
      set_current_domain: {
        Args: { domain_id: string }
        Returns: undefined
      }
      table_exists: {
        Args: { p_schema_name: string; p_table_name: string }
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
      classified_entity_type:
        | "expert_documents"
        | "documentation_files"
        | "sources_google"
        | "scripts"
      document_classifier: "pdf" | "powerpoint" | "docx" | "expert"
      document_processing_status:
        | "needs_reprocessing"
        | "reprocessing_done"
        | "skip_processing"
        | "not_set"
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
      processing_status_v2:
        | "unprocessed"
        | "needs_audio_extraction"
        | "needs_text_extraction"
        | "extraction_in_progress"
        | "extraction_failed"
        | "needs_transcription"
        | "transcription_in_progress"
        | "transcription_failed"
        | "needs_classification"
        | "classification_in_progress"
        | "classification_failed"
        | "processed"
        | "skip_processing"
        | "needs_manual_review"
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_summary_status_type: ["pending", "processing", "completed", "error"],
      asset_role_enum: [
        "main",
        "supplementary",
        "thumbnail",
        "preview",
        "background",
        "reference",
        "exhibit",
        "source",
      ],
      asset_type_enum: [
        "video",
        "audio",
        "image",
        "document",
        "slide",
        "transcript",
        "presentation",
        "chart",
        "diagram",
      ],
      batch_type: [
        "google_extraction",
        "audio_extraction",
        "transcription",
        "diarization",
        "summarization",
      ],
      classified_entity_type: [
        "expert_documents",
        "documentation_files",
        "sources_google",
        "scripts",
      ],
      document_classifier: ["pdf", "powerpoint", "docx", "expert"],
      document_processing_status: [
        "needs_reprocessing",
        "reprocessing_done",
        "skip_processing",
        "not_set",
      ],
      processing_stage: [
        "queued",
        "downloading",
        "extracting",
        "processing",
        "saving",
        "completed",
        "failed",
        "retrying",
      ],
      processing_status: [
        "pending",
        "queued",
        "processing",
        "completed",
        "failed",
        "retrying",
      ],
      processing_status_v2: [
        "unprocessed",
        "needs_audio_extraction",
        "needs_text_extraction",
        "extraction_in_progress",
        "extraction_failed",
        "needs_transcription",
        "transcription_in_progress",
        "transcription_failed",
        "needs_classification",
        "classification_in_progress",
        "classification_failed",
        "processed",
        "skip_processing",
        "needs_manual_review",
      ],
      prompt_status: ["draft", "active", "deprecated", "archived"],
      relationship_type: [
        "extends",
        "references",
        "prerequisite",
        "alternative",
        "successor",
      ],
      script_status: [
        "ACTIVE",
        "UPDATE_NEEDED",
        "OBSOLETE",
        "DUPLICATE",
        "UNUSED",
      ],
      script_type: [
        "UTILITY",
        "DEPLOYMENT",
        "DATABASE",
        "BUILD",
        "SETUP",
        "OTHER",
      ],
      script_usage_status: [
        "DIRECTLY_REFERENCED",
        "INDIRECTLY_REFERENCED",
        "NOT_REFERENCED",
      ],
    },
  },
} as const
