import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * A direct approach to process the mp4 file without relying on any cached/debug files
 * This will get the raw content directly from the database and send it to Claude
 */
async function directProcess() {
  console.log('Starting direct processing of expert document...');
  
  // Get the document ID from the arguments
  const documentId = '7487db13-5979-430d-a4f4-d7b31c3d98f6';
  console.log(`Processing document ID: ${documentId}`);
  
  // Get the Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // 1. Get the expert document directly from the database
    console.log('Fetching expert document from database...');
    const { data: expertDoc, error: docError } = await supabase
      .from('expert_documents')
      .select('id, raw_content, title, document_type_id, source_id')
      .eq('id', documentId)
      .single();
      
    if (docError || !expertDoc) {
      console.error('Failed to fetch document:', docError?.message || 'Document not found');
      process.exit(1);
    }
    
    console.log(`Document found: "${expertDoc.title}"`);
    console.log(`Raw content length: ${expertDoc.raw_content?.length || 0} characters`);
    console.log(`First 200 chars: ${expertDoc.raw_content?.substring(0, 200)}...`);
    
    // 2. Create a clean prompt template with no example content
    const cleanPrompt = `# Expert Video Summary Generation Prompt

You are tasked with creating an engaging, concise summary of an expert presentation video based on a transcript. Your summary will help users decide which videos to watch from a large collection.

## Important Instructions
I will provide a transcript between the markers "{{TRANSCRIPT START}}" and "{{TRANSCRIPT END}}" below. Your job is to analyze this transcript and generate a structured JSON summary of the content.

## Analysis Tasks
When analyzing the transcript:
1. Identify the main speaker and their expertise
2. Determine the core topic and unique perspectives presented
3. Extract key insights and actionable advice
4. Find memorable direct quotes (exact wording)
5. Note important points from any Q&A or discussion
6. Create an appropriate, attention-grabbing title
7. Determine who would benefit most from watching

## Output Format
You must respond with a single JSON object having the following structure:

\`\`\`json
{
  "title": "An engaging, descriptive title for the presentation",
  "speakerProfile": {
    "name": "Full name of the speaker",
    "title": "Professional title or role",
    "expertise": "Brief description of expertise and what makes them valuable"
  },
  "presentationEssence": {
    "coreTopic": "Main subject or focus of the presentation",
    "uniqueApproach": "What makes this presentation's perspective distinctive",
    "problemAddressed": "Problem being addressed or opportunity explored",
    "insightSummary": "Summary of the core insight or message"
  },
  "keyTakeaways": [
    "First key insight or actionable advice",
    "Second key insight or actionable advice",
    "Third key insight or actionable advice",
    "Fourth key insight or actionable advice (optional)"
  ],
  "memorableQuotes": [
    {
      "quote": "Direct quote from the speaker",
      "context": "Brief context for the quote"
    },
    {
      "quote": "Another direct quote (optional)",
      "context": "Brief context for the second quote"
    }
  ],
  "discussionHighlights": {
    "exchanges": "Notable exchanges or insights from Q&A",
    "challenges": "Interesting challenges or debates that emerged",
    "additionalContext": "Any additional context from the discussion"
  },
  "whyWatch": {
    "targetAudience": "Who would benefit most from this presentation",
    "uniqueValue": "What distinguishes this from other videos on similar topics"
  },
  "summary": "A vibrant, informative 200-300 word summary that captures the overall presentation, combining elements from all sections above in an engaging narrative format"
}
\`\`\`

## Critical Requirements
- You MUST respond with ONLY valid JSON format
- Do NOT include any text before or after the JSON object
- Do NOT include backticks or markdown code formatting
- The JSON structure must exactly match the template above
- All text fields should be properly escaped where needed
- Your analysis should focus entirely on the actual transcript content

## Title Guidelines
- Create a concise, attention-grabbing title (5-10 words)
- Capture the main insight, expertise, or unique value of the presentation
- Avoid generic titles - be specific and distinctive
- Make it compelling for the target audience

## Summary Guidelines
- Use enthusiastic, dynamic language that reflects the energy of the presentation
- Highlight what's unique about the speaker's approach and expertise
- Include specific details and examples rather than generic descriptions
- Aim for an engaging, conversational tone

{{TRANSCRIPT START}}
${expertDoc.raw_content}
{{TRANSCRIPT END}}`;
    
    // Save the clean prompt with actual transcript for reference
    const debugDir = path.resolve(__dirname, 'debug-output');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const promptPath = path.resolve(debugDir, `direct-prompt-${documentId.substring(0, 8)}.md`);
    fs.writeFileSync(promptPath, cleanPrompt);
    console.log(`Saved clean prompt with transcript to: ${promptPath}`);
    
    // 3. Call Claude API directly
    console.log('\n=== CALLING CLAUDE API ===');
    console.log('Sending transcript to Claude for JSON summary generation...');
    
    const jsonResult = await claudeService.getJsonResponse(cleanPrompt, {
      jsonMode: true,
      temperature: 0
    });
    
    console.log('\n=== CLAUDE API RESPONSE RECEIVED ===');
    console.log(`Successfully received JSON response with keys: ${Object.keys(jsonResult).join(', ')}`);
    
    // Save the JSON response
    const jsonPath = path.resolve(debugDir, `direct-result-${documentId.substring(0, 8)}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonResult, null, 2));
    console.log(`Saved JSON response to: ${jsonPath}`);
    
    // Extract the title and display summary
    console.log('\n=== SUMMARY DETAILS ===');
    console.log(`Title: "${jsonResult.title}"`);
    console.log(`Speaker: ${jsonResult.speakerProfile?.name} (${jsonResult.speakerProfile?.title})`);
    console.log(`Core Topic: ${jsonResult.presentationEssence?.coreTopic}`);
    console.log(`First Key Takeaway: ${jsonResult.keyTakeaways?.[0]}`);
    console.log(`Target Audience: ${jsonResult.whyWatch?.targetAudience}`);
    
    // 4. Update the database with the result
    console.log('\n=== UPDATING DATABASE ===');
    console.log(`Updating document ${documentId} with title: "${jsonResult.title}"`);
    console.log(`Updating processed_content with JSON data (${JSON.stringify(jsonResult, null, 2).length} bytes)`);
    
    const { data: updatedDoc, error: updateError } = await supabase
      .from('expert_documents')
      .update({ 
        processed_content: JSON.stringify(jsonResult, null, 2),
        title: jsonResult.title,
        ai_summary_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select();
      
    if (updateError) {
      console.error(`Error updating document: ${updateError.message}`);
      process.exit(1);
    } else {
      console.log(`Successfully updated document in database!`);
    }
    
    console.log('\n=== PROCESSING COMPLETE ===');
    
  } catch (error) {
    console.error('Error during direct processing:', error);
  }
}

// Execute the direct processing
directProcess();