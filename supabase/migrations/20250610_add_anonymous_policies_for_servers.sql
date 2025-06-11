-- Migration: Add anonymous access policies for server-critical tables
-- Purpose: Allow servers to access essential tables without authentication
-- Author: Claude
-- Date: 2025-06-10

-- ==============================================
-- CRITICAL SERVER INFRASTRUCTURE TABLES
-- ==============================================

-- sys_server_ports_registry: Critical for server port discovery and registration
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "sys_server_ports_anon_read" ON sys_server_ports_registry;
DROP POLICY IF EXISTS "sys_server_ports_anon_insert" ON sys_server_ports_registry;
DROP POLICY IF EXISTS "sys_server_ports_anon_update" ON sys_server_ports_registry;

-- Allow anonymous read access for port discovery
CREATE POLICY "sys_server_ports_anon_read" 
ON sys_server_ports_registry FOR SELECT 
TO anon 
USING (true);

-- Allow anonymous insert for server registration
CREATE POLICY "sys_server_ports_anon_insert" 
ON sys_server_ports_registry FOR INSERT 
TO anon 
WITH CHECK (true);

-- Allow anonymous update for health status
CREATE POLICY "sys_server_ports_anon_update" 
ON sys_server_ports_registry FOR UPDATE 
TO anon 
USING (true);

-- ==============================================
-- AUTHENTICATION TABLES (Limited Access)
-- ==============================================

-- auth_allowed_emails: Read-only for email validation
DROP POLICY IF EXISTS "auth_allowed_emails_anon_read" ON auth_allowed_emails;
CREATE POLICY "auth_allowed_emails_anon_read" 
ON auth_allowed_emails FOR SELECT 
TO anon 
USING (true);

-- ==============================================
-- WORKTREE CONFIGURATION TABLES
-- ==============================================

-- worktree_definitions: Read-only for git server operations
DROP POLICY IF EXISTS "worktree_definitions_anon_read" ON worktree_definitions;
CREATE POLICY "worktree_definitions_anon_read" 
ON worktree_definitions FOR SELECT 
TO anon 
USING (true);

-- worktree_app_mappings: Read-only for app discovery
DROP POLICY IF EXISTS "worktree_app_mappings_anon_read" ON worktree_app_mappings;
CREATE POLICY "worktree_app_mappings_anon_read" 
ON worktree_app_mappings FOR SELECT 
TO anon 
USING (true);

-- worktree_pipeline_mappings: Read-only for pipeline discovery
DROP POLICY IF EXISTS "worktree_pipeline_mappings_anon_read" ON worktree_pipeline_mappings;
CREATE POLICY "worktree_pipeline_mappings_anon_read" 
ON worktree_pipeline_mappings FOR SELECT 
TO anon 
USING (true);

-- ==============================================
-- COMMAND TRACKING TABLES
-- ==============================================

-- command_tracking: Allow anonymous insert for CLI tracking
DROP POLICY IF EXISTS "command_tracking_anon_insert" ON command_tracking;
CREATE POLICY "command_tracking_anon_insert" 
ON command_tracking FOR INSERT 
TO anon 
WITH CHECK (true);

-- command_pipelines: Read-only for pipeline discovery
DROP POLICY IF EXISTS "command_pipelines_anon_read" ON command_pipelines;
CREATE POLICY "command_pipelines_anon_read" 
ON command_pipelines FOR SELECT 
TO anon 
USING (true);

-- command_definitions: Read-only for command discovery
DROP POLICY IF EXISTS "command_definitions_anon_read" ON command_definitions;
CREATE POLICY "command_definitions_anon_read" 
ON command_definitions FOR SELECT 
TO anon 
USING (true);

-- ==============================================
-- DOCUMENTATION & MONITORING
-- ==============================================

-- doc_continuous_monitoring: Read access for monitoring status
DROP POLICY IF EXISTS "doc_continuous_monitoring_anon_read" ON doc_continuous_monitoring;
CREATE POLICY "doc_continuous_monitoring_anon_read" 
ON doc_continuous_monitoring FOR SELECT 
TO anon 
USING (true);

-- ==============================================
-- SYSTEM TABLES
-- ==============================================

-- sys_table_definitions: Read-only for table metadata
DROP POLICY IF EXISTS "sys_table_definitions_anon_read" ON sys_table_definitions;
CREATE POLICY "sys_table_definitions_anon_read" 
ON sys_table_definitions FOR SELECT 
TO anon 
USING (true);

-- sys_table_prefixes: Read-only for prefix validation
DROP POLICY IF EXISTS "sys_table_prefixes_anon_read" ON sys_table_prefixes;
CREATE POLICY "sys_table_prefixes_anon_read" 
ON sys_table_prefixes FOR SELECT 
TO anon 
USING (true);

-- ==============================================
-- AUDIT & LOGGING
-- ==============================================

-- auth_audit_log: Allow anonymous insert for audit logging
DROP POLICY IF EXISTS "auth_audit_log_anon_insert" ON auth_audit_log;
CREATE POLICY "auth_audit_log_anon_insert" 
ON auth_audit_log FOR INSERT 
TO anon 
WITH CHECK (
  -- Only allow audit events from server operations
  event_type IN ('server_startup', 'server_health_check', 'server_shutdown')
);

-- ==============================================
-- MIGRATION COMPLETION
-- ==============================================

-- Add comment to track this migration
COMMENT ON POLICY "sys_server_ports_anon_read" ON sys_server_ports_registry IS 
'Anonymous read access for server port discovery - added 2025-06-10';

COMMENT ON POLICY "sys_server_ports_anon_insert" ON sys_server_ports_registry IS 
'Anonymous insert access for server self-registration - added 2025-06-10';

-- Log migration completion
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES ('public', 'anonymous_server_policies', 
        'Virtual entry to track anonymous policy migration', 
        'Documents the addition of anonymous RLS policies for server-critical tables', 
        CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;