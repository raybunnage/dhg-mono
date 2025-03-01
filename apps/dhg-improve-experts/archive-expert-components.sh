#!/bin/bash

# Script to archive unused expert components
# Created: $(date +%Y-%m-%d)

# Set today's date for archive filenames
TODAY=$(date +%Y-%m-%d)

# Create archive directories if they don't exist
mkdir -p apps/dhg-improve-experts/src/_archive/pages
mkdir -p apps/dhg-improve-experts/src/_archive/components
mkdir -p apps/dhg-improve-experts/src/_archive/components/experts
mkdir -p apps/dhg-improve-experts/src/_archive/types

# Archive unused pages
echo "Archiving unused expert pages..."
[ -f apps/dhg-improve-experts/src/pages/Experts.tsx ] && \
  cp apps/dhg-improve-experts/src/pages/Experts.tsx \
     apps/dhg-improve-experts/src/_archive/pages/Experts.${TODAY}.tsx

[ -f apps/dhg-improve-experts/src/pages/ExpertDetail.tsx ] && \
  cp apps/dhg-improve-experts/src/pages/ExpertDetail.tsx \
     apps/dhg-improve-experts/src/_archive/pages/ExpertDetail.${TODAY}.tsx

# Archive components (keeping ExpertProfileExtractor as it's referenced in the audit)
echo "Archiving unused expert components..."
[ -f apps/dhg-improve-experts/src/components/ExpertCard.tsx ] && \
  cp apps/dhg-improve-experts/src/components/ExpertCard.tsx \
     apps/dhg-improve-experts/src/_archive/components/ExpertCard.${TODAY}.tsx

[ -f apps/dhg-improve-experts/src/components/experts/ExpertForm.tsx ] && \
  cp apps/dhg-improve-experts/src/components/experts/ExpertForm.tsx \
     apps/dhg-improve-experts/src/_archive/components/experts/ExpertForm.${TODAY}.tsx

[ -f apps/dhg-improve-experts/src/components/ProcessedProfileViewer.tsx ] && \
  cp apps/dhg-improve-experts/src/components/ProcessedProfileViewer.tsx \
     apps/dhg-improve-experts/src/_archive/components/ProcessedProfileViewer.${TODAY}.tsx

# Archive types
echo "Archiving expert types..."
[ -f apps/dhg-improve-experts/src/types/expert.ts ] && \
  cp apps/dhg-improve-experts/src/types/expert.ts \
     apps/dhg-improve-experts/src/_archive/types/expert.${TODAY}.ts

echo "Archiving complete. Files have been copied to _archive directories with today's date."
echo "Review the archived files and remove the originals if they are confirmed to be unused." 