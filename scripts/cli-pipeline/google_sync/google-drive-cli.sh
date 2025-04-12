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
  echo "  insert-file                 Insert a specific file from Google Drive into database"
  echo ""
  echo "Advanced Commands:"
  echo "  add-root-service [folderId] Add a new root folder using service account"
  echo "  browser-recursive-search    Generate browser-based recursive folder search script (saves to markdown)"
  echo "  cli-recursive-search <id>   Search Google Drive folder recursively and save to file_types/json/google-drive.json"
  echo "  check-roots                 Check the status of all registered root folders"
  echo "  count-mp4 [drive_id]        Count MP4 files in a Google Drive folder"
  echo "  disk-status                 Update presentations table with disk status for MP4 files"
  echo "  list-drive-direct           List files in Drive directly (no DB interaction)"
  echo "  mp4-experts                 Create expert documents for presentations with MP4 files"
  echo "  report-drive-roots          Generate a detailed report about all root folders"
  echo "  report-main-video-ids       Report on video files for folders, prioritizing Presentation folders"
  echo "  sync-and-update-metadata    Sync folder and update metadata in one operation. Use --file-id to insert a specific file"
  echo "  sync-mp4-presentations      Sync MP4 files with presentations table (ensure 1:1 mapping)"
  echo "  update-main-video-ids       Update main_video_id for presentations by recursively searching folders"
  echo "  update-metadata             Update metadata for files in the database"
  echo "  update-root-drive-id        Update root_drive_id field for all records under a specified root folder"
  echo "  update-sources-from-json    Update sources_google2 records using JSON file data with path and parent information"
  echo "  insert-missing-sources      Insert records from JSON file that do not exist in sources_google2"
  echo "  update-schema-from-json     Update the Supabase schema from JSON data"
  echo "  check-duplicates            Check for duplicate files in sources_google2 by name or drive_id"
  echo "  NOTE: The extracted_content field is deprecated and any size data should only be stored in the size field"
  echo ""
  echo "Options:"
  echo "  --dry-run                   Show what would be synced without making changes"
  echo "  --json                      Output in JSON format (for cli-recursive-search command)"
  echo "  --list                      List all files found (for count-mp4 command)"
  echo "  --summary                   Show only summary information (for count-mp4 command)"
  echo "  --local                     Use local filesystem instead of Google Drive (for count-mp4 command)"
  echo "  --timeout [ms]              Set timeout for sync operations (default: 600000ms/10min)"
  echo "  --name [name]               Specify a name when adding a root folder"
  echo "  --description [desc]        Specify a description when adding a root folder"
  echo "  --file-id [id]              Specify a file ID for direct file lookup and insertion"
  echo "  --verbose                   Show more detailed output"
  echo "  --recursive                 Recursively sync subfolders (for sync-folder command)"
  echo ""
  echo "Examples:"
  echo "  google-drive-cli.sh list-roots"
  echo "  google-drive-cli.sh add-root 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --name \"Dynamic Healing Discussion Group\""
  echo "  google-drive-cli.sh sync-folder 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run"
  echo "  google-drive-cli.sh sync-folder dynamic-healing --recursive"
  echo "  google-drive-cli.sh sync-and-update-metadata 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --limit 50"
  echo "  google-drive-cli.sh sync-and-update-metadata --file-id 1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM --verbose"
  echo "  google-drive-cli.sh update-root-drive-id --root-id 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run"
  echo "  google-drive-cli.sh update-root-drive-id --root-id dynamic-healing"
  echo "  google-drive-cli.sh count-mp4 dynamic-healing --list"
  echo "  google-drive-cli.sh sync-mp4-presentations --dry-run"
  echo "  google-drive-cli.sh sync-mp4-presentations --folder-id dynamic-healing"
  echo "  google-drive-cli.sh disk-status --dry-run"
  echo "  google-drive-cli.sh mp4-experts --dry-run"
  echo "  google-drive-cli.sh browser-recursive-search --folder-id d7e2cf82-26ff-4c36-8a4e-df9f98e8723a --output docs/custom-path.md"
  echo "  google-drive-cli.sh cli-recursive-search 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --json"
  echo "  google-drive-cli.sh report-main-video-ids --folder-id 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --output docs/video-report.md"
  echo "  google-drive-cli.sh update-main-video-ids --folder-id 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run"
  echo "  google-drive-cli.sh update-sources-from-json --verbose"
  echo "  google-drive-cli.sh update-sources-from-json file_types/json/google-drive.json --dry-run --drive-id 1XZlq1NQNmcLxgiuPooJ8QH3LP3lJlZB3"
  echo "  google-drive-cli.sh insert-missing-sources --missing-nine --verbose"
  echo "  google-drive-cli.sh insert-missing-sources --check-all-dhdg --verbose"
  echo "  google-drive-cli.sh insert-missing-sources --ids=1lY0Vxhv51RBZ5K9PmVQ9_T5PGpmcnkdh,16FpSTTysb1KQ27pKX4gpMnCU4UawN_te --dry-run"
  echo "  google-drive-cli.sh update-schema-from-json sources_google2-schema.json"
  echo "  google-drive-cli.sh check-duplicates --all --verbose"
  echo "  google-drive-cli.sh check-duplicates --by-name --limit 20"
  echo "  google-drive-cli.sh check-duplicates --by-drive-id --json"
  echo "  google-drive-cli.sh insert-file --file-id 1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM --verbose"
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
  browser-recursive-search)
    ts-node "$SCRIPT_DIR/index.ts" browser-recursive-search "$@"
    ;;
  cli-recursive-search)
    # Always add --recursive flag, and check if --json is already included
    if [[ "$*" == *"--json"* ]]; then
      ts-node "$SCRIPT_DIR/google-drive-service-account.ts" list-folder "$@" --recursive
    else
      ts-node "$SCRIPT_DIR/google-drive-service-account.ts" list-folder "$@" --recursive --json
    fi
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
  report-main-video-ids)
    ts-node "$SCRIPT_DIR/index.ts" report-main-video-ids "$@"
    ;;
  sync-and-update-metadata)
    ts-node "$SCRIPT_DIR/sync-and-update-metadata.ts" "$@"
    ;;
  update-main-video-ids)
    ts-node "$SCRIPT_DIR/index.ts" update-main-video-ids "$@"
    ;;
  sync-mp4-presentations)
    ts-node "$SCRIPT_DIR/sync-mp4-presentations.ts" "$@"
    ;;
  update-metadata)
    ts-node "$SCRIPT_DIR/update-metadata-service-account.ts" "$@"
    ;;
  update-dynamic-healing)
    ts-node "$SCRIPT_DIR/update-dynamic-healing-metadata.ts" "$@"
    ;;
  update-root-drive-id)
    ts-node "$SCRIPT_DIR/google-drive-manager.ts" update-root-drive-id "$@"
    ;;
  update-sources-from-json)
    ts-node "$SCRIPT_DIR/index.ts" update-sources-from-json "$@"
    ;;
  insert-missing-sources)
    ts-node "$SCRIPT_DIR/index.ts" insert-missing-sources "$@"
    ;;
  update-schema-from-json)
    ts-node "$SCRIPT_DIR/index.ts" update-schema-from-json "$@"
    ;;
  count-mp4)
    ts-node "$SCRIPT_DIR/count-mp4-files.ts" "$@"
    ;;
  disk-status)
    ts-node "$SCRIPT_DIR/update-presentation-disk-status.ts" "$@"
    ;;
  mp4-experts)
    ts-node "$SCRIPT_DIR/create-mp4-expert-documents.ts" "$@"
    ;;
  check-duplicates)
    ts-node "$SCRIPT_DIR/check-duplicates.ts" "$@"
    ;;
  insert-file)
    ts-node "$SCRIPT_DIR/insert-specific-file.ts" "$@"
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