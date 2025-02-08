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
  export VITE_API_URL="https://api.dhg-hub.org"
  export VITE_APP_NAME="DHG Hub"
elif [ "$ENV_TYPE" = "development" ]; then
  export VITE_ENV="development"
  export VITE_API_URL="https://dev-api.dhg-hub.org"
  export VITE_APP_NAME="DHG Hub (Dev)"
else
  export VITE_ENV="preview"
  export VITE_API_URL="https://preview-api.dhg-hub.org"
  export VITE_APP_NAME="DHG Hub (Preview)"
fi

# Ensure we're in the app directory
cd "apps/$APP_NAME" || exit 1

# Get absolute path to dist directory
DIST_PATH="$(pwd)/dist"

# Build with correct environment
echo "Building $APP_NAME for $ENV_TYPE environment..."
echo "Environment variables:"
echo "VITE_ENV=$VITE_ENV"
echo "CONTEXT=$CONTEXT"

CONTEXT=$ENV_TYPE \
VITE_ENV=$ENV_TYPE \
VITE_APP_NAME="$VITE_APP_NAME" \
VITE_API_URL="$VITE_API_URL" \
pnpm build

# Deploy to Netlify
if [ "$ENV_TYPE" = "production" ]; then
  netlify deploy --dir="$DIST_PATH" --prod --message "$APP_NAME: Production deployment"
else
  CONTEXT=$ENV_TYPE netlify deploy --dir="$DIST_PATH" --message "$APP_NAME: $ENV_TYPE deployment"
fi 