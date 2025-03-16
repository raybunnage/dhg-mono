import winston from 'winston';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private static instance: winston.Logger;
  static level: LogLevel = LogLevel.INFO;

  private static getInstance(): winston.Logger {
    if (!Logger.instance) {
      const { combine, timestamp, printf, colorize } = winston.format;

      const customFormat = printf(({ level, message, timestamp, data }) => {
        const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
        return `${timestamp} [${level}]: ${message}${dataStr}`;
      });

      Logger.instance = winston.createLogger({
        level: Logger.getWinstonLevel(),
        format: combine(
          timestamp(),
          colorize(),
          customFormat
        ),
        transports: [
          new winston.transports.Console()
        ]
      });
    }
    return Logger.instance;
  }

  private static getWinstonLevel(): string {
    switch (Logger.level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
        return 'error';
      default:
        return 'info';
    }
  }

  static setLevel(level: LogLevel): void {
    Logger.level = level;
    if (Logger.instance) {
      Logger.instance.level = Logger.getWinstonLevel();
    }
  }

  static debug(message: string, data?: any): void {
    if (Logger.level <= LogLevel.DEBUG) {
      Logger.getInstance().debug(message, { data });
    }
  }

  static info(message: string, data?: any): void {
    if (Logger.level <= LogLevel.INFO) {
      Logger.getInstance().info(message, { data });
    }
  }

  static warn(message: string, data?: any): void {
    if (Logger.level <= LogLevel.WARN) {
      Logger.getInstance().warn(message, { data });
    }
  }

  static error(message: string, data?: any): void {
    if (Logger.level <= LogLevel.ERROR) {
      Logger.getInstance().error(message, { data });
    }
  }
}

export { Logger };