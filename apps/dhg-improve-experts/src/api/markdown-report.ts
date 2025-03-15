import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFileSync, existsSync } from 'fs';
import { markdownFileService } from '../services/markdownFileService';
// Remove the import for supabase since it's not used in this file

const execPromise = promisify(exec);

/**
 * API handler to run the markdown report script and return the results
 */
export async function generateMarkdownReport() {
  try {
    // Get the repo root directory (using process.cwd() to handle dev and production)
    const repoRoot = process.cwd();
    
    // Try multiple locations for the script
    let scriptPath = path.join(repoRoot, 'scripts', 'markdown-report.sh');
    let reportPath = path.join(repoRoot, 'docs', 'markdown-report.md');
    
    // Check if script exists at the first location
    if (!existsSync(scriptPath)) {
      // Try alternative locations
      scriptPath = path.join(repoRoot, '../..', 'scripts', 'markdown-report.sh');
      reportPath = path.join(repoRoot, '../..', 'docs', 'markdown-report.md');
    }
    
    // If script still not found, try parent directory 
    if (!existsSync(scriptPath)) {
      scriptPath = path.join(repoRoot, '..', 'scripts', 'markdown-report.sh');
      reportPath = path.join(repoRoot, '..', 'docs', 'markdown-report.md');
    }
    
    if (!existsSync(scriptPath)) {
      return {
        success: false,
        error: 'Could not find markdown-report.sh script',
        paths: {
          attemptedScriptPaths: [
            path.join(repoRoot, '../..', 'scripts', 'markdown-report.sh'),
            path.join(repoRoot, 'scripts', 'markdown-report.sh'),
            path.join(repoRoot, '..', 'scripts', 'markdown-report.sh')
          ]
        }
      };
    }
    
    console.log('Running markdown report script at:', scriptPath);
    console.log('Report will be generated at:', reportPath);
    
    // First remove any existing report file to force regeneration
    try {
      if (existsSync(reportPath)) {
        console.log('Removing existing markdown report at:', reportPath);
        await execPromise(`rm -f "${reportPath}"`);
      }
    } catch (rmError) {
      console.warn('Error removing existing report file:', rmError);
      // Continue even if removal fails
    }
    
    // Run the script
    try {
      console.log('Executing script:', scriptPath);
      const { stdout, stderr } = await execPromise(`bash ${scriptPath}`);
      
      console.log('Markdown report script stdout:', stdout);
      
      if (stderr) {
        console.error('Error running markdown report script:', stderr);
      }
    } catch (execError) {
      console.error('Exception running markdown report script:', execError);
      // Continue execution even if script fails
      // This will allow fallback to reading existing report file
    }
    
    // Try to read the report content
    try {
      const reportContent = readFileSync(reportPath, 'utf-8');
      
      // Parse the report to extract the file structure
      const fileTree = parseReportToTree(reportContent);
      
      return {
        success: true,
        message: 'Markdown report generated successfully',
        reportContent,
        fileTree
      };
    } catch (readError) {
      console.error('Error reading markdown report:', readError);
      return {
        success: false,
        error: 'Error reading markdown report',
        details: readError.message
      };
    }
  } catch (error) {
    console.error('Error in markdown report API handler:', error);
    return {
      success: false,
      error: 'Error generating markdown report',
      details: error.message
    };
  }
}

/**
 * API handler to sync documentation files to the database
 */
export async function syncDocumentationToDatabase() {
  try {
    console.log('syncDocumentationToDatabase called from markdown-report.ts');
    const result = await markdownFileService.syncDocumentationFiles();
    console.log('Result from markdownFileService.syncDocumentationFiles():', result);
    return result;
  } catch (error) {
    console.error('Error in documentation sync API handler:', error);
    return {
      success: false,
      message: `Error syncing documentation files to database: ${error.message}`,
      details: error.stack
    };
  }
}

/**
 * API handler to process the next documentation queue item
 */
export async function processNextDocumentationQueueItem() {
  try {
    const result = await markdownFileService.processNextQueueItem();
    return result;
  } catch (error) {
    console.error('Error processing documentation queue item:', error);
    return {
      success: false,
      error: 'Error processing documentation queue item',
      details: error.message
    };
  }
}

/**
 * Parse the markdown report content into a tree structure with proper nesting
 */
function parseReportToTree(reportContent) {
  // Process different sections in the report
  const sections = extractSectionsFromReport(reportContent);

  // Initialize the file tree
  const fileTree = [];
  
  // Process each section
  for (const section of sections) {
    // For root-level files section, add directly to the root
    if (section.title === "Root-Level Files") {
      // Process the table format
      const rootFiles = processRootFilesTable(section.content);
      fileTree.push(...rootFiles);
    } 
    // For hierarchical sections, process the nested format
    else if (section.title.includes("Directory") && section.title.includes("Hierarchical")) {
      const dirTree = processHierarchicalView(section.content);
      fileTree.push(...dirTree);
    }
  }
  
  return fileTree;
}

/**
 * Extract different sections from the markdown report
 */
function extractSectionsFromReport(reportContent) {
  const sections = [];
  const lines = reportContent.split('\n');
  
  let currentSection = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for section headers (## Section Title)
    if (line.startsWith('## ')) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n')
        });
      }
      
      // Start new section
      currentSection = line.substring(3).trim();
      currentContent = [];
    } 
    // Add content to current section
    else if (currentSection) {
      currentContent.push(line);
    }
  }
  
  // Add last section
  if (currentSection) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n')
    });
  }
  
  return sections;
}

/**
 * Process the root files table format
 */
function processRootFilesTable(content) {
  const items = [];
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header rows (first 2 lines are headers)
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    
    const cells = line.split('|').map(cell => cell.trim()).filter(Boolean);
    if (cells.length < 3) continue;
    
    const filename = cells[0];
    const lastModified = cells[1];
    const size = parseInt(cells[2].replace(/,/g, ''), 10) || 0;
    const isPrompt = line.includes('📜') || line.includes('PROMPT');
    
    items.push({
      id: `file_${filename}`,
      name: filename,
      type: 'file',
      path: filename,
      isPrompt,
      lastModified,
      size,
      isOpen: false
    });
  }
  
  return items;
}

/**
 * Process hierarchical view with proper nesting
 */
function processHierarchicalView(content) {
  const tree = [];
  const map = {};
  const lines = content.split('\n').filter(line => line.trim());
  
  // Regular expressions to match different line types
  const fileRegex = /^(\s*)- (📄|📜) \[(.+?)\]\(\/(.+?)\) - (.+?) \((\d+) bytes\)( \[PROMPT\])?/;
  const folderRegex = /^(\s*)- 📁 \*\*(.+?)\/\*\*/;
  
  // Mapping to track parent-child relationships based on indentation
  const levelMap = new Map();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Try to match as a file
    const fileMatch = line.match(fileRegex);
    if (fileMatch) {
      const indent = fileMatch[1] ? fileMatch[1].length : 0;
      const level = indent / 2;
      const emoji = fileMatch[2];
      const filename = fileMatch[3];
      const path = fileMatch[4];
      const lastModified = fileMatch[5];
      const size = parseInt(fileMatch[6], 10);
      const isPrompt = emoji === '📜' || !!fileMatch[7];
      
      const item = {
        id: `file_${path}`,
        name: filename,
        type: 'file',
        path,
        isPrompt,
        lastModified,
        size
      };
      
      // Add to the appropriate parent based on indentation level
      addItemWithProperNesting(tree, map, levelMap, item, level);
      continue;
    }
    
    // Try to match as a folder
    const folderMatch = line.match(folderRegex);
    if (folderMatch) {
      const indent = folderMatch[1] ? folderMatch[1].length : 0;
      const level = indent / 2;
      const folderName = folderMatch[2];
      const path = folderName;
      
      const item = {
        id: `folder_${path}`,
        name: folderName,
        type: 'folder',
        path,
        children: [],
        isOpen: true // Start with folders expanded
      };
      
      // Add to the appropriate parent based on indentation level
      addItemWithProperNesting(tree, map, levelMap, item, level);
      
      // Store in map for path-based lookups
      map[path] = item;
      continue;
    }
  }
  
  return tree;
}

/**
 * Add an item to the tree with proper nesting based on indentation level
 */
function addItemWithProperNesting(tree, map, levelMap, item, level) {
  // Level 0 items go directly into the tree
  if (level === 0) {
    tree.push(item);
    levelMap.set(0, item);
    return;
  }
  
  // For deeper levels, find the parent from the level map
  const parentLevel = level - 1;
  const parent = levelMap.get(parentLevel);
  
  if (parent && parent.type === 'folder') {
    if (!parent.children) parent.children = [];
    parent.children.push(item);
  } else {
    // Fallback: try to find parent by path
    const pathParts = item.path.split('/');
    if (pathParts.length > 1) {
      const parentPath = pathParts.slice(0, -1).join('/');
      const pathParent = map[parentPath];
      
      if (pathParent) {
        if (!pathParent.children) pathParent.children = [];
        pathParent.children.push(item);
      } else {
        // Last resort: add to root
        tree.push(item);
      }
    } else {
      // If no parent found, add to root
      tree.push(item);
    }
  }
  
  // Update the level map for this level
  levelMap.set(level, item);
}