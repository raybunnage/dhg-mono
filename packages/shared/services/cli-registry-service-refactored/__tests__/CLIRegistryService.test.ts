import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { CLIRegistryService } from '../CLIRegistryService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../../base-classes/BaseService';
import { 
  CommandCategory,
  CommandPipeline, 
  CommandDefinition, 
  CommandPipelineTable,
  CommandDependency,
  PipelineStatistics 
} from '../types';

// Mock Supabase client factory
const createMockSupabase = () => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  
  return {
    from: mockFrom,
    rpc: mockRpc
  } as unknown as SupabaseClient;
};

// Mock logger factory
const createMockLogger = () => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}) as unknown as Logger;

// Mock data fixtures
const createMockCategory = (overrides?: Partial<CommandCategory>): CommandCategory => ({
  id: 'test-category-id',
  name: 'Test Category',
  description: 'Test category description',
  color: '#3B82F6',
  icon: 'test-icon',
  display_order: 1,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockPipeline = (overrides?: Partial<CommandPipeline>): CommandPipeline => ({
  id: 'test-pipeline-id',
  name: 'test_pipeline',
  display_name: 'Test Pipeline',
  description: 'Test pipeline description',
  category_id: 'test-category-id',
  script_path: 'scripts/cli-pipeline/test_pipeline/test-pipeline-cli.sh',
  status: 'active',
  usage_example: 'test-pipeline-cli.sh --help',
  guidance: 'Use this pipeline for testing',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockCommand = (overrides?: Partial<CommandDefinition>): CommandDefinition => ({
  id: 'test-command-id',
  pipeline_id: 'test-pipeline-id',
  command_name: 'test-command',
  description: 'Test command description',
  usage_pattern: 'test-command [options]',
  example_usage: 'test-command --flag value',
  requires_auth: false,
  requires_google_api: false,
  is_dangerous: false,
  display_order: 1,
  status: 'active',
  is_hidden: false,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockTable = (overrides?: Partial<CommandPipelineTable>): CommandPipelineTable => ({
  id: 'test-table-id',
  pipeline_id: 'test-pipeline-id',
  table_name: 'test_table',
  operation_type: 'read',
  description: 'Test table access',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockDependency = (overrides?: Partial<CommandDependency>): CommandDependency => ({
  id: 'test-dependency-id',
  command_id: 'test-command-id',
  dependency_type: 'service',
  dependency_name: 'SupabaseService',
  description: 'Requires Supabase service',
  is_required: true,
  created_at: '2025-01-01T00:00:00Z',
  ...overrides
});

const createMockStatistics = (overrides?: Partial<PipelineStatistics>): PipelineStatistics => ({
  pipeline_id: 'test-pipeline-id',
  pipeline_name: 'test_pipeline',
  total_commands: 5,
  active_commands: 4,
  deprecated_commands: 1,
  tables_accessed: 3,
  last_used: '2025-01-01T00:00:00Z',
  total_executions: 100,
  ...overrides
});

describe('CLIRegistryService', () => {
  let service: CLIRegistryService;
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockLogger = createMockLogger();
    service = new CLIRegistryService(mockSupabase, mockLogger);
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create an instance with required dependencies', () => {
      expect(service).toBeInstanceOf(CLIRegistryService);
      expect(service.getName()).toBe('CLIRegistryService');
    });

    it('should create an instance without optional logger', () => {
      const serviceNoLogger = new CLIRegistryService(mockSupabase);
      expect(serviceNoLogger).toBeInstanceOf(CLIRegistryService);
    });

    it('should throw error when supabase client is not provided', () => {
      expect(() => new CLIRegistryService(null as any)).toThrow('SupabaseClient is required for CLIRegistryService');
    });

    it('should validate dependencies on construction', () => {
      expect(() => new CLIRegistryService(undefined as any)).toThrow();
    });

    it('should be initialized immediately', async () => {
      expect(await service.isInitialized()).toBe(true);
    });
  });

  describe('Business Service Pattern', () => {
    it('should not enforce singleton pattern as a business service', () => {
      const service1 = new CLIRegistryService(mockSupabase);
      const service2 = new CLIRegistryService(mockSupabase);
      
      expect(service1).not.toBe(service2);
      expect(service1).toBeInstanceOf(CLIRegistryService);
      expect(service2).toBeInstanceOf(CLIRegistryService);
    });

    it('should accept dependency injection of infrastructure services', () => {
      const mockSupabase2 = createMockSupabase();
      const service2 = new CLIRegistryService(mockSupabase2, mockLogger);
      
      expect(service).not.toBe(service2);
      expect(service2).toBeInstanceOf(CLIRegistryService);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when database is accessible', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.latencyMs).toBeGreaterThan(0);
      expect(health.details.status).toBe('operational');
    });

    it('should report unhealthy when database is inaccessible', async () => {
      const mockError = new Error('Database connection failed');
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            error: mockError
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Database connection failed');
    });

    it('should handle exceptions in health check', async () => {
      const mockFrom = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Unexpected error');
    });
  });

  describe('Category Operations', () => {
    describe('getCategories', () => {
      it('should retrieve all categories ordered by display_order', async () => {
        const mockCategories = [
          createMockCategory({ display_order: 1 }),
          createMockCategory({ id: 'cat-2', name: 'Category 2', display_order: 2 })
        ];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockCategories,
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const categories = await service.getCategories();
        
        expect(categories).toEqual(mockCategories);
        expect(mockSupabase.from).toHaveBeenCalledWith('command_categories');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'CLIRegistryService: Operation completed',
          expect.objectContaining({ operation: 'getCategories' })
        );
      });

      it('should handle database errors', async () => {
        const mockError = new Error('Query failed');
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: mockError
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.getCategories()).rejects.toThrow('Query failed');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'CLIRegistryService: Operation failed',
          expect.objectContaining({ 
            operation: 'getCategories',
            error: mockError 
          })
        );
      });
    });

    describe('getCategoryById', () => {
      it('should retrieve a single category by ID', async () => {
        const mockCategory = createMockCategory();
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockCategory,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const category = await service.getCategoryById('test-category-id');
        
        expect(category).toEqual(mockCategory);
      });

      it('should return null when category not found', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const category = await service.getCategoryById('non-existent');
        
        expect(category).toBeNull();
      });

      it('should validate category ID input', async () => {
        await expect(service.getCategoryById('')).rejects.toThrow('Category ID must be a non-empty string');
        await expect(service.getCategoryById(null as any)).rejects.toThrow('Category ID must be a non-empty string');
      });
    });
  });

  describe('Pipeline Operations', () => {
    describe('getPipelines', () => {
      it('should retrieve all pipelines with categories', async () => {
        const mockPipelines = [
          createMockPipeline({ category: createMockCategory() }),
          createMockPipeline({ 
            id: 'pipeline-2', 
            name: 'pipeline_2',
            category: createMockCategory({ id: 'cat-2', name: 'Category 2' })
          })
        ];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockPipelines,
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const pipelines = await service.getPipelines();
        
        expect(pipelines).toEqual(mockPipelines);
        expect(pipelines[0].category).toBeDefined();
      });

      it('should apply category filter', async () => {
        const mockQuery = {
          eq: vi.fn().mockResolvedValue({
            data: [createMockPipeline()],
            error: null
          })
        };
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockQuery)
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getPipelines({ category: 'test-category-id' });
        
        expect(mockQuery.eq).toHaveBeenCalledWith('category_id', 'test-category-id');
      });

      it('should apply status filter', async () => {
        const mockQuery = {
          eq: vi.fn().mockResolvedValue({
            data: [createMockPipeline({ status: 'deprecated' })],
            error: null
          })
        };
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue(mockQuery)
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.getPipelines({ status: 'deprecated' });
        
        expect(mockQuery.eq).toHaveBeenCalledWith('status', 'deprecated');
      });

      it('should validate status filter', async () => {
        await expect(service.getPipelines({ status: 'invalid' as any }))
          .rejects.toThrow('Invalid status filter. Must be: active, deprecated, or maintenance');
      });
    });

    describe('getPipelineByName', () => {
      it('should retrieve a pipeline by name', async () => {
        const mockPipeline = createMockPipeline({ category: createMockCategory() });
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockPipeline,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const pipeline = await service.getPipelineByName('test_pipeline');
        
        expect(pipeline).toEqual(mockPipeline);
      });

      it('should validate pipeline name input', async () => {
        await expect(service.getPipelineByName('')).rejects.toThrow('Pipeline name must be a non-empty string');
        await expect(service.getPipelineByName(null as any)).rejects.toThrow('Pipeline name must be a non-empty string');
      });

      it('should return null when pipeline not found', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const pipeline = await service.getPipelineByName('non-existent');
        
        expect(pipeline).toBeNull();
      });
    });

    describe('createPipeline', () => {
      it('should create a new pipeline', async () => {
        const newPipeline = {
          name: 'new_pipeline',
          display_name: 'New Pipeline',
          description: 'New pipeline description',
          script_path: 'scripts/cli-pipeline/new_pipeline/new-pipeline-cli.sh',
          status: 'active' as const
        };

        const createdPipeline = createMockPipeline({
          ...newPipeline,
          id: 'new-id',
          category: createMockCategory()
        });

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createdPipeline,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.createPipeline(newPipeline);
        
        expect(result).toEqual(createdPipeline);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'CLIRegistryService: Transaction completed',
          expect.objectContaining({ operation: 'createPipeline' })
        );
      });

      it('should validate required fields', async () => {
        await expect(service.createPipeline({
          name: '',
          display_name: 'Test',
          script_path: 'test.sh',
          status: 'active'
        } as any)).rejects.toThrow('Pipeline name, display_name, and script_path are required');
      });

      it('should validate status value', async () => {
        await expect(service.createPipeline({
          name: 'test',
          display_name: 'Test',
          script_path: 'test.sh',
          status: 'invalid'
        } as any)).rejects.toThrow('Invalid status. Must be: active, deprecated, or maintenance');
      });
    });

    describe('updatePipeline', () => {
      it('should update a pipeline', async () => {
        const updates = { status: 'maintenance' as const, description: 'Updated description' };
        const updatedPipeline = createMockPipeline({ ...updates, category: createMockCategory() });

        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedPipeline,
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.updatePipeline('test-pipeline-id', updates);
        
        expect(result).toEqual(updatedPipeline);
        expect(result.status).toBe('maintenance');
      });

      it('should validate pipeline ID', async () => {
        await expect(service.updatePipeline('', {})).rejects.toThrow('Pipeline ID must be a non-empty string');
      });

      it('should validate status updates', async () => {
        await expect(service.updatePipeline('test-id', { status: 'invalid' as any }))
          .rejects.toThrow('Invalid status. Must be: active, deprecated, or maintenance');
      });
    });

    describe('markPipelineScanned', () => {
      it('should update last_scanned_at timestamp', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.markPipelineScanned('test-pipeline-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('command_pipelines');
        const updateCall = (mockSupabase.from as any).mock.results[0].value.update.mock.calls[0][0];
        expect(updateCall.last_scanned_at).toBeDefined();
      });

      it('should validate pipeline ID', async () => {
        await expect(service.markPipelineScanned('')).rejects.toThrow('Pipeline ID must be a non-empty string');
      });
    });
  });

  describe('Command Operations', () => {
    describe('getCommandsForPipeline', () => {
      it('should retrieve commands for a pipeline', async () => {
        const mockCommands = [
          createMockCommand({ display_order: 1 }),
          createMockCommand({ id: 'cmd-2', command_name: 'command-2', display_order: 2 })
        ];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockCommands,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const commands = await service.getCommandsForPipeline('test-pipeline-id');
        
        expect(commands).toEqual(mockCommands);
        expect(commands[0].display_order).toBeLessThan(commands[1].display_order);
      });

      it('should validate pipeline ID', async () => {
        await expect(service.getCommandsForPipeline('')).rejects.toThrow('Pipeline ID must be a non-empty string');
      });
    });

    describe('createCommand', () => {
      it('should create a new command with defaults', async () => {
        const newCommand = {
          pipeline_id: 'test-pipeline-id',
          command_name: 'new-command',
          description: 'New command description'
        };

        const createdCommand = createMockCommand({
          ...newCommand,
          id: 'new-cmd-id',
          requires_auth: false,
          requires_google_api: false,
          is_dangerous: false
        });

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createdCommand,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.createCommand(newCommand);
        
        expect(result).toEqual(createdCommand);
        expect(result.requires_auth).toBe(false);
        expect(result.requires_google_api).toBe(false);
        expect(result.is_dangerous).toBe(false);
      });

      it('should validate required fields', async () => {
        await expect(service.createCommand({
          pipeline_id: '',
          command_name: 'test'
        } as any)).rejects.toThrow('Pipeline ID and command name are required');
      });

      it('should set boolean defaults', async () => {
        const command = {
          pipeline_id: 'test-id',
          command_name: 'test-cmd'
        };

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockImplementation((data) => {
            expect(data.requires_auth).toBe(false);
            expect(data.requires_google_api).toBe(false);
            expect(data.is_dangerous).toBe(false);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: createMockCommand(data),
                  error: null
                })
              })
            };
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.createCommand(command);
      });
    });

    describe('updateCommand', () => {
      it('should update a command', async () => {
        const updates = { description: 'Updated description', is_dangerous: true };
        const updatedCommand = createMockCommand({ ...updates });

        const mockFrom = vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updatedCommand,
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.updateCommand('test-command-id', updates);
        
        expect(result).toEqual(updatedCommand);
        expect(result.is_dangerous).toBe(true);
      });

      it('should validate command ID', async () => {
        await expect(service.updateCommand('', {})).rejects.toThrow('Command ID must be a non-empty string');
      });
    });

    describe('deleteCommand', () => {
      it('should delete a command', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.deleteCommand('test-command-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('command_definitions');
      });

      it('should validate command ID', async () => {
        await expect(service.deleteCommand('')).rejects.toThrow('Command ID must be a non-empty string');
      });

      it('should handle deletion errors', async () => {
        const mockError = { message: 'Delete failed' };
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: mockError
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.deleteCommand('test-command-id')).rejects.toThrow('Delete failed');
      });
    });

    describe('searchCommands', () => {
      it('should search commands by name and description', async () => {
        const mockResults = [{
          id: 'cmd-1',
          pipeline_id: 'pipeline-1',
          command_name: 'search-test',
          description: 'Command for testing search',
          pipeline: createMockPipeline({ category: createMockCategory() }),
          requires_auth: false,
          requires_google_api: false,
          is_dangerous: false,
          display_order: 1,
          status: 'active',
          is_hidden: false,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z'
        }];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockResults,
                  error: null
                })
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const results = await service.searchCommands('test');
        
        expect(results).toHaveLength(1);
        expect(results[0].command.command_name).toBe('search-test');
        expect(results[0].pipeline).toBeDefined();
      });

      it('should validate search term length', async () => {
        await expect(service.searchCommands('a')).rejects.toThrow('Search term must be at least 2 characters long');
        await expect(service.searchCommands('')).rejects.toThrow('Search term must be at least 2 characters long');
      });

      it('should only return active pipeline commands', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const results = await service.searchCommands('test');
        
        const selectResult = (mockSupabase.from as any).mock.results[0].value.select.mock.results[0].value;
        expect(selectResult.eq).toHaveBeenCalledWith('pipeline.status', 'active');
      });
    });
  });

  describe('Pipeline Table Operations', () => {
    describe('getTablesForPipeline', () => {
      it('should retrieve tables for a pipeline', async () => {
        const mockTables = [
          createMockTable({ table_name: 'table_a' }),
          createMockTable({ id: 'table-2', table_name: 'table_b' })
        ];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockTables,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const tables = await service.getTablesForPipeline('test-pipeline-id');
        
        expect(tables).toEqual(mockTables);
        expect(tables[0].table_name).toBe('table_a');
      });

      it('should validate pipeline ID', async () => {
        await expect(service.getTablesForPipeline('')).rejects.toThrow('Pipeline ID must be a non-empty string');
      });
    });

    describe('addPipelineTable', () => {
      it('should add a table to a pipeline', async () => {
        const newTable = {
          pipeline_id: 'test-pipeline-id',
          table_name: 'new_table',
          operation_type: 'both' as const,
          description: 'New table access'
        };

        const createdTable = createMockTable({
          ...newTable,
          id: 'new-table-id'
        });

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createdTable,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.addPipelineTable(newTable);
        
        expect(result).toEqual(createdTable);
      });

      it('should validate required fields', async () => {
        await expect(service.addPipelineTable({
          pipeline_id: '',
          table_name: 'test',
          operation_type: 'read'
        } as any)).rejects.toThrow('Pipeline ID and table name are required');
      });

      it('should validate operation type', async () => {
        await expect(service.addPipelineTable({
          pipeline_id: 'test-id',
          table_name: 'test_table',
          operation_type: 'invalid' as any
        })).rejects.toThrow('Operation type must be: read, write, or both');
      });
    });

    describe('removePipelineTable', () => {
      it('should remove a pipeline table', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.removePipelineTable('test-table-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('command_pipeline_tables');
      });

      it('should validate table ID', async () => {
        await expect(service.removePipelineTable('')).rejects.toThrow('Table ID must be a non-empty string');
      });
    });
  });

  describe('Dependency Operations', () => {
    describe('getDependenciesForCommand', () => {
      it('should retrieve dependencies ordered by type and name', async () => {
        const mockDependencies = [
          createMockDependency({ dependency_type: 'api', dependency_name: 'GoogleAPI' }),
          createMockDependency({ 
            id: 'dep-2', 
            dependency_type: 'service', 
            dependency_name: 'AuthService' 
          })
        ];
        
        const mockFrom = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockDependencies,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const dependencies = await service.getDependenciesForCommand('test-command-id');
        
        expect(dependencies).toEqual(mockDependencies);
      });

      it('should validate command ID', async () => {
        await expect(service.getDependenciesForCommand('')).rejects.toThrow('Command ID must be a non-empty string');
      });
    });

    describe('addCommandDependency', () => {
      it('should add a dependency with defaults', async () => {
        const newDependency = {
          command_id: 'test-command-id',
          dependency_type: 'env_var' as const,
          dependency_name: 'SUPABASE_URL',
          description: 'Supabase URL environment variable'
        };

        const createdDependency = createMockDependency({
          ...newDependency,
          id: 'new-dep-id',
          is_required: true
        });

        const mockFrom = vi.fn().mockReturnValue({
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createdDependency,
                error: null
              })
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        const result = await service.addCommandDependency(newDependency);
        
        expect(result).toEqual(createdDependency);
        expect(result.is_required).toBe(true);
      });

      it('should validate required fields', async () => {
        await expect(service.addCommandDependency({
          command_id: '',
          dependency_type: 'service',
          dependency_name: 'test'
        } as any)).rejects.toThrow('Command ID and dependency name are required');
      });

      it('should validate dependency type', async () => {
        await expect(service.addCommandDependency({
          command_id: 'test-id',
          dependency_type: 'invalid' as any,
          dependency_name: 'test'
        })).rejects.toThrow('Dependency type must be: service, api, tool, or env_var');
      });
    });

    describe('removeCommandDependency', () => {
      it('should remove a dependency', async () => {
        const mockFrom = vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null
            })
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.removeCommandDependency('test-dependency-id');
        
        expect(mockSupabase.from).toHaveBeenCalledWith('command_dependencies');
      });

      it('should validate dependency ID', async () => {
        await expect(service.removeCommandDependency('')).rejects.toThrow('Dependency ID must be a non-empty string');
      });
    });
  });

  describe('Statistics Operations', () => {
    describe('getPipelineStatistics', () => {
      it('should retrieve statistics for all pipelines', async () => {
        const mockStats = [
          createMockStatistics(),
          createMockStatistics({ 
            pipeline_id: 'pipeline-2', 
            pipeline_name: 'pipeline_2',
            total_commands: 10 
          })
        ];
        
        (mockSupabase.rpc as any).mockResolvedValue({
          data: mockStats,
          error: null
        });

        const stats = await service.getPipelineStatistics();
        
        expect(stats).toEqual(mockStats);
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_pipeline_statistics', { p_pipeline_id: undefined });
      });

      it('should retrieve statistics for specific pipeline', async () => {
        const mockStats = [createMockStatistics()];
        
        (mockSupabase.rpc as any).mockResolvedValue({
          data: mockStats,
          error: null
        });

        const stats = await service.getPipelineStatistics('test-pipeline-id');
        
        expect(stats).toEqual(mockStats);
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_pipeline_statistics', { p_pipeline_id: 'test-pipeline-id' });
      });

      it('should validate pipeline ID when provided', async () => {
        await expect(service.getPipelineStatistics('')).rejects.toThrow('Pipeline ID must be a non-empty string');
      });

      it('should handle RPC errors', async () => {
        const mockError = { message: 'RPC failed' };
        (mockSupabase.rpc as any).mockResolvedValue({
          data: null,
          error: mockError
        });

        await expect(service.getPipelineStatistics()).rejects.toThrow('RPC failed');
      });
    });
  });

  describe('Bulk Operations', () => {
    describe('importPipelineCommands', () => {
      it('should import commands for existing pipeline', async () => {
        const commands = [
          { name: 'cmd1', description: 'Command 1', usage: 'cmd1 [options]' },
          { name: 'cmd2', description: 'Command 2' }
        ];

        const existingPipeline = createMockPipeline();
        
        // Mock getPipelineByName
        vi.spyOn(service, 'getPipelineByName').mockResolvedValue(existingPipeline);

        // Mock upsert
        const mockFrom = vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({
            error: null
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.importPipelineCommands('test_pipeline', commands);
        
        expect(service.getPipelineByName).toHaveBeenCalledWith('test_pipeline');
        const upsertCall = (mockSupabase.from as any).mock.results[0].value.upsert.mock.calls[0];
        expect(upsertCall[0]).toHaveLength(2);
        expect(upsertCall[0][0].command_name).toBe('cmd1');
        expect(upsertCall[0][1].command_name).toBe('cmd2');
      });

      it('should create pipeline if it does not exist', async () => {
        const commands = [
          { name: 'cmd1', description: 'Command 1' }
        ];

        // Mock getPipelineByName to return null
        vi.spyOn(service, 'getPipelineByName').mockResolvedValue(null);

        // Mock createPipeline
        const newPipeline = createMockPipeline({ name: 'new_pipeline' });
        vi.spyOn(service, 'createPipeline').mockResolvedValue(newPipeline);

        // Mock upsert
        const mockFrom = vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({
            error: null
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await service.importPipelineCommands('new_pipeline', commands);
        
        expect(service.createPipeline).toHaveBeenCalledWith({
          name: 'new_pipeline',
          display_name: 'New Pipeline',
          description: 'Commands for new_pipeline',
          script_path: 'scripts/cli-pipeline/new_pipeline/new_pipeline-cli.sh',
          status: 'active'
        });
      });

      it('should validate inputs', async () => {
        await expect(service.importPipelineCommands('', []))
          .rejects.toThrow('Pipeline name must be a non-empty string');
        
        await expect(service.importPipelineCommands('test', []))
          .rejects.toThrow('Commands must be a non-empty array');
        
        await expect(service.importPipelineCommands('test', [{ name: '', description: 'test' }]))
          .rejects.toThrow('Each command must have name and description');
      });

      it('should handle upsert errors', async () => {
        vi.spyOn(service, 'getPipelineByName').mockResolvedValue(createMockPipeline());

        const mockFrom = vi.fn().mockReturnValue({
          upsert: vi.fn().mockResolvedValue({
            error: { message: 'Upsert failed' }
          })
        });
        (mockSupabase.from as any).mockImplementation(mockFrom);

        await expect(service.importPipelineCommands('test', [{ name: 'cmd', description: 'desc' }]))
          .rejects.toThrow('Upsert failed');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network timeout');
      networkError.name = 'NetworkError';
      
      const mockFrom = vi.fn().mockImplementation(() => {
        throw networkError;
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await expect(service.getCategories()).rejects.toThrow('Network timeout');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle malformed responses', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: 'not-an-array',
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const categories = await service.getCategories();
      
      // Service should handle gracefully and return what it got
      expect(categories).toBe('not-an-array');
    });

    it('should provide detailed error context in logs', async () => {
      const detailedError = {
        message: 'Constraint violation',
        details: 'foreign_key_violation',
        hint: 'Pipeline must reference valid category',
        code: '23503'
      };
      
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: detailedError
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await expect(service.createPipeline({
        name: 'test',
        display_name: 'Test',
        script_path: 'test.sh',
        status: 'active'
      })).rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'CLIRegistryService: Transaction failed',
        expect.objectContaining({ error: detailedError })
      );
    });
  });

  describe('Retry Mechanism', () => {
    it('should retry on transient failures', async () => {
      let callCount = 0;
      const mockFrom = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Temporary failure' }
              })
            })
          };
        } else {
          // Second call succeeds
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [createMockCategory()],
                error: null
              })
            })
          };
        }
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      const categories = await service.getCategories();
      
      expect(categories).toHaveLength(1);
      expect(callCount).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'CLIRegistryService: Retrying operation',
        expect.objectContaining({ attempt: 2 })
      );
    });

    it('should fail after max retries', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Persistent failure' }
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await expect(service.getCategories()).rejects.toThrow('Persistent failure');
      
      // Should have tried 3 times (initial + 2 retries)
      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
    });
  });

  describe('Input Validation', () => {
    it('should trim string inputs', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createMockCategory(),
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.getCategoryById('  test-id  ');
      
      const selectResult = (mockSupabase.from as any).mock.results[0].value.select.mock.results[0].value;
      expect(selectResult.eq).toHaveBeenCalledWith('id', 'test-id');
    });

    it('should handle null and undefined gracefully', async () => {
      await expect(service.getCategoryById(null as any))
        .rejects.toThrow('Category ID must be a non-empty string');
      
      await expect(service.getCategoryById(undefined as any))
        .rejects.toThrow('Category ID must be a non-empty string');
    });
  });

  describe('Transaction Support', () => {
    it('should use transactions for create operations', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: createMockPipeline(),
              error: null
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.createPipeline({
        name: 'transactional_pipeline',
        display_name: 'Transactional Pipeline',
        script_path: 'test.sh',
        status: 'active'
      });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CLIRegistryService: Transaction completed',
        expect.objectContaining({ operation: 'createPipeline' })
      );
    });

    it('should use transactions for update operations', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: createMockCommand(),
                error: null
              })
            })
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.updateCommand('test-id', { description: 'Updated' });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'CLIRegistryService: Transaction completed',
        expect.objectContaining({ operation: 'updateCommand' })
      );
    });
  });

  describe('Performance Tracking', () => {
    it('should track operation timing', async () => {
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });
      (mockSupabase.from as any).mockImplementation(mockFrom);

      await service.getCategories();
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CLIRegistryService: Operation completed',
        expect.objectContaining({
          operation: 'getCategories',
          durationMs: expect.any(Number),
          resultCount: 0
        })
      );
    });
  });
});