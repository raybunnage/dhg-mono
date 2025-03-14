#!/bin/bash

# process-docs-batch.sh
# Batch process documentation files using the CLI

# Exit on error
set -e

# Default values
BATCH_SIZE=5
LIMIT=""
DRY_RUN=false
RETRIES=3
VERBOSE=false
FILE_PATH=""
FILE_ID=""
INCLUDE_PROCESSED=false

# Display usage
function usage() {
  echo "Usage: $0 [options]"
  echo "Process documentation files in batch mode."
  echo ""
  echo "Options:"
  echo "  -h, --help              Show this help message"
  echo "  -a, --all               Process all non-deleted documentation files"
  echo "  -i, --id ID             Process a specific documentation file by ID"
  echo "  -f, --file FILE_PATH    Process a specific file by path"
  echo "  -b, --batch-size SIZE   Number of files to process in parallel (default: 5)"
  echo "  -l, --limit NUMBER      Limit the number of files to process"
  echo "  -d, --dry-run           Show what would be processed without making changes"
  echo "  -r, --retries NUMBER    Number of retry attempts for failed processing (default: 3)"
  echo "  -v, --verbose           Enable verbose logging"
  echo "  --include-processed     Include already processed files with document type and assessment"
  echo ""
  echo "Examples:"
  echo "  $0 --all                               Process all documentation files"
  echo "  $0 --all --limit 10                    Process 10 most recent files"
  echo "  $0 --file docs/documentation-report.md Process a specific file"
  echo "  $0 --id 123e4567-e89b-12d3-a456-426614174000 Process by ID"
  echo "  $0 --all --dry-run                     Dry run to see what would be processed"
  exit 1
}

# Parse command line arguments
PROCESS_ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      ;;
    -a|--all)
      PROCESS_ALL=true
      shift
      ;;
    -i|--id)
      FILE_ID="$2"
      shift 2
      ;;
    -f|--file)
      FILE_PATH="$2"
      shift 2
      ;;
    -b|--batch-size)
      BATCH_SIZE="$2"
      shift 2
      ;;
    -l|--limit)
      LIMIT="$2"
      shift 2
      ;;
    -d|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -r|--retries)
      RETRIES="$2"
      shift 2
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    --include-processed)
      INCLUDE_PROCESSED=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

# Ensure node_modules is installed
if [ ! -d "./scripts/cli/node_modules" ]; then
  echo "Installing CLI dependencies..."
  cd scripts/cli
  npm install
  cd ../..
fi

# Build the CLI 
cd scripts/cli
echo "Building CLI..."
npm run build
cd ../..

# Construct the command
CMD="node scripts/cli/dist/index.js process"

if [ -n "$FILE_PATH" ]; then
  CMD="$CMD $FILE_PATH"
fi

if [ -n "$FILE_ID" ]; then
  CMD="$CMD --id $FILE_ID"
fi

if [ "$PROCESS_ALL" = true ]; then
  CMD="$CMD --all"
fi

if [ -n "$LIMIT" ]; then
  CMD="$CMD --limit $LIMIT"
fi

if [ -n "$BATCH_SIZE" ]; then
  CMD="$CMD --batch-size $BATCH_SIZE"
fi

if [ "$DRY_RUN" = true ]; then
  CMD="$CMD --dry-run"
fi

if [ -n "$RETRIES" ]; then
  CMD="$CMD --retries $RETRIES"
fi

if [ "$VERBOSE" = true ]; then
  CMD="$CMD --verbose"
fi

if [ "$INCLUDE_PROCESSED" = true ]; then
  CMD="$CMD --include-processed"
fi

# Display the command being executed
echo "Executing: $CMD"
echo "-------------------------------------------"

# Execute the command
$CMD

# Exit with the status code of the command
exit $?