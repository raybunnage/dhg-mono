#!/bin/bash
# Script to create a general document type with automatic name from category

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Function to load environment variables
load_environment() {
  # Load environment variables from .env files in project root
  for env_file in "$PROJECT_ROOT/.env" "$PROJECT_ROOT/.env.local" "$PROJECT_ROOT/.env.development"; do
    if [ -f "$env_file" ]; then
      echo "Loading environment variables from $env_file"
      set -o allexport
      source "$env_file"
      set +o allexport
    fi
  done
}

# Load environment variables
load_environment

# Check if category is provided
if [ -z "$1" ]; then
  echo "Error: Category is required"
  echo "Usage: $0 <category> [--description \"description\"] [--mnemonic \"code\"] [--ai-generated] [--dry-run]"
  exit 1
fi

# Set category as the first argument
CATEGORY="$1"
shift

# Prepare arguments for create command
ARGS="--name \"$CATEGORY\" --category \"$CATEGORY\" --general-type"

# Process remaining arguments
while [ "$#" -gt 0 ]; do
  case "$1" in
    --description)
      ARGS="$ARGS --description \"$2\""
      shift 2
      ;;
    --mnemonic)
      ARGS="$ARGS --mnemonic \"$2\""
      shift 2
      ;;
    --ai-generated)
      ARGS="$ARGS --ai-generated"
      shift
      ;;
    --dry-run)
      ARGS="$ARGS --dry-run"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Execute the create command
echo "Creating general document type for category: $CATEGORY"
echo "Executing: ./document-types-cli.sh create $ARGS"
cd "$SCRIPT_DIR" && eval "./document-types-cli.sh create $ARGS"