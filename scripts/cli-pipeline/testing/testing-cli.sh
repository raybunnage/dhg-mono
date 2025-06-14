#!/usr/bin/env bash

# Testing CLI Pipeline
# Comprehensive testing for CLI pipelines

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Setup environment
cd "$PROJECT_ROOT" || exit 1
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Function to track commands
track_command() {
  local pipeline_name="testing"
  local command_name="$1"
  shift
  local full_command="$@"
  
  local TRACKER_TS="$PROJECT_ROOT/packages/shared/services/tracking-service/shell-command-tracker.ts"
  if [ -f "$TRACKER_TS" ]; then
    echo "🔍 Tracking command: $command_name"
    npx ts-node --project "$PROJECT_ROOT/tsconfig.node.json" "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Help message
show_help() {
  echo "Testing CLI Pipeline"
  echo "==================="
  echo ""
  echo "COMMANDS:"
  echo "  test-existence <pipeline>    Test command existence for a pipeline"
  echo "  test-priority [level]        Test priority pipelines (default: level 1)"
  echo "  test-pipeline <pipeline>     Run all tests for a specific pipeline"
  echo "  test-all                     Test all registered pipelines"
  echo "  coverage <pipeline>          Show test coverage for a pipeline"
  echo "  report                       Generate test report"
  echo "  health-check                 Check testing infrastructure health"
  echo ""
  echo "EXAMPLES:"
  echo "  ./testing-cli.sh test-existence database"
  echo "  ./testing-cli.sh test-priority 1"
  echo "  ./testing-cli.sh test-pipeline dev_tasks"
  echo "  ./testing-cli.sh coverage database"
  echo "  ./testing-cli.sh report"
  echo ""
  echo "PRIORITY LEVELS:"
  echo "  1 - Critical pipelines (database, dev_tasks, google_sync, document, ai)"
  echo "  2 - Core pipelines (auth, monitoring, deployment, servers, work_summaries)"
  echo "  3 - Support pipelines (docs, scripts, media_processing, email, presentations)"
}

# Main command handling
case "$1" in
  test-existence)
    if [ -z "$2" ]; then
      echo "❌ Pipeline name required"
      echo "Usage: $0 test-existence <pipeline-name>"
      exit 1
    fi
    track_command "test-existence" "ts-node $SCRIPT_DIR/commands/test-command-existence.ts $2"
    ;;
    
  test-priority)
    LEVEL="${2:-1}"
    track_command "test-priority" "ts-node $SCRIPT_DIR/commands/test-priority-pipelines.ts $LEVEL"
    ;;
    
  test-pipeline)
    if [ -z "$2" ]; then
      echo "❌ Pipeline name required"
      echo "Usage: $0 test-pipeline <pipeline-name>"
      exit 1
    fi
    echo "🧪 Running comprehensive tests for $2..."
    track_command "test-pipeline" "ts-node $SCRIPT_DIR/commands/test-command-existence.ts $2"
    # Add more test types as they're implemented
    ;;
    
  test-all)
    echo "🧪 Testing all registered pipelines..."
    track_command "test-all" "ts-node $SCRIPT_DIR/commands/test-all-pipelines.ts"
    ;;
    
  coverage)
    if [ -z "$2" ]; then
      echo "❌ Pipeline name required"
      echo "Usage: $0 coverage <pipeline-name>"
      exit 1
    fi
    track_command "coverage" "ts-node $SCRIPT_DIR/commands/show-coverage.ts $2"
    ;;
    
  report)
    echo "📊 Generating test report..."
    track_command "report" "ts-node $SCRIPT_DIR/commands/generate-report.ts"
    ;;
    
  health-check)
    echo "🏥 Checking testing infrastructure..."
    track_command "health-check" "ts-node $SCRIPT_DIR/commands/health-check.ts"
    ;;
    
  help|--help)
    show_help
    ;;
    
  *)
    echo "❌ Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac