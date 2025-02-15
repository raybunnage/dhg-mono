export const loadPromptFromMarkdown = async (promptPath: string) => {
  try {
    const response = await fetch(promptPath);
    if (!response.ok) {
      throw new Error(`Failed to load prompt from ${promptPath}`);
    }
    const markdown = await response.text();
    return markdown;
  } catch (error) {
    console.error('Error loading prompt:', error);
    throw error;
  }
}; 