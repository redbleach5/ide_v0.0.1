/**
 * Logger utility for development and production
 * Provides structured logging with different log levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    // In production, only show warnings and errors
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    return args.length > 0 
      ? `${prefix} ${message} ${JSON.stringify(args)}`
      : `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(this.formatMessage('DEBUG', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage('INFO', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      const errorInfo = error instanceof Error 
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(this.formatMessage('ERROR', message, errorInfo, ...args));
    }
  }

  // Log to file in production (if needed)
  logToFile(level: string, message: string, data?: any): void {
    // In a real implementation, this could send logs to a file or remote service
    if (!this.isDevelopment) {
      // Could integrate with a logging service like Sentry, LogRocket, etc.
      this.debug(`[FILE] ${level}: ${message}`, data);
    }
  }
}

export const logger = new Logger();
