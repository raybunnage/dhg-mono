-- Migration: Setup dual audio servers for instant switching
-- Purpose: Configure separate web and local audio servers on different ports
-- Author: Claude
-- Date: 2025-06-10

-- First, clean up old/duplicate entries
DELETE FROM sys_server_ports_registry 
WHERE service_name IN ('audio-proxy-server', 'continuous-docs-server');

-- Ensure we have the web audio server on port 3006
INSERT INTO sys_server_ports_registry (
  service_name,
  display_name,
  description,
  port,
  protocol,
  host,
  status,
  environment
) VALUES (
  'web-google-drive-audio',
  'Web Google Drive Audio',
  'Serves audio via Google Drive API (works anywhere with internet)',
  3006,
  'http',
  'localhost',
  'active',
  'development'
) ON CONFLICT (service_name) 
DO UPDATE SET
  port = 3006,
  display_name = 'Web Google Drive Audio',
  description = 'Serves audio via Google Drive API (works anywhere with internet)';

-- Ensure we have the local audio server on port 3007  
INSERT INTO sys_server_ports_registry (
  service_name,
  display_name,
  description,
  port,
  protocol,
  host,
  status,
  environment
) VALUES (
  'local-google-drive-audio',
  'Local Google Drive Audio',
  'Serves audio from local Google Drive folder (10-100x faster)',
  3007,
  'http',
  'localhost',
  'active',
  'development'
) ON CONFLICT (service_name)
DO UPDATE SET
  port = 3007,
  display_name = 'Local Google Drive Audio',
  description = 'Serves audio from local Google Drive folder (10-100x faster)';

-- Add comment about the setup
COMMENT ON TABLE sys_server_ports_registry IS 
'Server registry - Audio servers split into web (3006) and local (3007) for instant switching';

-- Verify the final state
SELECT service_name, display_name, port, description 
FROM sys_server_ports_registry 
WHERE port IN (3006, 3007, 3008)
ORDER BY port;