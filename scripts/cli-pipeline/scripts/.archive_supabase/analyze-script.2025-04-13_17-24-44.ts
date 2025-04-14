import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { IncomingMessage } from 'http';

// Get script file path from command line arguments
const scriptPath: string = process.argv[2];

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
  summary?: Record<string, any>;
  tags?: string[];
  assessment?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  messages: ClaudeMessage[];
}

interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  [key: string]: any;
}

// Handle multiple possible Claude API key environment variables
function getClaudeApiKey(): string {
  // Check all possible environment variables where API key might be stored
  const possibleEnvVars = [
    'CLAUDE_API_KEY',
    'CLI_CLAUDE_API_KEY',
    'ANTHROPIC_API_KEY',
    'VITE_ANTHROPIC_API_KEY'
  ];
  
  // Log available environment variables for debugging
  console.log('🔍 Looking for Claude API key in environment variables:');
  for (const envVar of possibleEnvVars) {
    const isSet = !!process.env[envVar];
    console.log(`- ${envVar}: ${isSet ? 'set' : 'not set'}${isSet ? ' (length: ' + process.env[envVar]!.length + ')' : ''}`);
  }
  
  // Find the first environment variable that has a value
  for (const envVar of possibleEnvVars) {
    if (process.env[envVar]) {
      console.log(`✅ Using ${envVar} for Claude API key`);
      return process.env[envVar] || '';
    }
  }
  
  // No API key found
  console.error('❌ No Claude API key found in any environment variable');
  return '';
}

async function classifyScript(): Promise<void> {
  try {
    // Initialize Supabase client
    const supabaseUrl: string = process.env.SUPABASE_URL || '';
    const supabaseKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const claudeApiKey: string = getClaudeApiKey();
    
    // Log whether we have the necessary credentials
    console.log('🔑 Checking credentials:');
    console.log(`- Supabase URL: ${supabaseUrl ? '✅ Found' : '❌ Missing'}`);
    console.log(`- Supabase Key: ${supabaseKey ? '✅ Found' : '❌ Missing'}`);
    console.log(`- Claude API Key: ${claudeApiKey ? '✅ Found' : '❌ Missing'}`);
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing Supabase credentials');
      process.exit(1);
    }
    
    if (!claudeApiKey) {
      console.error('❌ Missing Claude API key - please set one of the following environment variables: CLAUDE_API_KEY, CLI_CLAUDE_API_KEY, ANTHROPIC_API_KEY');
      process.exit(1);
    }
    
    if (!scriptPath) {
      console.error('❌ Missing script path. Usage: ts-node analyze-script.ts <path-to-script>');
      process.exit(1);
    }
    
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);
    
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
    
    const prompt: Prompt = promptData as Prompt;
    console.log('Retrieved script analysis prompt from database');
    
    // Step 2: Read the script file content
    console.log(`Attempting to read script file: ${scriptPath}`);
    if (!fs.existsSync(scriptPath)) {
      console.error(`Script file not found: ${scriptPath}`);
      process.exit(1);
    }
    
    try {
      const scriptContent: string = fs.readFileSync(scriptPath, 'utf8');
      console.log(`✅ Successfully read script file (${scriptContent.length} bytes)`);
      console.log(`Script begins with: ${scriptContent.substring(0, 50)}...`);
    } catch (readError) {
      console.error(`Error reading script file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
      process.exit(1);
    }
    
    const scriptContent: string = fs.readFileSync(scriptPath, 'utf8');
    
    // Step 3: Create a modified prompt that adds the script content and file path
    console.log('Creating prompt with script content and path added...');
    
    // Add our own sections to the prompt rather than looking for placeholders
    let finalPrompt: string = prompt.content + `\n\n## Script to Analyze\n\nFile Path: ${scriptPath}\n\n` +
      "```\n" + scriptContent + "\n```\n";
    
    // Debug info about the prompt
    console.log(`Prompt length: ${finalPrompt.length} characters`);
    console.log(`Prompt contains script content: ${finalPrompt.includes(scriptContent.substring(0, 20))}`);
    console.log(`Prompt contains file path: ${finalPrompt.includes(scriptPath)}`);
    
    // Write the prompt to a file for debugging
    const debugDir = path.join(path.dirname(scriptPath), 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, 'last-prompt.txt');
    fs.writeFileSync(debugFile, finalPrompt, 'utf8');
    console.log(`Wrote prompt to ${debugFile} for debugging`);
    
    // Step 4: Call Claude API to analyze the script
    console.log('Calling Claude API for script classification...');
    
    const claudeRequest: ClaudeRequest = {
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
    };
    
    const requestData: string = JSON.stringify(claudeRequest);
    
    const options: https.RequestOptions = {
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
    const req: http.ClientRequest = https.request(options, (res: IncomingMessage) => {
      let responseData: string = '';
      
      res.on('data', (chunk: Buffer) => {
        responseData += chunk.toString();
      });
      
      res.on('end', () => {
        try {
          const response: ClaudeResponse = JSON.parse(responseData);
          
          if (response && response.content) {
            const assistantMessage = response.content;
            if (assistantMessage && assistantMessage[0] && assistantMessage[0].text) {
              // Extract JSON from response
              const responseText: string = assistantMessage[0].text;
              const jsonMatch: RegExpMatchArray | null = responseText.match(/```json([\s\S]*?)```/);
              
              if (jsonMatch && jsonMatch[1]) {
                const jsonStr: string = jsonMatch[1].trim();
                const parsedResult: Classification = JSON.parse(jsonStr);
                console.log(JSON.stringify(parsedResult, null, 2));
                
                // Save the result to database
                saveClassificationToDatabase(supabase, scriptPath, parsedResult);
              } else {
                // Try to find any JSON in the response
                try {
                  const jsonStart: number = responseText.indexOf('{');
                  const jsonEnd: number = responseText.lastIndexOf('}');
                  
                  if (jsonStart >= 0 && jsonEnd > jsonStart) {
                    const jsonSubstring: string = responseText.substring(jsonStart, jsonEnd + 1);
                    const parsedResult: Classification = JSON.parse(jsonSubstring);
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
    
    req.on('error', (error: Error) => {
      console.error('Error calling Claude API:', error);
      process.exit(1);
    });
    
    req.write(requestData);
    req.end();
    
  } catch (error) {
    console.error('Error in script classification:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

interface ExistingScript {
  id: string;
  file_path: string;
}

async function saveClassificationToDatabase(
  supabase: SupabaseClient, 
  scriptPath: string, 
  classification: Classification
): Promise<void> {
  try {
    // Find or create script record in database
    const { data: existingScript, error: queryError } = await supabase
      .from('scripts')
      .select('id, file_path')
      .eq('file_path', scriptPath)
      .maybeSingle();
    
    if (queryError) {
      console.error('Error querying database:', queryError.message);
      return;
    }
    
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
        console.error('Error updating script classification:', error.message);
      } else {
        console.log('Successfully updated script classification in database');
      }
    } else {
      console.log('Script not found in database. It will be added during the next sync operation.');
    }
  } catch (error) {
    console.error('Error saving classification to database:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run the script
classifyScript();