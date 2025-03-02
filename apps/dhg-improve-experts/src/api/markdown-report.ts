import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

const execPromise = promisify(exec);

/**
 * API handler to run the markdown report script and return the results
 */
export async function generateMarkdownReport() {
  try {
    // Get the repo root directory (using process.cwd() to handle dev and production)
    const repoRoot = process.cwd();
    
    // Try multiple locations for the script
    let scriptPath = path.join(repoRoot, '../..', 'scripts', 'markdown-report.sh');
    let reportPath = path.join(repoRoot, '../..', 'docs', 'markdown-report.md');
    
    // Check if script exists at the first location
    if (!existsSync(scriptPath)) {
      // Try alternative location (project root)
      scriptPath = path.join(repoRoot, 'scripts', 'markdown-report.sh');
      reportPath = path.join(repoRoot, 'docs', 'markdown-report.md');
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
    
    // Run the script
    const { stdout, stderr } = await execPromise(`bash ${scriptPath}`);
    
    if (stderr) {
      console.error('Error running markdown report script:', stderr);
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
 * Parse the markdown report content into a tree structure
 */
function parseReportToTree(reportContent) {
  const fileTree = [];
  const map = {};
  
  // Extract sections from the report
  const sections = [];
  
  // Regex to find hierarchical entries with emoji markers
  const fileRegex = /- (📄|📜) \[(.+?)\]\(\/(.+?)\) - (.+?) \((\d+) bytes\)( \[PROMPT\])?/g;
  const folderRegex = /- 📁 \*\*(.+?)\/\*\*/g;
  const indentPattern = /^(\s*)-/;
  
  // Process each line
  const lines = reportContent.split('\n');
  let currentIndentLevel = 0;
  let currentParent = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for file entries
    const fileMatch = fileRegex.exec(line);
    if (fileMatch) {
      fileRegex.lastIndex = 0; // Reset regex index
      
      const emoji = fileMatch[1];
      const name = fileMatch[2];
      const path = fileMatch[3];
      const lastModified = fileMatch[4];
      const size = parseInt(fileMatch[5], 10);
      const isPrompt = emoji === '📜' || !!fileMatch[6];
      
      const indent = line.match(indentPattern);
      const indentLevel = indent ? indent[1].length / 2 : 0;
      
      const fileItem = {
        id: `file_${path}`,
        name,
        type: 'file',
        path,
        isPrompt,
        lastModified,
        size
      };
      
      // Add to tree based on indent level
      addToTree(fileTree, map, fileItem, indentLevel);
      
      continue;
    }
    
    // Check for folder entries
    const folderMatch = folderRegex.exec(line);
    if (folderMatch) {
      folderRegex.lastIndex = 0; // Reset regex index
      
      const name = folderMatch[1];
      const path = name;
      
      const indent = line.match(indentPattern);
      const indentLevel = indent ? indent[1].length / 2 : 0;
      
      const folderItem = {
        id: `folder_${path}`,
        name,
        type: 'folder',
        path,
        children: [],
        isOpen: false
      };
      
      // Add to tree based on indent level
      addToTree(fileTree, map, folderItem, indentLevel);
      
      continue;
    }
  }
  
  return fileTree;
}

/**
 * Helper function to add an item to the tree at the correct level
 */
function addToTree(tree, map, item, level) {
  if (level === 0) {
    // Root level item
    tree.push(item);
    if (item.type === 'folder') {
      map[item.path] = item;
    }
  } else {
    // Find parent at the right level
    const parts = item.path.split('/');
    const parentPath = parts.slice(0, -1).join('/');
    
    if (map[parentPath]) {
      const parent = map[parentPath];
      if (!parent.children) parent.children = [];
      parent.children.push(item);
      
      if (item.type === 'folder') {
        map[item.path] = item;
      }
    } else {
      // If parent not found, add to root as fallback
      tree.push(item);
      if (item.type === 'folder') {
        map[item.path] = item;
      }
    }
  }
}