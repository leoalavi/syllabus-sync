import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// API RESPONSE HELPERS
// ============================================================================

/**
 * Standard API Response Format
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Standard API Error Codes
 */
export const ERROR_CODES = {
  // Client Errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server Errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Create a success response
 */
export const jsonSuccess = <T = unknown>(
  data: T,
  status: number = 200,
  meta?: Partial<ApiResponse['meta']>,
  init?: Omit<ResponseInit, 'status'>,
): NextResponse<ApiResponse<T>> => {
  try {
    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...meta,
        },
      },
      { status, ...init },
    );
  } catch (error) {
    // SECURITY: If data contains circular references, JSON.stringify (used by NextResponse.json) will fail.
    // Return a generic internal error instead of letting it crash the process.
    logger.error('Response serialization error:', error);
    return jsonError('Response serialization failed', 500, ERROR_CODES.INTERNAL_ERROR);
  }
};

export function applyNoStoreHeaders<T extends NextResponse>(response: T): T {
  if (!response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  }

  if (!response.headers.has('Pragma')) {
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

/**
 * Create an error response
 */
export const jsonError = (
  message: string,
  status: number = 500,
  code?: ErrorCode,
  details?: Record<string, unknown>,
): NextResponse<ApiResponse<never>> => {
  const errorCode = code || getErrorCodeFromStatus(status);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status },
  );
};

/**
 * Handle Zod validation errors
 */
export const handleValidationError = (error: ZodError): NextResponse<ApiResponse<never>> => {
  const details = error.issues.reduce(
    (acc, err) => {
      const field = err.path.join('.');
      if (!acc[field]) acc[field] = [];
      acc[field].push(err.message);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  return jsonError('Validation failed', 400, ERROR_CODES.VALIDATION_ERROR, {
    fields: details,
  });
};

/**
 * Handle database errors
 */
export const handleDatabaseError = (error: unknown): NextResponse<ApiResponse<never>> => {
  // Log detailed error information server-side
  const err = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  logger.error('Database error:', {
    code: err.code,
    message: err.message,
    details: err.details,
    hint: err.hint,
    fullError: error,
  });

  // Don't expose internal database errors to clients
  // SECURITY: Use VERCEL_ENV for reliable production detection
  // This prevents error detail exposure even if NODE_ENV is misconfigured
  const isRealProduction =
    process.env.VERCEL_ENV === 'production' ||
    (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV);

  return jsonError(
    'A database error occurred',
    500,
    ERROR_CODES.DATABASE_ERROR,
    !isRealProduction
      ? {
          originalError: error instanceof Error ? error.message : String(error),
        }
      : undefined,
  );
};

/**
 * Handle authentication errors
 */
export const jsonUnauthorized = (
  message: string = 'Authentication required',
): NextResponse<ApiResponse<never>> => {
  return jsonError(message, 401, ERROR_CODES.UNAUTHORIZED);
};

/**
 * Handle forbidden access errors
 */
export const jsonForbidden = (
  message: string = 'Access denied',
): NextResponse<ApiResponse<never>> => {
  return jsonError(message, 403, ERROR_CODES.FORBIDDEN);
};

/**
 * Handle not found errors
 */
export const jsonNotFound = (resource: string = 'Resource'): NextResponse<ApiResponse<never>> => {
  return jsonError(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND);
};

/**
 * Create paginated response
 */
export const jsonPaginated = <T = unknown>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): NextResponse<ApiResponse<T[]>> => {
  const totalPages = Math.ceil(total / limit);

  return jsonSuccess(data, 200, {
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Map HTTP status code to error code
 */
function getErrorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ERROR_CODES.BAD_REQUEST;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Generate request ID for tracking
 */
export const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

// ============================================================================
// BODY SIZE LIMITS
// ============================================================================

/**
 * Default body size limits (in bytes)
 * SECURITY: Prevent DoS attacks via large request bodies
 */
export const BODY_SIZE_LIMITS = {
  /** Default limit for JSON payloads (100KB) */
  DEFAULT: 100 * 1024,
  /** Smaller limit for auth endpoints (10KB) */
  AUTH: 10 * 1024,
  /** Larger limit for file uploads (5MB) */
  UPLOAD: 5 * 1024 * 1024,
  /** Admin endpoints (50KB) */
  ADMIN: 50 * 1024,
} as const;

/**
 * Check if request body exceeds size limit using Content-Length header
 * SECURITY: This is a first-line defense; actual parsing may still fail for streams
 *
 * @param request - The incoming request
 * @param maxBytes - Maximum allowed body size in bytes
 * @returns Error response if exceeded, null if within limits
 */
export function checkBodySize(
  request: Request,
  maxBytes: number = BODY_SIZE_LIMITS.DEFAULT,
): NextResponse<ApiResponse<never>> | null {
  const contentLength = request.headers.get('content-length');

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxBytes) {
      return jsonError(
        `Request body too large. Maximum size is ${Math.round(maxBytes / 1024)}KB`,
        413,
        ERROR_CODES.BAD_REQUEST,
        { maxBytes, receivedBytes: size },
      );
    }
  }

  return null;
}

/**
 * Parse JSON body with size limit validation
 * SECURITY: Safer than direct request.json() as it enforces size limits
 *
 * @param request - The incoming request
 * @param maxBytes - Maximum allowed body size in bytes
 * @returns Parsed JSON or error response
 */
export async function parseJsonBody<T = unknown>(
  request: Request,
  maxBytes: number = BODY_SIZE_LIMITS.DEFAULT,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse<ApiResponse<never>> }> {
  // Check Content-Length header first
  const sizeError = checkBodySize(request, maxBytes);
  if (sizeError) {
    return { data: null, error: sizeError };
  }

  try {
    // Count bytes while reading; request.text() would buffer an unbounded body first.
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Empty JSON body');
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel();
        return {
          data: null,
          error: jsonError(
            `Request body too large. Maximum size is ${Math.round(maxBytes / 1024)}KB`,
            413,
            ERROR_CODES.BAD_REQUEST,
            { maxBytes, receivedBytes },
          ),
        };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const data = JSON.parse(text) as T;
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: jsonError('Invalid JSON body', 400, ERROR_CODES.BAD_REQUEST),
    };
  }
}
