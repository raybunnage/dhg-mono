-- Add test-runner-proxy to sys_server_ports_registry
INSERT INTO sys_server_ports_registry (
  service_name,
  display_name,
  port,
  description,
  status,
  environment,
  metadata
) VALUES (
  'test-runner-proxy',
  'Test Runner Proxy',
  9891,
  'Test runner for refactored services with real-time UI updates',
  'active',
  'development',
  jsonb_build_object(
    'server_type', 'proxy',
    'proxy_category', 'utility',
    'script_path', 'scripts/cli-pipeline/proxy/start-test-runner-proxy.ts',
    'base_class', 'ProxyServerBase',
    'features', jsonb_build_array(
      'vitest-integration',
      'real-time-streaming',
      'server-sent-events',
      'batch-test-execution'
    ),
    'endpoints', jsonb_build_object(
      'run_all_tests', 'POST /tests/run-all',
      'run_service_test', 'POST /tests/run-service',
      'get_status', 'GET /tests/status/:id',
      'stream_updates', 'GET /tests/stream/:id',
      'list_services', 'GET /tests/services'
    )
  )
) ON CONFLICT (service_name) DO UPDATE SET
  port = EXCLUDED.port,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;