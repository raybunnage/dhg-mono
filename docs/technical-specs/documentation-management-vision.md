# Documentation Management System Vision & Implementation Plan

## Executive Summary

This document outlines a streamlined documentation management system for the DHG monorepo that addresses documentation proliferation, improves discoverability, and maintains synchronization between filesystem and database while providing automatic updates for key system documentation.

## Current Pain Points

1. **Documentation Proliferation**: Hundreds of markdown files across nested folders without clear organization
2. **Poor Discoverability**: Difficult to find relevant, up-to-date documentation
3. **Stale Documentation**: Specs and guides become outdated after implementation
4. **Manual Classification**: Documents require manual categorization and tagging
5. **Disconnected Viewer**: Separate terminal process required for markdown viewing
6. **Over-Engineering**: Previous AI summarization features added complexity without value

## Vision

A simple, effective documentation management system that:
- Automatically classifies and tracks all documentation
- Provides real-time search and filtering capabilities
- Keeps critical system documentation automatically updated
- Integrates seamlessly into the dhg-admin-code interface
- Maintains perfect sync between filesystem and database

## Core Principles

1. **Simplicity First**: Start with basic features that solve real problems
2. **No Soft Deletes**: Direct synchronization between filesystem and database
3. **Automatic Classification**: Use existing prompt-service for document type assignment
4. **Focus on Recent**: Prioritize recently modified documents
5. **Living Documentation**: Key docs auto-update based on system state

## Implementation Plan

### Phase 1: Foundation & Cleanup (Immediate)

#### 1.1 Database Schema Enhancement
```typescript
// Extend doc_files table with:
- last_synced_at: timestamp
- auto_update_enabled: boolean
- update_frequency: interval
- update_source: string (e.g., 'cli_pipelines', 'apps_directory')
- importance_score: integer (1-5)
- view_count: integer
```

#### 1.2 Simplified Document Commands
Create focused CLI commands in `scripts/cli-pipeline/document/`:
- `sync-docs` - Sync filesystem with doc_files table
- `classify-doc <path>` - Classify single document
- `tag-doc <path> <tags>` - Add tags to document
- `mark-important <path> <score>` - Set importance score
- `enable-auto-update <path> <source> <frequency>` - Enable auto-updates

#### 1.3 Remove Deprecated Features
- Archive AI summarization commands
- Remove complex analysis pipelines
- Simplify to core CRUD operations

### Phase 2: Smart Classification & Organization (Week 1)

#### 2.1 Automatic Classification Pipeline
```typescript
// When creating any documentation:
1. Generate document with Claude
2. Auto-run classification command
3. Extract suggested tags from content
4. Set appropriate document_type
5. Add to doc_files registry
```

#### 2.2 Folder-Based Organization
- Present documents grouped by folder structure
- Show most recent files first
- Display modification timestamps
- Quick filter by folder path

#### 2.3 Type-Based Organization
- Group by general document types
- Sub-group by specific document types
- Show document counts per category
- Visual indicators for recent updates

### Phase 3: UI Implementation in dhg-admin-code (Week 2)

#### 3.1 Document List Component
```typescript
interface DocumentListProps {
  groupBy: 'folder' | 'type' | 'recent' | 'important';
  searchTerm?: string;
  filters?: DocumentFilters;
}

// Features:
- Virtualized list for performance
- Real-time search across title/content
- Filter by tags, types, dates
- Sort by recent, importance, views
```

#### 3.2 Integrated Markdown Viewer
```typescript
// Replace separate terminal viewer with:
- Embedded markdown renderer
- Syntax highlighting
- Copy code blocks
- Full-text search within document
- Side-by-side or modal view options
```

#### 3.3 Document Actions
- Quick edit in VSCode
- Copy file path
- View file history
- Set importance/tags
- Enable auto-updates

### Phase 4: Living Documentation System (Week 3)

#### 4.1 Auto-Update Infrastructure
```typescript
// Create update handlers for different sources:
const updateHandlers = {
  'cli_pipelines': updateCliPipelinesDocs,
  'apps_directory': updateAppsOverviewDocs,
  'database_schema': updateSchemaDocumentation,
  'api_endpoints': updateApiDocumentation
};

// Run updates based on configured frequency
```

#### 4.2 Key Documents to Auto-Update
1. **CLI Pipeline Overview** (`/docs/cli-pipeline/CLI_PIPELINE_OVERVIEW.md`)
   - Scan `scripts/cli-pipeline/*` directories
   - Update command lists and descriptions
   - Track usage statistics from command_tracking

2. **Apps Overview** (`/docs/apps/APPS_OVERVIEW.md`)
   - Scan `apps/*` directories
   - Update app statuses and configurations
   - Link to app-specific documentation

3. **Database Schema Guide** (`/docs/database/SCHEMA_GUIDE.md`)
   - Query current schema from Supabase
   - Update table relationships
   - Track recent migrations

4. **Active Development Guide** (`/docs/ACTIVE_DEVELOPMENT.md`)
   - Pull from dev_tasks table
   - Show current sprint items
   - Link to related specifications

#### 4.3 Post-Implementation Updates
- Add "implementation_status" field to specs
- Command to mark spec as "implemented"
- Prompt to update spec with actual implementation details
- Track divergence between spec and implementation

### Phase 5: Search & Discovery (Week 4)

#### 5.1 Full-Text Search
```typescript
// Implement efficient search using:
- Indexed document content in database
- Fuzzy matching for titles
- Tag-based filtering
- Recent search history
```

#### 5.2 Smart Recommendations
- "Related Documents" based on tags/type
- "Recently Viewed" tracking
- "Most Important" based on scores
- "Needs Update" for stale docs

#### 5.3 Document Health Dashboard
- Show documents needing classification
- Highlight very old documents for review
- Track documentation coverage by area
- Identify duplicate/similar documents

## Migration Strategy

### Step 1: Initial Sync
```bash
# Run comprehensive sync
./scripts/cli-pipeline/document/document-cli.sh sync-docs --full

# Classify all unclassified documents
./scripts/cli-pipeline/document/document-cli.sh classify-all --batch-size=10
```

### Step 2: Clean Up Old Documents
```bash
# Archive old script reports
./scripts/cli-pipeline/document/document-cli.sh archive-old --type="script-report" --days=30

# Remove duplicate documentation
./scripts/cli-pipeline/document/document-cli.sh find-duplicates --auto-remove
```

### Step 3: Set Up Auto-Updates
```bash
# Enable auto-updates for key documents
./scripts/cli-pipeline/document/document-cli.sh enable-auto-update \
  --path="/docs/cli-pipeline/CLI_PIPELINE_OVERVIEW.md" \
  --source="cli_pipelines" \
  --frequency="daily"
```

## Success Metrics

1. **Reduced Documentation Count**: Target 50% reduction through deduplication and cleanup
2. **Improved Discoverability**: 90% of searches find relevant doc in <3 seconds
3. **Documentation Freshness**: Key docs updated within 24 hours of system changes
4. **User Engagement**: Track view counts and time spent in documentation
5. **Classification Coverage**: 100% of documents properly classified

## Future Enhancements (Post-MVP)

1. **Documentation Templates**: Pre-defined templates for common doc types
2. **Collaborative Editing**: Real-time collaboration on documentation
3. **Version Control Integration**: Show git history within UI
4. **Export Options**: Generate PDF, DOCX, or static site
5. **Documentation Analytics**: Usage patterns and gap analysis

## Implementation Checklist

- [ ] Create migration to extend doc_files table
- [ ] Build simplified CLI commands
- [ ] Archive deprecated AI commands
- [ ] Implement classification integration
- [ ] Create DocumentList component
- [ ] Build integrated markdown viewer
- [ ] Set up auto-update infrastructure
- [ ] Implement full-text search
- [ ] Create health dashboard
- [ ] Run initial migration and cleanup

## Conclusion

This documentation management system prioritizes simplicity and effectiveness over complex features. By focusing on automatic classification, smart organization, and living documentation, we can transform the current chaos into a valuable, maintainable knowledge base that grows with the project.

The phased approach allows for immediate improvements while building toward a comprehensive solution. Most importantly, the system will reduce the burden of documentation management while improving the value delivered to users.