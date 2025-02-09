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
      experts: {
        Row: {
          bio: string | null
          created_at: string
          created_by: string
          domain_id: string
          email_address: string | null
          experience_years: number | null
          expert_name: string
          expertise_area: string | null
          full_name: string | null
          id: string
          is_in_core_group: boolean
          legacy_expert_id: number | null
          starting_ref_id: number | null
          updated_at: string
          updated_by: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          created_by?: string
          domain_id?: string
          email_address?: string | null
          experience_years?: number | null
          expert_name: string
          expertise_area?: string | null
          full_name?: string | null
          id?: string
          is_in_core_group?: boolean
          legacy_expert_id?: number | null
          starting_ref_id?: number | null
          updated_at?: string
          updated_by?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          created_by?: string
          domain_id?: string
          email_address?: string | null
          experience_years?: number | null
          expert_name?: string
          expertise_area?: string | null
          full_name?: string | null
          id?: string
          is_in_core_group?: boolean
          legacy_expert_id?: number | null
          starting_ref_id?: number | null
          updated_at?: string
          updated_by?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experts_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
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
      test: {
        Row: {
          created_at: string | null
          first_name: string | null
          last_name: string | null
          user_id: string
          user_initials: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          user_id?: string
          user_initials?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          first_name?: string | null
          last_name?: string | null
          user_id?: string
          user_initials?: string | null
          username?: string | null
        }
        Relationships: []
      }
      todos: {
        Row: {
          created_at: string
          email: string | null
          id: number
          is_active: boolean
          name: string | null
          priority: number
          status: string | null
          tags: string[]
          value: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          is_active?: boolean
          name?: string | null
          priority: number
          status?: string | null
          tags?: string[]
          value?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          is_active?: boolean
          name?: string | null
          priority?: number
          status?: string | null
          tags?: string[]
          value?: number
        }
        Relationships: []
      }
      uni_document_types: {
        Row: {
          category: string
          created_at: string
          created_by: string
          current_num_of_type: number | null
          description: string | null
          document_type: string
          document_type_counts: number | null
          domain_id: string
          file_extension: string | null
          id: string
          is_ai_generated: boolean
          legacy_document_type_id: number | null
          mime_type: string | null
          required_fields: Json | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string
          current_num_of_type?: number | null
          description?: string | null
          document_type: string
          document_type_counts?: number | null
          domain_id?: string
          file_extension?: string | null
          id?: string
          is_ai_generated?: boolean
          legacy_document_type_id?: number | null
          mime_type?: string | null
          required_fields?: Json | null
          updated_at?: string
          updated_by?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          current_num_of_type?: number | null
          description?: string | null
          document_type?: string
          document_type_counts?: number | null
          domain_id?: string
          file_extension?: string | null
          id?: string
          is_ai_generated?: boolean
          legacy_document_type_id?: number | null
          mime_type?: string | null
          required_fields?: Json | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "uni_document_types_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
      [_ in never]: never
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
