# Script and Prompt Management Guide

**Last Updated**: 2025-06-09  
**Next Review**: Tomorrow (Daily Review)  
**Status**: Active  
**Priority**: Medium  

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
- System is operational and being actively maintained
- All pipelines are functional

### 📚 Lessons Learned
from Phase 3

### ✅ Recent Actions Taken
- Restructured documentation format
- Added daily review schedule

---

## Recent Updates

This document has been restructured to follow the new continuously updated documentation format. The content has been reorganized for better readability and to highlight current status and priorities.

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

This document serves as the living guide for managing scripts and prompts within the DHG monorepo. It combines learnings from the script cleanup initiative with the vision for an enhanced prompt management system, providing a unified approach to code organization and AI integration.

---

## ⚠️ Important Callouts

⚠️ **Daily Reviews Required** - This document must be reviewed every day

⚠️ **Database Integration** - Ensure all changes are reflected in the doc_continuous_monitoring table

---

## Full Documentation

# Script and Prompt Management Guide

*Last Updated: June 8, 2025*
*Auto-Update: Enabled for continuous deployment*

## Overview

This document serves as the living guide for managing scripts and prompts within the DHG monorepo. It combines learnings from the script cleanup initiative with the vision for an enhanced prompt management system, providing a unified approach to code organization and AI integration.

## Current State Summary

### Script Management Status

#### Completed Phases (June 2025)
1. **Phase 1**: Command Registry Cleanup (-16.2% broken commands)
2. **Phase 2**: Pipeline Consolidation (-18.6% pipeline count)  
3. **Phase 3**: Root Scripts Migration (-78.3% root script clutter)

**Results**: 49 items processed (42 migrated + 7 archived)
- Zero breaking changes across all phases
- Complete audit trail maintained
- Enhanced functionality in 5 pipelines

#### Active Inventory (Post Phase 3 Cleanup)
- **CLI Pipelines**: 35 active pipelines (reduced from 43)
- **Root Scripts**: 13 remaining (reduced from 60, -78.3%)
- **Migrated Scripts**: 42 organized into pipelines
- **Broken Commands**: 107 (reduced from 142, -24.6%)
- **Enhanced Pipelines**: 5 with new functionality
- **Validation Coverage**: 100%

### Prompt Management Status

#### Database Infrastructure
- **Tables**: ai_prompts, ai_prompt_categories, ai_prompt_relationships
- **Integration**: Document type mapping established
- **Loading**: Database-first with filesystem fallback

#### Pending Enhancements
- Dynamic prompt generation
- Multi-stage pipelines
- Performance tracking
- Concept extraction

## Phase 3 Completion Status & Next Steps

### Enhanced Pipelines Ready for Integration

#### 1. Database Pipeline (+24 utilities)
- Schema management tools (generate-types.ts, update-schema.sh)
- Migration utilities (create-migration.sh, run-direct-sync.sh)  
- Database sync tools (sync-scripts.sh, final-sync.js)
- **Integration Priority**: High - immediate CLI enhancement opportunity

#### 2. Media-Processing Pipeline (+13 audio tools)
- Audio extraction and processing (clip_audio.py, extract_audio.sh)
- AI transcription (whisper_audio.py, modal_process.py)
- Cloud processing (modal_audio_summarize.sh)
- **Integration Priority**: High - complete audio workflow ready

#### 3. System Pipeline (+3 server tools)
- Server management (kill-all-servers.js, start-git-api-server.sh)
- Cache management (clear-vite-cache.sh)
- **Integration Priority**: Medium - development environment utilities

### Remaining Tasks

#### Immediate (Next 30 Days)
1. **CLI Integration**: Review and integrate migrated scripts into CLI commands
2. **Step 4 Planning**: Design pipeline consolidation strategy  
3. **Remaining Root Scripts**: Manual review of 13 remaining scripts

#### Medium-term (Next 90 Days)
1. **Pipeline Consolidation**: Reduce from 35 to ~25 pipelines
2. **CLI Enhancement**: Convert high-value scripts to proper commands
3. **Documentation Update**: Comprehensive CLI help system

### Lessons Learned from Phase 3

#### Key Success Factors
1. **Conservative Validation**: Prevented breaking changes across 100+ operations
2. **Incremental Phases**: Each phase built on previous learnings
3. **Complete Audit Trails**: 45 database records tracking all changes
4. **Intelligent Automation**: 98.3% accuracy in automated categorization

#### Best Practices Established
- Validation-first approach for all cleanup operations
- Database-filesystem synchronization as standard practice  
- Migration over deletion to preserve functionality
- Enhanced pipelines create compound value beyond cleanup

## Ongoing Management Procedures

### Script Health Monitoring

#### Weekly Validation (Automated)
```bash
# Run every Monday at 2 AM via cron
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-archiving
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-pipeline-health
```

#### Monthly Review Process
1. **Identify Obsolete Scripts**
   ```bash
   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-script-usage
   ```

2. **Archive Candidates**
   ```bash
   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-scripts --dry-run
   ```

3. **Clean Command Registry**
   ```bash
   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh cleanup-dead-pipelines
   ```

### Pipeline Consolidation Strategy

#### Dead Pipelines (Immediate Removal)
- `all_pipelines` → Merge into `system`
- `dev_tasks` → Archive (replaced by dev-tasks)
- `google_sync` → Archive (functionality moved)
- `mime_types` → Merge into `document_types`
- `refactor_tracking` → Archive
- `work_summaries` → Merge into `ai`
- `document_types` → Evaluate for merger

#### Consolidation Candidates (Q3 2025)
- `drive_filter` + `google_sync` → `google_integration`
- `prompt_service` + `ai` → `ai_services`
- `merge` + `worktree` → `git_workflow`
- `scripts` + `registry` → `code_management`

### Prompt Management Evolution

#### Phase 1: Foundation (In Progress)
- [x] Database schema established
- [x] Basic loading and storage
- [ ] Performance metrics columns
- [ ] Execution tracking tables

#### Phase 2: Enhanced Features (Q3 2025)
- [ ] Multi-stage pipeline execution
- [ ] Intelligent prompt selection
- [ ] Context aggregation system
- [ ] Cost tracking and optimization

#### Phase 3: Advanced Capabilities (Q4 2025)
- [ ] Concept extraction
- [ ] Learning path generation
- [ ] Cross-document analysis
- [ ] Research collaboration

#### Phase 4: UI Integration (Q4 2025)
- [ ] CRUD interface in dhg-admin-code
- [ ] Pipeline visualization
- [ ] Performance dashboards
- [ ] Prompt testing interface

## Best Practices

### Script Organization

1. **Location Standards**
   - CLI commands: `/scripts/cli-pipeline/{domain}/`
   - Shared services: `/packages/shared/services/`
   - Never place scripts in root directory

2. **Archiving Process**
   - Always validate before archiving
   - Use descriptive archive IDs
   - Document reason for archiving
   - Test restoration process

3. **Command Registry**
   - Register commands before implementation
   - Remove unimplemented commands quarterly
   - Track command usage metrics

### Prompt Engineering

1. **Metadata Standards**
   ```yaml
   ---
   name: Descriptive Name
   documentType: target_document_type
   category: extraction|analysis|synthesis
   version: 1.0
   model: gpt-4-1106-preview
   estimatedCost: ~4000 tokens
   tags: [relevant, keywords]
   ---
   ```

2. **Performance Tracking**
   - Monitor token usage
   - Track success rates
   - Measure quality scores
   - Optimize based on metrics

3. **Version Control**
   - Increment versions on changes
   - Maintain change log
   - Test before deployment
   - Archive deprecated versions

## Automation Scripts

### Daily Health Check
```bash
#!/bin/bash
# /scripts/cli-pipeline/system/daily-health-check.sh

# Check script health
./scripts/cli-pipeline/deprecation/deprecation-cli.sh health-check

# Validate critical pipelines
for pipeline in ai database media-processing presentations; do
  ./scripts/cli-pipeline/$pipeline/$pipeline-cli.sh health-check
done

# Report to monitoring
./scripts/cli-pipeline/monitoring/monitoring-cli.sh report --type daily
```

### Weekly Cleanup
```bash
#!/bin/bash
# /scripts/cli-pipeline/maintenance/weekly-cleanup.sh

# Find unused scripts
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-script-usage

# Clean empty directories
find scripts/cli-pipeline -type d -empty -delete

# Update command registry
./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh sync-command-status
```

## Metrics Dashboard

### Script Health Metrics
- **Archive Rate**: 46/793 (5.8%)
- **Validation Pass Rate**: 100%
- **Pipeline Health Average**: 35/100
- **Command Implementation Rate**: 58%

### Prompt Performance Metrics
- **Average Execution Time**: TBD
- **Success Rate**: TBD
- **Cost per Analysis**: TBD
- **Quality Score**: TBD

## Future Roadmap

### Q3 2025
- [ ] Complete command registry cleanup (142 commands)
- [ ] Implement prompt execution tracking
- [ ] Launch pipeline consolidation
- [ ] Deploy automated monitoring

### Q4 2025
- [ ] Integrate prompt pipelines
- [ ] Build concept extraction
- [ ] Create management UI
- [ ] Establish continuous deployment

### 2026 Vision
- Fully automated script lifecycle management
- AI-driven prompt optimization
- Self-documenting codebase
- Predictive maintenance alerts

## Quick Reference

### Common Commands

```bash
# Script Management
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-archiving
./scripts/cli-pipeline/deprecation/deprecation-cli.sh cleanup-dead-pipelines
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id <id>

# Prompt Management (Coming Soon)
./scripts/cli-pipeline/ai/ai-cli.sh load-prompt <file>
./scripts/cli-pipeline/ai/ai-cli.sh execute-pipeline <pipeline-id>
./scripts/cli-pipeline/ai/ai-cli.sh track-performance <prompt-id>
```

### Key Tables

#### Script Management
- `sys_archived_scripts_files` - Archived script tracking
- `command_pipelines` - CLI pipeline registry
- `command_definitions` - Individual commands
- `sys_table_definitions` - System metadata

#### Prompt Management
- `ai_prompts` - Prompt storage
- `ai_prompt_categories` - Categorization
- `ai_prompt_relationships` - Resource linking
- `ai_prompt_executions` - Performance tracking (planned)

## Continuous Improvement

This document is automatically updated by our continuous deployment system. Manual updates should be made when:

1. Major phases complete
2. New automation scripts deploy
3. Significant metrics change
4. Architecture decisions finalize

To trigger an update:
```bash
./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous \
  --file script-and-prompt-management-guide.md \
  --source "manual update: <reason>"
```

---

*This is a living document maintained by the DHG development team. For questions or contributions, see the dev_tasks pipeline.*

---

*This document is part of the continuously updated documentation system. It is reviewed daily to ensure accuracy and relevance.*
