import { claudeService } from '../../../../packages/shared/services/claude-service/claude-service';
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
    interface TemperatureCheck {
      method: string;
      regex: RegExp;
      found: boolean;
      value?: string;
    }
    
    const temperatureChecks: TemperatureCheck[] = [
      {
        method: 'sendPrompt',
        regex: /const\s+temperature\s*=\s*options\.temperature\s*\?\?\s*([^;]+);/,
        found: false
      },
      {
        method: 'getJsonResponse',
        regex: /options\.temperature\s*=\s*([^;]+);/,
        found: false
      },
      {
        method: 'analyzePdfToJson', 
        regex: /options\.temperature\s*=\s*([^;]+);/,
        found: false
      },
      {
        method: 'classifyPdf',
        regex: /temperature:\s*([^,}]+)/,
        found: false
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
    
    // Check for specific classifyPdf implementation
    const classifyPdfImplementation = serviceCode.includes('temperature: 0 // Always use temperature 0 for classifications');
    
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
    
    // Report special case for classifyPdf which might not be detected by regex
    if (classifyPdfImplementation) {
      console.log(`classifyPdf: ✅ ZERO (hardcoded to 0 in implementation)`);
    }
    
    // Summary
    if (allZero && classifyPdfImplementation) {
      console.log('\n✅ All temperature settings are correctly set to 0');
    } else {
      console.log('\n❌ Some temperature settings may not be set to 0');
      console.log('Consider updating the Claude service implementation to ensure consistency');
    }
    
    // Make a test API call to verify runtime behavior
    console.log('\nMaking a test API call to verify runtime behavior...');
    try {
      // Get the Claude service instance
      const claudeService = ClaudeService.getInstance();
      
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