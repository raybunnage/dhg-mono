#!/usr/bin/env ts-node
/**
 * Script: sync-all-scripts.ts
 * Purpose: Comprehensive script synchronization with enhanced metadata and AI classification
 * Pipeline: scripts
 * Tags: sync, scripts-registry, ai-classification
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { claudeService } from '@shared/services/claude-service';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface ScriptMetadata {
  file_path: string;
  cli_pipeline: string | null;
  file_size: number;
  last_modified: string;
  language: string;
  is_archived: boolean;
  file_hash: string;
}

interface ClassificationResult {
  document_type_id: string;
  assessment: {
    classification: string;
    confidence: number;
    purpose: string;
    dependencies?: string[];
    tags?: string[];
  };
}

/**
 * Calculate SHA-256 hash of file content
 */
async function calculateFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Classify script using Claude AI
 */
async function classifyScript(content: string, filePath: string): Promise<ClassificationResult> {
  try {
    const prompt = `You are analyzing a script file for classification. Based on the content below, determine:
1. The document type (one of: Data Processing Script, Deployment Script, Infrastructure Script, Integration Script, Utility Script)
2. The main purpose of the script
3. Key dependencies or technologies used
4. Suggested tags for categorization

File path: ${filePath}

Script content:
\`\`\`
${content.substring(0, 3000)} ${content.length > 3000 ? '... (truncated)' : ''}
\`\`\`

Respond in JSON format:
{
  "classification": "exact document type from the list above",
  "purpose": "brief description of what the script does",
  "confidence": 0.0-1.0,
  "dependencies": ["list", "of", "key", "technologies"],
  "tags": ["relevant", "tags", "for", "categorization"]
}`;

    const response = await claudeService.getJsonResponse(prompt);
    
    // Map classification to document_type_id
    const typeMapping: Record<string, string> = {
      'Data Processing Script': 'data-processing-script',
      'Deployment Script': 'deployment-script',
      'Infrastructure Script': 'infrastructure-script',
      'Integration Script': 'integration-script',
      'Utility Script': 'utility-script'
    };

    return {
      document_type_id: typeMapping[response.classification] || 'utility-script',
      assessment: {
        classification: response.classification,
        confidence: response.confidence || 0.85,
        purpose: response.purpose,
        dependencies: response.dependencies,
        tags: response.tags
      }
    };
  } catch (error) {
    console.error(`Error classifying script ${filePath}:`, error);
    // Return default classification on error
    return {
      document_type_id: 'utility-script',
      assessment: {
        classification: 'Utility Script',
        confidence: 0.5,
        purpose: 'Unable to classify automatically'
      }
    };
  }
}

/**
 * Main sync function
 */
async function syncAllScripts() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔄 Starting comprehensive script synchronization...');
  
  // Find all script files
  const patterns = ['**/*.ts', '**/*.js', '**/*.sh', '**/*.py'];
  const scriptFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: path.join(process.cwd(), 'scripts'),
      ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.d.ts'],
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
    
    // Calculate file hash
    const fileHash = await calculateFileHash(fullPath);
    
    processedScripts.push({
      file_path: fullPath,
      cli_pipeline: cliPipeline,
      file_size: stats.size,
      last_modified: stats.mtime.toISOString(),
      language: languageMap[ext] || 'unknown',
      is_archived: isArchived,
      file_hash: fileHash
    });
  }
  
  // Get existing scripts from database
  const { data: existingScripts, error: fetchError } = await supabase
    .from('registry_scripts')
    .select('file_path, id, file_hash');
    
  if (fetchError) {
    console.error('❌ Error fetching existing scripts:', fetchError);
    return;
  }
  
  const existingMap = new Map(existingScripts?.map(s => [s.file_path, s]) || []);
  const currentPaths = new Set(processedScripts.map(s => s.file_path));
  
  // Identify scripts to delete (hard delete)
  const toDelete = existingScripts?.filter(s => !currentPaths.has(s.file_path)) || [];
  
  if (toDelete.length > 0) {
    console.log(`🗑️  Removing ${toDelete.length} deleted scripts from registry`);
    const { error: deleteError } = await supabase
      .from('registry_scripts')
      .delete()
      .in('id', toDelete.map(s => s.id));
      
    if (deleteError) {
      console.error('❌ Error deleting scripts:', deleteError);
    }
  }
  
  // Update or insert scripts
  let newCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  
  for (const script of processedScripts) {
    const existing = existingMap.get(script.file_path);
    const isNew = !existing;
    const hasChanged = existing && existing.file_hash !== script.file_hash;
    
    if (!isNew && !hasChanged) {
      skippedCount++;
      continue;
    }
    
    const scriptData = {
      file_path: script.file_path,
      title: path.basename(script.file_path, path.extname(script.file_path)),
      language: script.language,
      file_hash: script.file_hash,
      last_modified_at: script.last_modified,
      metadata: {
        cli_pipeline: script.cli_pipeline,
        file_size: script.file_size,
        last_modified: script.last_modified,
        is_archived: script.is_archived
      }
    };
    
    if (isNew || hasChanged) {
      console.log(`${isNew ? '➕ Adding' : '🔄 Updating'} script: ${script.file_path}`);
      
      // Get AI classification for non-archived scripts
      if (!script.is_archived) {
        try {
          const content = await fs.readFile(script.file_path, 'utf-8');
          const classification = await classifyScript(content, script.file_path);
          
          const fullScriptData = {
            ...scriptData,
            document_type_id: classification.document_type_id,
            ai_assessment: classification.assessment,
            ai_generated_tags: classification.assessment.tags,
            assessment_date: new Date().toISOString(),
            assessment_model: 'claude-3',
            assessment_quality_score: classification.assessment.confidence
          };
          
          if (isNew) {
            const { error: insertError } = await supabase
              .from('registry_scripts')
              .insert(fullScriptData);
              
            if (insertError) {
              console.error(`❌ Error inserting ${script.file_path}:`, insertError);
            } else {
              newCount++;
            }
          } else {
            const { error: updateError } = await supabase
              .from('registry_scripts')
              .update(fullScriptData)
              .eq('file_path', script.file_path);
              
            if (updateError) {
              console.error(`❌ Error updating ${script.file_path}:`, updateError);
            } else {
              updatedCount++;
            }
          }
        } catch (err) {
          console.error(`❌ Error processing ${script.file_path}:`, err);
        }
      } else {
        // For archived scripts, just update metadata without classification
        const operation = isNew ? 
          supabase.from('registry_scripts').insert(scriptData) :
          supabase.from('registry_scripts').update(scriptData).eq('file_path', script.file_path);
          
        const { error } = await operation;
        if (error) {
          console.error(`❌ Error ${isNew ? 'inserting' : 'updating'} archived script ${script.file_path}:`, error);
        } else {
          isNew ? newCount++ : updatedCount++;
        }
      }
    }
  }
  
  console.log('✅ Script synchronization complete!');
  console.log(`📊 Results: ${newCount} added, ${updatedCount} updated, ${skippedCount} unchanged, ${toDelete.length} deleted`);
  
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

// Run if called directly
if (require.main === module) {
  syncAllScripts().catch(console.error);
}

export { syncAllScripts };