#!/bin/bash

FILE="packages/shared/services/media-tracking-service-refactored/MediaTrackingService.ts"

echo "Fixing async/await patterns in MediaTrackingService..."

# Fix the pattern: .then(() => this.withRetry(async () => {
# Replace with: );\n\n    return this.withRetry(async () => {

# This is a complex find/replace, so let's do it step by step
python3 << 'EOF'
import re

file_path = "packages/shared/services/media-tracking-service-refactored/MediaTrackingService.ts"

with open(file_path, 'r') as f:
    content = f.read()

# Fix remaining .then() calls
patterns = [
    (r'(\s+})\s*\.then\(\(\) => this\.withTransaction\(async \(\) => \{', r'\1;\n\n    return this.withTransaction(async () => {'),
    (r'(\s+})\s*\.then\(\(\) => this\.withRetry\(async \(\) => \{', r'\1;\n\n    return this.withRetry(async () => {'),
]

for pattern, replacement in patterns:
    content = re.sub(pattern, replacement, content)

# Fix the reduce callback parameter types
content = re.sub(r'\.reduce\(\(sum, s\) =>', r'.reduce((sum: number, s: any) =>', content)

# Fix operationName in retry options
content = re.sub(r'operationName:', r'// operationName:', content)

# Fix column names that don't exist in database
content = re.sub(r'playback_speed:', r'// playback_speed:', content)
content = re.sub(r'title:', r'// title:', content)

with open(file_path, 'w') as f:
    f.write(content)

print("Fixed async/await patterns and type issues")
EOF