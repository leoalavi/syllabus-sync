/**
 * Secure IP Extraction Utility
 *
 * SECURITY: This module provides consistent, secure IP extraction across all API routes.
 * It prioritizes verified proxy headers that cannot be spoofed by end users.
 *
 * Trust only the header owned by the configured deployment runtime.
 */

import { NextRequest } from 'next/server';

// ============================================================================
// IP VALIDATION
// ============================================================================

/**
 * Validates IP address format to prevent injection attacks
 * Accepts both IPv4 and IPv6 formats
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;

  // Trim and check length (prevent DoS via long strings)
  const trimmed = ip.trim();
  if (trimmed.length > 45) return false; // Max IPv6 length

  // IPv4 pattern: xxx.xxx.xxx.xxx
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(trimmed)) {
    // Validate each octet is 0-255
    const octets = trimmed.split('.');
    return octets.every((octet) => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  // IPv6 pattern (simplified but covers most cases)
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Pattern.test(trimmed)) {
    return true;
  }

  // IPv6 with IPv4 suffix (::ffff:192.168.1.1)
  const ipv6v4Pattern = /^(::ffff:)?(\d{1,3}\.){3}\d{1,3}$/i;
  if (ipv6v4Pattern.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Extracts the first valid IP from a comma-separated list
 * (x-forwarded-for format: client, proxy1, proxy2)
 */
function extractFirstIP(header: string | null): string | null {
  if (!header) return null;

  const firstIp = header.split(',')[0]?.trim();
  if (firstIp && isValidIP(firstIp)) {
    return firstIp;
  }

  return null;
}

// ============================================================================
// MAIN IP EXTRACTION
// ============================================================================

interface HeaderAccessor {
  get(name: string): string | null;
}

/**
 * Securely extracts client IP address from request headers
 *
 * SECURITY CONSIDERATIONS:
 * - In production, trusts only the configured platform's proxy headers
 * - In development, accepts x-forwarded-for for local testing
 * - Returns 'unknown' if no valid IP can be determined (fail-safe)
 *
 * @param request - Next.js request object
 * @param options - Optional configuration
 * @returns Client IP address or 'unknown'
 */
export function getClientIPFromHeaders(headers: HeaderAccessor): string {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.DEPLOYMENT_PLATFORM === 'cloudflare') {
      const cfIp = headers.get('cf-connecting-ip');
      if (cfIp && isValidIP(cfIp)) return cfIp;
      return 'unknown';
    }

    if (process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV)) {
      const vercelIp = extractFirstIP(headers.get('x-vercel-forwarded-for'));
      if (vercelIp) return vercelIp;
      const realIp = headers.get('x-real-ip');
      if (realIp && isValidIP(realIp)) return realIp;
      const forwardedIp = extractFirstIP(headers.get('x-forwarded-for'));
      if (forwardedIp) return forwardedIp;
    }
    return 'unknown';
  }

  const forwardedIp = extractFirstIP(headers.get('x-forwarded-for'));
  if (forwardedIp) return forwardedIp;
  const realIp = headers.get('x-real-ip');
  if (realIp && isValidIP(realIp)) return realIp;
  return '127.0.0.1';
}

export function getClientIP(request: NextRequest): string {
  return getClientIPFromHeaders(request.headers);
}

/**
 * Get client identifier for rate limiting
 * Uses IP address but could be extended to include user ID for authenticated requests
 */
export function getRateLimitIdentifier(request: NextRequest, userId?: string): string {
  if (userId) {
    // For authenticated requests, use user ID for more accurate limiting
    return `user:${userId}`;
  }

  const ip = getClientIP(request);
  return `ip:${ip}`;
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Check if request is coming from a trusted origin
 * Used for CORS and CSRF protection
 */
export function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');

  if (!origin) {
    // No origin header - could be same-origin request or non-browser client
    // Check referer as fallback
    const referer = request.headers.get('referer');
    if (!referer) return true; // Same-origin or API client

    try {
      const refererUrl = new URL(referer);
      return isSameHost(refererUrl.host);
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    return isSameHost(originUrl.host);
  } catch {
    return false;
  }
}

/**
 * Check if a host matches our allowed hosts
 */
function isSameHost(host: string): boolean {
  const allowedHosts = [
    'localhost',
    '127.0.0.1',
    process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
      : 'syllabus-sync.vercel.app',
  ];

  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
