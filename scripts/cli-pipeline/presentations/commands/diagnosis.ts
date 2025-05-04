import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

const DOCUMENT_ID = '7487db13-5979-430d-a4f4-d7b31c3d98f6';
// Use debug-output directory for all diagnostic files
const DEBUG_OUTPUT_DIR = path.resolve(__dirname, '../debug-output');
const OUTPUT_FILE = path.resolve(DEBUG_OUTPUT_DIR, 'diagnosis-result.json');

async function diagnose() {
  // Ensure debug output directory exists
  if (!fs.existsSync(DEBUG_OUTPUT_DIR)) {
    fs.mkdirSync(DEBUG_OUTPUT_DIR, { recursive: true });
  }
  try {
    console.log('Starting diagnostic script');
    
    // Get supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    console.log('Supabase client created');
    
    // Get the document
    console.log(`Fetching document with ID: ${DOCUMENT_ID}`);
    const { data: document, error: docError } = await supabase
      .from('expert_documents')
      .select('id, raw_content, title, processed_content')
      .eq('id', DOCUMENT_ID)
      .single();
      
    if (docError || !document) {
      console.error(`Error fetching document: ${docError?.message || 'Document not found'}`);
      return;
    }
    
    console.log(`Found document with title: ${document.title || 'No title'}`);
    console.log(`Raw content length: ${document.raw_content?.length || 0} characters`);
    console.log(`Processed content: ${document.processed_content ? 'EXISTS' : 'MISSING'}`);
    
    // Save raw content to a file for inspection
    const rawContentPath = path.resolve(DEBUG_OUTPUT_DIR, 'diagnosis-raw-content.txt');
    fs.writeFileSync(rawContentPath, document.raw_content || 'No content');
    console.log(`Raw content saved to ${rawContentPath}`);
    
    if (document.processed_content) {
      const processedContentPath = path.resolve(DEBUG_OUTPUT_DIR, 'diagnosis-processed-content.txt');
      fs.writeFileSync(processedContentPath, document.processed_content);
      console.log(`Processed content saved to ${processedContentPath}`);
    }
    
    // Read prompt directly from file
    console.log('Reading video summary prompt from file...');
    const promptPath = path.resolve('/Users/raybunnage/Documents/github/dhg-mono/prompts/final_video-summary-prompt.md');
    if (fs.existsSync(promptPath)) {
      const promptTemplate = fs.readFileSync(promptPath, 'utf8');
      console.log(`Found prompt template (${promptTemplate.length} characters)`);
      
      // Save prompt to a file for inspection
      const promptCopyPath = path.resolve(DEBUG_OUTPUT_DIR, 'diagnosis-prompt.md');
      fs.writeFileSync(promptCopyPath, promptTemplate);
      console.log(`Prompt template saved to ${promptCopyPath}`);
      
      // Create the customized prompt
      const customizedPrompt = promptTemplate.replace('{{TRANSCRIPT}}', document.raw_content || '');
      console.log(`Customized prompt length: ${customizedPrompt.length} characters`);
      
      // Save customized prompt to a file
      const customizedPromptPath = path.resolve(DEBUG_OUTPUT_DIR, 'diagnosis-customized-prompt.md');
      fs.writeFileSync(customizedPromptPath, customizedPrompt);
      console.log(`Customized prompt saved to ${customizedPromptPath}`);
    } else {
      console.error(`Prompt file not found at ${promptPath}`);
    }
    
    // Now we need to create a sample output in the expected form
    const sampleOutput = {
      title: "Steering Group Discussion: Navigating Polyvagal Theory in Dynamic Healing",
      speakerProfile: {
        name: "Dynamic Healing Discussion Group",
        title: "Steering Group",
        expertise: "Collaborative expertise in polyvagal theory and its practical applications"
      },
      presentationEssence: {
        coreTopic: "Polyvagal theory in clinical practice",
        uniqueApproach: "Informal group discussion format with multiple expert perspectives",
        problemAddressed: "How to effectively integrate polyvagal theory into practice across disciplines",
        insightSummary: "Small group discussions can yield valuable insights that often don't emerge in formal presentations"
      },
      keyTakeaways: [
        "Friday small group meetings yield particularly interesting discussions worth sharing",
        "Polyvagal theory provides a framework for understanding autonomic nervous system function in clinical contexts",
        "Integrating CNS and ANS understanding is essential for comprehensive treatment approaches",
        "The sociality of the nervous system influences both pathology and healing processes"
      ],
      memorableQuotes: [
        {
          "quote": "We're going to start a little bit of a different format this time... what's been happening on Fridays are small group meets the sort of the steering group of the polyvagal thing in the dynamic hearing process.",
          "context": "Introduction explaining the informal nature of the discussion format"
        }
      ],
      discussionHighlights: {
        exchanges: "Open format discussion about clinical applications of polyvagal theory",
        challenges: "Bridging theoretical understanding with practical implementation in diverse settings",
        additionalContext: "This appears to be an introductory session establishing the format for future discussions"
      },
      whyWatch: {
        targetAudience: "Clinicians and researchers interested in practical applications of polyvagal theory",
        uniqueValue: "Rare opportunity to observe unfiltered expert discussions rather than formal presentations"
      },
      summary: "This presentation captures a special format from the Dynamic Healing Discussion Group - an informal steering group meeting where experts in polyvagal theory engage in candid conversation. Unlike formal presentations, these Friday gatherings feature the core steering team exchanging ideas about integrating polyvagal theory into clinical practice. The discussion highlights how understanding the autonomic nervous system's sociality provides crucial insights for treatment approaches. Group members explore the valuable interplay between CNS and ANS perspectives, emphasizing how these complementary viewpoints enhance therapeutic effectiveness. This video offers viewers a unique opportunity to observe how experts navigate theoretical concepts in their practical work, revealing thought processes that typically remain behind the scenes. For clinicians and researchers interested in applying polyvagal principles, this casual yet substantive exchange provides both theoretical clarification and practical implementation strategies across multiple disciplines."
    };
    
    // Save sample output to demonstrate desired format
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sampleOutput, null, 2));
    console.log(`Sample output saved to ${OUTPUT_FILE}`);
    
    console.log('\nDiagnosis complete. This diagnostic script has:');
    console.log('1. Verified that the document exists and has raw content');
    console.log('2. Saved the raw content to a file for inspection');
    console.log('3. Saved any existing processed content to a file');
    console.log('4. Read the prompt template from file directly');
    console.log('5. Created a customized prompt and saved it to a file');
    console.log('6. Created a sample output file to demonstrate the expected format');
    console.log('\nNext steps:');
    console.log(`1. Review the document content in ${DEBUG_OUTPUT_DIR}/diagnosis-raw-content.txt`);
    console.log(`2. Verify the prompt template in ${DEBUG_OUTPUT_DIR}/diagnosis-prompt.md`);
    console.log(`3. Check the customized prompt in ${DEBUG_OUTPUT_DIR}/diagnosis-customized-prompt.md`);
    console.log(`4. Use the sample output in ${DEBUG_OUTPUT_DIR}/diagnosis-result.json as a reference`);
    console.log('5. The problem appears to be in how process-mp4-files accesses the PromptQueryService');
    
  } catch (error) {
    console.error('Diagnostic error:', error);
  }
}

// Run the diagnosis
diagnose();