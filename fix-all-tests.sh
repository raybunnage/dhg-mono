#!/bin/bash

echo "🔧 Fixing test files for refactored services..."

# Find all test files in refactored services
TEST_FILES=$(find packages/shared/services -name "*.test.ts" -path "*-refactored*")

for file in $TEST_FILES; do
  echo "Processing: $file"
  
  # 1. Add vitest imports if not present
  if ! grep -q "import.*vitest" "$file"; then
    sed -i '' '1s/^/import { describe, it, expect, beforeEach, afterEach, vi } from '\''vitest'\'';\n/' "$file"
  fi
  
  # 2. Replace jest with vi
  sed -i '' 's/jest\.fn/vi.fn/g' "$file"
  sed -i '' 's/jest\.clearAllMocks/vi.clearAllMocks/g' "$file"
  sed -i '' 's/jest\.spyOn/vi.spyOn/g' "$file"
  sed -i '' 's/jest\.mock/vi.mock/g' "$file"
  sed -i '' 's/jest\.resetAllMocks/vi.resetAllMocks/g' "$file"
  sed -i '' 's/jest\.restoreAllMocks/vi.restoreAllMocks/g' "$file"
  sed -i '' 's/as jest\.Mock/as any/g' "$file"
  sed -i '' 's/jest\.MockedFunction/any/g' "$file"
  
  # 3. Fix common test patterns
  sed -i '' 's/\.mockResolvedValue/.mockResolvedValue/g' "$file"
  sed -i '' 's/\.mockRejectedValue/.mockRejectedValue/g' "$file"
  
  # 4. Fix success/error patterns in auth-related tests
  sed -i '' 's/expect(result\.success)\.toBe(true)/expect(result.error).toBeNull()/g' "$file"
  sed -i '' 's/expect(result\.success)\.toBe(false)/expect(result.error).toBeDefined()/g' "$file"
  sed -i '' 's/expect(result\.error)\.toBe(/expect(result.error?.message).toBe(/g' "$file"
  
  # 5. Fix health check method names
  sed -i '' 's/getHealthStatus/healthCheck/g' "$file"
  sed -i '' 's/isInitialized()/getMetadata().initialized/g' "$file"
  
done

echo "✅ Test file fixes complete!"