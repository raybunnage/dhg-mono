#!/usr/bin/env ts-node
import { claudeService } from '@shared/services/claude-service';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    console.log('Testing JSON summary generation with Claude using direct prompt...');
    
    // Create a sample transcript
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
    
    // Define the prompt template directly
    const promptTemplate = `
# Expert Video Summary Generation Prompt

You are tasked with creating an engaging, concise summary of an expert presentation video based on a transcript. Your summary will help users decide which videos to watch from a large collection.

## Input Context
I'll provide you with a transcript summary from Whisper of a video presentation featuring an expert speaker, often with a host and a follow-up discussion.

## Output Format
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

## Style Guidelines for the Summary Field
- Use enthusiastic, dynamic language that reflects the energy of the presentation
- Highlight what's unique about the speaker's approach, perspective, or expertise
- Convey the speaker's personality and presentation style
- Include specific details and examples rather than generic descriptions
- Make the reader feel the excitement and value of the presentation
- Avoid unnecessary jargon while preserving essential technical terminology
- Aim for an engaging, conversational tone rather than a formal academic summary

Remember, your JSON response should make the presentation feel accessible and valuable while accurately representing its content and speaker's expertise. Ensure valid JSON formatting with proper quoting and escaping of special characters.

TRANSCRIPT:
{{TRANSCRIPT}}
`;
    
    // Replace the placeholder in the prompt with the sample transcript
    const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', sampleTranscript);
    
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
      console.error(`Error generating summary with Claude:`, error);
      throw error;
    }
    
    console.log("Summary generated successfully!");
    console.log("Summary:");
    console.log("------------------------");
    console.log(summaryResponse);
    
    // Save results to output file in debug-output directory
    const debugOutputDir = path.resolve(__dirname, '../debug-output');
    
    // Ensure debug output directory exists
    if (!fs.existsSync(debugOutputDir)) {
      fs.mkdirSync(debugOutputDir, { recursive: true });
    }
    
    const outputPath = path.resolve(debugOutputDir, 'test-direct-summary.json');
    fs.writeFileSync(outputPath, summaryResponse);
    console.log(`Results saved to ${outputPath}`);
    
  } catch (error) {
    console.error('Error in test script:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});