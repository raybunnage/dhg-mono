#!/bin/bash

# Fix DatabaseService tests by updating the mock patterns

FILE="packages/shared/services/database-service-refactored/__tests__/DatabaseService.test.ts"

# First, let's simplify the approach by using a more consistent mock pattern
cat > "$FILE" << 'EOF'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from '../DatabaseService';
import { SupabaseClientService } from '../../supabase-client';

// Mock the Supabase client
vi.mock('../../supabase-client');

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockSupabaseClient: any;
  let mockFrom: any;
  let mockRpc: any;

  beforeEach(() => {
    // Reset singleton instance
    (DatabaseService as any).instance = null;
    
    // Create chainable mock
    const createQueryChain = (data: any = [], error: any = null) => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data, error }),
        single: vi.fn().mockResolvedValue({ data, error }),
        count: vi.fn().mockResolvedValue({ count: data?.count ?? 0, error })
      };
      return chain;
    };

    mockFrom = vi.fn().mockImplementation(() => createQueryChain());
    mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
    
    mockSupabaseClient = {
      from: mockFrom,
      rpc: mockRpc
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
      await service.ensureInitialized();
      
      expect(mockFrom).toHaveBeenCalledWith('sys_table_prefixes');
    });

    it('should throw error if database connection fails', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ 
          error: { message: 'Connection failed' }, 
          data: null 
        })
      }));
      
      await expect(service.ensureInitialized()).rejects.toThrow('Connection failed');
    });
  });

  describe('getTablesWithRecordCounts', () => {
    beforeEach(async () => {
      await service.ensureInitialized();
    });

    it('should return tables with record counts', async () => {
      const mockTables = [
        { table_name: 'users', table_type: 'BASE TABLE' },
        { table_name: 'posts', table_type: 'BASE TABLE' }
      ];
      
      mockRpc.mockResolvedValueOnce({ 
        data: mockTables, 
        error: null 
      });
      
      // Mock count queries
      mockFrom.mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue({ 
          count: table === 'users' ? 10 : table === 'posts' ? 25 : 0, 
          error: null 
        })
      }));
      
      const result = await service.getTablesWithRecordCounts();
      
      expect(result).toEqual([
        { tableName: 'users', count: 10, type: 'BASE TABLE' },
        { tableName: 'posts', count: 25, type: 'BASE TABLE' }
      ]);
    });

    it('should use cache on subsequent calls', async () => {
      const mockTables = [{ table_name: 'users', table_type: 'BASE TABLE' }];
      
      mockRpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue({ count: 5, error: null })
      }));
      
      const result1 = await service.getTablesWithRecordCounts();
      const result2 = await service.getTablesWithRecordCounts();
      
      expect(result1).toEqual(result2);
      expect(mockRpc).toHaveBeenCalledTimes(1); // Only called once due to cache
    });

    it('should force refresh when requested', async () => {
      const mockTables = [{ table_name: 'users', table_type: 'BASE TABLE' }];
      
      mockRpc.mockResolvedValue({ 
        data: mockTables, 
        error: null 
      });
      
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue({ count: 5, error: null })
      }));
      
      await service.getTablesWithRecordCounts();
      await service.getTablesWithRecordCounts(true); // Force refresh
      
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it('should handle tables with count errors', async () => {
      const mockTables = [
        { table_name: 'users', table_type: 'BASE TABLE' },
        { table_name: 'posts', table_type: 'BASE TABLE' }
      ];
      
      mockRpc.mockResolvedValueOnce({ 
        data: mockTables, 
        error: null 
      });
      
      mockFrom.mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue(
          table === 'users' 
            ? { count: 10, error: null }
            : { count: null, error: { message: 'Count failed' } }
        )
      }));
      
      const result = await service.getTablesWithRecordCounts();
      
      expect(result).toEqual([
        { tableName: 'users', count: 10, type: 'BASE TABLE' },
        { tableName: 'posts', count: -1, type: 'BASE TABLE' }
      ]);
    });
  });

  describe('getEmptyTables', () => {
    beforeEach(async () => {
      await service.ensureInitialized();
    });

    it('should return only empty tables', async () => {
      const mockTables = [
        { table_name: 'empty_table', table_type: 'BASE TABLE' },
        { table_name: 'users', table_type: 'BASE TABLE' }
      ];
      
      mockRpc.mockResolvedValueOnce({ 
        data: mockTables, 
        error: null 
      });
      
      mockFrom.mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue({ 
          count: table === 'empty_table' ? 0 : 10, 
          error: null 
        })
      }));
      
      const result = await service.getEmptyTables();
      
      expect(result).toEqual(['empty_table']);
    });
  });

  describe('getDatabaseFunctions', () => {
    beforeEach(async () => {
      await service.ensureInitialized();
    });

    it('should return database functions', async () => {
      const mockFunctions = [
        { routine_name: 'get_user_by_id', routine_type: 'FUNCTION' },
        { routine_name: 'calculate_total', routine_type: 'FUNCTION' }
      ];
      
      mockRpc.mockResolvedValueOnce({ 
        data: mockFunctions, 
        error: null 
      });
      
      const result = await service.getDatabaseFunctions();
      
      expect(result).toEqual(['get_user_by_id', 'calculate_total']);
    });

    it('should fallback to alternative methods on error', async () => {
      mockRpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'RPC failed' } 
      });
      
      // Mock pg_proc query
      mockFrom.mockImplementation((table) => {
        if (table === 'pg_proc') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ 
              data: [{ proname: 'fallback_function' }], 
              error: null 
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });
      
      const result = await service.getDatabaseFunctions();
      
      expect(result).toEqual(['fallback_function']);
    });
  });

  describe('analyzeSchemaHealth', () => {
    beforeEach(async () => {
      await service.ensureInitialized();
    });

    it('should identify schema issues', async () => {
      const mockTables = [
        { table_name: 'empty_table', table_type: 'BASE TABLE' },
        { table_name: 'users', table_type: 'BASE TABLE' }
      ];
      
      mockRpc.mockImplementation((fnName) => {
        if (fnName === 'get_table_info') {
          return Promise.resolve({ data: mockTables, error: null });
        }
        return Promise.resolve({ data: [], error: null });
      });
      
      mockFrom.mockImplementation((table) => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        count: vi.fn().mockResolvedValue({ 
          count: table === 'empty_table' ? 0 : 10, 
          error: null 
        })
      }));
      
      const result = await service.analyzeSchemaHealth();
      
      expect(result.totalTables).toBe(2);
      expect(result.emptyTables).toEqual(['empty_table']);
      expect(result.issues).toContain('1 empty tables found');
    });

    it('should handle analysis errors gracefully', async () => {
      mockRpc.mockRejectedValue(new Error('Analysis failed'));
      
      const result = await service.analyzeSchemaHealth();
      
      expect(result.totalTables).toBe(0);
      expect(result.issues).toContain('Failed to analyze tables');
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      await service.ensureInitialized();
    });

    it('should execute safe SELECT queries', async () => {
      mockRpc.mockResolvedValueOnce({ 
        data: [{ id: 1, name: 'Test' }], 
        error: null 
      });
      
      const result = await service.executeQuery('SELECT * FROM users');
      
      expect(result).toEqual([{ id: 1, name: 'Test' }]);
    });

    it('should reject dangerous queries', async () => {
      await expect(service.executeQuery('DROP TABLE users')).rejects.toThrow('Dangerous query');
      await expect(service.executeQuery('DELETE FROM users')).rejects.toThrow('Dangerous query');
      await expect(service.executeQuery('UPDATE users SET name = "test"')).rejects.toThrow('Dangerous query');
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await service.ensureInitialized();
    });

    it('should clear specific cache', async () => {
      // Populate cache
      mockRpc.mockResolvedValue({ data: [], error: null });
      await service.getTablesWithRecordCounts();
      
      // Clear cache
      service.clearCache('tables');
      
      // Next call should hit the database again
      await service.getTablesWithRecordCounts();
      expect(mockRpc).toHaveBeenCalledTimes(2);
    });

    it('should clear all caches', async () => {
      // Populate caches
      mockRpc.mockResolvedValue({ data: [], error: null });
      await service.getTablesWithRecordCounts();
      await service.getDatabaseFunctions();
      
      // Clear all caches
      service.clearAllCaches();
      
      // Next calls should hit the database again
      await service.getTablesWithRecordCounts();
      await service.getDatabaseFunctions();
      
      expect(mockRpc).toHaveBeenCalledTimes(4);
    });
  });

  describe('Health Check', () => {
    it('should report healthy when connection is active', async () => {
      await service.ensureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('status', 'connected');
    });

    it('should report unhealthy on connection error', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Connection lost');
      });
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.details).toHaveProperty('error');
    });
  });

  describe('Metadata', () => {
    it('should return correct metadata', () => {
      const metadata = service.getMetadata();
      
      expect(metadata).toEqual({
        name: 'DatabaseService',
        initialized: false,
        type: 'DatabaseService',
        version: '1.0.0'
      });
    });
  });
});
EOF

echo "DatabaseService tests have been rewritten with proper mock patterns"