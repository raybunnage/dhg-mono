#\!/bin/bash

# Create a list of mp4 files available locally
echo "Creating a list of all available mp4 files in file_types/mp4..."
find file_types/mp4 -type f -name "*.mp4" | xargs -I{} basename {} | sort > local_mp4_files.txt
echo "Found $(wc -l < local_mp4_files.txt) local mp4 files."
echo

# Gather files from sources_google table
echo "Looking for MP4 files referenced in code and scripts..."

# Extract mp4 filenames from code more carefully
grep -r "\".*\.mp4\"" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . | grep -v "node_modules" | grep -o '"[^"]*\.mp4"' | tr -d '"' | sort | uniq > mp4_from_code.txt
grep -r "\'.*\.mp4\'" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . | grep -v "node_modules" | grep -o "'[^']*\.mp4'" | tr -d "'" | sort | uniq >> mp4_from_code.txt

# Clean up any paths, we just want filenames
cat mp4_from_code.txt | xargs -I{} basename {} 2>/dev/null | sort | uniq > referenced_mp4_files.txt
echo "Extracted $(wc -l < referenced_mp4_files.txt) unique mp4 filenames from code."

# Add these specific files that might be in mock data
cat >> referenced_mp4_files.txt << 'MOCK_FILES'
ai-bias.mp4
regulatory-frameworks.mp4
intro-ai-ethics.mp4
MOCK_FILES

sort referenced_mp4_files.txt | uniq > referenced_mp4_files_unique.txt

# Find files that are referenced but not available locally
echo
echo "MP4 files referenced in code but missing in file_types/mp4:"
comm -23 referenced_mp4_files_unique.txt local_mp4_files.txt > missing_files.txt

if [ \! -s missing_files.txt ]; then
  echo "No referenced mp4 files are missing locally."
else
  cat missing_files.txt
  echo
  echo "Total missing files: $(wc -l < missing_files.txt)"
fi

# Clean up temp files
rm local_mp4_files.txt mp4_from_code.txt referenced_mp4_files.txt referenced_mp4_files_unique.txt missing_files.txt
