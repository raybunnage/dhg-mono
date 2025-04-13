#\!/bin/bash

echo "Creating a list of all available mp4 files in file_types/mp4..."
find file_types/mp4 -type f -name "*.mp4" | xargs -I{} basename {} | sort > local_mp4_files.txt
echo "Found $(wc -l < local_mp4_files.txt) local mp4 files."

echo -e "\nSearching for mp4 files referenced in code..."
# Look for mp4 patterns across the codebase
grep -r --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" --include="*.json" "\.mp4" . | grep -v "node_modules" > mp4_references.txt
echo "Found $(grep -c "\.mp4" mp4_references.txt) mp4 references in code."

# Extract filenames from the references
echo -e "\nExtracting filenames from code references..."
grep -o "[^/]*\.mp4" mp4_references.txt | sort | uniq > referenced_mp4_files.txt
echo "Extracted $(wc -l < referenced_mp4_files.txt) unique mp4 filenames from code."

# Find files that are referenced in code but missing locally
echo -e "\nMP4 files referenced in code but missing in file_types/mp4:"
sort referenced_mp4_files.txt > sorted_refs.txt
sort local_mp4_files.txt > sorted_local.txt
comm -23 sorted_refs.txt sorted_local.txt > missing_files.txt

if [ \! -s missing_files.txt ]; then
  echo "No files are missing. All referenced mp4 files are available locally."
else
  cat missing_files.txt
  echo -e "\nTotal missing files: $(wc -l < missing_files.txt)"
fi

# Clean up temporary files
echo -e "\nCleaning up temporary files..."
rm local_mp4_files.txt mp4_references.txt referenced_mp4_files.txt sorted_refs.txt sorted_local.txt missing_files.txt

echo -e "\nDone\!"
