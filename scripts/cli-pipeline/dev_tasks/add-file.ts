#!/usr/bin/env ts-node
/**
 * Add file references to a task
 * 
 * Usage:
 *   ts-node add-file.ts <task-id> --path "src/file.ts" --action modified
 *   ts-node add-file.ts <task-id> --paths "file1.ts,file2.ts" --action created
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

const supabase = SupabaseClientService.getInstance().getClient();

interface AddFileOptions {
  path?: string;
  paths?: string;
  action?: string;
}

async function addFiles(taskId: string, options: AddFileOptions) {
  try {
    // Get file paths
    let filePaths: string[] = [];
    if (options.path) {
      filePaths = [options.path];
    } else if (options.paths) {
      filePaths = options.paths.split(',').map(p => p.trim());
    } else {
      console.error('❌ Error: Either --path or --paths is required');
      process.exit(1);
    }
    
    const action = options.action || 'modified';
    
    // Verify task exists
    const { data: task, error: taskError } = await supabase
      .from('dev_tasks')
      .select('id, title')
      .eq('id', taskId)
      .single();
      
    if (taskError || !task) {
      console.error('❌ Task not found');
      process.exit(1);
    }
    
    // Add file references
    const fileInserts = filePaths.map(filePath => ({
      task_id: taskId,
      file_path: filePath,
      action: action
    }));
    
    const { data: files, error } = await supabase
      .from('dev_task_files')
      .insert(fileInserts)
      .select();
      
    if (error) throw error;
    
    console.log(`✅ Added ${files?.length || 0} file(s) to task: ${task.title}`);
    files?.forEach(file => {
      const actionEmoji = file.action === 'created' ? '✨' : 
                         file.action === 'modified' ? '📝' : 
                         file.action === 'deleted' ? '🗑️' : '📄';
      console.log(`   ${actionEmoji} ${file.file_path} (${file.action})`);
    });
    
  } catch (error: any) {
    console.error('❌ Error adding files:', error.message);
    process.exit(1);
  }
}

program
  .argument('<taskId>', 'Task ID')
  .option('--path <path>', 'Single file path')
  .option('--paths <paths>', 'Comma-separated file paths')
  .option('--action <action>', 'File action: created, modified, deleted (default: modified)')
  .parse(process.argv);

const [taskId] = program.args;
const options = program.opts() as AddFileOptions;

if (!taskId) {
  console.error('❌ Error: Task ID is required');
  process.exit(1);
}

addFiles(taskId, options).catch(console.error);