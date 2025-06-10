# Worktree Assignment System

**Last Updated**: 2025-06-09  
**Next Review**: Tomorrow (Daily Review)  
**Status**: Active  
**Priority**: High  

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
- Worktree pills implemented in TasksPage UI
- 3-state filter (completed/unfinished/all) working
- Enhanced assign-worktrees command analyzes commit history
- Database fields added for tracking assignment metadata
- Coverage: ~35% of tasks have worktree assignments

### 📚 Lessons Learned
- Task IDs in commits provide most reliable assignments
- Commit message analysis can infer assignments with 30-60% confidence
- File change patterns help identify related tasks
- Temporal analysis (commits within task lifecycle) improves accuracy

### ✅ Recent Actions Taken
- Added 3-state completion filter to UI
- Enhanced worktree pill counts to honor completion state
- Improved assign-worktrees command with commit content analysis
- Added database fields for tracking assignment confidence

---

## Recent Updates

The worktree assignment system now supports a sophisticated 3-state filter (completed/unfinished/all) that affects all worktree pill counts. The assign-worktrees command has been enhanced to analyze commit content, not just Task IDs, allowing it to infer worktree assignments for completed tasks that don't have explicit task references in commits.

---

## Next Phase

### 🚀 Phase: Git History Server
**Target Date**: Next Week  
**Status**: Planning  

- Create lightweight server for real-time git analysis
- Cache commit data for faster queries
- Webhook integration for automatic updates
- REST API for assignment queries

---

## Upcoming Phases

### Phase 2: Machine Learning Enhancement
- Train model on confirmed assignments
- Improve inference accuracy
- Pattern recognition for common task types

### Phase 3: UI Improvements
- Visual confidence indicators
- Manual assignment interface
- Bulk assignment tools

---

## Priorities & Trade-offs

### Current Priorities
1. **Accuracy over coverage** - Better to have fewer, correct assignments
2. **Automation where possible** - Reduce manual work
3. **Transparency** - Show confidence scores and reasons

### Pros & Cons Analysis
**Pros:**
- ✅ Automatic worktree discovery
- ✅ Works retroactively on historical data
- ✅ Multiple inference strategies

**Cons:**
- ❌ Not 100% accurate for inferred assignments
- ❌ Requires periodic re-analysis
- ❌ Git operations can be slow on large repos

---

## Original Vision

Create an intelligent system that automatically assigns worktrees to tasks by analyzing git commit history, making it easy to filter and organize tasks by the development context they were worked on.

---

## ⚠️ Important Callouts

⚠️ **Run assign-worktrees regularly** - Weekly runs recommended to catch new assignments  
⚠️ **Task IDs in commits are best** - Always include `Task: #<id>` in commit messages  
⚠️ **Manual review needed** - Low confidence assignments should be verified  

---

## Full Documentation

## System Architecture

### Components

1. **UI Layer (TasksPage.tsx)**
   - Worktree pills with emoji and names
   - 3-state completion filter
   - Real-time task counts
   - Click-to-filter functionality

2. **CLI Command (assign-worktrees.ts)**
   - Git history analysis
   - Multiple assignment strategies
   - Confidence scoring
   - Batch updates

3. **Database Schema**
   ```sql
   -- dev_tasks table fields
   worktree_path TEXT
   worktree_assignment_method TEXT
   worktree_assignment_confidence INTEGER
   worktree_assignment_reason TEXT
   worktree_assigned_at TIMESTAMP
   
   -- dev_task_commit_analysis table
   task_id UUID
   commit_hash TEXT
   worktree_path TEXT
   commit_date TIMESTAMP
   confidence_score INTEGER
   match_reasons TEXT[]
   ```

### Assignment Strategies

1. **Explicit Task ID** (100% confidence)
   - Looks for `Task: #<uuid>` in commit messages
   - Most reliable method
   - Automatically tracked during commits

2. **Title Matching** (30-60% confidence)
   - Compares task titles with commit messages
   - Word-based similarity scoring
   - Filters out common words

3. **Temporal Analysis** (20% confidence boost)
   - Commits within task creation/completion window
   - Helps narrow down possibilities

4. **File Pattern Matching** (15% confidence boost)
   - Looks for files mentioned in task descriptions
   - Matches component/page/service names

### CLI Usage

```bash
# Run worktree assignment analysis
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh assign-worktrees

# Output shows:
# - Worktrees found
# - Tasks with explicit IDs
# - Inferred assignments with confidence
# - Final coverage statistics
```

### UI Features

**Completion Filter States:**
- **Unfinished** - Shows only active tasks
- **Completed** - Shows only completed/merged tasks
- **All** - Shows everything

**Worktree Pills:**
- Display emoji and alias name
- Show filtered task count
- Highlight when active
- "Unassigned" pill for tasks without worktrees

### Best Practices

1. **Always use Task IDs in commits**
   ```bash
   git commit -m "feat: add new feature
   
   Task: #8c048629-5e0e-4dbf-9631-56a9b608237c"
   ```

2. **Run assignment analysis weekly**
   ```bash
   # Add to cron
   0 9 * * 1 /path/to/dev-tasks-cli.sh assign-worktrees
   ```

3. **Review low-confidence assignments**
   - Check assignments with <50% confidence
   - Manually update if incorrect
   - Use UI to verify task locations

### Database Queries

```sql
-- Get assignment statistics
SELECT 
  worktree_assignment_method,
  COUNT(*) as count,
  AVG(worktree_assignment_confidence) as avg_confidence
FROM dev_tasks
WHERE worktree_path IS NOT NULL
GROUP BY worktree_assignment_method;

-- Find low-confidence assignments
SELECT 
  id, title, worktree_path, 
  worktree_assignment_confidence,
  worktree_assignment_reason
FROM dev_tasks
WHERE worktree_assignment_confidence < 50
ORDER BY worktree_assignment_confidence ASC;
```

### Future Enhancements

1. **Git History Server**
   - Real-time analysis
   - Caching layer
   - REST API

2. **Machine Learning**
   - Train on confirmed assignments
   - Improve pattern recognition
   - Suggest assignments

3. **UI Improvements**
   - Confidence badges
   - Manual assignment
   - Bulk operations

---

*This is part of the continuously updated documentation system. It is reviewed daily to ensure accuracy and relevance.*