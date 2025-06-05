#\!/bin/bash

# Get a list of mp4 files from the Supabase sources_google table
echo "Fetching mp4 files from sources_google table..."
DB_MP4_FILES=$(npx supabase functions invoke execute-sql-query --body '{"query_text": "SELECT name FROM sources_google WHERE mime_type = \\"video/mp4\\" AND name LIKE \\"%.mp4\\" ORDER BY name"}')

# Check if DB_MP4_FILES is empty or contains an error
if [[ -z "$DB_MP4_FILES" || "$DB_MP4_FILES" == *"error"* ]]; then
  echo "Error fetching data from database or no results found."
  exit 1
fi

# Extract just the filenames from the JSON response
DB_FILES=$(echo "$DB_MP4_FILES" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)

# Get a list of local mp4 files
echo "Checking local mp4 files in file_types/mp4..."
LOCAL_FILES=$(find ./file_types/mp4 -type f -name "*.mp4" | xargs -I{} basename {})

# Create temporary files
echo "$DB_FILES" | sort > db_files.tmp
echo "$LOCAL_FILES" | sort > local_files.tmp

# Find files that are in the database but not locally
echo "Files in sources_google but missing in file_types/mp4:"
comm -23 db_files.tmp local_files.tmp > missing_files.txt

# Show results
if [[ -s missing_files.txt ]]; then
  cat missing_files.txt
  echo "Total missing files: $(wc -l < missing_files.txt)"
else
  echo "No files are missing from file_types/mp4"
fi

# Clean up temporary files
rm db_files.tmp local_files.tmp missing_files.txt
