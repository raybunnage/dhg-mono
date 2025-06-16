#!/bin/bash

echo "Fixing remaining test failures in refactored services..."

# Get list of all failing test files
FAILING_SERVICES=(
  "packages/shared/services/user-profile-service-refactored/__tests__/UserProfileService.test.ts"
  "packages/shared/services/unified-classification-service-refactored/__tests__/UnifiedClassificationService.test.ts"
  "packages/shared/services/gmail-sync-service-refactored/__tests__/GmailSyncService.test.ts"
  "packages/shared/services/command-registry-service-refactored/__tests__/CommandRegistryService.test.ts"
  "packages/shared/services/command-tracking-service-refactored/__tests__/CommandTrackingService.test.ts"
  "packages/shared/services/document-classification-service-refactored/__tests__/DocumentClassificationService.test.ts"
  "packages/shared/services/media-tracking-service-refactored/__tests__/MediaTrackingService.test.ts"
  "packages/shared/services/script-manager-service-refactored/__tests__/ScriptManagerService.test.ts"
  "packages/shared/services/sync-service-refactored/__tests__/SyncService.test.ts"
  "packages/shared/services/task-service-refactored/__tests__/TaskService.test.ts"
)

# Common fixes for all services
for FILE in "${FAILING_SERVICES[@]}"; do
  if [ -f "$FILE" ]; then
    echo "Fixing $FILE..."
    
    # Fix Jest to Vitest imports
    sed -i '' 's/from '\''jest'\''/from '\''vitest'\''/g' "$FILE"
    
    # Fix jest.fn() to vi.fn()
    sed -i '' 's/jest\.fn()/vi.fn()/g' "$FILE"
    
    # Fix jest.spyOn to vi.spyOn
    sed -i '' 's/jest\.spyOn/vi.spyOn/g' "$FILE"
    
    # Fix jest.clearAllMocks to vi.clearAllMocks
    sed -i '' 's/jest\.clearAllMocks()/vi.clearAllMocks()/g' "$FILE"
    
    # Fix jest.resetAllMocks to vi.resetAllMocks
    sed -i '' 's/jest\.resetAllMocks()/vi.resetAllMocks()/g' "$FILE"
    
    # Fix mockReturnValue patterns
    sed -i '' 's/\.mockReturnValue(/.mockImplementation(() => /g' "$FILE"
    sed -i '' 's/\.mockReturnValueOnce(/.mockImplementationOnce(() => /g' "$FILE"
    
    # Fix mock reset patterns
    sed -i '' 's/\.mockReset()/.mockClear()/g' "$FILE"
    
    # Fix expect.any patterns
    sed -i '' 's/expect\.any(/expect.any(/g' "$FILE"
    
    # Fix beforeAll/afterAll if present
    sed -i '' 's/beforeAll(/beforeEach(/g' "$FILE"
    sed -i '' 's/afterAll(/afterEach(/g' "$FILE"
  fi
done

# Specific fixes for services with known patterns

# Fix UserProfileService
if [ -f "packages/shared/services/user-profile-service-refactored/__tests__/UserProfileService.test.ts" ]; then
  echo "Applying specific fixes to UserProfileService tests..."
  # Add any specific fixes here
fi

# Fix UnifiedClassificationService 
if [ -f "packages/shared/services/unified-classification-service-refactored/__tests__/UnifiedClassificationService.test.ts" ]; then
  echo "Applying specific fixes to UnifiedClassificationService tests..."
  # Add any specific fixes here
fi

echo "Test fixes applied. Running tests to check results..."

# Run all tests to see current status
cd packages/shared
pnpm test services/*-refactored/__tests__/*.test.ts --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗)" | head -50

echo "
To see detailed test results, run:
cd packages/shared && pnpm test services/*-refactored/__tests__/*.test.ts
"