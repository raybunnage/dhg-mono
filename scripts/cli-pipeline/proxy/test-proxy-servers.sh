#!/bin/bash

# Test script for proxy servers
# This script runs the proxy server tests from the packages/proxy-servers directory

set -e

echo "🧪 Testing Proxy Servers..."
echo "=========================="

# Navigate to proxy-servers package
cd packages/proxy-servers

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    pnpm install
fi

# Run tests
echo ""
echo "🏃 Running proxy server tests..."
echo ""

# Run health check tests first (quick validation)
echo "1️⃣ Running health check tests..."
pnpm vitest run tests/proxy-server-health.test.ts --reporter=verbose

# Run endpoint tests (more comprehensive)
echo ""
echo "2️⃣ Running endpoint tests..."
pnpm vitest run tests/proxy-server-endpoints.test.ts --reporter=verbose

# Run all tests with coverage if both pass
echo ""
echo "3️⃣ Running all tests with coverage..."
pnpm vitest run --coverage

echo ""
echo "✅ All proxy server tests completed!"
echo ""
echo "📊 Coverage report generated in packages/proxy-servers/coverage/"