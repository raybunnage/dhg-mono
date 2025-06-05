#!/bin/bash

echo "Setting up Raycast Scripts for Cursor Worktrees"
echo "=============================================="
echo ""

# Check if Raycast is running
if pgrep -x "Raycast" > /dev/null; then
    echo "✅ Raycast is running"
else
    echo "❌ Raycast is not running. Please start Raycast first."
    echo "   Open Raycast with: Cmd+Space (or your custom hotkey)"
    exit 1
fi

echo ""
echo "SETUP INSTRUCTIONS:"
echo ""
echo "1. Open Raycast (Cmd+Space)"
echo "2. Type: 'Extensions' and press Enter"
echo "3. Find 'Script Commands' in the list"
echo "4. Click 'Open Scripts Folder' button (folder icon)"
echo ""
echo "This will create and open the Script Commands folder."
echo ""
echo "Press Enter when you've done this..."
read

# Now check if the folder exists
SCRIPT_DIR="$HOME/Library/Application Support/Script Commands"
if [ -d "$SCRIPT_DIR" ]; then
    echo "✅ Found Script Commands folder!"
    echo ""
    echo "Copying scripts..."
    
    # Copy all the scripts
    cp scripts/cli-pipeline/viewers/raycast-scripts/*.sh "$SCRIPT_DIR/"
    
    echo "✅ Copied all scripts!"
    echo ""
    echo "NEXT STEPS:"
    echo "1. Go back to Raycast Extensions"
    echo "2. You should now see all 10 scripts listed"
    echo "3. Click on each one and assign hotkeys:"
    echo "   - Click the script"
    echo "   - Click 'Record Hotkey'"
    echo "   - Press Option+1 (⌥1) for the first one, etc."
    echo ""
    echo "Recommended hotkeys:"
    echo "  ⌥1 → 🟢 Open Development"
    echo "  ⌥2 → 🔵 Open Admin Code"
    echo "  ⌥3 → 🟣 Open Hub"
    echo "  ⌥4 → 🟠 Open Docs"
    echo "  ⌥5 → 🔴 Open Gmail"
    echo "  ⌥6 → 🟡 Open Audio"
    echo "  ⌥7 → 🔷 Open CLI Pipelines"
    echo "  ⌥8 → 🩷 Open Google"
    echo "  ⌥9 → 🟩 Open Suite"
    echo "  ⌥0 → 🟪 Open Bug Fixes"
else
    echo "❌ Script Commands folder still not found."
    echo ""
    echo "Alternative method:"
    echo "1. In Raycast, search for 'Create Script Command'"
    echo "2. This will open the script creation flow"
    echo "3. Cancel it, but it will create the folder"
    echo "4. Run this script again"
fi