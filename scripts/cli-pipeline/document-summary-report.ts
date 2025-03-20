import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config as loadDotEnv } from 'dotenv';

// Initialize environment variables
loadDotEnv();

export interface DocumentSummary {
  id: string;
  file_path: string;
  summary?: string;
  title?: string;
  document_type_id?: string;
  is_deleted: boolean;
  document_type_name?: string;
  metadata?: {
    [key: string]: any;
  };
  ai_assessment?: {
    ai_assessment?: {
      status_recommendation?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  status_recommendation?: string; // Extracted field for convenience
}

export class DocumentSummaryReportService {
  private _supabase: SupabaseClient;
  private rootDir: string;
  
  constructor() {
    // Setup Supabase connection
    let supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    
    // Make sure the URL has proper protocol
    if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
      supabaseUrl = 'https://' + supabaseUrl;
      console.log(`Adding https:// prefix to Supabase URL: ${supabaseUrl}`);
    }
    
    console.log(`Connecting to Supabase at: ${supabaseUrl}`);
    this._supabase = createClient(supabaseUrl, supabaseKey);
    
    // Set root directory
    this.rootDir = process.cwd();
  }
  
  // Public getter for the supabase client
  public get supabase(): SupabaseClient {
    return this._supabase;
  }
  
  /**
   * Generate a report of document files with their summaries and status recommendations
   * @param limit Optional limit on number of files to include (default: 50)
   * @param includeDeleted Whether to include deleted files (default: false)
   * @param outputPath Path to write the report, if not provided report is just returned
   */
  async generateSummaryReport(limit: number = 50, includeDeleted: boolean = false, outputPath?: string): Promise<string> {
    try {
      console.log(`\n=== GENERATING DOCUMENT SUMMARY REPORT ===`);
      console.log(`Limit: ${limit}, Include Deleted: ${includeDeleted}`);
      
      // First, get all document types for lookup
      const { data: documentTypes, error: typeError } = await this._supabase
        .from('document_types')
        .select('id, document_type');
        
      if (typeError) {
        console.warn(`Warning: Could not fetch document types: ${typeError.message}`);
      }
      
      // Create lookup map for document types
      const typeMap = new Map<string, string>();
      if (documentTypes) {
        documentTypes.forEach(type => {
          typeMap.set(type.id, type.document_type);
        });
      }
      
      // Query to get document files (without join)
      // Only select fields we're confident exist in the table
      let query = this._supabase
        .from('documentation_files')
        .select(`
          id, 
          file_path, 
          summary,
          title,
          document_type_id,
          is_deleted,
          metadata,
          ai_assessment
        `)
        .order('file_path');
      
      // Add filter for deleted files if needed
      if (!includeDeleted) {
        query = query.eq('is_deleted', false);
      }
      
      // Apply limit only if not requesting "all" documents
      if (limit !== -1) {
        query = query.limit(limit);
      }
      
      // Execute query
      const { data: documents, error } = await query;
      
      if (error) {
        throw new Error(`Error fetching documents: ${error.message}`);
      }
      
      if (!documents || documents.length === 0) {
        console.log('No documents found.');
        return 'No documents found.';
      }
      
      // Enhance documents with document_type_name and extract status_recommendation
      const enhancedDocuments = documents.map(doc => {
        // Extract status_recommendation from the nested ai_assessment structure
        let statusRecommendation = null;
        
        if (doc.ai_assessment?.ai_assessment?.status_recommendation) {
          statusRecommendation = doc.ai_assessment.ai_assessment.status_recommendation;
        }
        
        return {
          ...doc,
          document_type_name: doc.document_type_id ? typeMap.get(doc.document_type_id) || 'Unknown' : 'Not set',
          status_recommendation: statusRecommendation
        };
      });
      
      console.log(`Found ${enhancedDocuments.length} documents.`);
      
      // Format the report
      const reportLines: string[] = [];
      reportLines.push('# Document Summary Report');
      reportLines.push(`Generated on: ${new Date().toISOString()}`);
      reportLines.push(`Total documents: ${documents.length}`);
      reportLines.push('');
      
      reportLines.push('## Summary Statistics');
      
      // Count documents with/without summaries
      const withSummary = enhancedDocuments.filter(doc => doc.summary && doc.summary.trim() !== '').length;
      const withoutSummary = enhancedDocuments.length - withSummary;
      reportLines.push(`- Documents with summary: ${withSummary}`);
      reportLines.push(`- Documents without summary: ${withoutSummary}`);
      reportLines.push('');
      
      // Count documents by status recommendation
      const recommendationCounts: Record<string, number> = {};
      enhancedDocuments.forEach(doc => {
        const recommendation = doc.status_recommendation || 'No recommendation';
        recommendationCounts[recommendation] = (recommendationCounts[recommendation] || 0) + 1;
      });
      
      reportLines.push('## Status Recommendations');
      Object.entries(recommendationCounts).forEach(([recommendation, count]) => {
        reportLines.push(`- **${recommendation}**: ${count}`);
      });
      reportLines.push('');
      
      // Detailed document list - more compact format
      reportLines.push('## Document Details');
      reportLines.push('');
      
      enhancedDocuments.forEach((doc, index) => {
        const docNumber = index + 1;
        const statusRec = doc.status_recommendation ? 
          `[${doc.status_recommendation}]` : '';
        
        reportLines.push(`### ${docNumber}. ${doc.file_path} ${statusRec}`);
        reportLines.push(`**Type**: ${doc.document_type_name} | **Deleted**: ${doc.is_deleted ? 'Yes' : 'No'}`);
        if (doc.summary) {
          reportLines.push(`**Summary**: ${doc.summary.substring(0, 150) + (doc.summary.length > 150 ? '...' : '')}`);
        }
        reportLines.push('');
      });
      
      // Specific section for documents without summaries
      if (withoutSummary > 0) {
        reportLines.push('## Documents Without Summaries');
        reportLines.push('');
        
        enhancedDocuments
          .filter(doc => !doc.summary || doc.summary.trim() === '')
          .forEach((doc, index) => {
            reportLines.push(`${index + 1}. ${doc.file_path}`);
          });
        reportLines.push('');
      }
      
      // Section for documents with status recommendations
      const docsWithRecommendations = enhancedDocuments.filter(doc => doc.status_recommendation);
      if (docsWithRecommendations.length > 0) {
        reportLines.push('## Documents With Status Recommendations');
        reportLines.push('');
        
        docsWithRecommendations.forEach((doc, index) => {
          reportLines.push(`${index + 1}. ${doc.file_path} [${doc.status_recommendation}]`);
        });
        reportLines.push('');
      }
      
      const reportContent = reportLines.join('\n');
      
      // Write to file if path is provided
      if (outputPath) {
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, reportContent);
        console.log(`Report written to: ${outputPath}`);
      }
      
      return reportContent;
    } catch (error) {
      console.error('Error generating summary report:', error instanceof Error ? error.message : 'Unknown error');
      return `Error generating report: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

/**
 * Main function to run the document summary report
 */
async function main() {
  const reportService = new DocumentSummaryReportService();
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    console.log(`
Usage: npx ts-node document-summary-report.ts <command> [options]

Commands:
  report [limit] [includeDeleted] [outputPath]   Generate a summary report
    limit: Number of documents to include (default: 50, use 'all' for all documents)
    includeDeleted: Whether to include deleted files (true/false, default: false)
    outputPath: Path to save the report (optional)
    
  help                                         Show this help message
    `);
    return;
  }
  
  switch (command) {
    case 'report':
      // Parse optional arguments
      let limit = 50;
      if (args[1]) {
        if (args[1].toLowerCase() === 'all') {
          limit = -1; // Special value for all documents
        } else {
          limit = parseInt(args[1]);
        }
      }
      
      const includeDeleted = args[2] ? args[2].toLowerCase() === 'true' : false;
      const outputPath = args[3] || '';
      
      console.log(`Generating report with limit: ${limit === -1 ? 'ALL' : limit}, includeDeleted: ${includeDeleted}${outputPath ? `, outputPath: ${outputPath}` : ''}`);
      
      // Generate the report
      const report = await reportService.generateSummaryReport(limit, includeDeleted, outputPath);
      
      // If no output path was specified, print the report to console
      if (!outputPath) {
        console.log('\n=== DOCUMENT SUMMARY REPORT ===\n');
        console.log(report);
      }
      break;
      
    case 'help':
    default:
      console.log(`
Usage: npx ts-node document-summary-report.ts <command> [options]

Commands:
  report [limit] [includeDeleted] [outputPath]   Generate a summary report
    limit: Number of documents to include (default: 50, use 'all' for all documents)
    includeDeleted: Whether to include deleted files (true/false, default: false)
    outputPath: Path to save the report (optional)
    
  help                                         Show this help message
      `);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export already included in the class definition