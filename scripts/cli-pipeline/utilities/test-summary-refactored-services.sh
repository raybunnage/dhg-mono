#!/bin/bash

# Quick test summary for refactored services
echo "🧪 Test Summary for Refactored Services"
echo "======================================"
echo ""

# Test a sample of services to get quick results
declare -a TEST_SERVICES=(
    "filter-service-refactored"
    "user-profile-service-refactored"
    "converter-service-refactored"
    "formatter-service-refactored"
    "database-service-refactored"
    "supabase-adapter-refactored"
    "claude-service-refactored"
    "google-drive-sync-service-refactored"
    "sources-google-update-service-refactored"
    "batch-processing-service-refactored"
)

TOTAL=0
PASSED=0
FAILED=0

cd packages/shared || exit 1

for service in "${TEST_SERVICES[@]}"; do
    if [ -d "services/$service/__tests__" ]; then
        echo "Testing $service..."
        TOTAL=$((TOTAL + 1))
        
        # Run test and capture result
        if npx vitest run "services/$service/__tests__/*.test.ts" --reporter=tap 2>/dev/null | grep -q "not ok"; then
            echo "  ❌ $service - FAILED"
            FAILED=$((FAILED + 1))
        else
            echo "  ✅ $service - PASSED"
            PASSED=$((PASSED + 1))
        fi
    else
        echo "  ⚠️  $service - No tests found"
    fi
done

echo ""
echo "Summary:"
echo "--------"
echo "Total tested: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "Success rate: $((PASSED * 100 / TOTAL))%"