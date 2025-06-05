#!/bin/bash

# Create a simple macOS app that provides keyboard shortcuts for Cursor worktrees
# This works without Raycast or any third-party tools

echo "Creating Cursor Launcher App with Keyboard Shortcuts"
echo "==================================================="
echo ""

# Create the app
APP_NAME="CursorWorktreeLauncher"
APP_PATH="$HOME/Applications/$APP_NAME.app"

mkdir -p "$APP_PATH/Contents/MacOS"
mkdir -p "$APP_PATH/Contents/Resources"

# Create the main launcher script
cat > "$APP_PATH/Contents/MacOS/$APP_NAME" << 'EOF'
#!/bin/bash

# Cursor Worktree Launcher
# Provides a quick picker for opening worktrees

WORKTREES=(
    "1. 🟢 Development|/Users/raybunnage/Documents/github/dhg-mono"
    "2. 🔵 Admin Code|/Users/raybunnage/Documents/github/dhg-mono-admin-code"
    "3. 🟣 Hub|/Users/raybunnage/Documents/github/dhg-mono-dhg-hub"
    "4. 🟠 Docs|/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs"
    "5. 🔴 Gmail|/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app"
    "6. 🟡 Audio|/Users/raybunnage/Documents/github/dhg-mono-improve-audio"
    "7. 🔷 CLI Pipelines|/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines"
    "8. 🩷 Google|/Users/raybunnage/Documents/github/dhg-mono-improve-google"
    "9. 🟩 Suite|/Users/raybunnage/Documents/github/dhg-mono-improve-suite"
    "0. 🟪 Bug Fixes|/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks"
)

# Create menu items
MENU_ITEMS=""
for item in "${WORKTREES[@]}"; do
    NAME="${item%%|*}"
    MENU_ITEMS="$MENU_ITEMS\"$NAME\", "
done
MENU_ITEMS=${MENU_ITEMS%, }

# Use AppleScript to create a picker dialog
CHOICE=$(osascript << END
tell application "System Events"
    activate
    set worktreeList to {$MENU_ITEMS}
    set selectedWorktree to choose from list worktreeList with prompt "Select a Cursor worktree to open:" with title "Cursor Worktree Launcher"
    if selectedWorktree is false then
        return ""
    else
        return item 1 of selectedWorktree
    end if
end tell
END
)

# If user made a choice, open the corresponding worktree
if [ -n "$CHOICE" ]; then
    for item in "${WORKTREES[@]}"; do
        NAME="${item%%|*}"
        PATH="${item##*|}"
        if [[ "$NAME" == "$CHOICE" ]]; then
            /Applications/Cursor.app/Contents/MacOS/Cursor "$PATH"
            break
        fi
    done
fi
EOF

chmod +x "$APP_PATH/Contents/MacOS/$APP_NAME"

# Create Info.plist
cat > "$APP_PATH/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.cursor.worktree.launcher</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF

echo "✅ Created $APP_NAME app at: $APP_PATH"
echo ""
echo "To set up a GLOBAL keyboard shortcut:"
echo ""
echo "1. Open System Settings > Keyboard > Keyboard Shortcuts > App Shortcuts"
echo "2. Click + to add a new shortcut"
echo "3. Application: Choose '$APP_NAME' from your Applications folder"
echo "4. Menu Title: Leave blank"
echo "5. Keyboard Shortcut: Choose something like ⌃⌥C (Control+Option+C)"
echo ""
echo "Then you can press ⌃⌥C from anywhere to get a picker!"
echo ""
echo "Opening the app now to test it..."
open "$APP_PATH"