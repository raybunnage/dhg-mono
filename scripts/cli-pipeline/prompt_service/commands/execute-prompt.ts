import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
import { Database } from '../../../../supabase/types';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

interface ExecutePromptOptions {
  documentId?: string;
  context?: Record<string, any>;
  jsonFile?: string;
  verbose?: boolean;
  trackExecution?: boolean;
}

interface ExecutionMetrics {
  executionTime: number;
  tokensUsed?: number;
  success: boolean;
  error?: string;
}

export async function executePromptCommand(
  promptName: string,
  options: ExecutePromptOptions
): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient() as SupabaseClient<Database>;
  const startTime = Date.now();

  try {
    // Fetch the prompt
    const { data: prompt, error: promptError } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('name', promptName)
      .single();

    if (promptError || !prompt) {
      console.error(`❌ Prompt not found: ${promptName}`);
      if (promptError) console.error('Error:', promptError.message);
      process.exit(1);
    }

    if (options.verbose) {
      console.log(`📋 Found prompt: ${prompt.name}`);
      console.log(`   Status: ${prompt.status}`);
      console.log(`   Category: ${prompt.category_id || 'None'}`);
    }

    // Build context
    let context: Record<string, any> = options.context || {};
    
    // Load JSON file if provided
    if (options.jsonFile) {
      if (!existsSync(options.jsonFile)) {
        console.error(`❌ JSON file not found: ${options.jsonFile}`);
        process.exit(1);
      }
      
      const jsonContent = readFileSync(options.jsonFile, 'utf-8');
      try {
        const jsonData = JSON.parse(jsonContent);
        context = { ...context, ...jsonData };
        if (options.verbose) {
          console.log(`📄 Loaded JSON context from: ${options.jsonFile}`);
        }
      } catch (e) {
        console.error(`❌ Invalid JSON in file: ${options.jsonFile}`);
        process.exit(1);
      }
    }

    // Add document ID to context if provided
    if (options.documentId) {
      context.documentId = options.documentId;
    }

    // Get prompt content
    const promptContent = prompt.content as any;
    let promptText = '';
    
    if (typeof promptContent === 'string') {
      promptText = promptContent;
    } else if (promptContent.content) {
      promptText = promptContent.content;
    } else if (promptContent.text) {
      promptText = promptContent.text;
    }

    // Replace context variables in prompt
    if (Object.keys(context).length > 0) {
      for (const [key, value] of Object.entries(context)) {
        const placeholder = `{{${key}}}`;
        promptText = promptText.replace(new RegExp(placeholder, 'g'), String(value));
      }
    }

    if (options.verbose) {
      console.log('\n📝 Executing prompt...');
      console.log('Context keys:', Object.keys(context));
    }

    // Execute the prompt
    let result: any;
    let tokensUsed: number | undefined;

    try {
      // Check if prompt expects JSON output
      const expectsJson = promptText.toLowerCase().includes('json') || 
                         prompt.metadata?.outputFormat === 'json';
      
      if (expectsJson) {
        result = await claudeService.getJsonResponse(promptText);
      } else {
        result = await claudeService.sendPrompt(promptText);
      }

      // Estimate tokens (rough estimation)
      tokensUsed = Math.ceil((promptText.length + JSON.stringify(result).length) / 4);
      
      const executionTime = Date.now() - startTime;

      // Track execution if enabled
      if (options.trackExecution !== false) {
        await trackExecution(supabase, prompt.id, {
          documentId: options.documentId,
          tokensUsed,
          executionTime,
          success: true,
        });
      }

      // Display results
      console.log('\n✅ Execution successful!');
      console.log(`⏱️  Execution time: ${executionTime}ms`);
      if (tokensUsed) {
        console.log(`🔤 Estimated tokens: ${tokensUsed}`);
      }
      console.log('\n📤 Result:');
      
      if (typeof result === 'object') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result);
      }

      // Update prompt stats
      await updatePromptStats(supabase, prompt.id, tokensUsed || 0, executionTime);

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Track failed execution
      if (options.trackExecution !== false) {
        await trackExecution(supabase, prompt.id, {
          documentId: options.documentId,
          executionTime,
          success: false,
          error: errorMessage,
        });
      }

      console.error('\n❌ Execution failed:', errorMessage);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function trackExecution(
  supabase: SupabaseClient<Database>,
  promptId: string,
  metrics: {
    documentId?: string;
    tokensUsed?: number;
    executionTime: number;
    success: boolean;
    error?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from('ai_prompt_executions_simple')
    .insert({
      prompt_id: promptId,
      document_id: metrics.documentId,
      tokens_used: metrics.tokensUsed,
      execution_time_ms: Math.round(metrics.executionTime),
      success: metrics.success,
      error_message: metrics.error,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });

  if (error) {
    console.warn('⚠️  Failed to track execution:', error.message);
  }
}

async function updatePromptStats(
  supabase: SupabaseClient<Database>,
  promptId: string,
  tokensUsed: number,
  executionTimeMs: number
): Promise<void> {
  // Get current stats
  const { data: prompt, error: fetchError } = await supabase
    .from('ai_prompts')
    .select('execution_count, avg_tokens, avg_execution_time_ms')
    .eq('id', promptId)
    .single();

  if (fetchError || !prompt) {
    console.warn('⚠️  Failed to fetch prompt stats');
    return;
  }

  // Calculate new averages
  const count = (prompt.execution_count || 0) + 1;
  const avgTokens = prompt.avg_tokens
    ? Math.round(((prompt.avg_tokens * (count - 1)) + tokensUsed) / count)
    : tokensUsed;
  const avgTime = prompt.avg_execution_time_ms
    ? Math.round(((prompt.avg_execution_time_ms * (count - 1)) + executionTimeMs) / count)
    : executionTimeMs;

  // Update stats
  const { error: updateError } = await supabase
    .from('ai_prompts')
    .update({
      execution_count: count,
      avg_tokens: avgTokens,
      avg_execution_time_ms: avgTime,
      last_executed_at: new Date().toISOString(),
    })
    .eq('id', promptId);

  if (updateError) {
    console.warn('⚠️  Failed to update prompt stats:', updateError.message);
  }
}