#!/bin/bash

# Master Health Check Script
# Runs health checks for all CLI pipelines

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Initialize counters
total=0
healthy=0
warnings=0
failures=0

echo -e "${BOLD}===== DHG MASTER HEALTH CHECK RESULTS =====${NC}"
echo ""
echo "Running health checks for all CLI pipelines..."
echo ""

# Function to run a health check
run_health_check() {
    local name="$1"
    local display_name="$2"
    local command="$3"
    
    ((total++))
    
    printf "%-25s" "$display_name:"
    
    # Run the health check command
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Healthy${NC}"
        ((healthy++))
    else
        # Check if it's a warning or failure
        local exit_code=$?
        if [ $exit_code -eq 2 ]; then
            echo -e "${YELLOW}⚠️  Warning${NC}"
            ((warnings++))
        else
            echo -e "${RED}❌ Unhealthy${NC}"
            ((failures++))
        fi
    fi
}

echo -e "${BOLD}DATA INTEGRATION:${NC}"
run_health_check "google_sync" "Google Sync" "$ROOT_DIR/scripts/cli-pipeline/google_sync/google-sync-cli.sh health-check"
run_health_check "drive_filter" "Drive Filter" "$ROOT_DIR/scripts/cli-pipeline/drive_filter/drive-filter-cli.sh health-check"

echo -e "\n${BOLD}CONTENT MANAGEMENT:${NC}"
run_health_check "document" "Document Processing" "$ROOT_DIR/scripts/cli-pipeline/document/health-check.sh"
run_health_check "experts" "Experts Management" "$ROOT_DIR/scripts/cli-pipeline/experts/health-check.sh"
run_health_check "document_types" "Document Types" "$ROOT_DIR/scripts/cli-pipeline/document_types/document-types-cli.sh health-check"
run_health_check "media_processing" "Media Processing" "$ROOT_DIR/scripts/cli-pipeline/media-processing/media-processing-cli.sh health-check"
run_health_check "presentations" "Presentations" "$ROOT_DIR/scripts/cli-pipeline/presentations/presentations-cli.sh health-check"
run_health_check "classify" "Classification" "$ROOT_DIR/scripts/cli-pipeline/classify/classify-cli.sh health-check"

echo -e "\n${BOLD}AI SERVICES:${NC}"
run_health_check "ai" "AI Service" "$ROOT_DIR/scripts/cli-pipeline/ai/ai-cli.sh health-check"
run_health_check "prompt_service" "Prompt Service" "$ROOT_DIR/scripts/cli-pipeline/prompt_service/prompt-service-cli.sh health-check"
run_health_check "analysis" "Script Analysis" "$ROOT_DIR/scripts/cli-pipeline/analysis/analysis-cli.sh health-check"

echo -e "\n${BOLD}DEVELOPMENT TOOLS:${NC}"
run_health_check "git" "Git Management" "$ROOT_DIR/scripts/cli-pipeline/git/git-cli.sh health-check"
run_health_check "git_workflow" "Git Workflow" "$ROOT_DIR/scripts/cli-pipeline/git_workflow/git-workflow-cli.sh health-check"
run_health_check "merge" "Merge Queue" "$ROOT_DIR/scripts/cli-pipeline/merge/merge-cli.sh health-check"
run_health_check "worktree" "Worktree Management" "$ROOT_DIR/scripts/cli-pipeline/worktree/worktree-cli.sh health-check"
run_health_check "dev_tasks" "Dev Tasks" "$ROOT_DIR/scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh health-check"

echo -e "\n${BOLD}SYSTEM MANAGEMENT:${NC}"
run_health_check "scripts" "Scripts Management" "$ROOT_DIR/scripts/cli-pipeline/scripts/scripts-cli.sh health-check"
run_health_check "auth" "Authentication" "$ROOT_DIR/scripts/cli-pipeline/auth/health-check.sh"
run_health_check "mime_types" "MIME Types" "$ROOT_DIR/scripts/cli-pipeline/mime_types/mime-types-cli.sh health-check"
run_health_check "refactor_tracking" "Refactor Tracking" "$ROOT_DIR/scripts/cli-pipeline/refactor_tracking/refactor-tracking-cli.sh health-check"
run_health_check "tracking" "Command Tracking" "$ROOT_DIR/scripts/cli-pipeline/tracking/tracking-cli.sh health-check"
run_health_check "monitoring" "Monitoring" "$ROOT_DIR/scripts/cli-pipeline/monitoring/monitoring-cli.sh health-check"
run_health_check "deprecation" "Deprecation Analysis" "$ROOT_DIR/scripts/cli-pipeline/deprecation/deprecation-cli.sh health-check"

echo -e "\n${BOLD}DOCUMENTATION:${NC}"
run_health_check "documentation" "Documentation" "$ROOT_DIR/scripts/cli-pipeline/documentation/documentation-cli.sh health-check"
run_health_check "work_summaries" "Work Summaries" "$ROOT_DIR/scripts/cli-pipeline/work_summaries/work-summaries-cli.sh health-check"

echo -e "\n${BOLD}INFRASTRUCTURE:${NC}"
# Skip Supabase check as it requires a different path
# run_health_check "supabase" "Supabase" "$ROOT_DIR/packages/shared/services/supabase-client/health-check.sh"
run_health_check "database" "Database" "$ROOT_DIR/scripts/cli-pipeline/database/health-check.sh"

# Calculate overall health percentage
if [ $total -gt 0 ]; then
    health_percentage=$(( (healthy * 100) / total ))
else
    health_percentage=0
fi

# Summary
echo ""
echo -e "${BOLD}📊 Health Check Summary:${NC}"
echo "===================="
echo -e "Total Pipelines: $total"
echo -e "Healthy: ${GREEN}$healthy${NC}"
echo -e "Warnings: ${YELLOW}$warnings${NC}"
echo -e "Failures: ${RED}$failures${NC}"
echo -e "Health Percentage: ${health_percentage}%"

echo ""
echo -e "${BOLD}📋 Overall Status:${NC}"
if [ $failures -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}✅ All systems healthy${NC}"
    exit 0
elif [ $failures -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Some systems need attention but all are functional${NC}"
    exit 0
else
    echo -e "${RED}❌ One or more systems are unhealthy${NC}"
    exit 1
fi