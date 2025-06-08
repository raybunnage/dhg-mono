# Command Registry Cleanup Plan

## Overview

Based on the pipeline health analysis, we have 142 unimplemented commands across 25 pipelines. Here's a strategic approach to cleaning them up.

## Pipeline Categories

### 1. REMOVE - Dead Pipelines (7 pipelines)
These pipelines have no CLI script and no working commands:
- `all_pipelines` - No CLI script, 0 implemented
- `dev_tasks` - No CLI script, 0 implemented  
- `google_sync` - No CLI script, 0 implemented
- `mime_types` - No CLI script, 0 implemented
- `refactor_tracking` - No CLI script, 0 implemented
- `work_summaries` - No CLI script, 0 implemented
- `document_types` - No CLI script, only 2 commands

**Action**: Remove all commands and consider removing pipeline registration

### 2. CONSOLIDATE - Low Activity (11 pipelines)
These have CLI scripts but very few or no implemented commands:
- `ai` - Consider merging with `prompt_service`
- `analysis` - Could merge with `documentation`
- `gmail` - Could merge with `email`
- `merge` - Could merge with `worktree`
- `monitoring` - Could become part of `system`
- `scripts` - Active but could merge with `registry`

**Action**: Remove unimplemented commands, consider consolidation

### 3. CLEANUP - Active but Cluttered (7 pipelines)
These are active pipelines with many working commands but also many unimplemented:
- `auth` - 1/15 implemented (93% unimplemented)
- `classify` - 8/17 implemented (53% unimplemented)
- `database` - 13/30 implemented (57% unimplemented)
- `deprecation` - 15/16 implemented (6% unimplemented)
- `experts` - 9/14 implemented (36% unimplemented)
- `media-processing` - 38/46 implemented (17% unimplemented)
- `presentations` - 26/26 implemented (0% unimplemented)

**Action**: Selectively remove clearly abandoned commands

## Recommended Approach

### Phase 1: Remove Dead Pipelines (Immediate)
1. Remove all commands from the 7 dead pipelines
2. Mark these pipelines as inactive in the database
3. Archive their directories

### Phase 2: Clean Active Pipelines (Careful)
1. For active pipelines, only remove:
   - Commands starting with `--` (these are usually options, not commands)
   - Commands that were clearly placeholders
   - Commands from features that were abandoned

### Phase 3: Consolidate (Future)
1. Plan consolidation of related pipelines
2. Migrate working commands to consolidated pipelines
3. Update documentation

## Commands to Keep vs Remove

### Definitely Remove:
- All commands from dead pipelines (47 commands)
- Option-style commands (`--api-key`, `--email`, etc.)
- Placeholder commands with no clear purpose

### Keep for Now:
- Commands in active pipelines that might be implemented later
- Commands that represent planned features
- Commands in pipelines with >50% implementation rate

## Summary

- **Immediate removal**: ~50-60 commands from dead pipelines
- **Selective removal**: ~20-30 obviously abandoned commands
- **Future consolidation**: 11 pipelines could be merged into 5-6