export async function loadPromptFromMarkdown(path: string): Promise<string> {
  console.log('Loading prompt from:', path);
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load prompt: ${response.statusText}`);
    const text = await response.text();
    
    console.log('Loaded prompt content:', {
      length: text.length,
      preview: text.slice(0, 100) + '...'
    });
    
    // Return the raw markdown content without any processing
    return text;
  } catch (error) {
    console.error('Error loading prompt:', error);
    throw error;
  }
} 