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
      backup_uni_document_types_20250213011132_bak: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          current_num_of_type: number | null
          description: string | null
          document_type: string | null
          document_type_counts: number | null
          domain_id: string | null
          file_extension: string | null
          id: string | null
          is_ai_generated: boolean | null
          legacy_document_type_id: number | null
          mime_type: string | null
          required_fields: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_num_of_type?: number | null
          description?: string | null
          document_type?: string | null
          document_type_counts?: number | null
          domain_id?: string | null
          file_extension?: string | null
          id?: string | null
          is_ai_generated?: boolean | null
          legacy_document_type_id?: number | null
          mime_type?: string | null
          required_fields?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          current_num_of_type?: number | null
          description?: string | null
          document_type?: string | null
          document_type_counts?: number | null
          domain_id?: string | null
          file_extension?: string | null
          id?: string | null
          is_ai_generated?: boolean | null
          legacy_document_type_id?: number | null
          mime_type?: string | null
          required_fields?: Json | null
          updated_at?: string | null
          updated_by?: string | null
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
          created_by: string
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
          updated_by: string
          validation_rules: Json | null
        }
        Insert: {
          ai_processing_rules?: Json | null
          category: string
          content_schema?: Json | null
          created_at?: string
          created_by: string
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
          updated_by: string
          validation_rules?: Json | null
        }
        Update: {
          ai_processing_rules?: Json | null
          category?: string
          content_schema?: Json | null
          created_at?: string
          created_by?: string
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
          updated_by?: string
          validation_rules?: Json | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      email_addresses: {
        Row: {
          created_at: string
          created_by: string
          domain_id: string
          email_address: string
          id: string
          is_important: boolean
          is_primary: boolean | null
          last_used_at: string | null
          updated_at: string
          updated_by: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          domain_id?: string
          email_address: string
          id?: string
          is_important?: boolean
          is_primary?: boolean | null
          last_used_at?: string | null
          updated_at?: string
          updated_by?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          domain_id?: string
          email_address?: string
          id?: string
          is_important?: boolean
          is_primary?: boolean | null
          last_used_at?: string | null
          updated_at?: string
          updated_by?: string
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
          created_by: string
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
          updated_by: string
          url_cnt: number | null
        }
        Insert: {
          attachment_cnt?: number | null
          content?: string | null
          contents_length?: number | null
          created_at?: string | null
          created_by?: string
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
          updated_by?: string
          url_cnt?: number | null
        }
        Update: {
          attachment_cnt?: number | null
          content?: string | null
          contents_length?: number | null
          created_at?: string | null
          created_by?: string
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
          updated_by?: string
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
          batch_id: string | null
          classification_confidence: number | null
          classification_metadata: Json | null
          confidence_score: number | null
          content_type: string | null
          created_at: string
          created_by: string | null
          document_type_id: string | null
          error_message: string | null
          expert_id: string | null
          id: string
          is_latest: boolean | null
          key_insights: string[] | null
          language: string | null
          last_error_at: string | null
          last_processed_at: string | null
          previous_version_id: string | null
          processed_at: string | null
          processed_content: Json | null
          processing_completed_at: string | null
          processing_error: string | null
          processing_started_at: string | null
          processing_status: string | null
          queued_at: string | null
          raw_content: string | null
          retry_count: number | null
          source_id: string | null
          status: string | null
          topics: string[] | null
          updated_at: string
          updated_by: string | null
          version: number | null
          word_count: number | null
        }
        Insert: {
          ai_analysis?: Json | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          document_type_id?: string | null
          error_message?: string | null
          expert_id?: string | null
          id?: string
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_error_at?: string | null
          last_processed_at?: string | null
          previous_version_id?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string | null
          queued_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
          word_count?: number | null
        }
        Update: {
          ai_analysis?: Json | null
          batch_id?: string | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          confidence_score?: number | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          document_type_id?: string | null
          error_message?: string | null
          expert_id?: string | null
          id?: string
          is_latest?: boolean | null
          key_insights?: string[] | null
          language?: string | null
          last_error_at?: string | null
          last_processed_at?: string | null
          previous_version_id?: string | null
          processed_at?: string | null
          processed_content?: Json | null
          processing_completed_at?: string | null
          processing_error?: string | null
          processing_started_at?: string | null
          processing_status?: string | null
          queued_at?: string | null
          raw_content?: string | null
          retry_count?: number | null
          source_id?: string | null
          status?: string | null
          topics?: string[] | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
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
      experts: {
        Row: {
          bio: string | null
          created_at: string
          created_by: string
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
          updated_by: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          created_by?: string
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
          updated_by?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          created_by?: string
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
          updated_by?: string
          user_id?: string | null
        }
        Relationships: []
      }
      function_registry: {
        Row: {
          app_name: string | null
          category: string
          code_signature: string | null
          created_at: string | null
          dependencies: string[] | null
          description: string
          git_branch: string | null
          git_commit_hash: string | null
          id: string
          implementation_notes: string | null
          input_types: Json | null
          last_modified_by: string | null
          location: string
          name: string
          output_types: Json | null
          repository: string
          shared_package_status: boolean | null
          similar_functions: Json | null
          status: string | null
          supabase_operations: Json | null
          target_package: string | null
          updated_at: string | null
          used_in: string[] | null
        }
        Insert: {
          app_name?: string | null
          category: string
          code_signature?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          description: string
          git_branch?: string | null
          git_commit_hash?: string | null
          id?: string
          implementation_notes?: string | null
          input_types?: Json | null
          last_modified_by?: string | null
          location: string
          name: string
          output_types?: Json | null
          repository: string
          shared_package_status?: boolean | null
          similar_functions?: Json | null
          status?: string | null
          supabase_operations?: Json | null
          target_package?: string | null
          updated_at?: string | null
          used_in?: string[] | null
        }
        Update: {
          app_name?: string | null
          category?: string
          code_signature?: string | null
          created_at?: string | null
          dependencies?: string[] | null
          description?: string
          git_branch?: string | null
          git_commit_hash?: string | null
          id?: string
          implementation_notes?: string | null
          input_types?: Json | null
          last_modified_by?: string | null
          location?: string
          name?: string
          output_types?: Json | null
          repository?: string
          shared_package_status?: boolean | null
          similar_functions?: Json | null
          status?: string | null
          supabase_operations?: Json | null
          target_package?: string | null
          updated_at?: string | null
          used_in?: string[] | null
        }
        Relationships: []
      }
      function_registry_history: {
        Row: {
          change_type: string | null
          changed_at: string | null
          changed_by: string | null
          function_id: string | null
          git_commit_hash: string | null
          id: string
          new_state: Json | null
          previous_state: Json | null
        }
        Insert: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          function_id?: string | null
          git_commit_hash?: string | null
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Update: {
          change_type?: string | null
          changed_at?: string | null
          changed_by?: string | null
          function_id?: string | null
          git_commit_hash?: string | null
          id?: string
          new_state?: Json | null
          previous_state?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "function_registry_history_function_id_fkey"
            columns: ["function_id"]
            isOneToOne: false
            referencedRelation: "function_registry"
            referencedColumns: ["id"]
          },
        ]
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
          created_by: string | null
          email_address: string | null
          email_count: number | null
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email_address?: string | null
          email_count?: number | null
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email_address?: string | null
          email_count?: number | null
          id?: string
        }
        Relationships: []
      }
      pdf_analyses: {
        Row: {
          content: string | null
          created_at: string | null
          file_path: string
          id: string
          improvements: string[] | null
          sections: Json | null
          strengths: string[] | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          file_path: string
          id?: string
          improvements?: string[] | null
          sections?: Json | null
          strengths?: string[] | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          file_path?: string
          id?: string
          improvements?: string[] | null
          sections?: Json | null
          strengths?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      presentations: {
        Row: {
          created_at: string | null
          duration: unknown | null
          filename: string
          folder_path: string
          id: string
          metadata: Json | null
          title: string | null
          transcript: string | null
          transcript_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: unknown | null
          filename: string
          folder_path: string
          id?: string
          metadata?: Json | null
          title?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: unknown | null
          filename?: string
          folder_path?: string
          id?: string
          metadata?: Json | null
          title?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      processing_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          processed_files: number | null
          status: string
          total_files: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_files?: number | null
          status: string
          total_files: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          processed_files?: number | null
          status?: string
          total_files?: number
          updated_at?: string
        }
        Relationships: []
      }
      processing_costs: {
        Row: {
          cost_usd: number | null
          duration_minutes: number | null
          id: string
          processed_at: string | null
          service: string | null
        }
        Insert: {
          cost_usd?: number | null
          duration_minutes?: number | null
          id?: string
          processed_at?: string | null
          service?: string | null
        }
        Update: {
          cost_usd?: number | null
          duration_minutes?: number | null
          id?: string
          processed_at?: string | null
          service?: string | null
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
      repository_metadata: {
        Row: {
          analysis_status: string | null
          apps: string[] | null
          created_at: string | null
          id: string
          last_analyzed: string | null
          repository: string
          repository_type: string | null
          shared_packages: string[] | null
          total_functions: number | null
          updated_at: string | null
        }
        Insert: {
          analysis_status?: string | null
          apps?: string[] | null
          created_at?: string | null
          id?: string
          last_analyzed?: string | null
          repository: string
          repository_type?: string | null
          shared_packages?: string[] | null
          total_functions?: number | null
          updated_at?: string | null
        }
        Update: {
          analysis_status?: string | null
          apps?: string[] | null
          created_at?: string | null
          id?: string
          last_analyzed?: string | null
          repository?: string
          repository_type?: string | null
          shared_packages?: string[] | null
          total_functions?: number | null
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
          created_by: string | null
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
          updated_by: string | null
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
          created_by?: string | null
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
          updated_by?: string | null
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
          created_by?: string | null
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
          updated_by?: string | null
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
          content_extracted: boolean | null
          created_at: string
          created_by: string | null
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
          name: string
          parent_folder_id: string | null
          parent_path: string | null
          path: string | null
          presentation_id: string | null
          sync_error: string | null
          sync_status: string | null
          updated_at: string
          updated_by: string | null
          web_view_link: string | null
        }
        Insert: {
          content_extracted?: boolean | null
          created_at?: string
          created_by?: string | null
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
          name: string
          parent_folder_id?: string | null
          parent_path?: string | null
          path?: string | null
          presentation_id?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          updated_by?: string | null
          web_view_link?: string | null
        }
        Update: {
          content_extracted?: boolean | null
          created_at?: string
          created_by?: string | null
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
          name?: string
          parent_folder_id?: string | null
          parent_path?: string | null
          path?: string | null
          presentation_id?: string | null
          sync_error?: string | null
          sync_status?: string | null
          updated_at?: string
          updated_by?: string | null
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
          {
            foreignKeyName: "sources_google_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["drive_id"]
          },
          {
            foreignKeyName: "sources_google_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
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
      video_summaries: {
        Row: {
          created_at: string | null
          error: string | null
          id: string
          source_id: string | null
          status: string | null
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          id?: string
          source_id?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          id?: string
          source_id?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_summaries_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources_google"
            referencedColumns: ["drive_id"]
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
      drop_unique_constraint_created_by: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      evaluate_table_constraints: {
        Args: {
          table_name: string
        }
        Returns: undefined
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
      get_all_table_definitions: {
        Args: Record<PropertyKey, never>
        Returns: {
          create_statement: string
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
      get_user_uuid_by_email: {
        Args: {
          email_input: string
        }
        Returns: string
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
      set_current_domain: {
        Args: {
          domain_id: string
        }
        Returns: undefined
      }
      transfer_temp_experts_to_experts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      processing_status:
        | "pending"
        | "queued"
        | "processing"
        | "completed"
        | "failed"
        | "retrying"
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
