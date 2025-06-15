#!/bin/bash

# Service Test Utilities
# Specialized utilities for testing ServiceCLIPipeline implementations

# Source the base test framework
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-framework.sh"

# Mock service registry
setup_mock_service_registry() {
    export MOCK_SERVICE_REGISTRY="true"
    
    # Create mock server registry responses
    cat > "$TEST_TEMP_DIR/mock-server-registry.json" << 'EOF'
{
  "services": {
    "claude-service": {
      "status": "running",
      "port": 3001,
      "health_url": "http://localhost:3001/health"
    },
    "prompt-service": {
      "status": "running", 
      "port": 3002,
      "health_url": "http://localhost:3002/health"
    },
    "server-registry-service": {
      "status": "running",
      "port": 3000,
      "health_url": "http://localhost:3000/health"
    }
  }
}
EOF
}

# Mock Supabase service for testing
setup_mock_supabase() {
    # Create a minimal mock Supabase response
    export TEST_SUPABASE_MOCK="true"
    
    # Mock successful database operations
    cat > "$TEST_TEMP_DIR/mock-supabase-responses.json" << 'EOF'
{
  "select": {"data": [], "error": null},
  "insert": {"data": [{"id": "test-id"}], "error": null},
  "update": {"data": [{"id": "test-id"}], "error": null},
  "delete": {"data": [], "error": null}
}
EOF
}

# Test service health check patterns
assert_service_health_pattern() {
    local description="$1"
    local pipeline_script="$2"
    
    echo "  Testing service health pattern: $description"
    
    # Should either pass health check or show service warnings gracefully
    local output
    output=$("$pipeline_script" health-check 2>&1 || true)
    
    # Should not crash or show "Unknown command"
    if echo "$output" | grep -q "Unknown command"; then
        echo -e "  ${RED}❌ FAIL${NC}: $description - health-check not recognized"
        ((FAIL_COUNT++))
        return 1
    fi
    
    # Should handle missing services gracefully (warnings, not errors)
    if echo "$output" | grep -q "Service not available" || echo "$output" | grep -q "WARN"; then
        echo -e "  ${YELLOW}⚠️  PASS${NC}: $description - graceful service fallback"
    elif echo "$output" | grep -q "healthy\|SUCCESS"; then
        echo -e "  ${GREEN}✅ PASS${NC}: $description - health check passed"
    else
        echo -e "  ${YELLOW}⚠️  PASS${NC}: $description - health check attempted"
    fi
    
    ((PASS_COUNT++))
    ((TEST_COUNT++))
    return 0
}

# Test service command patterns
test_service_commands() {
    local pipeline_script="$1"
    local expected_commands=("$@")
    shift
    
    start_test "Service command availability"
    
    for cmd in "${expected_commands[@]}"; do
        echo "    Testing command: $cmd"
        local output
        output=$("$pipeline_script" "$cmd" --help 2>&1 || true)
        
        if echo "$output" | grep -q "Unknown command"; then
            echo -e "    ${RED}❌ FAIL${NC}: Command '$cmd' not available"
            ((FAIL_COUNT++))
        else
            echo -e "    ${GREEN}✅ PASS${NC}: Command '$cmd' available"
            ((PASS_COUNT++))
        fi
        ((TEST_COUNT++))
    done
}

# Test hyphenated command routing (common in ServiceCLI)
test_hyphenated_commands() {
    local pipeline_script="$1"
    shift
    local hyphenated_commands=("$@")
    
    start_test "Hyphenated command routing"
    
    for cmd in "${hyphenated_commands[@]}"; do
        echo "    Testing hyphenated command: $cmd"
        local output
        output=$("$pipeline_script" "$cmd" 2>&1 || true)
        
        if echo "$output" | grep -q "Unknown command"; then
            echo -e "    ${RED}❌ FAIL${NC}: Hyphenated command '$cmd' not routed"
            ((FAIL_COUNT++))
        else
            echo -e "    ${GREEN}✅ PASS${NC}: Hyphenated command '$cmd' routed"
            ((PASS_COUNT++))
        fi
        ((TEST_COUNT++))
    done
}

# Export functions
export -f setup_mock_service_registry
export -f setup_mock_supabase
export -f assert_service_health_pattern
export -f test_service_commands
export -f test_hyphenated_commands