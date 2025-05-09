#!/usr/bin/env ts-node

/**
 * Document Types Cheatsheet Generator
 * 
 * Creates a markdown cheatsheet of document types organized by category.
 */
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

interface DocumentType {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_general_type: boolean | null;
  mnemonic?: string | null;
}

// Command function implementation
async function generateCheatsheet(): Promise<void> {
  const trackingId = await commandTrackingService.startTracking('document_types', 'cheatsheet');

  try {
    console.log('Generating document types cheatsheet...');
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Query document types where is_general_type = false
    const { data: documentTypes, error } = await supabase
      .from('document_types')
      .select('*')
      .eq('is_general_type', false)
      .order('category')
      .order('name');
    
    if (error) {
      throw new Error(`Failed to fetch document types: ${error.message}`);
    }
    
    if (!documentTypes || documentTypes.length === 0) {
      console.log('No document types found with is_general_type = false');
      process.exit(0);
    }
    
    console.log(`Retrieved ${documentTypes.length} document types`);

    // Create a map of categories to types for easier organization
    const categorizedTypes = new Map<string, DocumentType[]>();
    
    // Group document types by category
    documentTypes.forEach(docType => {
      const category = docType.category || 'Uncategorized';
      if (!categorizedTypes.has(category)) {
        categorizedTypes.set(category, []);
      }
      categorizedTypes.get(category)?.push(docType);
    });
    
    // Create markdown content
    let markdown = `# Document Types Cheatsheet\n\n`;
    markdown += `> Generated on ${new Date().toISOString().split('T')[0]}\n\n`;
    
    // Create a compact 3-column layout
    markdown += `| Category | Name | Mnemonic |\n`;
    markdown += `|----------|------|----------|\n`;
    
    // Sort all document types by category, then name
    const allTypes: {category: string, name: string, mnemonic: string}[] = [];
    
    for (const [category, types] of categorizedTypes.entries()) {
      types.forEach(type => {
        allTypes.push({
          category: category,
          name: type.name || '',
          mnemonic: type.mnemonic || ''
        });
      });
    }
    
    // Sort by category
    allTypes.sort((a, b) => a.category.localeCompare(b.category));
    
    // Add all types to the table
    let currentCategory = '';
    
    allTypes.forEach(type => {
      // Only display category name on first row of each category
      const categoryDisplay = type.category !== currentCategory ? type.category : '';
      if (type.category !== currentCategory) {
        currentCategory = type.category;
      }
      
      // Truncate long names to keep table compact
      const nameTruncated = type.name.length > 25 ? type.name.substring(0, 22) + '...' : type.name;
      
      markdown += `| ${categoryDisplay} | ${nameTruncated} | ${type.mnemonic} |\n`;
    });
    
    // Save markdown to file
    const outputPath = path.join(process.cwd(), 'docs', 'cli-pipeline', 'document-types-cheatsheet.md');
    
    // Create directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, markdown);
    
    console.log(`Cheatsheet generated successfully at: ${outputPath}`);
    
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: documentTypes.length,
      summary: `Generated document types cheatsheet with ${documentTypes.length} entries`
    });
    
  } catch (error) {
    console.error('Error generating cheatsheet:', error instanceof Error ? error.message : String(error));
    await commandTrackingService.failTracking(trackingId, `Failed to generate cheatsheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Define command
const command = new Command('cheatsheet')
  .description('Generate a markdown cheatsheet of document types')
  .action(generateCheatsheet);

export default command;