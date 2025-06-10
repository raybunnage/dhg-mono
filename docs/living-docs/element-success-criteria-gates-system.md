# Element Success Criteria & Gates System

**Last Updated**: 2025-06-09  
**Next Review**: 2025-06-10 (Daily Review)  
**Status**: Planning  
**Priority**: High  

> Living Document - Tracks the implementation of success criteria and quality gates tied to granular elements (app features, CLI commands, services)

---

## 📋 Table of Contents

1. [Current Status & Analysis](#current-status--analysis)
2. [System Design](#system-design)
3. [Implementation Plan](#implementation-plan)
4. [Database Schema](#database-schema)
5. [UI Requirements](#ui-requirements)
6. [CLI Pipeline Integration](#cli-pipeline-integration)
7. [Benefits & Impact](#benefits--impact)
8. [Next Steps](#next-steps)

---

## Current Status & Analysis

### 🎯 Current State
- **Existing Infrastructure**:
  - ✅ `dev_task_success_criteria` table exists (tied to tasks)
  - ✅ `dev_task_quality_gates` table exists (tied to tasks)
  - ✅ `app_features` table catalogs app components/pages
  - ✅ `dev_task_elements` links tasks to specific elements
  - ✅ Element catalog system implemented (Task #08b7bdfe)

- **Missing Components**:
  - ❌ Success criteria tied to elements (not just tasks)
  - ❌ Quality gates tied to elements
  - ❌ Hierarchical management UI for elements
  - ❌ Suggested criteria/gates based on element type
  - ❌ CLI commands to populate element criteria

### 📚 Problem Statement
Currently, when creating tasks, users see "no criteria defined" and "no gates defined". Success criteria and gates are defined per-task, leading to:
- Repetitive definition of similar criteria
- Inconsistent testing standards
- No reusable templates
- No organizational learning from past criteria

---

## System Design

### 🏗️ Conceptual Architecture

```
Elements (App Features, CLI Commands, Services)
    ↓
Element Success Criteria (Reusable Templates)
    ↓
Element Quality Gates (Standard Checkpoints)
    ↓
Task Creation → Inherits/Suggests Criteria & Gates
    ↓
Manual Override/Customization
```

### 📊 Element Hierarchy

1. **Apps**
   ```
   App (dhg-hub)
   ├── Pages (Dashboard, Settings, Profile)
   │   ├── Features (UserList, Analytics, Export)
   │   │   └── Success Criteria & Gates
   │   └── Page-level Criteria & Gates
   └── App-level Criteria & Gates
   ```

2. **CLI Pipelines**
   ```
   Pipeline (google_sync)
   ├── Commands (sync-files, check-status, validate)
   │   └── Command-specific Criteria & Gates
   └── Pipeline-level Criteria & Gates
   ```

3. **Services**
   ```
   Service (ElementCatalogService)
   └── Service-level Criteria & Gates
   ```

---

## Implementation Plan

### Phase 1: Database Schema (Week 1)
- [ ] Create `element_success_criteria` table
- [ ] Create `element_quality_gates` table
- [ ] Create `element_criteria_templates` table
- [ ] Add relationships to existing element tables
- [ ] Create views for easy querying

### Phase 2: Data Population (Week 1-2)
- [ ] Create CLI command for suggesting criteria based on element type
- [ ] Populate default criteria templates
- [ ] Create migration to copy existing task criteria to elements

### Phase 3: UI Development (Week 2-3)
- [ ] Element hierarchy management page
- [ ] Criteria/gates editor interface
- [ ] Task creation integration (inherit criteria)
- [ ] Bulk operations support

### Phase 4: Integration (Week 3-4)
- [ ] Update CreateTaskPage to show inherited criteria
- [ ] Add override capabilities
- [ ] Create reporting views
- [ ] Add validation automation

---

## Database Schema

### New Tables Required

```sql
-- Success criteria tied to elements
CREATE TABLE element_success_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_type TEXT NOT NULL CHECK (element_type IN ('app_feature', 'cli_command', 'shared_service', 'app', 'pipeline')),
  element_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  success_condition TEXT NOT NULL,
  criteria_type TEXT NOT NULL CHECK (criteria_type IN ('functional', 'performance', 'security', 'ux', 'integration')),
  is_required BOOLEAN DEFAULT true,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  validation_method TEXT,
  validation_script TEXT,
  suggested_by TEXT, -- 'system', 'user', 'ai'
  is_template BOOLEAN DEFAULT false,
  parent_criteria_id UUID REFERENCES element_success_criteria(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(element_type, element_id, title)
);

-- Quality gates tied to elements
CREATE TABLE element_quality_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  element_type TEXT NOT NULL CHECK (element_type IN ('app_feature', 'cli_command', 'shared_service', 'app', 'pipeline')),
  element_id UUID NOT NULL,
  gate_name TEXT NOT NULL,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('pre-commit', 'pre-merge', 'post-deploy', 'continuous')),
  description TEXT,
  check_script TEXT,
  auto_check BOOLEAN DEFAULT false,
  is_blocking BOOLEAN DEFAULT true,
  order_sequence INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(element_type, element_id, gate_name)
);

-- Templates for common criteria patterns
CREATE TABLE element_criteria_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL UNIQUE,
  element_type TEXT NOT NULL,
  feature_type TEXT, -- 'page', 'component', 'hook', etc.
  criteria_set JSONB NOT NULL, -- Array of criteria definitions
  gates_set JSONB NOT NULL, -- Array of gate definitions
  description TEXT,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Track which criteria/gates are inherited vs customized
CREATE TABLE task_criteria_inheritance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES dev_tasks(id),
  element_criteria_id UUID REFERENCES element_success_criteria(id),
  element_gate_id UUID REFERENCES element_quality_gates(id),
  is_inherited BOOLEAN DEFAULT true,
  is_modified BOOLEAN DEFAULT false,
  modifications JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enhanced view for element hierarchy with criteria counts
CREATE OR REPLACE VIEW element_hierarchy_view AS
SELECT 
  CASE 
    WHEN af.parent_feature_id IS NULL THEN 'page'
    ELSE 'feature'
  END as level_type,
  af.app_name,
  af.id as element_id,
  af.feature_name as element_name,
  af.file_path,
  af.feature_type,
  af.parent_feature_id,
  paf.feature_name as parent_name,
  (SELECT COUNT(*) FROM element_success_criteria WHERE element_type = 'app_feature' AND element_id = af.id) as criteria_count,
  (SELECT COUNT(*) FROM element_quality_gates WHERE element_type = 'app_feature' AND element_id = af.id) as gates_count,
  (SELECT COUNT(*) FROM app_features WHERE parent_feature_id = af.id) as child_count
FROM app_features af
LEFT JOIN app_features paf ON af.parent_feature_id = paf.id;
```

### Functions for Criteria Management

```sql
-- Function to suggest criteria based on element type
CREATE OR REPLACE FUNCTION suggest_element_criteria(
  p_element_type TEXT,
  p_element_id UUID
) RETURNS TABLE (
  title TEXT,
  description TEXT,
  success_condition TEXT,
  criteria_type TEXT,
  priority TEXT
) AS $$
BEGIN
  -- Logic to suggest criteria based on element characteristics
  -- This will be enhanced with AI integration later
  RETURN QUERY
  SELECT 
    t.title,
    t.description,
    t.success_condition,
    t.criteria_type,
    t.priority
  FROM element_criteria_templates t
  WHERE t.element_type = p_element_type;
END;
$$ LANGUAGE plpgsql;

-- Function to inherit criteria when creating a task
CREATE OR REPLACE FUNCTION inherit_element_criteria(
  p_task_id UUID,
  p_element_type TEXT,
  p_element_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Copy element criteria to task criteria
  INSERT INTO dev_task_success_criteria (
    task_id, title, description, success_condition,
    criteria_type, is_required, priority, validation_method
  )
  SELECT 
    p_task_id,
    ec.title,
    ec.description,
    ec.success_condition,
    ec.criteria_type,
    ec.is_required,
    ec.priority,
    ec.validation_method
  FROM element_success_criteria ec
  WHERE ec.element_type = p_element_type
    AND ec.element_id = p_element_id
    AND ec.is_required = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  -- Track inheritance
  INSERT INTO task_criteria_inheritance (
    task_id, element_criteria_id, is_inherited
  )
  SELECT 
    p_task_id,
    ec.id,
    true
  FROM element_success_criteria ec
  WHERE ec.element_type = p_element_type
    AND ec.element_id = p_element_id;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```

---

## UI Requirements

### 1. Element Hierarchy Manager
**Location**: `/admin/element-hierarchy`

**Features**:
- Tree view of apps → pages → features
- Inline criteria/gates count badges
- Expand/collapse navigation
- Bulk operations toolbar
- Search and filter capabilities

**Mockup Structure**:
```
🏢 dhg-hub (3 criteria, 2 gates)
  ├── 📄 Dashboard (5 criteria, 3 gates)
  │   ├── 🔧 UserList (2 criteria, 1 gate)
  │   └── 🔧 Analytics (3 criteria, 2 gates)
  └── 📄 Settings (4 criteria, 2 gates)
      └── 🔧 ProfileForm (2 criteria, 1 gate)
```

### 2. Criteria/Gates Editor
**Location**: Inline editor in hierarchy view

**Features**:
- Add/Edit/Delete criteria and gates
- Template suggestions dropdown
- Priority and type selectors
- Validation script editor
- Preview inherited vs custom

### 3. Task Creation Enhancement
**Updates to CreateTaskPage**:
- Show inherited criteria count
- "Customize Criteria" button
- Preview panel for inherited items
- Override toggles for each criterion

---

## CLI Pipeline Integration

### New CLI Pipeline: `element-criteria`
**Location**: `scripts/cli-pipeline/element_criteria/`

```bash
# Commands to implement
./element-criteria-cli.sh suggest --type app_feature --id <uuid>
./element-criteria-cli.sh populate-templates
./element-criteria-cli.sh analyze --app dhg-hub
./element-criteria-cli.sh import --from-tasks
./element-criteria-cli.sh validate --element <id>
```

### Integration with Registry Pipeline
Enhance existing registry commands:
```bash
./registry-cli.sh scan-app-features --with-criteria
./registry-cli.sh suggest-criteria --app dhg-hub
```

---

## Benefits & Impact

### 🎯 Immediate Benefits
1. **Consistency**: Standard criteria across similar elements
2. **Efficiency**: No need to redefine criteria for each task
3. **Quality**: Enforced gates improve code quality
4. **Discoverability**: See what success looks like before starting

### 📈 Long-term Impact
1. **Organizational Learning**: Build a library of effective criteria
2. **Automation**: Enable automated validation of criteria
3. **Metrics**: Track which criteria predict success
4. **Evolution**: Refine criteria based on outcomes

---

## Next Steps

### Week 1 Priority Actions
1. [ ] Create database migration for new tables
2. [ ] Implement basic CLI commands for populating templates
3. [ ] Create minimal UI for viewing element criteria
4. [ ] Update CreateTaskPage to show inherited criteria count

### Quick Wins
1. **Populate Templates**: Create 10-15 common criteria templates
2. **Import Existing**: Analyze existing task criteria for patterns
3. **Documentation**: Add criteria examples to element catalog guide

### Dependencies
- Element Catalog System (✅ Completed)
- Dev Tasks System (✅ Exists)
- Registry Pipeline (✅ Exists)

---

## Implementation Considerations

### Performance
- Criteria inheritance should be async
- Cache frequently used templates
- Lazy load criteria in UI

### Security
- Validate custom validation scripts
- Sanitize user inputs
- Audit criteria changes

### Scalability
- Consider criteria versioning
- Plan for criteria analytics
- Design for multi-tenant future

---

## Success Metrics

1. **Adoption**: % of tasks using inherited criteria
2. **Efficiency**: Time saved in task creation
3. **Quality**: Reduction in failed gates
4. **Coverage**: % of elements with defined criteria

---

## Related Documents
- [Element Catalog System Guide](./element-catalog-system-guide.md)
- [Dev Tasks System](./dev-tasks-system.md)
- [Database Architecture Guide](./database-architecture-guide.md)