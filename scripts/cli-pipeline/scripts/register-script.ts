#!/usr/bin/env ts-node
/**
 * Script: register-script.ts
 * Purpose: Manually register a new script with metadata and classification
 * Pipeline: scripts
 * Tags: register, manual, add
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { classifyScriptContent } from './classify-script';

interface RegisterOptions {
  tags?: string[];
  type?: string;
  purpose?: string;
  skipClassification?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { filePath?: string; options: RegisterOptions } {
  const args = process.argv.slice(2);
  const options: RegisterOptions = {};
  let filePath: string | undefined;
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tags':
      case '-t':
        options.tags = args[++i].split(',').map(t => t.trim());
        break;
      case '--type':
        options.type = args[++i];
        break;
      case '--purpose':
      case '-p':
        options.purpose = args[++i];
        break;
      case '--skip-classification':
      case '-s':
        options.skipClassification = true;
        break;
      case '--help':
      case '-h':
        console.log(`Register Script - Manually register a script in the registry

Usage: ./scripts-cli.sh register <file-path> [options]

Options:
  -t, --tags <tags>         Comma-separated list of tags
  --type <type>             Document type (e.g., deployment-script)
  -p, --purpose <text>      Brief description of the script's purpose
  -s, --skip-classification Skip AI classification
  -h, --help                Show this help message

Examples:
  ./scripts-cli.sh register ./new-script.ts --tags "backup,database"
  ./scripts-cli.sh register ./deploy.sh --type deployment-script --purpose "Deploy to production"`);
        process.exit(0);
      default:
        if (!args[i].startsWith('-')) {
          filePath = args[i];
        }
    }
  }
  
  return { filePath, options };
}

/**
 * Calculate SHA-256 hash of file content
 */
async function calculateFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Main register function
 */
async function registerScript() {
  const { filePath, options } = parseArgs();
  
  if (!filePath) {
    console.error('❌ Error: Please provide a script file path');
    console.log('Usage: ./scripts-cli.sh register <file-path> [options]');
    process.exit(1);
  }
  
  try {
    // Check if file exists
    await fs.access(filePath);
    
    console.log(`📝 Registering script: ${filePath}`);
    
    // Get file info
    const stats = await fs.stat(filePath);
    const fileHash = await calculateFileHash(filePath);
    
    // Determine CLI pipeline from path
    let cliPipeline: string | null = null;
    const relativePath = path.relative(process.cwd(), filePath);
    const pipelineMatch = relativePath.match(/scripts\/cli-pipeline\/([^\/]+)\//);
    if (pipelineMatch) {
      cliPipeline = pipelineMatch[1];
    }
    
    // Determine if archived
    const isArchived = relativePath.includes('.archived_scripts') || relativePath.includes('.archive');
    
    // Get file extension for language
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.sh': 'bash',
      '.py': 'python'
    };
    
    const language = languageMap[ext] || 'unknown';
    
    // Check if already registered
    const supabase = SupabaseClientService.getInstance().getClient();
    
    const { data: existing } = await supabase
      .from('registry_scripts')
      .select('id')
      .eq('file_path', relativePath)
      .single();
    
    if (existing) {
      console.log('⚠️  Script already registered. Use sync to update it.');
      process.exit(0);
    }
    
    // Prepare script data
    const scriptData: any = {
      file_path: relativePath,
      title: path.basename(filePath, path.extname(filePath)),
      language,
      file_hash: fileHash,
      last_modified_at: stats.mtime.toISOString(),
      metadata: {
        cli_pipeline: cliPipeline,
        file_size: stats.size,
        last_modified: stats.mtime.toISOString(),
        is_archived: isArchived,
        manually_registered: true,
        registered_at: new Date().toISOString()
      }
    };
    
    // Add manual tags if provided
    if (options.tags && options.tags.length > 0) {
      scriptData.manual_tags = options.tags;
    }
    
    // Get AI classification unless skipped
    if (!options.skipClassification && !isArchived) {
      console.log('🤖 Getting AI classification...');
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const classification = await classifyScriptContent(content, filePath);
        
        scriptData.document_type_id = options.type || classification.document_type_id;
        scriptData.ai_assessment = {
          ...classification,
          purpose: options.purpose || classification.purpose
        };
        scriptData.ai_generated_tags = classification.tags;
        scriptData.assessment_date = new Date().toISOString();
        scriptData.assessment_model = 'claude-3';
        scriptData.assessment_quality_score = Math.round(classification.confidence * 100);
        
        console.log(`✅ Classified as: ${classification.classification}`);
      } catch (error) {
        console.warn('⚠️  AI classification failed, continuing with manual data');
      }
    }
    
    // Set manual overrides
    if (options.type) {
      scriptData.document_type_id = options.type;
    }
    
    if (options.purpose) {
      scriptData.ai_assessment = scriptData.ai_assessment || {};
      scriptData.ai_assessment.purpose = options.purpose;
    }
    
    // Insert into database
    console.log('💾 Adding to script registry...');
    
    const { error: insertError } = await supabase
      .from('registry_scripts')
      .insert(scriptData);
    
    if (insertError) {
      console.error('❌ Error registering script:', insertError);
      process.exit(1);
    }
    
    console.log('✅ Script registered successfully!');
    console.log('\n📋 Registration Summary:');
    console.log(`   Path: ${relativePath}`);
    console.log(`   Title: ${scriptData.title}`);
    console.log(`   Language: ${language}`);
    console.log(`   Pipeline: ${cliPipeline || 'root'}`);
    
    if (scriptData.document_type_id) {
      console.log(`   Type: ${scriptData.document_type_id}`);
    }
    
    if (scriptData.ai_assessment?.purpose) {
      console.log(`   Purpose: ${scriptData.ai_assessment.purpose}`);
    }
    
    const allTags = [...(scriptData.manual_tags || []), ...(scriptData.ai_generated_tags || [])];
    if (allTags.length > 0) {
      console.log(`   Tags: ${allTags.join(', ')}`);
    }
    
    console.log('\n💡 Tip: Run sync to update this script when it changes.');
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: File not found: ${filePath}`);
    } else {
      console.error('❌ Error registering script:', error.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  registerScript().catch(console.error);
}

export { registerScript };