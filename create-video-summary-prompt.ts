import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();
dotenv.config({ path: '.env.local' });
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Check if prompt already exists
  const { data: existingPrompt, error: checkError } = await supabase
    .from('prompts')
    .select('id, name')
    .eq('name', 'final_video-summary-prompt')
    .single();
    
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking for existing prompt:', checkError);
    process.exit(1);
  }
  
  if (existingPrompt) {
    console.log('Prompt already exists with ID:', existingPrompt.id);
    return;
  }
  
  // Create the prompt content with placeholder for transcript
  const promptContent = `
You are an expert medical content summarizer. Your task is to summarize the following transcript from a medical presentation or discussion.

Create a concise 2-3 paragraph summary that captures the key points and main message.

Focus on capturing:
1. The main topic and thesis
2. Key medical concepts and terminology
3. Important research findings or clinical implications
4. Practical takeaways for health professionals

The summary should be clear, professional, and accurately represent the presentation content.

TRANSCRIPT:
{{TRANSCRIPT}}
  `;
  
  // Insert the new prompt
  const { data: newPrompt, error: insertError } = await supabase
    .from('prompts')
    .insert({
      name: 'final_video-summary-prompt',
      description: 'Prompt for generating video summaries from transcripts',
      content: promptContent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        placeholder: '{{TRANSCRIPT}}',
        usage: 'For presentation CLI pipeline generate-summary command'
      }
    })
    .select();
    
  if (insertError) {
    console.error('Error creating prompt:', insertError);
    process.exit(1);
  }
  
  console.log('Created new prompt with ID:', newPrompt[0].id);
}

main().catch(console.error);