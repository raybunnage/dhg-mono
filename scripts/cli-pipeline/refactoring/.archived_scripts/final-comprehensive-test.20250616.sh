#!/bin/bash

echo "Final Comprehensive Test Report"
echo "==============================="
echo "Date: $(date)"
echo ""

cd packages/shared

echo "Running all refactored service tests..."
echo ""

# Services with good test coverage
GOOD_SERVICES=(
  "services/supabase-client-refactored/__tests__/SupabaseClientService.test.ts"
  "services/supabase-adapter-refactored/__tests__/SupabaseAdapterService.test.ts"
  "services/user-profile-service-refactored/__tests__/UserProfileService.test.ts"
  "services/task-service-refactored/__tests__/TaskService.test.ts"
  "services/cli-registry-service-refactored/__tests__/CLIRegistryService.test.ts"
)

# Services with some issues
PARTIAL_SERVICES=(
  "services/database-service-refactored/__tests__/DatabaseService.test.ts"
  "services/auth-service-refactored/__tests__/AuthService.test.ts"
  "services/google-drive-refactored/__tests__/GoogleDriveService.test.ts"
  "services/media-tracking-service-refactored/__tests__/MediaTrackingService.test.ts"
  "services/filter-service-refactored/__tests__/FilterService.test.ts"
  "services/logger-refactored/__tests__/LoggerService.test.ts"
)

echo "=== SERVICES WITH GOOD COVERAGE ==="
TOTAL_PASSING=0
TOTAL_TESTS=0

for TEST_FILE in "${GOOD_SERVICES[@]}"; do
  if [ -f "$TEST_FILE" ]; then
    SERVICE_NAME=$(basename $(dirname $(dirname "$TEST_FILE")))
    echo "Testing $SERVICE_NAME..."
    
    # Run test and capture results
    RESULT=$(pnpm test "$TEST_FILE" 2>&1)
    
    # Extract pass/fail counts
    PASS_COUNT=$(echo "$RESULT" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
    FAIL_COUNT=$(echo "$RESULT" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
    TOTAL_COUNT=$(echo "$RESULT" | grep -oE "Tests.*[0-9]+ failed \| [0-9]+ passed \([0-9]+\)" | grep -oE "\([0-9]+\)" | tr -d "()")
    
    # Handle case where all tests pass (no failed count)
    if [ -z "$FAIL_COUNT" ]; then
      FAIL_COUNT=0
    fi
    if [ -z "$PASS_COUNT" ]; then
      PASS_COUNT=0
    fi
    if [ -z "$TOTAL_COUNT" ]; then
      TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))
    fi
    
    if [ "$FAIL_COUNT" -eq 0 ] && [ "$PASS_COUNT" -gt 0 ]; then
      echo "  ✅ $SERVICE_NAME: $PASS_COUNT/$TOTAL_COUNT tests passing (100%)"
    elif [ "$TOTAL_COUNT" -gt 0 ]; then
      PASS_RATE=$((PASS_COUNT * 100 / TOTAL_COUNT))
      echo "  🟡 $SERVICE_NAME: $PASS_COUNT/$TOTAL_COUNT tests passing ($PASS_RATE%)"
    else
      echo "  ❌ $SERVICE_NAME: No valid test results"
    fi
    
    TOTAL_PASSING=$((TOTAL_PASSING + PASS_COUNT))
    TOTAL_TESTS=$((TOTAL_TESTS + TOTAL_COUNT))
  fi
done

echo ""
echo "=== SERVICES WITH PARTIAL COVERAGE ==="

for TEST_FILE in "${PARTIAL_SERVICES[@]}"; do
  if [ -f "$TEST_FILE" ]; then
    SERVICE_NAME=$(basename $(dirname $(dirname "$TEST_FILE")))
    echo "Testing $SERVICE_NAME..."
    
    # Run test and capture results
    RESULT=$(pnpm test "$TEST_FILE" 2>&1)
    
    # Extract pass/fail counts
    PASS_COUNT=$(echo "$RESULT" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
    FAIL_COUNT=$(echo "$RESULT" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
    TOTAL_COUNT=$(echo "$RESULT" | grep -oE "Tests.*[0-9]+ failed \| [0-9]+ passed \([0-9]+\)" | grep -oE "\([0-9]+\)" | tr -d "()")
    
    # Handle missing counts
    if [ -z "$FAIL_COUNT" ]; then
      FAIL_COUNT=0
    fi
    if [ -z "$PASS_COUNT" ]; then
      PASS_COUNT=0
    fi
    if [ -z "$TOTAL_COUNT" ]; then
      TOTAL_COUNT=$((PASS_COUNT + FAIL_COUNT))
    fi
    
    if [ "$TOTAL_COUNT" -gt 0 ]; then
      PASS_RATE=$((PASS_COUNT * 100 / TOTAL_COUNT))
      if [ "$PASS_RATE" -ge 80 ]; then
        echo "  🟡 $SERVICE_NAME: $PASS_COUNT/$TOTAL_COUNT tests passing ($PASS_RATE%)"
      elif [ "$PASS_RATE" -ge 50 ]; then
        echo "  🟠 $SERVICE_NAME: $PASS_COUNT/$TOTAL_COUNT tests passing ($PASS_RATE%)"
      else
        echo "  🔴 $SERVICE_NAME: $PASS_COUNT/$TOTAL_COUNT tests passing ($PASS_RATE%)"
      fi
    else
      echo "  ❌ $SERVICE_NAME: No valid test results"
    fi
    
    TOTAL_PASSING=$((TOTAL_PASSING + PASS_COUNT))
    TOTAL_TESTS=$((TOTAL_TESTS + TOTAL_COUNT))
  fi
done

echo ""
echo "=== OVERALL SUMMARY ==="
if [ "$TOTAL_TESTS" -gt 0 ]; then
  OVERALL_RATE=$((TOTAL_PASSING * 100 / TOTAL_TESTS))
  echo "Total: $TOTAL_PASSING/$TOTAL_TESTS tests passing ($OVERALL_RATE%)"
else
  echo "No tests found"
fi

echo ""
echo "=== SERVICES WITHOUT TESTS ==="
echo "The following refactored services still need test files:"

# Find all refactored services without tests
for SERVICE_DIR in services/*-refactored/; do
  if [ -d "$SERVICE_DIR" ]; then
    SERVICE_NAME=$(basename "$SERVICE_DIR")
    if [ ! -d "${SERVICE_DIR}__tests__" ] || [ -z "$(ls -A ${SERVICE_DIR}__tests__/*.test.ts 2>/dev/null)" ]; then
      echo "  📝 $SERVICE_NAME"
    fi
  fi
done

echo ""
echo "Test infrastructure is ready for CI/CD integration!"