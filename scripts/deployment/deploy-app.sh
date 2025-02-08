#!/bin/bash

# Deploy an app to a specific environment
# Usage: ./scripts/deployment/deploy-app.sh <app-name> <environment>

APP_NAME=$1
ENV_TYPE=$2

if [ -z "$APP_NAME" ] || [ -z "$ENV_TYPE" ]; then
  echo "Usage: ./scripts/deployment/deploy-app.sh <app-name> <environment>"
  echo "Environments: production, development, preview"
  exit 1
fi

# Validate environment
case $ENV_TYPE in
  production|development|preview)
    ;;
  *)
    echo "Invalid environment. Use: production, development, or preview"
    exit 1
    ;;
esac

# Set environment variables based on deployment type
if [ "$ENV_TYPE" = "production" ]; then
  export VITE_ENV="production"
elif [ "$ENV_TYPE" = "development" ]; then
  export VITE_ENV="development"
else
  export VITE_ENV="preview"
fi

# Ensure we're in the app directory
cd "apps/$APP_NAME" || exit 1

# Build with correct environment
echo "Building $APP_NAME for $ENV_TYPE environment..."
VITE_APP_ENV=$ENV_TYPE pnpm build

# Deploy to Netlify
if [ "$ENV_TYPE" = "production" ]; then
  netlify deploy --prod
else
  netlify deploy
fi 