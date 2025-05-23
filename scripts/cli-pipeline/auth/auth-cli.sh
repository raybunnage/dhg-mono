#!/bin/bash

# Auth Service CLI
# Provides command-line interface for authentication management
# Usage: ./auth-cli.sh [command] [options]

set -e

# Script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." &> /dev/null && pwd )"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.development" ]; then
  export $(cat "$PROJECT_ROOT/.env.development" | grep -v '^#' | xargs)
fi

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to print help
print_help() {
  echo "DHG Authentication CLI"
  echo ""
  echo "Usage: $0 [command] [options]"
  echo ""
  echo "Commands:"
  echo "  login                    Login with email and password"
  echo "  logout                   Logout current session"
  echo "  whoami                   Show current authenticated user"
  echo "  token create [name]      Create a new CLI authentication token"
  echo "  token list               List all CLI tokens"
  echo "  token revoke [id]        Revoke a CLI token"
  echo "  profile                  Show user profile"
  echo "  profile update           Update user profile"
  echo "  test                     Test authentication service"
  echo "  help                     Show this help message"
  echo ""
  echo "Options:"
  echo "  --api-key [key]          Use specific API key for authentication"
  echo "  --email [email]          Email for login"
  echo "  --password [password]    Password for login (use with caution)"
  echo ""
  echo "Examples:"
  echo "  $0 login"
  echo "  $0 token create my-automation"
  echo "  $0 whoami --api-key abc123"
}

# Function to track command execution
track_command() {
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Track command execution
  echo "🔵 Executing: auth $command_name"
  
  # Execute the command
  eval "$full_command"
}

# Login command
cmd_login() {
  echo "🔐 DHG Authentication - Login"
  echo ""
  
  # Get email
  if [ -z "$EMAIL" ]; then
    read -p "Email: " EMAIL
  fi
  
  # Get password (hidden input)
  if [ -z "$PASSWORD" ]; then
    read -s -p "Password: " PASSWORD
    echo ""
  fi
  
  # Run login command
  track_command "login" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts login --email \"$EMAIL\" --password \"$PASSWORD\""
}

# Logout command
cmd_logout() {
  echo "🔐 DHG Authentication - Logout"
  echo ""
  
  track_command "logout" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts logout"
}

# Whoami command
cmd_whoami() {
  echo "🔐 DHG Authentication - Current User"
  echo ""
  
  local api_key_arg=""
  if [ ! -z "$API_KEY" ]; then
    api_key_arg="--api-key \"$API_KEY\""
  fi
  
  track_command "whoami" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts whoami $api_key_arg"
}

# Create token command
cmd_token_create() {
  local token_name="$1"
  
  if [ -z "$token_name" ]; then
    read -p "Token name: " token_name
  fi
  
  echo "🔐 DHG Authentication - Create Token"
  echo ""
  
  track_command "token-create" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts token-create \"$token_name\""
}

# List tokens command
cmd_token_list() {
  echo "🔐 DHG Authentication - List Tokens"
  echo ""
  
  track_command "token-list" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts token-list"
}

# Revoke token command
cmd_token_revoke() {
  local token_id="$1"
  
  if [ -z "$token_id" ]; then
    # Show token list first
    cmd_token_list
    echo ""
    read -p "Token ID to revoke: " token_id
  fi
  
  echo "🔐 DHG Authentication - Revoke Token"
  echo ""
  
  track_command "token-revoke" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts token-revoke \"$token_id\""
}

# Show profile command
cmd_profile() {
  echo "🔐 DHG Authentication - User Profile"
  echo ""
  
  track_command "profile" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts profile"
}

# Update profile command
cmd_profile_update() {
  echo "🔐 DHG Authentication - Update Profile"
  echo ""
  
  read -p "Full name (leave empty to skip): " full_name
  
  local name_arg=""
  if [ ! -z "$full_name" ]; then
    name_arg="--name \"$full_name\""
  fi
  
  track_command "profile-update" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts profile-update $name_arg"
}

# Test command
cmd_test() {
  echo "🔐 DHG Authentication - Service Test"
  echo ""
  
  track_command "test" "cd $PROJECT_ROOT && npx ts-node $SCRIPT_DIR/auth-cli-commands.ts test"
}

# Parse command line arguments
COMMAND=""
API_KEY=""
EMAIL=""
PASSWORD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key)
      API_KEY="$2"
      shift 2
      ;;
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    login|logout|whoami|profile|test|help)
      COMMAND="$1"
      shift
      ;;
    token)
      COMMAND="token"
      SUBCOMMAND="$2"
      shift 2
      ;;
    *)
      # Unknown option or argument
      if [ -z "$COMMAND" ]; then
        COMMAND="$1"
      fi
      shift
      ;;
  esac
done

# Execute the appropriate command
case $COMMAND in
  login)
    cmd_login
    ;;
  logout)
    cmd_logout
    ;;
  whoami)
    cmd_whoami
    ;;
  token)
    case $SUBCOMMAND in
      create)
        cmd_token_create "$@"
        ;;
      list)
        cmd_token_list
        ;;
      revoke)
        cmd_token_revoke "$@"
        ;;
      *)
        print_color $RED "Unknown token command: $SUBCOMMAND"
        echo ""
        print_help
        exit 1
        ;;
    esac
    ;;
  profile)
    if [ "$2" = "update" ]; then
      cmd_profile_update
    else
      cmd_profile
    fi
    ;;
  test)
    cmd_test
    ;;
  help|"")
    print_help
    ;;
  *)
    print_color $RED "Unknown command: $COMMAND"
    echo ""
    print_help
    exit 1
    ;;
esac