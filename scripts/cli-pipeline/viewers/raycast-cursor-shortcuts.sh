#!/bin/bash

# Raycast script snippets for opening Cursor worktrees
# Copy each of these as a new Raycast script command

cat << 'EOF'
# Raycast Scripts for Cursor Worktrees
# 
# To use with Raycast:
# 1. Open Raycast Preferences
# 2. Go to Extensions > Script Commands
# 3. Click + to add a new script
# 4. Copy one of the scripts below
# 5. Assign a hotkey (e.g., ⌥1)

# === Script 1: Open Development Worktree ===
#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Cursor Development
# @raycast.mode silent
# @raycast.packageName Cursor Worktrees
# @raycast.icon 🟢

/Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono

# === Script 2: Open Admin Code Worktree ===
#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Cursor Admin Code
# @raycast.mode silent
# @raycast.packageName Cursor Worktrees
# @raycast.icon 🔵

/Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-admin-code

# === Script 3: Open Hub Worktree ===
#!/bin/bash
# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Open Cursor Hub
# @raycast.mode silent
# @raycast.packageName Cursor Worktrees
# @raycast.icon 🟣

/Applications/Cursor.app/Contents/MacOS/Cursor /Users/raybunnage/Documents/github/dhg-mono-dhg-hub

# Continue this pattern for all 10 worktrees...
EOF