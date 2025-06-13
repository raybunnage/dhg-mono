/**
 * Document Service Tests
 * 
 * Unit tests for the document service
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as path from 'path';

// Mock shared services
jest.mock('../../shared/services/database-service', () => ({
  databaseService: {
    testConnection: jest.fn(),
    getRecords: jest.fn(),
    updateRecords: jest.fn(),
    deleteRecords: jest.fn(),
    insertRecords: jest.fn()
  }
}));

jest.mock('../../shared/file-service', () => ({
  fileService: {
    createDirectoryIfNeeded: jest.fn(),
    getFileMetadata: jest.fn(),
    findDocumentationFiles: jest.fn(),
    readFileContent: jest.fn()
  }
}));

jest.mock('../../shared/services/logger-service', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../shared/services/environment-service', () => ({
  environmentService: {
    getConfig: jest.fn().mockReturnValue({
      rootDir: '/test/root',
      claudeApiKey: 'test-claude-key'
    }),
    get: jest.fn()
  }
}));

jest.mock('../../../../packages/shared/services/claude-service', () => ({
  claudeService: {
    validateApiKey: jest.fn(),
    getJsonResponse: jest.fn()
  }
}));

// Import the document service (after mocks)
import { documentService } from '../services/document-service';
import { databaseService } from '../../shared/services/database-service';
import { fileService } from '../../shared/file-service';
import { nodeLogger as logger } from '@shared/services/logger/logger-node';
import { claudeService } from '../../../../packages/shared/services/claude-service';

describe('DocumentService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });
  
  describe('testConnection', () => {
    it('should return true when database connection succeeds', async () => {
      // Mock successful connection
      (databaseService.testConnection as jest.Mock).mockResolvedValue({ success: true });
      
      // Call the method
      const result = await documentService.testConnection();
      
      // Verify results
      expect(result).toBe(true);
      expect(databaseService.testConnection).toHaveBeenCalled();
    });
    
    it('should return false when database connection fails', async () => {
      // Mock failed connection
      (databaseService.testConnection as jest.Mock).mockResolvedValue({ 
        success: false, 
        error: 'Connection error' 
      });
      
      // Call the method
      const result = await documentService.testConnection();
      
      // Verify results
      expect(result).toBe(false);
      expect(databaseService.testConnection).toHaveBeenCalled();
    });
  });
  
  describe('syncFiles', () => {
    it('should sync files successfully', async () => {
      // Mock database records
      (databaseService.getRecords as jest.Mock).mockResolvedValue({
        data: [
          { id: 'file1', file_path: 'path/to/file1.md', file_hash: 'hash1' },
          { id: 'file2', file_path: 'path/to/file2.md', file_hash: 'hash2' }
        ],
        error: null
      });
      
      // Mock file metadata for existing files
      (fileService.getFileMetadata as jest.Mock).mockImplementation((path) => {
        if (path.includes('file1')) {
          return { path: 'path/to/file1.md', file_size: 100, mtime: new Date(), hash: 'hash1' };
        } else if (path.includes('file2')) {
          return { path: 'path/to/file2.md', file_size: 200, mtime: new Date(), hash: 'newhash2' };
        }
        return null;
      });
      
      // Mock update records
      (databaseService.updateRecords as jest.Mock).mockResolvedValue({
        data: null,
        error: null
      });
      
      // Call the method
      const result = await documentService.syncFiles();
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.existCount).toBe(2);
      expect(result.updatedCount).toBe(1); // One file has a new hash
      expect(databaseService.getRecords).toHaveBeenCalled();
      expect(fileService.getFileMetadata).toHaveBeenCalledTimes(2);
      expect(databaseService.updateRecords).toHaveBeenCalledTimes(1);
    });
    
    it('should handle missing files', async () => {
      // Mock database records
      (databaseService.getRecords as jest.Mock).mockResolvedValue({
        data: [
          { id: 'file1', file_path: 'path/to/file1.md', file_hash: 'hash1' },
          { id: 'file2', file_path: 'path/to/deleted.md', file_hash: 'hash2' }
        ],
        error: null
      });
      
      // Mock file metadata for existing file (one file is deleted)
      (fileService.getFileMetadata as jest.Mock).mockImplementation((path) => {
        if (path.includes('file1')) {
          return { path: 'path/to/file1.md', file_size: 100, mtime: new Date(), hash: 'hash1' };
        }
        return null;
      });
      
      // Mock delete records
      (databaseService.deleteRecords as jest.Mock).mockResolvedValue({
        data: null,
        error: null
      });
      
      // Call the method
      const result = await documentService.syncFiles();
      
      // Verify results
      expect(result.existCount).toBe(1);
      expect(result.notExistCount).toBe(1);
      expect(databaseService.deleteRecords).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('findNewFiles', () => {
    it('should find and add new files', async () => {
      // Mock existing files in database
      (databaseService.getRecords as jest.Mock).mockResolvedValue({
        data: [
          { file_path: 'path/to/existing.md' }
        ],
        error: null
      });
      
      // Mock files found on disk
      (fileService.findDocumentationFiles as jest.Mock).mockReturnValue([
        { path: 'path/to/existing.md', file_size: 100, mtime: new Date(), hash: 'hash1' },
        { path: 'path/to/new.md', file_size: 200, mtime: new Date(), hash: 'hash2' }
      ]);
      
      // Mock successful insertion
      (databaseService.insertRecords as jest.Mock).mockResolvedValue({
        data: [{ id: 'new-id', file_path: 'path/to/new.md' }],
        error: null
      });
      
      // Call the method
      const result = await documentService.findNewFiles();
      
      // Verify results
      expect(result.success).toBe(true);
      expect(result.added).toBe(1);
      expect(result.total).toBe(2);
      expect(databaseService.getRecords).toHaveBeenCalled();
      expect(fileService.findDocumentationFiles).toHaveBeenCalled();
      expect(databaseService.insertRecords).toHaveBeenCalledWith(
        'documentation_files',
        expect.arrayContaining([
          expect.objectContaining({
            file_path: 'path/to/new.md',
            file_hash: 'hash2'
          })
        ])
      );
    });
  });
  
  describe('showRecentFiles', () => {
    it('should show recent files', async () => {
      // Mock recent files
      (databaseService.getRecords as jest.Mock).mockResolvedValue({
        data: [
          { 
            id: 'file1', 
            file_path: 'path/to/file1.md', 
            title: 'File 1',
            document_type_id: 'type1',
            updated_at: new Date().toISOString()
          }
        ],
        error: null
      });
      
      // Spy on console.log
      const consoleSpy = jest.spyOn(console, 'log');
      
      // Call the method
      const result = await documentService.showRecentFiles(1);
      
      // Verify results
      expect(result).toBe(true);
      expect(databaseService.getRecords).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('ID'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('File 1'));
      
      // Restore console.log
      consoleSpy.mockRestore();
    });
  });
  
  describe('classifyDocuments', () => {
    it('should classify documents successfully', async () => {
      // Mock API key validation
      (claudeService.validateApiKey as jest.Mock).mockReturnValue(true);
      
      // Mock document types
      (databaseService.getRecords as jest.Mock).mockImplementation((table) => {
        if (table === 'document_types') {
          return {
            data: [
              { id: 'type1', name: 'Technical Doc', description: 'Technical documentation' },
              { id: 'type2', name: 'Guide', description: 'User guide' }
            ],
            error: null
          };
        } else {
          return {
            data: [
              { 
                id: 'file1', 
                file_path: 'path/to/file1.md', 
                title: 'File 1',
                language: 'markdown',
                updated_at: new Date().toISOString()
              }
            ],
            error: null
          };
        }
      });
      
      // Mock file content
      (fileService.readFileContent as jest.Mock).mockReturnValue('# Test Document\n\nThis is a test document.');
      
      // Mock Claude response
      (claudeService.getJsonResponse as jest.Mock).mockResolvedValue({
        document_type_id: 'type1',
        document_type_name: 'Technical Doc',
        confidence: 0.9,
        rationale: 'This appears to be a technical document'
      });
      
      // Mock update records
      (databaseService.updateRecords as jest.Mock).mockResolvedValue({
        data: null,
        error: null
      });
      
      // Call the method
      const result = await documentService.classifyDocuments(1, false);
      
      // Verify results
      expect(result).toBe(true);
      expect(claudeService.validateApiKey).toHaveBeenCalled();
      expect(databaseService.getRecords).toHaveBeenCalledTimes(2);
      expect(fileService.readFileContent).toHaveBeenCalled();
      expect(claudeService.getJsonResponse).toHaveBeenCalled();
      expect(databaseService.updateRecords).toHaveBeenCalledWith(
        'documentation_files',
        expect.objectContaining({
          document_type_id: 'type1',
          updated_at: expect.any(Date)
        }),
        expect.any(Function)
      );
    });
  });
});