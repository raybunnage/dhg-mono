#!/usr/bin/env ts-node
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function updateToTemplate() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Usage: update-template <document.md>');
    console.log('   Example: update-template my-doc.md');
    process.exit(1);
  }
  
  const docName = args[0];
  const docsPath = join(process.cwd(), 'docs', 'living-docs');
  const docPath = join(docsPath, docName);
  const templatePath = join(docsPath, 'TEMPLATE-GUIDE.md');
  
  console.log(`📝 Updating ${docName} to latest template...`);
  
  try {
    // Read current document
    const currentContent = await readFile(docPath, 'utf-8');
    
    // Read template
    let template: string;
    try {
      template = await readFile(templatePath, 'utf-8');
    } catch {
      console.log('⚠️  Template not found, creating basic structure...');
      template = `# Document Title

## Metadata
- **Last Updated**: ${new Date().toISOString().split('T')[0]}
- **Next Review**: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
- **Status**: Active
- **Priority**: Medium
- **Category**: Documentation

## Phase 1: Quick Assessment
- **Priority**: Medium
- **Summary**: Brief description of the document's purpose
- **Value**: What value does this provide
- **Effort**: Implementation effort required
- **Risks**: Potential risks or challenges

## Content

[Document content goes here]

## Implementation Notes

[Implementation details and notes]
`;
    }
    
    // Extract main content (everything after the first # line)
    const contentMatch = currentContent.match(/^#\s+(.+)\n([\s\S]*)/);
    const title = contentMatch ? contentMatch[1] : docName.replace('.md', '');
    const existingContent = contentMatch ? contentMatch[2] : currentContent;
    
    // Create updated document with template structure
    const updatedDoc = template
      .replace('Document Title', title)
      .replace('[Document content goes here]', existingContent.trim())
      .replace('Medium', 'Medium') // Keep existing priority if we can extract it
      .replace('Documentation', 'Documentation'); // Keep existing category if we can extract it
    
    // Write updated document
    await writeFile(docPath, updatedDoc);
    
    console.log('✅ Document updated successfully!');
    console.log(`   File: ${docPath}`);
    console.log('   Added template structure with metadata section');
    
  } catch (error) {
    console.error('❌ Error updating document:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  updateToTemplate();
}