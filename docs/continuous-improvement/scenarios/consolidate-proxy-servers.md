# Continuous Improvement Scenario: Consolidate Proxy Servers

## Scenario ID: `consolidate-proxy-servers`
**Category**: Infrastructure
**Complexity**: High
**Estimated Time**: 2-3 hours for evaluation, 4-6 hours for consolidation if needed
**Last Updated**: 2025-06-15

## Overview
**Problem**: Multiple proxy servers may be duplicating functionality or could be consolidated for better maintainability and resource usage.

**Goal**: Evaluate existing proxy servers and consolidate where appropriate while maintaining functionality.

---

## Gate 1: Necessity Check (15 minutes max)

### Current Proxy Server Inventory
```bash
# Copy/paste these exact commands to understand what we have:
ls scripts/cli-pipeline/proxy/start-*-proxy.ts
grep -r "proxy.*9[0-9][0-9][0-9]" CLAUDE.md
find . -name "*proxy*" -type f | grep -v node_modules | head -20
```

### Critical Questions:
- [ ] **How many proxy servers do we currently have?**
- [ ] **What unique functions does each serve?**
- [ ] **Which ones handle similar types of requests?**
- [ ] **Are there clear patterns: admin vs end-user vs streaming vs CLI?**

### Decision Point:
- [ ] **STOP HERE if < 3 proxy servers** - consolidation likely not worth effort
- [ ] **CONTINUE if >= 3 servers with potential overlap**

---

## Gate 2: Current State Analysis (30 minutes max)

### Proxy Server Categorization
```bash
# Analyze each proxy server's purpose:
grep -A 10 -B 5 "proxy.*[0-9][0-9][0-9][0-9]" CLAUDE.md
cat scripts/cli-pipeline/proxy/start-*-proxy.ts | grep -E "(app\.get|app\.post|router\.|endpoint)"
```

Create this table by examining each server:

| Server Name | Port | Primary Function | Target Users | Request Types | Dependencies |
|-------------|------|------------------|--------------|---------------|--------------|
| | | | | | |
| | | | | | |
| | | | | | |

### Consolidation Opportunities Analysis:
- [ ] **Admin Dashboard Servers**: How many serve internal admin functions?
- [ ] **CLI Pipeline Servers**: How many just execute terminal commands?
- [ ] **Content Streaming**: How many handle file/audio streaming?
- [ ] **Shared Infrastructure**: What common patterns exist?

### Critical Evaluation Questions:
1. **Necessity**: Could 2+ servers be merged without losing functionality?
2. **Simplicity**: Would consolidation reduce or increase complexity?
3. **Performance**: Do any servers have conflicting performance requirements?
4. **Maintenance**: How much effort is maintaining N separate servers?

---

## Gate 3: Consolidation Strategy (45 minutes max)

### Proposed Consolidation Groups:
Based on analysis above, propose groupings:

**Group A: Admin Dashboard Proxy**
- Functions: 
- Servers to merge: 
- New port: 
- Rationale:

**Group B: Content Streaming Proxy** 
- Functions:
- Servers to merge:
- New port:
- Rationale:

**Group C: CLI Pipeline Proxy**
- Functions:
- Servers to merge:
- New port:
- Rationale:

### Architecture Decision:
- [ ] **Single Mega-Proxy**: One proxy handles everything with routing
- [ ] **Functional Grouping**: 2-3 proxies by function (admin, streaming, CLI)
- [ ] **Keep Separate**: Current architecture is optimal
- [ ] **Hybrid Approach**: Consolidate some, keep critical ones separate

### Risk Assessment:
- [ ] **What breaks if consolidation fails?**
- [ ] **Can we rollback easily?**
- [ ] **Are there hidden dependencies between servers?**
- [ ] **Performance impact of routing overhead?**

---

## Gate 4: Implementation Planning (30 minutes max)

### Minimum Viable Consolidation:
Pick the SMALLEST possible consolidation that provides value:
- [ ] **Start with 2 most similar servers only**
- [ ] **Merge only admin dashboard functions first**
- [ ] **Keep critical streaming/audio servers separate initially**

### Implementation Steps:
1. [ ] **Backup current working state**
   ```bash
   git add -A && git commit -m "checkpoint: before proxy consolidation"
   ```

2. [ ] **Create new consolidated proxy**
   - Copy most complex existing proxy as base
   - Add route handlers from target merge proxy
   - Update port assignment in CLAUDE.md

3. [ ] **Update all references**
   - package.json pnpm commands
   - start-all-proxy-servers.ts
   - Any app code calling the proxies
   - Documentation

4. [ ] **Test thoroughly**
   - Start new consolidated proxy
   - Test all endpoints that were merged
   - Verify no regressions in apps

5. [ ] **Archive old proxies**
   - Move to .archived_scripts
   - Remove from active server lists
   - Update documentation

### Rollback Plan:
```bash
# If consolidation fails:
git reset --hard HEAD~1  # Back to checkpoint
# Restart old proxy servers
# Update any changed references back
```

---

## Implementation Phase

### Step 1: Current State Documentation
**Time Box: 15 minutes**

Run the inventory commands and fill out the analysis table above.

**Claude Code Transparency**: *If this were automated, Claude would scan all proxy files, extract endpoints, analyze dependencies, and generate the consolidation matrix automatically. For now, we gather this manually to understand the decision-making process.*

### Step 2: Identify Easiest Win
**Time Box: 15 minutes**

Look for the 2 most similar proxy servers that could be merged with minimal risk.

**Selection Criteria**:
- [ ] Similar endpoint patterns
- [ ] Same target user group (admin vs end-user)
- [ ] Similar dependencies
- [ ] Low usage/low risk if broken

### Step 3: Create Consolidated Proxy
**Time Box: 45 minutes**

Create the new proxy by merging the two selected servers.

### Step 4: Update Infrastructure
**Time Box: 30 minutes**

Update all the places that reference the old proxies.

### Step 5: Test and Validate
**Time Box: 30 minutes**

Ensure all functionality works as before.

---

## Success Criteria

### Immediate (Day 1):
- [ ] **Functionality preserved**: All endpoints work as before
- [ ] **Reduced server count**: At least 1 fewer proxy server running
- [ ] **Documentation updated**: CLAUDE.md and related docs reflect changes
- [ ] **Clean startup**: `pnpm servers` starts consolidated architecture

### 1 Week:
- [ ] **No regressions reported**: No broken functionality discovered
- [ ] **Easier maintenance**: Changes require fewer file updates
- [ ] **Clear patterns**: Consolidation logic is understandable

### 30 Day Retrospective Questions:
1. **Value**: Did consolidation actually make things simpler?
2. **Performance**: Any negative impacts on response times?
3. **Development**: Is it easier or harder to add new endpoints?
4. **Maintenance**: How much time was saved in daily operations?
5. **Future**: Should we consolidate more, or was this the right stopping point?

---

## Decision Gates Summary

- **Gate 1**: Do we have enough servers to justify consolidation effort?
- **Gate 2**: Are there clear consolidation opportunities?
- **Gate 3**: Is the proposed consolidation low-risk and valuable?
- **Gate 4**: Can we implement with minimal viable scope?

**Remember**: Build minimum that works, then decide whether to continue.

---

## Emergency Stop Conditions

- **Complexity increasing**: If consolidation makes code harder to understand
- **Performance degrading**: If response times suffer significantly  
- **Dependencies breaking**: If apps start failing unexpectedly
- **Time overrun**: If implementation takes >2x estimated time

**When in doubt, keep servers separate. Simplicity beats premature optimization.**