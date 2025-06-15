#!/bin/bash

echo "🧪 Testing Fixed Services"
echo "========================"
echo ""

cd packages/shared || exit 1

echo "1. Testing GoogleDriveSyncService..."
npx vitest run services/google-drive/google-drive-sync-service-refactored/__tests__/GoogleDriveSyncService.test.ts --config ./vitest.config.ts 2>&1 | grep -E "(Tests|passed|failed)" | grep "Tests" | tail -1

echo ""
echo "2. Testing SourcesGoogleUpdateService..."
npx vitest run services/google-drive/sources-google-update-service-refactored/__tests__/SourcesGoogleUpdateService.test.ts --config ./vitest.config.ts 2>&1 | grep -E "(Tests|passed|failed)" | grep "Tests" | tail -1

echo ""
echo "3. Testing FilterService (control - should be mostly passing)..."
npx vitest run services/filter-service-refactored/__tests__/FilterService.test.ts --config ./vitest.config.ts 2>&1 | grep -E "(Tests|passed|failed)" | grep "Tests" | tail -1

echo ""
echo "✅ Test Summary Complete"