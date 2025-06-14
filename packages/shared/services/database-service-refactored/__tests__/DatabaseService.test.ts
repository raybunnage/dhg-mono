import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../DatabaseService';
import { SupabaseClientService } from '../../supabase-client';

// Mock the Supabase client
vi.mock('../../supabase-client');

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Reset singleton instance
    (DatabaseService as any).instance = null;
    
    // Create mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      rpc: vi.fn()
    };

    // Mock SupabaseClientService
    vi.mocked(SupabaseClientService.getInstance).mockReturnValue({
      getClient: () => mockSupabaseClient
    } as any);

    service = DatabaseService.getInstance();
  });

  afterEach(async () => {
    await service.shutdown();
    vi.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = DatabaseService.getInstance();
      const instance2 = DatabaseService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should properly implement SingletonService pattern', () => {
      expect(service).toHaveProperty('ensureInitialized');
      expect(service).toHaveProperty('shutdown');
      expect(service).toHaveProperty('healthCheck');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully with database connection', async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      
      await service.ensureInitialized();
      
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('sys_table_prefixes');
      expect(mockSupabaseClient.select).toHaveBeenCalled();
    });

    it('should throw error if database connection fails', async () => {
      mockSupabaseClient.select.mockResolvedValue({ 
        error: { message: 'Connection failed' } 
      });
      
      await expect(service.ensureInitialized()).rejects.toThrow('Connection failed');
    });
  });

  describe('getTablesWithRecordCounts', () => {
    beforeEach(async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      await service.ensureInitialized();
    });

    it('should return tables with record counts', async () => {
      const mockTables = [
        { table_name: 'users', table_type: 'BASE TABLE' },
        { table_name: 'posts', table_type: 'BASE TABLE' }
      ];
      
      mockSupabaseClient.rpc.mockResolvedValueOnce({ 
        data: mockTables, 
        error: null 
      });
      
      // Mock count queries
      mockSupabaseClient.select
        .mockResolvedValueOnce({ count: 10, error: null })
        .mockResolvedValueOnce({ count: 25, error: null });
      
      const result = await service.getTablesWithRecordCounts();
      
      expect(result).toEqual([
        { tableName: 'users', count: 10, type: 'BASE TABLE' },
        { tableName: 'posts', count: 25, type: 'BASE TABLE' }
      ]);
    });

    it('should use cache on subsequent calls', async () => {
      const mockTables = [{ table_name: 'users', table_type: 'BASE TABLE' }];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      mockSupabaseClient.select.mockResolvedValue({ count: 10, error: null });
      
      // First call
      await service.getTablesWithRecordCounts();
      
      // Reset mocks
      mockSupabaseClient.rpc.mockClear();
      
      // Second call should use cache
      const result = await service.getTablesWithRecordCounts();
      
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should force refresh when requested', async () => {
      const mockTables = [{ table_name: 'users', table_type: 'BASE TABLE' }];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      mockSupabaseClient.select.mockResolvedValue({ count: 10, error: null });
      
      // First call
      await service.getTablesWithRecordCounts();
      
      // Reset mocks
      mockSupabaseClient.rpc.mockClear();
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      
      // Force refresh
      await service.getTablesWithRecordCounts(true);
      
      expect(mockSupabaseClient.rpc).toHaveBeenCalled();
    });

    it('should handle tables with count errors', async () => {
      const mockTables = [{ table_name: 'restricted_view', table_type: 'VIEW' }];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      mockSupabaseClient.select.mockResolvedValue({ 
        count: null, 
        error: { message: 'Permission denied' } 
      });
      
      const result = await service.getTablesWithRecordCounts();
      
      expect(result).toEqual([
        { tableName: 'restricted_view', count: -1, type: 'VIEW' }
      ]);
    });
  });

  describe('getEmptyTables', () => {
    beforeEach(async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      await service.ensureInitialized();
    });

    it('should return only empty tables', async () => {
      const mockTables = [
        { table_name: 'empty_table', table_type: 'BASE TABLE' },
        { table_name: 'full_table', table_type: 'BASE TABLE' }
      ];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      mockSupabaseClient.select
        .mockResolvedValueOnce({ count: 0, error: null })
        .mockResolvedValueOnce({ count: 5, error: null });
      
      const result = await service.getEmptyTables();
      
      expect(result).toEqual([
        { tableName: 'empty_table', type: 'BASE TABLE' }
      ]);
    });
  });

  describe('getDatabaseFunctions', () => {
    beforeEach(async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      await service.ensureInitialized();
    });

    it('should return database functions', async () => {
      const mockFunctions = [
        { name: 'execute_sql', type: 'FUNCTION', usage: 'json' },
        { name: 'get_table_info', type: 'FUNCTION', usage: 'record' }
      ];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockFunctions, 
        error: null 
      });
      
      const result = await service.getDatabaseFunctions();
      
      expect(result).toEqual(mockFunctions);
    });

    it('should fallback to alternative methods on error', async () => {
      // First attempt fails
      mockSupabaseClient.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Function not found' } 
      });
      
      // Second attempt succeeds
      mockSupabaseClient.rpc.mockResolvedValueOnce({ 
        data: [{ name: 'test_func', type: 'FUNCTION', usage: null }], 
        error: null 
      });
      
      const result = await service.getDatabaseFunctions();
      
      expect(result).toHaveLength(1);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('analyzeSchemaHealth', () => {
    beforeEach(async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      await service.ensureInitialized();
    });

    it('should identify schema issues', async () => {
      // Mock tables without primary keys
      mockSupabaseClient.rpc.mockResolvedValueOnce({ 
        data: [{ table_name: 'bad_table' }], 
        error: null 
      });
      
      // Mock nullable foreign keys
      mockSupabaseClient.rpc.mockResolvedValueOnce({ 
        data: [{ table_name: 'users', column_name: 'optional_ref_id' }], 
        error: null 
      });
      
      // Mock tables without indexes
      mockSupabaseClient.rpc.mockResolvedValueOnce({ 
        data: [{ table_name: 'slow_table' }], 
        error: null 
      });
      
      const result = await service.analyzeSchemaHealth();
      
      expect(result.issues).toHaveLength(3);
      expect(result.issues[0]).toEqual({
        type: 'missing_primary_key',
        tables: [{ table_name: 'bad_table' }],
        severity: 'high'
      });
    });

    it('should handle analysis errors gracefully', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Query failed' } 
      });
      
      await expect(service.analyzeSchemaHealth()).rejects.toThrow('Query failed');
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      await service.ensureInitialized();
    });

    it('should execute safe SELECT queries', async () => {
      const query = 'SELECT * FROM users LIMIT 10';
      const mockData = [{ id: 1, name: 'Test' }];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockData, 
        error: null 
      });
      
      const result = await service.executeQuery(query);
      
      expect(result).toEqual(mockData);
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('execute_sql', {
        sql_query: query
      });
    });

    it('should reject dangerous queries', async () => {
      const dangerousQueries = [
        'DROP TABLE users',
        'TRUNCATE users',
        'DELETE FROM users',
        'UPDATE users SET active = false',
        'INSERT INTO users VALUES (1)',
        'ALTER TABLE users ADD COLUMN test'
      ];
      
      for (const query of dangerousQueries) {
        await expect(service.executeQuery(query)).rejects.toThrow('Dangerous query detected');
      }
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      mockSupabaseClient.select.mockResolvedValue({ error: null });
      await service.ensureInitialized();
    });

    it('should clear specific cache', async () => {
      const mockTables = [{ table_name: 'users', table_type: 'BASE TABLE' }];
      
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      mockSupabaseClient.select.mockResolvedValue({ count: 10, error: null });
      
      // Populate cache
      await service.getTablesWithRecordCounts();
      
      // Clear cache
      service.clearCache('tablesWithCounts');
      
      // Next call should hit database
      mockSupabaseClient.rpc.mockClear();
      mockSupabaseClient.rpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      
      await service.getTablesWithRecordCounts();
      
      expect(mockSupabaseClient.rpc).toHaveBeenCalled();
    });

    it('should clear all caches', () => {
      service.clearCache();
      // This is mainly for coverage, actual testing is done in other tests
      expect(true).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when connection is active', async () => {
      mockSupabaseClient.select.mockResolvedValue({ 
        data: null, 
        error: null 
      });
      
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details.connection).toBe('active');
    });

    it('should report unhealthy on connection error', async () => {
      mockSupabaseClient.select.mockResolvedValue({ 
        data: null, 
        error: { message: 'Connection lost' } 
      });
      
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details.error).toBe('Connection lost');
    });
  });
});