#!/bin/bash

# This script identifies all files in the repository that depend on
# services that have been moved to the shared packages directory
# It's part of the incremental migration process

echo "Finding dependencies on moved services..."
echo "============================================"

# Define the services that have been moved
SERVICES=("file-service" "supabase-service" "report-service")

# Define directories to search
DIRS=("./scripts" "./apps" "./packages/cli")

# Exclude shared package directory itself from the search
EXCLUDE_DIRS=("./packages/shared")

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create results directory if it doesn't exist
RESULTS_DIR="./migration-analysis"
mkdir -p $RESULTS_DIR

# Generate timestamp for output file
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
OUTPUT_FILE="$RESULTS_DIR/service-dependencies-$TIMESTAMP.log"

echo "Analysis Results" > $OUTPUT_FILE
echo "Generated: $(date)" >> $OUTPUT_FILE
echo "===========================================" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Counter for stats
TOTAL_FILES=0
AFFECTED_FILES=0

# Process each service
for SERVICE in "${SERVICES[@]}"; do
  echo -e "${YELLOW}Checking dependencies on $SERVICE${NC}"
  echo "" >> $OUTPUT_FILE
  echo "Files referencing $SERVICE:" >> $OUTPUT_FILE
  echo "--------------------------------------------" >> $OUTPUT_FILE
  
  # Build the grep command with exclusions
  GREP_CMD="grep -r \"$SERVICE\" --include=\"*.ts\" --include=\"*.js\" --include=\"*.sh\""
  
  for DIR in "${DIRS[@]}"; do
    if [ -d "$DIR" ]; then
      GREP_CMD="$GREP_CMD $DIR"
    fi
  done
  
  for EXCL in "${EXCLUDE_DIRS[@]}"; do
    if [ -d "$EXCL" ]; then
      GREP_CMD="$GREP_CMD --exclude-dir=\"$EXCL\""
    fi
  done
  
  # Execute the search and write results to file
  FOUND_FILES=$(eval $GREP_CMD | sort)
  
  if [ -z "$FOUND_FILES" ]; then
    echo -e "${GREEN}No files found referencing $SERVICE${NC}"
    echo "No files found referencing $SERVICE" >> $OUTPUT_FILE
  else
    echo "$FOUND_FILES" >> $OUTPUT_FILE
    FILE_COUNT=$(echo "$FOUND_FILES" | wc -l | tr -d ' ')
    echo -e "${RED}Found $FILE_COUNT files referencing $SERVICE${NC}"
    echo "" >> $OUTPUT_FILE
    echo "Total: $FILE_COUNT files" >> $OUTPUT_FILE
    AFFECTED_FILES=$((AFFECTED_FILES + FILE_COUNT))
  fi
  
  echo "-----------------------------------------" >> $OUTPUT_FILE
done

# Get total files count
for DIR in "${DIRS[@]}"; do
  if [ -d "$DIR" ]; then
    DIR_COUNT=$(find $DIR -type f \( -name "*.ts" -o -name "*.js" -o -name "*.sh" \) | wc -l | tr -d ' ')
    TOTAL_FILES=$((TOTAL_FILES + DIR_COUNT))
  fi
done

# Add summary
echo "" >> $OUTPUT_FILE
echo "Summary:" >> $OUTPUT_FILE
echo "Total files scanned: $TOTAL_FILES" >> $OUTPUT_FILE
echo "Total affected files: $AFFECTED_FILES" >> $OUTPUT_FILE
echo "Percentage affected: $(awk "BEGIN {printf \"%.2f\", ($AFFECTED_FILES/$TOTAL_FILES)*100}")%" >> $OUTPUT_FILE

echo -e "${GREEN}Analysis completed. Results stored in:${NC} $OUTPUT_FILE"