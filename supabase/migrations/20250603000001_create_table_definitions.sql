-- Create a table to store comprehensive table definitions and metadata
CREATE TABLE IF NOT EXISTS sys_table_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  table_schema text NOT NULL DEFAULT 'public',
  table_name text NOT NULL,
  description text,
  purpose text,
  created_date date,
  created_by text,
  last_modified timestamp with time zone DEFAULT now(),
  notes text,
  UNIQUE(table_schema, table_name)
);

-- Add RLS policies
ALTER TABLE sys_table_definitions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated users to read table definitions" ON sys_table_definitions
  FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can modify table definitions" ON sys_table_definitions
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create an index for faster lookups
CREATE INDEX idx_sys_table_definitions_schema_table 
  ON sys_table_definitions(table_schema, table_name);

-- Insert comprehensive descriptions for all tables
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date, notes) VALUES
-- AI & Prompts
('public', 'ai_prompts', 'Stores reusable AI prompts and templates', 'Central repository for all AI prompts used across the system for consistency and reusability', '2025-03-01', 'Used by prompt service'),
('public', 'ai_prompt_categories', 'Categories for organizing AI prompts', 'Hierarchical categorization system for prompts (e.g., analysis, classification, summarization)', '2025-03-01', NULL),
('public', 'ai_prompt_output_templates', 'Output format templates for AI responses', 'Defines structured output formats (JSON, markdown, etc.) for consistent AI responses', '2025-03-01', NULL),
('public', 'ai_prompt_relationships', 'Stores relationships between prompts and their supporting assets', 'Links prompts to related entities like templates, categories, and other prompts', '2025-03-01', 'Already has description'),
('public', 'ai_prompt_template_associations', 'Junction table linking prompts to output templates', 'Many-to-many relationship between prompts and their possible output formats', '2025-03-01', NULL),
('public', 'ai_work_summaries', 'Tracks AI assistant work summaries for better visibility and searchability', 'Records of AI-assisted development tasks for knowledge retention and searchability', '2025-05-29', 'Already has description'),

-- Authentication & Users
('public', 'auth_allowed_emails', 'List of email addresses allowed to access the application without requesting access', 'Whitelist for pre-approved users who can access the system', '2025-05-23', 'Already has description'),
('public', 'auth_audit_log', 'Audit log for authentication events. Supports both regular auth (auth.users) and light auth (allowed_emails) user IDs.', 'Comprehensive audit trail of all authentication events for security monitoring', '2025-05-25', 'Already has description'),
('public', 'auth_cli_tokens', 'CLI authentication tokens for programmatic access', 'Secure tokens for command-line interface authentication', '2025-05-22', 'Already has description'),
('public', 'auth_user_profiles', 'Comprehensive user profiles linked to allowed_emails for learning preferences and personalization', 'Extended user information including preferences, settings, and personalization data', '2025-05-23', 'Already has description'),
('auth', 'users', 'Supabase auth users table (read-only)', 'Core authentication table managed by Supabase for user accounts', NULL, 'Managed by Supabase'),

-- Batch Processing
('public', 'batch_processing', 'Tracks batch operations for large-scale data processing', 'Queue and status tracking for batch jobs like document processing, sync operations', '2025-03-01', 'Formerly processing_batches'),

-- Command & CLI Management
('public', 'command_categories', 'Categories for organizing CLI pipelines by function', 'Groups CLI pipelines into logical categories (sync, document, database, etc.)', '2025-05-29', 'Already has description'),
('public', 'command_definitions', 'Individual commands available within each CLI pipeline', 'Registry of all commands with their usage patterns, requirements, and documentation', '2025-05-29', 'Already has description'),
('public', 'command_dependencies', 'External dependencies (services, APIs, tools) required by commands', 'Tracks what external resources each command needs to function', '2025-05-29', 'Already has description'),
('public', 'command_patterns', 'Common usage patterns and examples for commands', 'Best practices and example usage for CLI commands', '2025-05-29', NULL),
('public', 'command_pipeline_tables', 'Database tables that each pipeline interacts with', 'Maps which tables each CLI pipeline reads from or writes to', '2025-05-29', 'Already has description'),
('public', 'command_pipelines', 'Registry of all CLI pipeline scripts in the system', 'Master list of all CLI pipelines with their locations and metadata', '2025-05-29', 'Already has description'),
('public', 'command_refactor_tracking', 'Temporary table to track the refactoring status of google sync CLI commands during the reorganization project. Updated 2025-05-30 to include new unified commands from the reorganization spec.', 'Temporary tracking for CLI refactoring project', '2025-05-29', 'Already has description'),
('public', 'command_tracking', 'Execution history and metrics for CLI commands', 'Records every CLI command execution for usage analytics and debugging', '2025-05-26', 'Used for usage statistics'),

-- Development & Tasks
('public', 'dev_tasks', 'Tracks Claude Code development tasks and interactions', 'Task management for AI-assisted development work', '2025-05-29', 'Already has description'),
('public', 'dev_task_commits', 'Git commits associated with development tasks', 'Links tasks to their resulting code changes', '2025-06-01', NULL),
('public', 'dev_task_files', 'Files affected by task implementation (manually tracked)', 'Tracks which files were modified for each task', '2025-05-29', 'Already has description'),
('public', 'dev_task_tags', 'Tags for categorizing and searching tasks', 'Flexible tagging system for task organization', '2025-05-29', 'Already has description'),
('public', 'dev_task_work_sessions', 'Work sessions tracking time spent on tasks', 'Time tracking for development tasks', '2025-06-01', NULL),

-- Documents & Content
('public', 'doc_files', 'Documentation files and their metadata', 'Stores markdown and other documentation files with versioning', '2025-05-17', 'Formerly documentation_files'),
('public', 'document_types', 'Master list of document type definitions', 'Defines all possible document types in the system (presentation, script, article, etc.)', '2025-02-01', NULL),
('public', 'document_type_aliases', 'Alternative names for document types', 'Maps various names to canonical document types for flexible matching', '2025-02-01', NULL),

-- Email System
('public', 'email_addresses', 'Email addresses collected from various sources', 'Central repository of email addresses for communication', '2025-04-01', NULL),
('public', 'email_messages', 'Email message storage and tracking', 'Stores email content and metadata for the email system', '2025-04-01', 'Formerly emails'),

-- Expert System
('public', 'expert_profiles', 'Expert information and metadata', 'Profiles of subject matter experts referenced in the content', '2025-01-01', 'Formerly experts'),
('public', 'expert_profile_aliases', 'Alternative names and spellings for experts', 'Maps name variations to canonical expert profiles', '2025-02-01', 'Formerly expert_citation_aliases'),

-- Filtering & User Preferences  
('public', 'filter_user_profiles', 'User-specific filtering preferences', 'Stores saved filters and preferences for each user', '2025-04-01', NULL),
('public', 'filter_user_profile_drives', 'Google Drive folders selected by users for filtering', 'User-selected Drive folders for content filtering', '2025-04-01', NULL),

-- Google Drive Integration
('public', 'google_sources', 'Google Drive source files table (renamed from sources_google2)', 'Metadata for all files synced from Google Drive', '2025-02-01', 'Already has description'),
('public', 'google_expert_documents', 'Documents authored by or featuring experts', 'Links Google Drive documents to expert profiles', '2025-02-01', 'Formerly expert_documents'),
('public', 'google_sources_experts', 'Junction table linking sources to experts', 'Many-to-many relationship between documents and experts', '2025-02-01', NULL),
('public', 'google_sync_history', 'Records of Google Drive sync operations', 'Audit trail of all sync operations with statistics', '2025-02-26', 'Already has description'),
('public', 'google_sync_statistics', 'Aggregated statistics for sync operations', 'Performance metrics and statistics for sync operations', '2025-02-26', NULL),

-- Learning Platform
('public', 'learn_topics', 'Learning topics and subject areas', 'Hierarchical topic structure for content organization', '2025-01-31', 'Formerly learning_topics'),
('public', 'learn_document_concepts', 'Concepts extracted from documents', 'AI-identified concepts and topics within documents', '2025-01-31', 'Formerly document_concepts'),
('public', 'learn_document_classifications', 'Junction table allowing many-to-many relationships between various entities and subject classifications', 'Links documents to their subject classifications', '2025-01-31', 'Already has description'),
('public', 'learn_subject_classifications', 'Subject area classifications for content', 'Taxonomy of subjects for content categorization', '2025-01-31', 'Formerly subject_classifications'),
('public', 'learn_user_interests', 'User learning interests and preferences', 'Tracks what subjects users are interested in learning', '2025-01-31', 'Formerly user_subject_interests'),
('public', 'learn_user_analytics', 'Aggregated learning analytics per user', 'User engagement metrics and learning progress', '2025-01-31', 'Already has description'),
('public', 'learn_user_scores', 'Personalized content relevance scores for recommendations', 'AI-calculated scores for content recommendations', '2025-01-31', 'Already has description'),
('public', 'learn_media_sessions', 'Tracks user viewing sessions for presentations/media', 'Session tracking for media consumption analytics', '2025-01-31', 'Already has description'),
('public', 'learn_media_playback_events', 'Detailed playback events within media sessions', 'Granular tracking of play, pause, seek events', '2025-01-31', 'Already has description'),
('public', 'learn_media_bookmarks', 'User-created bookmarks and notes on media content', 'Personal bookmarks and annotations on media', '2025-01-31', 'Already has description'),
('public', 'learn_media_topic_segments', 'AI-identified topic segments within media for content matching', 'Time-based topic segments in media files', '2025-01-31', 'Already has description'),

-- Media & Presentations
('public', 'media_presentations', 'Presentation metadata and information', 'Central registry of all presentations in the system', '2025-02-16', 'Formerly presentations'),
('public', 'media_presentation_assets', 'Assets (slides, videos, etc.) belonging to presentations', 'Individual assets that make up presentations', '2025-02-16', 'Formerly presentation_assets'),

-- Scripts & Code
('public', 'scripts_registry', 'Stores metadata and assessments for script files (.sh, .js) in the repository', 'Registry of all executable scripts with their analysis', '2025-03-30', 'Already has description'),

-- System Tables
('public', 'sys_mime_types', 'A reference table of all MIME types found in the sources_google table', 'Centralized MIME type registry for file type handling', '2025-04-01', 'Already has description'),
('public', 'sys_table_migrations', 'Tracks table renaming operations for safe migrations and rollbacks', 'Audit trail of all table renames for migration safety', '2025-05-27', 'Already has description'),
('public', 'sys_table_definitions', 'This table - stores comprehensive table definitions', 'Documentation and metadata for all database tables', '2025-06-03', 'Self-referential')
ON CONFLICT (table_schema, table_name) DO UPDATE SET
  description = EXCLUDED.description,
  purpose = EXCLUDED.purpose,
  created_date = EXCLUDED.created_date,
  notes = EXCLUDED.notes,
  last_modified = now();

-- Create a function to get table info with definitions
CREATE OR REPLACE FUNCTION get_table_info_with_definitions()
RETURNS TABLE (
  table_schema text,
  table_name text,
  description text,
  purpose text,
  created_date date,
  row_count bigint,
  size_pretty text,
  column_count integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    t.table_schema,
    t.table_name,
    COALESCE(td.description, t.description) as description,
    td.purpose,
    td.created_date,
    t.row_count,
    t.size_pretty,
    t.column_count
  FROM get_all_tables_with_metadata() t
  LEFT JOIN sys_table_definitions td 
    ON t.table_schema = td.table_schema 
    AND t.table_name = td.table_name
  WHERE t.table_schema = 'public' 
     OR (t.table_schema = 'auth' AND t.table_name = 'users')
  ORDER BY t.table_schema, t.table_name;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_table_info_with_definitions() TO authenticated;