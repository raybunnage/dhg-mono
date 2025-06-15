#!/bin/bash

# Test Proxy Servers
# This script runs the proxy server test harness

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🧪 Running Proxy Server Test Harness"
echo "===================================="
echo

# Check if specific servers were requested
if [ $# -gt 0 ]; then
    echo "Testing specific servers: $@"
    npx ts-node "$PROJECT_ROOT/packages/proxy-servers/tests/proxy-server-test-harness.ts" "$@"
else
    echo "Testing all proxy servers..."
    npx ts-node "$PROJECT_ROOT/packages/proxy-servers/tests/proxy-server-test-harness.ts"
fi