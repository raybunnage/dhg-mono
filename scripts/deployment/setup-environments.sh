#!/bin/bash

# Setup Netlify environments for an app
# Usage: ./scripts/deployment/setup-environments.sh <app-name>

APP_NAME=$1

if [ -z "$APP_NAME" ]; then
  echo "Usage: ./scripts/deployment/setup-environments.sh <app-name>"
  exit 1
fi

# Ensure we're in the app directory
cd "apps/$APP_NAME" || exit 1

# Initialize Netlify
echo "Setting up Netlify for $APP_NAME..."
netlify init

# Create production branch deployment
echo "Setting up production deployment..."
netlify env:set VITE_APP_ENV production
netlify env:set NODE_VERSION 18
netlify env:set PNPM_VERSION 8.15.1

# Create development branch deployment
echo "Setting up development deployment..."
git checkout -b development
netlify env:set VITE_APP_ENV development --context development

echo "Setup complete! Next steps:"
echo "1. Push development branch: git push origin development"
echo "2. Configure branch deployments in Netlify UI" 