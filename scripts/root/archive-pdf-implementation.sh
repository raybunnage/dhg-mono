#!/bin/bash

# Set variables
COMMIT_HASH="9bd1c612f96b428a03bc6431a6f993789f12e6f0"
ARCHIVE_DIR="file_types/registry_archives/pdf-research-portal"
SOURCE_APP="apps/dhg-improve-experts"

# Create archive directory structure
mkdir -p "$ARCHIVE_DIR"/{src,config,docs}

# Get commit details
echo "Fetching commit details..."
git show $COMMIT_HASH > "$ARCHIVE_DIR/docs/commit-details.md"

# Copy relevant files
echo "Copying implementation files..."

# Source files
cp "$SOURCE_APP/src/pages/pdf-research-portal.tsx" "$ARCHIVE_DIR/src/"
cp "$SOURCE_APP/src/lib/pdf-worker.ts" "$ARCHIVE_DIR/src/"
cp "$SOURCE_APP/src/components/pdf/PDFViewer.tsx" "$ARCHIVE_DIR/src/"

# Config files
cp "$SOURCE_APP/vite.config.ts" "$ARCHIVE_DIR/config/"
cp "$SOURCE_APP/package.json" "$ARCHIVE_DIR/config/"

# Create README with implementation details
cat > "$ARCHIVE_DIR/README.md" << 'README_EOL'
# PDF Research Portal Implementation

## Commit Information
- Hash: 9bd1c612f96b428a03bc6431a6f993789f12e6f0
- Message: "omg the pdf viewer worked"
- Branch: feature/augment-experts

## Critical Files
1. **PDF Research Portal Page** (`src/pdf-research-portal.tsx`)
   - Main component for PDF viewing
   - Uses Google Drive preview URL

2. **Vite Configuration** (`config/vite.config.ts`)
   - Final simplified configuration
   - No special PDF.js settings needed

3. **PDF Viewer Component** (`src/PDFViewer.tsx`)
   - Implements iframe-based viewer
   - Uses Google Drive preview

## Working Example
\`\`\`typescript
const url = `https://drive.google.com/file/d/${pdfId}/preview`;
<iframe src={url} className="w-full h-full rounded" />
\`\`\`

## Testing
- Working PDF ID: 1oQvyH9OcSEwdcrPPunD6KEAmkJdZc8n6
- URL Format: https://drive.google.com/file/d/{id}/preview

## Implementation Notes
1. Simple approach using Google Drive preview
2. No PDF.js dependencies needed
3. No worker configuration required
4. Basic iframe implementation
README_EOL

# Create a manifest of all archived files
find "$ARCHIVE_DIR" -type f -not -path "*/\.*" | \
  sed "s|$ARCHIVE_DIR/||" > "$ARCHIVE_DIR/manifest.txt"

echo "Archive created at $ARCHIVE_DIR"
echo "See README.md for implementation details"
