#!/usr/bin/env bash

# Servers Management CLI Pipeline
# Manages backend server lifecycle with dynamic port allocation

SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Setup environment
cd "$PROJECT_ROOT" || exit 1
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Function to track commands
track_command() {
  local pipeline_name="servers"
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
  echo "Servers Management CLI"
  echo "====================="
  echo ""
  echo "COMMANDS:"
  echo "  start         Start all servers with dynamic ports"
  echo "  stop          Stop all running servers"
  echo "  kill          Force kill all server processes"
  echo "  restart       Restart all servers"
  echo "  status        Show server status and ports"
  echo "  health        Check health of all servers"
  echo "  list          List registered servers"
  echo "  register      Register a new server"
  echo "  register-table Register sys_server_ports_registry in sys_table_definitions"
  echo "  update-port   Update server port"
  echo "  logs          Show server logs"
  echo ""
  echo "EXAMPLES:"
  echo "  ./servers-cli.sh start"
  echo "  ./servers-cli.sh status"
  echo "  ./servers-cli.sh health"
  echo "  ./servers-cli.sh stop"
  echo ""
  echo "SHORTCUTS:"
  echo "  You can also use: pnpm servers"
}

# Main command dispatcher
case "$1" in
  "start")
    echo "🚀 Starting all servers with dynamic port allocation..."
    track_command "start" "node $PROJECT_ROOT/scripts/start-all-servers-dynamic.js"
    ;;
    
  "stop")
    echo "🛑 Stopping all servers..."
    track_command "stop" "ts-node $SCRIPT_DIR/commands/stop-all-servers.ts"
    ;;
    
  "kill")
    echo "💀 Force killing all servers..."
    track_command "kill" "$SCRIPT_DIR/kill-all-servers.sh"
    ;;
    
  "restart")
    echo "🔄 Restarting all servers..."
    track_command "restart" "ts-node $SCRIPT_DIR/commands/restart-servers.ts"
    ;;
    
  "status")
    echo "📊 Server Status"
    track_command "status" "ts-node $SCRIPT_DIR/commands/show-status.ts"
    ;;
    
  "health")
    echo "🏥 Checking server health..."
    track_command "health" "ts-node $SCRIPT_DIR/commands/check-health.ts"
    ;;
    
  "list")
    echo "📋 Registered Servers"
    track_command "list" "ts-node $SCRIPT_DIR/commands/list-servers.ts"
    ;;
    
  "register")
    if [ -z "$2" ]; then
      echo "❌ Error: Server name required"
      echo "Usage: $0 register <server-name> [options]"
      exit 1
    fi
    track_command "register" "ts-node $SCRIPT_DIR/commands/register-server.ts $2 ${@:3}"
    ;;
    
  "update-port")
    if [ -z "$2" ] || [ -z "$3" ]; then
      echo "❌ Error: Server name and port required"
      echo "Usage: $0 update-port <server-name> <port>"
      exit 1
    fi
    track_command "update-port" "ts-node $SCRIPT_DIR/commands/update-port.ts $2 $3"
    ;;
    
  "logs")
    server_name="$2"
    if [ -n "$server_name" ]; then
      echo "📜 Logs for $server_name"
      track_command "logs" "ts-node $SCRIPT_DIR/commands/show-logs.ts $server_name"
    else
      echo "📜 All server logs"
      track_command "logs" "ts-node $SCRIPT_DIR/commands/show-logs.ts"
    fi
    ;;
    
  "register-table")
    echo "📝 Registering sys_server_ports_registry in sys_table_definitions..."
    track_command "register-table" "ts-node $SCRIPT_DIR/commands/register-table-simple.ts"
    ;;
    
  "help"|"--help"|"-h"|"")
    show_help
    ;;
    
  *)
    echo "❌ Unknown command: $1"
    echo ""
    show_help
    exit 1
    ;;
esac