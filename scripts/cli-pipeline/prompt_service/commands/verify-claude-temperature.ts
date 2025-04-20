import { claudeService } from '../../../../packages/shared/services/claude-service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Command to verify that Claude service is using temperature=0
 */
export async function verifyClaudeTemperatureCommand() {
  try {
    console.log('Verifying Claude service temperature settings...');
    
    // Get the Claude service source code
    const claudeServicePath = path.join(
      process.cwd(),
      'packages/shared/services/claude-service/claude-service.ts'
    );
    
    // Check if the file exists
    if (!fs.existsSync(claudeServicePath)) {
      console.error(`Claude service file not found at ${claudeServicePath}`);
      return;
    }
    
    console.log(`Reading Claude service implementation from ${claudeServicePath}`);
    const serviceCode = fs.readFileSync(claudeServicePath, 'utf8');
    
    // Check temperature settings in the service code
    const temperatureChecks = [
      {
        method: 'sendPrompt',
        regex: /const\s+temperature\s*=\s*options\.temperature\s*\?\?\s*([^;]+);/,
        found: false,
        value: null
      },
      {
        method: 'getJsonResponse',
        regex: /options\.temperature\s*=\s*options\.temperature\s*\?\?\s*([^;]+);/,
        found: false,
        value: null
      },
      {
        method: 'analyzePdfToJson',
        regex: /temperature:\s*options\.temperature\s*\?\?\s*([^,}]+)/,
        found: false,
        value: null
      },
      {
        method: 'classifyPdf',
        regex: /temperature:\s*options\.temperature\s*\?\?\s*([^,}]+)/,
        found: false,
        value: null
      }
    ];
    
    // Check each temperature setting
    let allZero = true;
    
    for (const check of temperatureChecks) {
      const match = serviceCode.match(check.regex);
      if (match) {
        check.found = true;
        check.value = match[1].trim();
        if (check.value !== '0') {
          allZero = false;
        }
      }
    }
    
    // Report findings
    console.log('\nClaude temperature settings:');
    console.log('---------------------------');
    
    for (const check of temperatureChecks) {
      if (check.found) {
        const status = check.value === '0' ? '✅ ZERO' : '❌ NON-ZERO';
        console.log(`${check.method}: ${status} (${check.value})`);
      } else {
        console.log(`${check.method}: ❓ Not found`);
      }
    }
    
    // Summary
    if (allZero) {
      console.log('\n✅ All found temperature settings are correctly set to 0');
    } else {
      console.log('\n❌ Some temperature settings are not set to 0');
      console.log('Consider updating the Claude service implementation');
    }
    
    // Make a test API call to verify runtime behavior
    console.log('\nMaking a test API call to verify runtime behavior...');
    try {
      const testResponse = await claudeService.sendPrompt(
        'Please respond with the word "test" and nothing else.',
        { maxTokens: 10 }  // Don't specify temperature to use the default
      );
      
      console.log(`Test API call completed successfully`);
      console.log(`Response: "${testResponse}"`);
      
      // We can't directly verify the temperature used, but successful completion
      // indicates the service is working with its default settings
      console.log('✅ Claude service is operational with default settings');
    } catch (apiError) {
      console.error(`❌ Test API call failed: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
    }
    
  } catch (error) {
    console.error(`Error verifying Claude temperature: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}