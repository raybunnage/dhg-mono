#!/bin/bash

echo "🧪 Final Test Summary for Fixed Services"
echo "========================================"
echo ""

cd packages/shared || exit 1

echo "Running tests with proper configuration..."
echo ""

echo "1. GoogleDriveSyncService:"
npx vitest run services/google-drive/google-drive-sync-service-refactored/__tests__/GoogleDriveSyncService.test.ts --config ./vitest.config.ts 2>&1 | grep "Tests" | tail -1

echo ""
echo "2. SourcesGoogleUpdateService:"
npx vitest run services/google-drive/sources-google-update-service-refactored/__tests__/SourcesGoogleUpdateService.test.ts --config ./vitest.config.ts 2>&1 | grep "Tests" | tail -1

echo ""
echo "3. Other Refactored Services (sample):"
echo "   FilterService:"
npx vitest run services/filter-service-refactored/__tests__/FilterService.test.ts --config ./vitest.config.ts 2>&1 | grep "Tests" | tail -1

echo "   UserProfileService:"
npx vitest run services/user-profile-service-refactored/__tests__/UserProfileService.test.ts --config ./vitest.config.ts 2>&1 | grep "Tests" | tail -1

echo "   ConverterService:"
npx vitest run services/converter-service-refactored/__tests__/ConverterService.test.ts --config ./vitest.config.ts 2>&1 | grep "Tests" | tail -1

echo ""
echo "✅ Summary Complete"