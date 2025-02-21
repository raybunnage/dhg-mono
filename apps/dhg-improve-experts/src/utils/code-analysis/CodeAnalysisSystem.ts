import CodeAnalysisSystem from '@/utils/code-analysis/CodeAnalysisSystem';
import fs from 'fs/promises';

async function analyzeComponent() {
  // Load the prompt template
  const promptTemplate = await fs.readFile(
    'docs/prompts/code-analysis-prompt.md', 
    'utf-8'
  );

  // Create analyzer
  const analyzer = new CodeAnalysisSystem(promptTemplate, true);

  // Analyze a file
  const analysis = await analyzer.analyzeFile({
    filePath: 'src/components/ClassifyDocument.tsx',
    content: fileContent,
    repository: 'dhg-mono',
    relativePath: 'src/components/ClassifyDocument.tsx'
  });

  console.log('Analysis:', analysis);
}