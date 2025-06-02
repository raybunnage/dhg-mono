#!/bin/bash

# App-specific reinstall script - removes and reinstalls node_modules for a single app
# This is less extreme than nuclear-clean but more thorough than just clearing caches

echo "🔧 APP REINSTALL - Reinstalls node_modules for a specific app"
echo ""

# Get the app name
APP_NAME=$1

if [ -z "$APP_NAME" ]; then
    echo "Usage: ./app-reinstall.sh <app-name>"
    echo "Example: ./app-reinstall.sh dhg-admin-code"
    echo ""
    echo "This will:"
    echo "  1. Remove node_modules for the specific app"
    echo "  2. Remove .vite cache for the app"
    echo "  3. Remove dist/build folders for the app"
    echo "  4. Keep root node_modules intact"
    echo "  5. Keep other apps' node_modules intact"
    echo "  6. Reinstall only the app's dependencies"
    exit 1
fi

APP_PATH="apps/$APP_NAME"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App '$APP_NAME' not found in apps/ directory"
    exit 1
fi

echo "🎯 Targeting app: $APP_NAME"
echo ""

# Step 1: Remove app-specific caches and modules
echo "🧹 Cleaning $APP_NAME..."

# Remove app's node_modules
if [ -d "$APP_PATH/node_modules" ]; then
    echo "  - Removing $APP_NAME node_modules..."
    rm -rf "$APP_PATH/node_modules"
fi

# Remove .vite cache (usually inside node_modules, but just in case)
if [ -d "$APP_PATH/node_modules/.vite" ]; then
    echo "  - Removing .vite cache..."
    rm -rf "$APP_PATH/node_modules/.vite"
fi

# Remove dist folder
if [ -d "$APP_PATH/dist" ]; then
    echo "  - Removing dist folder..."
    rm -rf "$APP_PATH/dist"
fi

# Remove .turbo cache for this app
if [ -d "$APP_PATH/.turbo" ]; then
    echo "  - Removing .turbo cache..."
    rm -rf "$APP_PATH/.turbo"
fi

# Remove TypeScript build info
if [ -f "$APP_PATH/tsconfig.tsbuildinfo" ]; then
    echo "  - Removing TypeScript build info..."
    rm -f "$APP_PATH/tsconfig.tsbuildinfo"
fi

echo ""
echo "✅ $APP_NAME cleaned"
echo ""

# Step 2: Clear pnpm's cache for this specific package
echo "🔄 Clearing pnpm cache for $APP_NAME..."
cd "$APP_PATH"
pnpm store prune

echo ""
echo "📦 Reinstalling dependencies for $APP_NAME..."
echo ""

# Step 3: Reinstall dependencies for just this app
# Using --filter ensures we only install for this specific app
cd ../../  # Back to root
pnpm install --filter="$APP_NAME"

echo ""
echo "✅ Reinstall complete for $APP_NAME!"
echo ""
echo "🚀 Next steps:"
echo "1. Hard refresh your browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)"
echo "2. Close all browser tabs for $APP_NAME"
echo "3. Run: pnpm dev --filter=$APP_NAME"
echo ""
echo "💡 This approach:"
echo "   - Only touched $APP_NAME's dependencies"
echo "   - Left root node_modules intact"
echo "   - Left other apps untouched"
echo "   - Should fix most module-related cache issues"