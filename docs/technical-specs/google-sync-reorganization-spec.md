# Google Sync CLI Reorganization Technical Specification

## Executive Summary

The Google sync CLI currently has 92 commands, making it confusing and difficult to maintain. This specification outlines a plan to consolidate these into approximately 15-20 core commands while maintaining all functionality through intelligent options and flags. The primary focus is on creating a unified document classification system that works seamlessly with the prompt service.

## Current State Analysis

### Problems with Current Implementation
1. **Command Proliferation**: 92 commands create cognitive overload
2. **Inconsistent Patterns**: Similar functionality spread across multiple commands
3. **Maintenance Burden**: 208 files in the google_sync directory
4. **Low Success Rates**: Some commands (e.g., `update-main-video-id`) have only 44% success rate
5. **Redundant Implementations**: Multiple classify commands doing similar work differently

### Usage Statistics (Last 45 Days)
- **Most Used**: `list-pipeline-status` (89 uses), `update-main-video-id` (70 uses)
- **High Failure**: Filter commands (100% failure), `update-main-video-id` (44% success)
- **Performance Issues**: Some commands take 200+ seconds to complete

## Vision

Create a clean, intuitive command structure that:
1. Groups related functionality under unified commands
2. Uses consistent patterns and options
3. Integrates seamlessly with the prompt service
4. Provides clear migration paths from old commands
5. Maintains backward compatibility during transition

## Priority Implementation Plan

### Phase 1: Unified Classification System (Highest Priority)
Build a robust, extensible classification system that handles all file types through a single entry point.

### Phase 2: Command Consolidation
Consolidate existing commands into logical groups with consistent interfaces.

### Phase 3: Archive and Migration
Archive old commands and provide clear migration documentation.

## Detailed Command Structure

### 1. Core Sync Operations
These commands are already solid and will remain largely unchanged:

```bash
sync-all                    # Complete pipeline (recommended default)
sync-files                  # Fast file existence check only (~30s)
process-new-files-enhanced  # Process new files with detailed reporting
update-metadata            # Update file size, thumbnails, names
verify-deletions           # Verify and optionally restore deleted files
health-check               # Verify Google Drive API connection
```

### 2. Unified Classification System (Primary Focus)

#### Command Structure
```bash
classify                    # Universal classification command
  --types pdf,docx,pptx,txt,md,audio,video  # File types to process
  --limit 10                # Number of files to process
  --concurrency 3           # Parallel processing
  --force                   # Force reclassification
  --dry-run                # Preview without changes
  --verbose                # Detailed output
  --filter-profile "name"   # Use specific filter profile
  --status needs-reprocessing  # Process only files with specific status
```

#### Architecture Design

```typescript
// Core Classification Service
interface ClassificationService {
  // Main entry point
  async classifyDocuments(options: ClassificationOptions): Promise<ClassificationResult[]>
  
  // Type-specific handlers (internal)
  private async classifyPDF(file: SourceFile): Promise<Classification>
  private async classifyDocument(file: SourceFile): Promise<Classification>
  private async classifyPresentation(file: SourceFile): Promise<Classification>
  private async classifyMedia(file: SourceFile): Promise<Classification>
  private async classifyText(file: SourceFile): Promise<Classification>
  
  // Prompt selection based on mime type
  private async selectPrompt(mimeType: string): Promise<Prompt>
  
  // Result processing
  private async saveClassification(result: Classification): Promise<void>
}

interface ClassificationOptions {
  types?: string[]          // File types to process
  limit?: number           // Max files to process
  concurrency?: number     // Parallel processing limit
  force?: boolean         // Force reclassification
  dryRun?: boolean       // Preview mode
  filterProfile?: string  // Active filter profile
  status?: string        // Pipeline status filter
}

interface Classification {
  sourceId: string
  documentTypeId: string
  confidence: number
  reasoning: string
  keyInsights?: string[]
  concepts?: Concept[]
  metadata?: Record<string, any>
}
```

#### Integration with Prompt Service

```typescript
// Prompt Type Mapping
const MIME_TYPE_TO_PROMPT_MAP = {
  // Documents
  'application/pdf': 'pdf-classification-prompt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx-classification-prompt',
  'text/plain': 'text-classification-prompt',
  'text/markdown': 'markdown-classification-prompt',
  
  // Presentations
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint-classification-prompt',
  'application/vnd.google-apps.presentation': 'google-slides-classification-prompt',
  
  // Media
  'video/mp4': 'video-classification-prompt',
  'audio/x-m4a': 'audio-classification-prompt',
  'audio/mpeg': 'audio-classification-prompt',
  
  // Spreadsheets
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet-classification-prompt',
  'application/vnd.google-apps.spreadsheet': 'google-sheets-classification-prompt'
}
```

### 3. Listing and Reporting Commands

```bash
list                        # Universal listing command
  --status unprocessed      # Filter by pipeline status
  --type pdf,docx          # Filter by file types
  --recent 7d              # Recently modified files
  --expert "John Doe"      # Filter by expert
  --has-expert-doc         # Only files with expert documents
  --missing-expert-doc     # Only files without expert documents
  --format table|json|csv  # Output format
  --limit 50              # Limit results
  --sort name|date|type   # Sort order

report                      # Generate comprehensive reports
  --type pipeline-status    # Pipeline status distribution
  --type expert-coverage    # Expert document coverage
  --type classification     # Classification quality metrics
  --type duplicates        # Duplicate file analysis
  --type performance       # Command performance metrics
  --format markdown|html   # Output format
  --output file.md        # Save to file

search                      # Find specific files or folders
  --name "pattern"         # Search by name (supports wildcards)
  --path "folder/sub"      # Search by path
  --drive-id "abc123"      # Find by specific drive ID
  --content "keyword"      # Search within document content
  --expert "name"          # Search by associated expert
```

### 4. Maintenance and Repair Commands

```bash
fix                         # Universal repair command
  --orphaned-docs          # Remove orphaned expert documents
  --bad-folders            # Fix incorrect folder document types
  --duplicates             # Resolve duplicate records
  --missing-metadata       # Populate missing metadata
  --reprocessing-status    # Clear stuck reprocessing flags
  --dry-run               # Preview changes

check                       # Universal validation command
  --integrity             # Full data integrity check
  --duplicates            # Check for duplicate records
  --orphans               # Check for orphaned records
  --consistency           # Check data consistency
  --performance           # Check system performance
  --format detailed|summary # Output detail level

mark                        # Mark files for processing
  --reprocess             # Mark for reprocessing
  --types pdf,docx        # Filter by file type
  --ids uuid1,uuid2       # Specific file IDs
  --where "condition"     # SQL-like condition
  --reason "text"         # Reason for marking
```

### 5. Media-Specific Commands

```bash
media                       # Media file operations
  --extract-audio         # Extract audio from video files
  --generate-thumbnails   # Generate video thumbnails
  --update-duration       # Update media duration metadata
  --link-transcripts      # Link media to transcript documents
  --batch-id "id"         # Process specific batch
```

## Implementation Strategy

### Phase 1: Unified Classification System (Weeks 1-3)

#### Week 1: Core Architecture
1. Create `ClassificationService` in shared services
2. Implement mime type to prompt mapping
3. Create unified options interface
4. Set up proper error handling and logging

#### Week 2: Type-Specific Handlers
1. Migrate PDF classification logic
2. Migrate DOCX/text classification logic
3. Migrate PowerPoint classification logic
4. Implement media classification
5. Add new types (markdown, spreadsheets)

#### Week 3: Integration and Testing
1. Integrate with prompt service
2. Implement batch processing with concurrency
3. Add comprehensive error handling
4. Create test suite
5. Performance optimization

### Phase 2: Command Consolidation (Weeks 4-5)

#### Week 4: Core Commands
1. Implement unified `list` command
2. Implement unified `report` command
3. Implement unified `search` command

#### Week 5: Maintenance Commands
1. Implement unified `fix` command
2. Implement unified `check` command
3. Implement `mark` command
4. Update help system

### Phase 3: Migration and Cleanup (Week 6)

1. Create migration guide
2. Add deprecation warnings to old commands
3. Archive old command files
4. Update documentation
5. Create backward compatibility layer

## Success Metrics

1. **Command Reduction**: From 92 to <20 commands
2. **Success Rate**: >95% for all commands
3. **Performance**: <30s for most operations
4. **Code Reduction**: Remove >50% of files
5. **User Satisfaction**: Clearer, more intuitive interface

## Migration Guide Template

```markdown
# Google Sync Command Migration Guide

## Classification Commands
| Old Command | New Command | Notes |
|------------|-------------|-------|
| classify-pdfs | classify --types pdf | All PDF files |
| classify-powerpoints | classify --types pptx | All PowerPoint files |
| classify-docs-service | classify --types docx,txt | Documents and text |
| update-media-document-types | classify --types audio,video | Media files |

## Listing Commands
| Old Command | New Command | Notes |
|------------|-------------|-------|
| list-pipeline-status | list --status all | Show pipeline status |
| list-google-sources | list | Basic listing |
| show-expert-documents | report --type expert-coverage | Expert document report |

## Maintenance Commands
| Old Command | New Command | Notes |
|------------|-------------|-------|
| clean-orphaned-records | fix --orphaned-docs | Clean orphans |
| sources-google-integrity | check --integrity | Check integrity |
| check-duplicates | check --duplicates | Find duplicates |
```

## Risk Mitigation

1. **Backward Compatibility**: Keep old commands with deprecation warnings
2. **Gradual Migration**: Allow both old and new commands during transition
3. **Comprehensive Testing**: Test all edge cases before deprecating
4. **User Communication**: Clear documentation and migration guides
5. **Rollback Plan**: Keep archived code accessible for emergency rollback

## Next Steps

1. Review and approve this specification
2. Begin Phase 1 implementation with classification system
3. Set up testing infrastructure
4. Create development branch for changes
5. Regular progress reviews and adjustments