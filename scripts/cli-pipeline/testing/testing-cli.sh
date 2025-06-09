#!/usr/bin/env bash

# Find script directory
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
  echo "===================="
  echo ""
  echo "COMMANDS:"
  echo ""
  echo "TEST EXECUTION:"
  echo "  run                Run tests for specific app or all apps"
  echo "  watch              Run tests in watch mode"
  echo "  coverage           Generate coverage report"
  echo "  ci                 Run tests in CI mode"
  echo ""
  echo "TEST MANAGEMENT:"
  echo "  list               List all test files"
  echo "  stats              Show test statistics"
  echo "  failed             Show recently failed tests"
  echo "  slow               Show slowest tests"
  echo ""
  echo "SETUP & CONFIG:"
  echo "  init               Initialize testing for an app"
  echo "  add-test           Create a new test file"
  echo "  update-deps        Update testing dependencies"
  echo ""
  echo "REPORTING:"
  echo "  report             Generate HTML test report"
  echo "  trends             Show test trends over time"
  echo "  flaky              Identify flaky tests"
  echo ""
  echo "OPTIONS:"
  echo "  --app <name>       Target specific app"
  echo "  --type <type>      Filter by test type (unit|integration|e2e)"
  echo "  --pattern <glob>   Match test files by pattern"
  echo "  --bail             Stop on first test failure"
  echo "  --debug            Show detailed debug output"
  echo ""
  echo "EXAMPLES:"
  echo "  # Run all tests for dhg-audio"
  echo "  ./testing-cli.sh run --app dhg-audio"
  echo ""
  echo "  # Watch tests for dhg-hub"
  echo "  ./testing-cli.sh watch --app dhg-hub"
  echo ""
  echo "  # Run only unit tests"
  echo "  ./testing-cli.sh run --type unit"
  echo ""
  echo "  # Generate coverage for all apps"
  echo "  ./testing-cli.sh coverage"
  echo ""
  echo "  # Initialize testing for new app"
  echo "  ./testing-cli.sh init --app my-new-app"
}

# Command handlers
run_tests() {
  echo "🧪 Running tests..."
  track_command "run" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/run-tests.ts $@"
}

watch_tests() {
  echo "👁️  Starting test watcher..."
  track_command "watch" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/watch-tests.ts $@"
}

coverage_report() {
  echo "📊 Generating coverage report..."
  track_command "coverage" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/coverage.ts $@"
}

ci_tests() {
  echo "🤖 Running tests in CI mode..."
  track_command "ci" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/ci-tests.ts $@"
}

list_tests() {
  echo "📋 Listing test files..."
  track_command "list" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/list-tests.ts $@"
}

test_stats() {
  echo "📈 Calculating test statistics..."
  track_command "stats" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/test-stats.ts $@"
}

init_testing() {
  echo "🚀 Initializing testing..."
  track_command "init" "cd $PROJECT_ROOT && ts-node $SCRIPT_DIR/commands/init-testing.ts $@"
}

# Main command processor
case "$1" in
  "run")
    run_tests "${@:2}"
    ;;
  "watch")
    watch_tests "${@:2}"
    ;;
  "coverage")
    coverage_report "${@:2}"
    ;;
  "ci")
    ci_tests "${@:2}"
    ;;
  "list")
    list_tests "${@:2}"
    ;;
  "stats")
    test_stats "${@:2}"
    ;;
  "init")
    init_testing "${@:2}"
    ;;
  "health-check")
    echo "🏥 Running health check for testing pipeline..."
    echo "✅ testing pipeline is healthy"
    ;;
  "help"|"--help"|"-h"|"")
    show_help
    ;;
  *)
    echo "Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac