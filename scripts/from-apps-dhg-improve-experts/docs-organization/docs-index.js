/**
 * Script to generate a documentation index file that maps docs to projects
 * This index can be used by the dashboard to filter and organize docs
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

// Configuration
const MONO_ROOT = '/Users/raybunnage/Documents/github/dhg-mono';
const APPS_ROOT = path.join(MONO_ROOT, 'apps');
const OUTPUT_FILE = path.join(MONO_ROOT, 'docs', 'docs-index.json');

// Create docs directory if it doesn't exist
if (!fs.existsSync(path.join(MONO_ROOT, 'docs'))) {
  fs.mkdirSync(path.join(MONO_ROOT, 'docs'), { recursive: true });
}

// Get all apps in the monorepo
const apps = fs.readdirSync(APPS_ROOT)
  .filter(dir => fs.statSync(path.join(APPS_ROOT, dir)).isDirectory());

console.log(`Found ${apps.length} apps in the monorepo`);

// Initialize index
const docsIndex = {
  lastUpdated: new Date().toISOString(),
  docs: []
};

// Process each app
apps.forEach(app => {
  const appPath = path.join(APPS_ROOT, app);
  
  // Find all markdown files in the app
  findMarkdownFiles(appPath, app);
});

// Find markdown files in a directory
function findMarkdownFiles(dir, app, basePath = '') {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    // Skip node_modules, hidden folders, dist, build, and coverage
    if (item === 'node_modules' || 
        item.startsWith('.') || 
        item === 'dist' || 
        item === 'build' || 
        item === 'coverage') {
      return;
    }
    
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);
    
    // Skip prompts folders
    if (itemPath.includes('/prompts/')) {
      return;
    }
    
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      findMarkdownFiles(itemPath, app, path.join(basePath, item));
    } else if (item.endsWith('.md')) {
      // Process markdown file
      processMarkdownFile(itemPath, app, path.join(basePath, item));
    }
  });
}

// Process a markdown file
function processMarkdownFile(filePath, app, relativePath) {
  try {
    // Read the file content
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Parse frontmatter
    const { data, content: fileContent } = matter(content);
    
    // Extract title from frontmatter or filename
    const title = data.title || path.basename(filePath, '.md');
    
    // Extract description
    const description = data.description || extractDescription(fileContent);
    
    // Create document entry
    const docEntry = {
      title,
      path: filePath,
      relativePath,
      app,
      description,
      category: data.category || 'uncategorized',
      status: data.status || 'active',
      lastModified: fs.statSync(filePath).mtime.toISOString(),
      frontmatter: data
    };
    
    // Add to index
    docsIndex.docs.push(docEntry);
    console.log(`Added ${relativePath} to index`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Extract description from content (first paragraph)
function extractDescription(content) {
  const firstParagraph = content.trim().split('\n\n')[0];
  return firstParagraph
    .replace(/^#+ /, '') // Remove heading markers
    .replace(/\n/g, ' ')  // Replace newlines with spaces
    .trim();
}

// Write the index file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(docsIndex, null, 2));
console.log(`Documentation index created at ${OUTPUT_FILE}`);
console.log(`Total documents indexed: ${docsIndex.docs.length}`);

// Output summary
const categoryCounts = {};
docsIndex.docs.forEach(doc => {
  categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
});

console.log('Documents by category:');
Object.entries(categoryCounts).forEach(([category, count]) => {
  console.log(`  ${category}: ${count}`);
});