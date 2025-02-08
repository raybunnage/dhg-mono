#!/bin/bash

# Deploy an app to a specific environment
# Usage: ./scripts/deployment/deploy-app.sh <app-name> <environment>

APP_NAME=$1
ENV=$2

if [ -z "$APP_NAME" ] || [ -z "$ENV" ]; then
  echo "Usage: ./scripts/deployment/deploy-app.sh <app-name> <environment>"
  echo "Environments: production, development, preview"
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

# Ensure we're in the app directory
cd "apps/$APP_NAME" || exit 1

# Build with correct environment
echo "Building $APP_NAME for $ENV environment..."
VITE_APP_ENV=$ENV pnpm build

# Deploy
if [ "$ENV" = "production" ]; then
  netlify deploy --prod
else
  netlify deploy
fi 