#!/bin/bash

# Complete cache clearing script for DHG monorepo

echo "🧹 Starting complete cache cleanup..."

# Kill all running processes
echo "⏹️  Killing all Node.js processes..."
pkill -f "node" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "tsx" 2>/dev/null || true
pkill -f "ts-node" 2>/dev/null || true
sleep 2

# Clear Vite caches
echo "🗑️  Clearing Vite caches..."
find . -name ".vite" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
find . -path "*/node_modules/.vite" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear dist folders
echo "📦 Clearing dist folders..."
find . -name "dist" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Clear build folders
echo "🏗️  Clearing build folders..."
find . -name "build" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Clear .cache folders
echo "💾 Clearing .cache folders..."
find . -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear parcel cache
echo "📦 Clearing parcel cache..."
find . -name ".parcel-cache" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear turbo cache
echo "🚀 Clearing turbo cache..."
rm -rf .turbo 2>/dev/null || true
find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear pnpm store
echo "📦 Clearing pnpm store..."
pnpm store prune 2>/dev/null || true

# Clear TypeScript build info
echo "📘 Clearing TypeScript build info..."
find . -name "*.tsbuildinfo" -type f -exec rm -f {} + 2>/dev/null || true

# Clear temp folders
echo "🗑️  Clearing temp folders..."
find . -name "temp" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
find . -name "tmp" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Clear specific app caches
echo "🎯 Clearing app-specific caches..."
rm -rf apps/*/node_modules/.cache 2>/dev/null || true
rm -rf packages/*/node_modules/.cache 2>/dev/null || true

# Clear next.js cache if exists
echo "▲ Clearing Next.js cache..."
find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear rollup cache
echo "🎯 Clearing rollup cache..."
find . -name ".rollup.cache" -type d -exec rm -rf {} + 2>/dev/null || true

# Clear browser cache hint
echo ""
echo "🌐 Browser Cache Clearing:"
echo "   1. Open Chrome DevTools (F12)"
echo "   2. Right-click the Refresh button"
echo "   3. Select 'Empty Cache and Hard Reload'"
echo "   OR"
echo "   - Mac: Cmd+Shift+R"
echo "   - Windows/Linux: Ctrl+Shift+R"
echo ""
echo "   Alternative: Use Incognito/Private mode"
echo ""

echo "✅ Cache cleanup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Run: pnpm install"
echo "   2. Start your dev server"
echo "   3. Clear browser cache (see above)"
echo ""
echo "🔥 For nuclear option (complete reinstall):"
echo "   rm -rf node_modules && rm -rf apps/*/node_modules && rm -rf packages/*/node_modules"
echo "   Then: pnpm install"