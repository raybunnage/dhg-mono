#!/bin/bash

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Get current commit hash
COMMIT=$(git rev-parse HEAD)

# Get commit message
MESSAGE=$(git log -1 --pretty=%B)

# Output as JSON
echo "{
  \"branch\": \"$BRANCH\",
  \"commit\": \"$COMMIT\",
  \"commit_message\": \"$MESSAGE\"
}" 