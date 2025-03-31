#\!/bin/bash

echo "Listing all mp4 files in file_types/mp4 directory..."
LOCAL_FILES=$(ls -1 file_types/mp4/*.mp4 2>/dev/null | xargs -I{} basename {} | sort)

if [ -z "$LOCAL_FILES" ]; then
  echo "No mp4 files found in file_types/mp4 directory."
  exit 1
fi

echo "Local mp4 files:"
echo "$LOCAL_FILES"
echo "Total local mp4 files: $(echo "$LOCAL_FILES" | wc -l)"

# Check if sources_google_lionya.json exists
if [ -f "file_types/txt/sources_google_lionya.json" ]; then
  echo -e "\nExtracting mp4 file references from sources_google_lionya.json..."
  DB_FILES=$(grep -o '"name":"[^"]*\.mp4"' file_types/txt/sources_google_lionya.json | cut -d'"' -f4 | sort)
  
  if [ -z "$DB_FILES" ]; then
    echo "No mp4 files found in sources_google_lionya.json."
  else
    echo "MP4 files referenced in sources_google_lionya.json:"
    echo "$DB_FILES"
    echo "Total referenced mp4 files: $(echo "$DB_FILES" | wc -l)"

    # Save to temp files for comparison
    echo "$LOCAL_FILES" > local_files.tmp
    echo "$DB_FILES" > db_files.tmp

    # Find missing files
    echo -e "\nMP4 files referenced but missing in file_types/mp4:"
    MISSING_FILES=$(comm -23 db_files.tmp local_files.tmp)
    
    if [ -z "$MISSING_FILES" ]; then
      echo "No files are missing from file_types/mp4"
    else
      echo "$MISSING_FILES"
      echo "Total missing files: $(echo "$MISSING_FILES" | wc -l)"
    fi

    # Cleanup temp files
    rm local_files.tmp db_files.tmp
  fi
else
  echo -e "\nsources_google_lionya.json not found. Searching for mp4 references in all project files..."
  REFS=$(grep -r "\.mp4" --include="*.json" --include="*.ts" --include="*.js" --include="*.tsx" . | grep -v "node_modules")
  
  if [ -z "$REFS" ]; then
    echo "No mp4 references found in project files."
  else
    echo "Found mp4 references in project files."
    echo "$REFS" > mp4_refs.txt
    echo "References saved to mp4_refs.txt"
    
    # Try to extract filenames
    MP4_NAMES=$(grep -o '[^/"]*\.mp4' mp4_refs.txt | sort | uniq)
    
    if [ -z "$MP4_NAMES" ]; then
      echo "Could not extract mp4 filenames from references."
    else
      echo -e "\nExtracted mp4 filenames from references:"
      echo "$MP4_NAMES"
      echo "Total unique mp4 references: $(echo "$MP4_NAMES" | wc -l)"
      
      # Save to temp files for comparison
      echo "$LOCAL_FILES" > local_files.tmp
      echo "$MP4_NAMES" > db_files.tmp

      # Find missing files
      echo -e "\nMP4 files referenced but missing in file_types/mp4:"
      MISSING_FILES=$(comm -23 db_files.tmp local_files.tmp)
      
      if [ -z "$MISSING_FILES" ]; then
        echo "No files are missing from file_types/mp4"
      else
        echo "$MISSING_FILES"
        echo "Total missing files: $(echo "$MISSING_FILES" | wc -l)"
      fi

      # Cleanup temp files
      rm local_files.tmp db_files.tmp mp4_refs.txt
    fi
  fi
fi
