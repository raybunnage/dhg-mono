#!/usr/bin/env ts-node
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';
import * as path from 'path';
import { Database } from '../../../supabase/types';

const supabase = SupabaseClientService.getInstance().getClient();

interface StatusCount {
  pipeline_status: string | null;
  count: number;
}

interface TypeStatusCount {
  pipeline_status: string | null;
  document_type_id: string | null;
  count: number;
}

interface ExpertDocument {
  id: string;
  source_id: string;
  document_type_id: string | null;
  pipeline_status: string | null;
  created_at: string | null;
  updated_at: string | null;
  sources_google?: {
    name: string | null;
    mime_type: string | null;
  };
}

interface MimeTypeStatusCount {
  mime_type: string | null;
  pipeline_status: string | null;
  count: number;
  percentage?: number;
}

/**
 * Generates a summary rollup of pipeline_status values in expert_documents
 * Groups counts by status and provides breakdowns by document type
 */
async function pipelineStatusSummary(options: { 
  output?: string, 
  console?: boolean,
  markdown?: boolean,
  all?: boolean,
  mimeTypeRollup?: boolean,
  verbose?: boolean
}) {
  // Generate tracking ID
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('google_sync', 'pipeline-status-summary');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    console.log(`Generating pipeline status summary...`);
    
    // Default options
    const outputFilePath = options.output || path.join(process.cwd(), 'docs', 'cli-pipeline', 'pipeline-status-summary.md');
    
    // Get document types for reference
    const { data: documentTypes, error: docTypesError } = await supabase
      .from('document_types')
      .select('id, name');
      
    if (docTypesError) {
      console.error(`Error fetching document types: ${docTypesError.message}`);
      return;
    }
    
    // Create a map for quick lookups
    const documentTypeMap = new Map<string, string>();
    if (documentTypes) {
      for (const dt of documentTypes) {
        documentTypeMap.set(dt.id, dt.name);
      }
    }
    
    // Try to get counts grouped by pipeline_status
    let statusCounts: StatusCount[] = [];
    try {
      const { data, error } = await supabase.rpc('count_by_pipeline_status');
      
      if (error) {
        throw error;
      }
      
      if (data) {
        statusCounts = data as StatusCount[];
      }
    } catch (error) {
      // If RPC function doesn't exist, fallback to manual query
      console.log(`Note: Using fallback query for pipeline status counts`);
      
      try {
        // Fallback query using raw SQL
        const { data, error } = await supabase.from('google_expert_documents')
          .select('pipeline_status, count')
          .eq('count_column', 'pipeline_status_count')
          .limit(100);
        
        if (error) {
          throw error;
        }
        
        if (data) {
          statusCounts = data as StatusCount[];
        }
      } catch (fallbackError) {
        console.error(`Error getting pipeline status counts, using manual count...`);
        
        // Last resort - get all documents and count manually
        const { data: allDocs, error: docsError } = await supabase
          .from('google_expert_documents')
          .select('pipeline_status');
        
        if (docsError) {
          console.error(`Error fetching documents: ${docsError.message}`);
          return;
        }
        
        if (allDocs) {
          // Count manually
          const statusMap: Record<string, number> = {};
          
          allDocs.forEach(doc => {
            const status = doc.pipeline_status || 'null';
            statusMap[status] = (statusMap[status] || 0) + 1;
          });
          
          // Convert to array format
          statusCounts = Object.entries(statusMap).map(([status, count]) => ({
            pipeline_status: status === 'null' ? null : status,
            count
          }));
          
          console.log(`Counted ${allDocs.length} documents manually.`);
        }
      }
    }
    
    if (!statusCounts || statusCounts.length === 0) {
      console.log('No pipeline status data found.');
      return;
    }
    
    // Get counts by document type - again with fallback
    let typeStatusCounts: TypeStatusCount[] = [];
    try {
      const { data, error } = await supabase.from('google_expert_documents')
        .select('pipeline_status, document_type_id, count')
        .eq('count_column', 'document_type_status_count')
        .limit(500);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        typeStatusCounts = data as TypeStatusCount[];
      }
    } catch (error) {
      console.log(`Note: Using fallback for document type counts`);
      
      // Fallback to get all documents and count manually
      const { data: allDocs, error: docsError } = await supabase
        .from('google_expert_documents')
        .select('pipeline_status, document_type_id');
      
      if (docsError) {
        console.error(`Error fetching document type counts: ${docsError.message}`);
      } else if (allDocs) {
        // Count manually by type and status
        const typeStatusMap: Record<string, Record<string, number>> = {};
        
        allDocs.forEach(doc => {
          const status = doc.pipeline_status || 'null';
          const docTypeId = doc.document_type_id || 'null';
          
          if (!typeStatusMap[docTypeId]) {
            typeStatusMap[docTypeId] = {};
          }
          
          typeStatusMap[docTypeId][status] = (typeStatusMap[docTypeId][status] || 0) + 1;
        });
        
        // Convert to array format
        Object.entries(typeStatusMap).forEach(([docTypeId, statusMap]) => {
          Object.entries(statusMap).forEach(([status, count]) => {
            typeStatusCounts.push({
              document_type_id: docTypeId === 'null' ? null : docTypeId,
              pipeline_status: status === 'null' ? null : status,
              count
            });
          });
        });
        
        console.log(`Counted document types manually.`);
      }
    }
    
    // Calculate total
    const totalDocuments = statusCounts.reduce((sum: number, item: StatusCount) => sum + (item.count || 0), 0);
    console.log(`Found ${totalDocuments} total expert documents.`);
    
    // Get the raw data if "all" option is specified
    let allDocuments: ExpertDocument[] = [];
    if (options.verbose) {
      console.log(`Options provided: ${JSON.stringify(options)}`);
    }
    if (options.all && totalDocuments > 0) {
      console.log("Fetching detailed document data for analysis...");
      if (options.verbose) {
        console.log("Will debug sources_google structure after fetch");
      }
      
      // For mime type rollup, use a different query that joins directly with sources_google
      if (options.mimeTypeRollup) {
        console.log("Using specialized query for mime-type rollup...");
        
        // Since the get_expert_documents_with_mime_types RPC function may not exist,
        // we'll use a direct SQL query to join expert_documents with sources_google
        const { data, error } = await supabase.from('google_expert_documents')
          .select(`
            id, 
            source_id,
            document_type_id,
            pipeline_status,
            created_at,
            updated_at,
            sources_google!inner (
              name,
              mime_type
            )
          `)
          .limit(10000);
        
        if (error) {
          console.error(`Error with RPC for mime types: ${error.message}`);
          console.log("Falling back to standard query...");
          
          // Fall back to standard query
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('google_expert_documents')
            .select(`
              id, 
              source_id,
              document_type_id,
              pipeline_status,
              created_at,
              updated_at,
              sources_google:source_id (
                name,
                mime_type
              )
            `)
            .limit(10000);
            
          if (fallbackError) {
            console.error(`Error fetching detailed document data: ${fallbackError.message}`);
          } else if (fallbackData) {
            allDocuments = fallbackData.map(doc => ({
              id: doc.id,
              source_id: doc.source_id,
              document_type_id: doc.document_type_id,
              pipeline_status: doc.pipeline_status,
              created_at: doc.created_at,
              updated_at: doc.updated_at,
              sources_google: doc.sources_google && Array.isArray(doc.sources_google) && doc.sources_google[0] ? {
                name: doc.sources_google[0].name || null,
                mime_type: doc.sources_google[0].mime_type || null
              } : undefined
            }));
            
            if (options.verbose) {
              console.log(`Retrieved ${allDocuments.length} documents using fallback query`);
            }
          }
        } else if (data) {
          // Process data from SQL query
          allDocuments = data.map((doc: any) => ({
            id: doc.id,
            source_id: doc.source_id,
            document_type_id: doc.document_type_id,
            pipeline_status: doc.pipeline_status,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            sources_google: doc.sources_google ? {
              name: doc.sources_google.name,
              mime_type: doc.sources_google.mime_type
            } : undefined
          }));
          
          if (options.verbose) {
            console.log(`Retrieved ${allDocuments.length} documents using RPC function`);
          }
        }
      } else {
        // Standard query when mime-type rollup is not needed
        const { data, error } = await supabase
          .from('google_expert_documents')
          .select(`
            id, 
            source_id,
            document_type_id,
            pipeline_status,
            created_at,
            updated_at,
            sources_google:source_id (
              name,
              mime_type
            )
          `)
          .limit(10000);
      
        if (error) {
          console.error(`Error fetching detailed document data: ${error.message}`);
        } else if (data) {
          // Need to cast and process each record to fix type issues
          allDocuments = data.map(doc => ({
            id: doc.id,
            source_id: doc.source_id,
            document_type_id: doc.document_type_id,
            pipeline_status: doc.pipeline_status,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            sources_google: doc.sources_google && Array.isArray(doc.sources_google) && doc.sources_google[0] ? {
              name: doc.sources_google[0].name || null,
              mime_type: doc.sources_google[0].mime_type || null
            } : undefined
          }));
          console.log(`Retrieved data for ${allDocuments.length} documents for detailed analysis.`);
        }
      }
    }
    
    // Prepare data for reporting
    const statusData: Record<string, number> = {};
    statusCounts.forEach((item: StatusCount) => {
      const status = item.pipeline_status || 'null';
      statusData[status] = item.count || 0;
    });
    
    // Organize document type breakdown
    const docTypeBreakdown: Record<string, Record<string, number>> = {};
    
    if (typeStatusCounts.length > 0) {
      typeStatusCounts.forEach((item: TypeStatusCount) => {
        const status = item.pipeline_status || 'null';
        const docType = item.document_type_id 
          ? (documentTypeMap.get(item.document_type_id) || 'Unknown Type')
          : 'No Document Type';
        
        if (!docTypeBreakdown[docType]) {
          docTypeBreakdown[docType] = {};
        }
        
        docTypeBreakdown[docType][status] = item.count || 0;
      });
    }
    
    // Generate the markdown report
    let report = `# Pipeline Status Summary Report\n\n`;
    report += `Report generated on: ${new Date().toISOString()}\n\n`;
    report += `Total expert documents: ${totalDocuments}\n\n`;
    
    // Overall status distribution
    report += `## Status Distribution\n\n`;
    report += `| Status | Count | Percentage |\n`;
    report += `|--------|-------|------------|\n`;
    
    const sortedStatuses = Object.entries(statusData).sort((a, b) => b[1] - a[1]);
    
    sortedStatuses.forEach(([status, count]) => {
      const percentage = (count / totalDocuments * 100).toFixed(2);
      report += `| ${status} | ${count} | ${percentage}% |\n`;
    });
    
    // Document type breakdown
    if (Object.keys(docTypeBreakdown).length > 0) {
      report += `\n## Status Distribution by Document Type\n\n`;
      
      // Get all statuses
      const allStatusesSet = new Set<string>();
      Object.values(docTypeBreakdown).forEach(statusMap => {
        Object.keys(statusMap).forEach(status => {
          allStatusesSet.add(status);
        });
      });
      const allStatuses = Array.from(allStatusesSet).sort();
      
      // Count total documents by document type
      const docTypeTotals: Record<string, number> = {};
      Object.entries(docTypeBreakdown).forEach(([docType, statusMap]) => {
        docTypeTotals[docType] = Object.values(statusMap).reduce((sum: number, count: number) => sum + count, 0);
      });
      
      // Sort document types by total count
      const sortedDocTypes = Object.entries(docTypeTotals)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      // Generate table header
      report += `| Document Type | Total | ${allStatuses.join(' | ')} |\n`;
      report += `|---------------|-------|${allStatuses.map(() => '---').join('|')}|\n`;
      
      // Generate rows
      sortedDocTypes.forEach(docType => {
        const statusMap = docTypeBreakdown[docType];
        const total = docTypeTotals[docType];
        
        let row = `| ${docType} | ${total} |`;
        
        allStatuses.forEach(status => {
          const count = statusMap[status] || 0;
          row += ` ${count} |`;
        });
        
        report += `${row}\n`;
      });
    }
    
    // Additional detailed insights if "all" option was specified
    if (allDocuments.length > 0) {
      report += `\n## Processing Timeline Insights\n\n`;
      
      // Get documents by creation time
      const documentsByMonth: Record<string, Record<string, number>> = {};
      allDocuments.forEach(doc => {
        if (!doc.created_at) return;
        
        const monthKey = doc.created_at.substring(0, 7); // YYYY-MM format
        
        if (!documentsByMonth[monthKey]) {
          documentsByMonth[monthKey] = { total: 0 };
        }
        
        documentsByMonth[monthKey].total++;
        
        const status = doc.pipeline_status || 'null';
        if (!documentsByMonth[monthKey][status]) {
          documentsByMonth[monthKey][status] = 0;
        }
        documentsByMonth[monthKey][status]++;
      });
      
      // Sort months chronologically
      const sortedMonths = Object.keys(documentsByMonth).sort();
      
      // Create header with most common statuses (top 5)
      const topStatuses = sortedStatuses.slice(0, 5).map(entry => entry[0]);
      
      report += `### Documents by Creation Month\n\n`;
      report += `| Month | Total | ${topStatuses.join(' | ')} |\n`;
      report += `|-------|-------|${topStatuses.map(() => '---').join('|')}|\n`;
      
      sortedMonths.forEach(month => {
        const monthData = documentsByMonth[month];
        
        let row = `| ${month} | ${monthData.total} |`;
        
        topStatuses.forEach(status => {
          const count = monthData[status] || 0;
          row += ` ${count} |`;
        });
        
        report += `${row}\n`;
      });
      
      // File type analysis
      const mimeTypeCounts: Record<string, number> = {};
      const mimeTypeStatus: Record<string, Record<string, number>> = {};
      
      allDocuments.forEach(doc => {
        const mimeType = doc.sources_google ? doc.sources_google.mime_type || 'Unknown' : 'Unknown';
        const status = doc.pipeline_status || 'null';
        
        if (!mimeTypeCounts[mimeType]) {
          mimeTypeCounts[mimeType] = 0;
          mimeTypeStatus[mimeType] = {};
        }
        
        mimeTypeCounts[mimeType]++;
        
        if (!mimeTypeStatus[mimeType][status]) {
          mimeTypeStatus[mimeType][status] = 0;
        }
        mimeTypeStatus[mimeType][status]++;
      });
      
      report += `\n### Pipeline Status by File Type\n\n`;
      
      // Sort mime types by count
      const sortedMimeTypes = Object.entries(mimeTypeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10) // Top 10 mime types
        .map(entry => entry[0]);
      
      report += `| File Type | Total | ${topStatuses.join(' | ')} |\n`;
      report += `|-----------|-------|${topStatuses.map(() => '---').join('|')}|\n`;
      
      sortedMimeTypes.forEach(mimeType => {
        const total = mimeTypeCounts[mimeType];
        const statusData = mimeTypeStatus[mimeType];
        
        let row = `| ${mimeType} | ${total} |`;
        
        topStatuses.forEach(status => {
          const count = statusData[status] || 0;
          row += ` ${count} |`;
        });
        
        report += `${row}\n`;
      });
    }
    
    // Output the results based on the format option
    if (options.console || options.markdown) {
      // Display results as markdown tables directly in the console
      console.log('\n# Pipeline Status Summary');
      console.log(`\n_Total expert documents: ${totalDocuments}_\n`);
      
      // Status distribution as markdown table
      console.log('## Status Distribution\n');
      console.log('| Status | Count | Percentage |');
      console.log('|--------|-------|------------|');
      
      sortedStatuses.forEach(([status, count]) => {
        const percentage = (count / totalDocuments * 100).toFixed(2);
        console.log(`| ${status} | ${count} | ${percentage}% |`);
      });
      
      // Document type breakdown as markdown table
      if (Object.keys(docTypeBreakdown).length > 0) {
        // Count total documents by document type
        const docTypeTotals: Record<string, number> = {};
        Object.entries(docTypeBreakdown).forEach(([docType, statusMap]) => {
          docTypeTotals[docType] = Object.values(statusMap).reduce((sum: number, count: number) => sum + count, 0);
        });
        
        // Sort document types by total count
        const sortedDocTypes = Object.entries(docTypeTotals)
          .sort((a, b) => b[1] - a[1]);
        
        // Show top 10 document types in a table
        const topDocTypes = sortedDocTypes.slice(0, 10);
        
        console.log('\n## Top Document Types\n');
        console.log('| Document Type | Count | Percentage | Top Status |');
        console.log('|---------------|-------|------------|------------|');
        
        topDocTypes.forEach(([docType, count]) => {
          const percentage = (count / totalDocuments * 100).toFixed(2);
          
          // Get top status for this document type
          const statusMap = docTypeBreakdown[docType];
          const topStatus = Object.entries(statusMap)
            .sort((a, b) => b[1] - a[1])[0];
          
          const statusInfo = topStatus ? 
            `${topStatus[0]}: ${topStatus[1]} (${(topStatus[1] / count * 100).toFixed(0)}%)` : 
            'None';
          
          console.log(`| ${docType} | ${count} | ${percentage}% | ${statusInfo} |`);
        });
        
        // Status breakdown for top document types
        console.log('\n## Status Breakdown by Top Document Types\n');
        
        // Get all status names for column headers
        const allStatusesSet = new Set<string>();
        Object.values(docTypeBreakdown).forEach(statusMap => {
          Object.keys(statusMap).forEach(status => {
            allStatusesSet.add(status);
          });
        });
        const allStatuses = Array.from(allStatusesSet).sort();
        
        // Create header row
        console.log(`| Document Type | Total | ${allStatuses.join(' | ')} |`);
        console.log(`|---------------|-------|${allStatuses.map(() => '---').join('|')}|`);
        
        // Create data rows (top 5 document types)
        topDocTypes.slice(0, 5).forEach(([docType, count]) => {
          const statusMap = docTypeBreakdown[docType];
          let row = `| ${docType} | ${count} |`;
          
          allStatuses.forEach(status => {
            const statusCount = statusMap[status] || 0;
            row += ` ${statusCount} |`;
          });
          
          console.log(row);
        });
      }
      
      // Timeline insights for --all option
      // Debug information about sources_google structure if verbose is enabled
      if (allDocuments.length > 0 && options.verbose) {
        console.log('Document sample structure analysis:');
        
        // Check first 5 documents to see if sources_google exists and has mime_type data
        const sampleSize = Math.min(5, allDocuments.length);
        let mimeTypeFound = false;
        
        for (let i = 0; i < sampleSize; i++) {
          const doc = allDocuments[i];
          console.log(`\nDocument ${i+1}:`);
          console.log(`ID: ${doc.id}`);
          console.log(`Source ID: ${doc.source_id}`);
          console.log(`Pipeline Status: ${doc.pipeline_status}`);
          
          if (doc.sources_google) {
            console.log(`Has sources_google: Yes`);
            console.log(`sources_google type: ${typeof doc.sources_google}`);
            
            if (typeof doc.sources_google === 'object') {
              console.log(`sources_google is array? ${Array.isArray(doc.sources_google)}`);
              
              if (Array.isArray(doc.sources_google)) {
                console.log(`sources_google array length: ${doc.sources_google.length}`);
                
                if (doc.sources_google.length > 0) {
                  const first = doc.sources_google[0];
                  console.log(`First item keys: ${Object.keys(first).join(', ')}`);
                  console.log(`Has mime_type: ${first.mime_type ? 'Yes: ' + first.mime_type : 'No'}`);
                  
                  if (first.mime_type) {
                    mimeTypeFound = true;
                  }
                }
              } else {
                console.log(`sources_google object keys: ${Object.keys(doc.sources_google).join(', ')}`);
                console.log(`Has mime_type: ${doc.sources_google.mime_type ? 'Yes: ' + doc.sources_google.mime_type : 'No'}`);
                
                if (doc.sources_google.mime_type) {
                  mimeTypeFound = true;
                }
              }
            }
          } else {
            console.log(`Has sources_google: No`);
          }
        }
        
        if (!mimeTypeFound) {
          console.log('\nWARNING: No mime_type data found in sample documents. Mime-type rollup may show all files as "Unknown".');
        }
      }
      
      if (allDocuments.length > 0 && options.all) {
        // Get unique months/creation times
        const months = new Set<string>();
        allDocuments.forEach(doc => {
          if (doc.created_at) {
            months.add(doc.created_at.substring(0, 7)); // YYYY-MM
          }
        });
        
        if (months.size > 0) {
          console.log('\n## Timeline Analysis\n');
          console.log('| Month | Document Count |');
          console.log('|-------|---------------|');
          
          // Count by month and sort chronologically
          const monthData: Record<string, number> = {};
          allDocuments.forEach(doc => {
            if (doc.created_at) {
              const month = doc.created_at.substring(0, 7);
              monthData[month] = (monthData[month] || 0) + 1;
            }
          });
          
          Object.entries(monthData)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([month, count]) => {
              console.log(`| ${month} | ${count} |`);
            });
        }
      }
      
      // Mime type rollup analysis 
      if (options.mimeTypeRollup && allDocuments.length > 0) {
        console.log('\n## Pipeline Status by File Type\n');
        
        // Create a mapping of mime type to status counts
        const mimeTypeToStatusMap: Record<string, Record<string, number>> = {};
        const mimeTypeTotals: Record<string, number> = {};
        
        // Collect status counts by mime type
        allDocuments.forEach(doc => {
          // Get mime type (default to 'Unknown')
          const mimeType = doc.sources_google && doc.sources_google.mime_type ? doc.sources_google.mime_type : 'Unknown';
          const status = doc.pipeline_status || 'null';
          
          // Initialize mime type records if needed
          if (!mimeTypeToStatusMap[mimeType]) {
            mimeTypeToStatusMap[mimeType] = {};
            mimeTypeTotals[mimeType] = 0;
          }
          
          // Increment counter for this status and mime type
          mimeTypeToStatusMap[mimeType][status] = (mimeTypeToStatusMap[mimeType][status] || 0) + 1;
          mimeTypeTotals[mimeType]++;
        });
        
        // Create array format for the report
        const mimeTypeStatusCounts: MimeTypeStatusCount[] = [];
        Object.entries(mimeTypeToStatusMap).forEach(([mimeType, statusMap]) => {
          Object.entries(statusMap).forEach(([status, count]) => {
            const percentage = (count / mimeTypeTotals[mimeType]) * 100;
            mimeTypeStatusCounts.push({
              mime_type: mimeType,
              pipeline_status: status,
              count,
              percentage
            });
          });
        });
        
        // Generate the mime type rollup table for console output
        console.log('| File Type | Total | Top Status |');
        console.log('|-----------|-------|------------|');
        
        // Sort mime types by total count and show top 10
        const topMimeTypes = Object.entries(mimeTypeTotals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(entry => entry[0]);
          
        // Show each mime type with its count and top status
        topMimeTypes.forEach(mimeType => {
          const total = mimeTypeTotals[mimeType];
          
          // Get top status for this mime type
          const topStatusEntry = Object.entries(mimeTypeToStatusMap[mimeType])
            .sort((a, b) => b[1] - a[1])[0];
            
          const statusInfo = topStatusEntry ? 
            `${topStatusEntry[0]}: ${topStatusEntry[1]} (${(topStatusEntry[1] / total * 100).toFixed(0)}%)` : 
            'None';
            
          console.log(`| ${mimeType} | ${total} | ${statusInfo} |`);
        });
        
        // Add the mime type rollup section to the report markdown file
        report += `\n## Pipeline Status by File Type\n\n`;
        
        // Get top statuses to use as column headers (max 5)
        const topStatuses = Object.entries(statusData)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(entry => entry[0]);
        
        // Generate table header
        report += `| File Type | Total | ${topStatuses.join(' | ')} |\n`;
        report += `|-----------|-------|${topStatuses.map(() => '---').join('|')}|\n`;
        
        // Generate rows for each mime type
        topMimeTypes.forEach(mimeType => {
          const total = mimeTypeTotals[mimeType];
          const statusMap = mimeTypeToStatusMap[mimeType];
          
          let row = `| ${mimeType} | ${total} |`;
          
          topStatuses.forEach(status => {
            const count = statusMap[status] || 0;
            const percentage = (count / total * 100).toFixed(1);
            row += ` ${count} (${percentage}%) |`;
          });
          
          report += `${row}\n`;
        });
        
        // Also add detailed tables for top mime types
        report += `\n## Detailed Status for Top File Types\n\n`;
        
        // Show detail tables for top 5 mime types
        const detailMimeTypes = topMimeTypes.slice(0, 5);
        
        detailMimeTypes.forEach(mimeType => {
          report += `\n### ${mimeType}\n\n`;
          report += `| Status | Count | Percentage |\n`;
          report += `|--------|-------|------------|\n`;
          
          // Get all statuses for this mime type and sort by count
          const statusEntries = Object.entries(mimeTypeToStatusMap[mimeType])
            .sort((a, b) => b[1] - a[1]);
            
          statusEntries.forEach(([status, count]) => {
            const total = mimeTypeTotals[mimeType];
            const percentage = (count / total * 100).toFixed(2);
            report += `| ${status} | ${count} | ${percentage}% |\n`;
          });
        });
      } else if (options.mimeTypeRollup) {
        console.log("Cannot generate mime type rollup: no document data available. Try with --all option.");
        report += `\n## Pipeline Status by File Type\n\nNo document data available. Use --all option with --mime-type-rollup to include document data.\n`;
      }
    } else {
      // Write the report to the output file
      fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
      fs.writeFileSync(outputFilePath, report);
      
      console.log(`Pipeline status summary generated successfully and saved to: ${outputFilePath}`);
    }
    
    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: totalDocuments,
        summary: `Generated pipeline status summary for ${totalDocuments} expert documents`
      });
    }
  } catch (error) {
    console.error(`Error generating pipeline status summary: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      await commandTrackingService.failTracking(trackingId, 
        `Error generating pipeline status summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Set up CLI command
const program = new Command();

program
  .name('pipeline-status-summary')
  .description('Generates a summary rollup of all pipeline_status enum values from expert_documents')
  .option('-o, --output <path>', 'Output file path for the report')
  .option('-c, --console', 'Display results in console format (plain text)')
  .option('-m, --markdown', 'Display results as markdown tables in the console') 
  .option('-a, --all', 'Include additional detailed insights (may be slower for large datasets)')
  .option('--mime-type-rollup', 'Show a detailed rollup of pipeline status by mime type')
  .option('-v, --verbose', 'Show detailed debug information')
  .action((options) => {
    pipelineStatusSummary({
      output: options.output,
      console: options.console,
      markdown: options.markdown,
      all: options.all,
      mimeTypeRollup: options.mimeTypeRollup,
      verbose: options.verbose
    });
  });

program.parse(process.argv);