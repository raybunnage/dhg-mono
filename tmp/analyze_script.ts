import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

// Get script file path from command line arguments
const scriptPath = process.argv[2];

interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

interface Classification {
  script_type_id?: string;
  summary?: any;
  tags?: string[];
  assessment?: any;
  metadata?: Record<string, any>;
}

async function classifyScript() {
  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const claudeApiKey = process.env.CLAUDE_API_KEY || '';
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      process.exit(1);
    }
    
    if (!claudeApiKey) {
      console.error('Missing Claude API key');
      process.exit(1);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Step 1: Get the script-analysis-prompt from database
    const { data: promptData, error: promptError } = await supabase
      .from('prompts')
      .select('*')
      .eq('name', 'script-analysis-prompt')
      .single();
      
    if (promptError || !promptData) {
      console.error('Error fetching script analysis prompt:', promptError?.message || 'No prompt found');
      process.exit(1);
    }
    
    const prompt = promptData as Prompt;
    console.log('Retrieved script analysis prompt from database');
    
    // Step 2: Read the script file content
    if (!fs.existsSync(scriptPath)) {
      console.error(`Script file not found: ${scriptPath}`);
      process.exit(1);
    }
    
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // Step 3: Replace placeholders in the prompt
    let finalPrompt = prompt.content
      .replace('{{SCRIPT_CONTENT}}', scriptContent)
      .replace('{{FILE_PATH}}', scriptPath);
    
    // Step 4: Call Claude API to analyze the script
    console.log('Calling Claude API for script classification...');
    
    const requestData = JSON.stringify({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: finalPrompt
            }
          ]
        }
      ]
    });
    
    const options = {
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(requestData)
      }
    };
    
    // Make the API request
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          
          if (response && response.content) {
            const assistantMessage = response.content;
            if (assistantMessage && assistantMessage[0] && assistantMessage[0].text) {
              // Extract JSON from response
              const responseText = assistantMessage[0].text;
              const jsonMatch = responseText.match(/```json([\s\S]*?)```/);
              
              if (jsonMatch && jsonMatch[1]) {
                const jsonStr = jsonMatch[1].trim();
                const parsedResult = JSON.parse(jsonStr);
                console.log(JSON.stringify(parsedResult, null, 2));
                
                // Save the result to database
                saveClassificationToDatabase(supabase, scriptPath, parsedResult);
              } else {
                // Try to find any JSON in the response
                try {
                  const jsonStart = responseText.indexOf('{');
                  const jsonEnd = responseText.lastIndexOf('}');
                  
                  if (jsonStart >= 0 && jsonEnd > jsonStart) {
                    const jsonSubstring = responseText.substring(jsonStart, jsonEnd + 1);
                    const parsedResult = JSON.parse(jsonSubstring);
                    console.log(JSON.stringify(parsedResult, null, 2));
                    
                    // Save the result to database
                    saveClassificationToDatabase(supabase, scriptPath, parsedResult);
                  } else {
                    console.error('Could not find JSON in Claude response');
                    console.log(responseText);
                    process.exit(1);
                  }
                } catch (e) {
                  console.error('Failed to find JSON in response:', e);
                  process.exit(1);
                }
              }
            } else {
              console.error('Invalid response format from Claude API');
              process.exit(1);
            }
          } else {
            console.error('Claude API call failed: Invalid response format');
            process.exit(1);
          }
        } catch (error) {
          console.error('Error parsing Claude API response:', error);
          process.exit(1);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Error calling Claude API:', error);
      process.exit(1);
    });
    
    req.write(requestData);
    req.end();
    
  } catch (error) {
    console.error('Error in script classification:', error);
    process.exit(1);
  }
}

async function saveClassificationToDatabase(supabase: any, scriptPath: string, classification: Classification) {
  try {
    // Find or create script record in database
    const { data: existingScript } = await supabase
      .from('scripts')
      .select('id, file_path')
      .eq('file_path', scriptPath)
      .maybeSingle();
    
    if (existingScript) {
      // Update existing script
      const { error } = await supabase
        .from('scripts')
        .update({
          script_type_id: classification.script_type_id || null,
          summary: classification.summary || null,
          ai_generated_tags: classification.tags || [],
          ai_assessment: classification.assessment || null,
          metadata: classification.metadata || {},
          updated_at: new Date().toISOString()
        })
        .eq('id', existingScript.id);
      
      if (error) {
        console.error('Error updating script classification:', error);
      } else {
        console.log('Successfully updated script classification in database');
      }
    }
    // If script doesn't exist, the sync_scripts function will add it
  } catch (error) {
    console.error('Error saving classification to database:', error);
  }
}

// Run the script
classifyScript();