# Granular Success Criteria System

**Document Type**: Continuously Updated  
**Last Updated**: June 9, 2025  
**Status**: Design Phase  
**Related Task**: #7a8c0126-8821-4fe3-bdaf-58275a6431d9

## Overview

This document outlines the design and implementation plan for a granular success criteria system that tracks gates and criteria at the element level for apps, CLI pipelines, and services. The system will provide hierarchical tracking and enable better testing management across the development workflow.

## Current State Analysis

### What We Have
1. **Success Criteria Tables** (created but empty):
   - `dev_task_success_criteria` - Generic criteria for tasks
   - `dev_task_validations` - Validation results
   - `dev_task_quality_gates` - Quality gate checks
   - `dev_task_lifecycle_stages` - Lifecycle tracking

2. **Element Tracking**:
   - Apps tracked in `worktree_app_mappings`
   - CLI commands in `command_definitions`
   - Services in `shared_services`

### What's Missing
- No granular tracking of app UI pages and features
- No hierarchical relationship between elements
- No predefined criteria templates
- No connection between elements and success criteria

## Proposed Architecture

### 1. App Feature Tracking

#### New Tables:
```sql
-- Track major UI pages in each app
CREATE TABLE app_ui_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_name VARCHAR(100) NOT NULL,
    page_name VARCHAR(100) NOT NULL,
    page_path VARCHAR(200), -- e.g., '/tasks', '/worktree-mappings'
    description TEXT,
    primary_service VARCHAR(100), -- Main service this page uses
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(app_name, page_name)
);

-- Track distinctive features within pages
CREATE TABLE app_page_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES app_ui_pages(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    feature_type VARCHAR(50), -- 'component', 'action', 'display', 'integration'
    description TEXT,
    service_dependencies TEXT[], -- Array of services used
    is_critical BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Sample Data Structure:
```
dhg-admin-code
├── Claude Tasks (page)
│   ├── Task Card Display (feature)
│   ├── Success Criteria Visualization (feature)
│   ├── Edit Task Modal (feature)
│   └── Delete Task Action (feature)
└── Worktree Mappings (page)
    ├── App Selection (feature)
    ├── Pipeline Selection (feature)
    └── Service Selection (feature)
```

### 2. CLI Pipeline Command Ordering

#### Enhancement to Existing:
```sql
-- Add ordering and usage tracking
ALTER TABLE command_definitions 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_frequency INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS typical_sequence INTEGER; -- Order in typical workflow
```

### 3. Element Success Criteria Mapping

#### New Tables:
```sql
-- Generic element success criteria
CREATE TABLE element_success_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_type VARCHAR(50) NOT NULL, -- 'app_page', 'app_feature', 'cli_command', 'service'
    element_id UUID NOT NULL, -- References the specific element
    criteria_title VARCHAR(200) NOT NULL,
    criteria_description TEXT,
    validation_type VARCHAR(50), -- 'manual', 'automated', 'visual', 'functional'
    is_required BOOLEAN DEFAULT true,
    suggested_by VARCHAR(50) DEFAULT 'system', -- 'system', 'ai', 'user'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Template library for common criteria
CREATE TABLE success_criteria_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    element_type VARCHAR(50) NOT NULL,
    criteria_set JSONB NOT NULL, -- Array of criteria objects
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Plan

### Phase 1: Database Schema (Week 1)
1. Create new tables for app UI tracking
2. Enhance existing tables with ordering
3. Create element-criteria mapping tables
4. Add indexes and constraints

### Phase 2: Data Population (Week 1-2)
1. Populate app UI pages for all apps
2. Define key features for each page
3. Set command ordering for CLI pipelines
4. Create initial criteria templates

### Phase 3: UI Development (Week 2-3)
1. **Hierarchical Element Manager**:
   - Tree view of apps → pages → features
   - Command list with drag-drop ordering
   - Service listing with categories

2. **Criteria Assignment UI**:
   - Attach criteria to any element
   - Use templates or create custom
   - Set validation methods

3. **Task Integration**:
   - When creating a task, select specific elements
   - Auto-populate suggested criteria
   - Allow manual override

### Phase 4: Testing & Validation (Week 3-4)
1. Create validation workflows
2. Implement automated checks where possible
3. Build reporting dashboards

## Sample Implementation

### For Apps:
```typescript
// When selecting dhg-admin-code → Claude Tasks page
const suggestedCriteria = [
  {
    title: "Task cards display correctly",
    description: "All task information visible including title, status, dates",
    validation_type: "visual"
  },
  {
    title: "Edit modal saves changes",
    description: "Changes persist to database and reflect in UI",
    validation_type: "functional"
  },
  {
    title: "Delete confirmation works",
    description: "Inline confirmation prevents accidental deletion",
    validation_type: "functional"
  }
];
```

### For CLI Pipelines:
```typescript
// google_sync pipeline commands in order
const commandSequence = [
  { order: 1, command: "check-auth", description: "Verify authentication" },
  { order: 2, command: "list-files", description: "List available files" },
  { order: 3, command: "sync-files", description: "Synchronize selected files" },
  { order: 4, command: "verify-sync", description: "Validate sync results" }
];
```

### For Services:
```typescript
// Service success criteria
const serviceCriteria = {
  "supabase-client": [
    "Singleton pattern enforced",
    "Connection established successfully",
    "Error handling implemented"
  ]
};
```

## Benefits

1. **Granular Tracking**: Track success at the feature level, not just task level
2. **Reusable Criteria**: Build a library of common success criteria
3. **Better Testing**: Know exactly what to test for each element
4. **Progress Visibility**: See completion at multiple levels
5. **Knowledge Base**: Build institutional knowledge about what makes features successful

## Next Steps

1. Review and approve this design
2. Create migration file for new tables
3. Populate initial data
4. Build UI components
5. Integrate with existing task system

## Open Questions

1. Should we track performance criteria (speed, memory) as well?
2. How detailed should feature tracking be?
3. Should we integrate with actual test frameworks?
4. What level of automation is desired for validation?

## CLI Commands to Implement

```bash
# Populate app pages and features
./scripts/cli-pipeline/database/database-cli.sh populate-app-elements

# Generate criteria templates
./scripts/cli-pipeline/database/database-cli.sh generate-criteria-templates

# Link elements to tasks
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh link-elements <task-id>
```

## Continuous Updates

### Update Log:
- **2025-06-09**: Initial design document created
- **2025-06-09**: Database migration applied successfully
- **2025-06-09**: Initial app elements populated for dhg-admin-code and dhg-hub
- _[Future updates will be logged here]_

### Migration Status:
- [x] Database schema created
- [x] Initial data populated
- [ ] UI components built
- [ ] Integration completed

### What's Been Implemented:
1. **Database Tables Created**:
   - `app_ui_pages` - Tracks major UI pages in apps
   - `app_page_features` - Tracks features within pages
   - `element_success_criteria` - Maps criteria to elements
   - `success_criteria_templates` - Reusable criteria library
   - `dev_task_element_links` - Links tasks to specific elements

2. **Initial Data Populated**:
   - 5 pages across 2 apps (dhg-admin-code, dhg-hub)
   - 15 features mapped to pages
   - Default success criteria for all pages
   - Command ordering for google_sync and database pipelines

3. **Views Created**:
   - `app_hierarchy_view` - Shows app/page/feature hierarchy
   - `cli_commands_ordered_view` - Commands with proper ordering
   - `dev_task_elements_view` - Tasks linked to elements

---
*This document will be continuously updated as the implementation progresses.*