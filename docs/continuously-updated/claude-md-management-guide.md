# Claude.md Management Guide - Living Documentation

**Last Updated**: June 9, 2025  
**Next Review**: June 16, 2025 (7 days)  
**Status**: Active  
**Priority**: Critical  
**Related Archives**: 0 documents  

---

## 📋 Table of Contents

1. [Current Status & Lessons Learned](#current-status--lessons-learned)
2. [Recent Updates](#recent-updates)
3. [Next Phase](#next-phase)
4. [Upcoming Phases](#upcoming-phases)
5. [Priorities & Trade-offs](#priorities--trade-offs)
6. [Original Vision](#original-vision)
7. [Important Callouts](#important-callouts)
8. [Full Documentation](#full-documentation)

---

## Current Status & Lessons Learned

### 🎯 Current Status

CLAUDE.md is currently at 38,773 characters (96.9% of the 40k limit). The file contains critical instructions that represent hard-won knowledge about the project, making every line valuable.

**What's Working Well**:
- ✅ Core instructions prevent common mistakes
- ✅ Clear troubleshooting patterns save time
- ✅ Version tracking (currently v1.06)
- ✅ Overflow folder `docs/claude_info_special/` for database-specific guidance

**Current Priority**:
- **Immediate Focus**: Stop automatic additions to CLAUDE.md
- **Blocking Issues**: File size approaching 40k limit
- **Next Milestone**: Establish sustainable management system

### 📚 Lessons Learned

1. **Every instruction matters** - Removing content leads to repeated mistakes
2. **Automatic additions cause overflow** - Need manual curation process
3. **40k limit is strict** - IDE truncates beyond this
4. **Overflow strategy works** - `claude_info_special/` folder effective for context-specific info
5. **Version control essential** - Track what changes and why

### ✅ Recent Actions Taken
- Identified current size: 38,773 characters
- Found instruction in CLAUDE.md that prompts updates (line 315-320)
- Created this management guide
- Established candidate tracking system

---

## Recent Updates

- **June 9, 2025**: Created this guide to manage CLAUDE.md size sustainably
- **June 9, 2025**: Identified automatic update instruction that needs removal
- **Current**: CLAUDE.md at v1.06, 38,773 characters (96.9% capacity)

---

## Next Phase

### 🚀 Phase: Immediate Actions
**Target Date**: Today  
**Status**: In Progress  

- [x] Create this management guide
- [ ] Remove automatic update instruction from CLAUDE.md
- [ ] Update any clipboard snippets that reference CLAUDE.md updates
- [ ] Establish clear guidelines for what stays in main file
- [ ] Document overflow strategy

---

## Upcoming Phases

### Phase 2: Sustainable Management (This Week)
- Implement review process for candidates
- Create categories for instruction types
- Establish priority system for inclusion
- Regular size monitoring

### Phase 3: Enhanced Organization (Next Week)
- Explore claude.local files for project-specific overrides
- Create instruction index for quick reference
- Build search capability across all Claude instructions
- Version control for major changes

---

## Priorities & Trade-offs

### Current Priorities
1. **Keep under 40k** - Hard limit that cannot be exceeded
2. **Preserve critical knowledge** - Every line represents learned experience
3. **Manual curation only** - No automatic additions

### Pros & Cons Analysis
**Current Approach (Single File)**:
- ✅ Simple, always loaded
- ✅ No context switching
- ❌ Size limited
- ❌ Everything or nothing

**Alternative Approaches**:
- **Overflow folders**: Already using, works well for context-specific info
- **Claude.local files**: Could provide project-specific overrides
- **Modular system**: Could load based on task type

---

## Original Vision

CLAUDE.md should remain the authoritative source of critical project knowledge while staying within the 40k character limit. New learnings should be captured but carefully curated before inclusion.

---

## ⚠️ Important Callouts

⚠️ **DO NOT automatically add to CLAUDE.md** - All additions must be manually reviewed

⚠️ **Size limit is absolute** - IDE will truncate content beyond 40k characters

⚠️ **Use overflow folders** - `docs/claude_info_special/` for context-specific instructions

⚠️ **Version changes carefully** - Update version number when making significant edits

---

## Full Documentation

### Size Management Strategy

**Current Allocation** (38,773 / 40,000 characters):
- Core Instructions: ~15k characters
- Troubleshooting: ~10k characters  
- Code Examples: ~8k characters
- Patterns & Practices: ~5k characters
- Buffer: 1,227 characters (3.1%)

**Overflow Locations**:
1. `docs/claude_info_special/` - Database and specialized instructions
2. `docs/continuously-updated/` - Living documentation
3. Context-specific README files in relevant directories

### Instruction Categories

**Priority 1 - Core (Must Stay)**:
- Critical warnings (data loss, deployment issues)
- Authentication patterns
- Database naming conventions
- Git workflow (especially worktree management)

**Priority 2 - Important (Usually Stay)**:
- Common troubleshooting patterns
- Architecture decisions
- Service patterns (singletons, adapters)
- CLI integration requirements

**Priority 3 - Helpful (Consider Moving)**:
- Specific examples (unless exemplary)
- Detailed explanations (can summarize)
- Historical context (can archive)

### Update Prevention Checklist

1. **Remove from CLAUDE.md**:
   ```markdown
   <!-- DELETE THIS SECTION -->
   4. **Document Solutions After Struggles**:
      - ⚠️ **After overcoming significant challenges, update this CLAUDE.md file**
      - Add concise troubleshooting guidance for future reference
      - Include specific error messages, root causes, and solutions
      - Follow the existing format with ❌ Problem and ✅ Solution examples
      - Focus on patterns that could help with similar issues in the future
   ```

2. **Check Clipboard Snippets**:
   - Search for snippets containing "update CLAUDE.md"
   - Remove or modify update instructions
   - Replace with "document in claude-md-candidates.md"

3. **Update Documentation Templates**:
   - Change references from "update CLAUDE.md" to "add to candidates"
   - Ensure new patterns documented elsewhere first

### Candidates for CLAUDE.md

**Pending Review** (Add new learnings here):

1. **[Date]** - **Pattern/Issue**: 
   - Problem: 
   - Solution: 
   - Why Important: 
   - Size Impact: X characters

2. **Example Entry**:
   - **2025-06-09** - **Worktree PR Issues**:
     - Problem: Creating PRs from worktrees causes deployment failures
     - Solution: Always use direct push: `git push origin branch:development`
     - Why Important: Prevents stuck deployments
     - Size Impact: ~200 characters

### Review Process

**Weekly Review** (Every Monday):
1. Check current size: `wc -c CLAUDE.md`
2. Review candidates in this document
3. Evaluate priority and size impact
4. Make swaps if necessary (remove lower priority for higher)
5. Update version number if changes made
6. Commit with clear message

**Monthly Audit**:
1. Full content review
2. Identify redundancies
3. Check for outdated information
4. Consolidate similar patterns
5. Archive historical items

### Alternative Solutions

1. **Claude.local Files**:
   - Could provide project/worktree specific overrides
   - Would need IDE support investigation
   - Benefit: Additional context without main file bloat

2. **Task-Based Loading**:
   - Different instruction sets for different task types
   - Example: `claude-database.md`, `claude-frontend.md`
   - Requires task detection mechanism

3. **Smart Truncation**:
   - Keep core always loaded
   - Dynamically load troubleshooting based on errors
   - Requires preprocessing system

4. **Instruction Index**:
   - Minimal CLAUDE.md with references
   - Full instructions in separate files
   - Quick lookup system

### Monitoring Commands

```bash
# Check current size
wc -c CLAUDE.md

# Find large sections
grep -n "^##" CLAUDE.md | while read line; do
  num=$(echo $line | cut -d: -f1)
  section=$(echo $line | cut -d: -f2-)
  next=$(grep -n "^##" CLAUDE.md | grep -A1 "^$num:" | tail -1 | cut -d: -f1)
  if [ -z "$next" ]; then next=$(wc -l CLAUDE.md | awk '{print $1}'); fi
  size=$(sed -n "${num},${next}p" CLAUDE.md | wc -c)
  echo "$size characters: $section"
done | sort -nr

# Check for update references
grep -n "update.*CLAUDE\.md\|CLAUDE\.md.*update" .
```

### Size Optimization Techniques

1. **Consolidate Examples**:
   - Use one good example instead of multiple
   - Reference pattern once, apply everywhere

2. **Remove Redundancy**:
   - Combine similar warnings
   - Use consistent terminology

3. **Compress Formatting**:
   - Minimize whitespace
   - Use shorter section headers
   - Combine related items

4. **External References**:
   - Link to detailed docs instead of inline
   - Use "See X for details" pattern

### Emergency Procedures

**If Over 40k**:
1. Immediate: Move troubleshooting section to overflow
2. Quick wins: Remove examples, compress formatting  
3. Review: Recent additions for temporary removal
4. Archive: Historical patterns no longer relevant

**Restoration Process**:
1. Keep removed content in this guide
2. Document why removed and when
3. Consider for re-inclusion when space available
4. Track in version history

---

*This is part of the continuously updated documentation system. It is reviewed every 7 days to ensure CLAUDE.md stays within limits while preserving critical knowledge.*