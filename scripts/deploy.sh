#!/bin/bash

# Usage: ./scripts/deploy.sh <app> <environment>
# Example: ./scripts/deploy.sh dhg-a development

APP=$1
ENV=$2

if [ -z "$APP" ] || [ -z "$ENV" ]; then
  echo "Usage: ./scripts/deploy.sh <app> <environment>"
  exit 1
fi

# Validate environment
case $ENV in
  production|development|preview)
    ;;
  *)
    echo "Invalid environment. Use: production, development, or preview"
    exit 1
    ;;
esac

# Navigate to app directory
cd "apps/$APP" || exit 1

# Deploy based on environment
if [ "$ENV" = "production" ]; then
  netlify deploy --prod
else
  netlify deploy
fi 