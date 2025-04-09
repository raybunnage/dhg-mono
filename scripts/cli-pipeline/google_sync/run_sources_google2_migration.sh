#\!/bin/bash
# This script runs the migration process for sources_google to sources_google2
# It includes safeguards and validation steps to ensure data integrity

set -e  # Exit on any error

# Configuration
DB_URL="$DATABASE_URL"  # Uses the environment variable
SCRIPTS_DIR="$(dirname "$0")"
BACKUP_FILE="sources_google_backup_$(date +%Y%m%d_%H%M%S).sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Sources Google Migration Tool${NC}"
echo "This script will migrate the sources_google table to an improved sources_google2 schema."
echo "The process has multiple phases with validation between each step."
echo ""

# Check if database connection works
echo -e "${YELLOW}Checking database connection...${NC}"
if \! psql "$DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${RED}Error: Cannot connect to database.${NC}"
    echo "Please check your DATABASE_URL environment variable."
    exit 1
fi
echo -e "${GREEN}Database connection successful.${NC}"
echo ""

# Get initial counts
echo -e "${YELLOW}Getting initial record counts...${NC}"
ORIGINAL_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google;")
DHG_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';")
echo "Original sources_google table has $ORIGINAL_COUNT records"
echo "Original Dynamic Healing group records: $DHG_COUNT"
echo ""

# Check if sources_google2 already exists
TABLE_EXISTS=$(psql "$DB_URL" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sources_google2');")
if [[ $TABLE_EXISTS == *"t"* ]]; then
    echo -e "${YELLOW}Warning: sources_google2 table already exists.${NC}"
    read -p "Do you want to drop the existing sources_google2 table and recreate it? (y/n): " DROP_TABLE
    if [[ $DROP_TABLE == "y" ]]; then
        echo "Dropping existing sources_google2 table..."
        psql "$DB_URL" -c "DROP TABLE IF EXISTS sources_google2 CASCADE;"
    else
        echo "Aborting. Please resolve the table conflict and try again."
        exit 1
    fi
fi

# Backup the original table
echo -e "${YELLOW}Creating a backup of the original sources_google table...${NC}"
read -p "Do you want to export a full SQL backup of the sources_google table? (y/n): " CREATE_BACKUP
if [[ $CREATE_BACKUP == "y" ]]; then
    echo "Backing up sources_google to $BACKUP_FILE..."
    pg_dump "$DB_URL" --table=sources_google --schema-only > "$SCRIPTS_DIR/$BACKUP_FILE.schema"
    pg_dump "$DB_URL" --table=sources_google --data-only > "$SCRIPTS_DIR/$BACKUP_FILE.data"
    echo -e "${GREEN}Backup completed.${NC}"
else
    echo "Skipping SQL backup. Will still create a backup table in the database."
fi

# Phase 1: Create the new table and copy initial data
echo -e "${YELLOW}Phase 1: Creating sources_google2 table and performing initial data migration...${NC}"
psql "$DB_URL" -f "$SCRIPTS_DIR/create_sources_google2.sql"
psql "$DB_URL" -f "$SCRIPTS_DIR/migrate_sources_google2_phase1.sql"

# Validate Phase 1
echo "Validating Phase 1 results..."
PHASE1_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google2;")
PHASE1_NULL_ROOT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google2 WHERE root_drive_id IS NULL;")
echo "sources_google2 has $PHASE1_COUNT records (original: $ORIGINAL_COUNT)"
echo "Records with NULL root_drive_id: $PHASE1_NULL_ROOT"

if [[ $PHASE1_COUNT -lt $ORIGINAL_COUNT ]]; then
    echo -e "${RED}Warning: New table has fewer records than the original table.${NC}"
    read -p "Do you want to continue anyway? (y/n): " CONTINUE_FEWER
    if [[ $CONTINUE_FEWER \!= "y" ]]; then
        echo "Aborting migration."
        exit 1
    fi
fi

if [[ $PHASE1_NULL_ROOT -gt 0 ]]; then
    echo -e "${RED}Warning: $PHASE1_NULL_ROOT records have NULL root_drive_id.${NC}"
    echo "These will be fixed in Phase 2, but be aware of this issue."
fi

# Phase 2: Fix relationships and implement main_video_id logic
echo -e "${YELLOW}Phase 2: Fixing relationships and implementing main_video_id associations...${NC}"
psql "$DB_URL" -f "$SCRIPTS_DIR/migrate_sources_google2_phase2.sql"

# Validate Phase 2
echo "Validating Phase 2 results..."
DHG_COUNT_NEW=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google2 WHERE root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';")
WITH_MAIN_VIDEO=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google2 WHERE main_video_id IS NOT NULL;")
MP4_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google2 WHERE mime_type = 'video/mp4' AND root_drive_id = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';")
NULL_ROOT_AFTER=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM sources_google2 WHERE root_drive_id IS NULL;")

echo "Dynamic Healing group records: $DHG_COUNT_NEW (was $DHG_COUNT)"
echo "Records with main_video_id: $WITH_MAIN_VIDEO"
echo "MP4 files in Dynamic Healing group: $MP4_COUNT"
echo "Records with NULL root_drive_id: $NULL_ROOT_AFTER"

if [[ $DHG_COUNT_NEW -lt 800 ]]; then
    echo -e "${RED}Warning: Found fewer than 800 Dynamic Healing records.${NC}"
    echo "Expected at least 800 records based on the migration plan."
    read -p "Do you want to continue anyway? (y/n): " CONTINUE_FEWER_DHG
    if [[ $CONTINUE_FEWER_DHG \!= "y" ]]; then
        echo "Aborting migration."
        exit 1
    fi
fi

if [[ $NULL_ROOT_AFTER -gt 0 ]]; then
    echo -e "${RED}Warning: Still have $NULL_ROOT_AFTER records with NULL root_drive_id after Phase 2.${NC}"
    read -p "Do you want to fix these remaining NULL root_drive_id values? (y/n): " FIX_NULL_ROOT
    if [[ $FIX_NULL_ROOT == "y" ]]; then
        echo "Fixing remaining NULL root_drive_id values..."
        psql "$DB_URL" -c "UPDATE sources_google2 SET root_drive_id = drive_id WHERE root_drive_id IS NULL;"
    fi
fi

# Comprehensive validation
echo -e "${YELLOW}Running comprehensive validation...${NC}"
psql "$DB_URL" -f "$SCRIPTS_DIR/validate_sources_google2_migration.sql"

# Ask user if they want to finalize
echo ""
echo -e "${YELLOW}Migration and validation complete.${NC}"
echo "The sources_google2 table has been created and populated with improved data."
read -p "Do you want to finalize the migration (rename tables and update constraints)? (y/n): " FINALIZE

if [[ $FINALIZE == "y" ]]; then
    echo -e "${YELLOW}Finalizing migration...${NC}"
    psql "$DB_URL" -f "$SCRIPTS_DIR/finalize_sources_google2_migration.sql"
    echo -e "${GREEN}Migration has been finalized.${NC}"
    echo "The original table is now named 'sources_google_deprecated' and the new table is 'sources_google'."
    echo "A compatibility view 'sources_google_legacy_view' has been created for backward compatibility."
else
    echo "Migration not finalized. You can manually apply the finalize_sources_google2_migration.sql script later."
    echo "For now, your data is available in the sources_google2 table."
fi

echo ""
echo -e "${GREEN}Migration process complete\!${NC}"
exit 0
