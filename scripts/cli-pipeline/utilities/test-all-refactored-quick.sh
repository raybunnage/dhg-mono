#!/bin/bash

# Quick test summary for all refactored services
echo "🧪 Quick Test Summary for Refactored Services"
echo "=============================================="
echo ""

cd packages/shared || exit 1

# Run all tests with the proper config
echo "Running all refactored service tests..."
npx vitest run "services/*-refactored/**/*.test.ts" "services/*/refactored/**/*.test.ts" --config ./vitest.config.ts --reporter=default 2>&1 | tail -20