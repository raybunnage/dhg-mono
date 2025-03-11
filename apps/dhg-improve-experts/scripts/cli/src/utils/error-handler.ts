import { Logger } from './logger';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'UNKNOWN_ERROR',
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ErrorHandler {
  /**
   * Central error handling for the application
   */
  static handle(error: Error | AppError, exitProcess: boolean = false): void {
    if (error instanceof AppError) {
      Logger.error(`${error.code}: ${error.message}`, error.details);
    } else {
      Logger.error(`UNHANDLED_ERROR: ${error.message}`, error.stack);
    }

    if (exitProcess) {
      Logger.info('Exiting process due to error');
      process.exit(1);
    }
  }

  /**
   * Wrap an async function with error handling
   */
  static async wrap<T>(
    fn: () => Promise<T>,
    errorMessage: string = 'Operation failed'
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      } else if (error instanceof Error) {
        throw new AppError(
          `${errorMessage}: ${error.message}`,
          'OPERATION_FAILED'
        );
      } else {
        throw new AppError(
          `${errorMessage}: Unknown error occurred`,
          'UNKNOWN_ERROR'
        );
      }
    }
  }
}