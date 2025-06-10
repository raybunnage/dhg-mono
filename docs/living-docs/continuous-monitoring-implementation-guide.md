# Continuous Documentation Monitoring - Implementation Guide

**Last Updated**: 2025-06-09  
**Next Review**: 2025-06-16 (7 days)  
**Status**: Active Implementation  
**Priority**: High  
**Related Documents**: 
- `continuous-documentation-monitoring-vision.md` (vision & strategy)
- `document-archiving-strategy.md` (archival approach)

---

## 📋 Table of Contents

1. [Quick Start Overview](#quick-start-overview)
2. [Phase 1: Foundation (Days 1-7)](#phase-1-foundation-days-1-7)
3. [Phase 2: Registration (Days 8-14)](#phase-2-registration-days-8-14)
4. [Phase 3: Automation (Days 15-21)](#phase-3-automation-days-15-21)
5. [Phase 4: Analytics (Days 22-30)](#phase-4-analytics-days-22-30)
6. [Common Tasks & Commands](#common-tasks--commands)
7. [Troubleshooting](#troubleshooting)
8. [Success Checklist](#success-checklist)

---

## Quick Start Overview

This implementation guide provides practical, day-by-day steps to build the Continuous Documentation Monitoring System. Each phase delivers working functionality that provides immediate value.

### 🎯 30-Day Implementation Timeline

- **Week 1**: Database setup, basic monitoring service, CLI commands
- **Week 2**: Document registration, first living documents, basic automation
- **Week 3**: Review workflows, archival process, usage tracking
- **Week 4**: Analytics, reporting, optimization

### 🚀 Immediate Value Delivered

- Day 1: Database tracking of documentation
- Day 3: CLI commands to check document status
- Day 7: First automated review reminders
- Day 14: Complete monitoring of critical documents
- Day 30: Full system with analytics and automation

---

## Phase 1: Foundation (Days 1-7)

### Day 1-2: Database Infrastructure

#### Step 1: Create Migration File

```sql
-- File: supabase/migrations/20250610_create_doc_monitoring_system.sql

-- Main monitoring table
CREATE TABLE IF NOT EXISTS doc_continuous_monitoring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_path TEXT NOT NULL UNIQUE,
  document_type TEXT NOT NULL DEFAULT 'active' 
    CHECK (document_type IN ('living', 'active', 'archived')),
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  description TEXT,
  review_frequency_days INTEGER DEFAULT 14,
  priority TEXT DEFAULT 'medium' 
    CHECK (priority IN ('high', 'medium', 'low')),
  last_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_review_date DATE DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  review_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' 
    CHECK (status IN ('active', 'needs_review', 'updating', 'deprecated')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_doc_monitoring_next_review ON doc_continuous_monitoring(next_review_date);
CREATE INDEX idx_doc_monitoring_type ON doc_continuous_monitoring(document_type);
CREATE INDEX idx_doc_monitoring_status ON doc_continuous_monitoring(status);

-- Document relationships
CREATE TABLE IF NOT EXISTS doc_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  living_doc_id UUID REFERENCES doc_continuous_monitoring(id) ON DELETE CASCADE,
  related_doc_path TEXT NOT NULL,
  relationship_type TEXT NOT NULL 
    CHECK (relationship_type IN ('replaces', 'references', 'extends', 'archives')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simplified usage tracking
CREATE TABLE IF NOT EXISTS doc_usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_path TEXT NOT NULL,
  access_count INTEGER DEFAULT 1,
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review history
CREATE TABLE IF NOT EXISTS doc_review_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES doc_continuous_monitoring(id),
  reviewer TEXT,
  changes_made BOOLEAN DEFAULT false,
  review_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Archival tracking
CREATE TABLE IF NOT EXISTS doc_archives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_path TEXT NOT NULL,
  archived_path TEXT NOT NULL,
  archive_reason TEXT NOT NULL,
  archived_by TEXT,
  archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  living_doc_id UUID REFERENCES doc_continuous_monitoring(id),
  metadata JSONB DEFAULT '{}'
);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_doc_monitoring_updated_at 
  BEFORE UPDATE ON doc_continuous_monitoring 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function for document stats
CREATE OR REPLACE FUNCTION get_doc_monitoring_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_documents', COUNT(*),
    'living_documents', COUNT(*) FILTER (WHERE document_type = 'living'),
    'active_documents', COUNT(*) FILTER (WHERE document_type = 'active'),
    'archived_documents', COUNT(*) FILTER (WHERE document_type = 'archived'),
    'needs_review', COUNT(*) FILTER (WHERE next_review_date <= CURRENT_DATE AND status = 'active'),
    'review_compliance', ROUND(
      AVG(CASE 
        WHEN next_review_date > CURRENT_DATE THEN 100 
        ELSE 0 
      END)::NUMERIC, 2
    )
  ) INTO result
  FROM doc_continuous_monitoring;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Initial seed data
INSERT INTO doc_continuous_monitoring (file_path, document_type, title, area, priority, review_frequency_days) 
VALUES
  ('docs/living-docs/CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md', 'living', 'Living Docs Template Guide', 'documentation', 'high', 7),
  ('docs/living-docs/document-archiving-strategy.md', 'living', 'Document Archiving Strategy', 'documentation', 'high', 14),
  ('docs/living-docs/continuous-documentation-monitoring-vision.md', 'living', 'Documentation Monitoring Vision', 'documentation', 'high', 7),
  ('docs/living-docs/continuous-monitoring-implementation-guide.md', 'living', 'Monitoring Implementation Guide', 'documentation', 'high', 7)
ON CONFLICT (file_path) DO NOTHING;
```

#### Step 2: Apply Migration

```bash
# Apply the migration
./scripts/cli-pipeline/database/database-cli.sh migration run-staged \
  supabase/migrations/20250610_create_doc_monitoring_system.sql

# Verify tables were created
./scripts/cli-pipeline/database/database-cli.sh table-structure doc_continuous_monitoring
```

### Day 3-4: Monitoring Service

#### Step 1: Create Core Service

```typescript
// File: packages/shared/services/doc-monitoring/doc-monitoring-service.ts

import { SupabaseClientService } from '../supabase-client';
import type { Database } from '../../../../supabase/types';

type DocMonitoring = Database['public']['Tables']['doc_continuous_monitoring']['Row'];
type DocMonitoringInsert = Database['public']['Tables']['doc_continuous_monitoring']['Insert'];
type DocMonitoringUpdate = Database['public']['Tables']['doc_continuous_monitoring']['Update'];

export interface DocumentStats {
  total_documents: number;
  living_documents: number;
  active_documents: number;
  archived_documents: number;
  needs_review: number;
  review_compliance: number;
}

export class DocumentMonitoringService {
  private static instance: DocumentMonitoringService;
  private supabase = SupabaseClientService.getInstance().getClient();

  private constructor() {}

  static getInstance(): DocumentMonitoringService {
    if (!this.instance) {
      this.instance = new DocumentMonitoringService();
    }
    return this.instance;
  }

  /**
   * Register a document for monitoring
   */
  async registerDocument(params: {
    filePath: string;
    title: string;
    area: string;
    description?: string;
    type?: 'living' | 'active' | 'archived';
    priority?: 'high' | 'medium' | 'low';
    reviewDays?: number;
  }): Promise<DocMonitoring> {
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .insert({
        file_path: params.filePath,
        title: params.title,
        area: params.area,
        description: params.description,
        document_type: params.type || 'active',
        priority: params.priority || 'medium',
        review_frequency_days: params.reviewDays || 14,
        next_review_date: new Date(
          Date.now() + (params.reviewDays || 14) * 24 * 60 * 60 * 1000
        ).toISOString()
      } as DocMonitoringInsert)
      .select()
      .single();

    if (error) throw new Error(`Failed to register document: ${error.message}`);
    return data;
  }

  /**
   * Get documents needing review
   */
  async getDocumentsNeedingReview(): Promise<DocMonitoring[]> {
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .lte('next_review_date', new Date().toISOString())
      .eq('status', 'active')
      .order('priority', { ascending: false })
      .order('next_review_date', { ascending: true });

    if (error) throw new Error(`Failed to get documents: ${error.message}`);
    return data || [];
  }

  /**
   * Mark document as reviewed
   */
  async markAsReviewed(
    documentId: string, 
    params: {
      changesMade?: boolean;
      reviewNotes?: string;
      reviewer?: string;
    } = {}
  ): Promise<void> {
    // Get current document
    const { data: doc, error: fetchError } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('review_frequency_days, review_count')
      .eq('id', documentId)
      .single();

    if (fetchError) throw new Error(`Document not found: ${fetchError.message}`);

    // Calculate next review date
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + (doc.review_frequency_days || 14));

    // Update document
    const { error: updateError } = await this.supabase
      .from('doc_continuous_monitoring')
      .update({
        last_reviewed_at: new Date().toISOString(),
        next_review_date: nextReviewDate.toISOString(),
        review_count: (doc.review_count || 0) + 1,
        status: 'active'
      } as DocMonitoringUpdate)
      .eq('id', documentId);

    if (updateError) throw new Error(`Failed to update document: ${updateError.message}`);

    // Record review history
    await this.supabase
      .from('doc_review_history')
      .insert({
        document_id: documentId,
        reviewer: params.reviewer || 'system',
        changes_made: params.changesMade || false,
        review_notes: params.reviewNotes
      });
  }

  /**
   * Track document usage
   */
  async trackUsage(filePath: string): Promise<void> {
    const { data: existing } = await this.supabase
      .from('doc_usage_tracking')
      .select('id, access_count')
      .eq('document_path', filePath)
      .single();

    if (existing) {
      await this.supabase
        .from('doc_usage_tracking')
        .update({
          access_count: existing.access_count + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await this.supabase
        .from('doc_usage_tracking')
        .insert({
          document_path: filePath
        });
    }
  }

  /**
   * Get monitoring statistics
   */
  async getStats(): Promise<DocumentStats> {
    const { data, error } = await this.supabase
      .rpc('get_doc_monitoring_stats');

    if (error) throw new Error(`Failed to get stats: ${error.message}`);
    return data as DocumentStats;
  }

  /**
   * Find document by path
   */
  async findByPath(filePath: string): Promise<DocMonitoring | null> {
    const { data, error } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('*')
      .eq('file_path', filePath)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to find document: ${error.message}`);
    }
    
    return data;
  }

  /**
   * Archive a document
   */
  async archiveDocument(params: {
    originalPath: string;
    archivePath: string;
    reason: string;
    archivedBy?: string;
    livingDocId?: string;
  }): Promise<void> {
    // Start transaction
    const { data: doc } = await this.supabase
      .from('doc_continuous_monitoring')
      .select('id')
      .eq('file_path', params.originalPath)
      .single();

    if (doc) {
      // Update document status
      await this.supabase
        .from('doc_continuous_monitoring')
        .update({ 
          status: 'deprecated',
          document_type: 'archived'
        } as DocMonitoringUpdate)
        .eq('id', doc.id);
    }

    // Record archival
    await this.supabase
      .from('doc_archives')
      .insert({
        original_path: params.originalPath,
        archived_path: params.archivePath,
        archive_reason: params.reason,
        archived_by: params.archivedBy || 'system',
        living_doc_id: params.livingDocId
      });
  }
}

// Export singleton
export const docMonitoringService = DocumentMonitoringService.getInstance();
```

### Day 5-6: CLI Implementation

#### Step 1: Create CLI Structure

```bash
# Create CLI directory
mkdir -p scripts/cli-pipeline/documentation
cd scripts/cli-pipeline/documentation

# Create package.json
cat > package.json << 'EOF'
{
  "name": "documentation-cli",
  "version": "1.0.0",
  "description": "Documentation monitoring CLI",
  "dependencies": {
    "commander": "^11.0.0"
  }
}
EOF

# Install dependencies
npm install
```

#### Step 2: Create CLI Commands

```typescript
// File: scripts/cli-pipeline/documentation/docs-monitor.ts

import { program } from 'commander';
import { docMonitoringService } from '../../../packages/shared/services/doc-monitoring/doc-monitoring-service';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../../../packages/shared/services/supabase-client';

// Helper to extract title from markdown
function extractTitle(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^#\s+(.+)$/m);
    if (match) return match[1];
  } catch (e) {}
  
  return path.basename(filePath, path.extname(filePath))
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

program
  .name('docs-monitor')
  .description('Documentation monitoring CLI')
  .version('1.0.0');

// Register command
program
  .command('register <file>')
  .description('Register a document for monitoring')
  .option('-t, --type <type>', 'Document type (living/active/archived)', 'active')
  .option('-a, --area <area>', 'Document area (e.g., cli-pipeline, deployment)', 'general')
  .option('-p, --priority <priority>', 'Priority (high/medium/low)', 'medium')
  .option('-f, --frequency <days>', 'Review frequency in days', '14')
  .option('-d, --description <desc>', 'Document description')
  .action(async (file, options) => {
    try {
      const fullPath = path.resolve(file);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${file}`);
        process.exit(1);
      }

      // Extract relative path for storage
      const projectRoot = process.cwd();
      const relativePath = path.relative(projectRoot, fullPath);
      
      // Check if already registered
      const existing = await docMonitoringService.findByPath(relativePath);
      if (existing) {
        console.log(`⚠️  Document already registered: ${relativePath}`);
        return;
      }

      // Extract title from file
      const title = extractTitle(fullPath);

      // Register document
      const doc = await docMonitoringService.registerDocument({
        filePath: relativePath,
        title,
        area: options.area,
        description: options.description,
        type: options.type,
        priority: options.priority,
        reviewDays: parseInt(options.frequency)
      });

      console.log(`✅ Registered: ${relativePath}`);
      console.log(`   Title: ${title}`);
      console.log(`   Type: ${options.type}`);
      console.log(`   Review every: ${options.frequency} days`);
      console.log(`   Next review: ${new Date(doc.next_review_date).toLocaleDateString()}`);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Check updates command
program
  .command('check-updates')
  .description('Check which documents need review')
  .option('-l, --list', 'List all monitored documents', false)
  .action(async (options) => {
    try {
      if (options.list) {
        // List all documents
        const { data: docs } = await supabase
          .from('doc_continuous_monitoring')
          .select('*')
          .eq('status', 'active')
          .order('document_type')
          .order('priority', { ascending: false });

        console.log('\n📚 All Monitored Documents:\n');
        
        const byType = docs.reduce((acc, doc) => {
          if (!acc[doc.document_type]) acc[doc.document_type] = [];
          acc[doc.document_type].push(doc);
          return acc;
        }, {});

        Object.entries(byType).forEach(([type, docs]) => {
          console.log(`\n${type.toUpperCase()} DOCUMENTS (${docs.length}):`);
          docs.forEach(doc => {
            const icon = doc.priority === 'high' ? '🔴' : doc.priority === 'medium' ? '🟡' : '⚪';
            console.log(`  ${icon} ${doc.title}`);
            console.log(`     Path: ${doc.file_path}`);
            console.log(`     Next review: ${new Date(doc.next_review_date).toLocaleDateString()}\n`);
          });
        });
        
        return;
      }

      // Check for documents needing review
      const docs = await docMonitoringService.getDocumentsNeedingReview();
      
      if (docs.length === 0) {
        console.log('\n✅ All documents are up to date!\n');
        return;
      }

      console.log(`\n⚠️  ${docs.length} documents need review:\n`);
      
      // Group by priority
      const byPriority = {
        high: docs.filter(d => d.priority === 'high'),
        medium: docs.filter(d => d.priority === 'medium'),
        low: docs.filter(d => d.priority === 'low')
      };

      // Show high priority first
      if (byPriority.high.length > 0) {
        console.log('🔴 HIGH PRIORITY:');
        byPriority.high.forEach(doc => {
          const daysOverdue = Math.floor(
            (Date.now() - new Date(doc.next_review_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log(`   ${doc.title}`);
          console.log(`   Path: ${doc.file_path}`);
          console.log(`   Overdue by: ${daysOverdue} days\n`);
        });
      }

      // Show medium priority
      if (byPriority.medium.length > 0) {
        console.log('🟡 MEDIUM PRIORITY:');
        byPriority.medium.forEach(doc => {
          const daysOverdue = Math.floor(
            (Date.now() - new Date(doc.next_review_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log(`   ${doc.title}`);
          console.log(`   Path: ${doc.file_path}`);
          console.log(`   Overdue by: ${daysOverdue} days\n`);
        });
      }

      // Show low priority
      if (byPriority.low.length > 0) {
        console.log('⚪ LOW PRIORITY:');
        byPriority.low.forEach(doc => {
          const daysOverdue = Math.floor(
            (Date.now() - new Date(doc.next_review_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log(`   ${doc.title}`);
          console.log(`   Path: ${doc.file_path}`);
          console.log(`   Overdue by: ${daysOverdue} days\n`);
        });
      }

      // Show quick command to review
      console.log('To mark as reviewed, use:');
      console.log('  ./docs-cli.sh reviewed <file-path>\n');

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Mark as reviewed command
program
  .command('reviewed <file>')
  .description('Mark a document as reviewed')
  .option('-c, --changes', 'Changes were made to the document', false)
  .option('-n, --notes <notes>', 'Review notes')
  .action(async (file, options) => {
    try {
      // Find document
      const doc = await docMonitoringService.findByPath(file);
      if (!doc) {
        console.error(`❌ Document not found in monitoring system: ${file}`);
        console.log('   Use "register" command to add it first.');
        process.exit(1);
      }

      // Mark as reviewed
      await docMonitoringService.markAsReviewed(doc.id, {
        changesMade: options.changes,
        reviewNotes: options.notes,
        reviewer: process.env.USER || 'unknown'
      });

      console.log(`✅ Marked as reviewed: ${file}`);
      console.log(`   Next review: ${new Date(
        Date.now() + doc.review_frequency_days * 24 * 60 * 60 * 1000
      ).toLocaleDateString()}`);
      
      if (options.changes) {
        console.log('   Changes were made to the document');
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Health report command
program
  .command('health-report')
  .description('Generate documentation health report')
  .action(async () => {
    try {
      const stats = await docMonitoringService.getStats();
      
      console.log('\n📊 Documentation Health Report');
      console.log('================================\n');
      
      console.log(`Total Documents: ${stats.total_documents}`);
      console.log(`  Living Documents: ${stats.living_documents}`);
      console.log(`  Active Documents: ${stats.active_documents}`);
      console.log(`  Archived Documents: ${stats.archived_documents}\n`);
      
      console.log(`Documents Needing Review: ${stats.needs_review}`);
      console.log(`Review Compliance: ${stats.review_compliance}%\n`);
      
      // Show breakdown by area
      const { data: byArea } = await supabase
        .from('doc_continuous_monitoring')
        .select('area')
        .eq('status', 'active');
      
      const areaCounts = byArea.reduce((acc, doc) => {
        acc[doc.area] = (acc[doc.area] || 0) + 1;
        return acc;
      }, {});
      
      console.log('Documents by Area:');
      Object.entries(areaCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([area, count]) => {
          console.log(`  ${area}: ${count}`);
        });
      
      console.log('\n');

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

// Archive command
program
  .command('archive <file>')
  .description('Archive a document')
  .requiredOption('-r, --reason <reason>', 'Reason for archiving')
  .option('-l, --living-doc <path>', 'Living document that replaces this')
  .action(async (file, options) => {
    try {
      // Create archive path
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const archivePath = file.replace('docs/', 'docs/.archives/2025/')
        .replace('.md', `.${date}.md`);

      // Find living doc if specified
      let livingDocId;
      if (options.livingDoc) {
        const livingDoc = await docMonitoringService.findByPath(options.livingDoc);
        if (livingDoc) livingDocId = livingDoc.id;
      }

      // Archive the document
      await docMonitoringService.archiveDocument({
        originalPath: file,
        archivePath,
        reason: options.reason,
        archivedBy: process.env.USER || 'unknown',
        livingDocId
      });

      console.log(`✅ Archived: ${file}`);
      console.log(`   To: ${archivePath}`);
      console.log(`   Reason: ${options.reason}`);
      
      if (options.livingDoc) {
        console.log(`   Replaced by: ${options.livingDoc}`);
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
```

#### Step 3: Create Shell Wrapper

```bash
#!/bin/bash
# File: scripts/cli-pipeline/documentation/docs-cli.sh

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Load environment
if [ -f "$PROJECT_ROOT/.env.development" ]; then
  export $(cat "$PROJECT_ROOT/.env.development" | grep -v '^#' | xargs)
fi

# Track command (if tracking exists)
if [ -f "$PROJECT_ROOT/scripts/cli-pipeline/common/functions.sh" ]; then
  source "$PROJECT_ROOT/scripts/cli-pipeline/common/functions.sh"
  track_command "documentation" "$1"
fi

# Run the CLI
cd "$PROJECT_ROOT"
ts-node "$SCRIPT_DIR/docs-monitor.ts" "$@"
```

### Day 7: Initial Testing & Deployment

#### Step 1: Make Scripts Executable

```bash
chmod +x scripts/cli-pipeline/documentation/docs-cli.sh
```

#### Step 2: Test Basic Commands

```bash
# Test registration
./scripts/cli-pipeline/documentation/docs-cli.sh register \
  "docs/living-docs/CONTINUOUSLY-UPDATED-TEMPLATE-GUIDE.md" \
  --type living \
  --area documentation \
  --priority high \
  --frequency 7

# Check for updates
./scripts/cli-pipeline/documentation/docs-cli.sh check-updates

# List all documents
./scripts/cli-pipeline/documentation/docs-cli.sh check-updates --list

# Generate health report
./scripts/cli-pipeline/documentation/docs-cli.sh health-report
```

---

## Phase 2: Registration (Days 8-14)

### Day 8-9: Bulk Registration

#### Step 1: Create Registration Script

```bash
#!/bin/bash
# File: scripts/cli-pipeline/documentation/bulk-register.sh

DOCS_CLI="./scripts/cli-pipeline/documentation/docs-cli.sh"

echo "🚀 Registering Living Documents..."

# Register all living documents
for doc in docs/living-docs/*.md; do
  if [ -f "$doc" ]; then
    echo "Registering: $doc"
    $DOCS_CLI register "$doc" \
      --type living \
      --area documentation \
      --priority high \
      --frequency 14
  fi
done

echo -e "\n🚀 Registering High-Value Technical Specs..."

# Register critical technical specs
$DOCS_CLI register "docs/technical-specs/monorepo-organization-2024.md" \
  --area architecture --priority high --frequency 30

$DOCS_CLI register "docs/technical-specs/database-architecture-evaluation.md" \
  --area database --priority high --frequency 30

$DOCS_CLI register "docs/technical-specs/google-drive-integration.md" \
  --area integrations --priority medium --frequency 45

echo -e "\n🚀 Registering Solution Guides..."

# Register important solution guides
$DOCS_CLI register "docs/solution-guides/SUPABASE_CONNECTION_COMPLETE_GUIDE.md" \
  --area database --priority high --frequency 30

$DOCS_CLI register "docs/solution-guides/GIT_WORKTREE_WORKFLOW_GUIDE.md" \
  --area git --priority medium --frequency 60

echo -e "\n✅ Registration complete!"
$DOCS_CLI health-report
```

#### Step 2: Run Bulk Registration

```bash
chmod +x scripts/cli-pipeline/documentation/bulk-register.sh
./scripts/cli-pipeline/documentation/bulk-register.sh
```

### Day 10-11: Create First Consolidated Living Documents

#### Step 1: Identify Consolidation Targets

```bash
# Find related documents
echo "Dashboard-related documents:"
find docs -name "*.md" -type f | xargs grep -l "dashboard" | grep -E "(technical-specs|solution-guides)"

echo -e "\nAuthentication-related documents:"
find docs -name "*.md" -type f | xargs grep -l "auth" | grep -E "(technical-specs|solution-guides)"

echo -e "\nTesting-related documents:"
find docs -name "*.md" -type f | xargs grep -l "test" | grep -E "(technical-specs|solution-guides)"
```

#### Step 2: Create Consolidated Document

```markdown
# File: docs/living-docs/testing-strategy-implementation.md

# Testing Strategy & Implementation System

**Last Updated**: 2025-06-10  
**Next Review**: 2025-06-24 (14 days)  
**Status**: Active  
**Priority**: High  
**Related Archives**: 4 documents  

## Executive Summary

This living document consolidates all testing strategy and implementation guidance for the DHG monorepo, replacing:
- `testing-vision-and-implementation.md`
- `testing-vision-and-implementation-guide.md` 
- `testing-quick-start-dhg-apps.md`
- Various app-specific testing documentation

## Current Status

### What's Working Well
- Basic Vitest setup in most apps
- Snapshot testing for components
- Integration tests for CLI pipelines

### Current Priority
- **Immediate Focus**: Implement comprehensive testing for dhg-admin-code
- **Blocking Issues**: Shared component testing strategy needed
- **Next Milestone**: 80% code coverage by end of month

[... continue with consolidated content ...]
```

### Day 12-14: Archive Replaced Documents

#### Step 1: Create Archive Structure

```bash
# Create archive directories
mkdir -p docs/.archives/2025/{technical-specs,solution-guides,work-summaries}
```

#### Step 2: Archive Documents

```bash
# Archive replaced documents
./scripts/cli-pipeline/documentation/docs-cli.sh archive \
  "docs/technical-specs/testing-vision-and-implementation.md" \
  --reason "Consolidated into living document" \
  --living-doc "docs/living-docs/testing-strategy-implementation.md"

# Move physical file
mv docs/technical-specs/testing-vision-and-implementation.md \
   docs/.archives/2025/technical-specs/testing-vision-and-implementation.20250612.md
```

---

## Phase 3: Automation (Days 15-21)

### Day 15-16: Review Reminders

#### Step 1: Create Review Task Generator

```typescript
// File: scripts/cli-pipeline/documentation/create-review-tasks.ts

import { docMonitoringService } from '../../../packages/shared/services/doc-monitoring/doc-monitoring-service';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function createReviewTasks() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get documents needing review
  const docs = await docMonitoringService.getDocumentsNeedingReview();
  
  // Filter high-priority documents
  const highPriority = docs.filter(d => d.priority === 'high');
  
  console.log(`Found ${docs.length} documents needing review`);
  console.log(`Creating tasks for ${highPriority.length} high-priority documents...`);
  
  for (const doc of highPriority) {
    // Check if task already exists
    const { data: existing } = await supabase
      .from('dev_tasks')
      .select('id')
      .eq('metadata->document_id', doc.id)
      .eq('status', 'pending')
      .single();
    
    if (!existing) {
      // Create new task
      const { data: task, error } = await supabase
        .from('dev_tasks')
        .insert({
          title: `Review: ${doc.title}`,
          description: `Document needs scheduled review.\n\nFile: ${doc.file_path}\nArea: ${doc.area}\nLast reviewed: ${new Date(doc.last_reviewed_at).toLocaleDateString()}`,
          task_type: 'documentation',
          priority: 'medium',
          status: 'pending',
          metadata: {
            document_id: doc.id,
            file_path: doc.file_path,
            review_type: 'scheduled'
          }
        })
        .select()
        .single();
      
      if (!error) {
        console.log(`✅ Created task for: ${doc.title}`);
      } else {
        console.error(`❌ Failed to create task for ${doc.title}:`, error.message);
      }
    } else {
      console.log(`⏭️  Task already exists for: ${doc.title}`);
    }
  }
  
  console.log('\nDone!');
}

// Run if called directly
if (require.main === module) {
  createReviewTasks().catch(console.error);
}

export { createReviewTasks };
```

#### Step 2: Add to Daily Routine

```bash
# Add to crontab or daily script
0 9 * * * cd /path/to/project && ts-node scripts/cli-pipeline/documentation/create-review-tasks.ts
```

### Day 17-18: Usage Tracking

#### Step 1: Create Markdown Viewer Hook

```typescript
// File: scripts/cli-pipeline/viewers/track-doc-usage.ts

import { docMonitoringService } from '../../../packages/shared/services/doc-monitoring/doc-monitoring-service';

export async function trackDocumentView(filePath: string) {
  try {
    // Only track markdown files
    if (!filePath.endsWith('.md')) return;
    
    // Only track docs in specific directories
    if (!filePath.includes('/docs/')) return;
    
    await docMonitoringService.trackUsage(filePath);
  } catch (error) {
    // Silently fail - don't interrupt viewing
    console.debug('Failed to track usage:', error.message);
  }
}
```

### Day 19-21: Monitoring Dashboard

#### Step 1: Create Dashboard Page

```tsx
// File: apps/dhg-admin-code/src/pages/DocumentationHealth.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { FileText, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';

interface DocStats {
  total_documents: number;
  living_documents: number;
  active_documents: number;
  archived_documents: number;
  needs_review: number;
  review_compliance: number;
}

interface Document {
  id: string;
  file_path: string;
  title: string;
  document_type: string;
  priority: string;
  next_review_date: string;
  last_reviewed_at: string;
  review_count: number;
}

export default function DocumentationHealth() {
  const [stats, setStats] = useState<DocStats | null>(null);
  const [needsReview, setNeedsReview] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get stats
      const { data: statsData } = await supabase
        .rpc('get_doc_monitoring_stats');
      setStats(statsData);

      // Get documents needing review
      const { data: docsData } = await supabase
        .from('doc_continuous_monitoring')
        .select('*')
        .lte('next_review_date', new Date().toISOString())
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('next_review_date', { ascending: true })
        .limit(10);
      
      setNeedsReview(docsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsReviewed = async (docId: string) => {
    try {
      // Update document
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + 14);

      await supabase
        .from('doc_continuous_monitoring')
        .update({
          last_reviewed_at: new Date().toISOString(),
          next_review_date: nextReviewDate.toISOString()
        })
        .eq('id', docId);

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error marking as reviewed:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading documentation health...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Documentation Health</h1>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <FileText className="h-8 w-8 text-gray-400" />
              <span className="text-2xl font-bold">{stats?.total_documents || 0}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Total Documents</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600">
                {stats?.living_documents || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Living Documents</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <Clock className="h-8 w-8 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">
                {stats?.active_documents || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Active Documents</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <span className="text-2xl font-bold text-orange-600">
                {stats?.needs_review || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Need Review</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600">
                {stats?.review_compliance || 0}%
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Compliance</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <FileText className="h-8 w-8 text-gray-400" />
              <span className="text-2xl font-bold text-gray-600">
                {stats?.archived_documents || 0}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-2">Archived</p>
          </div>
        </div>

        {/* Documents Needing Review */}
        {needsReview.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Documents Needing Review
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {needsReview.map(doc => {
                const daysOverdue = Math.floor(
                  (new Date().getTime() - new Date(doc.next_review_date).getTime()) / 
                  (1000 * 60 * 60 * 24)
                );
                
                return (
                  <div key={doc.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{doc.title}</h3>
                      <p className="text-sm text-gray-500">{doc.file_path}</p>
                      <p className="text-sm text-red-600 mt-1">
                        Overdue by {Math.abs(daysOverdue)} days
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        doc.priority === 'high' 
                          ? 'bg-red-100 text-red-800'
                          : doc.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {doc.priority}
                      </span>
                      <button
                        onClick={() => markAsReviewed(doc.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Mark Reviewed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
```

---

## Phase 4: Analytics (Days 22-30)

### Day 22-24: Usage Analytics

#### Step 1: Create Analytics Queries

```sql
-- Add to database
CREATE OR REPLACE VIEW doc_usage_analytics AS
SELECT 
  dut.document_path,
  dcm.title,
  dcm.document_type,
  dcm.area,
  SUM(dut.access_count) as total_accesses,
  MAX(dut.last_accessed_at) as last_accessed,
  CASE 
    WHEN MAX(dut.last_accessed_at) > NOW() - INTERVAL '7 days' THEN 'active'
    WHEN MAX(dut.last_accessed_at) > NOW() - INTERVAL '30 days' THEN 'moderate'
    ELSE 'inactive'
  END as usage_status
FROM doc_usage_tracking dut
LEFT JOIN doc_continuous_monitoring dcm ON dcm.file_path = dut.document_path
GROUP BY dut.document_path, dcm.title, dcm.document_type, dcm.area;
```

### Day 25-27: Archival Recommendations

#### Step 1: Create Recommendation Engine

```typescript
// File: scripts/cli-pipeline/documentation/archival-recommendations.ts

import { supabase } from '../../../packages/shared/services/supabase-client';

interface ArchivalCandidate {
  file_path: string;
  title: string;
  reason: string;
  score: number;
  last_accessed: Date | null;
  total_accesses: number;
}

async function getArchivalRecommendations(): Promise<ArchivalCandidate[]> {
  // Get usage data
  const { data: usageData } = await supabase
    .from('doc_usage_analytics')
    .select('*')
    .eq('usage_status', 'inactive');

  // Get old documents
  const { data: oldDocs } = await supabase
    .from('doc_continuous_monitoring')
    .select('*')
    .eq('document_type', 'active')
    .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  const candidates: ArchivalCandidate[] = [];

  // Process unused documents
  for (const doc of (usageData || [])) {
    if (doc.total_accesses < 5) {
      candidates.push({
        file_path: doc.document_path,
        title: doc.title || doc.document_path,
        reason: 'Low usage (< 5 accesses)',
        score: 0.9,
        last_accessed: doc.last_accessed,
        total_accesses: doc.total_accesses
      });
    }
  }

  // Process old documents
  for (const doc of (oldDocs || [])) {
    const usage = usageData?.find(u => u.document_path === doc.file_path);
    if (!usage || usage.total_accesses < 10) {
      candidates.push({
        file_path: doc.file_path,
        title: doc.title,
        reason: 'Old and rarely accessed',
        score: 0.8,
        last_accessed: usage?.last_accessed || null,
        total_accesses: usage?.total_accesses || 0
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// CLI command
if (require.main === module) {
  getArchivalRecommendations().then(candidates => {
    console.log('\n📦 Archival Recommendations\n');
    console.log(`Found ${candidates.length} candidates for archival:\n`);
    
    candidates.slice(0, 20).forEach((doc, i) => {
      console.log(`${i + 1}. ${doc.title}`);
      console.log(`   Path: ${doc.file_path}`);
      console.log(`   Reason: ${doc.reason}`);
      console.log(`   Accesses: ${doc.total_accesses}`);
      console.log(`   Last accessed: ${doc.last_accessed ? new Date(doc.last_accessed).toLocaleDateString() : 'Never'}\n`);
    });
  }).catch(console.error);
}
```

### Day 28-30: Final Integration

#### Step 1: Add to Package Scripts

```json
// Add to root package.json
{
  "scripts": {
    "docs:register": "./scripts/cli-pipeline/documentation/docs-cli.sh register",
    "docs:check": "./scripts/cli-pipeline/documentation/docs-cli.sh check-updates",
    "docs:health": "./scripts/cli-pipeline/documentation/docs-cli.sh health-report",
    "docs:review-tasks": "ts-node scripts/cli-pipeline/documentation/create-review-tasks.ts",
    "docs:archival-check": "ts-node scripts/cli-pipeline/documentation/archival-recommendations.ts"
  }
}
```

---

## Common Tasks & Commands

### Daily Tasks

```bash
# Check what needs review
pnpm docs:check

# Mark a document as reviewed
./scripts/cli-pipeline/documentation/docs-cli.sh reviewed "docs/living-docs/some-doc.md"

# Create review tasks for high-priority docs
pnpm docs:review-tasks
```

### Weekly Tasks

```bash
# Generate health report
pnpm docs:health

# Check for archival candidates
pnpm docs:archival-check

# Review usage analytics
./scripts/cli-pipeline/documentation/docs-cli.sh usage-report
```

### Document Management

```bash
# Register a new document
pnpm docs:register "path/to/doc.md" --type living --area deployment

# Archive a document
./scripts/cli-pipeline/documentation/docs-cli.sh archive "path/to/old-doc.md" \
  --reason "Outdated content" \
  --living-doc "path/to/replacement.md"

# Find documents by area
./scripts/cli-pipeline/documentation/docs-cli.sh list --area database
```

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection
./scripts/cli-pipeline/database/database-cli.sh connection-test
```

#### TypeScript Compilation Errors
```bash
# Check TypeScript
cd scripts/cli-pipeline/documentation
tsc --noEmit *.ts

# Reinstall dependencies
npm install
```

#### Documents Not Found
```bash
# Use relative paths from project root
pwd  # Ensure you're in project root
./scripts/cli-pipeline/documentation/docs-cli.sh register "docs/your-doc.md"
```

---

## Success Checklist

### Week 1 ✅
- [ ] Database tables created and tested
- [ ] Monitoring service implemented
- [ ] Basic CLI commands working
- [ ] 10+ documents registered
- [ ] First health report generated

### Week 2 ✅
- [ ] All living documents registered
- [ ] 50+ active documents monitored
- [ ] Review reminders automated
- [ ] First documents archived
- [ ] Usage tracking implemented

### Week 3 ✅
- [ ] Dashboard page created
- [ ] Review tasks integrated
- [ ] 100+ documents processed
- [ ] Analytics queries working
- [ ] Archival recommendations generated

### Week 4 ✅
- [ ] Full system operational
- [ ] 200+ documents monitored
- [ ] Automated workflows running
- [ ] Team trained on system
- [ ] Success metrics achieved

### Long-term Success Metrics
- [ ] 60% reduction in active documents
- [ ] 90% review compliance rate
- [ ] 80% reduction in maintenance time
- [ ] 95% user satisfaction
- [ ] Zero lost information

---

## Next Steps

1. **Expand Coverage**: Register remaining valuable documents
2. **Enhance Automation**: Add git hooks and CI/CD integration
3. **Improve Analytics**: Build comprehensive dashboards
4. **Scale System**: Add team workflows and permissions
5. **Measure Impact**: Track success metrics monthly

---

*This implementation guide is a living document that will be updated as the system evolves and improves based on real-world usage.*