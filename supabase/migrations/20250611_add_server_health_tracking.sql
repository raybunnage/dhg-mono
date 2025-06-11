-- Add server health tracking columns to sys_server_ports_registry
-- This enables the frontend to display real-time server health status

-- Add columns for health tracking
ALTER TABLE sys_server_ports_registry
ADD COLUMN IF NOT EXISTS health_check_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS health_check_interval_seconds INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS health_check_timeout_seconds INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- Create an index for faster health status queries
CREATE INDEX IF NOT EXISTS idx_server_health_status 
ON sys_server_ports_registry(environment, status, last_health_status)
WHERE status = 'active';

-- Update the sys_active_servers_view to include health tracking info
CREATE OR REPLACE VIEW sys_active_servers_view AS
SELECT 
  spr.id,
  spr.service_name,
  spr.display_name,
  spr.description,
  spr.port,
  spr.protocol,
  spr.host,
  spr.base_path,
  spr.environment,
  spr.status,
  spr.last_health_check,
  spr.last_health_status,
  spr.health_check_enabled,
  spr.health_check_interval_seconds,
  spr.consecutive_failures,
  spr.last_error_message,
  spr.metadata,
  spr.created_at,
  spr.updated_at,
  -- Computed fields
  CONCAT(spr.protocol, '://', spr.host, ':', spr.port, spr.base_path) as base_url,
  CASE 
    WHEN spr.last_health_status = 'healthy' AND spr.status = 'active' THEN true
    ELSE false
  END as is_healthy,
  CASE
    WHEN spr.last_health_check IS NULL THEN 'never'
    WHEN EXTRACT(EPOCH FROM (NOW() - spr.last_health_check)) < 60 THEN 'just now'
    WHEN EXTRACT(EPOCH FROM (NOW() - spr.last_health_check)) < 3600 THEN CONCAT(ROUND(EXTRACT(EPOCH FROM (NOW() - spr.last_health_check)) / 60), ' min ago')
    ELSE CONCAT(ROUND(EXTRACT(EPOCH FROM (NOW() - spr.last_health_check)) / 3600), ' hours ago')
  END as last_check_relative
FROM sys_server_ports_registry spr
WHERE spr.status = 'active'
  AND spr.environment = COALESCE(current_setting('app.environment', true), 'development')
ORDER BY spr.port;