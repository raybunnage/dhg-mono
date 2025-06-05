# Script Management System Vision & Implementation Plan

## Vision Statement

The Script Management System will provide a unified, intelligent interface for managing the extensive collection of CLI pipeline scripts across the DHG monorepo. By leveraging AI-powered classification, real-time synchronization, and an intuitive hierarchical view, this system will transform scattered scripts into a well-organized, self-documenting ecosystem that accelerates development and maintenance workflows.

### Core Principles

1. **Living Documentation**: Scripts are not just code files but self-documenting assets that explain their purpose, usage, and relationships
2. **Pipeline-Centric Organization**: Scripts are organized by their CLI pipeline context, making it easy to understand functionality groupings
3. **AI-Enhanced Classification**: Automatic document type classification ensures consistent categorization across all scripts
4. **Real-Time Synchronization**: The registry stays in sync with the file system, using hard deletes to maintain accuracy
5. **Development Workflow Integration**: New scripts created by Claude Code automatically register with proper metadata and tags

## Current State Analysis

### Existing Infrastructure
- **26 CLI Pipelines** organized under `scripts/cli-pipeline/`
- **scripts_registry table** with AI assessment and document type classification
- **Basic sync functionality** in `scripts/cli-pipeline/scripts/direct-db-sync.ts`
- **Minimal CLI interface** requiring expansion
- **Legacy scripts** in root `/scripts/` folder needing archival

### Key Challenges
1. Minimal script management CLI commands
2. No automatic registration when new scripts are created
3. Legacy scripts mixed with modern CLI pipeline architecture
4. Limited visibility into script purposes and relationships
5. No integrated viewer for script content in admin interface

## Implementation Plan

### Phase 1: Enhanced Script Sync & Classification (Week 1)

#### 1.1 Upgrade Script Sync Functionality
- Enhance `direct-db-sync.ts` to capture more metadata:
  - File size
  - Last modified date
  - Pipeline association (from folder structure)
  - Detected language and framework
- Implement hard delete synchronization
- Add support for archival detection (`.archived_scripts` folders)

#### 1.2 AI-Powered Classification
- Integrate with existing document type system
- Map script categories:
  - Data Processing Script
  - Deployment Script
  - Infrastructure Script
  - Integration Script
  - Utility Script
- Use Claude AI service for intelligent classification
- Store classification confidence scores

#### 1.3 Expand Script CLI Commands
```bash
scripts-cli.sh commands:
- sync                  # Full sync with classification
- classify <file>       # Classify single script
- list [--pipeline]     # List scripts by pipeline
- search <query>        # Search scripts by content/name
- archive <file>        # Move script to archive
- register <file>       # Manually register new script
- stats                 # Show script statistics
```

### Phase 2: Legacy Script Migration (Week 2)

#### 2.1 Identify Essential Legacy Scripts
- Scan `/scripts/` root folder
- Identify scripts related to:
  - Development promotion
  - Branching/merging
  - Testing infrastructure
  - Deployment processes

#### 2.2 Archive Non-Essential Scripts
- Create `/scripts/.archived_legacy/` folder
- Move outdated pnpm-based scripts
- Maintain reference documentation
- Update any remaining dependencies

#### 2.3 Migrate Essential Scripts
- Move essential scripts to appropriate CLI pipelines
- Create new pipelines if needed (e.g., `deployment/`, `testing/`)
- Update script references throughout codebase

### Phase 3: Admin Interface Integration (Week 3)

#### 3.1 Create Script Management Page in dhg-admin-config
- Hierarchical folder view by CLI pipeline
- Script listing with:
  - Name and description
  - Document type classification
  - Last modified date
  - File size
  - Associated tags
- Sort by modification date to show recent activity
- Filter by pipeline, document type, or tags

#### 3.2 Implement Script Viewer
- Port `simple-script-server.js` functionality
- Integrate as right-side panel in admin interface
- Syntax highlighting for multiple languages
- Show AI-generated summary and classification

#### 3.3 Interactive Features
- Edit script metadata and tags
- Trigger reclassification
- View script dependencies
- Generate usage documentation

### Phase 4: Automated Integration (Week 4)

#### 4.1 Claude Code Integration
- Add script registration to CLAUDE.md instructions
- Implement automatic tagging based on:
  - Script purpose
  - Pipeline context
  - Dependencies used
- Generate meaningful descriptions during creation

#### 4.2 Continuous Synchronization
- Implement file watcher for real-time updates
- Automatic classification of new scripts
- Update registry on file moves/renames
- Track script execution history

#### 4.3 Enhanced Metadata
- Capture script relationships and dependencies
- Track which scripts call other scripts
- Generate dependency graphs
- Monitor script usage patterns

## Success Metrics

1. **Coverage**: 100% of CLI pipeline scripts registered and classified
2. **Accuracy**: 90%+ correct document type classification
3. **Currency**: Registry updates within 1 minute of file changes
4. **Usability**: Average time to find a script reduced by 70%
5. **Documentation**: Every script has AI-generated summary and tags

## Technical Architecture

### Database Schema Enhancements
```sql
-- Add to scripts_registry table
ALTER TABLE scripts_registry ADD COLUMN cli_pipeline VARCHAR(255);
ALTER TABLE scripts_registry ADD COLUMN file_size BIGINT;
ALTER TABLE scripts_registry ADD COLUMN last_modified TIMESTAMP;
ALTER TABLE scripts_registry ADD COLUMN execution_count INTEGER DEFAULT 0;
ALTER TABLE scripts_registry ADD COLUMN last_executed TIMESTAMP;
```

### Service Architecture
```typescript
// Script Management Service
class ScriptManagementService {
  - syncAllScripts()
  - classifyScript(filePath)
  - registerNewScript(filePath, metadata)
  - archiveScript(filePath)
  - getScriptsByPipeline(pipeline)
  - searchScripts(query)
}

// Script Viewer Service
class ScriptViewerService {
  - getScriptContent(filePath)
  - getScriptMetadata(filePath)
  - updateScriptTags(filePath, tags)
}
```

## Risk Mitigation

1. **Data Loss**: Implement backup before archiving legacy scripts
2. **Classification Errors**: Manual override capability for AI classification
3. **Performance**: Index scripts_registry for fast queries
4. **Security**: Validate file paths to prevent directory traversal
5. **Compatibility**: Maintain backward compatibility during migration

## Next Steps

1. Review and approve this vision document
2. Create detailed technical specifications for Phase 1
3. Set up development branch for script management enhancements
4. Begin implementation with enhanced sync functionality
5. Schedule weekly reviews to track progress

---

*This document serves as the guiding vision for transforming script management from a collection of files into an intelligent, self-organizing system that enhances developer productivity and code maintainability.*