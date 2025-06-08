#!/usr/bin/env ts-node
/**
 * View sync history from the google_sync_history table
 * 
 * Usage:
 *   ts-node view-sync-history.ts [options]
 * 
 * Options:
 *   --limit <n>      Number of entries to show (default: 20)
 *   --folder-id <id> Filter by specific folder ID
 *   --status <status> Filter by status (pending, in_progress, completed, completed_with_errors, failed)
 *   --json           Output as JSON
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getRecentSyncHistory } from './record-sync-history';

interface ViewOptions {
  limit: number;
  folderId?: string;
  status?: string;
  json?: boolean;
}

async function viewSyncHistory(options: ViewOptions) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Build query
    let query = supabase
      .from('google_sync_history')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(options.limit);
    
    if (options.folderId) {
      query = query.eq('folder_id', options.folderId);
    }
    
    if (options.status) {
      query = query.eq('status', options.status);
    }
    
    const { data: history, error } = await query;
    
    if (error) {
      console.error('Error fetching sync history:', error);
      process.exit(1);
    }
    
    if (!history || history.length === 0) {
      console.log('No sync history found with the specified criteria.');
      process.exit(0);
    }
    
    // Output as JSON if requested
    if (options.json) {
      console.log(JSON.stringify(history, null, 2));
      return;
    }
    
    // Display as formatted table
    console.log('=== Google Drive Sync History ===\n');
    
    // Table headers
    const headers = ['Timestamp', 'Folder', 'Status', 'Items', 'Duration', 'Errors'];
    const widths = [20, 30, 20, 10, 10, 40];
    
    // Print headers
    console.log(headers.map((h, i) => h.padEnd(widths[i])).join(' │ '));
    console.log('─'.repeat(widths.reduce((sum, w) => sum + w + 3, -3)));
    
    // Print rows
    history.forEach(entry => {
      const timestamp = new Date(entry.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const folderName = (entry.folder_name || 'Unknown').substring(0, widths[1] - 1);
      
      const status = entry.status || 'unknown';
      const statusColor = getStatusColor(status);
      
      const items = entry.items_processed?.toString() || '0';
      
      const duration = entry.completed_at && entry.timestamp ? 
        `${((new Date(entry.completed_at).getTime() - new Date(entry.timestamp).getTime()) / 1000).toFixed(1)}s` : 
        '-';
      
      const error = entry.error_message ? 
        entry.error_message.substring(0, widths[5] - 1) : 
        '-';
      
      console.log(
        timestamp.padEnd(widths[0]) + ' │ ' +
        folderName.padEnd(widths[1]) + ' │ ' +
        statusColor + status.padEnd(widths[2]) + '\x1b[0m │ ' +
        items.padEnd(widths[3]) + ' │ ' +
        duration.padEnd(widths[4]) + ' │ ' +
        error
      );
    });
    
    console.log('\n' + '─'.repeat(widths.reduce((sum, w) => sum + w + 3, -3)));
    console.log(`Total entries: ${history.length}`);
    
    // Show summary statistics
    const stats = {
      completed: history.filter(h => h.status === 'completed').length,
      completedWithErrors: history.filter(h => h.status === 'completed_with_errors').length,
      failed: history.filter(h => h.status === 'failed').length,
      inProgress: history.filter(h => h.status === 'in_progress').length,
      pending: history.filter(h => h.status === 'pending').length
    };
    
    console.log('\n📊 Status Summary:');
    console.log(`  ✅ Completed: ${stats.completed}`);
    console.log(`  ⚠️  Completed with errors: ${stats.completedWithErrors}`);
    console.log(`  ❌ Failed: ${stats.failed}`);
    console.log(`  🔄 In progress: ${stats.inProgress}`);
    console.log(`  ⏳ Pending: ${stats.pending}`);
    
    // Calculate average sync time for completed syncs
    const completedSyncs = history.filter(h => 
      h.status === 'completed' && h.completed_at && h.timestamp
    );
    
    if (completedSyncs.length > 0) {
      const totalTime = completedSyncs.reduce((sum, h) => {
        const duration = new Date(h.completed_at!).getTime() - new Date(h.timestamp).getTime();
        return sum + duration;
      }, 0);
      
      const avgTime = totalTime / completedSyncs.length / 1000;
      console.log(`\n⏱️  Average sync time: ${avgTime.toFixed(1)}s`);
    }
    
    // Show total items processed
    const totalItems = history.reduce((sum, h) => sum + (h.items_processed || 0), 0);
    console.log(`📦 Total items processed: ${totalItems.toLocaleString()}`);
    
  } catch (error) {
    console.error('Failed to view sync history:', error);
    process.exit(1);
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return '\x1b[32m'; // Green
    case 'completed_with_errors':
      return '\x1b[33m'; // Yellow
    case 'failed':
      return '\x1b[31m'; // Red
    case 'in_progress':
      return '\x1b[36m'; // Cyan
    case 'pending':
      return '\x1b[90m'; // Gray
    default:
      return '\x1b[0m'; // Default
  }
}

// Setup CLI
program
  .option('--limit <number>', 'Number of entries to show', '20')
  .option('--folder-id <id>', 'Filter by specific folder ID')
  .option('--status <status>', 'Filter by status')
  .option('--json', 'Output as JSON')
  .parse(process.argv);

const options = program.opts() as ViewOptions;
options.limit = parseInt(options.limit as any) || 20;

viewSyncHistory(options);