import express from 'express';
import { ProxyServerBase } from '../../base/ProxyServerBase';
import { FileBrowserService } from '../../../shared/services/file-browser/FileBrowserService';

export class FileBrowserProxy extends ProxyServerBase {
  private fileBrowser: FileBrowserService;

  constructor() {
    super('FileBrowserProxy', 9880);
    this.fileBrowser = new FileBrowserService();
  }

  protected setupRoutes(): void {
    // Serve static HTML file
    this.app.use(express.static('html'));

    // List directory contents
    this.app.post('/api/list-directory', async (req, res) => {
      try {
        const { dirPath = '' } = req.body;
        const items = await this.fileBrowser.listDirectory({ dirPath });
        res.json(items);
      } catch (error: any) {
        this.logger.error('Error listing directory:', error);
        res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
          error: error.message 
        });
      }
    });

    // Read file content
    this.app.post('/api/read-file', async (req, res) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }
        const content = await this.fileBrowser.readFile(filePath);
        res.json({ content });
      } catch (error: any) {
        this.logger.error('Error reading file:', error);
        res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
          error: error.message 
        });
      }
    });

    // Search files
    this.app.post('/api/search-files', async (req, res) => {
      try {
        const { searchTerm, searchPath = '' } = req.body;
        if (!searchTerm) {
          return res.status(400).json({ error: 'searchTerm is required' });
        }
        const results = await this.fileBrowser.searchFiles({ 
          searchTerm, 
          searchPath,
          maxResults: 100 
        });
        res.json(results);
      } catch (error: any) {
        this.logger.error('Error searching files:', error);
        res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
          error: error.message 
        });
      }
    });

    // Get file/directory stats
    this.app.post('/api/file-stats', async (req, res) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }
        const stats = await this.fileBrowser.getPathStats(filePath);
        res.json({
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          mtime: stats.mtime,
          ctime: stats.ctime,
          atime: stats.atime
        });
      } catch (error: any) {
        this.logger.error('Error getting file stats:', error);
        res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
          error: error.message 
        });
      }
    });

    // Check if path exists
    this.app.post('/api/path-exists', async (req, res) => {
      try {
        const { filePath } = req.body;
        if (!filePath) {
          return res.status(400).json({ error: 'filePath is required' });
        }
        const exists = await this.fileBrowser.pathExists(filePath);
        res.json({ exists });
      } catch (error: any) {
        this.logger.error('Error checking path:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  protected getServiceDescription(): string {
    return 'File browser service for exploring repository structure';
  }
}