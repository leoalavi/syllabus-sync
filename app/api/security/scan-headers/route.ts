/**
 * Security Headers Scan API Endpoint
 *
 * SECURITY: This endpoint scans a URL for security headers
 * and provides recommendations for improvements.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanURLHeaders, generateSecurityReport } from '@/lib/security/headers-scanner';
import { createServerClient } from '@/lib/supabase/server';
import { jsonError, ERROR_CODES, parseJsonBody, BODY_SIZE_LIMITS } from '@/app/api/_lib/response';
import { securityScanLimiter } from '@/lib/services/rateLimitService';
import { getClientIP } from '@/lib/security/ip';
import { logger } from '@/lib/logger';
import { validateHeaderScanTarget } from '@/lib/security/scan-target';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonError('Authentication required', 401, ERROR_CODES.UNAUTHORIZED);
  }

  const clientIp = getClientIP(request);
  const { allowed, remaining, resetIn, limit } = await securityScanLimiter(
    `${user.id}:${clientIp}`,
  );

  if (!allowed) {
    const response = jsonError(
      `Too many scan requests. Please retry in ${resetIn} seconds.`,
      429,
      ERROR_CODES.RATE_LIMITED,
      { retryAfter: resetIn },
    );
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set('X-RateLimit-Reset', resetIn.toString());
    response.headers.set('Retry-After', resetIn.toString());
    return response;
  }

  try {
    const { data: body, error: bodyError } = await parseJsonBody<{
      url?: string;
    }>(request, BODY_SIZE_LIMITS.DEFAULT);
    if (bodyError) return bodyError;

    const url = body && typeof body === 'object' ? body.url : undefined;

    if (!url || typeof url !== 'string') {
      return jsonError('URL is required', 400, ERROR_CODES.BAD_REQUEST);
    }

    const validation = validateHeaderScanTarget(url.trim());
    if (!validation.valid) {
      return jsonError(validation.message, 400, ERROR_CODES.BAD_REQUEST);
    }

    const targetUrl = validation.url;
    const result = await scanURLHeaders(targetUrl);

    const response = NextResponse.json({
      success: true,
      result,
      report: generateSecurityReport(result, targetUrl),
    });
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', resetIn.toString());
    return response;
  } catch (error) {
    logger.error('Header scan error:', error);
    return jsonError('Failed to scan headers', 500, ERROR_CODES.INTERNAL_ERROR);
  }
}
