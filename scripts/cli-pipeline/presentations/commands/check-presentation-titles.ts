import { Command } from 'commander';
import { Logger } from '../../../../packages/shared/utils/logger';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

export async function checkPresentationTitlesCommand(options: {
  outputPath?: string;
  limit?: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    const outputPath = options.outputPath || path.join(process.cwd(), 'docs', 'cli-pipeline', 'presentation-titles-check.md');
    const limit = options.limit || 100;
    
    Logger.info(`Checking presentation titles with processed content (limit: ${limit})...`);
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Execute the SQL query
    const { data, error } = await supabase.from('presentations').select(`
      id, 
      title,
      expert_document_id,
      high_level_folder_source_id,
      expert_documents!inner(
        id,
        title,
        processed_content
      ),
      sources_google!inner(
        id, 
        name
      ),
      sources_google:high_level_folder_source_id(
        id,
        name
      )
    `)
    .not('expert_documents.processed_content', 'is', null)
    .limit(limit);
    
    if (error) {
      Logger.error('Error fetching presentation data:', error);
      return { success: false, message: `Error fetching presentation data: ${error.message}` };
    }
    
    if (!data || data.length === 0) {
      return { success: true, message: 'No presentations with processed content found.' };
    }
    
    Logger.info(`Found ${data.length} presentations with processed content.`);
    
    // Create markdown content
    let markdown = `# Presentation Titles Check\n\n`;
    markdown += `This report compares presentation titles with their AI-generated processed content to help identify inconsistencies.\n\n`;
    markdown += `| Folder | Presentation | Expert Title | Processed Content Preview |\n`;
    markdown += `|--------|--------------|-------------|---------------------------|\n`;
    
    for (const presentation of data) {
      const folder = presentation.sources_google?.name || 'Unknown';
      const presentationTitle = presentation.title || 'Untitled';
      const expertDocument = presentation.expert_documents;
      const expertTitle = expertDocument?.title || 'No title';
      
      // Get a preview of the processed content (first 100 characters)
      let contentPreview = '';
      if (expertDocument?.processed_content) {
        contentPreview = expertDocument.processed_content
          .substring(0, 150)
          .replace(/\n/g, ' ')
          .trim() + '...';
      }
      
      markdown += `| ${folder} | ${presentationTitle} | ${expertTitle} | ${contentPreview} |\n`;
    }
    
    // Add instructions for updating titles
    markdown += `\n## How to Update Presentation Titles\n\n`;
    markdown += `If you identify titles that need updating, you can use the following SQL to update them:\n\n`;
    markdown += "```sql\n";
    markdown += "UPDATE presentations\n";
    markdown += "SET title = 'New Title'\n";
    markdown += "WHERE id = 'presentation-id';\n";
    markdown += "```\n\n";
    
    // Write the markdown file
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, markdown);
    Logger.info(`Report written to: ${outputPath}`);
    
    return { 
      success: true, 
      message: `Successfully checked ${data.length} presentation titles and wrote report to ${outputPath}` 
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    Logger.error('Error checking presentation titles:', error);
    return { success: false, message: `Error checking presentation titles: ${errorMessage}` };
  }
}