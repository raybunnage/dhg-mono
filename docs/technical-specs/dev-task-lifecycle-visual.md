# Dev Task Lifecycle - Visual Coordination Model

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEV TASK LIFECYCLE TRACKING SYSTEM                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐ │
│  │  DEV TASK   │     │  CLIPBOARD  │     │  WORKTREE   │     │  CLAUDE  │ │
│  │   Created   │────▶│   SNIPPET   │────▶│ ASSIGNMENT  │────▶│   CODE   │ │
│  └─────────────┘     └─────────────┘     └─────────────┘     └──────────┘ │
│         │                                                            │      │
│         ▼                                                            ▼      │
│  ┌─────────────┐                                            ┌──────────┐   │
│  │ SUBMISSION  │◀───────────────────────────────────────────│   WORK   │   │
│  │   RECORD    │                                            │ SUMMARY  │   │
│  └─────────────┘                                            └──────────┘   │
│         │                                                            │      │
│         ▼                                                            ▼      │
│  ┌─────────────┐     ┌─────────────┐                     ┌──────────────┐ │
│  │ VALIDATION  │────▶│  CHECKLIST  │────────────────────▶│  VALIDATION  │ │
│  │  REQUEST    │     │   SNIPPET   │                     │    ITEMS     │ │
│  └─────────────┘     └─────────────┘                     └──────────────┘ │
│         │                                                            │      │
│         ▼                                                            ▼      │
│  ┌─────────────┐                                            ┌──────────┐   │
│  │  SUB-TASKS  │◀───────────────────────────────────────────│ COMPLETE │   │
│  │  GENERATED  │                                            │  STATUS  │   │
│  └─────────────┘                                            └──────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow Visualization

```
USER ACTIONS                    SYSTEM TRACKING                    VISIBILITY
─────────────                   ────────────────                   ──────────

1. Create Task     ──────────▶  dev_tasks                        ❓ Not Started
                                 └─ has_submission: false
                                 └─ has_work_summary: false
                                 └─ has_validation: false

2. Submit to Claude ─────────▶  dev_task_submissions            📝 Submitted
   (with snippet)                └─ task_id                       └─ Worktree: X
                                 └─ worktree_id                   └─ Status: ⏳
                                 └─ clipboard_snippet_id
                                 └─ submission_status

3. Claude Works    ──────────▶  ai_work_summaries               ✅ Work Done
                                 └─ task_id                       └─ Summary: ✓
                                 └─ files_modified                └─ Files: 12
                                 └─ commands_used                 └─ Commits: 3

4. Request Validation ───────▶  dev_task_validations            🔍 Validating
   (with checklist)              └─ task_id                       └─ Progress: 7/10
                                 └─ clipboard_snippet_id          └─ Status: ⏳
                                 └─ validation_items

5. Complete Items  ──────────▶  dev_task_validation_items       ✅ Items Done
                                 └─ validation_id                 └─ Tests: ✓
                                 └─ status: completed             └─ Docs: ✓
                                 └─ result                        └─ Deploy: ✗

6. Create Sub-tasks ─────────▶  dev_task_subtasks               📋 Sub-tasks
                                 └─ parent_task_id                └─ Total: 5
                                 └─ category                      └─ Done: 3
                                 └─ is_blocking                   └─ Blocked: 1

7. Complete All    ──────────▶  dev_tasks                       ✅ Fully Done
                                 └─ is_fully_complete: true       └─ 100% Complete
```

## UI Component Visualization

### Task List View Enhancement
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Dev Tasks Dashboard                                              [+ New Task]│
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ 🔵 Implement user authentication                            Priority: High│ │
│ │ ┌─────────┬──────────┬────────────┬───────────┬─────────────────────┐│ │
│ │ │Submitted│Work Done │ Validation  │ Sub-tasks │      Overall        ││ │
│ │ │   ✅    │    ✅    │  🔄 70%    │   3/5     │ ▓▓▓▓▓▓▓░░░ 75%    ││ │
│ │ │feature/a│ 2 hours  │  7/10 items │ 2 blocked │                     ││ │
│ │ └─────────┴──────────┴────────────┴───────────┴─────────────────────┘│ │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ 🟡 Add search functionality to documents                    Priority: Med│ │
│ │ ┌─────────┬──────────┬────────────┬───────────┬─────────────────────┐│ │
│ │ │Submitted│Work Done │ Validation  │ Sub-tasks │      Overall        ││ │
│ │ │   ✅    │    ❓    │     ❓     │    0/0    │ ▓▓▓░░░░░░░ 30%    ││ │
│ │ │feature/b│ pending  │ not started │   none    │                     ││ │
│ │ └─────────┴──────────┴────────────┴───────────┴─────────────────────┘│ │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ ❓ Refactor database connection logic                        Priority: Low│ │
│ │ ┌─────────┬──────────┬────────────┬───────────┬─────────────────────┐│ │
│ │ │Submitted│Work Done │ Validation  │ Sub-tasks │      Overall        ││ │
│ │ │   ❌    │    ❌    │     ❌     │    0/0    │ ░░░░░░░░░░ 0%     ││ │
│ │ │   n/a   │   n/a    │    n/a     │   none    │                     ││ │
│ │ └─────────┴──────────┴────────────┴───────────┴─────────────────────┘│ │
│ └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Task Detail View - Lifecycle Tab
```
┌────────────────────────────────────────────────────────────────────────────┐
│ Task: Implement user authentication                              [Edit] [X] │
├────────────────────────────────────────────────────────────────────────────┤
│ Overview | Lifecycle | Commits | Files | Sub-tasks | History               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ 📊 Task Lifecycle Timeline                                                 │
│ ═══════════════════════════                                               │
│                                                                            │
│ June 11 ─────────────────────────────────────────────────────────────▶    │
│                                                                            │
│ 10:00 ● Created task                                                       │
│       └─ "Implement OAuth2 authentication with Google"                    │
│                                                                            │
│ 10:15 ● Submitted to Claude                                               │
│       ├─ Worktree: feature/auth                                          │
│       └─ Snippet: "Authentication Implementation Guide"                   │
│                                                                            │
│ 11:30 ● Work Summary Created                                              │
│       ├─ Files: 15 modified, 8 created                                   │
│       ├─ Commits: 3                                                      │
│       └─ Commands: auth-cli, test, build                                 │
│                                                                            │
│ 14:00 ● Validation Requested                                              │
│       └─ Snippet: "Dev Task Completion Checklist"                        │
│                                                                            │
│ 14:30 ● Validation Progress                                               │
│       ├─ ✅ TypeScript compilation                                       │
│       ├─ ✅ Unit tests (45 passing)                                      │
│       ├─ ✅ Documentation updated                                        │
│       ├─ ✅ No hardcoded credentials                                    │
│       ├─ ✅ Database migrations                                          │
│       ├─ ✅ CLI commands registered                                      │
│       ├─ ✅ Success criteria defined                                     │
│       ├─ ⏳ Integration tests (in progress)                              │
│       ├─ ❌ Performance benchmarks                                       │
│       └─ ❌ Production deployment                                         │
│                                                                            │
│ 15:00 ● Sub-tasks Created                                                 │
│       ├─ 📋 Add rate limiting (blocking)                                 │
│       ├─ 📋 Create admin UI for user management                         │
│       ├─ 📋 Add session timeout configuration                           │
│       ├─ 📋 Write authentication troubleshooting guide                  │
│       └─ 📋 Set up monitoring alerts                                    │
│                                                                            │
│ Current Status: 75% Complete - Validation in Progress                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Key Coordination Points

### 1. Task → Submission → Worktree
```
dev_tasks ──────────▶ dev_task_submissions ──────────▶ worktree_definitions
    │                         │                               │
    └─ task_id               └─ worktree_id                 └─ branch
    └─ title                 └─ submission_content          └─ path
    └─ has_submission=true   └─ submitted_at                └─ is_active
```

### 2. Submission → Work → Summary
```
dev_task_submissions ──────▶ Claude Code ──────▶ ai_work_summaries
         │                         │                      │
         └─ submission_status     └─ executes           └─ task_id
         └─ started_at            └─ commits            └─ files_modified
         └─ completed_at          └─ creates summary    └─ created_at
```

### 3. Summary → Validation → Checklist
```
ai_work_summaries ──────▶ dev_task_validations ──────▶ dev_task_validation_items
        │                          │                            │
        └─ triggers               └─ validation_id             └─ item_type
        └─ validation request     └─ items_total               └─ status
        └─ with clipboard         └─ items_completed           └─ result
```

### 4. Validation → Sub-tasks → Completion
```
dev_task_validation_items ──────▶ dev_task_subtasks ──────▶ dev_tasks
            │                              │                      │
            └─ identifies gaps            └─ parent_task_id     └─ is_fully_complete
            └─ creates sub-tasks          └─ is_blocking        └─ updated_at
            └─ tracks completion          └─ status             └─ = true when all done
```

## Benefits of This System

1. **Complete Visibility**: See exactly where each task is in its lifecycle
2. **No Lost Work**: Every submission, summary, and validation is tracked
3. **Clear Dependencies**: Know what's blocking task completion
4. **Automation Ready**: Structured data enables workflow automation
5. **Historical Analysis**: Full audit trail for process improvement

This visualization shows how all the pieces connect to provide comprehensive tracking from task creation through full completion, addressing all four of your key requirements.