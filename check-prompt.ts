import { PromptQueryService } from './packages/cli/src/services/prompt-query-service';

async function main() {
  const promptService = new PromptQueryService();
  const result = await promptService.getPromptByName('final_video-summary-prompt');
  console.log('Prompt exists:', !!result);
  if (result) {
    console.log('Prompt name:', result.name);
    console.log('Prompt content preview:', result.content.substring(0, 100) + '...');
  } else {
    console.log('Creating sample prompt...');
    // This would be where we create the prompt if needed
  }
}

main().catch(console.error);