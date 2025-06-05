import * as path from 'path';

export interface PathUpdate {
  id: string;
  originalPath: string;
  normalizedPath: string;
}

export function normalizePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') return filePath;
  
  // Regular expression patterns to match
  const appsFolderPattern = /(?:\/|^)apps\/([^/].+)/i;
  const docsFolderPattern = /(?:\/|^)docs\/([^/].+)/i;
  const srcFolderPattern = /(?:\/|^)src\/([^/].+)/i;
  const packagesFolderPattern = /(?:\/|^)packages\/([^/].+)/i;
  
  let normalizedPath = filePath;
  
  // Match patterns for top-level folders
  let match;
  if (match = normalizedPath.match(appsFolderPattern)) {
    normalizedPath = 'apps/' + match[1];
  } else if (match = normalizedPath.match(docsFolderPattern)) {
    normalizedPath = 'docs/' + match[1];
  } else if (match = normalizedPath.match(srcFolderPattern)) {
    normalizedPath = 'src/' + match[1];
  } else if (match = normalizedPath.match(packagesFolderPattern)) {
    normalizedPath = 'packages/' + match[1];
  } else {
    // For any other paths, remove everything up to the last directory
    const parts = normalizedPath.split('/');
    const validParts = parts.filter(part => part && 
      part !== 'dhg-mono' && 
      !part.includes('Users') && 
      !part.includes('Documents') && 
      !part.includes('github')
    );
    normalizedPath = validParts.join('/');
  }
  
  // Remove any leading slash
  return normalizedPath.replace(/^\/+/, '');
} 