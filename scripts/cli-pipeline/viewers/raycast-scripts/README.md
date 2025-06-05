# Raycast Scripts for Cursor Worktrees

## Setup Instructions

### Method 1: Import All Scripts at Once
1. Open Raycast
2. Press `⌘,` to open preferences
3. Go to Extensions → Script Commands
4. Click the folder icon to open the scripts folder
5. Copy all `.sh` files from this directory to Raycast's script folder
6. Raycast will automatically detect and add them

### Method 2: Add Scripts Individually
1. Open Raycast preferences (`⌘,`)
2. Go to Extensions → Script Commands
3. Click `+` → Create Script Command
4. Choose "Bash" as the template
5. Copy the content from one of the scripts
6. Save and assign a hotkey

## Assigning Hotkeys

After importing the scripts:

1. In Raycast preferences, go to Extensions → Script Commands
2. Find each script (they'll be named "Open Development", "Open Admin Code", etc.)
3. Click on the script
4. Click "Record Hotkey"
5. Press your desired key combination:

### Recommended Hotkeys:
- ⌥1 → Open Development
- ⌥2 → Open Admin Code
- ⌥3 → Open Hub
- ⌥4 → Open Docs
- ⌥5 → Open Gmail
- ⌥6 → Open Audio
- ⌥7 → Open CLI Pipelines
- ⌥8 → Open Google
- ⌥9 → Open Suite
- ⌥0 → Open Bug Fixes

### Alternative Hotkeys:
- F1-F10 (if you don't use function keys for other things)
- ⌃⌥1 through ⌃⌥0 (Control+Option+Number)
- ⌘⌥1 through ⌘⌥0 (Command+Option+Number)

## Testing

After setup, press your hotkey and the corresponding Cursor window should open immediately with the correct worktree and color theme!

## Troubleshooting

If a script doesn't work:
1. Make sure Cursor is installed at `/Applications/Cursor.app`
2. Check that the worktree paths are correct
3. Ensure the scripts have execute permissions: `chmod +x *.sh`
4. Try running a script manually in Terminal to see any errors

## Customization

Each script includes an emoji icon that matches the Peacock color for that worktree. You can change these by editing the `@raycast.icon` line in each script.