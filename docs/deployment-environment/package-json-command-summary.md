# Package.json Command Summary

Generated: 2025-06-08

## Quick Reference

### ✅ All Working Commands (42 total - cleaned up from 49)

#### Development Commands
```bash
pnpm dev          # Run all apps in dev mode
pnpm build        # Build all apps
pnpm test         # Run tests
pnpm lint         # Lint all code
pnpm clean        # Clean build artifacts
```

#### App Development Shortcuts
```bash
pnpm hub          # dhg-hub app
pnpm audio        # dhg-audio app
pnpm admin-code   # dhg-admin-code app
pnpm admin-suite  # dhg-admin-suite app
pnpm admin-google # dhg-admin-google app
pnpm research     # dhg-research app
```

#### Server Management
```bash
pnpm servers      # Start all backend servers
pnpm kill-servers # Kill all running servers
pnpm browser      # Start file browser
pnpm audio:proxy  # Start audio proxy server
```

#### CLI Pipeline Commands (Most Used)
```bash
pnpm google       # Google Drive sync operations
pnpm doc          # Document management
pnpm classify     # Document classification
pnpm database     # Database operations
pnpm ai           # AI service commands
pnpm auth         # Authentication management
pnpm tasks        # Dev task management
pnpm git          # Git workflow operations
pnpm all          # All pipelines master CLI
```

#### Utilities
```bash
pnpm tree         # Show directory structure
pnpm types        # Generate TypeScript types from Supabase
```

## Key Findings

### 🎯 Most Important Commands

1. **For Development**:
   - `pnpm dev` - Start development
   - `pnpm hub` - Main hub app
   - `pnpm audio` - Audio app
   - `pnpm admin-code` - Admin code app

2. **For CLI Operations**:
   - `pnpm google` - Google sync
   - `pnpm doc` - Documents
   - `pnpm database` - DB operations
   - `pnpm all` - Master CLI

3. **For Maintenance**:
   - `pnpm types` - Update TypeScript types
   - `pnpm servers` - Start all servers
   - `pnpm git` - Git operations

### ✅ Cleanup Completed

**Removed 7 redundant commands**:
- 6 duplicate `dev:*` variants (dev:hub, dev:audio, dev:admin-code, dev:admin-suite, dev:admin-google, dev:research)
- 1 duplicate `document` command (kept `doc`)

### 📊 Command Distribution (After Cleanup)

- **48** total commands defined (down from 56)
- **42** working commands verified
- **20** CLI pipeline commands (48%)
- **6** app shortcuts (14%)
- **6** turbo commands (14%)
- **5** audio-specific (12%)
- **5** server utilities (12%)

### 🔧 Remaining Improvements

1. **Add** app shortcuts for dhg-a and dhg-b if they become active
2. **Consider** moving maintenance-cli.sh to its own subdirectory

## Command Patterns

### Naming Conventions
- **Apps**: Short names (hub, audio, admin-*)
- **CLI**: Domain names (google, document, classify)
- **Actions**: Verb-based (build, test, clean)
- **Utilities**: Descriptive (servers, types, tree)

### Usage Frequency (Estimated)
1. **High**: dev, hub, audio, google, doc, types
2. **Medium**: classify, database, tasks, git, servers
3. **Low**: monitoring, service-deps, worktree

This analysis confirms that the monorepo's command structure is well-organized with clear categories and mostly consistent naming patterns. The few issues found are minor and easily addressable.