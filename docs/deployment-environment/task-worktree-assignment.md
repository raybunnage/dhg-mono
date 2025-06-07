# Task Worktree Assignment

This document explains the worktree-based task assignment system in dhg-admin-code.

## Overview

Tasks can now be assigned to specific worktrees, which automatically filters the available apps and CLI pipelines based on what's relevant to that worktree.

## Workflow

1. **Select Worktree First**: When creating a new task, the first field is now the worktree selector
2. **Automatic Filtering**: Once a worktree is selected, the app/pipeline dropdown is filtered to show only options available in that worktree
3. **Visual Indicators**: Tasks show their assigned worktree with emoji and alias (e.g., 🔵 cadmin)

## Worktree Mappings

| Worktree | Alias | Apps | CLI Pipelines | Description |
|----------|-------|------|---------------|-------------|
| 🟢 c1/cdev | Development | All apps | all_pipelines, monitoring, work_summaries, dev_tasks | Main development branch |
| 🔵 c2/cadmin | Admin Code | dhg-admin-code | dev_tasks, database, auth, monitoring, refactor_tracking | Admin code features |
| 🟣 c3/chub | Hub | dhg-hub, dhg-hub-lovable | auth, shared | Hub application |
| 🟠 c4/cdocs | Docs | None | document, document_types, classify, viewers | Documentation features |
| 🔴 c5/cgmail | Gmail | None | google_sync, drive_filter, tracking | Gmail integration |
| 🟡 c6/caudio | Audio | dhg-audio | media-processing, presentations | Audio app improvements |
| 🔷 c7/ccli | CLI Pipelines | None | All pipelines | CLI pipeline improvements |
| 🩷 c8/cgoogle | Google | dhg-admin-google | google_sync, drive_filter, classify, document, experts | Google integration |
| 🟩 c9/csuite | Suite | dhg-admin-suite | auth, database, shared | Admin suite |
| 🟪 c0/cfix | Bug Fixes | All apps | all_pipelines, utilities | Bug fixes and tweaks |

## Implementation Details

### Files Modified

1. **CreateTaskPage.tsx**
   - Added worktree selector as first field
   - Filters apps/pipelines based on selected worktree
   - Stores worktree_path with task

2. **worktree-mapping.ts**
   - Comprehensive mapping of worktrees to apps and pipelines
   - Helper functions for lookups and filtering
   - Handles alternate path names

3. **TasksPage.tsx**
   - Shows worktree info with emoji and alias
   - Tooltip shows worktree description

### Database Field

Tasks now store `worktree_path` which contains the full path to the assigned worktree.

## Benefits

1. **Better Organization**: Tasks are clearly associated with their worktree context
2. **Reduced Confusion**: Only see relevant apps/pipelines for each worktree
3. **Visual Clarity**: Emoji indicators make it easy to see task context at a glance
4. **Improved Workflow**: Aligns with clist navigation commands

## Future Enhancements

- Filter tasks by worktree in the task list
- Automatically switch to worktree when starting work on a task
- Track time spent per worktree
- Generate worktree-specific reports