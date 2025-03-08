#!/bin/bash

# Script to update the documentation_files table in the database
# This script will:
# 1. Find all markdown files in the repository
# 2. Check each file against the database
# 3. Update existing records or create new ones
# 4. Mark records as deleted if the file no longer exists

# Define important locations
REPO_ROOT="$(pwd)"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

echo "Starting documentation database update at $TIMESTAMP..."

# Function to extract title from markdown file
extract_title() {
  local file="$1"
  # Try to get title from frontmatter
  local title=$(grep -m 1 "^title:" "$file" | sed 's/^title: *//' | sed 's/"//g' 2>/dev/null)
  
  # If no title in frontmatter, try first heading
  if [ -z "$title" ]; then
    title=$(grep -m 1 "^# " "$file" | sed 's/^# //' 2>/dev/null)
  fi
  
  # If still no title, use filename (without extension)
  if [ -z "$title" ]; then
    title=$(basename "$file" .md | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')
  fi
  
  echo "$title"
}

# Function to calculate file hash
calculate_hash() {
  local file="$1"
  # Generate a hash based on file content
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "$(md5 -q "$file")-$(stat -f%z "$file")"
  else
    # Linux
    echo "$(md5sum "$file" | cut -d' ' -f1)-$(stat -c %s "$file")"
  fi
}

# Function to determine if file is a prompt
is_prompt() {
  local file="$1"
  if [[ "$file" == *"/prompts/"* || "$(basename "$file")" == *"prompt"* ]]; then
    echo "true"
  else
    echo "false"
  fi
}

# Function to check if file exists in database and update it
process_file() {
  local file="$1"
  local rel_path=${file#"$REPO_ROOT/"}
  local title=$(extract_title "$file")
  local file_hash=$(calculate_hash "$file")
  local is_prompt_file=$(is_prompt "$file")
  local file_size
  local last_modified
  local last_modified_iso
  
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    file_size=$(stat -f "%z" "$file" 2>/dev/null)
    # Get modification time and convert to ISO format
    last_modified=$(stat -f "%m" "$file" 2>/dev/null)
    last_modified_iso=$(date -r $last_modified -u +"%Y-%m-%dT%H:%M:%S+00:00" 2>/dev/null)
  else
    # Linux
    file_size=$(stat -c "%s" "$file" 2>/dev/null)
    last_modified=$(stat -c "%Y" "$file" 2>/dev/null)
    last_modified_iso=$(date -d @$last_modified -u +"%Y-%m-%dT%H:%M:%S+00:00" 2>/dev/null)
  fi
  
  # Create metadata JSON
  local metadata="{\"size\":$file_size,\"isPrompt\":$is_prompt_file}"
  
  # Escape single quotes in SQL strings
  local escaped_rel_path="${rel_path//\'/\'\'}"
  local escaped_title="${title//\'/\'\'}"
  
  # Check if file already exists in database
  local existing_record=$(db_query "SELECT id, file_hash FROM documentation_files WHERE file_path = '$escaped_rel_path' AND is_deleted = false;" | grep -v "id" | grep -v "row" | grep -v "\-\-\-" | grep -v "^$")
  
  if [ -n "$existing_record" ]; then
    # Record exists, check if file has changed
    local db_id=$(echo "$existing_record" | awk '{print $1}')
    local db_hash=$(echo "$existing_record" | awk '{print $2}')
    
    if [ "$db_hash" != "$file_hash" ]; then
      # File has changed, update record
      echo "Updating existing record for $rel_path (changed)"
      db_query "UPDATE documentation_files 
               SET title = '$escaped_title', 
                   last_modified_at = '$last_modified_iso', 
                   last_indexed_at = '$TIMESTAMP', 
                   file_hash = '$file_hash', 
                   metadata = '$metadata', 
                   updated_at = '$TIMESTAMP' 
               WHERE id = '$db_id';"
    else
      # File hasn't changed, just update last_indexed_at
      echo "Updating existing record for $rel_path (unchanged)"
      db_query "UPDATE documentation_files 
               SET last_indexed_at = '$TIMESTAMP' 
               WHERE id = '$db_id';"
    fi
  else
    # Check if the file was previously deleted
    local deleted_record=$(db_query "SELECT id FROM documentation_files WHERE file_path = '$escaped_rel_path' AND is_deleted = true;" | grep -v "id" | grep -v "row" | grep -v "\-\-\-" | grep -v "^$")
    
    if [ -n "$deleted_record" ]; then
      # File was previously deleted, update record and mark as not deleted
      local db_id=$(echo "$deleted_record" | awk '{print $1}')
      echo "Restoring previously deleted record for $rel_path"
      db_query "UPDATE documentation_files 
               SET title = '$escaped_title', 
                   last_modified_at = '$last_modified_iso', 
                   last_indexed_at = '$TIMESTAMP', 
                   file_hash = '$file_hash', 
                   metadata = '$metadata', 
                   updated_at = '$TIMESTAMP',
                   is_deleted = false 
               WHERE id = '$db_id';"
    else
      # New file, create record
      echo "Creating new record for $rel_path"
      db_query "INSERT INTO documentation_files 
               (file_path, title, last_modified_at, last_indexed_at, file_hash, metadata, created_at, updated_at, is_deleted) 
               VALUES 
               ('$escaped_rel_path', '$escaped_title', '$last_modified_iso', '$TIMESTAMP', '$file_hash', '$metadata', '$TIMESTAMP', '$TIMESTAMP', false);"
    fi
  fi
}

# Find all markdown files and process them, tracking their paths
echo "Finding and processing markdown files..."
# Create a temporary file to track processed files
PROCESSED_FILES=$(mktemp)

# Process the docs directory
find "$REPO_ROOT/docs" -name "*.md" -type f 2>/dev/null | while read -r file; do
  process_file "$file"
  echo "${file#"$REPO_ROOT/"}" >> "$PROCESSED_FILES"
done

# Process the root prompts directory
if [ -d "$REPO_ROOT/prompts" ]; then
  find "$REPO_ROOT/prompts" -name "*.md" -type f 2>/dev/null | while read -r file; do
    process_file "$file"
    echo "${file#"$REPO_ROOT/"}" >> "$PROCESSED_FILES"
  done
fi

# Process root markdown files
find "$REPO_ROOT" -maxdepth 1 -name "*.md" -type f 2>/dev/null | while read -r file; do
  process_file "$file"
  echo "${file#"$REPO_ROOT/"}" >> "$PROCESSED_FILES"
done

# Process markdown files in apps directory
find "$REPO_ROOT/apps" -name "*.md" -type f 2>/dev/null | while read -r file; do
  process_file "$file"
  echo "${file#"$REPO_ROOT/"}" >> "$PROCESSED_FILES"
done

# Process markdown files in packages directory
find "$REPO_ROOT/packages" -name "*.md" -type f 2>/dev/null | while read -r file; do
  process_file "$file"
  echo "${file#"$REPO_ROOT/"}" >> "$PROCESSED_FILES"
done

# Process markdown files in public directory, especially prompts
if [ -d "$REPO_ROOT/public" ]; then
  find "$REPO_ROOT/public" -name "*.md" -type f 2>/dev/null | while read -r file; do
    process_file "$file"
    echo "${file#"$REPO_ROOT/"}" >> "$PROCESSED_FILES"
  done
fi

# Check if environment variables exist for Supabase connection
if [[ -z "$SUPABASE_URL" || -z "$SUPABASE_KEY" ]]; then
  # Try to load from .env file if available
  if [[ -f .env ]]; then
    echo "Loading Supabase credentials from .env file..."
    export $(grep -v '^#' .env | xargs)
  fi
  
  # Try to load from vite .env file if available
  if [[ -f .env.local ]]; then
    echo "Loading Supabase credentials from .env.local file..."
    export $(grep -v '^#' .env.local | xargs)
  fi
fi

# Set up PGPASSWORD if available
if [[ -n "$SUPABASE_PASSWORD" ]]; then
  export PGPASSWORD="$SUPABASE_PASSWORD"
fi

# Define a helper function for database queries
db_query() {
  local query="$1"
  
  # Try using supabase command if available (preferred)
  if command -v supabase &> /dev/null; then
    supabase db execute "$query" 2>/dev/null
  # Otherwise fall back to psql
  elif command -v psql &> /dev/null; then
    psql -c "$query" 2>/dev/null
  else
    echo "ERROR: Neither supabase cli nor psql is available"
    return 1
  fi
}

# Mark files as deleted if they no longer exist
echo "Marking deleted files..."
if [[ $(cat "$PROCESSED_FILES" | wc -l) -gt 0 ]]; then
  db_query "WITH current_files AS (
              SELECT file_path
              FROM (VALUES $(cat "$PROCESSED_FILES" | sed "s/^/('/" | sed "s/$/')/" | tr '\n' ',' | sed 's/,$//')
            )
            UPDATE documentation_files
            SET is_deleted = true,
                updated_at = '$TIMESTAMP'
            WHERE file_path NOT IN (SELECT file_path FROM current_files)
              AND is_deleted = false;"
else
  echo "Warning: No processed files found to check against"
fi

# Clean up
rm "$PROCESSED_FILES"

# Get final statistics
total_files=$(db_query "SELECT COUNT(*) FROM documentation_files WHERE is_deleted = false;" | tail -n 1)
deleted_files=$(db_query "SELECT COUNT(*) FROM documentation_files WHERE is_deleted = true;" | tail -n 1)

echo "Update completed at $(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")"
echo "Statistics:"
echo "- Active documentation files: $total_files"
echo "- Deleted documentation files: $deleted_files"