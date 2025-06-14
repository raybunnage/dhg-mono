// Temporary JavaScript wrapper for BusinessService
const { BaseService } = require('./BaseService');

class BusinessService extends BaseService {
  constructor(serviceName, dependencies, logger) {
    super(serviceName, logger);
    this.dependencies = dependencies;
  }

  async initialize() {
    // To be implemented by subclasses
  }

  async cleanup() {
    // To be implemented by subclasses
  }

  async withTransaction(operation) {
    return operation();
  }

  async withRetry(operation, options = {}) {
    const { 
      maxAttempts = 3, 
      delay = 1000, 
      backoff = 2,
      operationName = 'operation'
    } = options;

    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const start = Date.now();
        const result = await operation();
        const duration = Date.now() - start;
        
        if (this.logger) {
          this.logger.debug(`${this.serviceName}.${operationName} completed in ${duration}ms`);
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        if (this.logger) {
          this.logger.warn(
            `${this.serviceName}.${operationName} attempt ${attempt} failed: ${error.message}`
          );
        }
        
        if (attempt < maxAttempts) {
          const waitTime = delay * Math.pow(backoff, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }
    
    throw lastError;
  }

  async validateInput(input, validationFn) {
    if (validationFn) {
      validationFn(input);
    }
    return input;
  }

  async timeOperation(operationName, operation) {
    const start = Date.now();
    try {
      const result = await operation();
      const duration = Date.now() - start;
      
      if (this.logger) {
        this.logger.debug(`${this.serviceName}.${operationName} completed in ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      if (this.logger) {
        this.logger.error(`${this.serviceName}.${operationName} failed after ${duration}ms: ${error.message}`);
      }
      
      throw error;
    }
  }
}

module.exports = { BusinessService };