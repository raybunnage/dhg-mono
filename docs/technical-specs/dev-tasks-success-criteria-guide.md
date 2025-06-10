# Dev Tasks Success Criteria Implementation Guide

## Overview

The Dev Tasks system now includes comprehensive success criteria tracking, validation, and lifecycle management to support continuous development practices. This guide explains how to use these new features.

## What's New

### Enhanced Fields in dev_tasks Table

- **success_criteria_defined**: Boolean indicating if criteria are set
- **validation_status**: Current validation state (pending, validating, validated, failed_validation)
- **quality_gates_status**: Overall quality gate status
- **completion_confidence**: Score 1-10 indicating confidence in completion
- **risk_assessment**: Risk level (low, medium, high, critical)
- **current_lifecycle_stage**: Current stage (planning, development, testing, review, integration, completed)
- **success_criteria_count**: Total number of criteria
- **success_criteria_met**: Number of criteria passed

### New Tables

1. **dev_task_success_criteria**: Define measurable success criteria
2. **dev_task_validations**: Track validation attempts and results
3. **dev_task_quality_gates**: Quality checkpoints (TypeScript, lint, tests, etc.)
4. **dev_task_lifecycle_stages**: Track lifecycle progression

## Visual Status Display

The TaskCard component now displays:

- **Lifecycle Stage** with icon (🕐 Planning, 💻 Development, 🧪 Testing, etc.)
- **Progress Status** (Submitted to Claude, In development, Has commits, etc.)
- **Completion Score** (0-100% based on criteria, gates, and commits)
- **Success Criteria Progress** (e.g., "3/5 criteria (60%)")
- **Quality Gates Status** (e.g., "2/4 gates (1 failed)")
- **Risk Assessment Badge** (Medium Risk, High Risk, Critical Risk)

## Using Success Criteria CLI

### 1. Add Success Criteria to a Task

```bash
# Add a functional criteria
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria add \
  --task <task-id> \
  --title "Authentication flow redirects properly" \
  --type functional \
  --description "After login, users should be redirected to their intended page" \
  --method manual \
  --condition "User lands on originally requested page after auth" \
  --priority high

# Add a technical criteria
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria add \
  --task <task-id> \
  --title "TypeScript compilation passes" \
  --type technical \
  --method automated \
  --condition "tsc --noEmit returns 0" \
  --priority high

# Add a quality criteria
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria add \
  --task <task-id> \
  --title "Code coverage above 80%" \
  --type quality \
  --method automated \
  --condition "Jest coverage report shows >80%" \
  --priority medium \
  --optional
```

### 2. List Success Criteria

```bash
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria list --task <task-id>

# Output:
📋 Success Criteria:

1. Authentication flow redirects properly
   Type: functional
   Priority: high
   Required: Yes
   Validation: manual
   Condition: User lands on originally requested page after auth

2. TypeScript compilation passes
   Type: technical
   Priority: high
   Required: Yes
   Validation: automated
   Condition: tsc --noEmit returns 0

✅ Progress: 1/2 criteria met
```

### 3. Validate Criteria

```bash
# Mark criteria as passed
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria validate \
  --criteria <criteria-id> \
  --status passed \
  --notes "Tested with multiple user types, all redirected correctly"

# Mark criteria as failed
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria validate \
  --criteria <criteria-id> \
  --status failed \
  --notes "TypeScript errors in auth callback component"
```

### 4. Add Standard Quality Gates

```bash
# Adds standard gates: TypeScript, ESLint, Unit Tests, Code Review
./scripts/cli-pipeline/dev_tasks/dev-tasks-cli.sh success-criteria add-gates --task <task-id>
```

## Criteria Types

### Functional Criteria
- User-facing features work as expected
- Business logic produces correct results
- Integration points function properly

### Technical Criteria
- Code compiles without errors
- Performance benchmarks met
- Security requirements satisfied

### Quality Criteria
- Code coverage thresholds
- Documentation completeness
- Code review approval

### Testing Criteria
- Unit tests pass
- Integration tests pass
- E2E tests cover critical paths

## Validation Methods

1. **Manual**: Human verification required
2. **Automated**: Script or test can validate
3. **Code Review**: Peer review required
4. **Testing**: Test suite validates

## Lifecycle Stages

Tasks progress through these stages:

1. **Planning**: Requirements gathering, criteria definition
2. **Development**: Active coding, feature implementation
3. **Testing**: Running tests, validating criteria
4. **Review**: Code review, quality checks
5. **Integration**: Merging, deployment prep
6. **Completed**: All criteria met, deployed

## Completion Score Calculation

The overall completion score (0-100%) is calculated as:

- **25%**: Base progress (status-based)
- **35%**: Success criteria completion
- **25%**: Quality gates passed
- **15%**: Git commits present

## Best Practices

### 1. Define Criteria Early
Add success criteria during the planning stage:
```bash
# When creating a task, immediately add criteria
./dev-tasks-cli.sh create --title "Add CSV export" --type feature
./dev-tasks-cli.sh success-criteria add --task <task-id> --title "Export includes all visible columns"
```

### 2. Use Measurable Conditions
Good criteria have clear, testable conditions:
- ✅ "Response time < 200ms for 95% of requests"
- ❌ "Performance is good"

### 3. Automate Where Possible
Set up automated validation for technical criteria:
```bash
--method automated --validation-script "npm test -- --coverage"
```

### 4. Track Risk Early
Update risk assessment as issues arise:
```sql
UPDATE dev_tasks SET risk_assessment = 'high' WHERE id = '<task-id>';
```

### 5. Use Quality Gates
Standard gates ensure consistent quality:
- TypeScript compilation
- Linting passes
- Tests pass
- Code review approved

## Integration with Continuous Development

### 1. Pre-commit Validation
Run automated criteria checks before committing:
```bash
# Future enhancement: pre-commit hook
./validate-criteria.sh <task-id>
```

### 2. CI/CD Integration
Quality gates can be checked in CI pipelines:
```yaml
# Future: GitHub Actions integration
- name: Check Task Criteria
  run: ./check-task-criteria.sh ${{ env.TASK_ID }}
```

### 3. Progress Tracking
Monitor task progress through the UI:
- Visual indicators for each criterion
- Overall completion percentage
- Risk indicators for attention

## SQL Queries for Reporting

### Tasks with Unmet Criteria
```sql
SELECT dt.title, dt.success_criteria_count, dt.success_criteria_met,
       dt.criteria_completion_percentage
FROM dev_tasks_enhanced_view dt
WHERE dt.success_criteria_count > dt.success_criteria_met
  AND dt.status NOT IN ('completed', 'cancelled')
ORDER BY dt.priority DESC;
```

### High-Risk Tasks
```sql
SELECT title, risk_assessment, overall_completion_score
FROM dev_tasks_enhanced_view
WHERE risk_assessment IN ('high', 'critical')
  AND status = 'in_progress';
```

### Quality Gate Failures
```sql
SELECT dt.title, qg.gate_name, qg.error_details
FROM dev_tasks dt
JOIN dev_task_quality_gates qg ON dt.id = qg.task_id
WHERE qg.status = 'failed'
ORDER BY dt.updated_at DESC;
```

## Future Enhancements

1. **Automated Validation Runner**: Background job to run automated validations
2. **Criteria Templates**: Pre-defined criteria sets for common task types
3. **Validation Webhooks**: Trigger external validation services
4. **Criteria Dependencies**: Some criteria must pass before others
5. **Historical Analysis**: Learn from past criteria to suggest new ones

## Summary

The enhanced Dev Tasks system provides:
- Clear success criteria definition
- Measurable validation tracking
- Visual progress indicators
- Risk assessment and management
- Quality gate enforcement
- Lifecycle stage tracking

Use these features to ensure tasks are truly complete, not just "done coding"!