# Script CLI Pipeline Enhancement Guide

## Overview

This guide provides specific implementation details for enhancing the existing script management CLI pipeline located at `scripts/cli-pipeline/scripts/`. The enhancements will transform the minimal current implementation into a comprehensive script management system.

## Current State

### Existing Files
- `scripts-cli.sh` - Basic CLI wrapper (only has health-check)
- `direct-db-sync.ts` - Syncs scripts with database
- `sync-scripts.sh` - Shell wrapper for sync
- `analyze-script.ts` - Script analysis functionality
- `classify-script-with-prompt.ts` - AI classification

### Limitations
1. No comprehensive CLI commands
2. Basic sync without metadata capture
3. No pipeline association tracking
4. Limited classification integration
5. No archive management

## Enhanced CLI Commands

### 1. Update scripts-cli.sh

```bash
#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the track command function
source "$SCRIPT_DIR/../../cli-pipeline/core/track-command.sh"

case "$1" in
  "sync")
    track_command "scripts" "sync" "$@"
    shift
    ts-node "$SCRIPT_DIR/sync-all-scripts.ts" "$@"
    ;;
    
  "classify")
    track_command "scripts" "classify" "$@"
    shift
    ts-node "$SCRIPT_DIR/classify-script.ts" "$@"
    ;;
    
  "list")
    track_command "scripts" "list" "$@"
    shift
    ts-node "$SCRIPT_DIR/list-scripts.ts" "$@"
    ;;
    
  "search")
    track_command "scripts" "search" "$@"
    shift
    ts-node "$SCRIPT_DIR/search-scripts.ts" "$@"
    ;;
    
  "archive")
    track_command "scripts" "archive" "$@"
    shift
    ts-node "$SCRIPT_DIR/archive-script.ts" "$@"
    ;;
    
  "register")
    track_command "scripts" "register" "$@"
    shift
    ts-node "$SCRIPT_DIR/register-script.ts" "$@"
    ;;
    
  "stats")
    track_command "scripts" "stats" "$@"
    ts-node "$SCRIPT_DIR/script-stats.ts"
    ;;
    
  "viewer")
    track_command "scripts" "viewer" "$@"
    node "$SCRIPT_DIR/script-viewer-server.js"
    ;;
    
  "health-check")
    track_command "scripts" "health-check" "$@"
    ts-node "$SCRIPT_DIR/health-check.ts"
    ;;
    
  "--help"|"-h"|"")
    echo "Script Management CLI"
    echo ""
    echo "Commands:"
    echo "  sync              Full sync of all scripts with classification"
    echo "  classify <file>   Classify a single script file"
    echo "  list [options]    List scripts with filtering options"
    echo "    --pipeline <name>   Filter by CLI pipeline"
    echo "    --type <type>       Filter by document type"
    echo "    --recent <days>     Show recently modified"
    echo "  search <query>    Search scripts by content or metadata"
    echo "  archive <file>    Move script to archive folder"
    echo "  register <file>   Manually register a new script"
    echo "  stats             Show script statistics and insights"
    echo "  viewer            Start the script viewer server"
    echo "  health-check      Check script management system health"
    echo ""
    echo "Examples:"
    echo "  ./scripts-cli.sh sync"
    echo "  ./scripts-cli.sh list --pipeline google_sync --recent 7"
    echo "  ./scripts-cli.sh classify ./some-script.ts"
    echo "  ./scripts-cli.sh search 'supabase'"
    ;;
    
  *)
    echo "Unknown command: $1"
    echo "Use --help for available commands"
    exit 1
    ;;
esac
```

### 2. Enhanced Sync Implementation

Create `sync-all-scripts.ts`:

```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ScriptMetadata {
  file_path: string;
  cli_pipeline: string | null;
  file_size: number;
  last_modified: string;
  language: string;
  is_archived: boolean;
}

async function syncAllScripts() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔄 Starting comprehensive script synchronization...');
  
  // Find all script files
  const patterns = ['**/*.ts', '**/*.js', '**/*.sh', '**/*.py'];
  const scriptFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: path.join(process.cwd(), 'scripts'),
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
      absolute: false
    });
    scriptFiles.push(...files);
  }
  
  console.log(`📁 Found ${scriptFiles.length} script files`);
  
  // Process each script
  const processedScripts: ScriptMetadata[] = [];
  
  for (const file of scriptFiles) {
    const fullPath = path.join('scripts', file);
    const stats = await fs.stat(fullPath);
    
    // Determine CLI pipeline from path
    let cliPipeline: string | null = null;
    const pipelineMatch = file.match(/^cli-pipeline\/([^\/]+)\//);
    if (pipelineMatch) {
      cliPipeline = pipelineMatch[1];
    }
    
    // Determine if archived
    const isArchived = file.includes('.archived_scripts') || file.includes('.archive');
    
    // Get file extension for language
    const ext = path.extname(file).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.sh': 'bash',
      '.py': 'python'
    };
    
    processedScripts.push({
      file_path: fullPath,
      cli_pipeline: cliPipeline,
      file_size: stats.size,
      last_modified: stats.mtime.toISOString(),
      language: languageMap[ext] || 'unknown',
      is_archived: isArchived
    });
  }
  
  // Get existing scripts from database
  const { data: existingScripts, error: fetchError } = await supabase
    .from('scripts_registry')
    .select('file_path, id');
    
  if (fetchError) {
    console.error('❌ Error fetching existing scripts:', fetchError);
    return;
  }
  
  const existingPaths = new Set(existingScripts?.map(s => s.file_path) || []);
  const currentPaths = new Set(processedScripts.map(s => s.file_path));
  
  // Identify scripts to delete (hard delete)
  const toDelete = existingScripts?.filter(s => !currentPaths.has(s.file_path)) || [];
  
  if (toDelete.length > 0) {
    console.log(`🗑️  Removing ${toDelete.length} deleted scripts from registry`);
    const { error: deleteError } = await supabase
      .from('scripts_registry')
      .delete()
      .in('id', toDelete.map(s => s.id));
      
    if (deleteError) {
      console.error('❌ Error deleting scripts:', deleteError);
    }
  }
  
  // Update or insert scripts
  for (const script of processedScripts) {
    const isNew = !existingPaths.has(script.file_path);
    
    const scriptData = {
      file_path: script.file_path,
      title: path.basename(script.file_path, path.extname(script.file_path)),
      language: script.language,
      metadata: {
        cli_pipeline: script.cli_pipeline,
        file_size: script.file_size,
        last_modified: script.last_modified,
        is_archived: script.is_archived
      }
    };
    
    if (isNew) {
      console.log(`➕ Adding new script: ${script.file_path}`);
      
      // Get AI classification for new scripts
      if (!script.is_archived) {
        try {
          const content = await fs.readFile(script.file_path, 'utf-8');
          const classification = await classifyScript(content, script.file_path);
          
          const { error: insertError } = await supabase
            .from('scripts_registry')
            .insert({
              ...scriptData,
              document_type_id: classification.document_type_id,
              ai_assessment: classification.assessment
            });
            
          if (insertError) {
            console.error(`❌ Error inserting ${script.file_path}:`, insertError);
          }
        } catch (err) {
          console.error(`❌ Error processing ${script.file_path}:`, err);
        }
      }
    } else {
      // Update existing script metadata
      const { error: updateError } = await supabase
        .from('scripts_registry')
        .update(scriptData)
        .eq('file_path', script.file_path);
        
      if (updateError) {
        console.error(`❌ Error updating ${script.file_path}:`, updateError);
      }
    }
  }
  
  console.log('✅ Script synchronization complete!');
  
  // Show statistics
  const stats = {
    total: processedScripts.length,
    byPipeline: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    archived: processedScripts.filter(s => s.is_archived).length
  };
  
  for (const script of processedScripts) {
    if (script.cli_pipeline) {
      stats.byPipeline[script.cli_pipeline] = (stats.byPipeline[script.cli_pipeline] || 0) + 1;
    }
    stats.byLanguage[script.language] = (stats.byLanguage[script.language] || 0) + 1;
  }
  
  console.log('\n📊 Script Statistics:');
  console.log(`Total scripts: ${stats.total}`);
  console.log(`Archived: ${stats.archived}`);
  console.log('\nBy Pipeline:');
  Object.entries(stats.byPipeline)
    .sort(([,a], [,b]) => b - a)
    .forEach(([pipeline, count]) => {
      console.log(`  ${pipeline}: ${count}`);
    });
  console.log('\nBy Language:');
  Object.entries(stats.byLanguage).forEach(([lang, count]) => {
    console.log(`  ${lang}: ${count}`);
  });
}

async function classifyScript(content: string, filePath: string) {
  // Implementation would use Claude service to classify
  // Return mock data for now
  return {
    document_type_id: 'utility-script',
    assessment: {
      classification: 'Utility Script',
      confidence: 0.85,
      purpose: 'Script management and synchronization'
    }
  };
}

// Run if called directly
if (require.main === module) {
  syncAllScripts().catch(console.error);
}
```

### 3. List Scripts Command

Create `list-scripts.ts`:

```typescript
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { format } from 'date-fns';

interface ListOptions {
  pipeline?: string;
  type?: string;
  recent?: number;
}

async function listScripts(options: ListOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  let query = supabase
    .from('scripts_registry')
    .select(`
      file_path,
      title,
      language,
      metadata,
      document_type_id,
      created_at,
      updated_at
    `)
    .order('updated_at', { ascending: false });
  
  // Apply filters
  if (options.pipeline) {
    query = query.eq('metadata->>cli_pipeline', options.pipeline);
  }
  
  if (options.type) {
    query = query.eq('document_type_id', options.type);
  }
  
  if (options.recent) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.recent);
    query = query.gte('updated_at', cutoffDate.toISOString());
  }
  
  const { data: scripts, error } = await query;
  
  if (error) {
    console.error('❌ Error fetching scripts:', error);
    return;
  }
  
  if (!scripts || scripts.length === 0) {
    console.log('No scripts found matching criteria');
    return;
  }
  
  // Group by pipeline
  const byPipeline = scripts.reduce((acc, script) => {
    const pipeline = script.metadata?.cli_pipeline || 'root';
    if (!acc[pipeline]) acc[pipeline] = [];
    acc[pipeline].push(script);
    return acc;
  }, {} as Record<string, typeof scripts>);
  
  // Display results
  Object.entries(byPipeline).forEach(([pipeline, pipelineScripts]) => {
    console.log(`\n📁 ${pipeline}/`);
    console.log('─'.repeat(50));
    
    pipelineScripts.forEach(script => {
      const size = script.metadata?.file_size 
        ? `${(script.metadata.file_size / 1024).toFixed(1)}KB`
        : 'unknown';
      const modified = script.metadata?.last_modified
        ? format(new Date(script.metadata.last_modified), 'MMM dd, yyyy HH:mm')
        : 'unknown';
        
      console.log(`  📄 ${script.title}`);
      console.log(`     Language: ${script.language} | Size: ${size}`);
      console.log(`     Modified: ${modified}`);
      console.log(`     Type: ${script.document_type_id || 'unclassified'}`);
    });
  });
  
  console.log(`\n📊 Total: ${scripts.length} scripts`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: ListOptions = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--pipeline':
      options.pipeline = args[++i];
      break;
    case '--type':
      options.type = args[++i];
      break;
    case '--recent':
      options.recent = parseInt(args[++i]);
      break;
  }
}

listScripts(options).catch(console.error);
```

## Integration with dhg-admin-config

### Script Management Page Component

The script management page should be added to dhg-admin-config with these features:

1. **Hierarchical View**
   - Folder structure mimicking CLI pipeline organization
   - Collapsible pipeline folders
   - Script count badges per pipeline

2. **Script Details Panel**
   - Script metadata (size, modified date, language)
   - AI-generated summary and classification
   - Execution history if available
   - Associated tags

3. **Interactive Features**
   - Search across all scripts
   - Filter by pipeline, type, or date
   - Sort by name, date, or size
   - Quick actions (view, edit metadata, archive)

4. **Script Viewer Integration**
   - Right-side panel showing script content
   - Syntax highlighting
   - Copy button for code snippets
   - Link to open in IDE

## Automatic Registration for New Scripts

Add to CLAUDE.md instructions:

```markdown
## When Creating New CLI Scripts

After creating a new script in the CLI pipeline:

1. Register the script:
   ```bash
   ./scripts/cli-pipeline/scripts/scripts-cli.sh register <script-path>
   ```

2. Add meaningful tags based on:
   - Primary function (e.g., "sync", "analysis", "migration")
   - Dependencies used (e.g., "supabase", "claude-ai", "google-api")
   - Pipeline context

3. Ensure the script includes a header comment explaining its purpose

Example:
```typescript
#!/usr/bin/env ts-node
/**
 * Script: sync-expert-profiles.ts
 * Purpose: Synchronizes expert profiles from Google Drive to database
 * Pipeline: experts
 * Tags: sync, google-drive, expert-management
 */
```

## Next Steps

1. Implement the enhanced sync functionality
2. Create the additional CLI commands
3. Update the scripts-cli.sh with new commands
4. Test with real script data
5. Create the admin interface components
6. Document usage in project README

This enhancement will transform script management from a basic sync tool into a comprehensive system for organizing, discovering, and maintaining the extensive CLI pipeline ecosystem.