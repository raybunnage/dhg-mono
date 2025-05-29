# Claude Code Task Management - Simple Implementation Plan

## Overview

A pragmatic, phased approach to tracking Claude Code development tasks that starts simple and grows based on actual needs.

## Phase 1: Basic Task Tracking (Start Here)

### Core Features
- Create and track development requests
- Store Claude's responses
- Basic search and filtering
- Manual but structured workflow

### Database Schema (Minimal)

```sql
-- Simple task tracking
CREATE TABLE dev_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  task_type VARCHAR(50) DEFAULT 'feature', -- bug, feature, refactor, question
  status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
  
  -- Claude interaction
  claude_request TEXT, -- What you copy to Claude
  claude_response TEXT, -- Claude's response/summary
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

-- Simple tagging
CREATE TABLE dev_task_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  tag VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track affected files (manual entry)
CREATE TABLE dev_task_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  action VARCHAR(20) DEFAULT 'modified', -- created, modified, deleted
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### UI Components (dhg-admin-code)

#### 1. Task Creation Page
```typescript
// Simple form with:
- Title (text input)
- Description (textarea with markdown preview)
- Type (dropdown: bug, feature, refactor, question)
- Priority (dropdown: low, medium, high)
- Tags (comma-separated input)
- Submit button
```

#### 2. Task List/Dashboard
```typescript
// Table view with:
- Sortable columns (created, priority, status)
- Status filter buttons
- Search box (searches title/description)
- Click to view details
```

#### 3. Task Detail Page
```typescript
// Shows:
- All task fields
- "Copy Request to Claude" button (formats nicely)
- "Paste Claude Response" textarea
- "Mark Complete" button
- File tracking (manual list)
```

### Workflow

1. **Create Task**
   - Fill out simple form
   - System generates formatted request text
   - Save to database

2. **Work with Claude**
   - Open task detail page
   - Click "Copy Request to Claude" 
   - Paste into Claude Code
   - Do the work with Claude
   - Copy Claude's final summary

3. **Complete Task**
   - Paste Claude's response
   - Manually list affected files
   - Mark as complete

### Implementation Files

```
apps/dhg-admin-code/
├── src/
│   ├── pages/
│   │   ├── TasksPage.tsx          # List view
│   │   ├── CreateTaskPage.tsx     # Creation form
│   │   └── TaskDetailPage.tsx     # Detail/edit view
│   ├── components/
│   │   ├── TaskForm.tsx           # Reusable form
│   │   ├── TaskList.tsx           # Task table
│   │   └── ClaudeRequestDisplay.tsx # Formatted request
│   └── services/
│       └── task-service.ts        # CRUD operations
```

## Phase 2: Enhanced Tracking (After Using Phase 1)

Based on actual usage patterns, add:

### Work Session Tracking
```sql
CREATE TABLE dev_task_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES dev_tasks(id) ON DELETE CASCADE,
  session_notes TEXT,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Better File Tracking
- Parse Claude's response to auto-extract file paths
- Show git diff for affected files
- Link to file in codebase

### Templates
- Common request templates
- Standardized Claude prompts
- Quick-create for common tasks

## Phase 3: Automation (Only If Needed)

### Potential Features
- Git branch name suggestions
- Export tasks to markdown
- Basic analytics (tasks per week, completion time)
- Integration with work summaries

## Key Principles

### 1. Manual But Structured
- No complex automation initially
- Focus on consistent data capture
- Make manual steps easy

### 2. Start Small
- Launch with minimum viable features
- Use for a week before adding features
- Let real pain points drive development

### 3. Data First
- Capture the data even if UI is basic
- Can always build better visualizations later
- Searchable history is the main value

## Implementation Checklist

### Day 1
- [ ] Create database tables
- [ ] Basic task service (CRUD operations)
- [ ] Simple creation form
- [ ] Task list page

### Day 2  
- [ ] Task detail page
- [ ] Copy/paste functionality
- [ ] Status management
- [ ] Basic search

### Nice to Have (Later)
- [ ] Markdown preview
- [ ] Tag management
- [ ] File tracking
- [ ] Export features

## Success Metrics

You'll know this is working when:
1. You consistently log all Claude requests
2. You can find previous solutions quickly
3. You have visibility into what's in progress
4. The overhead feels minimal

## What This is NOT

- Not trying to automate Claude interactions
- Not managing git branches automatically
- Not parsing Claude responses automatically
- Not tracking tokens or costs
- Not coordinating multiple Claude instances

## Next Steps

1. Review this simplified plan
2. Approve the approach
3. Implement Phase 1 only
4. Use for a week
5. Iterate based on real experience

This approach gives you structured task tracking without the complexity of automation, file watching, or multi-instance coordination. It's essentially a specialized issue tracker designed for Claude Code workflows.