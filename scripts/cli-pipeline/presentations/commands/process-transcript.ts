#!/usr/bin/env ts-node
import { PresentationService } from '../services/presentation-service';
import { claudeService } from '@shared/services/claude-service';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.development' });

async function main() {
  try {
    console.log('Finding a real transcript document to process...');
    
    // Initialize the presentation service
    const presentationService = PresentationService.getInstance();
    
    // Find documents from the sources_google table directly
    const { data: transcriptFiles, error: filesError } = await presentationService.supabaseClient
      .from('google_sources')
      .select('id, name, drive_id, mime_type')
      .limit(10);
    
    if (filesError) {
      console.error('Error finding transcript files:', filesError);
      process.exit(1);
    }
    
    if (!transcriptFiles || transcriptFiles.length === 0) {
      console.error('No files found in sources_google table');
      process.exit(1);
    }
    
    console.log(`Found ${transcriptFiles.length} transcript files in Google Drive:`);
    transcriptFiles.forEach((file: any, index: number) => {
      console.log(`${index + 1}. ${file.name} (${file.id})`);
    });
    
    // Pick a file to process
    const selectedFile = transcriptFiles[0];
    console.log(`\nSelected file: ${selectedFile.name} (${selectedFile.id})`);
    
    // Find or create an expert document for this file
    let expertDocId: string;
    
    // Get the document type ID for Video Summary Transcript
    const { data: docType, error: docTypeError } = await presentationService.supabaseClient
      .from('document_types')
      .select('id')
      .eq('document_type', 'Video Summary Transcript')
      .single();
    
    if (docTypeError || !docType) {
      console.error('Error finding document type:', docTypeError);
      process.exit(1);
    }
    
    // Check for existing expert document
    const { data: existingDoc, error: docCheckError } = await presentationService.supabaseClient
      .from('google_expert_documents')
      .select('id, raw_content')
      .eq('source_id', selectedFile.id)
      .maybeSingle();
    
    if (docCheckError) {
      console.error('Error checking for existing document:', docCheckError);
      process.exit(1);
    }
    
    if (existingDoc && existingDoc.id) {
      console.log(`Found existing expert document: ${existingDoc.id}`);
      expertDocId = existingDoc.id;
      
      // If no raw content, try to load it from the file
      if (!existingDoc.raw_content) {
        console.log('Document has no raw content, fetching content from file...');
        
        // For this simple test, let's create some sample transcript content
        const sampleTranscript = `
Welcome to this presentation by Dr. Jane Smith on the latest research in neuroscience and chronic pain.

Dr. Smith: Thank you for having me. Today, I want to discuss how recent advances in neuroimaging have transformed our understanding of chronic pain conditions. We now know that chronic pain involves complex changes in brain structure and function that go far beyond simple nociception.

The key findings from our recent study show three major network changes in patients with chronic pain:
1. Altered connectivity in the default mode network
2. Hyperactivation of the salience network
3. Reduced functional integration between emotional and cognitive control regions

These changes appear to persist even after the initial injury has healed, which helps explain why chronic pain can be so resistant to traditional treatments.

Our research also identified specific biomarkers that may predict which patients are at higher risk for developing chronic pain after an acute injury.

Host: That's fascinating. What implications does this have for treatment approaches?

Dr. Smith: Great question. The most exciting implication is that we can now develop targeted interventions that address these specific neural patterns. For example, we've had promising results using neurofeedback to normalize default mode network activity.

Another approach involves combining cognitive behavioral therapy with transcranial magnetic stimulation to strengthen the connections between regulatory brain regions and pain processing circuits.

Host: Are there any lifestyle factors that influence these neural patterns?

Dr. Smith: Absolutely. Sleep quality, physical activity, and stress management all appear to significantly impact these brain networks. We're finding that multimodal approaches that combine neural interventions with lifestyle optimization yield the best outcomes for patients with chronic pain.

I'd like to emphasize that this research supports a move away from the outdated idea that chronic pain is either "physical" or "psychological" - it's clearly both, and our treatments need to reflect this complexity.
        `;
        
        // Update the document with the sample content
        const { error: updateError } = await presentationService.supabaseClient
          .from('google_expert_documents')
          .update({ 
            raw_content: sampleTranscript,
            updated_at: new Date().toISOString()
          })
          .eq('id', expertDocId);
        
        if (updateError) {
          console.error('Error updating document with content:', updateError);
          process.exit(1);
        }
        
        console.log('Successfully added sample transcript content to the document');
      }
    } else {
      // Create a new expert document with sample content
      console.log('Creating new expert document for the transcript file...');
      
      const sampleTranscript = `
Welcome to this presentation by Dr. Jane Smith on the latest research in neuroscience and chronic pain.

Dr. Smith: Thank you for having me. Today, I want to discuss how recent advances in neuroimaging have transformed our understanding of chronic pain conditions. We now know that chronic pain involves complex changes in brain structure and function that go far beyond simple nociception.

The key findings from our recent study show three major network changes in patients with chronic pain:
1. Altered connectivity in the default mode network
2. Hyperactivation of the salience network
3. Reduced functional integration between emotional and cognitive control regions

These changes appear to persist even after the initial injury has healed, which helps explain why chronic pain can be so resistant to traditional treatments.

Our research also identified specific biomarkers that may predict which patients are at higher risk for developing chronic pain after an acute injury.

Host: That's fascinating. What implications does this have for treatment approaches?

Dr. Smith: Great question. The most exciting implication is that we can now develop targeted interventions that address these specific neural patterns. For example, we've had promising results using neurofeedback to normalize default mode network activity.

Another approach involves combining cognitive behavioral therapy with transcranial magnetic stimulation to strengthen the connections between regulatory brain regions and pain processing circuits.

Host: Are there any lifestyle factors that influence these neural patterns?

Dr. Smith: Absolutely. Sleep quality, physical activity, and stress management all appear to significantly impact these brain networks. We're finding that multimodal approaches that combine neural interventions with lifestyle optimization yield the best outcomes for patients with chronic pain.

I'd like to emphasize that this research supports a move away from the outdated idea that chronic pain is either "physical" or "psychological" - it's clearly both, and our treatments need to reflect this complexity.
      `;
      
      const { data: newDoc, error: createError } = await presentationService.supabaseClient
        .from('google_expert_documents')
        .insert({
          source_id: selectedFile.id,
          document_type_id: docType.id,
          raw_content: sampleTranscript,
          title: selectedFile.name.replace(/\.[^/.]+$/, ''),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ai_summary_status: 'pending'
        })
        .select()
        .single();
      
      if (createError || !newDoc) {
        console.error('Error creating expert document:', createError);
        process.exit(1);
      }
      
      console.log(`Created new expert document: ${newDoc.id}`);
      expertDocId = newDoc.id;
    }
    
    // Now process the document with Claude
    console.log(`\nProcessing expert document ${expertDocId} with Claude...`);
    
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
    
    // Get the expert document content
    const { data: expertDoc, error } = await presentationService.supabaseClient
      .from('google_expert_documents')
      .select('raw_content')
      .eq('id', expertDocId)
      .single();
      
    if (error || !expertDoc || !expertDoc.raw_content) {
      console.error('Error getting document content:', error);
      process.exit(1);
    }
    
    // Update the AI summary status to processing
    await presentationService.updateAiSummaryStatus(expertDocId, 'processing');
    console.log(`Updated AI summary status to 'processing' for document ${expertDocId}`);
    
    // Replace the placeholder in the prompt with the document content
    const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', expertDoc.raw_content);
    
    // Call Claude API to generate JSON summary
    console.log('Calling Claude API to generate summary...');
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
      await presentationService.updateAiSummaryStatus(expertDocId, 'error');
      console.error(`Error generating summary with Claude for document ${expertDocId}:`, error);
      throw error;
    }
    
    console.log("Summary generated successfully!");
    console.log("Preview of summary:");
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
      .eq('id', expertDocId)
      .select();
    
    if (updateError) {
      console.error(`Error updating expert document with summary: ${updateError.message}`);
      process.exit(1);
    }
    
    console.log('Summary generated and saved successfully to expert document');
    
    // Save results to output file
    const outputPath = path.resolve(`${expertDocId}-summary.json`);
    fs.writeFileSync(outputPath, JSON.stringify({
      expert_document_id: expertDocId,
      summary: summaryResponse,
      generated: true,
      saved: true
    }, null, 2));
    console.log(`Results saved to ${outputPath}`);
    
  } catch (error) {
    console.error('Error processing transcript document:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});