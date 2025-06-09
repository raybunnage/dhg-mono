# CLAUDE.md Candidates - Living Documentation

**Last Updated**: June 9, 2025  
**Next Review**: June 16, 2025 (7 days)  
**Status**: Active  
**Priority**: High  
**Purpose**: Track learnings and patterns that may need inclusion in CLAUDE.md

---

## 📋 Table of Contents

1. [Pending Review](#pending-review)
2. [Recently Added to CLAUDE.md](#recently-added-to-claude-md)
3. [Rejected/Deferred](#rejected-deferred)
4. [Archived Patterns](#archived-patterns)

---

## Pending Review

### 🔍 Items for Consideration

#### 1. **Database View Naming Update** (June 2025)
**Size Impact**: ~150 characters  
**Priority**: High  
**Problem**: Views not sorting with their primary tables  
**Solution**: Views MUST use prefix of their primary table (not just any prefix)  
```markdown
**Database View Naming Convention**:
- All views MUST end with `_view` suffix for clarity
- ⚠️ **CRITICAL: Views MUST use the prefix of their primary table**
- This ensures views sort alphabetically with their related tables
```
**Why Important**: Prevents confusion when views sort separately from their tables  
**Status**: Consider for next update

#### 2. **Worktree-Specific .env Files** (June 2025)
**Size Impact**: ~200 characters  
**Priority**: Medium  
**Problem**: Worktrees share .env files causing conflicts  
**Solution**: Each worktree can have its own .env.development  
**Why Important**: Enables parallel development with different configs  
**Status**: Monitor for common issues first

#### 3. **TypeScript Path Resolution in Shared Packages** (June 2025)
**Size Impact**: ~300 characters  
**Priority**: Medium  
**Problem**: Shared packages can't use import.meta.env directly  
**Solution**: Pass environment through dependency injection  
```typescript
// ❌ In shared package
const key = import.meta.env.VITE_API_KEY;

// ✅ In shared package  
constructor(env: ImportMetaEnv) {
  this.key = env.VITE_API_KEY;
}
```
**Why Important**: Common error when creating shared services  
**Status**: Already partially documented, needs consolidation

#### 4. **Git Hooks and Worktree Awareness** (June 2025)
**Size Impact**: ~250 characters  
**Priority**: Low  
**Problem**: Git hooks don't know which worktree they're in  
**Solution**: Check `git rev-parse --show-toplevel` in hooks  
**Why Important**: Affects automated task tracking  
**Status**: Edge case, defer unless becomes common

#### 5. **Supabase RLS Policy Debugging** (June 2025)
**Size Impact**: ~400 characters  
**Priority**: Medium  
**Problem**: RLS policies fail silently  
**Solution**: Always test with service role first, then add RLS  
**Why Important**: Major time sink when debugging  
**Status**: Consider for troubleshooting section

---

## Recently Added to CLAUDE.md

### ✅ Successfully Integrated (Last 30 days)

#### 1. **Worktree Branch Management** (Added: v1.06)
- Clear explanation of worktree workflow
- Push strategies for different branches
- NO PR warning for worktrees

#### 2. **Multiple Supabase Files Fix** (Added: v1.05)
- Pattern for consolidating multiple supabase client files
- Clear examples of correct implementation

#### 3. **Service Dependency Mapping** (Added: v1.05)
- New system documentation
- CLI commands for service analysis

---

## Rejected/Deferred

### ❌ Not Suitable for CLAUDE.md

#### 1. **Detailed Modal.com Setup** (Rejected: June 2025)
**Reason**: Too specific, belongs in audio processing docs  
**Alternative**: Created `docs/solution-guides/MODAL_AUDIO_PROCESSING_GUIDE.md`

#### 2. **Complete Database Schema** (Deferred: June 2025)
**Reason**: Too large, changes frequently  
**Alternative**: Reference to `supabase/types.ts` sufficient

#### 3. **All CLI Pipeline Commands** (Rejected: May 2025)
**Reason**: Would add 5k+ characters  
**Alternative**: Keep in `cli-pipelines-documentation.md`

#### 4. **Detailed Git Workflow** (Deferred: May 2025)
**Reason**: Covered sufficiently with current instructions  
**Alternative**: Enhanced existing git section instead

---

## Archived Patterns

### 📦 Removed from CLAUDE.md (Still Valid)

#### 1. **NPM to PNPM Migration** (Removed: v1.04)
**Original Size**: 500 characters  
**Reason**: Migration complete, no longer relevant  
**Location**: `docs/archive/npm-to-pnpm-migration.md`

#### 2. **Legacy Database Tables** (Removed: v1.05)
**Original Size**: 800 characters  
**Reason**: Tables renamed, old names irrelevant  
**Location**: `docs/claude_info_special/database/legacy-table-names.md`

#### 3. **Old CLI Structure** (Removed: v1.03)
**Original Size**: 600 characters  
**Reason**: Restructured to pipeline architecture  
**Location**: `docs/archive/old-cli-structure.md`

---

## Review Guidelines

### When to Add to CLAUDE.md

**Must Have ALL**:
- [ ] Prevents data loss or major errors
- [ ] Applies across multiple areas
- [ ] Not easily discoverable otherwise
- [ ] Under 400 characters (ideally under 200)
- [ ] No existing similar pattern

### When to Keep in Overflow

**Any of These**:
- Context-specific (database only, UI only, etc.)
- Requires detailed explanation
- Changes frequently
- Can be discovered through error messages
- Over 400 characters

### Size Optimization Tips

1. **Combine Similar Patterns**:
   ```markdown
   ❌ Problem: Error X when doing A
   ✅ Solution: Do B
   
   ❌ Problem: Error Y when doing A  
   ✅ Solution: Do B
   
   <!-- Better -->
   ❌ Problem: Errors when doing A
   ✅ Solution: Always do B
   ```

2. **Use References**:
   ```markdown
   <!-- Instead of full explanation -->
   See `docs/claude_info_special/topic.md` for details
   ```

3. **Compress Examples**:
   ```markdown
   <!-- Instead of multiple examples -->
   ❌ createClient() - NEVER use directly
   ✅ SupabaseClientService.getInstance() - Always
   ```

---

## Tracking Template

```markdown
#### N. **Title** (Date)
**Size Impact**: ~X characters  
**Priority**: High/Medium/Low  
**Problem**: One line description  
**Solution**: Brief solution  
**Why Important**: Impact if not included  
**Status**: Consider/Monitor/Defer
```

---

*This document tracks all candidates for CLAUDE.md inclusion. Review weekly alongside the main management guide.*