-- Add refactoring tracking columns to sys_shared_services
ALTER TABLE sys_shared_services 
ADD COLUMN IF NOT EXISTS is_refactored boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refactored_date date,
ADD COLUMN IF NOT EXISTS refactoring_validated boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refactoring_validation_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS tests_passing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS test_file_path text;

-- Update existing refactored services based on path
UPDATE sys_shared_services 
SET 
  is_refactored = true,
  refactored_date = '2025-06-13'::date
WHERE service_path LIKE '%-refactored%' OR service_path LIKE '%-refactored/%';

-- Add comment explaining the columns
COMMENT ON COLUMN sys_shared_services.is_refactored IS 'Whether the service has been refactored to follow new patterns';
COMMENT ON COLUMN sys_shared_services.refactored_date IS 'Date when the service was refactored';
COMMENT ON COLUMN sys_shared_services.refactoring_validated IS 'Whether the refactored service has been validated with passing tests';
COMMENT ON COLUMN sys_shared_services.refactoring_validation_date IS 'Timestamp of when validation was completed';
COMMENT ON COLUMN sys_shared_services.tests_passing IS 'Whether all tests are currently passing for this service';
COMMENT ON COLUMN sys_shared_services.test_file_path IS 'Path to the test file for this service';