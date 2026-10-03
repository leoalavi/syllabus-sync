import { logger } from '@/lib/logger';
import { getClientIPFromHeaders } from '@/lib/security/ip';
/**
 * Request Logging Utility
 *
 * Provides structured logging for API requests in production.
 * Logs are formatted for easy parsing by log aggregation services (Vercel, Datadog, etc.)
 */

export interface RequestLogData {
  method: string;
  path: string;
  status: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  userId?: string;
  error?: string;
}

export interface LoggerOptions {
  /** Enable logging (default: true in production) */
  enabled?: boolean;
  /** Log level threshold */
  level?: 'debug' | 'info' | 'warn' | 'error';
  /** Include request body in logs (use with caution - may contain sensitive data) */
  includeBody?: boolean;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Request Logger class for structured API logging
 */
export class RequestLogger {
  private options: Required<LoggerOptions>;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      enabled: options.enabled ?? process.env.NODE_ENV === 'production',
      level: options.level ?? 'info',
      includeBody: options.includeBody ?? false,
    };
  }

  /**
   * Log an API request
   */
  log(data: RequestLogData): void {
    if (!this.options.enabled) return;

    const level = data.status >= 500 ? 'error' : data.status >= 400 ? 'warn' : 'info';

    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.level]) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'api_request',
      ...data,
    };

    // Use appropriate console method based on level
    switch (level) {
      case 'error':
        logger.error(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      default:
        // In production, use console.log for info to avoid cluttering error logs
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Log a successful request
   */
  success(data: Omit<RequestLogData, 'status'> & { status?: number }): void {
    this.log({ ...data, status: data.status ?? 200 });
  }

  /**
   * Log a failed request
   */
  error(data: Omit<RequestLogData, 'status'> & { status?: number; error?: string }): void {
    this.log({ ...data, status: data.status ?? 500 });
  }

  /**
   * Create a request timer for measuring duration
   */
  startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }
}

// Default logger instance
export const requestLogger = new RequestLogger();

/**
 * Extract client IP from request headers
 * SECURITY: Only trust verified proxy headers
 */
export function extractClientIP(headers: Headers): string {
  return getClientIPFromHeaders(headers);
}

/**
 * Sanitize user agent for logging (truncate if too long)
 */
export function sanitizeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'unknown';
  // Truncate to prevent log injection or excessive log size
  return userAgent.substring(0, 200);
}

/**
 * Higher-order function to wrap API handlers with logging
 */
export function withRequestLogging(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const timer = requestLogger.startTimer();
    const url = new URL(request.url);

    try {
      const response = await handler(request);
      const duration = timer();

      requestLogger.log({
        method: request.method,
        path: url.pathname,
        status: response.status,
        duration,
        ip: extractClientIP(request.headers),
        userAgent: sanitizeUserAgent(request.headers.get('user-agent')),
      });

      return response;
    } catch (error) {
      const duration = timer();

      requestLogger.error({
        method: request.method,
        path: url.pathname,
        status: 500,
        duration,
        ip: extractClientIP(request.headers),
        userAgent: sanitizeUserAgent(request.headers.get('user-agent')),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  };
}
