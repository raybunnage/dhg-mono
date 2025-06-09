# Continuous Documentation Monitoring: Quick Start Guide

**Created**: 2025-06-08  
**Purpose**: Practical implementation steps for the documentation monitoring system

## Overview

This guide provides immediate, actionable steps to implement the continuous documentation monitoring system. Start here for hands-on implementation.

## Phase 1: Foundation (This Week)

### Step 1: Create the CLI Pipeline Structure

```bash
# Create the documentation pipeline directory
mkdir -p scripts/cli-pipeline/documentation/commands

# Create the main CLI script
cat > scripts/cli-pipeline/documentation/doc-monitor-cli.sh << 'EOF'
#!/bin/bash

# Documentation Monitoring CLI
# Manages living documents and archives

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../common.sh"

case "$1" in
    scan)
        echo "Scanning documentation..."
        ts-node "$SCRIPT_DIR/commands/scan-documentation.ts" "${@:2}"
        ;;
    register)
        echo "Registering living document..."
        ts-node "$SCRIPT_DIR/commands/register-document.ts" "${@:2}"
        ;;
    review)
        echo "Starting review process..."
        ts-node "$SCRIPT_DIR/commands/review-document.ts" "${@:2}"
        ;;
    archive)
        echo "Archiving documents..."
        ts-node "$SCRIPT_DIR/commands/archive-documents.ts" "${@:2}"
        ;;
    search)
        echo "Searching documentation..."
        ts-node "$SCRIPT_DIR/commands/search-documentation.ts" "${@:2}"
        ;;
    status)
        echo "Documentation status..."
        ts-node "$SCRIPT_DIR/commands/show-status.ts" "${@:2}"
        ;;
    *)
        echo "Documentation Monitoring CLI"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  scan      - Scan and index all documentation"
        echo "  register  - Register a living document"
        echo "  review    - Review and update a document"
        echo "  archive   - Archive old documentation"
        echo "  search    - Search all documentation"
        echo "  status    - Show monitoring status"
        ;;
esac
EOF

chmod +x scripts/cli-pipeline/documentation/doc-monitor-cli.sh
```

### Step 2: Register Initial Living Documents

Create a script to register the existing living documents:

```typescript
// scripts/cli-pipeline/documentation/commands/register-initial-docs.ts
import { SupabaseClientService } from '@shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

const livingDocs = [
  {
    file_path: 'docs/continuously-updated/cli-pipelines-documentation.md',
    title: 'CLI Pipeline Operations',
    description: 'Central reference for all CLI commands and pipelines',
    category: 'operations',
    priority: 'high',
    review_cycle_days: 7,
    owner: 'system'
  },
  {
    file_path: 'docs/continuously-updated/apps-documentation.md',
    title: 'Apps Documentation',
    description: 'Documentation for all monorepo applications',
    category: 'applications',
    priority: 'high',
    review_cycle_days: 14,
    owner: 'system'
  },
  {
    file_path: 'docs/continuously-updated/code-continuous-monitoring.md',
    title: 'Code Monitoring System',
    description: 'Code quality and monitoring system documentation',
    category: 'monitoring',
    priority: 'medium',
    review_cycle_days: 30,
    owner: 'system'
  }
];

async function registerDocs() {
  for (const doc of livingDocs) {
    const { error } = await supabase
      .from('doc_continuous_monitoring')
      .upsert({
        ...doc,
        last_reviewed_at: new Date().toISOString(),
        next_review_date: new Date(Date.now() + doc.review_cycle_days * 24 * 60 * 60 * 1000).toISOString()
      });
    
    if (error) {
      console.error(`Failed to register ${doc.file_path}:`, error);
    } else {
      console.log(`✓ Registered: ${doc.title}`);
    }
  }
}

registerDocs();
```

### Step 3: Implement Document Scanner

```typescript
// scripts/cli-pipeline/documentation/commands/scan-documentation.ts
import { SupabaseClientService } from '@shared/services/supabase-client';
import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const supabase = SupabaseClientService.getInstance().getClient();

async function scanDocumentation() {
  // Find all markdown files
  const files = await glob('docs/**/*.md', { 
    ignore: ['**/node_modules/**', '**/.archive_docs/**'] 
  });
  
  console.log(`Found ${files.length} documentation files`);
  
  // Get existing living documents
  const { data: livingDocs } = await supabase
    .from('doc_continuous_monitoring')
    .select('file_path');
  
  const livingPaths = new Set(livingDocs?.map(d => d.file_path) || []);
  
  // Categorize files
  const categories = {
    'cli-pipeline': [],
    'technical-specs': [],
    'code-documentation': [],
    'deployment-environment': [],
    'work-summaries': [],
    'solution-guides': [],
    'script-reports': [],
    'other': []
  };
  
  for (const file of files) {
    if (livingPaths.has(file)) continue; // Skip living documents
    
    const category = file.split('/')[1] || 'other';
    const categoryKey = categories[category] ? category : 'other';
    
    const content = await fs.readFile(file, 'utf-8');
    const hash = crypto.createHash('md5').update(content).digest('hex');
    
    categories[categoryKey].push({
      path: file,
      size: content.length,
      hash,
      lastModified: (await fs.stat(file)).mtime
    });
  }
  
  // Generate report
  console.log('\nDocumentation Summary:');
  console.log('===================');
  for (const [category, docs] of Object.entries(categories)) {
    if (docs.length > 0) {
      console.log(`\n${category}: ${docs.length} files`);
      console.log(`  Total size: ${(docs.reduce((sum, d) => sum + d.size, 0) / 1024).toFixed(1)} KB`);
    }
  }
  
  // Store scan results
  const { error } = await supabase
    .from('doc_monitoring_history')
    .insert({
      action_type: 'scan',
      metadata: {
        total_files: files.length,
        living_documents: livingPaths.size,
        categories: Object.fromEntries(
          Object.entries(categories).map(([k, v]) => [k, v.length])
        )
      }
    });
  
  if (error) {
    console.error('Failed to save scan results:', error);
  }
  
  return categories;
}

scanDocumentation();
```

### Step 4: Create Archive Structure

```bash
# Create archive directory structure
mkdir -p docs/.archive_docs/2025-06-08/{cli-pipeline,technical-specs,code-documentation,work-summaries,solution-guides}

# Add .gitignore to keep archives but ignore their content in searches
echo "# Archived documentation - searchable via database" > docs/.archive_docs/README.md
```

### Step 5: Implement Basic Search

```typescript
// scripts/cli-pipeline/documentation/commands/search-documentation.ts
import { SupabaseClientService } from '@shared/services/supabase-client';
import { program } from 'commander';

const supabase = SupabaseClientService.getInstance().getClient();

program
  .argument('<query>', 'Search query')
  .option('--archived', 'Include archived documents')
  .action(async (query, options) => {
    // Search living documents
    const { data: livingDocs } = await supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,tags.cs.{${query}}`);
    
    if (livingDocs && livingDocs.length > 0) {
      console.log('\nLiving Documents:');
      livingDocs.forEach(doc => {
        console.log(`- ${doc.title} (${doc.file_path})`);
        console.log(`  ${doc.description}`);
      });
    }
    
    // Search archived documents if requested
    if (options.archived) {
      const { data: archivedDocs } = await supabase
        .from('doc_archives')
        .select('*')
        .or(`original_path.ilike.%${query}%,extracted_content.ilike.%${query}%`)
        .limit(10);
      
      if (archivedDocs && archivedDocs.length > 0) {
        console.log('\nArchived Documents:');
        archivedDocs.forEach(doc => {
          console.log(`- ${doc.original_path} (archived ${doc.archived_date})`);
        });
      }
    }
  });

program.parse();
```

## Phase 2: Content Consolidation (Next Week)

### Priority Living Documents to Create/Update

1. **CLI Pipeline Operations** (`cli-pipelines-documentation.md`)
   - Merge content from 55+ files in `docs/cli-pipeline/`
   - Structure: Overview → Command Reference → Common Tasks → Troubleshooting

2. **Database Schema Guide** (`database-schema-guide.md`)
   - Consolidate table documentation
   - Include naming conventions from CLAUDE.md
   - Add migration procedures

3. **Shared Services Catalog** (`shared-services-catalog.md`)
   - Document all services in `packages/shared/services/`
   - Include usage examples
   - Track dependencies

### Archive Process

```bash
# Example archiving workflow
./scripts/cli-pipeline/documentation/doc-monitor-cli.sh archive \
  --source "docs/cli-pipeline/*.md" \
  --exclude "continuously-updated/*" \
  --destination ".archive_docs/2025-06-08/cli-pipeline/" \
  --extract-to "cli-pipelines-documentation.md"
```

## Phase 3: Automation (Week 3)

### Review Reminders

```typescript
// Add to a daily cron job
async function checkReviews() {
  const { data: dueReviews } = await supabase
    .from('doc_continuous_monitoring')
    .select('*')
    .lte('next_review_date', new Date().toISOString());
  
  if (dueReviews && dueReviews.length > 0) {
    console.log('Documents due for review:');
    dueReviews.forEach(doc => {
      console.log(`- ${doc.title} (${doc.priority} priority)`);
    });
  }
}
```

### Integration with Dev Tasks

```sql
-- Link documentation updates to dev tasks
ALTER TABLE dev_tasks ADD COLUMN IF NOT EXISTS related_docs text[];

-- Track which docs need updates based on code changes
CREATE TABLE IF NOT EXISTS doc_update_queue (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  doc_id uuid REFERENCES doc_continuous_monitoring(id),
  reason text,
  suggested_changes jsonb,
  created_at timestamptz DEFAULT now()
);
```

## Monitoring Dashboard

Create a simple status command to track progress:

```bash
./scripts/cli-pipeline/documentation/doc-monitor-cli.sh status

# Output:
Documentation Monitoring Status
==============================
Living Documents: 8
  - Due for review: 2
  - Up to date: 6
  
Archived Documents: 342
  - CLI Pipeline: 45
  - Technical Specs: 89
  - Work Summaries: 78
  - Other: 130
  
Recent Activity:
  - Last scan: 2025-06-08 10:30
  - Last review: 2025-06-07 14:22
  - Documents archived this week: 23
```

## Success Criteria

Week 1:
- [ ] CLI pipeline created and working
- [ ] All living documents registered in database
- [ ] Initial scan completed
- [ ] Basic search functionality

Week 2:
- [ ] 50% of documentation archived
- [ ] Top 5 living documents consolidated
- [ ] Archive search working

Week 3:
- [ ] Automated review reminders active
- [ ] All documentation archived or consolidated
- [ ] Full system operational

## Next Immediate Steps

1. Run the setup commands above to create the CLI structure
2. Execute the initial document registration
3. Run the first scan to understand the scope
4. Begin consolidating the highest-priority living document (CLI operations)
5. Set up the first archive batch for work-summaries (lowest risk)

This practical approach will have the system operational within days while building toward the full vision over the coming weeks.