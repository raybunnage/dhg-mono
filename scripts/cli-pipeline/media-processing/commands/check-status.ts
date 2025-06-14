/**
 * Check Status command for the Media Processing CLI Pipeline
 * Checks the processing status of summaries and presentations
 */

import { Logger } from '../../../../packages/shared/utils';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';
import { BatchProcessingService } from '../../../../packages/shared/services/batch-processing-service';
import { createTable } from '../../../../packages/shared/utils/table';

// Define interfaces
interface CheckStatusOptions {
  summary?: string;
  presentation?: string;
  allSummaries?: boolean;
  allPresentations?: boolean;
  format?: 'json' | 'table';
}

interface StatusResult {
  success: boolean;
  error?: string;
  data: {
    type: 'summary' | 'presentation' | 'batch';
    id?: string;
    status: string;
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    metadata?: Record<string, any>;
  }[];
}

/**
 * Check status of a specific summary
 */
async function checkSummaryStatus(
  summaryId: string,
  format: string
): Promise<StatusResult> {
  Logger.info(`🔍 Checking status of summary with ID: ${summaryId}`);
  
  try {
    const supabaseService = new SupabaseService();
    const summary = await supabaseService.getDocumentById(summaryId);
    
    if (!summary) {
      return {
        success: false,
        error: `Summary with ID ${summaryId} not found`,
        data: [],
      };
    }
    
    return {
      success: true,
      data: [
        {
          type: 'summary',
          id: summary.id as string,
          name: summary.name,
          status: summary.is_archived ? 'archived' : 'active',
          createdAt: summary.created_at,
          updatedAt: summary.updated_at,
          metadata: summary.metadata,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error checking summary status: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
}

/**
 * Check status of a specific presentation
 */
async function checkPresentationStatus(
  presentationId: string,
  format: string
): Promise<StatusResult> {
  Logger.info(`🔍 Checking status of presentation with ID: ${presentationId}`);
  
  try {
    const supabaseService = new SupabaseService();
    const presentation = await supabaseService.getPresentationById(presentationId);
    
    if (!presentation) {
      return {
        success: false,
        error: `Presentation with ID ${presentationId} not found`,
        data: [],
      };
    }
    
    return {
      success: true,
      data: [
        {
          type: 'presentation',
          id: presentation.id as string,
          name: presentation.title,
          status: presentation.status || 'unknown',
          createdAt: presentation.created_at,
          updatedAt: presentation.updated_at,
          metadata: presentation.metadata,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error checking presentation status: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
}

/**
 * Check status of all summaries
 */
async function checkAllSummaries(format: string): Promise<StatusResult> {
  Logger.info('🔍 Checking status of all summaries');
  
  try {
    const supabaseService = new SupabaseService();
    const summaries = await supabaseService.getDocumentsByType('expert_summary', 100);
    
    if (!summaries || summaries.length === 0) {
      return {
        success: true,
        data: [],
      };
    }
    
    return {
      success: true,
      data: summaries.map((summary) => ({
        type: 'summary' as const,
        id: summary.id as string,
        name: summary.name,
        status: summary.is_archived ? 'archived' : 'active',
        createdAt: summary.created_at,
        updatedAt: summary.updated_at,
        metadata: summary.metadata,
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error checking all summaries: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
}

/**
 * Check status of all presentations
 */
async function checkAllPresentations(format: string): Promise<StatusResult> {
  Logger.info('🔍 Checking status of all presentations');
  
  try {
    const supabaseService = new SupabaseService();
    const presentations = await supabaseService.getAllPresentations(100);
    
    if (!presentations || presentations.length === 0) {
      return {
        success: true,
        data: [],
      };
    }
    
    return {
      success: true,
      data: presentations.map((presentation) => ({
        type: 'presentation' as const,
        id: presentation.id as string,
        name: presentation.title,
        status: presentation.status || 'unknown',
        createdAt: presentation.created_at,
        updatedAt: presentation.updated_at,
        metadata: presentation.metadata,
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error checking all presentations: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
}

/**
 * Check status of recent batch processes
 */
async function checkBatchProcesses(): Promise<StatusResult> {
  Logger.info('🔍 Checking status of recent batch processes');
  
  try {
    const supabaseClient = SupabaseClientService.getInstance().getClient();
    const logger = new Logger('CheckStatus', 'INFO');
    const batchService = new BatchProcessingService(supabaseClient, logger);
    
    const batches = await batchService.getBatches(undefined, 10);
    
    if (!batches || batches.length === 0) {
      return {
        success: true,
        data: [],
      };
    }
    
    return {
      success: true,
      data: batches.map((batch) => ({
        type: 'batch' as const,
        id: batch.id,
        name: batch.name,
        status: batch.status,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
        metadata: {
          total_items: batch.total_items,
          processed_items: batch.processed_items,
          failed_items: batch.failed_items,
          skipped_items: batch.skipped_items,
          progress_percentage: batch.progress_percentage,
          completed_at: batch.completed_at,
          user_id: batch.user_id,
          ...batch.metadata,
        },
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error checking batch processes: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      data: [],
    };
  }
}

/**
 * Format status results as a table
 */
function formatStatusTable(data: StatusResult['data']): string {
  if (data.length === 0) {
    return 'No items found.';
  }
  
  // Group items by type
  const groupedItems: Record<string, StatusResult['data']> = {};
  
  for (const item of data) {
    if (!groupedItems[item.type]) {
      groupedItems[item.type] = [];
    }
    
    groupedItems[item.type].push(item);
  }
  
  let output = '';
  
  // Generate tables for each type
  for (const type in groupedItems) {
    const items = groupedItems[type];
    
    output += `\n${type.toUpperCase()} STATUS (${items.length} items)\n`;
    output += '='.repeat(40) + '\n\n';
    
    const tableData = items.map((item) => {
      const row: Record<string, any> = {
        ID: item.id || 'N/A',
        Name: item.name || 'N/A',
        Status: item.status || 'N/A',
        'Created At': item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A',
        'Updated At': item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'N/A',
      };
      
      if (type === 'batch') {
        row['Progress'] = `${item.metadata?.progress_percentage || 0}%`;
        row['Items'] = `${item.metadata?.processed_items || 0}/${item.metadata?.total_items || 0}`;
      }
      
      return row;
    });
    
    // Create table
    try {
      const table = createTable(tableData);
      output += table + '\n\n';
    } catch (error) {
      output += `Error creating table: ${error instanceof Error ? error.message : 'Unknown error'}\n`;
      output += JSON.stringify(tableData, null, 2) + '\n\n';
    }
  }
  
  return output;
}

/**
 * Main command implementation
 */
export default async function command(options: CheckStatusOptions): Promise<void> {
  Logger.info('🚀 Starting check-status command');
  Logger.debug('Options:', options);
  
  try {
    const format = options.format || 'table';
    const results: StatusResult = {
      success: true,
      data: [],
    };
    
    // Check specific summary if requested
    if (options.summary) {
      const summaryResult = await checkSummaryStatus(options.summary, format);
      results.data = [...results.data, ...summaryResult.data];
      
      if (!summaryResult.success) {
        results.success = false;
        results.error = summaryResult.error;
      }
    }
    
    // Check specific presentation if requested
    if (options.presentation) {
      const presentationResult = await checkPresentationStatus(options.presentation, format);
      results.data = [...results.data, ...presentationResult.data];
      
      if (!presentationResult.success) {
        results.success = false;
        results.error = presentationResult.error;
      }
    }
    
    // Check all summaries if requested
    if (options.allSummaries) {
      const allSummariesResult = await checkAllSummaries(format);
      results.data = [...results.data, ...allSummariesResult.data];
      
      if (!allSummariesResult.success) {
        results.success = false;
        results.error = allSummariesResult.error;
      }
    }
    
    // Check all presentations if requested
    if (options.allPresentations) {
      const allPresentationsResult = await checkAllPresentations(format);
      results.data = [...results.data, ...allPresentationsResult.data];
      
      if (!allPresentationsResult.success) {
        results.success = false;
        results.error = allPresentationsResult.error;
      }
    }
    
    // If no specific checks were requested, check recent batch processes
    if (!options.summary && !options.presentation && !options.allSummaries && !options.allPresentations) {
      const batchResult = await checkBatchProcesses();
      results.data = [...results.data, ...batchResult.data];
      
      if (!batchResult.success) {
        results.success = false;
        results.error = batchResult.error;
      }
    }
    
    // Output the results in the requested format
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    } else {
      if (results.error) {
        Logger.error(`❌ Error: ${results.error}`);
      }
      
      const tableOutput = formatStatusTable(results.data);
      console.log(tableOutput);
    }
    
    Logger.info('✅ Status check completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Command execution failed: ${errorMessage}`);
  }
}