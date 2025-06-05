# Worktree Management Scripts

## ⚠️ User-Specific Scripts - Update Paths!

These scripts contain hardcoded paths specific to the original developer's machine. They're included as **templates** to help other macOS developers set up similar worktree management systems.

### Before Using:

1. **Update all paths** in the scripts to match your worktree locations
2. **Update usernames** from `/Users/raybunnage/` to your username
3. **Adjust worktree names** to match your setup

### What's Included:

#### 1. Worktree Switcher Server (`worktree-switcher-server.js`)
- HTTP server on port 3010 for visual worktree switching
- Auto-detects git worktrees
- Works with any worktree setup (just update paths)

#### 2. Peacock Color Setup (`setup-peacock-colors*.js`)
- Assigns 10 distinct colors to VS Code/Cursor instances
- Creates `.vscode/settings.json` in each worktree
- Adds color emojis to window titles

#### 3. Raycast Scripts (`raycast-scripts/`)
- 10 script templates for keyboard shortcuts
- Each opens a specific worktree in Cursor
- Update paths in each `.sh` file before use

#### 4. BetterTouchTool Config (`bettertouchtool-config.json`)
- Pre-configured with ⌥1-⌥0 shortcuts
- Update all script paths before importing

#### 5. Shell Aliases Setup (`add-cursor-aliases.sh`)
- Adds `c1`-`c0` aliases to your shell
- Update paths in the script before running

### Quick Path Update:

```bash
# Example: Update all scripts with your username
find . -name "*.sh" -o -name "*.js" -o -name "*.json" | xargs sed -i '' 's/raybunnage/YOUR_USERNAME/g'

# Update worktree paths to match your setup
find . -name "*.sh" -o -name "*.js" -o -name "*.json" | xargs sed -i '' 's|/Users/[^/]*/Documents/github/|/YOUR/PATH/TO/WORKTREES/|g'
```

### Why These Are Committed:

1. **Templates for other developers** - Shows the pattern for multi-worktree management
2. **Documentation value** - Demonstrates the complete solution
3. **Customization starting point** - Easier to modify than create from scratch

### Setting Up Your Own:

1. Clone these scripts
2. Update all paths to match your worktrees
3. Choose your preferred method:
   - Raycast (recommended for ease)
   - BetterTouchTool (for power users)
   - Shell aliases (for terminal users)
   - Native macOS shortcuts (no third-party tools)

Each method provides keyboard shortcuts (⌥1-⌥0) to instantly switch between color-coded Cursor instances!