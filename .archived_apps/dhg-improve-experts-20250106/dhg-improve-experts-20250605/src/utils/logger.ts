/**
 * Simple logger utility
 */
export class Logger {
  static debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }
  
  static info(message: string, ...args: any[]) {
    console.info(`[INFO] ${message}`, ...args);
  }
  
  static warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }
  
  static error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}