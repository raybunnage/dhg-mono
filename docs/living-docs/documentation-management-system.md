# Documentation Management System - Living Documentation

**Last Updated**: June 9, 2025  
**Next Review**: June 23, 2025 (14 days)  
**Status**: Active  
**Priority**: High  
**Related Archives**: 4 documents  

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

The documentation management system is in early implementation with core monitoring capabilities working. We're actively managing 700+ documentation files with the goal of reducing to ~30 living documents.

**What's Working Well**:
- ✅ Basic continuous monitoring CLI operational
- ✅ File detection for common issues (size, console.logs, etc.)
- ✅ Living document template established and in use
- ✅ Archive strategy defined with cross-referencing
- ✅ This continuously-updated folder growing with key docs

**Current Priority**:
- **Immediate Focus**: Complete database integration for tracking
- **Blocking Issues**: Migration for monitoring tables pending
- **Next Milestone**: Automated document classification by June 30, 2025

### 📚 Lessons Learned

1. **700+ files is unsustainable** - Information is lost in the noise
2. **Living documents work** - This folder proves the concept
3. **Templates drive consistency** - Standard structure improves quality
4. **Automation is essential** - Manual classification doesn't scale
5. **Archive != Delete** - Historical context has value

### ✅ Recent Actions Taken
- Created continuously-updated documentation system
- Implemented basic monitoring CLI
- Established living document template
- Started migration from static to living docs

---

## Recent Updates

- **June 9, 2025**: Created this consolidated living documentation
- **June 2025**: Continuous monitoring CLI deployed
- **May 2025**: Living document concept proven with first docs
- **May 2025**: Documentation explosion identified (700+ files)

---

## Next Phase

### 🚀 Phase: Database Integration
**Target Date**: June 30, 2025  
**Status**: Planning  

- [ ] Deploy monitoring database tables
- [ ] Implement document registration system
- [ ] Create automated classification
- [ ] Build archive tracking
- [ ] Deploy review reminder system

---

## Upcoming Phases

### Phase 2: AI-Powered Classification (July 2025)
- Claude integration for document analysis
- Automatic categorization suggestions
- Quality scoring for documents
- Duplicate detection

### Phase 3: Integrated Viewer (August 2025)
- In-app markdown viewer in dhg-admin-code
- Real-time search and filtering
- Archive browsing interface
- Cross-reference navigation

### Phase 4: Auto-Update System (September 2025)
- Automatic updates for system docs
- Git hook integration
- Change detection and alerts
- Version comparison tools

---

## Priorities & Trade-offs

### Current Priorities
1. **Reduce documentation clutter** - 700 → 30 active docs
2. **Maintain document freshness** - Living docs stay current
3. **Preserve historical context** - Smart archiving

### Pros & Cons Analysis
**Pros:**
- ✅ Dramatically improved discoverability
- ✅ Always-current critical documentation
- ✅ Automated quality enforcement
- ✅ Historical context preserved

**Cons:**
- ❌ Initial migration effort significant
- ❌ Requires discipline to maintain
- ❌ Some valuable docs might be archived
- ❌ Learning curve for new system

---

## Original Vision

Transform documentation from a static, ever-growing collection into a dynamic, self-maintaining knowledge base. The system should make it trivial to find current information while preserving historical context. Documentation should live and breathe with the project, updating automatically where possible.

---

## ⚠️ Important Callouts

⚠️ **Don't create new docs without consideration** - Add to living docs first

⚠️ **Use the template** - Consistency matters for discoverability

⚠️ **Archive, don't delete** - Historical context has value

⚠️ **Review dates matter** - Set realistic review cycles

---

## Full Documentation

### System Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  File System Docs   │────▶│ Classification   │────▶│  Living Docs    │
│    (700+ files)     │     │     Engine       │     │   (~30 files)   │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
           │                         │                          │
           └──────────────┬──────────┘──────────────────────────┘
                          ▼
                 ┌─────────────────────┐
                 │   Archive System    │
                 │ (Historical Context)│
                 └─────────────────────┘
```

### Living Document Categories

| Category | Purpose | Review Cycle | Count |
|----------|---------|--------------|-------|
| System Overview | Architecture, setup | 14 days | 3-4 |
| CLI Pipelines | Command documentation | 14 days | 5-6 |
| Development Guides | How-to, best practices | 30 days | 8-10 |
| API References | Technical specs | 30 days | 5-6 |
| Project Status | Progress, roadmaps | 7 days | 2-3 |

### Database Schema (Pending Migration)

```sql
-- Living document tracking
CREATE TABLE doc_continuous_monitoring (
  id UUID PRIMARY KEY,
  file_path TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  description TEXT,
  review_frequency_days INTEGER DEFAULT 14,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')),
  next_review_date DATE,
  last_updated TIMESTAMP,
  update_count INTEGER DEFAULT 0
);

-- Archive tracking
CREATE TABLE doc_archives (
  id UUID PRIMARY KEY,
  original_path TEXT NOT NULL,
  archive_path TEXT NOT NULL,
  archived_date TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  related_living_doc_id UUID REFERENCES doc_continuous_monitoring(id)
);

-- Monitoring findings
CREATE TABLE sys_monitoring_findings (
  id UUID PRIMARY KEY,
  run_id UUID,
  file_path TEXT,
  issue_type TEXT,
  severity TEXT,
  description TEXT,
  suggested_action TEXT
);
```

### CLI Commands

**Document Management**:
```bash
# Register a living document
./scripts/cli-pipeline/docs/docs-cli.sh register \
  --path /docs/continuously-updated/my-doc.md \
  --area architecture \
  --frequency 14

# Check for due reviews
./scripts/cli-pipeline/docs/docs-cli.sh check-reviews

# Archive old documentation
./scripts/cli-pipeline/docs/docs-cli.sh archive \
  --pattern "*-old.md" \
  --relate-to living-doc-id

# Search all docs (including archives)
./scripts/cli-pipeline/docs/docs-cli.sh search "query"
```

**Code Monitoring**:
```bash
# Quick scan of a folder
./scripts/cli-pipeline/monitoring/monitoring-cli.sh quick apps/dhg-hub

# Continuous monitoring
./scripts/cli-pipeline/monitoring/monitoring-cli.sh watch apps/ --interval 5

# Generate report
./scripts/cli-pipeline/monitoring/monitoring-cli.sh report --save
```

### Living Document Template

Every living document follows this structure:
1. **Header** - Dates, status, priority
2. **Table of Contents** - Quick navigation
3. **Current Status** - What's happening now
4. **Recent Updates** - Change log
5. **Next Phase** - Immediate plans
6. **Upcoming Phases** - Future roadmap
7. **Priorities & Trade-offs** - Decision framework
8. **Original Vision** - Why this exists
9. **Important Callouts** - Critical warnings
10. **Full Documentation** - Complete details

### Auto-Update Targets

These documents will auto-update based on system changes:

1. **CLI Pipeline Overview**
   - Source: Command registry
   - Updates: New commands, deprecations

2. **Apps Overview**
   - Source: App registry, package.json files
   - Updates: New apps, version changes

3. **Database Schema Guide**
   - Source: supabase/types.ts
   - Updates: Table changes, new migrations

4. **Active Development Guide**
   - Source: dev_tasks, git activity
   - Updates: Current work, priorities

### Archive Strategy

**When to Archive**:
- Document hasn't been updated in 90+ days
- Information is outdated or superseded
- Duplicate content exists elsewhere
- Temporary or event-specific docs

**Archive Process**:
1. Identify candidates via monitoring
2. Check for active references
3. Create relationship to living doc
4. Move to `.archive/` with date stamp
5. Update database tracking

### Monitoring Capabilities

**Current Detections**:
- New files without headers
- Large files (>300 lines)
- Excessive console.log usage
- Direct Supabase client creation
- Missing test files
- Outdated dependencies

**Planned Detections**:
- Stale documentation
- Broken links
- Duplicate content
- Missing API documentation
- Security vulnerabilities

### Integration Points

1. **Git Hooks** - Trigger monitoring on commits
2. **CI/CD Pipeline** - Block PRs with issues
3. **dhg-admin-code** - In-app documentation viewer
4. **AI Analysis** - Claude-powered insights
5. **Notification System** - Review reminders

### Best Practices

1. **Keep Living Docs Focused**
   - One topic per document
   - Clear ownership and purpose
   - Regular review cycles

2. **Archive Thoughtfully**
   - Preserve valuable history
   - Maintain relationships
   - Document archive reasons

3. **Monitor Proactively**
   - Run scans before major changes
   - Address findings quickly
   - Track improvement trends

### Troubleshooting

**Problem**: Can't find documentation  
**Solution**: Search including archives, check living docs first

**Problem**: Document review overdue  
**Solution**: Run check-reviews command, update promptly

**Problem**: Too many monitoring findings  
**Solution**: Focus on high-severity first, configure rules

**Problem**: Archive growing too large  
**Solution**: Implement retention policy, compress old archives

### Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Active Docs | 700+ | 30 | Q3 2025 |
| Find Time | 10+ min | <3 sec | Q3 2025 |
| Freshness | Variable | <24hr | Q3 2025 |
| Coverage | Unknown | 95% | Q4 2025 |

### Related Documentation

**Archived Specs**:
- `documentation-management-vision.md` - Original vision document
- `continuous-documentation-monitoring-vision.md` - Monitoring concept
- `continuous-monitoring-architecture.md` - Technical architecture
- `continuous-monitoring-system-implementation.md` - Implementation details

**Active References**:
- `CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md` - Template reference
- `code-continuous-monitoring.md` - Code monitoring details
- `/scripts/cli-pipeline/docs/` - CLI implementation
- `/scripts/cli-pipeline/monitoring/` - Monitoring tools

**Code References**:
- `scripts/cli-pipeline/monitoring/quick-monitor.ts` - Quick scan implementation
- `supabase/migrations/*continuous_monitoring*.sql` - Database schema
- `apps/dhg-admin-code/src/components/DocsViewer.tsx` - Viewer (planned)

---

*This is part of the continuously updated documentation system. It is reviewed every 14 days to ensure accuracy and relevance.*