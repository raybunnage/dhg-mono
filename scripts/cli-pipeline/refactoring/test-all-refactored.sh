#!/bin/bash

echo "Running tests for all refactored services..."
echo "============================================"

cd packages/shared

# Run tests and capture results
TEST_OUTPUT=$(pnpm test services/*-refactored/__tests__/*.test.ts 2>&1)

# Extract summary
echo "$TEST_OUTPUT" | grep -E "(Test Files|Tests)" | tail -2

echo ""
echo "Per-service breakdown:"
echo "====================="

# Get list of all test files
for TEST_FILE in services/*-refactored/__tests__/*.test.ts; do
  if [ -f "$TEST_FILE" ]; then
    SERVICE_NAME=$(basename $(dirname $(dirname "$TEST_FILE")))
    
    # Run individual test to get pass/fail count
    RESULT=$(pnpm test "$TEST_FILE" 2>&1 | grep -E "(✓|✗|PASS|FAIL|passed|failed)" | tail -1)
    
    if echo "$RESULT" | grep -q "PASS\|passed"; then
      echo "✅ $SERVICE_NAME: PASSING"
    else
      # Extract fail count
      FAIL_COUNT=$(echo "$RESULT" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
      echo "❌ $SERVICE_NAME: $FAIL_COUNT tests failing"
    fi
  fi
done

echo ""
echo "Services needing attention:"
echo "=========================="
echo "$TEST_OUTPUT" | grep "FAIL " | grep -oE "services/[^/]+/" | sort | uniq | sed 's|services/||' | sed 's|/||'