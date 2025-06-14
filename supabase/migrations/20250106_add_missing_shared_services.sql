-- Migration: Add missing shared services to sys_shared_services
-- Purpose: Add services identified in analysis that are missing from the registry

-- 1. Update AIProcessingService (already exists as AiProcessingService but needs proper naming/description)
UPDATE sys_shared_services 
SET 
  description = 'AI processing utilities for document classification and content analysis',
  category = 'AI Services',
  service_path = 'packages/shared/services/ai-processing-service',
  updated_at = CURRENT_TIMESTAMP
WHERE service_name = 'AiProcessingService';

-- 2. Add AdminUserService (missing)
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'AdminUserService',
  'User and admin management service for authentication and authorization',
  'Auth Services',
  'active',
  'packages/shared/services/admin-user-service',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 3. ExpertService already exists, update description if needed
UPDATE sys_shared_services 
SET 
  description = 'Expert profile management service with CRUD operations and search capabilities',
  category = 'Domain Services',
  updated_at = CURRENT_TIMESTAMP
WHERE service_name = 'ExpertService';

-- 4. Add DocumentMaintenanceService (missing)
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'DocumentMaintenanceService',
  'Document maintenance statistics and health monitoring service',
  'Document Services',
  'active',
  'packages/shared/services/document-maintenance-service',
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 5. Add ProxyServerBaseService (missing)
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'ProxyServerBaseService',
  'Base class for proxy server implementations with shared functionality',
  'Infrastructure Services',
  'active',
  'packages/shared/services/proxy-server-base-service',
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 6. FileOperationsService - might be FileService, but add if different
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'FileOperationsService',
  'Centralized file operations service for consistent file handling across environments',
  'Utility Services',
  'active',
  'packages/shared/services/file-operations-service',
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 7. Add CLIExecutorService (missing)
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'CLIExecutorService',
  'Safe command execution service for running CLI commands with proper error handling',
  'Infrastructure Services',
  'active',
  'packages/shared/services/cli-executor-service',
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 8. GitOperationsService - might be GitService, but add if different
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'GitOperationsService',
  'Git command utilities for repository operations and worktree management',
  'Infrastructure Services',
  'active',
  'packages/shared/services/git-operations-service',
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 9. Add HTTPResponseHelpersService (missing)
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'HTTPResponseHelpersService',
  'HTTP response formatting and standardization service for consistent API responses',
  'Infrastructure Services',
  'active',
  'packages/shared/services/http-response-helpers-service',
  false,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- 10. Add ServerRegistryService (identified in analysis but not in original list)
INSERT INTO sys_shared_services (
  service_name, 
  description, 
  category, 
  status,
  service_path,
  is_singleton,
  has_browser_variant,
  created_at,
  updated_at
) VALUES (
  'ServerRegistryService',
  'Dynamic server port discovery and management service',
  'Infrastructure Services',
  'active',
  'packages/shared/services/server-registry-service',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
) ON CONFLICT (service_name) DO NOTHING;

-- Add summary comment
COMMENT ON TABLE sys_shared_services IS 'Registry of shared services available across the monorepo. Updated with missing services identified in architecture analysis.';