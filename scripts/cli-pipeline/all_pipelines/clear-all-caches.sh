#!/bin/bash

# Clear All Caches Script - Ensures you see the latest code changes
# This script clears all possible caches that might prevent seeing code updates

echo "🧹 Clearing all caches to ensure latest code changes are visible..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate up three levels: all_pipelines -> cli-pipeline -> scripts -> root
MONOREPO_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Function to clear caches for a specific app
clear_app_caches() {
    local app_path=$1
    local app_name=$(basename "$app_path")
    
    echo ""
    echo "📦 Clearing caches for $app_name..."
    
    if [ -d "$app_path" ]; then
        # Kill any running vite processes for this app
        local port_file="$app_path/.vite-port"
        if [ -f "$port_file" ]; then
            local port=$(cat "$port_file" 2>/dev/null)
            if [ ! -z "$port" ]; then
                echo "   Killing processes on port $port..."
                lsof -ti:$port | xargs kill -9 2>/dev/null || true
            fi
        fi
        
        # Clear Vite cache
        if [ -d "$app_path/node_modules/.vite" ]; then
            echo "   Removing Vite cache..."
            rm -rf "$app_path/node_modules/.vite"
        fi
        
        # Clear dist/build directories
        if [ -d "$app_path/dist" ]; then
            echo "   Removing dist directory..."
            rm -rf "$app_path/dist"
        fi
        
        if [ -d "$app_path/build" ]; then
            echo "   Removing build directory..."
            rm -rf "$app_path/build"
        fi
        
        # Clear any .cache directories
        find "$app_path" -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true
        
        # Clear TypeScript build info
        find "$app_path" -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
        
        # Clear any temp directories
        find "$app_path" -name "temp" -type d -exec rm -rf {} + 2>/dev/null || true
        find "$app_path" -name "tmp" -type d -exec rm -rf {} + 2>/dev/null || true
        
        echo "   ✅ Caches cleared for $app_name"
    fi
}

# Function to kill all node processes
kill_all_node_processes() {
    echo ""
    echo "🔪 Killing all Node.js processes..."
    
    # Kill all node processes
    pkill -f node 2>/dev/null || true
    pkill -f "npm" 2>/dev/null || true
    pkill -f "pnpm" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    
    # Kill processes on common development ports
    for port in 3000 3001 4000 5000 5173 5174 5175 5176 5177 5178 5179 5180 5181 5182 5183 5184 5185 5186 5187 5188 5189 5190 5191 5192 5193 5194 5195; do
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    done
    
    echo "   ✅ All Node.js processes killed"
}

# Function to clear pnpm cache
clear_pnpm_cache() {
    echo ""
    echo "📦 Clearing pnpm cache..."
    pnpm store prune 2>/dev/null || true
    echo "   ✅ pnpm cache cleared"
}

# Function to clear browser caches (for Chrome/Chromium)
suggest_browser_cache_clear() {
    echo ""
    echo "🌐 Browser Cache:"
    echo "   To ensure you see the latest changes in your browser:"
    echo "   1. Open Developer Tools (F12 or Cmd+Option+I)"
    echo "   2. Right-click the refresh button"
    echo "   3. Select 'Empty Cache and Hard Reload'"
    echo "   OR"
    echo "   Use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) for hard refresh"
}

# Main execution
cd "$MONOREPO_ROOT"

# Kill all node processes first
kill_all_node_processes

# Clear caches for all apps
echo ""
echo "🔍 Finding and clearing caches for all apps..."
for app in apps/*; do
    if [ -d "$app" ]; then
        clear_app_caches "$app"
    fi
done

# Clear pnpm cache
clear_pnpm_cache

# Clear any global Vite caches
echo ""
echo "🌍 Clearing global caches..."
rm -rf ~/.vite 2>/dev/null || true
rm -rf ~/.cache/vite 2>/dev/null || true

# Suggest browser cache clearing
suggest_browser_cache_clear

echo ""
echo "✨ All caches cleared! Your next 'pnpm dev' will show the latest code changes."
echo ""
echo "💡 Pro tip: Run this script whenever you suspect caching issues:"
echo "   ./scripts/cli-pipeline/all_pipelines/clear-all-caches.sh"
echo ""