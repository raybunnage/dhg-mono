#!/usr/bin/env ts-node
import { PresentationService } from '../services/presentation-service';
import { claudeService } from '@shared/services/claude-service';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.development
dotenv.config({ path: '.env.development' });

async function main() {
  // Get the document ID from command line arguments
  const documentId = process.argv[2];
  
  if (!documentId) {
    console.error('ERROR: You must provide an expert document ID as an argument');
    process.exit(1);
  }
  
  console.log(`Processing expert document with ID: ${documentId}`);

  try {
    // Initialize the presentation service
    const presentationService = PresentationService.getInstance();
    
    // Get the prompt from the database
    console.log('Fetching video summary prompt from database...');
    let promptTemplate = '';
    try {
      const { data: summaryPrompt, error: promptError } = await presentationService.supabaseClient
        .from('prompts')
        .select('content')
        .eq('name', 'final_video-summary-prompt')
        .single();
        
      if (promptError || !summaryPrompt) {
        console.warn('Error fetching prompt from database:', promptError);
      } else {
        promptTemplate = summaryPrompt.content;
        console.log('Successfully retrieved prompt from database');
      }
    } catch (error) {
      console.warn('Exception when fetching prompt:', error);
    }
    
    // Use default prompt if none found in database
    if (!promptTemplate) {
      console.warn('Using default JSON prompt template');
      promptTemplate = `
You are an expert medical content summarizer. Your task is to summarize the following transcript from a medical presentation or discussion.

Create a JSON object with the following structure:
\`\`\`json
{
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

Ensure valid JSON formatting with proper quoting and escaping of special characters.

TRANSCRIPT:
{{TRANSCRIPT}}
`;
    }
    
    // Get the expert document
    const { data: expertDoc, error } = await presentationService.supabaseClient
      .from('google_expert_documents')
      .select('id, raw_content, processed_content, document_type_id')
      .eq('id', documentId)
      .single();
      
    if (error || !expertDoc) {
      console.error(`Error fetching expert document ${documentId}:`, error);
      process.exit(1);
    }
    
    // Get document type for logging
    const { data: docType } = await presentationService.supabaseClient
      .from('document_types')
      .select('document_type')
      .eq('id', expertDoc.document_type_id)
      .single();
    
    console.log(`Found expert document ID ${documentId} (type: ${docType?.document_type || 'Unknown'})`);
    
    // Check if we have raw content
    if (!expertDoc.raw_content) {
      console.error(`No raw content found for expert document ${documentId}`);
      process.exit(1);
    }
    
    // Clear existing processed_content
    console.log(`Clearing existing processed_content for document ${documentId}`);
    
    const { error: clearError } = await presentationService.supabaseClient
      .from('google_expert_documents')
      .update({ processed_content: null })
      .eq('id', documentId);
      
    if (clearError) {
      console.error(`Error clearing processed_content: ${clearError.message}`);
      process.exit(1);
    }
    
    console.log(`Successfully cleared processed_content field`);
    
    // Update the AI summary status to processing
    await presentationService.updateAiSummaryStatus(documentId, 'processing');
    console.log(`Updated AI summary status to 'processing' for document ${documentId}`);
    
    // Replace the placeholder in the prompt with the document content
    const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
    
    console.log('Generating summary using Claude...');
    
    // Call Claude API to generate JSON summary
    let summaryResponse: string;
    try {
      summaryResponse = await claudeService.sendPrompt(customizedPrompt);
      
      // Validate that response is valid JSON
      try {
        // Extract JSON if it's wrapped in markdown code blocks
        let jsonString = summaryResponse;
        const jsonMatch = summaryResponse.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          jsonString = jsonMatch[1];
          console.log('Extracted JSON from code block');
        }
        
        // Parse JSON to validate
        const parsedJson = JSON.parse(jsonString);
        
        // Convert back to string for storage (properly formatted)
        summaryResponse = JSON.stringify(parsedJson, null, 2);
        
        console.log('Successfully parsed JSON response from Claude');
      } catch (jsonError) {
        console.warn(`Claude response is not valid JSON: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
        console.warn('Will save response as-is and attempt to process it later');
        // We'll continue with the raw response
      }
    } catch (error) {
      // Update status to error if Claude API call fails
      await presentationService.updateAiSummaryStatus(documentId, 'error');
      console.error(`Error generating summary with Claude for document ${documentId}:`, error);
      throw error;
    }
    
    console.log("Summary generated successfully!");
    console.log("Preview of new summary:");
    console.log("------------------------");
    console.log(summaryResponse.substring(0, 500) + "...");
    
    // Save the processed content directly to the expert document
    const { data, error: updateError } = await presentationService.supabaseClient
      .from('google_expert_documents')
      .update({ 
        processed_content: summaryResponse, 
        ai_summary_status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select();
    
    if (updateError) {
      console.error(`Error updating expert document with summary: ${updateError.message}`);
      process.exit(1);
    }
    
    console.log('Summary generated and saved successfully to expert document');
    
    // Save results to output file
    const outputPath = path.resolve(`${documentId}-summary.json`);
    fs.writeFileSync(outputPath, JSON.stringify({
      expert_document_id: documentId,
      document_type: docType?.document_type || 'Unknown',
      summary: summaryResponse,
      generated: true,
      saved: true
    }, null, 2));
    console.log(`Results saved to ${outputPath}`);
    
  } catch (error) {
    console.error('Error processing document:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});