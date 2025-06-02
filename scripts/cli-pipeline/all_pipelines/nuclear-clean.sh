#!/bin/bash

# Nuclear clean script - completely removes all caches and forces fresh install
# This is the most extreme option to ensure you see latest code changes

echo "🔴 NUCLEAR CLEAN - This will remove ALL caches and node_modules"
echo "⚠️  This is the most aggressive cache clearing option"
echo ""

# Get the app name if provided
APP_NAME=$1

if [ -z "$APP_NAME" ]; then
    echo "Usage: ./scripts/nuclear-clean.sh <app-name>"
    echo "Example: ./scripts/nuclear-clean.sh dhg-admin-code"
    echo ""
    echo "Or use 'all' to clean everything:"
    echo "./scripts/nuclear-clean.sh all"
    exit 1
fi

echo "🧹 Starting nuclear clean for: $APP_NAME"
echo ""

# Function to clean a specific app
clean_app() {
    local app_path=$1
    local app_name=$(basename $app_path)
    
    echo "🔥 Cleaning $app_name..."
    
    # Remove node_modules
    if [ -d "$app_path/node_modules" ]; then
        echo "  - Removing node_modules..."
        rm -rf "$app_path/node_modules"
    fi
    
    # Remove .vite cache
    if [ -d "$app_path/node_modules/.vite" ]; then
        echo "  - Removing .vite cache..."
        rm -rf "$app_path/node_modules/.vite"
    fi
    
    # Remove dist/build folders
    if [ -d "$app_path/dist" ]; then
        echo "  - Removing dist folder..."
        rm -rf "$app_path/dist"
    fi
    
    # Remove .turbo cache
    if [ -d "$app_path/.turbo" ]; then
        echo "  - Removing .turbo cache..."
        rm -rf "$app_path/.turbo"
    fi
    
    # Remove TypeScript build info
    if [ -f "$app_path/tsconfig.tsbuildinfo" ]; then
        echo "  - Removing TypeScript build info..."
        rm -f "$app_path/tsconfig.tsbuildinfo"
    fi
    
    echo "  ✅ $app_name cleaned"
    echo ""
}

# Function to clean root caches
clean_root() {
    echo "🔥 Cleaning root-level caches..."
    
    # Remove root node_modules
    if [ -d "node_modules" ]; then
        echo "  - Removing root node_modules..."
        rm -rf node_modules
    fi
    
    # Remove pnpm store
    echo "  - Clearing pnpm store..."
    pnpm store prune
    
    # Remove .turbo cache at root
    if [ -d ".turbo" ]; then
        echo "  - Removing root .turbo cache..."
        rm -rf .turbo
    fi
    
    # Remove package lock files to force fresh resolution
    echo "  - Removing lock files..."
    rm -f pnpm-lock.yaml
    rm -f package-lock.json
    rm -f yarn.lock
    
    echo "  ✅ Root cleaned"
    echo ""
}

# Handle different cases
if [ "$APP_NAME" = "all" ]; then
    # Clean everything
    clean_root
    
    # Clean all apps
    for app_dir in apps/*/; do
        if [ -d "$app_dir" ]; then
            clean_app "$app_dir"
        fi
    done
    
    # Clean all packages
    for pkg_dir in packages/*/; do
        if [ -d "$pkg_dir" ]; then
            clean_app "$pkg_dir"
        fi
    done
    
    echo "🔄 Reinstalling all dependencies..."
    pnpm install
    
else
    # Clean specific app
    APP_PATH="apps/$APP_NAME"
    
    if [ ! -d "$APP_PATH" ]; then
        echo "❌ Error: App '$APP_NAME' not found in apps/ directory"
        exit 1
    fi
    
    # Clean the specific app
    clean_app "$APP_PATH"
    
    # Also clean shared packages that the app might depend on
    echo "🔥 Cleaning shared packages..."
    if [ -d "packages/shared" ]; then
        clean_app "packages/shared"
    fi
    
    # Clean root caches too (they affect all apps)
    clean_root
    
    echo "🔄 Reinstalling dependencies..."
    pnpm install
fi

echo ""
echo "✅ Nuclear clean complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Hard refresh your browser: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)"
echo "2. In Chrome DevTools: Right-click refresh → 'Empty Cache and Hard Reload'"
echo "3. Close all browser tabs for the app"
echo "4. Run: pnpm dev --filter=$APP_NAME"
echo ""
echo "💡 If you STILL don't see changes after this nuclear option:"
echo "   - Check that you're editing the correct files"
echo "   - Verify your changes were saved"
echo "   - Try restarting your terminal/IDE"
echo "   - Check if there are any build errors preventing compilation"