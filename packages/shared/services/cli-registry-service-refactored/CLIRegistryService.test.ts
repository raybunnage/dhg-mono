import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CLIRegistryService } from './CLIRegistryService';
import { SupabaseClient } from '@supabase/supabase-js';
import { MockLogger } from '../../test-utils/MockLogger';

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null }))
      })),
      limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    }))
  }))
} as unknown as SupabaseClient;

describe('CLIRegistryService', () => {
  let service: CLIRegistryService;
  let mockLogger: MockLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = new MockLogger();
    service = new CLIRegistryService(mockSupabaseClient, mockLogger);
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.ensureInitialized();
      expect(service.getMetadata().initialized).toBe(true);
    });

    it('should only initialize once', async () => {
      await service.ensureInitialized();
      await service.ensureInitialized();
      expect(service.getMetadata().initialized).toBe(true);
    });
  });

  describe('health check', () => {
    it('should perform health check successfully', async () => {
      await service.ensureInitialized();
      const result = await service.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.serviceName).toBe('CLIRegistryService');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should handle health check errors', async () => {
      const errorClient = {
        from: vi.fn(() => ({
          select: vi.fn(() => Promise.reject(new Error('Database connection failed')))
        }))
      } as unknown as SupabaseClient;
      
      const errorService = new CLIRegistryService(errorClient, mockLogger);
      await errorService.ensureInitialized();
      
      const result = await errorService.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Database connection failed');
      
      await errorService.shutdown();
    });
  });

  describe('findPipelineByName', () => {
    it('should find pipeline by name successfully', async () => {
      const mockPipeline = { id: 'test-id', name: 'test-pipeline' };
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockPipeline, error: null }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      const result = await service.findPipelineByName('test-pipeline');
      expect(result).toEqual(mockPipeline);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('command_pipelines');
    });

    it('should return null when pipeline not found', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      const result = await service.findPipelineByName('non-existent');
      expect(result).toBeNull();
    });

    it('should validate input parameters', async () => {
      await expect(service.findPipelineByName('')).rejects.toThrow('Pipeline name is required');
      await expect(service.findPipelineByName('   ')).rejects.toThrow('Pipeline name is required');
    });

    it('should handle database errors with retry', async () => {
      let callCount = 0;
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => {
              callCount++;
              if (callCount < 3) {
                return Promise.resolve({ data: null, error: { message: 'Temporary error' } });
              }
              return Promise.resolve({ data: { id: 'test-id' }, error: null });
            })
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      const result = await service.findPipelineByName('test-pipeline');
      expect(result).toEqual({ id: 'test-id' });
      expect(callCount).toBe(3); // Should retry and succeed on third attempt
    });
  });

  describe('getCommands', () => {
    it('should get commands for pipeline successfully', async () => {
      const mockCommands = [
        { id: 'cmd1', command_name: 'test1' },
        { id: 'cmd2', command_name: 'test2' }
      ];
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockCommands, error: null }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      const result = await service.getCommands('pipeline-id');
      expect(result).toEqual(mockCommands);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('command_definitions');
    });

    it('should validate pipeline ID parameter', async () => {
      await expect(service.getCommands('')).rejects.toThrow('Pipeline ID is required');
      await expect(service.getCommands('   ')).rejects.toThrow('Pipeline ID is required');
    });

    it('should handle empty results', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      const result = await service.getCommands('pipeline-id');
      expect(result).toEqual([]);
    });
  });

  describe('getAllPipelines', () => {
    it('should get all active pipelines successfully', async () => {
      const mockPipelines = [
        { id: 'p1', name: 'pipeline1', status: 'active' },
        { id: 'p2', name: 'pipeline2', status: 'active' }
      ];
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockPipelines, error: null }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      const result = await service.getAllPipelines();
      expect(result).toEqual(mockPipelines);
    });

    it('should get pipelines with specific status', async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ select: mockFrom().select });

      await service.getAllPipelines('inactive');
      
      // Verify the eq call was made with the correct status
      const selectChain = mockFrom().select();
      expect(selectChain.eq).toHaveBeenCalledWith('status', 'inactive');
    });
  });

  describe('addCommand', () => {
    it('should add command successfully', async () => {
      const commandData = {
        pipeline_id: 'test-pipeline-id',
        command_name: 'test-command',
        description: 'Test command description'
      };

      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'new-id', ...commandData }, 
            error: null 
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ insert: mockInsert });

      const result = await service.addCommand(commandData);
      expect(result).toEqual({ id: 'new-id', ...commandData });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('command_definitions');
    });

    it('should validate required fields', async () => {
      await expect(service.addCommand({
        pipeline_id: '',
        command_name: 'test',
        description: 'test'
      })).rejects.toThrow('Pipeline ID is required');

      await expect(service.addCommand({
        pipeline_id: 'test-id',
        command_name: '',
        description: 'test'
      })).rejects.toThrow('Command name is required');

      await expect(service.addCommand({
        pipeline_id: 'test-id',
        command_name: 'test',
        description: ''
      })).rejects.toThrow('Description is required');
    });

    it('should handle database insertion errors', async () => {
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'Duplicate command name' } 
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ insert: mockInsert });

      await expect(service.addCommand({
        pipeline_id: 'test-id',
        command_name: 'duplicate',
        description: 'test'
      })).rejects.toThrow('Duplicate command name');
    });
  });

  describe('updateCommand', () => {
    it('should update command successfully', async () => {
      const updateData = { description: 'Updated description' };
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'cmd-id', ...updateData }, 
              error: null 
            }))
          }))
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ update: mockUpdate });

      const result = await service.updateCommand('cmd-id', updateData);
      expect(result).toEqual({ id: 'cmd-id', ...updateData });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('command_definitions');
    });

    it('should validate command ID', async () => {
      await expect(service.updateCommand('', {})).rejects.toThrow('Command ID is required');
      await expect(service.updateCommand('   ', {})).rejects.toThrow('Command ID is required');
    });

    it('should validate update data is not empty', async () => {
      await expect(service.updateCommand('cmd-id', {})).rejects.toThrow('Update data cannot be empty');
    });
  });

  describe('deleteCommand', () => {
    it('should delete command successfully', async () => {
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ delete: mockDelete });

      await service.deleteCommand('cmd-id');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('command_definitions');
    });

    it('should validate command ID', async () => {
      await expect(service.deleteCommand('')).rejects.toThrow('Command ID is required');
      await expect(service.deleteCommand('   ')).rejects.toThrow('Command ID is required');
    });

    it('should handle deletion errors', async () => {
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ 
          data: null, 
          error: { message: 'Command not found' } 
        }))
      }));
      (mockSupabaseClient.from as any).mockReturnValue({ delete: mockDelete });

      await expect(service.deleteCommand('non-existent')).rejects.toThrow('Command not found');
    });
  });

  describe('performance monitoring', () => {
    it('should track operation performance', async () => {
      const startTime = Date.now();
      await service.findPipelineByName('test-pipeline');
      const endTime = Date.now();
      
      // Operation should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should log performance metrics when logger is available', async () => {
      await service.findPipelineByName('test-pipeline');
      
      // Check that logger was called for performance metrics
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('CLIRegistryService.findPipelineByName completed')
      );
    });
  });

  describe('error handling and recovery', () => {
    it('should handle network errors gracefully', async () => {
      const networkErrorClient = {
        from: vi.fn(() => ({
          select: vi.fn(() => Promise.reject(new Error('Network error')))
        }))
      } as unknown as SupabaseClient;
      
      const errorService = new CLIRegistryService(networkErrorClient, mockLogger);
      await errorService.ensureInitialized();
      
      await expect(errorService.findPipelineByName('test')).rejects.toThrow('Network error');
      
      await errorService.shutdown();
    });

    it('should maintain service state after errors', async () => {
      // Cause an error
      try {
        await service.findPipelineByName('');
      } catch (error) {
        // Error expected due to validation
      }
      
      // Service should still be functional
      expect(service.getMetadata().initialized).toBe(true);
      
      const healthCheck = await service.healthCheck();
      expect(healthCheck.healthy).toBe(true);
    });
  });
});