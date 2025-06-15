#!/bin/bash

# Script to run all tests for refactored services
# This will test all services that were refactored and have test files

echo "🧪 Running tests for all refactored services..."
echo "================================================"

# Initialize counters
TOTAL_SERVICES=0
PASSED_SERVICES=0
FAILED_SERVICES=0
SERVICES_WITH_TESTS=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Array of refactored services with tests
declare -a REFACTORED_SERVICES=(
    "ai-processing-service-refactored"
    "audio-proxy-refactored"
    "audio-service-refactored"
    "audio-transcription-refactored"
    "auth-service-refactored"
    "batch-processing-service-refactored"
    "claude-service-refactored"
    "cli-registry-service-refactored"
    "converter-service-refactored"
    "database-service-refactored"
    "filter-service-refactored"
    "folder-hierarchy-service-refactored"
    "formatter-service-refactored"
    "google-auth-refactored"
    "google-drive-explorer-refactored"
    "google-drive-refactored"
    "google-drive-sync-service-refactored"
    "logger-refactored"
    "media-tracking-service-refactored"
    "prompt-service-refactored"
    "proxy-server-base-service-refactored"
    "sources-google-update-service-refactored"
    "supabase-adapter-refactored"
    "supabase-client-refactored"
    "supabase-service-refactored"
    "task-service-refactored"
    "unified-classification-service-refactored"
    "user-profile-service-refactored"
)

# Additional services that might have been added
declare -a ADDITIONAL_SERVICES=(
    "batch-database-service-refactored"
    "deployment-service-refactored"
    "document-service-refactored"
    "element-catalog-service-refactored"
    "element-criteria-service-refactored"
    "env-config-service-refactored"
    "file-service-refactored"
    "file-system-service-refactored"
    "html-file-browser-refactored"
    "markdown-viewer-refactored"
    "media-analytics-service-refactored"
    "pdf-processor-service-refactored"
    "script-viewer-refactored"
    "worktree-switcher-refactored"
)

# Combine all services
ALL_SERVICES=("${REFACTORED_SERVICES[@]}" "${ADDITIONAL_SERVICES[@]}")

# Function to run tests for a service
run_service_tests() {
    local service_name=$1
    local service_path="packages/shared/services/$service_name"
    
    TOTAL_SERVICES=$((TOTAL_SERVICES + 1))
    
    # Check if service directory exists
    if [ ! -d "$service_path" ]; then
        echo -e "${YELLOW}⚠️  Service directory not found: $service_name${NC}"
        return
    fi
    
    # Check if test directory exists
    if [ ! -d "$service_path/__tests__" ]; then
        echo -e "${YELLOW}⚠️  No tests found for: $service_name${NC}"
        return
    fi
    
    SERVICES_WITH_TESTS=$((SERVICES_WITH_TESTS + 1))
    
    echo -e "\n📦 Testing: ${YELLOW}$service_name${NC}"
    echo "----------------------------------------"
    
    # Run tests using vitest
    cd "$service_path" || return
    
    # Run vitest with coverage
    if npx vitest run --reporter=verbose 2>&1; then
        echo -e "${GREEN}✅ PASSED: $service_name${NC}"
        PASSED_SERVICES=$((PASSED_SERVICES + 1))
    else
        echo -e "${RED}❌ FAILED: $service_name${NC}"
        FAILED_SERVICES=$((FAILED_SERVICES + 1))
    fi
    
    # Return to root directory
    cd - > /dev/null
}

# Main execution
echo "Starting test run at: $(date)"
echo "Testing ${#ALL_SERVICES[@]} refactored services..."
echo ""

# Run tests for each service
for service in "${ALL_SERVICES[@]}"; do
    run_service_tests "$service"
done

# Summary
echo -e "\n================================================"
echo -e "🏁 ${YELLOW}TEST SUMMARY${NC}"
echo "================================================"
echo -e "Total services checked: ${TOTAL_SERVICES}"
echo -e "Services with tests: ${SERVICES_WITH_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_SERVICES}${NC}"
echo -e "${RED}Failed: ${FAILED_SERVICES}${NC}"
echo -e "Services without tests: $((TOTAL_SERVICES - SERVICES_WITH_TESTS))"

# Calculate success rate
if [ $SERVICES_WITH_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_SERVICES * 100 / SERVICES_WITH_TESTS))
    echo -e "\nSuccess rate: ${SUCCESS_RATE}%"
fi

echo -e "\nCompleted at: $(date)"

# Exit with appropriate code
if [ $FAILED_SERVICES -gt 0 ]; then
    exit 1
else
    exit 0
fi