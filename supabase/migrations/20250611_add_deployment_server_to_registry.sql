-- Add deployment server to server registry
INSERT INTO sys_server_ports_registry (
  service_name,
  display_name,
  description,
  port,
  health_check_endpoint,
  status,
  metadata
) VALUES (
  'deployment-server',
  'Deployment Server',
  'Deployment management server for dhg-admin-code',
  3015,
  '/health',
  'active',
  jsonb_build_object(
    'file_path', 'apps/dhg-admin-code/deployment-server.cjs',
    'server_type', 'express',
    'proxy_config', jsonb_build_object(
      'target', 'http://localhost:3015',
      'changeOrigin', true,
      'paths', ARRAY['/api/deployment']
    )
  )
) ON CONFLICT (service_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  port = EXCLUDED.port,
  description = EXCLUDED.description,
  health_check_endpoint = EXCLUDED.health_check_endpoint,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();