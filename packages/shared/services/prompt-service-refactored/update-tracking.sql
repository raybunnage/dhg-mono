-- Update sys_shared_services for PromptService refactoring
UPDATE sys_shared_services
SET 
  status = 'completed',
  new_location = 'packages/shared/services/prompt-service-refactored/',
  migration_date = CURRENT_TIMESTAMP,
  extends_base_class = 'SingletonService',
  has_tests = true,
  test_location = 'packages/shared/services/prompt-service-refactored/PromptService.test.ts',
  notes = 'Refactored to extend SingletonService with environment abstraction for Node.js/browser compatibility. Includes comprehensive tests and benchmarks.'
WHERE service_name = 'PromptService'
  AND original_location = 'packages/shared/services/prompt-service/';