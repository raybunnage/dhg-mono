import { BaseService, HealthCheckResult, Logger } from '../BaseService';

// Mock logger
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn()
};

// Test implementation
class TestService extends BaseService {
  public initializeCalled = false;
  public cleanupCalled = false;
  
  constructor(logger?: Logger) {
    super('TestService', logger);
  }
  
  protected async initialize(): Promise<void> {
    this.initializeCalled = true;
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  protected async cleanup(): Promise<void> {
    this.cleanupCalled = true;
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this.initialized,
      timestamp: new Date(),
      details: { test: true }
    };
  }
  
  // Expose for testing
  async testEnsureInitialized(): Promise<void> {
    await this.ensureInitialized();
  }
}

describe('BaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize on first use', async () => {
      const service = new TestService(mockLogger);
      expect(service.initializeCalled).toBe(false);
      
      await service.testEnsureInitialized();
      
      expect(service.initializeCalled).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting initialization of TestService');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('TestService initialized successfully'));
    });
    
    it('should not initialize twice', async () => {
      const service = new TestService(mockLogger);
      
      await service.testEnsureInitialized();
      const firstCallCount = (mockLogger.info as jest.Mock).mock.calls.length;
      
      await service.testEnsureInitialized();
      const secondCallCount = (mockLogger.info as jest.Mock).mock.calls.length;
      
      expect(secondCallCount).toBe(firstCallCount); // No additional calls
    });
    
    it('should handle concurrent initialization attempts', async () => {
      const service = new TestService(mockLogger);
      
      // Start multiple initialization attempts
      const promises = [
        service.testEnsureInitialized(),
        service.testEnsureInitialized(),
        service.testEnsureInitialized()
      ];
      
      await Promise.all(promises);
      
      // Should only initialize once
      expect(mockLogger.info).toHaveBeenCalledWith('Starting initialization of TestService');
      expect(mockLogger.info).toHaveBeenCalledTimes(2); // Start + complete
    });
  });
  
  describe('shutdown', () => {
    it('should cleanup on shutdown', async () => {
      const service = new TestService(mockLogger);
      await service.testEnsureInitialized();
      
      expect(service.cleanupCalled).toBe(false);
      
      await service.shutdown();
      
      expect(service.cleanupCalled).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Starting shutdown of TestService');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('TestService shut down successfully'));
    });
    
    it('should not shutdown if not initialized', async () => {
      const service = new TestService(mockLogger);
      
      await service.shutdown();
      
      expect(service.cleanupCalled).toBe(false);
      expect(mockLogger.info).not.toHaveBeenCalledWith('Starting shutdown of TestService');
    });
  });
  
  describe('metadata', () => {
    it('should return correct metadata', () => {
      const service = new TestService();
      const metadata = service.getMetadata();
      
      expect(metadata).toEqual({
        name: 'TestService',
        initialized: false,
        type: 'TestService',
        version: '1.0.0'
      });
    });
  });
  
  describe('health check', () => {
    it('should report healthy when initialized', async () => {
      const service = new TestService();
      await service.testEnsureInitialized();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.details).toEqual({ test: true });
    });
    
    it('should report unhealthy when not initialized', async () => {
      const service = new TestService();
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
    });
  });
  
  describe('timeOperation', () => {
    it('should time successful operations', async () => {
      const service = new TestService(mockLogger);
      
      const result = await (service as any).timeOperation('testOp', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'success';
      });
      
      expect(result).toBe('success');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/TestService\.testOp completed in \d+ms/)
      );
    });
    
    it('should time failed operations', async () => {
      const service = new TestService(mockLogger);
      
      await expect(
        (service as any).timeOperation('testOp', async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringMatching(/TestService\.testOp failed after \d+ms:/),
        expect.any(Error)
      );
    });
  });
});