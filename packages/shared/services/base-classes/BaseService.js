// Temporary JavaScript wrapper for BaseService
class BaseService {
  constructor(serviceName, logger) {
    this.serviceName = serviceName;
    this.logger = logger;
    this.initialized = false;
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
      this.initialized = true;
    }
  }

  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  async cleanup() {
    throw new Error('cleanup() must be implemented by subclass');
  }

  async shutdown() {
    if (this.initialized) {
      await this.cleanup();
      this.initialized = false;
    }
  }

  isInitialized() {
    return this.initialized;
  }

  async healthCheck() {
    throw new Error('healthCheck() must be implemented by subclass');
  }
}

module.exports = { BaseService };