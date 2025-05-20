#!/bin/bash
# Experts CLI Pipeline
# Shell script wrapper for the Experts CLI utilities
#
# Available commands:
#   link-top-level-folders  List folders with videos for expert assignment
#   assign-expert           Assign an expert to a folder (interactive mode with -i)
#   assign-folder-experts   Interactively assign experts to high-level folders (path_depth = 0)
#   assign-multiple-experts Interactively assign multiple experts to individual folders
#   list-experts            List all experts with their mnemonics
#   add-expert              Add a new expert to the database
#   propagate-expert-ids    Recursively assign expert_id to all files under expert folders
#   transfer-expert-metadata Transfer processed_content from expert_documents to experts.metadata field
#   health-check            Check the health of the experts service infrastructure

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLI_DIR="$SCRIPT_DIR"
TRACKER_TS="${ROOT_DIR}/packages/shared/services/tracking-service/shell-command-tracker.ts"

# Function to execute a command with tracking
track_command() {
  local pipeline_name="experts"
  local command_name="$1"
  shift
  local full_command="$@"
  
  # Check if we have a TS tracking wrapper
  if [ -f "$TRACKER_TS" ]; then
    npx ts-node "$TRACKER_TS" "$pipeline_name" "$command_name" "$full_command"
  else
    # Fallback to direct execution without tracking
    echo "ℹ️ Tracking not available. Running command directly."
    eval "$full_command"
  fi
}

# Change to the project root directory (important for relative paths)
cd "$ROOT_DIR" || { echo "Error: Could not change to project root directory"; exit 1; }

# Use the first argument as the command name or default to "main"
COMMAND="${1:-main}"

# Special case for add-expert command to work around option parsing issues
if [ "$COMMAND" = "add-expert" ]; then
  shift  # remove the command argument
  
  # Extract parameters from command line arguments
  EXPERT_NAME=""
  FULL_NAME=""
  MNEMONIC=""
  METADATA=""
  CORE_GROUP=false
  DRY_RUN=false
  VERBOSE=false
  
  # Parse arguments
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --expert-name)
        EXPERT_NAME="$2"
        shift 2
        ;;
      --full-name)
        FULL_NAME="$2"
        shift 2
        ;;
      --mnemonic)
        MNEMONIC="$2"
        shift 2
        ;;
      --metadata)
        METADATA="$2"
        shift 2
        ;;
      --core-group)
        CORE_GROUP=true
        shift
        ;;
      --dry-run|-d)
        DRY_RUN=true
        shift
        ;;
      --verbose|-v)
        VERBOSE=true
        shift
        ;;
      *)
        echo "Unknown option: $1"
        shift
        ;;
    esac
  done
  
  # Validate required parameters
  if [ -z "$EXPERT_NAME" ]; then
    echo "Error: --expert-name is required"
    exit 1
  fi
  
  # Set up basic parameters
  PARAMS="--expert-name \"$EXPERT_NAME\""
  
  # Add optional parameters if provided
  if [ -n "$FULL_NAME" ]; then
    PARAMS="$PARAMS --full-name \"$FULL_NAME\""
  fi
  
  if [ -n "$MNEMONIC" ]; then
    PARAMS="$PARAMS --mnemonic \"$MNEMONIC\""
  fi
  
  if [ -n "$METADATA" ]; then
    PARAMS="$PARAMS --metadata '$METADATA'"
  fi
  
  if [ "$CORE_GROUP" = "true" ]; then
    PARAMS="$PARAMS --core-group"
  fi
  
  if [ "$DRY_RUN" = "true" ]; then
    PARAMS="$PARAMS --dry-run"
  fi
  
  if [ "$VERBOSE" = "true" ]; then
    PARAMS="$PARAMS --verbose"
  fi
  
  # Execute the command with properly formatted parameters
  track_command "add-expert" "cd \"$ROOT_DIR\" && ts-node \"$CLI_DIR/add-expert-direct.ts\" $PARAMS"
else
  # Show help if requested
  if [ "$COMMAND" = "help" ] || [ "$COMMAND" = "--help" ] || [ "$COMMAND" = "-h" ]; then
    echo "Experts CLI - Manage experts and their associations"
    echo ""
    echo "USAGE:"
    echo "  ./experts-cli.sh <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo "  (* = frequently used commands based on usage statistics)"
    echo ""
    echo "EXPERTS MANAGEMENT:"
    echo "  * add-expert              Add a new expert to the database (15 uses)"
    echo "  * list-experts            List all experts with their mnemonics"
    echo ""
    echo "FOLDER ASSIGNMENTS:"
    echo "  * assign-folder-experts   Interactively assign experts to high-level folders (7 uses)"
    echo "    assign-expert           Assign an expert to a folder (interactive mode with -i)"
    echo "    assign-multiple-experts Interactively assign multiple experts to individual folders"
    echo "    link-top-level-folders  List folders with videos for expert assignment"
    echo "  * propagate-expert-ids    Recursively assign expert_id to all files under expert folders (5 uses)"
    echo "    transfer-expert-metadata Transfer processed_content to experts.metadata field"
    echo ""
    echo "SYSTEM:"
    echo "  * health-check            Check the health of the experts service infrastructure (25 uses)"
    echo "    help                    Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo ""
    echo "EXPERTS MANAGEMENT:"
    echo "  # Add a basic expert"
    echo "  ./experts-cli.sh add-expert --expert-name \"Wager\""
    echo ""
    echo "  # Add expert with full details"
    echo "  ./experts-cli.sh add-expert --expert-name \"Wager\" --full-name \"Tor Wager\" --core-group"
    echo ""
    echo "  # List all experts with their mnemonics"
    echo "  ./experts-cli.sh list-experts"
    echo ""
    echo "FOLDER ASSIGNMENTS:"
    echo "  # Assign experts to high-level folders interactively"
    echo "  ./experts-cli.sh assign-folder-experts"
    echo ""
    echo "  # Interactive mode for bulk assignment using mnemonics"
    echo "  ./experts-cli.sh assign-expert -i"
    echo ""
    echo "  # Assign multiple experts to individual folders interactively"
    echo "  ./experts-cli.sh assign-multiple-experts"
    echo ""
    echo "  # Propagate expert IDs to all child files and folders"
    echo "  ./experts-cli.sh propagate-expert-ids"
    echo ""
    echo "SYSTEM:"
    echo "  # Check the health of the experts service"
    echo "  ./experts-cli.sh health-check"
    exit 0
  fi

  # Special case for health check to handle it differently
  if [ "$COMMAND" = "health-check" ]; then
    # Use a direct approach to health check to avoid document_type column issues
    track_command "health-check" "cd \"$ROOT_DIR\" && node -e \"
      const { createClient } = require('@supabase/supabase-js');
      
      async function testExpertsHealth() {
        try {
          // Get credentials directly from env
          const supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing required Supabase credentials');
          }
          
          // Create a client directly
          const supabase = createClient(supabaseUrl, supabaseKey);
          
          console.log('🏥 Running experts pipeline health checks...');
          console.log('\\n🔍 Checking Supabase database connection...');
          
          // Test connection with experts table first
          const { data: experts, error: expertsError } = await supabase
            .from('experts')
            .select('id')
            .limit(1);
            
          if (expertsError) {
            console.error('❌ Experts table connection failed:', expertsError.message);
            console.error('\\n📋 Overall Status:');
            console.error('❌ Experts service infrastructure has issues');
            process.exit(1);
          } else {
            console.log('✅ Experts table accessible');
          }
          
          // Test folder_expert_relationships table
          const { data: relations, error: relationsError } = await supabase
            .from('folder_expert_relationships')
            .select('id')
            .limit(1);
          
          if (relationsError) {
            console.warn('⚠️ Could not verify folder_expert_relationships table:', relationsError.message);
          } else {
            console.log('✅ Folder-expert relationships table verified');
          }
          
          // Print success status
          console.log('\\n📋 Overall Status:');
          console.log('✅ Experts service infrastructure appears healthy');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error in experts health check:', error);
          console.error('\\n📋 Overall Status:');
          console.error('❌ Experts service infrastructure has issues');
          process.exit(1);
        }
      }
      
      testExpertsHealth();
    \""
  else
    # Regular command execution for other commands
    track_command "$COMMAND" "ts-node $CLI_DIR/experts-cli.ts $*"
  fi
fi