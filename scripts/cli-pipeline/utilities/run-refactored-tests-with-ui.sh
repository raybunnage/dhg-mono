#!/bin/bash

# Script to run refactored service tests and launch the UI
# This provides both command-line output and a visual dashboard

echo "🔬 Refactored Service Test Runner"
echo "=================================="
echo ""
echo "This script will:"
echo "1. Run tests for all refactored services"
echo "2. Launch the dhg-service-test UI for visual monitoring"
echo ""

# Check if dhg-service-test is already running
if lsof -Pi :5180 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ dhg-service-test is already running on http://localhost:5180"
else
    echo "🚀 Starting dhg-service-test UI..."
    cd apps/dhg-service-test
    pnpm dev &
    DHG_PID=$!
    echo "Started dhg-service-test with PID: $DHG_PID"
    echo "Waiting for server to start..."
    sleep 3
    cd - > /dev/null
fi

echo ""
echo "📊 Opening test dashboard in browser..."
open "http://localhost:5180"

echo ""
echo "🧪 Running refactored service tests..."
echo "----------------------------------------"

# Run the actual test script
./scripts/cli-pipeline/utilities/run-all-refactored-service-tests.sh

echo ""
echo "✅ Test run complete!"
echo ""
echo "View detailed results at: http://localhost:5180"
echo "Navigate to: 🔬 Refactored Service Tests"
echo ""
echo "To stop the UI server, run: kill $DHG_PID"