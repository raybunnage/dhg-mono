# Root Package.json Command Analysis Report

Generated: 2025-06-08

## Overview

This report traces each command in the root package.json to its corresponding location and provides insights into the monorepo's command structure.

## Command Categories

### 1. Core Development Commands (Turbo-based)

These commands use Turbo for orchestrated builds across the monorepo:

| Command | Type | Description |
|---------|------|-------------|
| `dev` | `turbo run dev` | Runs dev servers for all apps with dependencies |
| `build` | `turbo run build` | Builds all apps in dependency order |
| `test` | `turbo run test` | Runs tests across all packages |
| `test:run` | `turbo run test:run` | Runs tests without watch mode |
| `lint` | `turbo run lint` | Lints all packages |
| `clean` | `turbo run clean` | Cleans build artifacts |

**Note**: These commands rely on individual app package.json scripts and turbo.json configuration.

### 2. Server Utilities

| Command | Location | Purpose |
|---------|----------|---------|
| `servers` | `scripts/start-all-servers.js` | ✅ Starts all backend servers |
| `kill-servers` | `scripts/kill-all-servers.js` | ✅ Kills all running servers |
| `browser` | `html/server.js` | ✅ Starts file browser server |
| `file-browser` | `html/server.js` | ✅ Alias for browser command |
| `research` | Filter command | ✅ Runs dhg-research app |


### 3. App Shortcuts

All app shortcuts use pnpm filter commands to run specific apps:

| Command | Target | App Location |
|---------|--------|--------------|
| `hub` | `dhg-hub` | `apps/dhg-hub/` ✅ |
| `audio` | `dhg-audio` | `apps/dhg-audio/` ✅ |
| `admin-code` | `dhg-admin-code` | `apps/dhg-admin-code/` ✅ |
| `admin-suite` | `dhg-admin-suite` | `apps/dhg-admin-suite/` ✅ |
| `admin-google` | `dhg-admin-google` | `apps/dhg-admin-google/` ✅ |


### 4. Audio-specific Commands

| Command | Location/Action | Status |
|---------|----------------|--------|
| `audio:install` | Inline npm install | ✅ Installs audio dependencies |
| `audio:setup` | `apps/dhg-audio/setup-proxy.js` | ✅ File exists |
| `audio:build` | Filter command | ✅ Builds audio app |
| `audio:proxy` | `apps/dhg-audio/server.js` | ✅ Starts proxy server |
| `audio:start` | Composite | ✅ Setup + Build + Proxy |

### 5. CLI Pipeline Commands

All CLI commands point to shell scripts in `scripts/cli-pipeline/`:

| Command | Script Location | Status |
|---------|----------------|--------|
| `google` | `google_sync/google-sync-cli.sh` | ✅ Exists |
| `doc` | `document/doc-cli.sh` | ✅ Exists |
| `classify` | `classify/classify-cli.sh` | ✅ Exists |
| `media` | `media-processing/media-processing-cli.sh` | ✅ Exists |
| `presentations` | `presentations/presentations-cli.sh` | ✅ Exists |
| `prompt` | `prompt_service/prompt-service-cli.sh` | ✅ Exists |
| `ai` | `ai/ai-cli.sh` | ✅ Exists |
| `auth` | `auth/auth-cli.sh` | ✅ Exists |
| `database` | `database/database-cli.sh` | ✅ Exists |
| `email` | `email/email-cli.sh` | ✅ Exists |
| `experts-cli` | `experts/experts-cli.sh` | ✅ Exists |
| `tasks` | `dev_tasks/dev-tasks-cli.sh` | ✅ Exists |
| `merge` | `merge/merge-cli.sh` | ✅ Exists |
| `monitoring` | `monitoring/monitoring-cli.sh` | ✅ Exists |
| `scripts` | `scripts/scripts-cli.sh` | ✅ Exists |
| `tracking` | `tracking/tracking-cli.sh` | ✅ Exists |
| `worktree` | `worktree/worktree-cli.sh` | ✅ Exists |
| `all` | `all_pipelines/all-pipelines-cli.sh` | ✅ Exists |
| `maintenance` | `maintenance-cli.sh` | ✅ Exists (at root of cli-pipeline) |
| `service-deps` | `service_dependencies/service-dependencies-cli.sh` | ✅ Exists |
| `git` | `git_workflow/git-workflow-cli.sh` | ✅ Exists |


### 6. Utility Commands

| Command | Location/Action | Purpose |
|---------|----------------|---------|
| `tree` | `scripts/show-tree.js` | ✅ Shows directory tree |
| `types` | Supabase CLI | ✅ Generates TypeScript types |

## Summary of Findings

### ✅ Working Commands (42 total)
- 6 Core turbo commands
- 5 Server utilities
- 6 App shortcuts (all working)
- 5 Audio-specific commands
- 20 CLI pipeline commands
- 2 Utility commands

### ✨ Improvements Made

1. **Removed 7 redundant commands**:
   - 6 duplicate `dev:*` variants that were identical to shorter app commands
   - 1 duplicate `document` command (kept `doc`)

### 📊 Command Statistics

- **Total Commands**: 48 (excluding comment lines, after cleanup)
- **All commands are now unique** (no duplicates)
- **Turbo-based**: 6 (14%)
- **Direct Scripts**: 22 (52%)
- **Filter Commands**: 11 (26%)
- **Composite**: 3 (7%)

### 💡 Remaining Recommendations

1. **Consider organizing** maintenance-cli.sh into its own subdirectory for consistency
2. **Add shortcuts** for dhg-a and dhg-b apps if they become active

## Command Usage Patterns

### Most Likely Used Commands
Based on the structure and naming:
1. **Development**: `dev`, `build`, `hub`, `audio`, `admin-*`
2. **CLI Tools**: `google`, `doc`, `classify`, `database`
3. **Utilities**: `types`, `servers`, `git`

### Power User Commands
Commands that manage the monorepo:
- `all` - Master CLI for all pipelines
- `service-deps` - Service dependency analysis
- `monitoring` - System monitoring
- `worktree` - Git worktree management