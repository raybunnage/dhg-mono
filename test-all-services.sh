#!/bin/bash

echo "🧪 Testing All Refactored Services"
echo "================================="

services=(
  "auth-service-refactored"
  "filter-service-refactored" 
  "google-drive-refactored"
  "google-auth-refactored"
  "task-service-refactored"
  "unified-classification-service-refactored"
  "user-profile-service-refactored"
  "prompt-service-refactored"
)

total_services=0
passed_services=0
total_tests=0
passed_tests=0

for service in "${services[@]}"; do
  if [ -f "packages/shared/services/$service/"*.test.ts ]; then
    echo ""
    echo "📋 Testing $service..."
    total_services=$((total_services + 1))
    
    # Run vitest and capture results
    result=$(npx vitest run "packages/shared/services/$service/"*.test.ts --config ./vitest.config.ts --reporter=basic 2>/dev/null | grep -E "Test Files|Tests" | tail -2)
    
    if echo "$result" | grep -q "passed"; then
      passed_services=$((passed_services + 1))
      echo "✅ $service: PASSED"
      
      # Extract test counts  
      test_counts=$(echo "$result" | grep "Tests" | grep -o '[0-9]* passed' | head -1)
      if [[ $test_counts =~ ([0-9]+) ]]; then
        service_tests=${BASH_REMATCH[1]}
        total_tests=$((total_tests + service_tests))
        passed_tests=$((passed_tests + service_tests))
      fi
    else
      echo "❌ $service: FAILED"
      echo "$result"
    fi
  else
    echo "⚠️  $service: No test file found"
  fi
done

echo ""
echo "📊 Summary:"
echo "==========="
echo "Services: $passed_services/$total_services passed"
echo "Tests: $passed_tests/$total_tests passed"
echo ""