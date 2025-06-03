import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Database } from '../../../../supabase/types';

interface SelectPromptOptions {
  documentType?: string;
  mimeType?: string;
  fileSize?: number;
  showAll?: boolean;
  format?: 'table' | 'json';
}

interface PromptCandidate {
  id: string;
  name: string;
  priority: number;
  avgExecutionTime?: number;
  avgTokens?: number;
  executionCount: number;
  score: number;
}

export async function selectPromptCommand(options: SelectPromptOptions): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient() as SupabaseClient<Database>;

  try {
    // Build query
    let query = supabase
      .from('ai_prompts')
      .select('*')
      .eq('status', 'active');

    // Get all prompts first
    const { data: prompts, error } = await query;

    if (error) {
      console.error('❌ Error fetching prompts:', error.message);
      process.exit(1);
    }

    if (!prompts || prompts.length === 0) {
      console.log('⚠️  No active prompts found');
      return;
    }

    // Filter and score prompts
    const candidates: PromptCandidate[] = prompts
      .filter(prompt => {
        // Filter by document type if specified
        if (options.documentType) {
          const supportedTypes = prompt.supported_document_types || [];
          if (supportedTypes.length > 0 && !supportedTypes.includes(options.documentType)) {
            return false;
          }
        }

        // Filter by MIME type if specified
        if (options.mimeType) {
          const supportedMimes = prompt.supported_mime_types || [];
          if (supportedMimes.length > 0 && !supportedMimes.includes(options.mimeType)) {
            return false;
          }
        }

        return true;
      })
      .map(prompt => {
        // Calculate score based on various factors
        let score = 100; // Base score

        // Priority affects score
        score += (prompt.priority || 0) * 10;

        // Performance affects score
        if (prompt.avg_execution_time_ms) {
          // Faster prompts get higher scores
          score += Math.max(0, 50 - (prompt.avg_execution_time_ms / 100));
        }

        // Experience affects score
        if (prompt.execution_count) {
          // More tested prompts get slightly higher scores
          score += Math.min(20, prompt.execution_count / 10);
        }

        // File size optimization
        if (options.fileSize) {
          // Check if prompt name suggests size optimization
          const isLargeFilePrompt = prompt.name.toLowerCase().includes('large');
          const isSmallFilePrompt = prompt.name.toLowerCase().includes('small') || 
                                   prompt.name.toLowerCase().includes('quick');
          
          if (options.fileSize > 50000 && isLargeFilePrompt) {
            score += 20;
          } else if (options.fileSize < 10000 && isSmallFilePrompt) {
            score += 20;
          }
        }

        return {
          id: prompt.id,
          name: prompt.name,
          priority: prompt.priority || 0,
          avgExecutionTime: prompt.avg_execution_time_ms || undefined,
          avgTokens: prompt.avg_tokens || undefined,
          executionCount: prompt.execution_count || 0,
          score: Math.round(score),
        };
      })
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      console.log('⚠️  No suitable prompts found for the given criteria');
      return;
    }

    // Display results
    if (options.format === 'json') {
      console.log(JSON.stringify(options.showAll ? candidates : candidates[0], null, 2));
    } else {
      if (options.showAll) {
        console.log('\n📋 Prompt Candidates (sorted by score):');
        console.log('═'.repeat(100));
        console.log(
          'Name'.padEnd(40) +
          'Score'.padEnd(10) +
          'Priority'.padEnd(10) +
          'Avg Time'.padEnd(12) +
          'Avg Tokens'.padEnd(12) +
          'Executions'
        );
        console.log('─'.repeat(100));

        candidates.forEach((candidate, index) => {
          const avgTime = candidate.avgExecutionTime 
            ? `${candidate.avgExecutionTime}ms` 
            : 'N/A';
          const avgTokens = candidate.avgTokens?.toString() || 'N/A';
          
          console.log(
            candidate.name.padEnd(40) +
            candidate.score.toString().padEnd(10) +
            candidate.priority.toString().padEnd(10) +
            avgTime.padEnd(12) +
            avgTokens.padEnd(12) +
            candidate.executionCount.toString()
          );
        });
        console.log('═'.repeat(100));
      } else {
        // Show only the best match
        const best = candidates[0];
        console.log('\n✅ Recommended Prompt:');
        console.log('═'.repeat(60));
        console.log(`Name: ${best.name}`);
        console.log(`Score: ${best.score}`);
        console.log(`Priority: ${best.priority}`);
        if (best.avgExecutionTime) {
          console.log(`Avg Execution Time: ${best.avgExecutionTime}ms`);
        }
        if (best.avgTokens) {
          console.log(`Avg Tokens: ${best.avgTokens}`);
        }
        console.log(`Times Executed: ${best.executionCount}`);
        console.log('═'.repeat(60));
      }
    }

    // Show selection criteria used
    if (!options.showAll && (options.documentType || options.mimeType || options.fileSize)) {
      console.log('\n📊 Selection Criteria:');
      if (options.documentType) console.log(`   Document Type: ${options.documentType}`);
      if (options.mimeType) console.log(`   MIME Type: ${options.mimeType}`);
      if (options.fileSize) console.log(`   File Size: ${options.fileSize} bytes`);
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}