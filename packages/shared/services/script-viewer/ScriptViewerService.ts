import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface ScriptFile {
  file_path: string;
  title: string;
  content: string;
  size: number;
  created_at: Date;
  updated_at: Date;
}

export interface ScriptListResult {
  total: number;
  files: string[];
}

export class ScriptViewerService {
  private static instance: ScriptViewerService;
  private projectRoot: string;
  private archivedFolder = '.archived_scripts';
  private allowedExtensions = ['.sh', '.js', '.ts', '.py'];

  private constructor() {
    // Default to project root (4 levels up from this service)
    this.projectRoot = path.resolve(__dirname, '../../../..');
  }

  static getInstance(): ScriptViewerService {
    if (!ScriptViewerService.instance) {
      ScriptViewerService.instance = new ScriptViewerService();
    }
    return ScriptViewerService.instance;
  }

  /**
   * Configure the service
   */
  configure(options: { projectRoot?: string }) {
    if (options.projectRoot) {
      this.projectRoot = path.resolve(options.projectRoot);
    }
  }

  /**
   * Validate file extension
   */
  private validateExtension(filePath: string): boolean {
    return this.allowedExtensions.some(ext => filePath.endsWith(ext));
  }

  /**
   * Get script file content
   */
  async getScriptFile(filePath: string): Promise<ScriptFile> {
    const normalizedPath = path.normalize(filePath);
    
    // Validate extension
    if (!this.validateExtension(normalizedPath)) {
      throw new Error(`Only script files allowed (${this.allowedExtensions.join(', ')})`);
    }
    
    // Try multiple locations
    const possiblePaths = [
      path.join(this.projectRoot, normalizedPath),
      path.join(this.projectRoot, 'scripts', normalizedPath),
      path.join(this.projectRoot, 'scripts/cli-pipeline', normalizedPath)
    ];
    
    // Try to find the file
    for (const tryPath of possiblePaths) {
      try {
        if (fs.existsSync(tryPath)) {
          const content = fs.readFileSync(tryPath, 'utf8');
          const fileName = path.basename(tryPath);
          const stats = fs.statSync(tryPath);
          
          return {
            file_path: normalizedPath,
            title: fileName,
            content,
            size: stats.size,
            created_at: stats.birthtime,
            updated_at: stats.mtime
          };
        }
      } catch (error) {
        console.error(`Error reading ${tryPath}:`, error);
      }
    }
    
    throw new Error(`File not found: ${normalizedPath}`);
  }

  /**
   * List all script files
   */
  async listScriptFiles(): Promise<ScriptListResult> {
    try {
      // Build find command with exclusions
      const scriptPath = path.join(this.projectRoot, 'scripts');
      const extensions = this.allowedExtensions.map(ext => `-name "*${ext}"`).join(' -o ');
      const cmd = `find ${scriptPath} \\( ${extensions} \\) -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/${this.archivedFolder}/*" | head -100`;
      
      console.log(`Executing find command: ${cmd}`);
      
      const output = execSync(cmd, { encoding: 'utf8' }).trim();
      const files = output.split('\n').filter(Boolean);
      
      // Normalize paths
      const relativePaths = files.map(f => f.replace(this.projectRoot + '/', ''));
      
      return {
        total: relativePaths.length,
        files: relativePaths
      };
    } catch (error: any) {
      console.error('Error listing script files:', error);
      throw new Error(`Error listing script files: ${error.message}`);
    }
  }

  /**
   * Archive a script file
   */
  async archiveScriptFile(filePath: string): Promise<{
    success: boolean;
    originalPath: string;
    archivedPath: string;
  }> {
    const normalizedPath = path.normalize(filePath);
    
    // Validate extension
    if (!this.validateExtension(normalizedPath)) {
      throw new Error(`Only script files allowed (${this.allowedExtensions.join(', ')})`);
    }
    
    // Try multiple locations
    const possiblePaths = [
      path.join(this.projectRoot, normalizedPath),
      path.join(this.projectRoot, 'scripts', normalizedPath),
      path.join(this.projectRoot, 'scripts/cli-pipeline', normalizedPath)
    ];
    
    // Try to find and archive the file
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        console.log(`Found file to archive: ${tryPath}`);
        
        // Create archive directory path based on the original location
        const originalDirname = path.dirname(tryPath);
        const archiveDirPath = path.join(originalDirname, this.archivedFolder);
        
        // Make sure the archive directory exists
        if (!fs.existsSync(archiveDirPath)) {
          fs.mkdirSync(archiveDirPath, { recursive: true });
          console.log(`Created archive directory: ${archiveDirPath}`);
        }
        
        // Create the new path for the archived file
        const filename = path.basename(tryPath);
        const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const archivedFilename = `${path.parse(filename).name}.${timestamp}${path.extname(filename)}`;
        const archivedFilePath = path.join(archiveDirPath, archivedFilename);
        
        // Move the file to the archived location
        fs.renameSync(tryPath, archivedFilePath);
        
        // Generate the new path for database update (relative to project root)
        const relativeNewPath = path.relative(this.projectRoot, archivedFilePath);
        
        return {
          success: true,
          originalPath: normalizedPath,
          archivedPath: relativeNewPath
        };
      }
    }
    
    throw new Error(`File not found: ${normalizedPath}`);
  }

  /**
   * Delete a script file (permanent deletion)
   */
  async deleteScriptFile(filePath: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const normalizedPath = path.normalize(filePath);
    
    // Validate extension
    if (!this.validateExtension(normalizedPath)) {
      throw new Error(`Only script files allowed (${this.allowedExtensions.join(', ')})`);
    }
    
    // Try multiple locations
    const possiblePaths = [
      path.join(this.projectRoot, normalizedPath),
      path.join(this.projectRoot, 'scripts', normalizedPath),
      path.join(this.projectRoot, 'scripts/cli-pipeline', normalizedPath)
    ];
    
    // Try to find and delete the file
    for (const tryPath of possiblePaths) {
      if (fs.existsSync(tryPath)) {
        console.log(`Found file to delete: ${tryPath}`);
        
        // Delete the file
        fs.unlinkSync(tryPath);
        
        return {
          success: true,
          message: `Script file deleted: ${normalizedPath}`
        };
      }
    }
    
    throw new Error(`File not found: ${normalizedPath}`);
  }
}