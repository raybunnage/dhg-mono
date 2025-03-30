#!/bin/bash
# Google Drive CLI wrapper script
# This script provides commands to manage Google Drive folders and sync files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check that ts-node is installed
if ! command -v ts-node &> /dev/null; then
  echo "❌ ts-node is not installed. Please install it with: npm install -g ts-node typescript"
  exit 1
fi

function display_help() {
  echo "Google Drive CLI - Manages Google Drive folders and sync operations"
  echo ""
  echo "Usage:"
  echo "  google-drive-cli.sh [command] [options]"
  echo ""
  echo "Core Commands:"
  echo "  list-roots                  List all registered root folders"
  echo "  list-potential-roots        List folders that are in Google Drive but not registered"
  echo "  add-root [folderId]         Add a new root folder"
  echo "  remove-root [id]            Remove a root folder"
  echo "  check-folder [folderId]     Check if a folder exists in Google Drive"
  echo "  sync [rootId]               Sync files from a root folder (or all if not specified)"
  echo "  sync-folder [folderId]      Sync a specific folder (doesn't need to be a root)"
  echo ""
  echo "Advanced Commands:"
  echo "  add-root-service [folderId] Add a new root folder using service account"
  echo "  check-roots                 Check the status of all registered root folders"
  echo "  disk-status                 Update presentations table with disk status for MP4 files"
  echo "  list-drive-direct           List files in Drive directly (no DB interaction)"
  echo "  report-drive-roots          Generate a detailed report about all root folders"
  echo "  sync-and-update-metadata    Sync folder and update metadata in one operation"
  echo "  update-metadata             Update metadata for files in the database"
  echo ""
  echo "Options:"
  echo "  --dry-run                   Show what would be synced without making changes"
  echo "  --timeout [ms]              Set timeout for sync operations (default: 600000ms/10min)"
  echo "  --name [name]               Specify a name when adding a root folder"
  echo "  --description [desc]        Specify a description when adding a root folder"
  echo "  --verbose                   Show more detailed output"
  echo "  --recursive                 Recursively sync subfolders (for sync-folder command)"
  echo ""
  echo "Examples:"
  echo "  google-drive-cli.sh list-roots"
  echo "  google-drive-cli.sh add-root 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --name \"Dynamic Healing Discussion Group\""
  echo "  google-drive-cli.sh sync-folder 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run"
  echo "  google-drive-cli.sh sync-folder dynamic-healing --recursive"
  echo "  google-drive-cli.sh sync-and-update-metadata 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --limit 50"
  echo "  google-drive-cli.sh disk-status --dry-run"
}

# No arguments provided
if [ $# -eq 0 ]; then
  display_help
  exit 0
fi

COMMAND="$1"
shift

case "$COMMAND" in
  # Core commands
  list-roots)
    ts-node "$SCRIPT_DIR/list-drive-roots.ts" "$@"
    ;;
  list-potential-roots)
    ts-node "$SCRIPT_DIR/google-drive-manager.ts" list-potential-roots "$@"
    ;;
  add-root)
    ts-node "$SCRIPT_DIR/add-drive-root.ts" "$@"
    ;;
  remove-root)
    ts-node "$SCRIPT_DIR/google-drive-manager.ts" remove-root "$@"
    ;;
  check-folder)
    ts-node "$SCRIPT_DIR/google-drive-manager.ts" check-folder "$@"
    ;;
  sync)
    ts-node "$SCRIPT_DIR/google-drive-manager.ts" sync "$@"
    ;;
  sync-folder)
    ts-node "$SCRIPT_DIR/sync-drive-service.ts" "$@"
    ;;
    
  # Advanced commands
  add-root-service)
    ts-node "$SCRIPT_DIR/add-drive-root-service.ts" "$@"
    ;;
  check-roots)
    ts-node "$SCRIPT_DIR/check-roots.ts" "$@"
    ;;
  list-drive-direct)
    ts-node "$SCRIPT_DIR/list-drive-direct.ts" "$@"
    ;;
  list-drive-service)
    ts-node "$SCRIPT_DIR/list-drive-service-account.ts" "$@"
    ;;
  report-drive-roots)
    ts-node "$SCRIPT_DIR/report-drive-roots.ts" "$@"
    ;;
  sync-and-update-metadata)
    ts-node "$SCRIPT_DIR/sync-and-update-metadata.ts" "$@"
    ;;
  update-metadata)
    ts-node "$SCRIPT_DIR/update-metadata-service-account.ts" "$@"
    ;;
  update-dynamic-healing)
    ts-node "$SCRIPT_DIR/update-dynamic-healing-metadata.ts" "$@"
    ;;
  disk-status)
    ts-node "$SCRIPT_DIR/update-presentation-disk-status.ts" "$@"
    ;;
    
  # Help commands
  help|--help|-h)
    display_help
    ;;
  *)
    echo "❌ Unknown command: $COMMAND"
    display_help
    exit 1
    ;;
esac