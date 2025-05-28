/**
 * Show Recent Expert Documents Command
 * 
 * Displays expert documents that were updated today, showing their raw_content,
 * the MP4 file they were created from, their update date, and status.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';

// Simple table implementation
class SimpleTable {
  private headers: string[];
  private rows: any[][];
  private colWidths: number[];

  constructor(options: { head: string[], colWidths?: number[] }) {
    this.headers = options.head;
    this.rows = [];
    this.colWidths = options.colWidths || this.headers.map(() => 20);
  }

  push(row: any[]) {
    this.rows.push(row);
  }

  toString(): string {
    // Create header row
    let result = '\n';
    
    // Add header
    const headerRow = this.headers.map((header, i) => {
      const width = this.colWidths[i];
      return header.padEnd(width).substring(0, width);
    }).join(' | ');
    
    result += headerRow + '\n';
    result += this.headers.map((_, i) => '-'.repeat(this.colWidths[i])).join('-+-') + '\n';
    
    // Add data rows
    for (const row of this.rows) {
      const formattedRow = row.map((cell, i) => {
        const width = this.colWidths[i];
        const cellStr = String(cell || '');
        return cellStr.padEnd(width).substring(0, width);
      }).join(' | ');
      
      result += formattedRow + '\n';
    }
    
    return result;
  }
}

interface CommandOptions {
  days?: number;
  limit?: number;
  status?: string;
  documentType?: string;
  format?: 'table' | 'json';
  showContent?: boolean;
}

/**
 * Show recent expert documents updated within the specified time period
 */
export default async function showRecentExpertDocs(options: CommandOptions): Promise<void> {
  const {
    days = 1,
    limit = 10,
    status,
    documentType,
    format = 'table',
    showContent = false
  } = options;

  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    Logger.info(`Fetching expert documents updated in the last ${days} day(s)...`);
    
    // Build query
    let query = supabase
      .from('google_expert_documents')
      .select(`
        id,
        status,
        raw_content,
        created_at,
        updated_at,
        document_type_id,
        document_types:document_type_id(document_type),
        sources_google:source_id(id, name, mime_type, path, parent_path)
      `)
      .gte('updated_at', startDate.toISOString())
      .lte('updated_at', endDate.toISOString())
      .order('updated_at', { ascending: false });
    
    // Apply filters if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    if (documentType) {
      // First get the document type ID
      const { data: docTypeInfo, error: docTypeError } = await supabase
        .from('document_types')
        .select('id')
        .eq('document_type', documentType)
        .single();
      
      if (docTypeError) {
        Logger.error(`Invalid document type: ${documentType}`);
        return;
      }
      
      query = query.eq('document_type_id', docTypeInfo.id);
    }
    
    // Apply limit
    query = query.limit(limit);
    
    // Execute query
    const { data: documents, error } = await query;
    
    if (error) {
      Logger.error(`Error fetching expert documents: ${error.message}`);
      return;
    }
    
    if (!documents || documents.length === 0) {
      Logger.info(`No expert documents found updated in the last ${days} day(s)`);
      return;
    }
    
    // Display the results
    if (format === 'json') {
      console.log(JSON.stringify(documents, null, 2));
      return;
    }
    
    const table = new SimpleTable({
      head: [
        'ID',
        'Document Type',
        'Status',
        'Updated At',
        'Source Name',
        showContent ? 'Raw Content' : 'Content Length'
      ],
      colWidths: showContent 
        ? [10, 15, 12, 25, 25, 50]
        : [10, 20, 15, 25, 40, 15]
    });
    
    documents.forEach((doc: any) => {
      const rawContent = doc.raw_content || '';
      const contentLength = rawContent.length;
      
      table.push([
        doc.id.substring(0, 8),
        doc.document_types?.document_type || 'Unknown',
        doc.status || 'None',
        new Date(doc.updated_at).toLocaleString(),
        doc.sources_google?.name || 'Unknown',
        showContent 
          ? (rawContent.length > 45 ? rawContent.substring(0, 45) + '...' : rawContent || 'None')
          : contentLength.toString()
      ]);
    });
    
    console.log(table.toString());
    Logger.info(`Found ${documents.length} expert document(s) updated in the last ${days} day(s)`);
    
    // If showing content is enabled, show full content of each document
    if (showContent) {
      documents.forEach((doc: any, index: number) => {
        const sourceName = doc.sources_google?.name || 'Unknown';
        const docType = doc.document_types?.document_type || 'Unknown';
        
        console.log(`\n${'Document'} #${index + 1}`);
        console.log(`${'ID:'} ${doc.id}`);
        console.log(`${'Type:'} ${docType}`);
        console.log(`${'Source:'} ${sourceName}`);
        console.log(`${'Status:'} ${doc.status || 'None'}`);
        console.log(`${'Updated:'} ${new Date(doc.updated_at).toLocaleString()}`);
        console.log(`\n${'Content:'}\n`);
        console.log(doc.raw_content || 'No content');
        console.log('-'.repeat(80));
      });
    }
    
  } catch (error: any) {
    Logger.error(`Unexpected error: ${error.message}`);
  }
}