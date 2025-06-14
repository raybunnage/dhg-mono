-- Migration: Consolidate audio servers
-- Purpose: Rename audio-proxy-server to audio-server and update configuration
-- Author: Claude
-- Date: 2025-06-10

-- Update any existing audio-proxy-server entries to the new unified name
UPDATE sys_server_ports_registry
SET 
  service_name = 'audio-server',
  display_name = 'Audio Server',
  description = 'Audio streaming (configurable: local Google Drive or web API)'
WHERE service_name = 'audio-proxy-server';

-- Also check for any other audio server variants and consolidate them
UPDATE sys_server_ports_registry
SET 
  service_name = 'audio-server',
  display_name = 'Audio Server',
  port = 3006,
  description = 'Audio streaming (configurable: local Google Drive or web API)'
WHERE service_name IN ('enhanced-audio-server', 'audio-web-server', 'local-audio-server')
  AND service_name != 'audio-server';

-- Log the consolidation
COMMENT ON COLUMN sys_server_ports_registry.service_name IS 
'Service identifier - consolidated all audio servers to audio-server on 2025-06-10';