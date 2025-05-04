#\!/bin/bash
# Script to clean up orphaned expert_documents and their presentation_assets references

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Source the environment variables
source "$PROJECT_ROOT/.env.development" 2>/dev/null || true

# Default values
DRY_RUN=true
LIMIT=100
VERBOSE=false

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --no-dry-run)
      DRY_RUN=false
      shift
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --limit=*)
      LIMIT="${1#*=}"
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Prepare temporary files
TEMP_DIR=$(mktemp -d)
ORPHANED_FILE="$TEMP_DIR/orphaned_records.csv"
ASSETS_FILE="$TEMP_DIR/assets.csv"
SUMMARY_FILE="$TEMP_DIR/summary.txt"

# Function to clean up temporary files
cleanup() {
  rm -rf "$TEMP_DIR"
}

# Set up trap to clean up on exit
trap cleanup EXIT

echo "=== Cleaning Orphaned Expert Documents ==="
echo "Mode: $([ "$DRY_RUN" = true ] && echo "DRY RUN" || echo "ACTUAL CLEAN")"
echo "Limit: $LIMIT records"
echo "Verbose: $([ "$VERBOSE" = true ] && echo "Yes" || echo "No")"

# First, verify we have PSQL access and credentials
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "Error: SUPABASE_DB_URL is not set in environment"
  exit 1
fi

if [ -z "$SUPABASE_DB_PASSWORD" ]; then
  echo "Error: SUPABASE_DB_PASSWORD is not set in environment"
  exit 1
fi

# Test database connection
echo "Testing database connection..."
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -c "SELECT 1" > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to database"
  exit 1
fi
echo "Database connection successful"

# Step 1: Find orphaned expert_documents (records with non-existent source_id)
echo "Finding orphaned expert_documents..."
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -c "
COPY (
  SELECT ed.id, ed.source_id, ed.document_type_id, ed.document_processing_status, ed.created_at 
  FROM public.expert_documents ed
  LEFT JOIN public.sources_google sg ON ed.source_id = sg.id
  WHERE ed.source_id IS NULL OR sg.id IS NULL
  LIMIT $LIMIT
) TO STDOUT WITH CSV HEADER;
" > "$ORPHANED_FILE"

# Count records and add to summary
ORPHANED_COUNT=$(tail -n +2 "$ORPHANED_FILE" | wc -l | tr -d ' ')
echo "Found $ORPHANED_COUNT orphaned expert_documents"
echo "orphaned_count=$ORPHANED_COUNT" > "$SUMMARY_FILE"

# Display orphaned records if verbose
if [ "$VERBOSE" = true ] && [ "$ORPHANED_COUNT" -gt 0 ]; then
  echo "Orphaned expert_documents:"
  cat "$ORPHANED_FILE"
  echo ""
fi

# Step 2: Find presentation_assets that reference these expert_documents
if [ "$ORPHANED_COUNT" -gt 0 ]; then
  echo "Finding related presentation_assets..."
  
  # Extract IDs of orphaned expert_documents - add quotes to make them valid SQL strings
  ORPHANED_IDS=$(tail -n +2 "$ORPHANED_FILE" | cut -d ',' -f 1 | sed "s/^/'/g" | sed "s/$/'/g" | tr '\n' ',' | sed 's/,$//')
  
  # Find presentation_assets that reference these expert_documents
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -c "
  COPY (
    SELECT pa.id, pa.presentation_id, pa.expert_document_id, pa.created_at
    FROM public.presentation_assets pa
    WHERE pa.expert_document_id IN ($ORPHANED_IDS)
  ) TO STDOUT WITH CSV HEADER;
  " > "$ASSETS_FILE"
  
  # Count assets and add to summary
  ASSETS_COUNT=$(tail -n +2 "$ASSETS_FILE" | wc -l | tr -d ' ')
  echo "Found $ASSETS_COUNT related presentation_assets"
  echo "assets_count=$ASSETS_COUNT" >> "$SUMMARY_FILE"
  
  # Display assets if verbose
  if [ "$VERBOSE" = true ] && [ "$ASSETS_COUNT" -gt 0 ]; then
    echo "Related presentation_assets:"
    cat "$ASSETS_FILE"
    echo ""
  fi
  
  # Step 3: Delete if not dry run
  if [ "$DRY_RUN" = false ]; then
    if [ "$ASSETS_COUNT" -gt 0 ]; then
      echo "Deleting $ASSETS_COUNT presentation_assets..."
      
      # Extract IDs of presentation_assets - add quotes
      ASSET_IDS=$(tail -n +2 "$ASSETS_FILE" | cut -d ',' -f 1 | sed "s/^/'/g" | sed "s/$/'/g" | tr '\n' ',' | sed 's/,$//')
      
      # Delete presentation_assets
      PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -c "
      DELETE FROM public.presentation_assets
      WHERE id IN ($ASSET_IDS);
      "
      
      echo "✅ Successfully deleted $ASSETS_COUNT presentation_assets"
    fi
    
    echo "Deleting $ORPHANED_COUNT orphaned expert_documents..."
    
    # Delete orphaned expert_documents (ORPHANED_IDS already has quotes)
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$SUPABASE_DB_URL" -c "
    DELETE FROM public.expert_documents
    WHERE id IN ($ORPHANED_IDS);
    "
    
    echo "✅ Successfully deleted $ORPHANED_COUNT orphaned expert_documents"
  else
    echo "[DRY RUN] Would delete $ASSETS_COUNT presentation_assets"
    echo "[DRY RUN] Would delete $ORPHANED_COUNT orphaned expert_documents"
    echo ""
    echo "⚠️ This was a DRY RUN. No records were actually deleted."
    echo "To perform the actual cleanup, run the command with --no-dry-run"
  fi
else
  echo "No orphaned records to clean up"
fi

echo ""
echo "Cleanup complete\!"

# Report summary
echo ""
echo "=== Cleanup Summary ==="
echo "Orphaned expert_documents: $ORPHANED_COUNT"
echo "Related presentation_assets: ${ASSETS_COUNT:-0}"
if [ "$DRY_RUN" = true ]; then
  echo "Mode: DRY RUN (no changes made)"
else
  echo "Mode: ACTUAL CLEAN"
fi

exit 0
