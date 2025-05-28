#!/bin/bash

# Clear App Cache Script - Clears cache for a specific app
# Usage: ./scripts/clear-app-cache.sh <app-name>
# Example: ./scripts/clear-app-cache.sh dhg-audio

if [ -z "$1" ]; then
    echo "❌ Error: Please provide an app name"
    echo "Usage: $0 <app-name>"
    echo "Example: $0 dhg-audio"
    echo ""
    echo "Available apps:"
    ls -1 apps/ | grep -v "^\." | sed 's/^/  - /'
    exit 1
fi

APP_NAME=$1
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate up three levels: all_pipelines -> cli-pipeline -> scripts -> root
MONOREPO_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
APP_PATH="$MONOREPO_ROOT/apps/$APP_NAME"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App '$APP_NAME' not found at $APP_PATH"
    echo ""
    echo "Available apps:"
    ls -1 "$MONOREPO_ROOT/apps/" | grep -v "^\." | sed 's/^/  - /'
    exit 1
fi

echo "🧹 Clearing cache for $APP_NAME..."

# Kill any running processes for this app
echo "🔪 Killing any running processes..."

# Try to find and kill processes by checking common ports
for port in {5173..5200} {3000..3010} {4000..4010}; do
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "   Found process on port $port, killing..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# Clear Vite cache
if [ -d "$APP_PATH/node_modules/.vite" ]; then
    echo "📦 Removing Vite cache..."
    rm -rf "$APP_PATH/node_modules/.vite"
fi

# Clear dist/build directories
if [ -d "$APP_PATH/dist" ]; then
    echo "📦 Removing dist directory..."
    rm -rf "$APP_PATH/dist"
fi

if [ -d "$APP_PATH/build" ]; then
    echo "📦 Removing build directory..."
    rm -rf "$APP_PATH/build"
fi

# Clear TypeScript build info
find "$APP_PATH" -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

# Clear any temp directories
find "$APP_PATH" -name "temp" -type d -exec rm -rf {} + 2>/dev/null || true
find "$APP_PATH" -name "tmp" -type d -exec rm -rf {} + 2>/dev/null || true
find "$APP_PATH" -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true

echo ""
echo "✅ Cache cleared for $APP_NAME!"
echo ""
echo "💡 Next steps:"
echo "   1. cd apps/$APP_NAME"
echo "   2. pnpm dev"
echo ""
echo "🌐 Don't forget to hard refresh your browser:"
echo "   - Mac: Cmd+Shift+R"
echo "   - Windows/Linux: Ctrl+Shift+R"
echo "   - Or open DevTools and right-click refresh → 'Empty Cache and Hard Reload'"