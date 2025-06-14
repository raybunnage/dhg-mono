-- Safe Infrastructure Service Classification
-- These are obviously infrastructure services that manage expensive resources

-- 1. SupabaseClientService - Manages database connection pool
UPDATE sys_shared_services 
SET service_type = 'infrastructure',
    instantiation_pattern = 'singleton',
    refactoring_notes = 'Manages Supabase database connection pool - must be singleton to prevent multiple connections',
    resource_management = jsonb_build_object(
      'type', 'database_connection',
      'pool_size', 10,
      'singleton_required', true
    )
WHERE service_name = 'SupabaseClientService';

-- 2. claudeService - Manages AI API connection and rate limiting
UPDATE sys_shared_services 
SET service_type = 'infrastructure',
    instantiation_pattern = 'singleton',
    environment_support = ARRAY['node']::TEXT[],
    refactoring_notes = 'Manages Claude AI API connection with rate limiting - must be singleton',
    resource_management = jsonb_build_object(
      'type', 'api_connection',
      'rate_limit', '1000/day',
      'api_key_required', true
    )
WHERE service_name = 'claudeService';

-- 3. logger - Manages logging infrastructure
UPDATE sys_shared_services 
SET service_type = 'infrastructure',
    instantiation_pattern = 'singleton',
    environment_support = ARRAY['both']::TEXT[],
    refactoring_notes = 'Central logging service - singleton ensures consistent log handling',
    resource_management = jsonb_build_object(
      'type', 'logging',
      'browser', 'console',
      'node', 'console_and_file'
    )
WHERE service_name = 'logger';

-- 4. BrowserAuthService - Manages authentication state in browser
UPDATE sys_shared_services 
SET service_type = 'infrastructure',
    instantiation_pattern = 'singleton',
    environment_support = ARRAY['browser']::TEXT[],
    requires_initialization = true,
    initialization_dependencies = ARRAY['SupabaseClientService']::TEXT[],
    refactoring_notes = 'Manages browser authentication state - singleton ensures single auth state',
    resource_management = jsonb_build_object(
      'type', 'auth_state',
      'storage', 'localStorage',
      'session_management', true
    )
WHERE service_name = 'BrowserAuthService';

-- 5. GoogleAuthService - Manages Google API authentication
UPDATE sys_shared_services 
SET service_type = 'infrastructure',
    instantiation_pattern = 'singleton',
    environment_support = ARRAY['node']::TEXT[],
    refactoring_notes = 'Manages Google service account authentication - singleton for connection reuse',
    resource_management = jsonb_build_object(
      'type', 'google_api_auth',
      'auth_type', 'service_account',
      'token_caching', true
    )
WHERE service_name = 'GoogleAuthService';

-- Show what we updated
SELECT 
  service_name,
  service_type,
  instantiation_pattern,
  environment_support,
  refactoring_notes
FROM sys_shared_services
WHERE service_name IN (
  'SupabaseClientService',
  'claudeService',
  'logger',
  'BrowserAuthService',
  'GoogleAuthService'
);