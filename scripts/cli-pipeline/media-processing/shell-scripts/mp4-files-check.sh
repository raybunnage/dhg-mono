#\!/bin/bash

echo "==== MP4 Files Check Report ===="
echo "This script checks for MP4 files referenced in sources_google that might be missing in file_types/mp4"
echo

# 1. Create list of local mp4 files
echo "Step 1: Creating list of local mp4 files..."
find file_types/mp4 -type f -name "*.mp4" | xargs -I{} basename {} | sort > local_mp4_files.txt
LOCAL_COUNT=$(wc -l < local_mp4_files.txt)
echo "Found $LOCAL_COUNT mp4 files in file_types/mp4 directory."
echo

# 2. Extract references to real mp4 files from code (not patterns or placeholders)
echo "Step 2: Extracting references to mp4 files from code..."
# Get proper filenames from string literals in code
grep -r "\"[^\"]*\.mp4\"" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . | grep -v "node_modules" | grep -o '"[^"]*\.mp4"' | tr -d '"' > mp4_refs.txt
grep -r "\'[^\']*\.mp4\'" --include="*.ts" --include="*.js" --include="*.tsx" --include="*.jsx" . | grep -v "node_modules" | grep -o "'[^']*\.mp4'" | tr -d "'" >> mp4_refs.txt

# Filter out template strings and patterns
grep -v "\\." mp4_refs.txt | grep -v "\$" | grep -v "{" > filtered_refs.txt

# Keep only likely real filenames (clean up any paths, we just want filenames)
cat filtered_refs.txt | grep -v "['\"]" | xargs -I{} basename {} 2>/dev/null | sort | uniq > referenced_mp4_files.txt

# Remove obvious patterns that aren't real files
grep -v "^\.mp4$" referenced_mp4_files.txt | grep -v "^mp4$" > clean_referenced_files.txt

REF_COUNT=$(wc -l < clean_referenced_files.txt)
echo "Found $REF_COUNT unique mp4 filenames referenced in code."
echo

# 3. Identify mock files used in examples
echo "Step 3: Adding known mock mp4 files..."
cat >> mock_mp4_files.txt << 'MOCK_FILES'
ai-bias.mp4
regulatory-frameworks.mp4
intro-ai-ethics.mp4
MOCK_FILES
echo "Added 3 known mock mp4 files."
echo

# 4. Find any actual missing files
echo "Step 4: Finding actual missing files (excluding mock files)..."
comm -23 clean_referenced_files.txt local_mp4_files.txt > potential_missing.txt
# Remove mock files from missing list
grep -v -f mock_mp4_files.txt potential_missing.txt > actual_missing.txt

if [ \! -s actual_missing.txt ]; then
  echo "RESULT: No actual mp4 files are missing. All real mp4 files referenced in code are available in file_types/mp4."
else
  echo "RESULT: The following mp4 files are referenced in code but missing in file_types/mp4:"
  cat actual_missing.txt
  echo
  echo "Total missing real files: $(wc -l < actual_missing.txt)"
fi

echo
echo "Mock files that are referenced but don't need to be in the file_types/mp4 directory:"
cat mock_mp4_files.txt
echo

# Clean up temp files
rm local_mp4_files.txt mp4_refs.txt filtered_refs.txt referenced_mp4_files.txt clean_referenced_files.txt mock_mp4_files.txt potential_missing.txt actual_missing.txt
