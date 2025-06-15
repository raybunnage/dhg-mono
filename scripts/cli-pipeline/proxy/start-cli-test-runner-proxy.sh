#!/bin/bash

# Start CLI Test Runner Proxy Server
# Port: 9890

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🧪 Starting CLI Test Runner Proxy Server on port 9890..."

# Source environment if available
if [[ -f "$PROJECT_ROOT/.env.development" ]]; then
    export $(cat "$PROJECT_ROOT/.env.development" | grep -v '^#' | xargs)
fi

# Compile and run the proxy server
cd "$PROJECT_ROOT"
npx ts-node packages/shared/services/proxy-servers/cli-test-runner-proxy.ts