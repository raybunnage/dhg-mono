#!/usr/bin/env ts-node
/**
 * Script: classify-script.ts
 * Purpose: Classify a single script file with AI-powered document type detection
 * Pipeline: scripts
 * Tags: classification, ai, document-types
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ClassificationResult {
  document_type_id: string;
  classification: string;
  confidence: number;
  purpose: string;
  dependencies?: string[];
  tags?: string[];
}

/**
 * Classify a script using Claude AI
 */
async function classifyScriptContent(content: string, filePath: string): Promise<ClassificationResult> {
  const prompt = `You are analyzing a script file for classification. Based on the content below, determine:
1. The document type (one of: Data Processing Script, Deployment Script, Infrastructure Script, Integration Script, Utility Script)
2. The main purpose of the script
3. Key dependencies or technologies used
4. Suggested tags for categorization

File path: ${filePath}
File name: ${path.basename(filePath)}

Script content:
\`\`\`
${content.substring(0, 5000)} ${content.length > 5000 ? '... (truncated)' : ''}
\`\`\`

Respond in JSON format:
{
  "classification": "exact document type from the list above",
  "purpose": "clear, concise description of what the script does (1-2 sentences)",
  "confidence": 0.0-1.0,
  "dependencies": ["list", "of", "key", "technologies", "or", "frameworks"],
  "tags": ["relevant", "functional", "tags", "for", "categorization"]
}`;

  try {
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
      classification: response.classification,
      confidence: response.confidence || 0.85,
      purpose: response.purpose,
      dependencies: response.dependencies,
      tags: response.tags
    };
  } catch (error) {
    console.error('Error getting AI classification:', error);
    throw error;
  }
}

/**
 * Main classification function
 */
async function classifyScript(scriptPath?: string) {
  // Get script path from command line argument
  const filePath = scriptPath || process.argv[2];
  
  if (!filePath) {
    console.error('❌ Error: Please provide a script file path');
    console.log('Usage: ./scripts-cli.sh classify <file-path>');
    process.exit(1);
  }
  
  try {
    // Check if file exists
    await fs.access(filePath);
    
    console.log(`🔍 Classifying script: ${filePath}`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);
    
    // Get AI classification
    console.log('🤖 Analyzing script with AI...');
    const classification = await classifyScriptContent(content, filePath);
    
    console.log('\n📋 Classification Results:');
    console.log(`Type: ${classification.classification} (${classification.document_type_id})`);
    console.log(`Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
    console.log(`Purpose: ${classification.purpose}`);
    
    if (classification.dependencies && classification.dependencies.length > 0) {
      console.log(`Dependencies: ${classification.dependencies.join(', ')}`);
    }
    
    if (classification.tags && classification.tags.length > 0) {
      console.log(`Tags: ${classification.tags.join(', ')}`);
    }
    
    // Update database if script exists in registry
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check if script exists in registry
    const { data: existingScript } = await supabase
      .from('registry_scripts')
      .select('id, file_path')
      .eq('file_path', filePath)
      .single();
    
    if (existingScript) {
      console.log('\n💾 Updating script registry...');
      
      const { error: updateError } = await supabase
        .from('registry_scripts')
        .update({
          document_type_id: classification.document_type_id,
          ai_assessment: {
            classification: classification.classification,
            confidence: classification.confidence,
            purpose: classification.purpose,
            dependencies: classification.dependencies,
            tags: classification.tags
          },
          ai_generated_tags: classification.tags,
          assessment_date: new Date().toISOString(),
          assessment_model: 'claude-3',
          assessment_quality_score: classification.confidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingScript.id);
      
      if (updateError) {
        console.error('❌ Error updating script registry:', updateError);
      } else {
        console.log('✅ Script registry updated successfully!');
      }
    } else {
      console.log('\n⚠️  Script not found in registry. Run sync first to add it.');
      console.log('   Use: ./scripts-cli.sh sync');
    }
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: File not found: ${filePath}`);
    } else {
      console.error('❌ Error classifying script:', error.message);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  classifyScript().catch(console.error);
}

export { classifyScript, classifyScriptContent };