# Living Docs Template Guide

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


### 📚 Lessons Learned


### ✅ Recent Actions Taken
- Restructured documentation format
- Added daily review schedule

---

## Recent Updates

This document has been restructured to follow the new Living Docs format. The content has been reorganized for better readability and to highlight current status and priorities.

---

## Next Phase

### 🚀 Phase: Enhancement Phase
**Target Date**: Next Week  
**Status**: Planning | In Progress | Blocked  

- Review and update all sections
- Add more specific metrics
- Improve automation tooling

---

## Upcoming Phases

### Phase 2: Optimization
- Performance improvements
- Enhanced search capabilities

### Phase 3: Integration
- Cross-pipeline integration
- Unified reporting

---

## Priorities & Trade-offs

### Current Priorities
1. **Maintain accuracy** - Keep documentation current
2. **Improve accessibility** - Make information easy to find
3. **Automate updates** - Reduce manual work

### Pros & Cons Analysis
**Pros:**
- ✅ Single source of truth
- ✅ Regular updates ensure accuracy
- ✅ Structured format aids navigation

**Cons:**
- ❌ Requires daily maintenance
- ❌ May become verbose over time

---

## Original Vision

[High-level goals and strategic direction for this area - what we're trying to achieve]
```

---

## ⚠️ Important Callouts

⚠️ **Daily Reviews Required** - This document must be reviewed every day

⚠️ **Database Integration** - Ensure all changes are reflected in the doc_continuous_monitoring table

---

## Full Documentation

# Continuously Updated Documentation Template & Guide

**Created**: June 8, 2025  
**Status**: Active Template  
**Purpose**: Template and guide for creating and maintaining continuously updated documents

---

## What is a Continuously Updated Document?

A continuously updated document is a **living document** that:
- Serves as the single source of truth for a specific area
- Gets regularly reviewed and updated (every 14-30 days)
- Tracks its own update history and next review date
- Links to archived documentation for historical context
- Evolves with the project rather than becoming stale

## Template Structure

### 1. Header Section (Required)
```markdown
# [Area Name] - Living Documentation

**Last Updated**: June 8, 2025  
**Next Review**: June 22, 2025 (14 days)  
**Status**: Active | Needs Review | Updating | Deprecated  
**Priority**: High | Medium | Low  
**Related Archives**: [X] documents  

---
```

### 2. Executive Summary/Vision (Required)
```markdown
## Executive Summary

[2-3 sentences describing what this document covers and why it matters]

## Vision

[High-level goals and strategic direction for this area - what we're trying to achieve]
```

### 3. Current Status Section (Required)
```markdown
## Current Status

### What's Working Well
- [List current successes]
- [Stable features/processes]

### Current Priority
- **Immediate Focus**: [What needs attention right now]
- **Blocking Issues**: [Any critical problems]
- **Next Milestone**: [Target date and deliverable]
```

### 4. Implementation Details (Required)
```markdown
## Architecture/Implementation

### Overview
[High-level description of the system/process]

### Key Components
1. **Component Name**: Description
2. **Component Name**: Description

### Technical Details
[Specific implementation information, configurations, etc.]
```

### 5. Progress Tracking (Recommended)
```markdown
## Implementation Progress

### Phase 1: [Phase Name] ✅ Complete
- [x] Completed task
- [x] Completed task

### Phase 2: [Phase Name] 🚧 In Progress
- [x] Completed task
- [ ] Pending task
- [ ] Pending task

### Phase 3: [Phase Name] 📋 Planned
- [ ] Future task
- [ ] Future task
```

### 6. Practical Guide Section (Recommended)
```markdown
## How to Use This

### Quick Start
1. [Step-by-step instructions]
2. [Common commands]
3. [Examples]

### Common Tasks
**Task Name**:
```bash
# Command or code example
```

### Troubleshooting
**Problem**: [Description]
**Solution**: [How to fix]
```

### 7. Lessons Learned (Required)
```markdown
## Lessons Learned

### What Works Well
- [Successful patterns discovered]
- [Best practices identified]

### What to Avoid
- ❌ [Anti-pattern or mistake]
  - ✅ [Better approach]

### Key Insights
- [Important discoveries]
- [Non-obvious knowledge]
```

### 8. Next Steps & Roadmap (Required)
```markdown
## Next Steps

### Immediate (This Review Cycle)
1. [Specific action item]
2. [Specific action item]

### Upcoming (Next 1-3 Months)
- [Larger initiative]
- [Strategic change]

### Long-term Vision
- [Future state goal]
```

### 9. Related Documentation (Required)
```markdown
## Related Documentation

### Archived Docs
- `[archive-id]`: [Description of archived content]
- `[archive-id]`: [Description of archived content]

### Active References
- [Link to related living doc]
- [External documentation]

### Code References
- `path/to/file.ts`: [What it does]
- `path/to/folder/`: [What it contains]
```

### 10. Footer (Required)
```markdown
---

*This is part of the continuously updated documentation system. It is reviewed every [X] days to ensure accuracy and relevance.*
```

## Writing Guidelines

### 1. **Be Concise but Complete**
- Focus on **what matters now**
- Archive historical details rather than cluttering the document
- Use bullet points and tables for clarity
- Keep sections focused and scannable

### 2. **Update Incrementally**
- Don't wait for major rewrites
- Add new learnings as you discover them
- Update status and progress regularly
- Mark completed items promptly

### 3. **Maintain Living Nature**
- Remove outdated information (archive it if valuable)
- Update examples to reflect current code
- Revise priorities based on project needs
- Keep next steps actionable and current

### 4. **Use Consistent Formatting**
- **Bold** for emphasis and important terms
- `Code formatting` for commands, file names, and code
- ✅ ❌ for do/don't patterns
- 📋 🚧 ✅ for status indicators
- Checkboxes for trackable tasks

### 5. **Link Appropriately**
- Reference specific files with full paths
- Link to other living documents
- Note archive IDs for historical context
- Include line numbers for code references when helpful

## Review Checklist

When reviewing a continuously updated document:

- [ ] Update "Last Updated" date
- [ ] Set appropriate "Next Review" date
- [ ] Update status if changed
- [ ] Review and update "Current Priority"
- [ ] Check off completed tasks
- [ ] Add new tasks/phases as needed
- [ ] Update "Lessons Learned" with new insights
- [ ] Revise "Next Steps" to reflect current priorities
- [ ] Archive any outdated sections
- [ ] Ensure all links and references are current
- [ ] Add any new related documentation

## Database Integration

Each continuously updated document should have an entry in `doc_continuous_monitoring`:

```sql
-- Example registration
INSERT INTO doc_continuous_monitoring (
    file_path,
    title,
    area,
    description,
    review_frequency_days,
    priority,
    next_review_date
) VALUES (
    '/docs/continuously-updated/your-doc.md',
    'Your Document Title',
    'area-name', -- e.g., 'cli-pipeline', 'shared-services', 'deployment'
    'Brief description of what this covers',
    14, -- Review every 14 days for high-priority
    'high',
    CURRENT_DATE + INTERVAL '14 days'
);
```

## Examples of Good Continuously Updated Documents

1. **CLI Pipeline Documentation** (`cli-pipelines-documentation.md`)
   - Clear phase-based progress tracking
   - Specific commands and examples
   - Regular updates on new pipelines

2. **Code Continuous Monitoring** (`code-continuous-monitoring.md`)
   - Strong vision statement
   - Detailed implementation status
   - Clear success metrics

3. **Apps Documentation** (`apps-documentation.md`)
   - Comprehensive overview of all apps
   - Consistent format for each entry
   - Quick reference information

## Common Pitfalls to Avoid

1. **Information Hoarding**
   - ❌ Keeping all historical information in the document
   - ✅ Archive old content and reference it

2. **Vague Updates**
   - ❌ "Updated various things"
   - ✅ "Added error handling to google-sync pipeline, fixed auth bug #123"

3. **Stale Priorities**
   - ❌ Leaving completed items as "current priority"
   - ✅ Regularly updating focus areas

4. **Missing Context**
   - ❌ Technical details without explanation
   - ✅ Brief context for why decisions were made

5. **Forgetting Reviews**
   - ❌ Letting review dates pass
   - ✅ Setting calendar reminders or using the monitoring system

## Quick Start for New Document

1. Copy this template structure
2. Fill in all required sections
3. Register in the database:
   ```bash
   ./scripts/cli-pipeline/docs/docs-cli.sh register \
     --path /docs/continuously-updated/your-doc.md \
     --area your-area \
     --frequency 14
   ```
4. Set a calendar reminder for the first review
5. Start with minimal content and grow organically

---

*This template itself is a continuously updated document and will evolve based on best practices discovered through usage.*

---

*This document is part of the continuously updated documentation system. It is reviewed daily to ensure accuracy and relevance.*
