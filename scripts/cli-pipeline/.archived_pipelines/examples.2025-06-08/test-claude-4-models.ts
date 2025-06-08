#!/usr/bin/env ts-node

/**
 * Test script to check Claude 4.0 model availability
 */

import { claudeService } from '../../../packages/shared/services/claude-service/claude-service';

async function testClaudeModels() {
  console.log('🧪 Testing Claude 4.0 Model Availability...\n');

  const testPrompt = "Hello! What model are you? Please respond with just your model name and version.";
  
  const modelsToTest = [
    // Try various Claude 4.0 possibilities
    'claude-4-sonnet-20250522',
    'claude-4-opus-20250522',
    'claude-4.0-sonnet-20250522',
    'claude-4.0-opus-20250522',
    'claude-4-20250522',
    'claude-4.0-20250522',
    'claude-4-sonnet',
    'claude-4-opus',
    'claude-4.0-sonnet',
    'claude-4.0-opus',
    'claude-4',
    'claude-4.0',
    // Maybe they use "next" or "latest"
    'claude-sonnet-next',
    'claude-opus-next',
    'claude-latest',
    // Working models
    'claude-3-7-sonnet-20250219',
    'claude-3-5-sonnet-20241022',
    'claude-3-opus-20240229'
  ];

  for (const model of modelsToTest) {
    try {
      console.log(`Testing model: ${model}`);
      const response = await claudeService.sendPrompt(testPrompt, { 
        model,
        maxTokens: 100 
      });
      console.log(`✅ ${model}: ${response.trim()}\n`);
    } catch (error) {
      if (error instanceof Error) {
        console.log(`❌ ${model}: ${error.message}\n`);
      } else {
        console.log(`❌ ${model}: Unknown error\n`);
      }
    }
  }
}

if (require.main === module) {
  testClaudeModels().catch(console.error);
}

export default testClaudeModels;