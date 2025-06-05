# Worktree Switching Setup Guide

## Quick Setup Steps

### 1. Install Peacock Extension
In each Cursor instance:
1. Open Extensions panel (`Cmd+Shift+X` on macOS, `Ctrl+Shift+X` on Windows/Linux)
2. Search for "Peacock" by John Papa
3. Click Install

### 2. Set Colors for Each Worktree
After installing Peacock, in each worktree's Cursor instance:

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type "Peacock: Change to a Favorite Color"
3. Pick a unique color for that worktree

**Suggested Color Scheme:**
- `main` branch: 🟢 Green (#42b883)
- `development`: 🔵 Blue (#007ACC)
- `improve-cli-pipelines`: 🟣 Purple (#832561)
- Feature branches: 🟠 Orange (#fd9827)
- Bugfix branches: 🔴 Red (#dd5145)
- Experimental: 🟡 Yellow (#fbc02d)

### 3. Window Title is Already Configured
The `.vscode/settings.json` file now includes:
```json
"window.title": "🌳 ${rootName} - [${activeEditorShort}] ${dirty}"
```

This will show:
- 🌳 Tree emoji to indicate it's a worktree
- The root folder name (usually the worktree name)
- The current file in brackets
- A dirty indicator (*) if there are unsaved changes

## Using the Setup

### macOS Window Switching
- **`Cmd + ~`** - Cycle through Cursor windows
- The title bar will show: "🌳 improve-cli-pipelines - [filename.ts] *"
- The window chrome will be colored based on your Peacock setting

### Visual Identification
Each worktree will have:
1. **Colored title bar** (via Peacock)
2. **Colored status bar** (via Peacock)
3. **Colored activity bar** (via Peacock)
4. **Clear worktree name** in title

### Pro Tips

1. **Quick Identification**: The color + title combo makes it instant to identify which worktree you're in

2. **Mission Control**: On macOS, when you use Mission Control, you'll see all Cursor windows with their distinct colors and titles

3. **Dock Preview**: Hovering over the Cursor icon in the dock will show window previews with titles

4. **Consistent Colors**: Use the same color for the same worktree across all your projects for muscle memory

## Additional Customization Options

If you want to further customize the window title, here are some variables you can use:

- `${rootName}`: Workspace name (usually the folder name)
- `${folderName}`: Name of the workspace folder
- `${folderPath}`: Full path of the workspace folder
- `${activeEditorShort}`: Current file name
- `${activeEditorMedium}`: Current file relative path
- `${activeEditorLong}`: Current file full path
- `${dirty}`: Shows * if file has unsaved changes
- `${separator}`: OS-specific path separator

Example custom patterns:
```json
// Branch-focused (if folder matches branch name)
"window.title": "🌿 ${rootName} | ${activeEditorShort}${dirty}"

// Path-focused
"window.title": "[${folderName}] ${folderPath}${separator}${activeEditorShort}"

// Minimal
"window.title": "${rootName}: ${activeEditorShort}"
```

## Troubleshooting

1. **Peacock colors not showing**: 
   - Make sure to reload the window after installing (`Cmd+R` / `Ctrl+R`)
   - Check that Peacock settings are enabled in `.vscode/settings.json`

2. **Window title not updating**:
   - Reload the window
   - Check that you're editing the workspace settings, not user settings

3. **Want different colors**:
   - Use "Peacock: Change to a Favorite Color" command
   - Or "Peacock: Enter a Color" for custom hex values