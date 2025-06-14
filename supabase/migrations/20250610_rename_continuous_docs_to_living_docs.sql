-- Migration: Rename continuous-docs-server to living-docs-server
-- Purpose: Update service registry to reflect the renamed server
-- Author: Claude
-- Date: 2025-06-10

-- Update the sys_server_ports_registry entry
UPDATE sys_server_ports_registry
SET 
  service_name = 'living-docs-server',
  display_name = 'Living Docs Server',
  description = 'Living documentation tracking'
WHERE service_name = 'continuous-docs-server';

-- Log the change
COMMENT ON COLUMN sys_server_ports_registry.service_name IS 
'Service identifier - renamed continuous-docs-server to living-docs-server on 2025-06-10';