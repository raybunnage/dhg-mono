#!/usr/bin/env bash

# Simplified Continuous Development CLI
# Purpose: Track manual execution of common development scenarios
# Complexity removed: 2025-06-15 (see .archived/2025-06-15_continuous_complexity_removal/)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Available scenarios (kept simple on purpose)
SCENARIOS=(
    "add-proxy-server"
    "create-shared-service"
    "add-database-table"
    "remove-complexity"
)

show_help() {
    echo "Continuous Development CLI (Simplified)"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                    List available scenarios"
    echo "  run <scenario>          Start a scenario (opens documentation)"
    echo "  done                    Mark scenario complete and log results"
    echo "  help                    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 run add-proxy-server"
    echo "  $0 done"
    echo ""
    echo "Philosophy: Start simple, track usage, add complexity only when proven needed."
}

list_scenarios() {
    echo -e "${GREEN}Available Development Scenarios:${NC}"
    echo ""
    for i in "${!SCENARIOS[@]}"; do
        echo "  $((i+1)). ${SCENARIOS[$i]}"
        if [[ -f "$PROJECT_ROOT/docs/continuous-improvement/scenarios/${SCENARIOS[$i]}.md" ]]; then
            echo "     ✓ Documentation available"
        else
            echo "     ⚠ Documentation missing"
        fi
    done
    echo ""
    echo "For details on any scenario: $0 run <scenario-name>"
}

run_scenario() {
    local scenario=$1
    
    if [[ -z "$scenario" ]]; then
        echo -e "${RED}Error: Please specify a scenario${NC}"
        echo "Usage: $0 run <scenario-name>"
        list_scenarios
        return 1
    fi
    
    # Check if scenario exists
    if [[ ! " ${SCENARIOS[@]} " =~ " ${scenario} " ]]; then
        echo -e "${RED}Error: Unknown scenario '${scenario}'${NC}"
        list_scenarios
        return 1
    fi
    
    local doc_path="$PROJECT_ROOT/docs/continuous-improvement/scenarios/${scenario}.md"
    
    echo -e "${GREEN}Starting scenario: ${scenario}${NC}"
    echo ""
    
    if [[ -f "$doc_path" ]]; then
        echo "📋 Documentation: $doc_path"
        echo ""
        echo "Steps to follow:"
        echo "1. Open the documentation file above"
        echo "2. Follow the checklist step-by-step"
        echo "3. Track your time"
        echo "4. Run '$0 done' when complete"
        echo ""
        echo -e "${YELLOW}⏱️  Timer started at: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
        
        # Save start time for later
        echo "$(date '+%s')" > "$SCRIPT_DIR/.scenario_start_time"
        echo "$scenario" > "$SCRIPT_DIR/.scenario_name"
    else
        echo -e "${RED}Error: Documentation not found at $doc_path${NC}"
        echo "This scenario needs documentation before it can be run."
        return 1
    fi
}

complete_scenario() {
    if [[ ! -f "$SCRIPT_DIR/.scenario_start_time" ]]; then
        echo -e "${RED}Error: No scenario in progress${NC}"
        echo "Start a scenario first with: $0 run <scenario-name>"
        return 1
    fi
    
    local start_time=$(cat "$SCRIPT_DIR/.scenario_start_time")
    local scenario_name=$(cat "$SCRIPT_DIR/.scenario_name" 2>/dev/null || echo "unknown")
    local end_time=$(date '+%s')
    local duration=$(( (end_time - start_time) / 60 ))
    
    echo -e "${GREEN}Completing scenario: ${scenario_name}${NC}"
    echo ""
    echo "Duration: ${duration} minutes"
    echo ""
    
    # Simple success/failure tracking
    echo -n "Was it successful? (y/n): "
    read success
    
    echo -n "Any notes? (optional): "
    read notes
    
    # Log to simple JSON file (no database complexity)
    local log_file="$PROJECT_ROOT/.continuous/scenario-attempts.json"
    mkdir -p "$PROJECT_ROOT/.continuous"
    
    # Create file if it doesn't exist
    if [[ ! -f "$log_file" ]]; then
        echo "[]" > "$log_file"
    fi
    
    # Append new entry (simple bash JSON handling)
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local success_bool="false"
    [[ "$success" == "y" ]] && success_bool="true"
    
    # Simple JSON append (good enough for our needs)
    echo "{
  \"scenario\": \"$scenario_name\",
  \"timestamp\": \"$timestamp\",
  \"duration_minutes\": $duration,
  \"success\": $success_bool,
  \"notes\": \"$notes\"
}" >> "$log_file.tmp"
    
    echo -e "${GREEN}✓ Scenario logged${NC}"
    
    # Clean up
    rm -f "$SCRIPT_DIR/.scenario_start_time"
    rm -f "$SCRIPT_DIR/.scenario_name"
    
    # Show summary
    echo ""
    echo "Summary:"
    echo "  Scenario: $scenario_name"
    echo "  Duration: $duration minutes"
    echo "  Success: $success"
    [[ -n "$notes" ]] && echo "  Notes: $notes"
}

# Main command routing
case "$1" in
    "list")
        list_scenarios
        ;;
    "run")
        run_scenario "$2"
        ;;
    "done")
        complete_scenario
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$1'${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac