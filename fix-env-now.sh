#!/bin/bash

# Quick script to fix Vite environment issues

echo "🔧 Fixing Vite environment issues for dhg-service-test..."
echo ""

# Run the fix
ts-node scripts/cli-pipeline/utilities/fix-vite-env.ts dhg-service-test

echo ""
echo "✅ Fix applied! Now restart your dev server:"
echo "   cd apps/dhg-service-test && pnpm dev"
echo ""
echo "Then visit: http://localhost:5180"
echo "Click the red '🚨 Fix Env Issues' button to verify everything is working"