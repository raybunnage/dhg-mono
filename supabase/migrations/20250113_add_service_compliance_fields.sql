-- Add fields to sys_shared_services for tracking service compliance and testing

-- Add environment type field
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS environment_type TEXT CHECK (environment_type IN ('universal', 'node-only', 'browser-only', 'proxy-required'));

-- Add testing status fields
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS has_tests BOOLEAN DEFAULT false;
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS test_coverage_percent INTEGER CHECK (test_coverage_percent >= 0 AND test_coverage_percent <= 100);
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS last_test_run TIMESTAMPTZ;

-- Add compliance tracking
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS checklist_compliant BOOLEAN DEFAULT false;
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS compliance_issues JSONB DEFAULT '[]'::jsonb;
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS refactoring_notes TEXT;

-- Add proxy server usage tracking
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS used_by_proxy_servers TEXT[] DEFAULT '{}';

-- Add environment configuration
ALTER TABLE sys_shared_services
ADD COLUMN IF NOT EXISTS environment_config JSONB DEFAULT '{
  "supportsNode": true,
  "supportsBrowser": false,
  "requiresProxy": false,
  "requiresAuth": false
}'::jsonb;

-- Update description for the new fields
COMMENT ON COLUMN sys_shared_services.environment_type IS 'Type of environment support: universal, node-only, browser-only, proxy-required';
COMMENT ON COLUMN sys_shared_services.has_tests IS 'Whether the service has test coverage';
COMMENT ON COLUMN sys_shared_services.test_coverage_percent IS 'Percentage of test coverage (0-100)';
COMMENT ON COLUMN sys_shared_services.last_test_run IS 'Timestamp of last test execution';
COMMENT ON COLUMN sys_shared_services.checklist_compliant IS 'Whether service meets all checklist requirements';
COMMENT ON COLUMN sys_shared_services.compliance_issues IS 'Array of compliance issues found';
COMMENT ON COLUMN sys_shared_services.refactoring_notes IS 'Notes about required refactoring';
COMMENT ON COLUMN sys_shared_services.used_by_proxy_servers IS 'Array of proxy servers using this service';
COMMENT ON COLUMN sys_shared_services.environment_config IS 'Detailed environment support configuration';