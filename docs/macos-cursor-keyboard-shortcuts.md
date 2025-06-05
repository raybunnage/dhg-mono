# macOS Keyboard Shortcuts for Cursor Worktrees

## Quick Comparison of Methods

| Method | Cost | Complexity | Features | Best For |
|--------|------|------------|----------|----------|
| **Automator + System Shortcuts** | Free | Medium | Basic but reliable | Built-in solution |
| **Raycast** | Free | Easy | Fast, extensible | Power users |
| **BetterTouchTool** | $22 | Easy | Most flexible | Custom gestures |
| **Keyboard Maestro** | $36 | Medium | Most powerful | Complex automation |
| **Hammerspoon** | Free | Hard | Scriptable | Developers |

## Method 1: Native macOS (Automator + Shortcuts)

### Setup Steps:
1. Run the setup script:
   ```bash
   ./scripts/cli-pipeline/viewers/setup-worktree-shortcuts.sh
   ```

2. Open System Settings > Keyboard > Keyboard Shortcuts > App Shortcuts

3. Click + and add shortcuts for each app:
   - Application: "Cursor-1-Development"
   - Menu Title: (leave blank)
   - Keyboard Shortcut: ⌥1

### Pros:
- No third-party software needed
- Works with macOS security features
- Survives OS updates

### Cons:
- Requires creating 10 separate apps
- Slightly more setup work

## Method 2: Raycast (Recommended for Most Users)

### Setup:
1. Install Raycast (free): https://www.raycast.com
2. Open Raycast Preferences
3. Go to Extensions > Script Commands
4. Add script for each worktree
5. Assign hotkeys (⌥1 through ⌥0)

### Pros:
- Fast and responsive
- Easy to modify
- Can add additional features (window management, etc.)
- Great UI

### Cons:
- Requires third-party app
- Another app running in background

## Method 3: BetterTouchTool

### Setup:
1. Install BetterTouchTool
2. Add new keyboard shortcut
3. Action: "Execute Terminal Command"
4. Command: `/Applications/Cursor.app/Contents/MacOS/Cursor /path/to/worktree`

### Pros:
- Very flexible
- Can combine with trackpad gestures
- Window snapping features
- TouchBar support

### Cons:
- Paid app ($22)
- More complex interface

## Method 4: Simple Shell Aliases (Terminal)

Add to your `~/.zshrc`:

```bash
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
```

Then use: `c1`, `c2`, etc. in terminal.

## Recommended Keyboard Shortcuts

### Option Keys (Alt):
- ⌥1 → Development
- ⌥2 → Admin Code
- ⌥3 → Hub
- ⌥4 → Docs
- ⌥5 → Gmail
- ⌥6 → Audio
- ⌥7 → CLI Pipelines
- ⌥8 → Google
- ⌥9 → Suite
- ⌥0 → Bug Fixes

### Function Keys:
- F1-F10 → Worktrees 1-10

### Control + Option:
- ⌃⌥1 through ⌃⌥0

## Quick Test

After setting up, you should be able to:
1. Press ⌥1 to open Development worktree
2. Press ⌥2 to open Admin Code worktree
3. etc.

Each will open in its own Cursor window with the correct color theme!