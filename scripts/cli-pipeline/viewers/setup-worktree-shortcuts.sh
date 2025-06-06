#!/bin/bash

# Script to create macOS Automator apps for each worktree
# These can then be assigned keyboard shortcuts in System Preferences

WORKTREES=(
    "/Users/raybunnage/Documents/github/dhg-mono"
    "/Users/raybunnage/Documents/github/dhg-mono-admin-code"
    "/Users/raybunnage/Documents/github/dhg-mono-dhg-hub"
    "/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs"
    "/Users/raybunnage/Documents/github/dhg-mono-gmail-cli-pipeline-research-app"
    "/Users/raybunnage/Documents/github/dhg-mono-improve-audio"
    "/Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines"
    "/Users/raybunnage/Documents/github/dhg-mono-improve-google"
    "/Users/raybunnage/Documents/github/dhg-mono-improve-suite"
    "/Users/raybunnage/Documents/github/dhg-mono-integration-bug-fixes-tweaks"
)

NAMES=(
    "Cursor-1-Development"
    "Cursor-2-AdminCode"
    "Cursor-3-Hub"
    "Cursor-4-Docs"
    "Cursor-5-Gmail"
    "Cursor-6-Audio"
    "Cursor-7-CLI"
    "Cursor-8-Google"
    "Cursor-9-Suite"
    "Cursor-10-Fixes"
)

echo "Creating Automator apps for Cursor worktrees..."
echo ""
echo "After running this script, you'll need to:"
echo "1. Go to System Settings > Keyboard > Keyboard Shortcuts > App Shortcuts"
echo "2. Click + to add a new shortcut"
echo "3. Select 'All Applications'"
echo "4. Enter the exact app name (e.g., 'Cursor-1-Development')"
echo "5. Assign your shortcut (e.g., ⌥1 for Option+1 or ⌃⌥1 for Ctrl+Option+1)"
echo ""
echo "Creating apps..."

APPS_DIR="$HOME/Applications/CursorWorktrees"
mkdir -p "$APPS_DIR"

for i in "${!WORKTREES[@]}"; do
    WORKTREE="${WORKTREES[$i]}"
    APP_NAME="${NAMES[$i]}"
    APP_PATH="$APPS_DIR/$APP_NAME.app"
    
    echo "Creating $APP_NAME..."
    
    # Create the app bundle structure
    mkdir -p "$APP_PATH/Contents/MacOS"
    
    # Create the executable script
    cat > "$APP_PATH/Contents/MacOS/$APP_NAME" << EOF
#!/bin/bash
# Open Cursor in specific worktree
/Applications/Cursor.app/Contents/MacOS/Cursor "$WORKTREE"
EOF
    
    # Make it executable
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
    <string>com.cursor.worktree.$i</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
EOF
done

echo ""
echo "✅ Created $i apps in: $APPS_DIR"
echo ""
echo "Next steps:"
echo "1. Open System Settings > Keyboard > Keyboard Shortcuts > App Shortcuts"
echo "2. Add shortcuts for each app"
echo ""
echo "Recommended shortcuts:"
echo "  ⌥1 (Option+1) → Cursor-1-Development"
echo "  ⌥2 (Option+2) → Cursor-2-AdminCode"
echo "  ⌥3 (Option+3) → Cursor-3-Hub"
echo "  ⌥4 (Option+4) → Cursor-4-Docs"
echo "  ⌥5 (Option+5) → Cursor-5-Gmail"
echo "  ⌥6 (Option+6) → Cursor-6-Audio"
echo "  ⌥7 (Option+7) → Cursor-7-CLI"
echo "  ⌥8 (Option+8) → Cursor-8-Google"
echo "  ⌥9 (Option+9) → Cursor-9-Suite"
echo "  ⌥0 (Option+0) → Cursor-10-Fixes"
echo ""
echo "Or use F-keys: F1-F10"
echo "Or use Ctrl+Option: ⌃⌥1 through ⌃⌥0"