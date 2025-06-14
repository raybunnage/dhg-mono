import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LoggerService, logger } from './LoggerService';

describe('LoggerService', () => {
  let service: LoggerService;
  const consoleSpy = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = LoggerService.getInstance({
      level: 'info',
      colorize: false,
      prettyPrint: false,
      buffer: { enabled: true, maxSize: 100 }
    });
  });

  afterEach(async () => {
    await service.shutdown();
    LoggerService['instance'] = undefined as any;
  });

  describe('Basic Functionality', () => {
    it('should be a singleton', () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export singleton instance as logger', () => {
      expect(logger).toBe(LoggerService.getInstance());
    });

    it('should log messages at appropriate levels', () => {
      service.info('info message');
      service.warn('warn message');
      service.error('error message');

      expect(consoleSpy.log).toHaveBeenCalledWith('[INFO]', 'info message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'warn message');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR]', 'error message');
    });

    it('should respect log level settings', () => {
      service['config'].level = 'warn';
      
      service.debug('debug message');
      service.info('info message');
      service.warn('warn message');
      service.error('error message');

      expect(consoleSpy.log).not.toHaveBeenCalledWith('[DEBUG]', 'debug message');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('[INFO]', 'info message');
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', 'warn message');
      expect(consoleSpy.error).toHaveBeenCalledWith('[ERROR]', 'error message');
    });

    it('should format messages with multiple arguments', () => {
      service.info('User', { id: 123 }, 'logged in');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[INFO]',
        'User',
        { id: 123 },
        'logged in'
      );
    });
  });

  describe('Buffering', () => {
    it('should buffer log entries when enabled', () => {
      service.info('buffered message');
      
      const buffer = service.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('info');
      expect(buffer[0].message).toContain('buffered message');
    });

    it('should respect max buffer size', () => {
      service['config'].buffer.maxSize = 3;
      
      for (let i = 0; i < 5; i++) {
        service.info(`message ${i}`);
      }
      
      const buffer = service.getBuffer();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].message).toContain('message 2');
    });

    it('should flush buffer', () => {
      service.info('message 1');
      service.info('message 2');
      
      expect(service.getBuffer()).toHaveLength(2);
      
      service.flush();
      expect(service.getBuffer()).toHaveLength(0);
    });

    it('should auto-flush when threshold reached', () => {
      service['config'].buffer.flushThreshold = 2;
      
      service.info('message 1');
      expect(service.getBuffer()).toHaveLength(1);
      
      service.info('message 2');
      expect(service.getBuffer()).toHaveLength(0); // Auto-flushed
    });
  });

  describe('Statistics', () => {
    it('should track log statistics', () => {
      service.debug('debug');
      service.info('info');
      service.info('info2');
      service.warn('warn');
      service.error('error');
      
      const stats = service.getStatistics();
      expect(stats.debug).toBe(1);
      expect(stats.info).toBe(2);
      expect(stats.warn).toBe(1);
      expect(stats.error).toBe(1);
      expect(stats.total).toBe(5);
    });

    it('should reset statistics', () => {
      service.info('message');
      service.error('error');
      
      service.resetStatistics();
      const stats = service.getStatistics();
      
      expect(stats.total).toBe(0);
      expect(stats.info).toBe(0);
      expect(stats.error).toBe(0);
    });

    it('should track total bytes logged', () => {
      service.info('test message');
      
      const stats = service.getStatistics();
      expect(stats.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('Child Loggers', () => {
    it('should create child logger with context', () => {
      const child = service.child({ module: 'test-module' });
      
      child.info('child message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[INFO]',
        '[test-module]',
        'child message'
      );
    });

    it('should inherit parent configuration', () => {
      service['config'].level = 'warn';
      const child = service.child({ module: 'child' });
      
      child.info('should not log');
      child.warn('should log');
      
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN]', '[child]', 'should log');
    });

    it('should combine nested contexts', () => {
      const child1 = service.child({ module: 'parent' });
      const child2 = child1.child({ submodule: 'child' });
      
      child2.info('nested message');
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[INFO]',
        '[parent:child]',
        'nested message'
      );
    });
  });

  describe('Pretty Print', () => {
    it('should pretty print objects when enabled', () => {
      service['config'].prettyPrint = true;
      
      const obj = { user: { id: 123, name: 'Test' } };
      service.info('User data:', obj);
      
      expect(consoleSpy.log).toHaveBeenCalled();
      const call = consoleSpy.log.mock.calls[0];
      expect(call).toContain('[INFO]');
      expect(call).toContain('User data:');
      expect(JSON.stringify(call)).toContain('"id":123');
    });

    it('should handle circular references', () => {
      service['config'].prettyPrint = true;
      
      const obj: any = { a: 1 };
      obj.circular = obj;
      
      expect(() => service.info('Circular:', obj)).not.toThrow();
      expect(consoleSpy.log).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should format error objects', () => {
      const error = new Error('Test error');
      service.error('Operation failed:', error);
      
      expect(consoleSpy.error).toHaveBeenCalled();
      const call = consoleSpy.error.mock.calls[0];
      expect(call).toContain('[ERROR]');
      expect(call).toContain('Operation failed:');
      expect(call.some((arg: any) => arg instanceof Error)).toBe(true);
    });

    it('should extract stack traces when pretty printing', () => {
      service['config'].prettyPrint = true;
      
      const error = new Error('Test error');
      service.error(error);
      
      const call = consoleSpy.error.mock.calls[0];
      expect(JSON.stringify(call)).toContain('Test error');
    });
  });

  describe('Lifecycle', () => {
    it('should perform health check', async () => {
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toHaveProperty('bufferSize');
      expect(health.details).toHaveProperty('statistics');
      expect(health.details).toHaveProperty('configLevel');
    });

    it('should flush on shutdown', async () => {
      service.info('message before shutdown');
      expect(service.getBuffer().length).toBeGreaterThan(0);
      
      await service.shutdown();
      expect(service.getBuffer()).toHaveLength(0);
    });

    it('should clear flush interval on shutdown', async () => {
      service['config'].buffer.flushInterval = 100;
      service['startFlushInterval']();
      
      expect(service['flushInterval']).toBeDefined();
      
      await service.shutdown();
      expect(service['flushInterval']).toBeUndefined();
    });
  });

  describe('Browser Compatibility', () => {
    it('should not use Node.js specific features', () => {
      // Ensure no Node.js modules are imported
      const moduleCode = LoggerService.toString();
      expect(moduleCode).not.toContain('require(');
      expect(moduleCode).not.toContain('process.env');
      expect(moduleCode).not.toContain('fs');
      expect(moduleCode).not.toContain('path');
    });

    it('should handle undefined console methods gracefully', () => {
      const originalWarn = console.warn;
      (console as any).warn = undefined;
      
      expect(() => service.warn('test')).not.toThrow();
      
      console.warn = originalWarn;
    });
  });

  describe('Integration', () => {
    it('should work with structured logging', () => {
      const requestLogger = service.child({ 
        requestId: '123',
        userId: 'user-456' 
      });
      
      requestLogger.info('Request started');
      requestLogger.error('Request failed', new Error('Network error'));
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        '[INFO]',
        '[123:user-456]',
        'Request started'
      );
    });

    it('should support method chaining patterns', () => {
      const result = service
        .child({ module: 'test' })
        .info('chained message');
      
      // Child logger returns void, but shouldn't throw
      expect(result).toBeUndefined();
    });
  });
});