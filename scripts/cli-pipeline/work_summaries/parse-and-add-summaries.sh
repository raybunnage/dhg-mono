#!/bin/bash

# Script to parse and add summaries from claude_code_prompts_recent_summaries.txt

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SUMMARIES_FILE="$PROJECT_ROOT/docs/claude_code_prompts_recent_summaries.txt"
WORK_SUMMARIES_CLI="$SCRIPT_DIR/work-summaries-cli.sh"

# Track summaries processed
SUMMARY_COUNT=0
CURRENT_SUMMARY=""
CURRENT_TITLE=""
IN_SUMMARY=false

# Function to process a summary
process_summary() {
    local title="$1"
    local content="$2"
    
    # Skip if empty
    if [[ -z "$title" ]] || [[ -z "$content" ]]; then
        return
    fi
    
    # Extract key elements from the summary
    local commands=""
    local tags=""
    
    # Try to extract commands mentioned in the summary
    if [[ "$content" =~ (./scripts/cli-pipeline/[^[:space:]]+) ]]; then
        commands="${BASH_REMATCH[1]}"
    fi
    
    # Auto-generate tags based on content
    if [[ "$content" =~ "table.*rename" ]] || [[ "$content" =~ "renamed" ]]; then
        tags="database,rename,migration"
    elif [[ "$content" =~ "media.*tracking" ]]; then
        tags="media,tracking,feature"
    elif [[ "$content" =~ "cache" ]] || [[ "$content" =~ "clear.*cache" ]]; then
        tags="cache,performance,cleanup"
    elif [[ "$content" =~ "archive" ]] || [[ "$content" =~ "archived" ]]; then
        tags="archive,cleanup,refactoring"
    elif [[ "$content" =~ "fix" ]] || [[ "$content" =~ "Fixed" ]]; then
        tags="bug-fix,maintenance"
    elif [[ "$content" =~ "implement" ]] || [[ "$content" =~ "created" ]]; then
        tags="feature,implementation"
    else
        tags="general,update"
    fi
    
    echo "Processing summary #$((SUMMARY_COUNT + 1)): $title"
    echo "Commands: $commands"
    echo "Tags: $tags"
    echo "---"
    
    # Call the work-summaries CLI
    "$WORK_SUMMARIES_CLI" auto \
        "$title" \
        "$content" \
        "$commands" \
        "$tags"
    
    SUMMARY_COUNT=$((SUMMARY_COUNT + 1))
    echo "Added summary #$SUMMARY_COUNT"
    echo "=========================================="
}

# Parse the file
while IFS= read -r line; do
    # Check if line starts with "Summary" (new summary block)
    if [[ "$line" =~ ^Summary$ ]]; then
        # Process previous summary if exists
        if [[ -n "$CURRENT_TITLE" ]]; then
            process_summary "$CURRENT_TITLE" "$CURRENT_SUMMARY"
        fi
        
        # Reset for new summary
        IN_SUMMARY=true
        CURRENT_TITLE=""
        CURRENT_SUMMARY=""
        continue
    fi
    
    # If we're in a summary block
    if [[ "$IN_SUMMARY" == true ]]; then
        # Skip empty lines at the beginning
        if [[ -z "$line" ]] && [[ -z "$CURRENT_SUMMARY" ]]; then
            continue
        fi
        
        # First non-empty line after "Summary" is the title
        if [[ -z "$CURRENT_TITLE" ]] && [[ -n "$line" ]]; then
            CURRENT_TITLE="$line"
            continue
        fi
        
        # Check if we've hit another major section (end of summary)
        if [[ "$line" =~ ^[A-Z] ]] && [[ ${#line} -lt 100 ]] && [[ "$line" != "$CURRENT_TITLE" ]]; then
            IN_SUMMARY=false
            continue
        fi
        
        # Accumulate summary content
        CURRENT_SUMMARY="$CURRENT_SUMMARY$line "
    fi
done < "$SUMMARIES_FILE"

# Process the last summary if exists
if [[ -n "$CURRENT_TITLE" ]]; then
    process_summary "$CURRENT_TITLE" "$CURRENT_SUMMARY"
fi

echo ""
echo "Finished processing $SUMMARY_COUNT summaries"