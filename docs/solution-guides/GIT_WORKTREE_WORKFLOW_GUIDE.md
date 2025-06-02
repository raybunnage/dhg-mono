# Git Worktree Workflow Guide for Claude Code Tasks

## Overview

This guide explains how to use Git worktrees effectively with the Claude Code Tasks system in dhg-admin-code. Worktrees allow you to work on multiple features simultaneously without constantly switching branches, each with its own Cursor instance and development environment.

## Table of Contents

1. [What are Git Worktrees?](#what-are-git-worktrees)
2. [Creating a New Task with a Branch](#creating-a-new-task-with-a-branch)
3. [Starting Work on a Task](#starting-work-on-a-task)
4. [Working in Isolated Environments](#working-in-isolated-environments)
5. [Daily Workflow](#daily-workflow)
6. [Committing Changes](#committing-changes)
7. [Testing Your Changes](#testing-your-changes)
8. [Completing a Task](#completing-a-task)
9. [Using the Enhanced Claude Code Tasks Interface](#using-the-enhanced-claude-code-tasks-interface)
10. [Best Practices](#best-practices)
11. [Example Scenario](#example-scenario)
12. [Recovery Commands](#recovery-commands)

## What are Git Worktrees?

Git worktrees allow you to have multiple branches checked out simultaneously in separate directories. Instead of switching branches in your main repository, each feature branch gets its own directory and Cursor instance.

**Benefits:**
- Work on multiple features simultaneously
- No need to stash changes when switching tasks
- Each Cursor instance maintains its own context
- Run different dev servers in each worktree
- Keep your main repository always on the main branch

## Creating a New Task with a Branch

When creating a new task in dhg-admin-code:

1. Navigate to **Claude Code Tasks** → **New Task**
2. Fill in task details
3. For **Work Mode**, select:
   - **Feature** - Automatically requires a branch
   - **Single File** - Optional branch (check "Create Git branch" if needed)
   - **Exploration** - Optional branch for experimental work
   - **Cross-Repo** - For work spanning multiple repositories

The system automatically generates a branch name like: `feature/your-task-name-abc123`

## Starting Work on a Task

### Step 1: Open the Task Detail Page

Navigate to your task in dhg-admin-code. If the task has a git branch but no active worktree, you'll see a **"Create Worktree"** button.

### Step 2: Create the Worktree

1. Click the **"Create Worktree"** button
2. The following commands are copied to your clipboard:

```bash
# Create worktree for task: Your Task Title
cd ~/Documents/github/dhg-mono
git worktree add ../dhg-mono-feature-your-task-name-abc123 feature/your-task-name-abc123
cd ../dhg-mono-feature-your-task-name-abc123
pnpm install
cursor .
```

3. Paste and run these commands in your terminal

### Step 3: Verify Creation

- A new directory is created as a sibling to your main repo
- The feature branch is checked out in that directory
- Dependencies are installed
- A new Cursor instance opens for that worktree
- The task in dhg-admin-code shows an active worktree badge

## Working in Isolated Environments

Your development environment now consists of:

### Directory Structure
```
~/Documents/github/
├── dhg-mono/                    # Main repository (always on main branch)
├── dhg-mono-feature-auth-xyz/   # Worktree for authentication feature
├── dhg-mono-bug-fix-nav-abc/    # Worktree for navigation bug fix
└── dhg-mono-refactor-api-def/   # Worktree for API refactoring
```

### Cursor Instances
- **Main Cursor**: Opens `dhg-mono` - for reviewing code, creating new tasks
- **Feature Cursors**: One per worktree - for active development

### Development Servers
Each worktree can run its own dev server:
- Worktree 1: `pnpm dev dhg-audio` (port 5173)
- Worktree 2: `pnpm dev dhg-admin-code` (port 5174)
- Worktree 3: `pnpm dev dhg-hub` (port 5175)

## Daily Workflow

### Starting Your Day

1. **Check active tasks:**
   ```bash
   # List all worktrees
   git worktree list
   ```

2. **Open dhg-admin-code** to review your tasks:
   - Tasks with green "Worktree" badges are ready to work on
   - Tasks with git branches but no worktree need setup

3. **Resume work on existing worktrees:**
   - The task detail page shows the command to open each worktree
   - Example: `cd ~/Documents/github/dhg-mono-feature-auth-xyz && cursor .`

### Switching Between Tasks

- Simply switch between Cursor windows (Cmd+` on Mac)
- Each window maintains its own:
  - Git branch state
  - File changes
  - Terminal sessions
  - Development servers

No need to stash, commit, or switch branches!

## Committing Changes

In your worktree directory:

```bash
# Stage changes
git add .

# Commit with Claude Code attribution
git commit -m "feat: implement user authentication

- Add login/logout functionality
- Implement JWT token management
- Add protected route components

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to remote
git push origin feature/add-auth-xyz789
```

### Commit Message Format

Follow conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `docs:` - Documentation changes
- `test:` - Test additions/changes

## Testing Your Changes

### In the Worktree

```bash
# Run tests
pnpm test

# Run specific app tests
pnpm test dhg-admin-code

# Type checking
tsc --noEmit

# Linting
pnpm lint
```

### Running Dev Servers

```bash
# Start development server
pnpm dev dhg-admin-code

# Or use the fresh start script (clears cache)
./scripts/dev-fresh.sh dhg-admin-code
```

## Completing a Task

### Step 1: Final Push and PR Creation

In your worktree:

```bash
# Ensure all changes are pushed
git push origin feature/your-branch-name

# Create pull request using GitHub CLI
gh pr create --title "feat: add authentication to dhg-audio" --body "## Summary
- Implemented login/logout functionality
- Added JWT token management
- Created protected routes

## Test Plan
- [ ] Test login with valid credentials
- [ ] Test logout functionality
- [ ] Verify protected routes redirect when not authenticated

🤖 Generated with [Claude Code](https://claude.ai/code)"
```

### Step 2: Update Task Status

1. In dhg-admin-code, go to your task
2. Click **"Mark Complete"**
3. Paste Claude's work summary
4. After PR is merged, click **"Mark as Merged"**

### Step 3: Clean Up Worktree

1. Click **"Remove Worktree"** button in task details
2. This copies the removal command:
   ```bash
   git worktree remove ../dhg-mono-feature-your-task-name-abc123
   ```
3. Run the command to remove the worktree directory

## Using the Enhanced Claude Code Tasks Interface

The Claude Code Tasks page in dhg-admin-code has been enhanced with powerful workflow management features to better support iterative development with Claude.

### Workflow Progress Tracking

The task detail page now displays a visual workflow progress indicator showing your current stage:

- **Pending** → **In Progress** → **Testing** → **Revision** → **Completed** → **Merged**

Each stage has specific actions available:
- **Pending**: Click "Start Working" to begin
- **In Progress**: Click "Move to Testing" when ready to test
- **Testing**: Either "Mark as Completed" or "Needs Revision"
- **Revision**: Click "Resume Work" to continue making changes
- **Completed**: Click "Mark as Merged" after PR is merged

### Worktree Management Panel

The right sidebar now features a dedicated Worktree Management section:

#### When No Worktree Exists
- Shows a clear explanation of worktrees
- Prominent "Create Worktree" button
- One-click copy of all setup commands

#### When Worktree is Active
- Green status indicator with worktree path
- "Open in Cursor" button that copies the command
- "Remove Worktree" button for cleanup
- Helpful tips about worktree usage

### Claude Iteration Tracking

A new "Claude Iterations" panel helps you track multiple rounds of changes:

#### Starting a Work Session
1. Click "Start Session" when beginning work with Claude
2. The session timer starts automatically
3. Work with Claude, make changes, test them

#### Ending a Work Session
1. Click "End Session" when finishing an iteration
2. Add a summary of what was accomplished
3. The system tracks:
   - Session duration
   - Summary of changes
   - Files modified (if tracked)
   - Claude conversation ID (if available)

#### Session History
- View all previous sessions for the task
- See how long each iteration took
- Review what was accomplished in each round
- Track progress through revisions

### Multi-Stage Workflow for Testing and Tweaking

The enhanced UI supports the reality that tasks often require multiple iterations:

1. **Initial Development** (In Progress)
   - Copy task to Claude
   - Implement initial solution
   - Track with work session

2. **Testing Phase**
   - Move task to "Testing" status
   - Try out the implementation
   - Add testing notes

3. **Revision Cycles**
   - If issues found, click "Needs Revision"
   - Add notes about what needs fixing
   - Task shows revision count
   - Resume work with Claude
   - Track new iteration with session

4. **Completion**
   - After successful testing, mark as completed
   - All iterations and revisions are preserved

### Task List Enhancements

The main tasks list now shows:
- Worktree status badges (green "Worktree" indicator)
- Current workflow stage with color coding
- Revision count for tasks that needed rework
- Git branch information

### Practical Example

Here's how to use the new features for a typical task:

1. **Create Task**: Add a new feature task with branch creation
2. **Start Work**: 
   - Click "Start Working" to move to In Progress
   - Click "Create Worktree" and set up your environment
   - Click "Start Session" in the iteration tracker
3. **First Claude Iteration**:
   - Copy task to Claude
   - Implement the feature
   - End session with summary: "Initial implementation of auth system"
4. **Testing**:
   - Click "Move to Testing"
   - Test the implementation
   - Find issues with token expiration
5. **Revision**:
   - Click "Needs Revision"
   - Add note: "Token expiration not handled correctly"
   - Click "Resume Work"
   - Start new session
6. **Second Claude Iteration**:
   - Copy updated task to Claude with revision notes
   - Fix the issues
   - End session: "Fixed token expiration handling"
7. **Final Testing**:
   - Test again
   - Everything works!
   - Click "Mark as Completed"
8. **Cleanup**:
   - Create PR
   - After merge, click "Mark as Merged"
   - Click "Remove Worktree"

### Tips for the Enhanced UI

- **Use Sessions**: Always track your Claude iterations with sessions
- **Add Summaries**: Brief summaries help you remember what each iteration accomplished
- **Track Revisions**: The revision counter shows how many cycles a task went through
- **Update Status**: Move through the workflow stages as you progress
- **Clean Up**: Remove worktrees after merging to keep the UI clean

## Best Practices

### DO ✅

- **Create a worktree** for any task that needs a branch
- **Keep main repo on main branch** - never switch branches there
- **Use one Cursor instance per worktree** - maintains separate contexts
- **Remove worktrees after merging** - keeps your workspace clean
- **Update task status** - helps track progress
- **Write clear commit messages** - include Claude Code attribution

### DON'T ❌

- **Switch branches in main repository** - defeats the purpose of worktrees
- **Create worktrees manually** - use the button for consistent naming
- **Work on features in main repo** - always use worktrees for features
- **Leave old worktrees around** - remove them after merging
- **Share worktrees between tasks** - one worktree per task/branch

## Example Scenario

You're juggling three tasks:

### Task A: Authentication Feature
```bash
# Location: ~/Documents/github/dhg-mono-feature-add-auth-dhg-audio-xyz789
# Branch: feature/add-auth-dhg-audio-xyz789
# Cursor: Window 1
# Dev server: http://localhost:5173
```

### Task B: Navigation Bug Fix
```bash
# Location: ~/Documents/github/dhg-mono-bug-fix-navigation-abc123
# Branch: bug/fix-navigation-abc123
# Cursor: Window 2
# Dev server: http://localhost:5174
```

### Task C: API Refactoring
```bash
# Location: ~/Documents/github/dhg-mono-refactor-shared-services-def456
# Branch: refactor/shared-services-def456
# Cursor: Window 3
# No dev server (backend only changes)
```

You can freely switch between these by switching Cursor windows!

## Recovery Commands

### List All Worktrees
```bash
git worktree list
```

### Remove a Worktree
```bash
# Normal removal
git worktree remove ../dhg-mono-feature-name

# Force removal (uncommitted changes)
git worktree remove --force ../dhg-mono-feature-name
```

### Clean Up Stale References
```bash
# If you manually deleted a worktree directory
git worktree prune
```

### Check Worktree Status
```bash
# In main repo
git branch -a  # Shows all branches
git worktree list  # Shows all worktrees
```

### Recover from Conflicts
```bash
# If a worktree gets into a bad state
cd ~/Documents/github/dhg-mono-feature-name
git status
git reset --hard origin/feature/branch-name
```

## Tips for Success

1. **Morning Routine**: Check `git worktree list` to see what you were working on
2. **Naming Convention**: Let the system name worktrees - they include the task type and ID
3. **PR Descriptions**: Reference the task ID in your PR for traceability
4. **Clean as You Go**: Remove worktrees immediately after merging
5. **Use Task Status**: Update task status in dhg-admin-code to track progress

## Conclusion

Git worktrees with Claude Code Tasks provide a powerful workflow for managing multiple features simultaneously. By following this guide, you'll maintain a clean, organized development environment where context switching is as simple as changing windows.

Remember: One task, one branch, one worktree, one Cursor instance. Keep it simple and let the tools handle the complexity!