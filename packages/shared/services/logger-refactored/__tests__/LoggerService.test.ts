import { describe, it, expect, beforeEach, afterEach, vi, SpyInstance } from 'vitest';
import { LoggerService, LogLevel, ChildLogger } from '../LoggerService';
import { SingletonService } from '../../base-classes/SingletonService';

describe('LoggerService', () => {
  let consoleErrorSpy: SpyInstance;
  let consoleWarnSpy: SpyInstance;
  let consoleInfoSpy: SpyInstance;
  let consoleDebugSpy: SpyInstance;
  let consoleLogSpy: SpyInstance;

  beforeEach(() => {
    // Clear singleton instances
    (SingletonService as any).instances.clear();
    
    // Spy on console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    (SingletonService as any).instances.clear();
    vi.restoreAllMocks();
  });

  describe('singleton behavior', () => {
    it('should return the same instance', () => {
      const instance1 = LoggerService.getInstance();
      const instance2 = LoggerService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should extend SingletonService', () => {
      const instance = LoggerService.getInstance();
      expect(instance).toBeInstanceOf(SingletonService);
    });

    it('should update config when getInstance is called with config', () => {
      const instance1 = LoggerService.getInstance({ level: LogLevel.ERROR });
      const instance2 = LoggerService.getInstance({ level: LogLevel.DEBUG });
      
      expect(instance1).toBe(instance2);
      // Config should be updated to DEBUG
      instance1.debug('test message');
      expect(consoleDebugSpy).toHaveBeenCalled();
    });
  });

  describe('initialization', () => {
    it('should initialize with default config', async () => {
      const logger = LoggerService.getInstance();
      await logger.ensureInitialized();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LoggerService] Initializing with config:'),
        expect.objectContaining({
          level: LogLevel.INFO,
          environment: 'development',
          buffering: false,
          maxLogSize: 1000
        })
      );
    });

    it('should initialize with custom config', async () => {
      const logger = LoggerService.getInstance({
        level: LogLevel.DEBUG,
        enableBuffering: true,
        maxLogSize: 500,
        serviceName: 'TestService',
        environment: 'test'
      });
      await logger.ensureInitialized();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LoggerService] Initializing with config:'),
        expect.objectContaining({
          level: LogLevel.DEBUG,
          environment: 'test',
          buffering: true,
          maxLogSize: 500
        })
      );
    });

    it('should set up flush interval when buffering is enabled', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      const logger = LoggerService.getInstance({ enableBuffering: true });
      await logger.ensureInitialized();
      
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe('log levels', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({ level: LogLevel.INFO });
      await logger.ensureInitialized();
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Error message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Warning message')
      );
    });

    it('should log info messages', () => {
      logger.info('Info message');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Info message')
      );
    });

    it('should not log debug messages when level is INFO', () => {
      logger.debug('Debug message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages when level is DEBUG', () => {
      logger.updateConfig({ level: LogLevel.DEBUG });
      logger.debug('Debug message');
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Debug message')
      );
    });

    it('should respect log level hierarchy', () => {
      // Set to ERROR - only errors should log
      logger.updateConfig({ level: LogLevel.ERROR });
      
      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');
      
      expect(consoleDebugSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('log formatting', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({
        level: LogLevel.INFO,
        includeTimestamp: true,
        serviceName: 'TestService'
      });
      await logger.ensureInitialized();
    });

    it('should include service name in logs', () => {
      logger.info('Test message');
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestService]')
      );
    });

    it('should include timestamp when configured', () => {
      logger.info('Test message');
      const logCall = consoleInfoSpy.mock.calls[0][0];
      // Should contain ISO timestamp format
      expect(logCall).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should not include timestamp when disabled', () => {
      logger.updateConfig({ includeTimestamp: false });
      logger.info('Test message');
      const logCall = consoleInfoSpy.mock.calls[0][0];
      // Should not contain ISO timestamp format
      expect(logCall).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should pretty print JSON when configured', () => {
      logger.updateConfig({ prettyPrint: true });
      logger.info('Test message', { data: { nested: 'value' } });
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('\n');
      expect(logCall).toContain('  '); // Indentation
    });

    it('should format errors with stack traces', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at TestFile.js:10:5\n    at Runner.js:20:10';
      
      logger.error('An error occurred', error);
      
      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toContain('"name": "Error"');
      expect(logCall).toContain('"message": "Test error"');
      expect(logCall).toContain('"stack"');
    });
  });

  describe('context management', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({ level: LogLevel.INFO });
      await logger.ensureInitialized();
    });

    it('should set and include context in logs', () => {
      logger.setContext({ userId: '123', requestId: 'abc' });
      logger.info('User action');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('"userId": "123"');
      expect(logCall).toContain('"requestId": "abc"');
    });

    it('should merge additional context', () => {
      logger.setContext({ userId: '123' });
      logger.info('User action', { action: 'login' });
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('"userId": "123"');
      expect(logCall).toContain('"action": "login"');
    });

    it('should clear specific context key', () => {
      logger.setContext({ userId: '123', requestId: 'abc' });
      logger.clearContext('userId');
      logger.info('Test');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).not.toContain('"userId"');
      expect(logCall).toContain('"requestId": "abc"');
    });

    it('should clear all context', () => {
      logger.setContext({ userId: '123', requestId: 'abc' });
      logger.clearContext();
      logger.info('Test');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).not.toContain('"userId"');
      expect(logCall).not.toContain('"requestId"');
    });

    it('should get current context', () => {
      logger.setContext({ userId: '123', requestId: 'abc' });
      const context = logger.getContext();
      
      expect(context).toEqual({ userId: '123', requestId: 'abc' });
    });
  });

  describe('buffering', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({
        level: LogLevel.INFO,
        enableBuffering: true,
        maxLogSize: 5
      });
      await logger.ensureInitialized();
    });

    it('should buffer logs when enabled', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      
      // Console should not be called yet
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      
      // Check buffer
      const buffer = logger.getBufferedLogs();
      expect(buffer).toHaveLength(2);
      expect(buffer[0].message).toBe('Message 1');
      expect(buffer[1].message).toBe('Message 2');
    });

    it('should flush buffer manually', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      
      logger.flushBuffer();
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
      expect(logger.getBufferedLogs()).toHaveLength(0);
    });

    it('should auto-flush when buffer is 90% full', () => {
      // maxLogSize is 5, so 90% is 4.5 - should flush at 5
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');
      logger.info('Message 4');
      
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      
      // This should trigger auto-flush
      logger.info('Message 5');
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(5);
      expect(logger.getBufferedLogs()).toHaveLength(0);
    });

    it('should trim old logs when buffer exceeds max size', () => {
      // Disable auto-flush for this test
      logger.updateConfig({ maxLogSize: 3 });
      
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');
      logger.info('Message 4'); // Should remove Message 1
      
      const buffer = logger.getBufferedLogs();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].message).toBe('Message 2');
      expect(buffer[2].message).toBe('Message 4');
    });

    it('should clear buffer', () => {
      logger.info('Message 1');
      logger.info('Message 2');
      
      logger.clearBuffer();
      
      expect(logger.getBufferedLogs()).toHaveLength(0);
      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({ level: LogLevel.DEBUG });
      await logger.ensureInitialized();
      logger.resetStatistics();
    });

    it('should track log counts by level', () => {
      logger.error('Error 1');
      logger.error('Error 2');
      logger.warn('Warning');
      logger.info('Info 1');
      logger.info('Info 2');
      logger.info('Info 3');
      logger.debug('Debug');
      
      const stats = logger.getStatistics();
      expect(stats[LogLevel.ERROR]).toBe(2);
      expect(stats[LogLevel.WARN]).toBe(1);
      expect(stats[LogLevel.INFO]).toBe(3);
      expect(stats[LogLevel.DEBUG]).toBe(1);
      expect(stats.total).toBe(7);
    });

    it('should track first and last log times', async () => {
      const beforeTime = new Date();
      
      logger.info('First log');
      await new Promise(resolve => setTimeout(resolve, 10));
      logger.info('Second log');
      
      const stats = logger.getStatistics();
      expect(stats.firstLogTime).toBeDefined();
      expect(stats.lastLogTime).toBeDefined();
      expect(stats.firstLogTime!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(stats.lastLogTime!.getTime()).toBeGreaterThan(stats.firstLogTime!.getTime());
    });

    it('should reset statistics', () => {
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      
      logger.resetStatistics();
      
      const stats = logger.getStatistics();
      expect(stats[LogLevel.ERROR]).toBe(0);
      expect(stats[LogLevel.WARN]).toBe(0);
      expect(stats[LogLevel.INFO]).toBe(0);
      expect(stats[LogLevel.DEBUG]).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.firstLogTime).toBeUndefined();
      expect(stats.lastLogTime).toBeUndefined();
    });
  });

  describe('child loggers', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({ level: LogLevel.INFO });
      await logger.ensureInitialized();
    });

    it('should create child logger with additional context', () => {
      const childLogger = logger.child({ module: 'AuthModule' });
      
      childLogger.info('Login attempt');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('"module": "AuthModule"');
    });

    it('should merge parent and child context', () => {
      logger.setContext({ app: 'MyApp' });
      const childLogger = logger.child({ module: 'AuthModule' });
      
      childLogger.info('Login attempt', { userId: '123' });
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('"app": "MyApp"');
      expect(logCall).toContain('"module": "AuthModule"');
      expect(logCall).toContain('"userId": "123"');
    });

    it('should support nested child loggers', () => {
      const childLogger1 = logger.child({ module: 'AuthModule' });
      const childLogger2 = childLogger1.child({ method: 'login' });
      
      childLogger2.info('Attempt');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('"module": "AuthModule"');
      expect(logCall).toContain('"method": "login"');
    });

    it('should handle all log levels', () => {
      const childLogger = logger.child({ module: 'TestModule' });
      
      childLogger.error('Error', new Error('Test'));
      childLogger.warn('Warning');
      childLogger.info('Info');
      childLogger.debug('Debug'); // Won't log due to level
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    it('should report healthy status', async () => {
      const logger = LoggerService.getInstance({
        level: LogLevel.INFO,
        serviceName: 'TestService',
        environment: 'test'
      });
      await logger.ensureInitialized();
      
      logger.setContext({ app: 'MyApp' });
      logger.info('Test log');
      
      const health = await logger.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.details).toEqual({
        level: LogLevel.INFO,
        environment: 'test',
        bufferSize: 0,
        statistics: expect.objectContaining({
          [LogLevel.INFO]: 1,
          total: 1
        }),
        contextKeys: ['app']
      });
    });

    it('should include buffer size when buffering is enabled', async () => {
      const logger = LoggerService.getInstance({
        enableBuffering: true
      });
      await logger.ensureInitialized();
      
      logger.info('Message 1');
      logger.info('Message 2');
      
      const health = await logger.healthCheck();
      expect(health.details.bufferSize).toBe(2);
    });
  });

  describe('configuration updates', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance();
      await logger.ensureInitialized();
    });

    it('should update log level', () => {
      logger.updateConfig({ level: LogLevel.ERROR });
      
      logger.info('Should not log');
      logger.error('Should log');
      
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should update service name', () => {
      logger.updateConfig({ serviceName: 'UpdatedService' });
      logger.info('Test');
      
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('[UpdatedService]')
      );
    });

    it('should force disable file logging', () => {
      logger.updateConfig({ logToFile: true });
      
      // @ts-ignore - accessing private property for test
      expect(logger.config.logToFile).toBe(false);
    });

    it('should trim buffer when reducing max size', () => {
      logger.updateConfig({ enableBuffering: true, maxLogSize: 10 });
      
      // Add 10 logs
      for (let i = 1; i <= 10; i++) {
        logger.info(`Message ${i}`);
      }
      
      // Reduce max size
      logger.updateConfig({ maxLogSize: 3 });
      
      const buffer = logger.getBufferedLogs();
      expect(buffer).toHaveLength(3);
      expect(buffer[0].message).toBe('Message 8');
      expect(buffer[2].message).toBe('Message 10');
    });
  });

  describe('error handling', () => {
    let logger: LoggerService;

    beforeEach(async () => {
      logger = LoggerService.getInstance({ level: LogLevel.INFO });
      await logger.ensureInitialized();
    });

    it('should handle Error objects', () => {
      const error = new Error('Test error');
      logger.error('An error occurred', error);
      
      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toContain('An error occurred');
      expect(logCall).toContain('"name": "Error"');
      expect(logCall).toContain('"message": "Test error"');
    });

    it('should handle errors with cause', () => {
      const cause = new Error('Root cause');
      const error = new Error('Main error', { cause });
      
      logger.error('Complex error', error);
      
      const logCall = consoleErrorSpy.mock.calls[0][0];
      expect(logCall).toContain('"message": "Main error"');
      expect(logCall).toContain('"cause"');
      expect(logCall).toContain('"message": "Root cause"');
    });

    it('should handle non-Error objects', () => {
      logger.error('String error', 'Something went wrong');
      logger.error('Object error', { code: 'ERR_001', details: 'Failed' });
      
      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Something went wrong');
      expect(consoleErrorSpy.mock.calls[1][0]).toContain('"code": "ERR_001"');
    });
  });

  describe('environment integration', () => {
    it('should include environment in context when not development', async () => {
      const logger = LoggerService.getInstance({ environment: 'production' });
      await logger.ensureInitialized();
      
      logger.info('Production log');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).toContain('"env": "production"');
    });

    it('should not include environment in development', async () => {
      const logger = LoggerService.getInstance({ environment: 'development' });
      await logger.ensureInitialized();
      
      logger.info('Dev log');
      
      const logCall = consoleInfoSpy.mock.calls[0][0];
      expect(logCall).not.toContain('"env"');
    });
  });

  describe('lifecycle management', () => {
    it('should flush buffer on shutdown', async () => {
      const logger = LoggerService.getInstance({
        enableBuffering: true
      });
      await logger.ensureInitialized();
      
      logger.info('Message 1');
      logger.info('Message 2');
      
      // Force shutdown
      await (logger as any).shutdown();
      
      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[LoggerService] Shutdown complete. Total logs: 2')
      );
    });
  });

  describe('compatibility', () => {
    it('should have getBuffer alias for getBufferedLogs', () => {
      const logger = LoggerService.getInstance({ enableBuffering: true });
      logger.info('Test');
      
      const buffer1 = logger.getBufferedLogs();
      const buffer2 = logger.getBuffer();
      
      expect(buffer1).toEqual(buffer2);
    });
  });
});