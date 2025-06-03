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
      ai_prompt_categories: {
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
            referencedRelation: "ai_prompt_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_output_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          template: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          template: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          template?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_prompt_relationships: {
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
            referencedRelation: "document_classifications_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_prompt_relationships_document_type"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_relationships_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_template_associations_view"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "prompt_relationships_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_template_associations: {
        Row: {
          created_at: string | null
          id: string
          priority: number
          prompt_id: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          priority?: number
          prompt_id: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          priority?: number
          prompt_id?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_prompt_template_associations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_template_associations_view"
            referencedColumns: ["prompt_id"]
          },
          {
            foreignKeyName: "ai_prompt_template_associations_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "ai_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_template_associations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_output_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_prompt_template_associations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_prompt_template_associations_view"
            referencedColumns: ["template_id"]
          },
        ]
      }
      ai_prompts: {
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
            referencedRelation: "ai_prompt_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_classifications_view"
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
      ai_work_summaries: {
        Row: {
          category: string | null
          commands: string[] | null
          created_at: string | null
          files_modified: string[] | null
          id: string
          metadata: Json | null
          status: string | null
          summary_content: string
          tags: string[] | null
          title: string
          ui_components: string[] | null
          updated_at: string | null
          work_date: string
        }
        Insert: {
          category?: string | null
          commands?: string[] | null
          created_at?: string | null
          files_modified?: string[] | null
          id?: string
          metadata?: Json | null
          status?: string | null
          summary_content: string
          tags?: string[] | null
          title: string
          ui_components?: string[] | null
          updated_at?: string | null
          work_date?: string
        }
        Update: {
          category?: string | null
          commands?: string[] | null
          created_at?: string | null
          files_modified?: string[] | null
          id?: string
          metadata?: Json | null
          status?: string | null
          summary_content?: string
          tags?: string[] | null
          title?: string
          ui_components?: string[] | null
          updated_at?: string | null
          work_date?: string
        }
        Relationships: []
      }
      auth_allowed_emails: {
        Row: {
          added_at: string | null
          added_by: string | null
          auth_status: string | null
          auth_user_id: string | null
          created_at: string | null
          email: string
          email_verified: boolean | null
          email_verified_at: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          login_count: number | null
          metadata: Json | null
          name: string | null
          notes: string | null
          organization: string | null
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          auth_status?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          email_verified_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          login_count?: number | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          organization?: string | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          auth_status?: string | null
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          email_verified_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          login_count?: number | null
          metadata?: Json | null
          name?: string | null
          notes?: string | null
          organization?: string | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      auth_audit_log: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_cli_tokens: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          last_used: string | null
          name: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_used?: string | null
          name: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          last_used?: string | null
          name?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      auth_user_profiles: {
        Row: {
          avoided_topics: string[] | null
          bio_summary: string | null
          content_tags_following: string[] | null
          created_at: string | null
          credentials: string[] | null
          current_challenges: string | null
          id: string
          industry_sectors: string[] | null
          intended_application: string | null
          interested_experts: string[] | null
          interested_topics: string[] | null
          last_activity: string | null
          learning_background: string | null
          learning_goals: string[] | null
          learning_pace: string | null
          onboarding_completed: boolean | null
          preferred_depth: string | null
          preferred_formats: string[] | null
          preferred_session_length: number | null
          priority_subjects: string[] | null
          profession: string | null
          professional_title: string | null
          profile_completeness: number | null
          reason_for_learning: string | null
          referral_source: string | null
          specialty_areas: string[] | null
          time_commitment: string | null
          updated_at: string | null
          years_experience: number | null
        }
        Insert: {
          avoided_topics?: string[] | null
          bio_summary?: string | null
          content_tags_following?: string[] | null
          created_at?: string | null
          credentials?: string[] | null
          current_challenges?: string | null
          id: string
          industry_sectors?: string[] | null
          intended_application?: string | null
          interested_experts?: string[] | null
          interested_topics?: string[] | null
          last_activity?: string | null
          learning_background?: string | null
          learning_goals?: string[] | null
          learning_pace?: string | null
          onboarding_completed?: boolean | null
          preferred_depth?: string | null
          preferred_formats?: string[] | null
          preferred_session_length?: number | null
          priority_subjects?: string[] | null
          profession?: string | null
          professional_title?: string | null
          profile_completeness?: number | null
          reason_for_learning?: string | null
          referral_source?: string | null
          specialty_areas?: string[] | null
          time_commitment?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Update: {
          avoided_topics?: string[] | null
          bio_summary?: string | null
          content_tags_following?: string[] | null
          created_at?: string | null
          credentials?: string[] | null
          current_challenges?: string | null
          id?: string
          industry_sectors?: string[] | null
          intended_application?: string | null
          interested_experts?: string[] | null
          interested_topics?: string[] | null
          last_activity?: string | null
          learning_background?: string | null
          learning_goals?: string[] | null
          learning_pace?: string | null
          onboarding_completed?: boolean | null
          preferred_depth?: string | null
          preferred_formats?: string[] | null
          preferred_session_length?: number | null
          priority_subjects?: string[] | null
          profession?: string | null
          professional_title?: string | null
          profile_completeness?: number | null
          reason_for_learning?: string | null
          referral_source?: string | null
          specialty_areas?: string[] | null
          time_commitment?: string | null
          updated_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_v2_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_processing: {
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
      command_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      command_definitions: {
        Row: {
          command_name: string
          created_at: string | null
          deprecated_at: string | null
          description: string | null
          display_order: number | null
          example_usage: string | null
          id: string
          is_dangerous: boolean | null
          is_hidden: boolean | null
          last_verified_at: string | null
          pipeline_id: string
          requires_auth: boolean | null
          requires_google_api: boolean | null
          status: string | null
          updated_at: string | null
          usage_pattern: string | null
        }
        Insert: {
          command_name: string
          created_at?: string | null
          deprecated_at?: string | null
          description?: string | null
          display_order?: number | null
          example_usage?: string | null
          id?: string
          is_dangerous?: boolean | null
          is_hidden?: boolean | null
          last_verified_at?: string | null
          pipeline_id: string
          requires_auth?: boolean | null
          requires_google_api?: boolean | null
          status?: string | null
          updated_at?: string | null
          usage_pattern?: string | null
        }
        Update: {
          command_name?: string
          created_at?: string | null
          deprecated_at?: string | null
          description?: string | null
          display_order?: number | null
          example_usage?: string | null
          id?: string
          is_dangerous?: boolean | null
          is_hidden?: boolean | null
          last_verified_at?: string | null
          pipeline_id?: string
          requires_auth?: boolean | null
          requires_google_api?: boolean | null
          status?: string | null
          updated_at?: string | null
          usage_pattern?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "command_definitions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "command_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      command_dependencies: {
        Row: {
          command_id: string
          created_at: string | null
          dependency_name: string
          dependency_type: string
          description: string | null
          id: string
          is_required: boolean | null
        }
        Insert: {
          command_id: string
          created_at?: string | null
          dependency_name: string
          dependency_type: string
          description?: string | null
          id?: string
          is_required?: boolean | null
        }
        Update: {
          command_id?: string
          created_at?: string | null
          dependency_name?: string
          dependency_type?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "command_dependencies_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "command_definitions"
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
      command_pipeline_tables: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          operation_type: string | null
          pipeline_id: string
          table_name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          operation_type?: string | null
          pipeline_id: string
          table_name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          operation_type?: string | null
          pipeline_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_pipeline_tables_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "command_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      command_pipelines: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          display_name: string
          guidance: string | null
          id: string
          last_scanned_at: string | null
          name: string
          script_path: string
          status: string | null
          updated_at: string | null
          usage_example: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          guidance?: string | null
          id?: string
          last_scanned_at?: string | null
          name: string
          script_path: string
          status?: string | null
          updated_at?: string | null
          usage_example?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          guidance?: string | null
          id?: string
          last_scanned_at?: string | null
          name?: string
          script_path?: string
          status?: string | null
          updated_at?: string | null
          usage_example?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "command_pipelines_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "command_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      command_refactor_tracking: {
        Row: {
          command_name: string
          command_type: string
          created_at: string | null
          current_status: string
          description: string | null
          id: string
          issues_found: string | null
          new_implementation_path: string | null
          notes: string | null
          old_implementation_path: string | null
          options: Json | null
          pipeline: string | null
          signed_off_at: string | null
          signed_off_by: string | null
          test_criteria: string[] | null
          test_results: string | null
          updated_at: string | null
        }
        Insert: {
          command_name: string
          command_type: string
          created_at?: string | null
          current_status?: string
          description?: string | null
          id?: string
          issues_found?: string | null
          new_implementation_path?: string | null
          notes?: string | null
          old_implementation_path?: string | null
          options?: Json | null
          pipeline?: string | null
          signed_off_at?: string | null
          signed_off_by?: string | null
          test_criteria?: string[] | null
          test_results?: string | null
          updated_at?: string | null
        }
        Update: {
          command_name?: string
          command_type?: string
          created_at?: string | null
          current_status?: string
          description?: string | null
          id?: string
          issues_found?: string | null
          new_implementation_path?: string | null
          notes?: string | null
          old_implementation_path?: string | null
          options?: Json | null
          pipeline?: string | null
          signed_off_at?: string | null
          signed_off_by?: string | null
          test_criteria?: string[] | null
          test_results?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      command_tracking: {
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
      dev_merge_checklist: {
        Row: {
          check_type: string
          created_at: string | null
          executed_at: string | null
          id: string
          merge_queue_id: string | null
          result: Json | null
          status: string | null
        }
        Insert: {
          check_type: string
          created_at?: string | null
          executed_at?: string | null
          id?: string
          merge_queue_id?: string | null
          result?: Json | null
          status?: string | null
        }
        Update: {
          check_type?: string
          created_at?: string | null
          executed_at?: string | null
          id?: string
          merge_queue_id?: string | null
          result?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_merge_checklist_merge_queue_id_fkey"
            columns: ["merge_queue_id"]
            isOneToOne: false
            referencedRelation: "dev_merge_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_merge_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: string | null
          depends_on_branch: string
          id: string
          merge_queue_id: string | null
        }
        Insert: {
          created_at?: string | null
          dependency_type?: string | null
          depends_on_branch: string
          id?: string
          merge_queue_id?: string | null
        }
        Update: {
          created_at?: string | null
          dependency_type?: string | null
          depends_on_branch?: string
          id?: string
          merge_queue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_merge_dependencies_merge_queue_id_fkey"
            columns: ["merge_queue_id"]
            isOneToOne: false
            referencedRelation: "dev_merge_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_merge_queue: {
        Row: {
          branch_name: string
          conflict_details: Json | null
          conflicts_detected: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          last_updated_from_source: string | null
          merge_commit_sha: string | null
          merge_completed_at: string | null
          merge_started_at: string | null
          merge_status: string | null
          notes: string | null
          priority: number | null
          source_branch: string | null
          task_ids: string[] | null
          tests_passed: boolean | null
          updated_at: string | null
          worktree_path: string | null
        }
        Insert: {
          branch_name: string
          conflict_details?: Json | null
          conflicts_detected?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_updated_from_source?: string | null
          merge_commit_sha?: string | null
          merge_completed_at?: string | null
          merge_started_at?: string | null
          merge_status?: string | null
          notes?: string | null
          priority?: number | null
          source_branch?: string | null
          task_ids?: string[] | null
          tests_passed?: boolean | null
          updated_at?: string | null
          worktree_path?: string | null
        }
        Update: {
          branch_name?: string
          conflict_details?: Json | null
          conflicts_detected?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_updated_from_source?: string | null
          merge_commit_sha?: string | null
          merge_completed_at?: string | null
          merge_started_at?: string | null
          merge_status?: string | null
          notes?: string | null
          priority?: number | null
          source_branch?: string | null
          task_ids?: string[] | null
          tests_passed?: boolean | null
          updated_at?: string | null
          worktree_path?: string | null
        }
        Relationships: []
      }
      dev_task_commits: {
        Row: {
          commit_hash: string
          commit_message: string | null
          created_at: string | null
          deletions: number | null
          files_changed: number | null
          id: string
          insertions: number | null
          task_id: string | null
        }
        Insert: {
          commit_hash: string
          commit_message?: string | null
          created_at?: string | null
          deletions?: number | null
          files_changed?: number | null
          id?: string
          insertions?: number | null
          task_id?: string | null
        }
        Update: {
          commit_hash?: string
          commit_message?: string | null
          created_at?: string | null
          deletions?: number | null
          files_changed?: number | null
          id?: string
          insertions?: number | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_task_commits_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_task_commits_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks_with_git"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_task_files: {
        Row: {
          action: string | null
          created_at: string | null
          file_path: string
          id: string
          task_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          file_path: string
          id?: string
          task_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          file_path?: string
          id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_task_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_task_files_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks_with_git"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_task_tags: {
        Row: {
          created_at: string | null
          id: string
          tag: string
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          tag: string
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          tag?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks_with_git"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_task_work_sessions: {
        Row: {
          claude_session_id: string | null
          commands_used: string[] | null
          ended_at: string | null
          files_modified: string[] | null
          id: string
          started_at: string | null
          summary: string | null
          task_id: string | null
        }
        Insert: {
          claude_session_id?: string | null
          commands_used?: string[] | null
          ended_at?: string | null
          files_modified?: string[] | null
          id?: string
          started_at?: string | null
          summary?: string | null
          task_id?: string | null
        }
        Update: {
          claude_session_id?: string | null
          commands_used?: string[] | null
          ended_at?: string | null
          files_modified?: string[] | null
          id?: string
          started_at?: string | null
          summary?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_task_work_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_task_work_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks_with_git"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_tasks: {
        Row: {
          app: string | null
          claude_request: string | null
          claude_response: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string
          git_branch: string | null
          git_commit_current: string | null
          git_commit_start: string | null
          git_commits_count: number | null
          id: string
          is_subtask: boolean | null
          parent_task_id: string | null
          priority: string | null
          requires_branch: boolean | null
          revision_count: number | null
          status: string | null
          task_type: string | null
          testing_notes: string | null
          title: string
          updated_at: string | null
          work_mode: string | null
          worktree_active: boolean | null
          worktree_path: string | null
        }
        Insert: {
          app?: string | null
          claude_request?: string | null
          claude_response?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          git_branch?: string | null
          git_commit_current?: string | null
          git_commit_start?: string | null
          git_commits_count?: number | null
          id?: string
          is_subtask?: boolean | null
          parent_task_id?: string | null
          priority?: string | null
          requires_branch?: boolean | null
          revision_count?: number | null
          status?: string | null
          task_type?: string | null
          testing_notes?: string | null
          title: string
          updated_at?: string | null
          work_mode?: string | null
          worktree_active?: boolean | null
          worktree_path?: string | null
        }
        Update: {
          app?: string | null
          claude_request?: string | null
          claude_response?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          git_branch?: string | null
          git_commit_current?: string | null
          git_commit_start?: string | null
          git_commits_count?: number | null
          id?: string
          is_subtask?: boolean | null
          parent_task_id?: string | null
          priority?: string | null
          requires_branch?: boolean | null
          revision_count?: number | null
          status?: string | null
          task_type?: string | null
          testing_notes?: string | null
          title?: string
          updated_at?: string | null
          work_mode?: string | null
          worktree_active?: boolean | null
          worktree_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks_with_git"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_files: {
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
          id: string
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
          id: string
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
          id?: string
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
          mnemonic: string | null
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
          mnemonic?: string | null
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
          mnemonic?: string | null
          name?: string
          prompt_id?: string | null
          updated_at?: string | null
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
        Relationships: []
      }
      email_messages: {
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
        Relationships: []
      }
      expert_profile_aliases: {
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
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_profiles: {
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
      filter_user_profile_drives: {
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
            referencedRelation: "filter_user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      filter_user_profiles: {
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
      google_expert_documents: {
        Row: {
          ai_summary_status:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          classification_confidence: number | null
          classification_metadata: Json | null
          classification_reasoning: string | null
          confidence_score: number | null
          created_at: string
          document_type_id: string | null
          id: string
          is_supported_type: boolean | null
          pipeline_status: Database["public"]["Enums"]["pipeline_status"]
          processed_content: Json | null
          processing_error: string | null
          processing_skip_reason: string | null
          raw_content: string | null
          reprocessing_status: Database["public"]["Enums"]["reprocessing_status"]
          reprocessing_status_updated_at: string | null
          retry_count: number | null
          source_id: string
          title: string | null
          updated_at: string
          whisper_model_used: string | null
          word_count: number | null
        }
        Insert: {
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          classification_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string
          document_type_id?: string | null
          id?: string
          is_supported_type?: boolean | null
          pipeline_status?: Database["public"]["Enums"]["pipeline_status"]
          processed_content?: Json | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          raw_content?: string | null
          reprocessing_status?: Database["public"]["Enums"]["reprocessing_status"]
          reprocessing_status_updated_at?: string | null
          retry_count?: number | null
          source_id: string
          title?: string | null
          updated_at?: string
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Update: {
          ai_summary_status?:
            | Database["public"]["Enums"]["ai_summary_status_type"]
            | null
          classification_confidence?: number | null
          classification_metadata?: Json | null
          classification_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string
          document_type_id?: string | null
          id?: string
          is_supported_type?: boolean | null
          pipeline_status?: Database["public"]["Enums"]["pipeline_status"]
          processed_content?: Json | null
          processing_error?: string | null
          processing_skip_reason?: string | null
          raw_content?: string | null
          reprocessing_status?: Database["public"]["Enums"]["reprocessing_status"]
          reprocessing_status_updated_at?: string | null
          retry_count?: number | null
          source_id?: string
          title?: string | null
          updated_at?: string
          whisper_model_used?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_classifications_view"
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
            foreignKeyName: "expert_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "google_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["source_id"]
          },
        ]
      }
      google_sources: {
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
      google_sources_experts: {
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
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_google_experts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "google_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_google_experts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["source_id"]
          },
        ]
      }
      google_sync_history: {
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
      google_sync_statistics: {
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
          root_drive_id: string | null
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
          root_drive_id?: string | null
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
          root_drive_id?: string | null
          total_google_drive_items?: number | null
        }
        Relationships: []
      }
      learn_document_classifications: {
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
            referencedRelation: "learn_subject_classifications"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_document_concepts: {
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
            referencedRelation: "google_expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_concepts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["expert_document_id"]
          },
        ]
      }
      learn_media_bookmarks: {
        Row: {
          bookmark_type: string | null
          created_at: string | null
          id: string
          media_id: string
          note: string | null
          tags: string[] | null
          timestamp_seconds: number
          user_id: string | null
        }
        Insert: {
          bookmark_type?: string | null
          created_at?: string | null
          id?: string
          media_id: string
          note?: string | null
          tags?: string[] | null
          timestamp_seconds: number
          user_id?: string | null
        }
        Update: {
          bookmark_type?: string | null
          created_at?: string | null
          id?: string
          media_id?: string
          note?: string | null
          tags?: string[] | null
          timestamp_seconds?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_media_playback_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          session_id: string | null
          timestamp_seconds: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          session_id?: string | null
          timestamp_seconds: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string | null
          timestamp_seconds?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_playback_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learn_media_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_playback_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_media_sessions: {
        Row: {
          completion_percentage: number | null
          created_at: string | null
          device_type: string | null
          id: string
          media_id: string | null
          session_end: string | null
          session_start: string | null
          session_type: string | null
          total_duration_seconds: number | null
          user_id: string | null
        }
        Insert: {
          completion_percentage?: number | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          media_id?: string | null
          session_end?: string | null
          session_start?: string | null
          session_type?: string | null
          total_duration_seconds?: number | null
          user_id?: string | null
        }
        Update: {
          completion_percentage?: number | null
          created_at?: string | null
          device_type?: string | null
          id?: string
          media_id?: string | null
          session_end?: string | null
          session_start?: string | null
          session_type?: string | null
          total_duration_seconds?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_media_topic_segments: {
        Row: {
          ai_summary: string | null
          created_at: string | null
          difficulty_level: string | null
          end_time_seconds: number
          id: string
          key_concepts: string[] | null
          media_id: string
          segment_title: string | null
          start_time_seconds: number
          topic_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string | null
          difficulty_level?: string | null
          end_time_seconds: number
          id?: string
          key_concepts?: string[] | null
          media_id: string
          segment_title?: string | null
          start_time_seconds: number
          topic_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          created_at?: string | null
          difficulty_level?: string | null
          end_time_seconds?: number
          id?: string
          key_concepts?: string[] | null
          media_id?: string
          segment_title?: string | null
          start_time_seconds?: number
          topic_id?: string | null
        }
        Relationships: []
      }
      learn_subject_classifications: {
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
      learn_topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_topic_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_topic_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "learn_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_user_analytics: {
        Row: {
          average_session_length: number | null
          completion_rate: number | null
          experts_followed: string[] | null
          insights: Json | null
          last_calculated: string | null
          preferred_time_of_day: string | null
          quiz_average_score: number | null
          topics_explored: string[] | null
          total_minutes_watched: number | null
          user_id: string
        }
        Insert: {
          average_session_length?: number | null
          completion_rate?: number | null
          experts_followed?: string[] | null
          insights?: Json | null
          last_calculated?: string | null
          preferred_time_of_day?: string | null
          quiz_average_score?: number | null
          topics_explored?: string[] | null
          total_minutes_watched?: number | null
          user_id: string
        }
        Update: {
          average_session_length?: number | null
          completion_rate?: number | null
          experts_followed?: string[] | null
          insights?: Json | null
          last_calculated?: string | null
          preferred_time_of_day?: string | null
          quiz_average_score?: number | null
          topics_explored?: string[] | null
          total_minutes_watched?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_user_interests: {
        Row: {
          created_at: string
          id: string
          interest_level: number | null
          subject_classification_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          interest_level?: number | null
          subject_classification_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          interest_level?: number | null
          subject_classification_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subject_interests_subject_classification_id_fkey"
            columns: ["subject_classification_id"]
            isOneToOne: false
            referencedRelation: "learn_subject_classifications"
            referencedColumns: ["id"]
          },
        ]
      }
      learn_user_scores: {
        Row: {
          calculated_at: string | null
          difficulty_match: number | null
          engagement_score: number | null
          id: string
          media_id: string
          reason: string | null
          relevance_score: number | null
          shown_to_user: boolean | null
          user_id: string | null
        }
        Insert: {
          calculated_at?: string | null
          difficulty_match?: number | null
          engagement_score?: number | null
          id?: string
          media_id: string
          reason?: string | null
          relevance_score?: number | null
          shown_to_user?: boolean | null
          user_id?: string | null
        }
        Update: {
          calculated_at?: string | null
          difficulty_match?: number | null
          engagement_score?: number | null
          id?: string
          media_id?: string
          reason?: string | null
          relevance_score?: number | null
          shown_to_user?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_content_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      media_presentation_assets: {
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
            referencedRelation: "google_expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_asset_expert_document_id_fkey"
            columns: ["asset_expert_document_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["expert_document_id"]
          },
          {
            foreignKeyName: "presentation_assets_asset_source_id_fkey"
            columns: ["asset_source_id"]
            isOneToOne: false
            referencedRelation: "google_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentation_assets_asset_source_id_fkey"
            columns: ["asset_source_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "presentation_assets_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["presentation_id"]
          },
          {
            foreignKeyName: "presentation_assets_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "media_presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_presentations: {
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
            referencedRelation: "google_expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentations_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["expert_document_id"]
          },
          {
            foreignKeyName: "presentations_high_level_folder_source_id_fkey"
            columns: ["high_level_folder_source_id"]
            isOneToOne: false
            referencedRelation: "google_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentations_high_level_folder_source_id_fkey"
            columns: ["high_level_folder_source_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "presentations_video_source_id_fkey"
            columns: ["video_source_id"]
            isOneToOne: false
            referencedRelation: "google_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentations_video_source_id_fkey"
            columns: ["video_source_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["source_id"]
          },
        ]
      }
      media_processing_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          drive_id: string
          duration_seconds: number | null
          error_count: number | null
          error_message: string | null
          expert_document_id: string | null
          file_size_bytes: number | null
          filename: string
          id: string
          last_error_at: string | null
          m4a_drive_id: string | null
          m4a_path: string | null
          m4a_uploaded_at: string | null
          mime_type: string
          mp4_path: string | null
          processing_accelerator: string | null
          processing_model: string | null
          source_id: string | null
          started_at: string | null
          status: string
          summary_path: string | null
          transcript_path: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          drive_id: string
          duration_seconds?: number | null
          error_count?: number | null
          error_message?: string | null
          expert_document_id?: string | null
          file_size_bytes?: number | null
          filename: string
          id?: string
          last_error_at?: string | null
          m4a_drive_id?: string | null
          m4a_path?: string | null
          m4a_uploaded_at?: string | null
          mime_type: string
          mp4_path?: string | null
          processing_accelerator?: string | null
          processing_model?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          summary_path?: string | null
          transcript_path?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          drive_id?: string
          duration_seconds?: number | null
          error_count?: number | null
          error_message?: string | null
          expert_document_id?: string | null
          file_size_bytes?: number | null
          filename?: string
          id?: string
          last_error_at?: string | null
          m4a_drive_id?: string | null
          m4a_path?: string | null
          m4a_uploaded_at?: string | null
          mime_type?: string
          mp4_path?: string | null
          processing_accelerator?: string | null
          processing_model?: string | null
          source_id?: string | null
          started_at?: string | null
          status?: string
          summary_path?: string | null
          transcript_path?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_processing_status_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "google_expert_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_processing_status_expert_document_id_fkey"
            columns: ["expert_document_id"]
            isOneToOne: false
            referencedRelation: "media_content_view"
            referencedColumns: ["expert_document_id"]
          },
          {
            foreignKeyName: "media_processing_status_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "google_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_processing_status_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "media_content_view"
            referencedColumns: ["source_id"]
          },
        ]
      }
      scripts_registry: {
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
            referencedRelation: "document_classifications_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scripts_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_mime_types: {
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
      sys_table_definitions: {
        Row: {
          created_by: string | null
          created_date: string | null
          description: string | null
          id: string
          last_modified: string | null
          notes: string | null
          purpose: string | null
          table_name: string
          table_schema: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          last_modified?: string | null
          notes?: string | null
          purpose?: string | null
          table_name: string
          table_schema?: string
        }
        Update: {
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          last_modified?: string | null
          notes?: string | null
          purpose?: string | null
          table_name?: string
          table_schema?: string
        }
        Relationships: []
      }
      sys_table_migrations: {
        Row: {
          compatibility_view_created: boolean | null
          dependencies: Json | null
          id: string
          migrated_at: string | null
          migrated_by: string | null
          new_name: string
          notes: string | null
          old_name: string
          rollback_at: string | null
          rollback_by: string | null
          status: string | null
        }
        Insert: {
          compatibility_view_created?: boolean | null
          dependencies?: Json | null
          id?: string
          migrated_at?: string | null
          migrated_by?: string | null
          new_name: string
          notes?: string | null
          old_name: string
          rollback_at?: string | null
          rollback_by?: string | null
          status?: string | null
        }
        Update: {
          compatibility_view_created?: boolean | null
          dependencies?: Json | null
          id?: string
          migrated_at?: string | null
          migrated_by?: string | null
          new_name?: string
          notes?: string | null
          old_name?: string
          rollback_at?: string | null
          rollback_by?: string | null
          status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      ai_prompt_template_associations_view: {
        Row: {
          association_created_at: string | null
          association_id: string | null
          association_updated_at: string | null
          priority: number | null
          prompt_id: string | null
          prompt_name: string | null
          template_description: string | null
          template_id: string | null
          template_name: string | null
        }
        Relationships: []
      }
      command_refactor_status_summary: {
        Row: {
          command_type: string | null
          count: number | null
          current_status: string | null
          pipeline: string | null
        }
        Relationships: []
      }
      commands_needing_attention: {
        Row: {
          command_name: string | null
          command_type: string | null
          current_status: string | null
          description: string | null
          priority: number | null
        }
        Insert: {
          command_name?: string | null
          command_type?: string | null
          current_status?: string | null
          description?: string | null
          priority?: never
        }
        Update: {
          command_name?: string | null
          command_type?: string | null
          current_status?: string | null
          description?: string | null
          priority?: never
        }
        Relationships: []
      }
      dev_tasks_with_git: {
        Row: {
          app: string | null
          claude_request: string | null
          claude_response: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          git_branch: string | null
          git_commit_current: string | null
          git_commit_start: string | null
          git_commits_count: number | null
          id: string | null
          is_subtask: boolean | null
          last_worked_on: string | null
          parent_task_id: string | null
          priority: string | null
          revision_count: number | null
          status: string | null
          task_type: string | null
          testing_notes: string | null
          title: string | null
          total_commits: number | null
          total_sessions: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dev_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dev_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "dev_tasks_with_git"
            referencedColumns: ["id"]
          },
        ]
      }
      document_classifications_view: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          expected_json_schema: Json | null
          id: string | null
          is_ai_generated: boolean | null
          is_general_type: boolean | null
          mnemonic: string | null
          name: string | null
          prompt_id: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          expected_json_schema?: Json | null
          id?: string | null
          is_ai_generated?: boolean | null
          is_general_type?: boolean | null
          mnemonic?: string | null
          name?: string | null
          prompt_id?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          expected_json_schema?: Json | null
          id?: string | null
          is_ai_generated?: boolean | null
          is_general_type?: boolean | null
          mnemonic?: string | null
          name?: string | null
          prompt_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      learn_user_progress: {
        Row: {
          avg_completion: number | null
          bookmarks_created: number | null
          email: string | null
          interested_topics: string[] | null
          learning_goals: string[] | null
          name: string | null
          onboarding_completed: boolean | null
          profile_completeness: number | null
          total_minutes: number | null
          user_id: string | null
          videos_watched: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_v2_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "auth_allowed_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      media_content_view: {
        Row: {
          entity_id: string | null
          expert_document_id: string | null
          expert_full_name: string | null
          expert_id: string | null
          expert_name: string | null
          media_name: string | null
          media_type: string | null
          mime_type: string | null
          path: string | null
          presentation_id: string | null
          presentation_title: string | null
          source_id: string | null
          subject: string | null
          transcript_title: string | null
          web_view_link: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_google_experts_expert_id_fkey"
            columns: ["expert_id"]
            isOneToOne: false
            referencedRelation: "expert_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_ai_work_summaries: {
        Row: {
          category: string | null
          commands: string[] | null
          created_at: string | null
          id: string | null
          status: string | null
          summary_preview: string | null
          tags: string[] | null
          title: string | null
          ui_components: string[] | null
          work_date: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_allowed_email: {
        Args: {
          p_email: string
          p_name?: string
          p_organization?: string
          p_notes?: string
          p_added_by?: string
        }
        Returns: string
      }
      add_unique_constraint: {
        Args: { p_table_name: string; p_column_name: string }
        Returns: undefined
      }
      admin_reset_user_password: {
        Args: { target_email: string; new_password: string }
        Returns: boolean
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
      approve_access_request: {
        Args: { p_request_id: string; p_approved_by?: string; p_notes?: string }
        Returns: boolean
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
      check_auth_user_exists: {
        Args: { target_email: string }
        Returns: {
          user_id: string
          email: string
          created_at: string
          user_exists: boolean
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
      cleanup_expired_cli_tokens: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      deny_access_request: {
        Args: {
          p_request_id: string
          p_denied_by?: string
          p_denial_reason?: string
        }
        Returns: boolean
      }
      deprecate_missing_commands: {
        Args: { p_pipeline_id: string; p_current_commands: string[] }
        Returns: number
      }
      discover_pipeline_commands: {
        Args: { p_pipeline_name: string; p_script_content: string }
        Returns: Json
      }
      execute_sql: {
        Args: { sql_query: string }
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
      get_active_pipeline_commands: {
        Args: { p_pipeline_id: string }
        Returns: {
          id: string
          command_name: string
          description: string
          usage_pattern: string
          example_usage: string
          display_order: number
        }[]
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
      get_all_tables_with_metadata: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          table_schema: string
          table_type: string
          row_count: number
          size_pretty: string
          size_bytes: number
          column_count: number
          has_primary_key: boolean
          has_rls: boolean
          created_at: string
          updated_at: string
          description: string
        }[]
      }
      get_all_views_with_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          view_name: string
          view_schema: string
          is_updatable: boolean
          is_insertable: boolean
          has_rls: boolean
          table_dependencies: string[]
          suggested_prefix: string
        }[]
      }
      get_auth_audit_log_count: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_backup_tables: {
        Args: Record<PropertyKey, never>
        Returns: {
          original_table_name: string
          backup_table_name: string
          backup_date: string
          row_count: number
          backup_reason: string
          created_at: string
          created_by: string
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
      get_command_usage_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          pipeline_name: string
          command_name: string
          execution_count: number
          success_count: number
          failure_count: number
          last_executed: string
          avg_duration_ms: number
        }[]
      }
      get_database_views_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          view_name: string
          view_schema: string
          view_definition: string
          is_insertable: boolean
          is_updatable: boolean
          is_deletable: boolean
          has_rls: boolean
          table_dependencies: string[]
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
      get_media_processing_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          status: string
          count: number
          avg_duration_seconds: number
          total_size_gb: number
        }[]
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
      get_next_merge_candidate: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          branch_name: string
          priority: number
          pending_dependencies: number
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
      get_pipeline_statistics: {
        Args: { p_pipeline_id?: string }
        Returns: {
          pipeline_id: string
          pipeline_name: string
          total_commands: number
          active_commands: number
          deprecated_commands: number
          tables_accessed: number
          last_used: string
          total_executions: number
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
          ordinal_position: number
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
      get_table_info_with_definitions: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_schema: string
          table_name: string
          table_type: string
          row_count: number
          size_pretty: string
          total_size_pretty: string
          description: string
          purpose: string
          created_date: string
          created_by: string
          notes: string
        }[]
      }
      get_table_metadata: {
        Args: { p_target_table: string }
        Returns: Json
      }
      get_table_row_count: {
        Args: { p_table_name: string }
        Returns: number
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
      is_email_allowed: {
        Args: { check_email: string }
        Returns: boolean
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
      make_email_admin: {
        Args: { user_email: string }
        Returns: Json
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
      search_ai_work_summaries: {
        Args: { search_query: string }
        Returns: {
          id: string
          title: string
          summary_content: string
          work_date: string
          commands: string[]
          tags: string[]
          category: string
          rank: number
        }[]
      }
      set_current_domain: {
        Args: { domain_id: string }
        Returns: undefined
      }
      set_user_admin_role: {
        Args: { target_email: string; is_admin?: boolean }
        Returns: boolean
      }
      submit_access_request: {
        Args: {
          p_email: string
          p_name: string
          p_profession?: string
          p_professional_interests?: string
          p_organization?: string
          p_reason_for_access?: string
        }
        Returns: string
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
      update_media_processing_status: {
        Args: {
          p_source_id: string
          p_new_status: string
          p_error_message?: string
        }
        Returns: boolean
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
      pipeline_status:
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
      reprocessing_status:
        | "needs_reprocessing"
        | "reprocessing_done"
        | "skip_processing"
        | "not_set"
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
      pipeline_status: [
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
      reprocessing_status: [
        "needs_reprocessing",
        "reprocessing_done",
        "skip_processing",
        "not_set",
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
