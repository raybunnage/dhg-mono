#!/bin/bash

# Simple test runner for refactored services
# Runs tests from the packages/shared directory using the shared vitest config

echo "🧪 Running tests for refactored services..."
echo "================================================"

# Change to shared packages directory
cd packages/shared || exit 1

# Run all tests in refactored service directories
echo "Running vitest for all refactored services..."
npx vitest run services/*-refactored/**/*.test.ts --reporter=verbose

# Exit with vitest's exit code
exit $?