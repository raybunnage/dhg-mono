#!/bin/bash

# Source .env files to load environment variables
[ -f .env ] && export $(grep -v '^#' .env | xargs)
[ -f .env.local ] && export $(grep -v '^#' .env.local | xargs)
[ -f .env.development ] && export $(grep -v '^#' .env.development | xargs)

# Run the test script
npx ts-node test-generate-summary.ts