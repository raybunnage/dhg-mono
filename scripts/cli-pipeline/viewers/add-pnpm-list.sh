#!/bin/bash

# Script to add pnpm command list function to .zshrc

echo "Adding pnpm command list (plist) to your shell..."

# Check if plist already exists
if grep -q "plist()" ~/.zshrc; then
    echo "plist function already exists in ~/.zshrc"
    echo "Updating it with the latest version..."
    # Remove old version
    sed -i '' '/# PNPM Command List/,/^}/d' ~/.zshrc
fi

# Add the plist function
cat >> ~/.zshrc << 'EOF'

# PNPM Command List
plist() {
    echo "📦 PNPM Commands Available:"
    echo ""
    echo "🚀 Development:"
    echo "  pnpm dev              → Run all apps in dev mode"
    echo "  pnpm hub              → Start Hub app"
    echo "  pnpm audio            → Start Audio app"
    echo "  pnpm experts          → Start Improve Experts app"
    echo "  pnpm admin-code       → Start Admin Code app"
    echo "  pnpm admin-suite      → Start Admin Suite app"
    echo "  pnpm admin-google     → Start Admin Google app"
    echo "  pnpm research         → Start Research app"
    echo ""
    echo "🛠️  CLI Pipelines:"
    echo "  pnpm google           → Google Drive sync commands"
    echo "  pnpm doc              → Document management"
    echo "  pnpm classify         → Document classification"
    echo "  pnpm media            → Media processing"
    echo "  pnpm presentations    → Presentation tools"
    echo "  pnpm prompt           → Prompt service"
    echo "  pnpm ai               → AI integration tools"
    echo "  pnpm auth             → Authentication tools"
    echo "  pnpm database         → Database management"
    echo "  pnpm experts-cli      → Expert management"
    echo "  pnpm tasks            → Development tasks"
    echo "  pnpm merge            → Merge management"
    echo "  pnpm monitoring       → System monitoring"
    echo "  pnpm scripts          → Script management"
    echo "  pnpm tracking         → Command tracking"
    echo "  pnpm worktree         → Worktree management"
    echo "  pnpm all              → All pipelines menu"
    echo "  pnpm maintenance      → System maintenance"
    echo ""
    echo "🔧 Build & Test:"
    echo "  pnpm build            → Build all apps"
    echo "  pnpm test             → Run tests"
    echo "  pnpm lint             → Run linting"
    echo "  pnpm clean            → Clean build artifacts"
    echo ""
    echo "🖥️  Servers & Utils:"
    echo "  pnpm servers          → Start all backend servers"
    echo "  pnpm browser          → Start file browser"
    echo "  pnpm tree             → Show project structure"
    echo "  pnpm types            → Generate TypeScript types"
    echo "  pnpm git              → Git workflow commands"
    echo ""
    echo "💡 Tips:"
    echo "  • Use 'pnpm run' to see all available scripts"
    echo "  • Use 'pnpm --filter <app> <cmd>' for specific apps"
    echo "  • Type 'clist' to see Cursor worktree shortcuts"
}

# Add a shorter alias
alias pl='plist'

# Add command to show raw package.json scripts
pscripts() {
    echo "📋 All scripts from package.json:"
    echo ""
    cat package.json | grep -A 100 '"scripts"' | grep -B 100 '^  }' | grep '"' | grep -v '"//' | sed 's/^    "/  /' | sed 's/": "/ → /' | sed 's/",$//' | sed 's/"$//'
}
EOF

echo "✅ Added plist function to ~/.zshrc"
echo ""
echo "To use it:"
echo "  1. Run: source ~/.zshrc"
echo "  2. Type: plist (or pl for short)"
echo ""
echo "Also added:"
echo "  • pscripts - Shows raw scripts from package.json"
echo ""
echo "Would you like to source it now? (y/n)"
read -r response
if [[ "$response" == "y" ]]; then
    source ~/.zshrc
    echo "✅ Done! Try 'plist' or 'pl' now!"
fi