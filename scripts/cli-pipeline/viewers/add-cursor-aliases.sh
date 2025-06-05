#!/bin/bash

# Script to add Cursor aliases to your shell configuration

SHELL_CONFIG="$HOME/.zshrc"

# Backup current config
cp "$SHELL_CONFIG" "$SHELL_CONFIG.backup.$(date +%Y%m%d_%H%M%S)"

# Add aliases
cat >> "$SHELL_CONFIG" << 'EOF'

# Cursor Worktree Aliases - Added by worktree setup
alias c1='cursor /Users/raybunnage/Documents/github/dhg-mono'
alias c2='cursor /Users/raybunnage/Documents/github/dhg-mono-admin-code'
alias c3='cursor /Users/raybunnage/Documents/github/dhg-mono-dhg-hub'
alias c4='cursor /Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs'
alias c5='cursor /Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app'
alias c6='cursor /Users/raybunnage/Documents/github/dhg-mono-improve-audio'
alias c7='cursor /Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines'
alias c8='cursor /Users/raybunnage/Documents/github/dhg-mono-improve-google'
alias c9='cursor /Users/raybunnage/Documents/github/dhg-mono-improve-suite'
alias c0='cursor /Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks'

# Descriptive aliases
alias cdev='c1'      # Development
alias cadmin='c2'    # Admin Code
alias chub='c3'      # Hub
alias cdocs='c4'     # Docs
alias cgmail='c5'    # Gmail
alias caudio='c6'    # Audio
alias ccli='c7'      # CLI Pipelines
alias cgoogle='c8'   # Google
alias csuite='c9'    # Suite
alias cfix='c0'      # Bug Fixes

# List all cursor aliases
alias clist='echo "Cursor Worktree Aliases:
c1/cdev    → 🟢 Development
c2/cadmin  → 🔵 Admin Code
c3/chub    → 🟣 Hub
c4/cdocs   → 🟠 Docs
c5/cgmail  → 🔴 Gmail
c6/caudio  → 🟡 Audio
c7/ccli    → 🔷 CLI Pipelines
c8/cgoogle → 🩷 Google
c9/csuite  → 🟩 Suite
c0/cfix    → 🟪 Bug Fixes"'
EOF

echo "✅ Added Cursor aliases to $SHELL_CONFIG"
echo ""
echo "To activate the aliases, run:"
echo "  source ~/.zshrc"
echo ""
echo "Then you can use:"
echo "  c1  → Open Development"
echo "  c2  → Open Admin Code"
echo "  ... etc ..."
echo ""
echo "Or use descriptive names:"
echo "  cdev → Development"
echo "  cadmin → Admin Code"
echo "  ... etc ..."
echo ""
echo "Type 'clist' to see all aliases"