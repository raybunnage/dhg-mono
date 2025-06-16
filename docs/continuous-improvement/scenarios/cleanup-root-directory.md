# Continuous Improvement Scenario: Cleanup Root Directory

## Scenario ID: `cleanup-root-directory`
**Category**: Code Organization
**Complexity**: Medium
**Estimated Time**: 30-45 minutes
**Last Updated**: 2025-06-16

## Overview
**Problem**: Files accumulate in the monorepo root directory that violate CLAUDE.md's strict guidelines about file placement. This includes scripts, documentation, and temporary files that should be in specific locations.

**Goal**: Identify and move/archive all stray files from the root directory to maintain clean project organization.

---

## Gate 1: Assessment (10 minutes max)

### Scan for Stray Files
```bash
# List all files in root directory (excluding expected config files)
ls -la | grep -v -E "(package\.json|tsconfig|pnpm-|turbo|README|CLAUDE|netlify|postcss|tailwind|vite\.config|vitest\.config|\.git)"

# Count potential stray files
ls -1 *.ts *.sh *.md *.sql *.txt 2>/dev/null | wc -l

# Find scripts that don't belong
find . -maxdepth 1 -name "*.sh" -o -name "*.ts" | grep -v config
```

### Critical Questions:
- [ ] **How many stray files are in the root?**
- [ ] **Are they active scripts or one-time fixes?**
- [ ] **Do any contain important documentation?**
- [ ] **Are there backup files that can be deleted?**

### Decision Point:
- [ ] **STOP HERE if < 5 stray files** - manual cleanup may be faster
- [ ] **CONTINUE if >= 5 files need organizing**

---

## Gate 2: File Categorization (15 minutes max)

### Categorize Files by Type and Purpose
Create a quick inventory:

| File Name | Type | Purpose | Status | Destination |
|-----------|------|---------|--------|-------------|
| example.sh | Script | One-time fix | Complete | Archive |
| guide.md | Docs | Active guide | Active | Move to docs/ |
| test.ts | Script | Testing util | Active | Move to scripts/ |

### File Type Rules:
1. **Scripts (.sh, .ts, .js)**
   - Active → `scripts/cli-pipeline/{domain}/`
   - One-time/complete → Archive with date
   - Test utilities → `scripts/cli-pipeline/{domain}/`

2. **Documentation (.md)**
   - Active guides → `docs/{category}/`
   - Outdated → `docs/{category}/.archive_docs/`
   - Temporary → Archive

3. **SQL Files (.sql)**
   - Migrations → `supabase/migrations/`
   - Queries → `supabase/migrations/archive/`

4. **Other Files**
   - Reports (.json) → `docs/script-reports/`
   - Backups → Archive or delete
   - Text files → Evaluate case by case

---

## Gate 3: Implementation Plan (10 minutes max)

### Create Move/Archive List
For each file, decide:
- **Move**: File is active and needs proper location
- **Archive**: File is complete/temporary but worth keeping
- **Delete**: File is truly unnecessary (rare)

### Automated Cleanup Script Structure
```typescript
interface FileMove {
  source: string;
  destination: string;
  type: 'move' | 'archive';
  reason: string;
}

const moves: FileMove[] = [
  {
    source: 'active-script.ts',
    destination: 'scripts/cli-pipeline/domain/active-script.ts',
    type: 'move',
    reason: 'Active utility script'
  },
  {
    source: 'old-fix.sh',
    destination: 'scripts/cli-pipeline/domain/.archived_scripts/old-fix.20250616.sh',
    type: 'archive',
    reason: 'One-time fix completed'
  }
];
```

---

## Gate 4: Execution (10 minutes)

### Run Cleanup
```bash
# Option 1: Use automated script
ts-node scripts/cli-pipeline/utilities/cleanup-root-strays.ts

# Option 2: Manual cleanup
git mv source-file.ts destination/path/
git mv old-script.sh archive/path/old-script.20250616.sh
```

### Validation Checklist:
- [ ] All files moved/archived successfully
- [ ] No broken references in package.json
- [ ] Git tracking updated (use git mv)
- [ ] Root directory contains only allowed files
- [ ] Report generated in `docs/script-reports/`

---

## Common Issues

### Issue 1: File References
**Problem**: Moving files breaks references in package.json or other scripts
**Solution**: Search for references before moving:
```bash
grep -r "filename.sh" . --exclude-dir=node_modules
```

### Issue 2: Git Tracking
**Problem**: Files lose git history when moved incorrectly
**Solution**: Always use `git mv` instead of regular `mv`

### Issue 3: Archive Date Format
**Problem**: Inconsistent date formatting in archived files
**Solution**: Use YYYYMMDD format: `script.20250616.sh`

---

## Automation Notes

### Key Patterns to Preserve
- Archive naming: `{original-name}.{YYYYMMDD}.{ext}`
- Directory creation: Ensure destination exists before moving
- Git operations: Check if file is tracked before using git mv

### Variables to Parameterize
- Archive date format
- Domain categorization rules
- File type mappings

### Integration Points
- Git tracking system
- File system permissions
- CI/CD pipelines that might reference moved files

---

## Success Metrics

1. **Root Directory Cleanliness**
   - Before: X stray files
   - After: 0 stray files
   - Only expected config files remain

2. **Organization Improvement**
   - All scripts in `scripts/cli-pipeline/{domain}/`
   - All docs in `docs/{category}/`
   - Clear distinction between active and archived

3. **Traceability**
   - Detailed report generated
   - All moves/archives documented
   - Clear reasoning for each decision

---

## Future Improvements

1. **Pre-commit Hook**: Prevent new files in root
2. **Scheduled Cleanup**: Monthly root directory check
3. **Developer Education**: Update onboarding docs
4. **Automated Detection**: CI check for root violations