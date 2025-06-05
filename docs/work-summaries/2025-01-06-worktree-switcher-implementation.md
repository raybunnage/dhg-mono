# Worktree Switcher Implementation

**Date**: January 6, 2025  
**Branch**: improve-cli-pipelines  
**Summary ID**: 5760e054-8fbb-468a-b84a-c7a297a98973

## Problem Statement

When working with multiple git worktrees, each in its own Cursor instance, it's difficult to keep track of which instance corresponds to which worktree. When switching between applications using Alt+Tab or Cmd+Tab, users often end up in the wrong Cursor instance and have to manually search through all open windows to find the correct one.

## Solution Overview

Implemented a three-layer solution for worktree identification and switching:

1. **Visual Identification** - Window titles and color coding
2. **Peacock Extension** - Color-coded UI elements
3. **Web-based Switcher** - Quick access UI for switching between instances

## Implementation Details

### 1. Window Title Customization

**File**: `.vscode/settings.json`
```json
{
  "window.title": "🌳 ${rootName} - [${activeEditorShort}] ${dirty}"
}
```

**Features**:
- Tree emoji (🌳) indicates it's a worktree
- Shows root folder name (worktree name)
- Displays current file in brackets
- Dirty indicator (*) for unsaved changes

### 2. Peacock Extension Configuration

**File**: `.vscode/settings.json`
```json
{
  "peacock.affectActivityBar": true,
  "peacock.affectStatusBar": true,
  "peacock.affectTitleBar": true,
  "peacock.color": "#007ACC"
}
```

**Color Scheme**:
- Main: Green (#42b883)
- Development: Blue (#007ACC)
- improve-cli-pipelines: Purple (#832561)
- Feature branches: Orange (#fd9827)
- Bugfix branches: Red (#dd5145)
- Experimental: Yellow (#fbc02d)

### 3. Worktree Switcher Server

**File**: `scripts/cli-pipeline/viewers/worktree-switcher-server.js`

**Features**:
- Node.js HTTP server on port 3010
- Visual grid of all git worktrees
- Real-time detection of Cursor instances
- One-click switching between worktrees
- Keyboard shortcuts (1-9) for quick access
- Auto-refresh every 5 seconds

**UI Elements**:
- Color-coded cards matching branch types
- Status indicators:
  - 📍 Current worktree
  - 🖥️ Cursor is open
  - 📁 Available to open
- Branch name and full path display
- Keyboard shortcut hints

### 4. Integration with pnpm servers

**File**: `scripts/start-all-servers.js`
```javascript
{
  name: 'Worktree Switcher',
  port: 3010,
  command: 'node',
  args: ['scripts/cli-pipeline/viewers/worktree-switcher-server.js'],
  cwd: process.cwd(),
  env: { WORKTREE_SWITCHER_PORT: '3010' },
  description: 'Visual worktree switcher for Cursor instances'
}
```

### 5. Helper Scripts

**File**: `scripts/cli-pipeline/viewers/open-worktree-switcher.sh`
- Checks if server is running
- Opens switcher in default browser
- Cross-platform support (macOS, Linux, Windows)

## Technical Implementation

### Git Worktree Detection
```javascript
function getWorktrees() {
  const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
  // Parse porcelain format to extract worktree info
}
```

### Cursor Instance Detection (macOS)
```javascript
const psOutput = execSync(`ps aux | grep -i cursor | grep "${wt.path}" | grep -v grep`);
```

### Opening/Focusing Cursor
```javascript
const command = os.platform() === 'darwin' 
  ? `open -a "Cursor" "${worktreePath}"`
  : `cursor "${worktreePath}"`;
```

## Usage Instructions

### Starting the Service
```bash
# Start all servers including worktree switcher
pnpm servers

# Or start individually
node scripts/cli-pipeline/viewers/worktree-switcher-server.js
```

### Accessing the Switcher
1. **Browser**: Navigate to http://localhost:3010
2. **Script**: Run `./scripts/cli-pipeline/viewers/open-worktree-switcher.sh`
3. **Global Hotkey**: Bind the script to a keyboard shortcut

### Switching Worktrees
1. **Mouse**: Click on any worktree card
2. **Keyboard**: Press 1-9 to select by index
3. **Refresh**: Press 'R' to refresh the list

## Documentation Created

1. **Setup Guide**: `docs/worktree-switching-setup.md`
   - Peacock installation instructions
   - Color configuration guide
   - Troubleshooting tips

2. **Quick Reference**: `docs/worktree-shortcuts-reference.md`
   - Keyboard shortcuts for all platforms
   - Visual identification guide
   - Pro tips for efficient switching

## Benefits

1. **Instant Recognition**: Color + title + emoji make worktree identification immediate
2. **Quick Switching**: Keyboard shortcuts enable rapid navigation
3. **Visual Overview**: See all worktrees and their status at a glance
4. **No Context Loss**: Maintain focus on the correct worktree
5. **Cross-Platform**: Works on macOS, Linux, and Windows

## Future Enhancements

1. **Global Floating Widget**: Electron app for system-wide access
2. **Worktree Groups**: Organize related worktrees together
3. **Recent Files**: Show recently edited files per worktree
4. **Git Status Integration**: Display branch status and uncommitted changes
5. **Multi-Monitor Support**: Remember window positions per worktree

## Commands Used
- `pnpm servers` - Start all development servers
- `git worktree list` - Get worktree information
- `chmod +x` - Make scripts executable
- `open` - Open applications on macOS
- `curl` - Check server availability

## Tags
- worktree
- cursor
- vscode
- ui
- server
- port-3010
- peacock
- window-management