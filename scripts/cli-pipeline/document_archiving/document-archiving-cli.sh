#!/bin/bash

# Document Archiving CLI
# Manages archiving of documentation files

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the utilities
source "$PROJECT_ROOT/scripts/cli-pipeline/shared/cli-utils.sh"

# Track command for analytics
track_command "document_archiving" "$1"

# Function to show help
show_help() {
    echo "Document Archiving CLI"
    echo ""
    echo "Usage: ./document-archiving-cli.sh [command] [options]"
    echo ""
    echo "Commands:"
    echo "  archive               Archive a single document"
    echo "  archive-living-docs   Archive multiple living documents"
    echo "  list                  List archived documents"
    echo "  search <term>         Search archived documents"
    echo "  superseded-by <path>  Show documents superseded by a specific document"
    echo ""
    echo "Options:"
    echo "  --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./document-archiving-cli.sh archive --path docs/living-docs/old-doc.md --reason \"Obsolete\""
    echo "  ./document-archiving-cli.sh archive-living-docs --reason \"Consolidated into super-agent-system.md\""
    echo "  ./document-archiving-cli.sh list --type living_doc"
    echo "  ./document-archiving-cli.sh search \"development system\""
}

# Check if no arguments provided or help requested
if [ $# -eq 0 ] || [ "$1" == "--help" ] || [ "$1" == "help" ]; then
    show_help
    exit 0
fi

# Change to script directory
cd "$SCRIPT_DIR"

# Run the CLI with all arguments
ts-node document-archiving-cli.ts "$@"