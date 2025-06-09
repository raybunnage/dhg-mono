#!/bin/bash

# Continuous Documentation CLI Pipeline
# Automates documentation monitoring and updates

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Source the tracking functions if available
TRACKING_FILE="../../../scripts/cli-pipeline/all_pipelines/tracking-functions.sh"
if [ -f "$TRACKING_FILE" ]; then
    source "$TRACKING_FILE"
else
    # Fallback if tracking not available
    track_command() {
        echo "Note: Command tracking not available"
    }
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run TypeScript files
run_ts() {
    ts-node --transpile-only "$@"
}

# Display help
show_help() {
    echo "Continuous Documentation CLI Pipeline"
    echo "======================================"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  check-updates       Check for documentation that needs updating"
    echo "  process-updates     Process and update documentation"
    echo "  sync-status        Sync monitoring status with database"
    echo "  schedule-checks    Set up scheduled monitoring"
    echo "  list-monitored     List all monitored documentation"
    echo "  add-monitor        Add documentation to monitoring"
    echo "  remove-monitor     Remove documentation from monitoring"
    echo "  generate-report    Generate monitoring report"
    echo "  health-check       Check pipeline health"
    echo "  help              Show this help message"
    echo ""
}

case "$1" in
    check-updates)
        track_command "continuous_docs" "check-updates"
        echo -e "${GREEN}Checking for documentation updates...${NC}"
        run_ts commands/check-updates.ts "${@:2}"
        ;;
        
    process-updates)
        track_command "continuous_docs" "process-updates"
        echo -e "${GREEN}Processing documentation updates...${NC}"
        run_ts commands/process-updates.ts "${@:2}"
        ;;
        
    sync-status)
        track_command "continuous_docs" "sync-status"
        echo -e "${GREEN}Syncing monitoring status with database...${NC}"
        run_ts commands/sync-status.ts "${@:2}"
        ;;
        
    schedule-checks)
        track_command "continuous_docs" "schedule-checks"
        echo -e "${GREEN}Setting up scheduled monitoring...${NC}"
        run_ts commands/schedule-checks.ts "${@:2}"
        ;;
        
    list-monitored)
        track_command "continuous_docs" "list-monitored"
        echo -e "${GREEN}Listing monitored documentation...${NC}"
        run_ts commands/list-monitored.ts "${@:2}"
        ;;
        
    add-monitor)
        track_command "continuous_docs" "add-monitor"
        echo -e "${GREEN}Adding documentation to monitoring...${NC}"
        run_ts commands/add-monitor.ts "${@:2}"
        ;;
        
    remove-monitor)
        track_command "continuous_docs" "remove-monitor"
        echo -e "${GREEN}Removing documentation from monitoring...${NC}"
        run_ts commands/remove-monitor.ts "${@:2}"
        ;;
        
    generate-report)
        track_command "continuous_docs" "generate-report"
        echo -e "${GREEN}Generating monitoring report...${NC}"
        run_ts commands/generate-report.ts "${@:2}"
        ;;
        
    health-check)
        track_command "continuous_docs" "health-check"
        echo -e "${GREEN}Checking pipeline health...${NC}"
        run_ts utilities/health-check.ts
        ;;
        
    help|--help|-h|"")
        show_help
        ;;
        
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac